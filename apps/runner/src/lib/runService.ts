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
import {
  messageSpanAttributes,
  type RunInputValue,
  type RunRequest,
  type WorkProductSummary,
} from '@agnetos/contracts';
import { ApiError, toApiError } from './errors';
import type { RunnerConfig } from './config';
import { validateInputs, type AgentRecord } from './agents';
import { resolveForDispatch } from './cascade';
import type { MountedProject } from './project';
import { isPathInsideRunRoots, isToolAllowed, unknownConnectorError } from './allowlist';
import {
  assertWorktreeConfinable,
  createWorktree,
  readWorktreeFacts,
  removeWorktree,
  type RunWorktree,
} from './worktree';
import { recordWorkProduct } from '../db/workProducts.ts';
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
import { drainMailbox, renderDrainedMessage } from './mailbox';
import { assertRunnable, memberCountFor, UNIDENTIFIED_HUMAN } from './threadService';
import { appendMessage, createThread, setThreadState } from '../db/threads.ts';
import { readMessages, readThread, type ThreadRow } from '../db/thread-reads.ts';
import type { DbClient, Observability, RunTrace, ToolSpan } from '../observability/index.ts';

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

/**
 * How much of a thread's history is seeded into a continuing run's prompt.
 *
 * A ceiling rather than "all of it", because a thread is unbounded by design — nothing
 * prunes `ops.message`, and `thread-model.md` §7.3 says so plainly. Without a ceiling, the
 * fortieth turn of a conversation pays for the first thirty-nine every time, and the failure
 * is a context-window error deep inside the SDK rather than anything a reader could trace to
 * this decision. Oldest turns are dropped first: the recent ones are what the next turn is
 * about.
 */
const HISTORY_TURNS = 40;

/**
 * How long a `halt`'s question stays answerable.
 *
 * **A policy, not a measurement, and it is written as a constant so it reads as one.**
 * `expires_at` is mandatory on a question (`message_question_expires`) because a run blocked
 * forever on a question nobody saw looks idle, holds a slot and delivers nothing. Twelve
 * hours is chosen so a halt sent at the end of a working day is still answerable the next
 * morning — the primary client is a phone, and the person holding it sleeps.
 *
 * **Nothing sweeps it in M16.** The row carries the deadline and `message_expiry_idx` is the
 * index a sweeper would use, but no scheduler exists (`Plan §14` → M18, unassigned), so a
 * question that expires stays `waiting` rather than failing the thread with
 * `question_unanswered`. That is a stated gap with a named home, not an implied promise.
 */
const HALT_QUESTION_TTL_MS = 12 * 60 * 60 * 1000;

