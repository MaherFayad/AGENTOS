/**
 * The activity feed (§2.5, widget type `activity-feed`).
 *
 * In phase 1 the feed IS agent runs. Each row is two lines:
 *
 *   09:41  Meeting transcript processed · 4 action items assigned, recap drafted
 *          — Follow-Up Coordinator
 *
 * bold event · `--ink-2` detail — `--ink-2` agent attribution.
 *
 * These are sentences a person wrote, not log lines. "RUN_COMPLETED status=ok" would
 * be easier and would make the most-read widget on the dashboard look like a syslog.
 * When the runner hands us a `summary`, we use its words; when it doesn't, we build a
 * plain sentence out of facts we can prove.
 */

import type { RunOutcome, RunTrigger } from './types.ts';

export type ActivityLine = { event: string; detail: string | null };

export type ComposeInput = {
  agentName: string;
  status: RunOutcome['status'];
  trigger: RunTrigger;
  toolCallCount: number;
  durationMs: number | null;
  costUsd: number | null;
  artifacts?: { path: string; kind: string }[];
  summary?: { event: string; detail?: string };
};

/** `1m 22s`, `42s`, `310ms` — the same shape LAST RUNS uses. */
export function formatDuration(ms: number | null): string | null {
  if (ms === null || !Number.isFinite(ms) || ms < 0) return null;
  if (ms < 1_000) return `${Math.round(ms)}ms`;
  const totalSeconds = Math.round(ms / 1_000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

/** `$0.04`. Sub-cent costs round up to `$0.01` rather than displaying `$0.00`. */
export function formatCost(usd: number | null): string | null {
  if (usd === null || !Number.isFinite(usd)) return null;
  if (usd > 0 && usd < 0.01) return '$0.01';
  return `$${usd.toFixed(2)}`;
}

function pluralise(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** The facts clause: `3 tool calls, 42s, $0.04` — only the parts we actually know. */
function factsClause(input: ComposeInput): string | null {
  const parts: string[] = [];
  if (input.toolCallCount > 0) parts.push(pluralise(input.toolCallCount, 'tool call', 'tool calls'));
  const duration = formatDuration(input.durationMs);
  if (duration) parts.push(duration);
  const cost = formatCost(input.costUsd);
  if (cost) parts.push(cost);
  return parts.length ? parts.join(', ') : null;
}

function artifactClause(input: ComposeInput): string | null {
  const artifacts = input.artifacts ?? [];
  if (artifacts.length === 0) return null;
  if (artifacts.length === 1) {
    const name = artifacts[0].path.split(/[\\/]/).pop() ?? artifacts[0].path;
    return `${name} written`;
  }
  return `${pluralise(artifacts.length, 'file', 'files')} written`;
}

/**
 * Build the feed line for a run. `summary` wins when the runner supplies one —
 * the agent knows what it did better than we do.
 */
export function composeActivity(input: ComposeInput): ActivityLine {
  if (input.summary?.event) {
    return { event: input.summary.event, detail: input.summary.detail ?? factsClause(input) };
  }

  const facts = factsClause(input);

  switch (input.status) {
    case 'ok': {
      const artifact = artifactClause(input);
      const detail = [artifact, facts].filter(Boolean).join(' · ') || null;
      const event = input.trigger === 'schedule' ? 'Scheduled run finished' : 'Run finished';
      return { event, detail };
    }
    case 'error': {
      const detail = facts ? `stopped after ${facts}` : 'stopped before it produced anything';
      return { event: 'Run failed', detail };
    }
    case 'cancelled':
      return { event: 'Run cancelled', detail: facts };
    case 'awaiting-approval':
      return { event: 'Waiting on your approval', detail: 'plan drafted, run paused' };
    default: {
      const _exhaustive: never = input.status;
      void _exhaustive;
      return { event: 'Run finished', detail: facts };
    }
  }
}

/**
 * The rendered row, for anything that wants the whole sentence rather than the parts.
 * The dashboard renders the parts (it needs the type weights); this exists for the
 * feed's plain-text fallbacks and for tests that read like the spec.
 */
export function renderActivityRow(time: string, line: ActivityLine, agentName: string): string {
  const middle = line.detail ? `${line.event} · ${line.detail}` : line.event;
  return `${time} ${middle} — ${agentName}`;
}
