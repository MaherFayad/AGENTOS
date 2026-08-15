/**
 * Trace + cost emission to self-hosted Langfuse (§3.2 step 5, §3.5).
 *
 * Scope note: `observability-engineer` owns Langfuse — the dashboards, the cost ticker,
 * the LAST RUNS widgets. This file is only the runner's *emitter*, kept as thin as it can
 * be so the two do not end up with two definitions of what a run costs.
 *
 * PII (Part VII.4: "traces stay local, PII redacted at instrumentation"): prompts, inputs
 * and tool arguments are **not** sent. A trace carries which agent ran, how it ended, how
 * long it took, what it cost, and which tools it touched by name. That is enough to
 * operate the system and not enough to leak a client's data into a trace store. The
 * redaction happens here, at the instrumentation point, not in a later cleanup job.
 */
import type { RunnerConfig } from './config';

export interface TraceHandle {
  traceId: string;
  /** Link the drawer opens. `null` when Langfuse is not configured. */
  url: string | null;
}

export interface TraceSummary {
  agent: string;
  status: string;
  durationMs: number;
  costUsd: number | null;
  /** Tool *names* only — never their inputs. */
  toolsUsed: string[];
  /** True when COMPANY.md was injected; a false here explains a bland-sounding output. */
  brainInjected: boolean;
}

export class LangfuseSink {
  private readonly config: RunnerConfig;

  constructor(config: RunnerConfig) {
    this.config = config;
  }

  get enabled(): boolean {
    const { baseUrl, publicKey, secretKey } = this.config.langfuse;
    return Boolean(baseUrl && publicKey && secretKey);
  }

  /** Called before the session starts, so `start` can carry a link the user can click. */
  begin(runId: string): TraceHandle {
    const base = this.config.langfuse.baseUrl;
    return {
      traceId: runId,
      url: this.enabled && base ? `${base.replace(/\/$/, '')}/trace/${runId}` : null,
    };
  }

  /**
   * Fire-and-forget the finished trace. Never throws: a run that succeeded must not be
   * reported as failed because the trace store was down.
   */
  async finish(handle: TraceHandle, summary: TraceSummary): Promise<void> {
    if (!this.enabled) return;
    const { baseUrl, publicKey, secretKey } = this.config.langfuse;
    const auth = Buffer.from(`${publicKey}:${secretKey}`).toString('base64');

    try {
      await fetch(`${(baseUrl as string).replace(/\/$/, '')}/api/public/ingestion`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Basic ${auth}` },
        body: JSON.stringify({
          batch: [
            {
              id: `${handle.traceId}-trace`,
              type: 'trace-create',
              timestamp: new Date().toISOString(),
              body: {
                id: handle.traceId,
                name: summary.agent,
                tags: ['runner', summary.status],
                metadata: {
                  durationMs: summary.durationMs,
                  costUsd: summary.costUsd,
                  toolsUsed: summary.toolsUsed,
                  brainInjected: summary.brainInjected,
                },
              },
            },
          ],
        }),
      });
    } catch {
      // Swallowed on purpose — see the doc comment.
    }
  }
}