/** The thread store, or `null` when this runner has no Postgres (`--profile dev`, by design). */
const threadDb = (services: RunnerServices): DbClient | null => services.obs?.db ?? null;

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

  /**
   * **Step 0b: this run is a turn of a thread** (ADR-023, `Plan §12`).
   *
   * *"A run is a thread with an agent on the other end."* So a run without one is not a
   * cheaper run, it is a run whose record cannot say what conversation it belongs to — and
   * `ops.agent_runs.thread_id` becomes `NOT NULL` precisely once this is always true.
   *
   * Two paths, and the fork the plan worried about is not one of them. Supplying
   * `threadId` **continues** a thread: a new run, seeded with the history, which is what
   * Part One recommended and what ADR-023 deletes the *"resume the SDK session"*
   * alternative in favour of. Omitting it opens a fresh `agent` thread. There is no third
   * case, and no run reaches the ledger without a thread when there is a store to hold one.
   */
  const db = threadDb(services);
  const thread = db ? await openOrContinueThread(services, db, project, record.slug, request) : null;

  /**
   * **`0009_run_thread_required.sql`, graded from the writer's side, at the only point where
   * the grading is still free.**
   *
   * `ops.agent_runs.thread_id` is now `NOT NULL`. A ledger row is written only when
   * `services.obs` exists, and `Observability.db` is non-optional on that type — so
   * `obs && !thread` is unreachable by construction, and this branch exists precisely
   * because *unreachable by inspection* is what M15 believed about four other columns on
   * this same table. There, the reachable-in-fact case surfaced **after the model was paid
   * for**: the run happened, the money was spent, and the row recording it was refused by
   * Postgres with `23502` naming a column.
   *
   * This converts the last shape of that into a refusal costing nothing — it is above
   * `assertCanStart`, above `startRun`, and above any session. If it ever fires, the run did
   * not happen, which is the only outcome worth having.
   */
  if (services.obs && !thread) {
    throw new ApiError('thread_store_unavailable', 'This run has no thread to belong to, so it was not started.', {
      hint: 'The runner has a ledger but no thread store, and every recorded run must name its thread (migration 0009). Nothing was spent. This is a wiring fault in the runner, not a bad request.',
      retryable: false,
    });
  }

  // Billing (Part V). Checked before anything is spawned, and skipped for a dry run
  // because a dry run costs nothing — refusing it at the cap would deny someone the one
  // operation that can still tell them what is wired up.
  if (!dryRun) await ledger.assertCanStart();

  // Observability starts first when present so LAST RUNS, the Langfuse URL and the SSE
  // `start` event all share one run id. Without Postgres (dev profile) we fall back to
  // the thin Langfuse sink, which is also how a missing ledger stays honest rather than
  // refusing the run.
  // `services.obs && thread` rather than `services.obs?.` because `RunInit.threadId` is
  // required as of 0009 and the compiler has to see the pair, not the guard above. The two
  // are the same condition: the guard has already refused the case where they disagree.
  const obsTrace: RunTrace | undefined = services.obs && thread ? services.obs.startRun({
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
    // The thread this run is a turn of. Required as of `0009_run_thread_required.sql`:
    // `ops.agent_runs.thread_id` is NOT NULL, so a recorded run without one is a row
    // Postgres would refuse *after* the model was paid for. There is no configuration in
    // which a recorded run lacks a thread — a runner with no thread store has no ledger
    // either (`--profile dev`), and the guard above refuses the pair that disagrees.
    threadId: thread.row.id,
  }) : undefined;

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
    // The address the mailbox composer and the roster line both need, from the first frame.
    // `null` only where there is no thread store at all (`--profile dev`).
    threadId: thread ? thread.row.id : null,
  });

  // `project` and `dispatch.agentRef` travel into `execute` because the brain is read and
  // written there. Passing `config` alone was the mechanism by which every project's
  // interview wrote one file (company/COMPANY.md rule 9).
  void execute(services, project, dispatch.agentRef, state, record, inputs, dryRun, langfuseTrace, obsTrace, thread).catch((err) => {
    services.logger.error({ err, runId: state.runId }, 'run failed outside its own error handling');
  });

  return state;
}

/**
 * The thread half of a run's context: the row, its store, and the turns to seed.
 *
 * Carried as one object rather than three parameters so a future caller cannot hold a
 * thread id without the store that can read it — the same shape rule `MountedProject`
 * applies to library reads.
 */
interface RunThread {
  db: DbClient;
  row: ThreadRow;
  /** Prior turns, oldest first, capped at `HISTORY_TURNS`. Empty on a fresh thread. */
  history: Array<{ author: string; kind: string; body: string }>;
}

/**
 * Continue the named thread, or open one for this run.
 *
 * The refusals here are the ones that stop money being spent, and each is somebody's named
 * open question rather than an omission — `assertRunnable` is the single branch and it lives
 * in `threadService` so the run path and a future dispatcher cannot disagree about it.
 */
