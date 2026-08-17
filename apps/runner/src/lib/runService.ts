/**
 * The run pipeline (§3.2), in the order the spec states it:
 *
 *   0. Resolve the agent **through the cascade**, for this project    (ADR-014, ADR-015)
 *   1. Load SKILL.md + company/COMPANY.md → system prompt   (§3.3 injects the brain here)
 *   2. Tool allowlist = frontmatter `wired_into`, exactly    (the security boundary)
 *   3. cwd = a fresh per-run scratch workspace
 *   4. Spawn the headless Claude Agent SDK session
 *   5. Stream SSE; write trace + cost to Langfuse
 *   6. Save the artifact; deliver per `deliver:`
 *
 * Plus the approval gate, which sits between 3 and 4 when frontmatter says
 * `approval: required` — the run pauses at the plan stage, and nothing is spent until a
 * human answers.
 *
 * Step 0 is new in M15 and is the reason the pipeline no longer calls `loadAgent`.
 * `resolveForDispatch` is the only door: it reads the layers, derives the capability
 * ceiling from the introducing layer, refuses a widening, and hands back a record built
 * from the winning file's bytes. There is deliberately no code path here that produces a
 * runnable agent without going through it.
 */
import type { RunInputValue, RunRequest } from '@agnetos/contracts';
import { ApiError, toApiError } from './errors';
import type { RunnerConfig } from './config';
import { validateInputs, type AgentRecord } from './agents';
import { resolveForDispatch } from './cascade';
import type { MountedProject } from './project';
import { isPathInsideScratch, isToolAllowed, unknownConnectorError } from './allowlist';
import { readCompanyBrain } from './brain';
import { buildPlanSummary, buildPrompt } from './prompt';
import { createScratch, destroyScratch, extractArtifact } from './artifacts';
import { deliver } from './deliver';
import { LangfuseSink } from './langfuse';
import { SpendLedger } from './billing';
import type { AgentSessionFactory } from './agentSession';
import { createSdkSession } from './agentSession';
import { RunStore, type RunState } from './runStore';
import { writeBackBrain, writeBrainSnapshot } from './brain';
import type { Observability, RunTrace, ToolSpan } from '../observability/index.ts';

export interface RunnerLogger {
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
  error: (obj: unknown, msg?: string) => void;
}

export interface RunnerServices {
  config: RunnerConfig;
  store: RunStore;
  ledger: SpendLedger;
  langfuse: LangfuseSink;
  session: AgentSessionFactory;
  logger: RunnerLogger;
  /** Notify a human that a run is waiting at its gate (§3.2 push, §3.6). */
  notifyApproval?: (state: RunState, summary: string) => void;
  /**
   * Observability-engineer's instrumentation (§3.5). Optional: `--profile dev` has no
   * Postgres, and a missing ledger must not refuse a run. When present, LAST RUNS and
   * Langfuse share one id with the SSE stream.
   */
  obs?: Observability;
}

const noopLogger: RunnerLogger = { info: () => {}, warn: () => {}, error: () => {} };

export function createRunnerServices(config: RunnerConfig, logger: RunnerLogger = noopLogger): RunnerServices {
  const ledger = new SpendLedger(config);
  // A spend file that cannot be written makes the Part V cap soft, and used to do so in
  // complete silence. `/api/status.budget.persisted` carries it for machines; this carries
  // it for whoever is reading the logs.
  ledger.onPersistFailure = (message) => logger.warn({}, message);
  return {
    config,
    store: new RunStore(),
    ledger,
    langfuse: new LangfuseSink(config),
    session: createSdkSession,
    logger,
  };
}

/** Concurrency gate. Runs beyond the limit sit in `queued` and show in `queueDepth`. */
class Slots {
  private inUse = 0;
  private readonly waiting: Array<() => void> = [];
  constructor(private readonly limit: number) {}

  async acquire(): Promise<void> {
    if (this.inUse < this.limit) {
      this.inUse += 1;
      return;
    }
    await new Promise<void>((resolve) => this.waiting.push(resolve));
    this.inUse += 1;
  }

  release(): void {
    this.inUse = Math.max(0, this.inUse - 1);
    const next = this.waiting.shift();
    if (next) next();
  }
}

const slotsByLimit = new Map<number, Slots>();
function slotsFor(limit: number): Slots {
  let slots = slotsByLimit.get(limit);
  if (!slots) {
    slots = new Slots(limit);
    slotsByLimit.set(limit, slots);
  }
  return slots;
}