async function openOrContinueThread(
  services: RunnerServices,
  db: DbClient,
  project: MountedProject,
  agentSlug: string,
  request: RunRequest,
): Promise<RunThread> {
  if (!request.threadId) {
    const department = agentSlug.slice(0, agentSlug.indexOf('/'));
    const slug = agentSlug.slice(agentSlug.indexOf('/') + 1);
    const { id } = await createThread(db, {
      projectId: project.id,
      subject: { via: 'address', address: { form: 'direct', department, slug } },
      // No auth in v1 by design (BOARD #5), so the runner genuinely does not know who
      // pressed Run. `unattributed` is the named state for that, not a placeholder name.
      createdBy: UNIDENTIFIED_HUMAN,
    });
    const row = await readThread(db, project.id, id);
    if (!row) {
      throw new ApiError('internal', `Thread ${id} was created for run and could not be read back.`, {
        hint: 'The thread store accepted the write and then did not return the row. Nothing was charged.',
      });
    }
    await moveToRunning(db, row);
    return { db, row: { ...row, state: 'running' }, history: [] };
  }

  const row = await readThread(db, project.id, request.threadId);
  if (!row) {
    // Opaque across projects, exactly like `run_not_found`: confirming that an id exists
    // somewhere else is itself a cross-project disclosure.
    throw new ApiError('thread_not_found', `No thread ${request.threadId} in "${project.slug}".`, {
      hint: 'That thread id does not belong to this project. Open it from the project it was created in.',
      retryable: false,
    });
  }
  if (row.state === 'running') {
    // One run per thread at a time. Without this a second Run press starts a second run
    // against the same conversation and both drain the same mailbox — each consuming
    // messages the other will never see.
    throw new ApiError('thread_not_addressable', `Thread ${row.id} already has a run in flight.`, {
      hint: 'Wait for it to finish, or send a halt to stop it and be asked before it continues.',
      retryable: true,
    });
  }
  if (row.state === 'closed') {
    throw new ApiError('thread_not_addressable', `Thread ${row.id} is closed.`, {
      hint: 'A closed thread is terminal. Start a new one to carry on this work.',
      retryable: false,
    });
  }
  if (row.addressedTo !== agentSlug && row.kind === 'agent') {
    // The thread names its recipient; a run that pointed a different agent at it would
    // silently rewrite whose conversation this is.
    throw new ApiError('thread_not_addressable', `Thread ${row.id} is addressed to "${row.addressedTo}", not "${agentSlug}".`, {
      hint: `Run "${row.addressedTo}" to continue this thread, or start a new thread for "${agentSlug}".`,
      retryable: false,
    });
  }

  assertRunnable(row, await memberCountFor(services.config, project, row));

  const prior = await readMessages(db, project.id, row.id, HISTORY_TURNS);
  await moveToRunning(db, row);
  return {
    db,
    row: { ...row, state: 'running' },
    history: prior.map((m) => ({ author: m.author, kind: m.kind, body: m.body })),
  };
}

/**
 * Write the agent's turn onto the thread when a run ends.
 *
 * **The thread records that the agent answered and where the answer is; it does not hold
 * the answer.** The deliverable is the artifact on disk, and copying it into
 * `ops.message.body` would put a second copy of the run's output in the table this repo
 * calls its highest-PII surface — one that nothing prunes and no delete verb can reach
 * (`thread-model.md` §7.3). A reference is enough for the two things a thread is for:
 * showing what happened, and seeding the next turn.
 *
 * `payload` is an **object**, never composed into the body first. That is PDPL rather than
 * taste — `redact()` walks object keys and a string has none, so flattening is how content
 * gets past key-based redaction (found three times in one night during M15).
 *
 * A halt writes a `question` instead of an `agent` turn, because that is what a halt *is*:
 * the agent asking whether to continue. `expires_at` is mandatory on a question and is
 * supplied here — see `HALT_QUESTION_TTL_MS` for the horizon, and for the fact that nothing
 * sweeps it yet.
 */
async function appendAgentTurn(
  thread: RunThread,
  state: RunState,
  status: 'ok' | 'error' | 'denied' | 'canceled',
  haltedBy: { body: string; author: string } | null,
): Promise<void> {
  const agentAuthor = `agent:${state.agent}`;
  if (haltedBy) {
    await appendMessage(thread.db, {
      threadId: thread.row.id,
      kind: 'question',
      author: agentAuthor,
      body: `Halted at your request. Should I continue, and is there anything to change first?`,
      payload: {
        runId: state.runId,
        stoppedBy: haltedBy.author,
        checkpointArtifact: state.artifact ? state.artifact.path : null,
      },
      expiresAt: new Date(Date.now() + HALT_QUESTION_TTL_MS).toISOString(),
    });
    return;
  }

  const outcome =
    status === 'ok'
      ? state.artifact
        ? `Finished and wrote ${state.artifact.path}.`
        : 'Finished without producing an artifact.'
      : status === 'denied'
        ? `Denied before it ran. ${state.denialNote ?? ''}`.trim()
        : status === 'canceled'
          ? 'Stopped before finishing.'
          : 'Failed before finishing.';

  await appendMessage(thread.db, {
    threadId: thread.row.id,
    kind: 'agent',
    author: agentAuthor,
    body: outcome,
    payload: {
      runId: state.runId,
      status,
      artifact: state.artifact ? { path: state.artifact.path, kind: state.artifact.kind } : null,
      costUsd: state.costUsd,
      traceUrl: state.traceUrl,
    },
  });
}

/**
 * `open | waiting | failed → running`, through the one transition table.
 *
 * `failed → running` is not a legal edge and is not smuggled in: `failed → open → running`
 * is two real transitions, and writing them as two is what keeps `assertThreadTransition`
 * the only place the order is expressed. `failed` is deliberately non-terminal precisely so
 * a retry is the ordinary path (`thread-model.md` §4.5).
 */
async function moveToRunning(db: DbClient, row: ThreadRow): Promise<void> {
  if (row.state === 'failed') await setThreadState(db, row.id, 'failed', 'open');
  const from = row.state === 'failed' ? 'open' : row.state;
  await setThreadState(db, row.id, from, 'running');
}

/**
 * **The end of a run that had a worktree** (`Plan §13`, ADR-026): observe, record, tell, clean.
 *
 * Four things, in this order, and the order is the argument:
 *
 *   1. **Observe.** `readWorktreeFacts` asks git. Every number on the roster line comes from
 *      here, including `push_state` *with the time it was observed at* — which is why there is
 *      no code path that can write a state without one.
 *   2. **Record.** One row, `ops.work_product`. Counts, paths and shas; **never a diff.** The
 *      diff is read from the tree on demand by the review route and is not storable
 *      (`work-product.md` §6) — a diff in a column is a diff in a backup and one interpolation
 *      away from a span or a model prompt.
 *   3. **Tell**, and only when there is something to tell. `push_state: local` on a finished
 *      run is *"work that exists only on a machine that might get wiped"*, and this board
 *      already ruled how it is delivered: **a message in the run's own thread** (hazard 3).
 *      No `notification` entity, no second pipe, no new message kind — `system` is one ADR-023
 *      already has, and it carries counts in an object rather than prose, because a flattened
 *      sentence is how content gets past key-based redaction.
 *   4. **Clean when unchanged**, which §13 asks for in those words. A tree with no commits and
 *      no changed files is removed; a tree holding work is **kept**, because removing it would
 *      destroy the thing the row is pointing at. That asymmetry is the whole of "cleaned when
 *      unchanged" and it is the reason cleanup is here rather than in the `finally` beside the
 *      scratch dir, which is destroyed unconditionally.
 *
 * Best-effort throughout: a failure here is logged and shown on the console, and never turns a
 * finished run into a failed one. The run happened; the row is the record of that, not the
 * event itself.
 */