/**
 * Validate, register and start a run. Returns as soon as the run exists and its `start`
 * event is buffered, so the caller can attach the SSE response before any work happens —
 * a client that connects late still gets the whole stream from the buffer.
 */
export async function startRun(
  services: RunnerServices,
  project: MountedProject,
  request: RunRequest,
): Promise<RunState> {
  const { config, store, ledger, langfuse } = services;

  if (typeof request?.agent !== 'string' || request.agent.trim() === '') {
    throw new ApiError('bad_request', 'A run needs an agent.', {
      hint: 'Send {"agent": "department/agent-slug"} — the id shown on the map node.',
      retryable: false,
    });
  }

  // Step 0. Resolution *and* the Class C ceiling check, in one call that cannot be
  // half-performed (ADR-014 §3, §7.3). A widening is refused here, before a scratch
  // workspace exists and before a single token is spent.
  const dispatch = await resolveForDispatch(config, project, request.agent.trim());
  const record = dispatch.record;

  // Schema invariant 5: an unknown `wired_into` name is refused, never silently dropped.
  // Dropping it would start the run with fewer permissions than its author intended and
  // produce a confusing half-failure deep inside the session instead of a clear one here.
  if (record.allowlist.unknown.length > 0) {
    throw unknownConnectorError(record.allowlist.unknown);
  }

  const inputs = validateInputs(record, request.inputs);
  const dryRun = request.dryRun === true;

  // Billing (Part V). Checked before anything is spawned, and skipped for a dry run
  // because a dry run costs nothing — refusing it at the cap would deny someone the one
  // operation that can still tell them what is wired up.
  if (!dryRun) await ledger.assertCanStart();

  // Observability starts first when present so LAST RUNS, the Langfuse URL and the SSE
  // `start` event all share one run id. Without Postgres (dev profile) we fall back to
  // the thin Langfuse sink, which is also how a missing ledger stays honest rather than
  // refusing the run.
  const obsTrace: RunTrace | undefined = services.obs?.startRun({
    agent: record.slug,
    department: record.department,
    agentName: record.name,
    inputs,
    model: config.model,
    trigger: 'manual',
    dryRun,
    // The project axis on the write path (ADR-015). `agentRef` and `sourceRef` come from
    // the cascade, not from this function: they are what the *dispatch* resolved, and
    // rebuilding either here would be a second reading of a question already answered.
    projectId: project.id,
    agentRef: dispatch.agentRef,
    sourceRef: dispatch.sourceRef,
    // Honest, and honestly narrow: no billing account exists yet and the runner does not
    // read `ops.project.default_account_id` in M15, so every run records `unattributed` —
    // a named bucket a cost-by-account surface must render, not a NULL it can drop
    // (ADR-015 Q20). It becomes a real id when accounts do; guessing one now would put a
    // payer in the ledger that nobody ever configured.
    accountId: null,
    accountSource: 'unattributed',
  });

  const state = store.create({
    ...(obsTrace ? { runId: obsTrace.runId } : {}),
    project: project.slug,
    agent: record.slug,
    agentRef: dispatch.agentRef,
    sourceRef: dispatch.sourceRef,
    agentName: record.name,
    department: record.department,
    inputs,
    traceUrl: obsTrace?.traceUrl || null,
  });

  const langfuseTrace = obsTrace
    ? { traceId: obsTrace.traceId, url: obsTrace.traceUrl || null }
    : langfuse.begin(state.runId);
  if (!state.traceUrl) state.traceUrl = langfuseTrace.url;

  state.stream.emit('start', {
    runId: state.runId,
    agent: record.slug,
    agentRef: dispatch.agentRef,
    sourceRef: dispatch.sourceRef,
    traceUrl: state.traceUrl,
    startedAt: state.startedAt,
    tools: record.allowlist.tools,
    approvalRequired: record.approvalRequired,
  });

  // `project` and `dispatch.agentRef` travel into `execute` because the brain is read and
  // written there. Passing `config` alone was the mechanism by which every project's
  // interview wrote one file (company/COMPANY.md rule 9).
  void execute(services, project, dispatch.agentRef, state, record, inputs, dryRun, langfuseTrace, obsTrace).catch((err) => {
    services.logger.error({ err, runId: state.runId }, 'run failed outside its own error handling');
  });

  return state;
}

function toObsStatus(status: 'ok' | 'error' | 'denied' | 'canceled'): 'ok' | 'error' | 'cancelled' {
  if (status === 'ok') return 'ok';
  if (status === 'error') return 'error';
  return 'cancelled';
}

async function execute(
  services: RunnerServices,
  project: MountedProject,
  /** `{project}/{department}/{slug}` — the only key the brain write-back gate accepts. */
  agentRef: string,
  state: RunState,
  record: AgentRecord,
  inputs: Record<string, RunInputValue>,
  dryRun: boolean,
  trace: { traceId: string; url: string | null },
  obsTrace: RunTrace | undefined,
): Promise<void> {
  const { config, store, ledger, langfuse, logger } = services;
  const startedAt = Date.now();
  const toolsUsed: string[] = [];
  const openTools = new Map<string, ToolSpan[]>();
  let scratchDir: string | null = null;
  let brainInjected = false;
  let lastError: string | undefined;

  const finish = async (
    status: 'ok' | 'error' | 'denied' | 'canceled',
    extra: { denialNote?: string } = {},
  ): Promise<void> => {
    state.status = status;
    state.endedAt = new Date().toISOString();
    state.durationMs = Date.now() - startedAt;
    if (extra.denialNote) state.denialNote = extra.denialNote;

    await ledger.record(state.costUsd);
    state.stream.emit('done', {
      status,
      costUsd: state.costUsd,
      durationMs: state.durationMs,
      traceUrl: state.traceUrl,
      ...(extra.denialNote ? { denialNote: extra.denialNote } : {}),
    });
    state.stream.end();

    if (obsTrace) {
      await obsTrace.finish({
        status: toObsStatus(status),
        artifacts: state.artifact
          ? [{ path: state.artifact.path, kind: state.artifact.kind }]
          : undefined,
        error: lastError ?? extra.denialNote,
      });
    } else {
      await langfuse.finish(trace, {
        agent: record.slug,
        status,
        durationMs: state.durationMs,
        costUsd: state.costUsd,
        toolsUsed,
        brainInjected,
      });
    }
  };

  try {
    // The **project's** brain, not the coordinator's. §3.3 injects this into every single
    // invocation, so resolving it from config would be client A's company context reaching
    // an agent running for client B on every call — the PDPL boundary, not a scoping
    // preference (`project-scoping.md` Q8b).
    const company = await readCompanyBrain(project);
    const prompt = buildPrompt(record, inputs, company);
    brainInjected = prompt.brainInjected;

    if (!brainInjected) {
      // Honest empty state (Part VII.3): the run continues, but the console says why the
      // output will sound generic instead of leaving someone to wonder.
      state.stream.emit('token', {
        text: '[company/COMPANY.md is empty — this run has no company context. Run the Company Interview agent to fix that.]\n',
      });
    }

    const planSummary = buildPlanSummary(record, inputs);
    state.stream.emit('plan', { summary: planSummary, awaitingApproval: record.approvalRequired });
    obsTrace?.event('plan', { summary: planSummary, awaitingApproval: record.approvalRequired });

    if (record.approvalRequired) {
      const gate = store.openGate(state, planSummary);
      services.notifyApproval?.(state, planSummary);
      logger.info({ runId: state.runId, agent: record.slug }, 'run paused at approval gate');
      obsTrace?.event('approval-requested', { summary: planSummary });

      const decision = await gate.promise;
      if (decision.decision === 'deny') {
        // A denied run is data, not a discard: the note is recorded, the stream ends
        // cleanly with `denied`, and nothing was spent.
        state.abort.abort();
        await finish('denied', { denialNote: decision.note ?? 'Denied without a note.' });
        return;
      }
      obsTrace?.event('approval-granted');
      state.status = 'running';
      state.gate = null;
    }

    if (dryRun) {
      state.stream.emit('token', {
        text: '[dry run: prompt assembled and permissions resolved; no session was started]\n',
      });
      await finish('ok');
      return;
    }

    const slots = slotsFor(config.maxConcurrentRuns);
    await slots.acquire();
    try {
      state.status = 'running';
      scratchDir = await createScratch(config, state.runId);
      // Captured as a const so the gate below cannot observe a later reassignment of the
      // outer `scratchDir` (which the `finally` block nulls out on teardown).
      const scratch = scratchDir;

      const events = services.session({
        systemPrompt: prompt.system,
        prompt: prompt.user,
        cwd: scratchDir,
        allowedTools: record.allowlist.tools,
        model: config.model,
        signal: state.abort.signal,
        abortController: state.abort,
        // Two gates, both required. The name must be in `wired_into` (BOARD rule 4), AND
        // any path it carries must resolve inside this run's scratch workspace. The second
        // half used to be a comment in `allowlist.ts` rather than code, which is how twelve
        // agents came to be widened to `workspace` on a boundary that did not exist.
        isToolAllowed: (toolName, input) =>
          isToolAllowed(record.allowlist, toolName) && isPathInsideScratch(scratch, input),
      });

      let sessionError: { message: string; retryable: boolean } | null = null;

      for await (const event of events) {
        if (state.abort.signal.aborted) break;
        switch (event.type) {
          case 'token':
            state.stream.emit('token', { text: event.text });
            break;
          case 'tool': {
            if (!toolsUsed.includes(event.name)) toolsUsed.push(event.name);
            if (event.status === 'start' && obsTrace) {
              const stack = openTools.get(event.name) ?? [];
              stack.push(obsTrace.tool(event.name, event.input));
              openTools.set(event.name, stack);
            } else if (event.status === 'ok' || event.status === 'error') {
              const stack = openTools.get(event.name);
              const span = stack?.pop();
              if (event.status === 'ok') span?.ok();
              else span?.error(event.error ?? 'tool error');
            }
            state.stream.emit('tool', {
              name: event.name,
              input: event.input,
              status: event.status,
              ...(event.durationMs !== undefined ? { durationMs: event.durationMs } : {}),
              ...(event.error !== undefined ? { error: event.error } : {}),
            });
            break;
          }
          case 'result':
            state.costUsd = event.costUsd;
            if (event.costUsd !== null) obsTrace?.usage({ costUsd: event.costUsd, model: config.model });
            break;
          case 'error':
            sessionError = { message: event.message, retryable: event.retryable };
            lastError = event.message;
            break;
          default: {
            const _never: never = event;
            void _never;
          }
        }
      }

      if (sessionError) {
        state.stream.emit('error', { ...sessionError, code: 'internal' });
        await finish('error');
        return;
      }

      const artifact = await extractArtifact(config, state.runId, scratchDir);
      if (artifact) {
        state.artifact = artifact;
        state.stream.emit('artifact', {
          path: artifact.path,
          kind: artifact.kind,
          url: `/api/run/${state.runId}/artifact`,
          bytes: artifact.bytes,
        });
      }

      // `inputs` is passed so the write-back can honour the mode the human chose:
      // `review-gaps` reports on the brain and must never replace it.
      const brainWrite = await writeBackBrain(config, project, agentRef, artifact, inputs);
      if (brainWrite) {
        await writeBrainSnapshot(config, brainWrite.completeness, project);
        state.stream.emit('token', {
          text: `[company brain updated — ${brainWrite.completeness.answered} of ${brainWrite.completeness.total} topics answered, commit ${brainWrite.commitSha.slice(0, 8)}]\n`,
        });
      }

      const deliveries = await deliver(config, record.deliver, {
        agentName: record.name,
        runId: state.runId,
        artifact,
      });
      for (const outcome of deliveries) {
        if (outcome.delivered) continue;
        state.stream.emit('token', {
          text: `[not delivered to ${outcome.channel} ${outcome.target}: ${outcome.reason}]\n`,
        });
      }

      await finish('ok');
    } finally {
      slots.release();
    }
  } catch (err) {
    const apiError = toApiError(err);
    lastError = apiError.message;
    logger.error({ err: apiError.message, runId: state.runId }, 'run failed');
    state.stream.emit('error', {
      message: apiError.message,
      retryable: apiError.retryable,
      code: apiError.code,
      ...(apiError.hint ? { hint: apiError.hint } : {}),
    });
    await finish('error');
  } finally {
    // The scratch workspace is destroyed on every path — success, failure, denial and
    // abort alike. An agent's filesystem access is scoped by this directory existing.
    if (scratchDir) {
      try {
        await destroyScratch(scratchDir);
      } catch (err) {
        services.logger.warn({ err, runId: state.runId }, 'scratch workspace could not be removed');
      }
    }
  }
}