async function settleWorkProduct(
  services: RunnerServices,
  project: MountedProject,
  state: RunState,
  thread: RunThread | null,
  worktree: RunWorktree | null,
  agentSlug: string,
): Promise<WorkProductSummary | null> {
  if (!worktree) return null;

  try {
    const facts = await readWorktreeFacts(worktree);
    const unchanged = facts.commits === 0 && facts.filesChanged === 0;

    if (thread) {
      await recordWorkProduct(thread.db, {
        runId: state.runId,
        projectId: thread.row.projectId,
        threadId: thread.row.id,
        repoPath: worktree.repoPath,
        worktreePath: worktree.path,
        branch: facts.branch,
        baseSha: facts.baseSha,
        headSha: facts.headSha,
        commits: facts.commits,
        filesChanged: facts.filesChanged,
        insertions: facts.insertions,
        deletions: facts.deletions,
        pushState: facts.pushState,
        pushCheckedAt: facts.pushCheckedAt,
      });

      if (facts.pushState === 'local') {
        await appendMessage(thread.db, {
          threadId: thread.row.id,
          kind: 'system',
          author: 'system:runner',
          body: `${facts.commits} commit${facts.commits === 1 ? '' : 's'} on ${facts.branch} exist only on this machine.`,
          payload: {
            runId: state.runId,
            agent: agentSlug,
            branch: facts.branch,
            commits: facts.commits,
            filesChanged: facts.filesChanged,
            pushState: facts.pushState,
            pushCheckedAt: facts.pushCheckedAt,
          },
        });
      }
    }

    if (unchanged) {
      await removeWorktree(worktree.repoPath, worktree.path);
      return null;
    }

    return {
      runId: state.runId,
      agent: agentSlug,
      threadId: thread ? thread.row.id : '',
      branch: facts.branch,
      baseSha: facts.baseSha,
      headSha: facts.headSha,
      commits: facts.commits,
      filesChanged: facts.filesChanged,
      insertions: facts.insertions,
      deletions: facts.deletions,
      pushState: facts.pushState,
      pushCheckedAt: facts.pushCheckedAt,
      // **Recorded, not produced.** Nothing in M17 opens a PR, reads CI or runs a test suite,
      // so these are `null` — which means *nobody looked*, exactly as it does in the column.
      prUrl: null,
      prState: null,
      ciState: null,
      testsRun: null,
      testsPassed: null,
      diffAvailable: true,
      createdAt: new Date().toISOString(),
    };
  } catch (err) {
    services.logger.warn({ err, runId: state.runId }, 'work product could not be recorded');
    state.stream.emit('token', {
      text: `[this run's work is in ${worktree.path}, but the work product could not be recorded — it will not appear on the roster]\n`,
    });
    return null;
  }
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
  thread: RunThread | null,
): Promise<void> {
  const { config, store, ledger, langfuse, logger } = services;
  const startedAt = Date.now();
  const toolsUsed: string[] = [];
  const openTools = new Map<string, ToolSpan[]>();
  let scratchDir: string | null = null;
  /**
   * This run's git worktree (M17, `Plan §13`), or `null` — which is **every run in this
   * build**, because no project has a checked-out repo path. Held here rather than inside the
   * session block so the `finally` can clean it on every path, exactly as the scratch dir is.
   */
  let worktree: RunWorktree | null = null;
  let brainInjected = false;
  let lastError: string | undefined;
  /** Set by the drain when a human's `halt` was read at a tool boundary. */
  let haltedBy: { body: string; author: string } | null = null;

  /**
   * **The mailbox drain, at a tool boundary** (`thread-model.md` §4.3).
   *
   * Called after every completed tool call and nowhere else. A tool boundary is the moment
   * the agent is between actions, which is why the contract picks it: it is the only point
   * where stopping costs nothing half-done.
   *
   * What each level actually gets here, stated rather than implied, because the three are
   * not equally built in M16:
   *
   *   `note`  — consumed, marked delivered, shown on the console and counted on the trace.
   *             Its **text** reaches the agent on this thread's *next* run, through history
   *             seeding, not mid-turn. That is the honest half: this runner has no channel
   *             into a live SDK session (see `MID_RUN_STEER`).
   *   `steer` — never arrives, because the route refuses it. If one is here anyway the drain
   *             leaves it undelivered and says so, rather than consuming it as a note.
   *   `halt`  — consumed, and the run stops. Fully built; see the checkpoint below.
   */
  const drainAtToolBoundary = async (): Promise<void> => {
    if (!thread) return;
    let drained;
    try {
      drained = await drainMailbox(thread.db, thread.row.projectId, thread.row.id);
    } catch (err) {
      // A mailbox this runner cannot read must not kill a run that is otherwise working.
      // Said out loud rather than swallowed: a silent drain failure is indistinguishable
      // from an empty mailbox, which is the shape of every defect on this board.
      logger.warn({ err, runId: state.runId }, 'mailbox drain failed; the run continues unsteered');
      state.stream.emit('token', { text: '[the mailbox could not be read at this tool boundary — messages sent to this thread have not been seen]\n' });
      return;
    }

    for (const message of drained.messages) {
      // **The drain line.** The body is registered as withheld at the moment it is read, which
      // is the only point where provenance still exists — an interpolated body in an error
      // string ten lines later is a string no key rule and no type can reach. `withhold()`
      // answering `false` means this run cannot protect it, and that answer is logged rather
      // than dropped (`observability-engineer`, 2026-08-18, taken as proposed).
      state.stream.emit('token', {
        text: renderDrainedMessage(message, obsTrace && {
          withhold: (text: string) => obsTrace.withhold(text),
          onRefusal: (messageId, bodyChars) =>
            logger.warn(
              { runId: state.runId, messageId, bodyChars },
              'the withheld-literal register refused this message body: if anything interpolates it into an error, this run will emit it verbatim',
            ),
        }),
      });
      // Keys and counts, never the body. `messageSpanAttributes` is a type with no `body`
      // field to add back, which is the mechanism — a comment asking the next author to
      // omit it is not (Part VII.4, and M15 proved the difference twice).
      obsTrace?.event('mailbox-read', messageSpanAttributes(message));
    }

    if (drained.undeliverable) {
      state.stream.emit('token', {
        text: `[a steer is in this thread's mailbox and this runner cannot deliver it, so nothing behind it will be read: ${drained.undeliverable.id}]\n`,
      });
    }

    if (drained.halted) {
      haltedBy = { body: drained.halted.body, author: drained.halted.author };
      state.abort.abort();
    }
  };

  const finish = async (
    status: 'ok' | 'error' | 'denied' | 'canceled',
    extra: { denialNote?: string } = {},
  ): Promise<void> => {
    state.status = status;
    state.endedAt = new Date().toISOString();
    state.durationMs = Date.now() - startedAt;
    if (extra.denialNote) state.denialNote = extra.denialNote;

    await ledger.record(state.costUsd);

    /**
     * **The thread's turn ends with the run's.**
     *
     * Mapped rather than copied, because a run status and a thread state answer different
     * questions — *"how did this attempt end"* versus *"can this conversation take another
     * turn"*. `error` ⇒ `failed`, which is **not terminal** by design: continuing a thread
     * starts a new run seeded with its history, so retrying is the ordinary path and a
     * terminal `failed` would force every retry to discard the history that made it worth
     * doing. A halt goes to `waiting`, because a question is outstanding and somebody has to
     * answer it.
     *
     * Best-effort, and deliberately so: a thread whose state could not be advanced must not
     * turn a finished run into a failed one — the run happened and the ledger row is the
     * record of that. The failure is logged and shown, never swallowed.
     */
    const next = haltedBy ? 'waiting' : status === 'error' ? 'failed' : 'open';

    if (thread) {
      try {
        await appendAgentTurn(thread, state, status, haltedBy);
        await setThreadState(thread.db, thread.row.id, 'running', next);
      } catch (err) {
        logger.warn({ err, runId: state.runId, threadId: thread.row.id }, `thread could not be moved to "${next}"`);
        state.stream.emit('token', { text: `[this run finished, but its thread could not be moved out of "running" — it will refuse the next turn until that is fixed]\n` });
      }
    }

    // The work product, and the unpushed message. Best-effort for the same reason the thread
    // turn is: a row that could not be written must not turn a finished run into a failed one.
    const workProduct = await settleWorkProduct(services, project, state, thread, worktree, record.slug);

    state.stream.emit('done', {
      status,
      costUsd: state.costUsd,
      durationMs: state.durationMs,
      traceUrl: state.traceUrl,
      ...(extra.denialNote ? { denialNote: extra.denialNote } : {}),
      // **The two fields §13's roster line could not be drawn without.** `threadState` is the
      // only representation `blocked` has (`waiting` ⇒ the run asked a question and is waiting
      // on a person); `workProduct` is `fix/auth · 3 commits · ⚠ UNPUSHED` without a second
      // fetch. Both `null` where the plane genuinely does not exist, never an invented value.
      threadState: thread ? next : null,
      workProduct,
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
    // **Continuing a thread starts a new run seeded with the thread's history** (`Plan §12`).
    // This is the whole of that mechanism: no SDK session is resumed, and there is no fork
    // to choose between — which is exactly why ADR-023 could delete the fork.
    const prompt = buildPrompt(record, inputs, company, thread?.history ?? []);
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
    /**
     * **The span gets the keys; the prose stays inside the client boundary.**
     *
     * `buildPlanSummary` is `renderInputs(inputs)` newline-joined and then flattened with
     * ` · `, plus the `deliver:` Slack channel and email address — which is the same finding
     * that took `summary` off `/api/all/approvals`, arriving one plane over. Worse here,
     * because **flattening defeats the redactor's key pass**: `redact` walks object keys, so
     * a denylisted `client_name` loses its whole value; a *string* has no keys, so only the
     * value regexes run and four of five PII fields survive (`observability-engineer`,
     * 2026-08-17, with the worked example).
     *
     * They closed it at their boundary by applying the key denylist inside strings, and that
     * is defence in depth rather than the fix: the trace does not need the sentence. It needs
     * the agent, the tools and the input **keys** — which is also more useful, because a key
     * list is filterable and a paragraph is not. The human-readable summary keeps going where
     * it belongs: the SSE `plan` frame and the approval gate, inside the project.
     */
    obsTrace?.event('plan', {
      agent: record.slug,
      tools: record.allowlist.tools,
      inputKeys: Object.keys(inputs),
      approvalRequired: record.approvalRequired,
    });

    if (record.approvalRequired) {
      const gate = store.openGate(state, planSummary);
      services.notifyApproval?.(state, planSummary);
      logger.info({ runId: state.runId, agent: record.slug }, 'run paused at approval gate');
      // Keys, not the sentence — same reason as the `plan` event above.
      obsTrace?.event('approval-requested', { agent: record.slug, inputKeys: Object.keys(inputs) });

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
      // The **project's** scratch root, not the coordinator's — `<scratchRoot>/<slug>/<runId>`.
      scratchDir = await createScratch(project, state.runId);

      /**
       * **Worktree isolation, one per run** (`Plan §13`, ADR-026).
       *
       * Only when this project has a checked-out repository, which **no project does today** —
       * that is M17's second missing precondition, and it is why this branch is not taken on
       * any deployment. `assertWorktreeConfinable` comes first and refuses before a tree
       * exists: a run holding a connector whose writes cannot be bounded is not given a
       * repository, because a worktree is a directory and not a sandbox.
       */
      if (project.repoPath) {
        assertWorktreeConfinable(record.allowlist, record.slug);
        worktree = await createWorktree({
          repoPath: project.repoPath,
          worktreeRoot: project.worktreeRoot,
          runId: state.runId,
        });
        state.stream.emit('token', {
          text: `[working in ${worktree.branch}, cut from ${worktree.baseSha.slice(0, 8)}]\n`,
        });
      }

      // Captured as a const so the gate below cannot observe a later reassignment of the
      // outer `scratchDir` (which the `finally` block nulls out on teardown). The worktree
      // joins it as a second root — **the run's cwd is still the scratch dir**, so a relative
      // path resolves where it always did.
      const roots = worktree ? [scratchDir, worktree.path] : [scratchDir];

      const events = services.session({
        systemPrompt: prompt.system,
        prompt: prompt.user,
        cwd: scratchDir,
        allowedTools: record.allowlist.tools,
        model: config.model,
        signal: state.abort.signal,
        abortController: state.abort,
        // Two gates, both required. The name must be in `wired_into` (BOARD rule 4), AND
        // any path it carries must resolve inside one of this run's roots. The second half
        // used to be a comment in `allowlist.ts` rather than code, which is how twelve agents
        // came to be widened to `workspace` on a boundary that did not exist.
        isToolAllowed: (toolName, input) =>
          isToolAllowed(record.allowlist, toolName) && isPathInsideRunRoots(roots, input),
      });

      let sessionError: { message: string; retryable: boolean } | null = null;

      session: for await (const event of events) {
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
            // **The tool boundary.** A settled call — `ok` or `error` — is the moment the
            // agent is between actions. `start` is not a boundary: the tool is running, and
            // draining there would read the mailbox at the one point where stopping leaves
            // work half-done, which is exactly what a checkpoint is supposed to avoid.
            if (event.status === 'ok' || event.status === 'error') {
              await drainAtToolBoundary();
              // `break session`, not a bare `break`, and the label is load-bearing: a bare
              // `break` here leaves the `switch` and the loop keeps awaiting the next event.
              // `abort()` alone is not enough either — an aborted session may simply stop
              // yielding, and this `for await` would then hang forever on a generator that
              // never produces another event, holding a concurrency slot with nothing in it.
              if (haltedBy) break session;
            }
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

      /**
       * **`halt` — stop, checkpoint, ask.** The third interrupt level, and the only one of
       * the three that is fully built in M16.
       *
       * *Stop* happened at the tool boundary. *Checkpoint* is the artifact extraction below,
       * which runs on this path exactly as it does on the success path — the scratch
       * workspace is destroyed in the `finally` regardless, so anything not extracted now is
       * gone, and "we stopped when you asked and threw your work away" is not a checkpoint.
       * *Ask* is the `question` message `appendAgentTurn` writes, with the mandatory
       * `expires_at` that keeps a thread from waiting on an answer forever.
       *
       * What is deliberately **not** done on this path: the brain write-back and delivery.
       * Halted work is unfinished, and delivering an unfinished deliverable to Slack — or
       * committing a half-written COMPANY.md — is the opposite of what the human asked for.
       */
      if (haltedBy) {
        const checkpoint = await extractArtifact(project, state.runId, scratchDir);
        if (checkpoint) {
          state.artifact = checkpoint;
          state.stream.emit('artifact', {
            path: checkpoint.path,
            kind: checkpoint.kind,
            url: `/api/run/${state.runId}/artifact`,
            bytes: checkpoint.bytes,
          });
        }
        state.stream.emit('token', {
          text: checkpoint
            ? '[halted. The work so far was saved as this run\'s artifact, and the thread is waiting on your answer.]\n'
            : '[halted before anything was written. Nothing was saved, and the thread is waiting on your answer.]\n',
        });
        await finish('canceled');
        return;
      }

      // Saved under `<artifactsRoot>/<slug>/<runId>/`. The project is the only source of
      // that path, so the durable bytes carry the same attribution the ledger row does.
      const artifact = await extractArtifact(project, state.runId, scratchDir);
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
