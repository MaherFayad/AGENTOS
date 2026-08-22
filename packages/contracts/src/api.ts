/**
 * Runner HTTP + SSE surface — the code half of `comms/contracts/api-contracts.md`.
 *
 * Owner: `runner-engineer` (§3.2 run/schedule/approvals, §3.3 brain, the reads).
 * `sessions-relay-engineer` owns the §3.1 relay half at the bottom of this file and is
 * the only agent that may edit that section.
 *
 * The prose contract is normative (ADR-002). These types are hand-derived from it; when
 * they disagree, the prose wins and this file is the bug.
 *
 * Everything here is tailnet-only (§3.6). No auth in v1 **by design** — do not add a
 * field, route or default whose safety depends on an auth layer that does not exist.
 */

// Type-only, both of them, and from modules this file does not own the shape of: `ThreadState`
// is `thread-model-engineer`'s (ADR-023) and `WorkProductSummary` is this file's owner's, but
// it lives in `work-product.ts` because its prose contract does. Importing rather than
// re-declaring is the rule that stops one shape acquiring two readings.
import type { ThreadState } from './threads';
import type { WorkProductSummary } from './work-product';

// ---------------------------------------------------------------------------
// Errors — uniform on every route
// ---------------------------------------------------------------------------

/**
 * Machine-readable failure reasons. `hint` in the envelope is the human half; this is
 * the half UI code may branch on. Adding a code is a contract change: announce it.
 */
export type ApiErrorCode =
  // request shape
  | 'bad_request'
  | 'not_found'
  // the project axis (ADR-015, Plan §9)
  | 'project_scope_missing'
  | 'project_not_found'
  | 'project_not_active'
  | 'project_not_mounted'
  // agent library (Part IV)
  | 'agent_not_found'
  | 'invalid_frontmatter'
  // the security boundary (§3.2) and its cascade half (ADR-014 §3)
  | 'tool_not_allowed'
  | 'unknown_connector'
  | 'cascade_unresolved'
  | 'capability_widened'
  | 'connector_uncredentialed'
  // runner lifecycle
  | 'run_not_found'
  | 'run_not_pending_approval'
  | 'approval_already_decided'
  /* -- threads, addressing and the mailbox (ADR-023, `Plan §12`) -------------
   *
   * Proposed by `thread-model-engineer` in `contracts/thread-model.md` §11 and accepted
   * here unrenamed, because a code a contract already names is a code its consumers have
   * already read. `thread_store_unavailable` is the one addition, and it is added because
   * the specifier could not have known it was needed: they own the schema, and whether a
   * *database is reachable* is this process's fact. See the block above `RUNNER_ROUTES`.
   */
  /** No such thread **in this project's scope** — deliberately opaque, like `run_not_found`. */
  | 'thread_not_found'
  /**
   * The thread is `closed`, it moved underneath the caller between read and write, **or the
   * address resolved and this build cannot run it** (`#department` — nothing marks a lead;
   * the bare address — M22's router is not built).
   *
   * That last clause is deliberately here and not on `address_unresolved`: *"you typed a
   * department that does not exist"* and *"dispatch is not built yet"* are different facts
   * with different owners, and a client branching on `code` has to be able to tell them
   * apart. The `reason` and the `hint` differ; before this they were the only thing that did.
   */
  | 'thread_not_addressable'
  /** An illegal state transition (`thread-model.md` §4.5). */
  | 'thread_transition_refused'
  /** The addressing grammar refused the line. The parser's own code goes in `hint`. */
  | 'address_malformed'
  /**
   * Parsed; **no agent or department of that name** in this project's resolved roster.
   *
   * Only that. An address that resolved and cannot be run today is `thread_not_addressable`
   * — naming a condition that did not happen sends the next debugger to the parser.
   */
  | 'address_unresolved'
  /** `@slug` matched more than one department. The hint **lists them**; it never picks. */
  | 'address_ambiguous'
  /** A `steer` with no run in flight, or one this runner cannot inject. Never a silent note. */
  | 'interrupt_not_deliverable'
  /** `@@` would spawn N runs against a cap that has never fired (`thread-model.md` §6.1). */
  | 'fanout_dispatch_refused'
  /** Answering a question past its `expires_at`; also the run-failure reason on expiry. */
  | 'question_unanswered'
  /**
   * The thread plane needs Postgres and this runner has none.
   *
   * **Not in `thread-model.md` §11, and added rather than improvised at the call site.**
   * `--profile dev` runs with no database *by design* (`LedgerState: 'absent'` is not a
   * failure), so every thread route has a legitimate state in which it cannot answer. The
   * alternatives were both worse: `internal` (500) reads as a bug in the runner and sends
   * someone to the logs, and `not_found` reads as a route that was never built. 503 says
   * *this instance cannot do this right now*, which is exactly true, and the hint names the
   * profile. Announced to `inbox/_all/` in the same act, because adding a code is a
   * contract change and `drawer-engineer` renders codes.
   */
  | 'thread_store_unavailable'
  /**
   * The bytes this run points at are **not inside the serving project's artifacts
   * directory**, so they are not served (ADR-015, `project-scoping.md` invariant 8).
   *
   * Distinct from `run_not_found`, which is the *cross-project* refusal and is deliberately
   * opaque — from outside its project a run does not exist. This one is not about a caller
   * at all: the run is in this project and its artifact is somewhere the project does not
   * own, which is a fault in the runner's own state. A 500, therefore, and the hint tells
   * the human where the file actually is, because **nothing is deleted** on this path.
   *
   * Its live purpose is the pre-M15 layout: artefacts were written to
   * `artifactsRoot/<runId>/` with no project segment, and adopting such a directory into
   * whichever project happens to be mounted would attribute one client's output to another.
   * Refusing is the same answer `run_unattributed` gives one layer up in the ledger.
   */
  | 'artifact_unattributed'
  // work products and worktrees (M17, `Plan §13`, ADR-026)
  /**
   * This project has no checked-out repository on this host, or the path it names is not a git
   * checkout. **503, not 404**: the caller did nothing wrong and the condition lifts the moment
   * a repo is configured.
   *
   * It is the *second* missing precondition M17's frame named — zero runs have executed, and no
   * project has a repo path a run could work in. Having its own code means "this product has
   * never been pointed at a repository" cannot be read as "this run produced nothing".
   */
  | 'repo_unavailable'
  /**
   * The agent holds a connector whose writes this runner cannot bound, so it is **not given a
   * worktree** (`worktree.ts`, `work-product.md` §3).
   *
   * A refusal, not a confinement claim. A worktree is a directory: a shell command string or an
   * MCP server in another process leaves it in one step, and `isPathInsideRunRoots` can only
   * check arguments that declare a path. 403 because the agent's own `wired_into` is what
   * decides it, and the fix is in the file rather than in the request.
   */
  | 'worktree_unconfinable'
  /**
   * A diff page was requested with a cursor pinned to a `head_sha` the worktree no longer has.
   *
   * 409, and it is a **correctness** refusal rather than an ergonomic one: a worktree is a live
   * directory, and serving page 2 from a tree that moved between pages shows a reviewer a diff
   * that never existed as a whole — and then asks them to approve it.
   */
  | 'work_product_moved'
  /**
   * The work product exists and its worktree is gone, so its diff cannot be read.
   *
   * 410, because the distinction is the whole point: *"the tree was removed"* and *"this run
   * changed nothing"* are the same empty file list and completely different news.
   */
  | 'work_product_unavailable'
  // scheduling (§3.2)
  | 'invalid_cron'
  | 'git_write_refused'
  /**
   * The Second Brain write-back was refused **before git was reached** (ADR-007,
   * `COMPANY.md` rule 9) — the target tier is not this project's to write.
   *
   * Distinct from `git_write_refused`, which is the path check on `agents/**` and
   * `company/**`. Both are 403 and a caller could treat them alike; a *person* reading a
   * log cannot, and the two send you to different files. Requested by
   * `rtl-arabic-pdpl-specialist`, whose sentence is the reason: it is the wrong noun for a
   * refusal that happens before git is involved.
   */
  | 'brain_write_refused'
  | 'git_failed'
  /**
   * The coordinator's scheduling plane (ADR-024, `contracts/scheduling.md` §8, M18 wave 2).
   *
   * **Proposed by `scheduler-engineer`, landed here because a route without a code is a 500.**
   * `contracts/scheduling.md` §8 argues each of these and §11.2/§11.7 ask `runner-engineer`, who
   * owns this file, to accept or rename them. They are added rather than left open because the
   * alternative is what `toApiError`'s comment below already describes: an error carrying an
   * undeclared code arrives at the client as **500 `internal`**, discarding both the code a UI
   * branches on and a sentence written for a human. Renaming any of them is a rename, not a
   * rewrite — the throwing code is in `apps/runner/src/lib/scheduleClock.ts`,
   * `schedulePlan.ts`, `db/schedules.ts` and `routes/schedules.ts`.
   *
   * `ofelia_sync_failed` (502) used to sit above `schedule_not_found`. It is **deleted**, not
   * retired: the sidecar it named left `infra/compose.yaml` at `e4e0bff`, the sync call left
   * `lib/schedule.ts`, and a declared code no path can throw is a branch a client writes and
   * never reaches. `POST /api/schedule` now reports what will act on the commit instead — see
   * `ScheduleResponse.firedBy` below.
   */
  | 'schedule_not_found'
  | 'schedule_address_not_schedulable'
  | 'schedule_policy_missing'
  | 'schedule_preview_stale'
  | 'schedule_tz_unknown'
  | 'schedule_zone_unresolved'
  | 'schedule_zone_intent_incoherent'
  | 'schedule_trigger_not_computable'
  | 'schedule_fire_transition_refused'
  | 'schedule_fire_row_invalid'
  | 'schedule_read_only'
  // reads
  | 'graph_not_built'
  | 'panel_not_found'
  // configuration / billing (Part V)
  | 'runner_not_configured'
  | 'monthly_cap_reached'
  | 'layout_engine_missing'
  | 'internal';

/**
 * The only error body any runner route may return.
 *
 * `hint` is rendered verbatim to a human — usually on a phone, usually mid-task. Write it
 * as an instruction to that person ("Raise RUNNER_MONTHLY_CAP_USD in infra/.env and
 * restart the runner"), never as a stack trace or a log line.
 */
export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    hint?: string;
  };
}

/** The HTTP status each code is served with. Real statuses only — never 200-with-error. */
export const API_ERROR_STATUS: Readonly<Record<ApiErrorCode, number>> = {
  bad_request: 400,
  not_found: 404,
  project_scope_missing: 400,
  project_not_found: 404,
  project_not_active: 409,
  project_not_mounted: 503,
  agent_not_found: 404,
  invalid_frontmatter: 422,
  tool_not_allowed: 403,
  unknown_connector: 422,
  cascade_unresolved: 422,
  capability_widened: 403,
  connector_uncredentialed: 422,
  run_not_found: 404,
  run_not_pending_approval: 409,
  approval_already_decided: 409,
  thread_not_found: 404,
  thread_not_addressable: 409,
  thread_transition_refused: 409,
  address_malformed: 400,
  address_unresolved: 422,
  address_ambiguous: 422,
  interrupt_not_deliverable: 409,
  // 503 and not 403: the caller did nothing wrong and the refusal is temporary — it lifts
  // the day the cap proves it can refuse. `thread-model.md` §11 left the status to this
  // file's owner and it is taken as proposed.
  fanout_dispatch_refused: 503,
  question_unanswered: 409,
  thread_store_unavailable: 503,
  artifact_unattributed: 500,
  repo_unavailable: 503,
  worktree_unconfinable: 403,
  work_product_moved: 409,
  work_product_unavailable: 410,
  invalid_cron: 400,
  git_write_refused: 403,
  brain_write_refused: 403,
  git_failed: 500,

  // `contracts/scheduling.md` §8, statuses as proposed there. Three are worth the sentence:
  //
  //   `schedule_address_not_schedulable` is 422 and deliberately **not** `fanout_dispatch_refused`
  //   (503). That one says *you did nothing wrong and it lifts when the cap fires*; this one
  //   refuses a **stored** intent, and the hint names the two address forms that do work.
  //
  //   `schedule_zone_unresolved` is 422 and **not 500**: the request is well-formed and it is the
  //   build that is incomplete — nothing here reports which zone a person is standing in.
  //
  //   `schedule_read_only` is 409 on a `PATCH` of a `source = 'library'` row. It is edited by PR,
  //   which makes this a conflict with where the truth lives, not a permission problem — there is
  //   no auth in v1 (BOARD rule 6) and 403 would imply one.
  schedule_not_found: 404,
  schedule_address_not_schedulable: 422,
  schedule_policy_missing: 400,
  schedule_preview_stale: 409,
  schedule_tz_unknown: 422,
  schedule_zone_unresolved: 422,
  schedule_zone_intent_incoherent: 422,
  schedule_trigger_not_computable: 422,
  schedule_fire_transition_refused: 409,
  schedule_fire_row_invalid: 422,
  schedule_read_only: 409,

  graph_not_built: 503,
  panel_not_found: 404,
  runner_not_configured: 503,
  monthly_cap_reached: 402,
  layout_engine_missing: 503,
  internal: 500,
};

// ---------------------------------------------------------------------------
// POST /api/run  →  text/event-stream   (§3.2)
// ---------------------------------------------------------------------------

/** Values a frontmatter `inputs[]` form can produce. Types come from the schema contract. */
export type RunInputValue = string | number | boolean | null;

export interface RunRequest {
  /** `department/agent-slug`, e.g. `sales/account-enrichment`. Matches the folder path. */
  agent: string;
  /** Keyed by frontmatter `inputs[].key`. Missing required keys are a `bad_request`. */
  inputs?: Record<string, RunInputValue>;
  /**
   * Resolve the agent, build the prompt, enforce the allowlist and emit `plan` — then
   * stop without spawning the session. Costs nothing and is the cheapest way to verify a
   * `wired_into` list is actually wired.
   */
  dryRun?: boolean;
  /**
   * **Continue an existing thread** (ADR-023, `Plan §12`).
   *
   * Supplied: this run is the thread's next turn, and its prompt is seeded with the
   * thread's history. Omitted: the runner creates a fresh `agent` thread for the run, so
   * *every* run belongs to a thread and `ops.agent_runs.thread_id` can be `NOT NULL`.
   *
   * There is deliberately **no resume-the-SDK-session fork**. Continuing is a new run with
   * the history in front of it — which is what Part One recommended anyway, and what makes
   * `failed` a non-terminal thread state worth having.
   */
  threadId?: string;
}

/** Terminal + transient states of one run. `denied` is an outcome, not an error. */
export type RunStatus =
  | 'queued'
  | 'running'
  | 'awaiting-approval'
  | 'ok'
  | 'error'
  | 'denied'
  | 'canceled';

/** Artifact kinds the runner will save (§3.2). */
export type ArtifactKind = 'md' | 'pdf' | 'json' | 'txt';

/** Lifecycle of a single tool call, as the drawer console renders it. */
export type ToolEventStatus = 'start' | 'ok' | 'error';

export interface SseStartData {
  runId: string;
  /** `department/agent-slug`. */
  agent: string;
  /**
   * `{project}/{department}/{slug}` — the addressable agent (ADR-014 §2). Distinct from
   * `agent`, and the distinction is the point: two projects' `sales/database-mining` are
   * two agents with two histories.
   */
  agentRef: string;
  /**
   * `{layer}:{path}@sha256:…` — **which file actually won the cascade for this run.**
   *
   * Emitted on `start`, before any token, because "I ran the wrong code-reviewer" is a bug
   * class with no error message (Plan §21.9) and the console is where a human is already
   * looking. `drawer-engineer` renders the layer half of this as the provenance badge
   * (`⌂` global · `▣` project) in the drawer header.
   */
  sourceRef: string;
  /** Langfuse trace for this run. `null` when observability is not configured. */
  traceUrl: string | null;
  /** ISO 8601. */
  startedAt: string;
  /**
   * The resolved tool allowlist — exactly the agent's `wired_into`, never a superset
   * (§3.2). Echoed so the console can show what this run was permitted to touch.
   */
  tools: string[];
  /** True when frontmatter says `approval: required`; the run will pause at `plan`. */
  approvalRequired: boolean;
  /**
   * **`ops.thread.id` — the conversation this run is a turn of** (ADR-023, `Plan §12`).
   *
   * `null` only when this runner has no thread store at all (`--profile dev`), which is the
   * same state in which there is no ledger row either. Every recorded run has one:
   * `ops.agent_runs.thread_id` is NOT NULL as of `0009_run_thread_required.sql`.
   *
   * **Why it is on `start` and why it was missing.** Two surfaces need an address the moment
   * the console opens, and neither could have one: the mailbox composer (M16 — shipped inert
   * and pinned by `apps/web/src/drawer/threads/mailbox.test.ts` because this field did not
   * exist) and M17's roster line, whose *"asked you something · 12m ago"* is a question in
   * this thread. *A producer without a consumer is not a feature*, and this was its mirror —
   * two consumers with no producer. Named here in the same commit as M17's schema so wave 2
   * does not pin a second inert surface (`work-product.md` §7, hazard 7).
   */
  threadId: string | null;
}

export interface SseTokenData {
  /** Append to the console verbatim. Not a whole message — a fragment. */
  text: string;
}

export interface SseToolData {
  name: string;
  /** Tool input as the agent supplied it. Already redacted of anything secret-shaped. */
  input: unknown;
  status: ToolEventStatus;
  /** Present on `ok` / `error`. */
  durationMs?: number;
  /** Present on `error`. */
  error?: string;
}

export interface SsePlanData {
  /** What the agent intends to do, in prose. This is what a human approves or denies. */
  summary: string;
  /**
   * Present when `approval: required` — the run is now paused and appears in
   * `GET /api/approvals` until `POST /api/approvals/:runId` decides it.
   */
  awaitingApproval: boolean;
}

export interface SseArtifactData {
  /** Repo-relative path of the saved artifact. */
  path: string;
  kind: ArtifactKind;
  /** Runner URL to fetch it from. */
  url: string;
  bytes: number;
}

export interface SseDoneData {
  status: Extract<RunStatus, 'ok' | 'error' | 'denied' | 'canceled'>;
  /** Real cost from the session's usage. `null` when the run never spent anything. */
  costUsd: number | null;
  durationMs: number;
  traceUrl: string | null;
  /** Present on `denied` — why a human said no. A denied run is data, not a discard. */
  denialNote?: string;
  /**
   * **The state the run left its thread in — and the only representation `blocked` has.**
   *
   * `Plan §13`'s fourth roster line is `● weekly-digest blocked · asked you something · 12m
   * ago`, and before this field it was undrawable: `plan.awaitingApproval` covers the approval
   * gate only, and a run that *asked a question* had no SSE representation at all. A question
   * is a message kind inside a thread (ADR-023), and the thread state is where that fact
   * already lives — so `blocked` is `threadState === 'waiting'` rather than a second flag that
   * could disagree with the row.
   *
   * `null` when this runner has no thread store (`--profile dev`). Mapped from the run's
   * outcome, never copied from it: a run status and a thread state answer different questions
   * — *"how did this attempt end"* versus *"can this conversation take another turn"*.
   */
  threadState?: ThreadState | null;
  /**
   * What this run did to a repository, if anything (`Plan §13`, ADR-026).
   *
   * On the `done` frame so the roster line needs **no second fetch** for `fix/auth · 3
   * commits`: a roster assembled from three routes is a spinner, and every part of it is
   * individually correct so no test catches it. `null` when the run touched no repository,
   * which is every run in this build — no project has a checked-out repo path.
   */
  workProduct?: WorkProductSummary | null;
}

export interface SseErrorData {
  message: string;
  /** Whether re-running unchanged could plausibly succeed. */
  retryable: boolean;
  code?: ApiErrorCode;
  /** Same contract as `ApiErrorBody.error.hint` — written for a human on a phone. */
  hint?: string;
}

/**
 * The SSE event union. The drawer console renders these and nothing else — an event name
 * outside this list is a bug in the runner, not a feature.
 */
export type RunStreamEvent =
  | { event: 'start'; data: SseStartData }
  | { event: 'token'; data: SseTokenData }
  | { event: 'tool'; data: SseToolData }
  | { event: 'plan'; data: SsePlanData }
  | { event: 'artifact'; data: SseArtifactData }
  | { event: 'done'; data: SseDoneData }
  | { event: 'error'; data: SseErrorData };

export type RunStreamEventName = RunStreamEvent['event'];

/** Every event name, for exhaustive switches and tests. */
export const RUN_STREAM_EVENTS = [
  'start',
  'token',
  'tool',
  'plan',
  'artifact',
  'done',
  'error',
] as const satisfies readonly RunStreamEventName[];

/**
 * Replay window for `Last-Event-ID` (§3.2). The primary client is a phone that sleeps
 * mid-run; five minutes of buffer is what makes a locked screen survivable.
 */
export const SSE_REPLAY_WINDOW_MS = 5 * 60 * 1000;

/**
 * SSE `id:` values are the run's per-event sequence number, base-10, starting at 1.
 * A client reconnects with `Last-Event-ID: <n>` and receives `n+1` onward, then live
 * events. Ids are unique per run, not globally — always reconnect to the same runId.
 */
export type SseEventId = string;

// ---------------------------------------------------------------------------
// POST /api/schedule   (§3.2)
// ---------------------------------------------------------------------------

export interface ScheduleRequest {
  agent: string;
  /**
   * 5-field cron, or `null` to unschedule. Written into the agent's frontmatter via a git
   * commit — frontmatter is the source of truth, so the map's clock badge reads the file,
   * not this response.
   */
  cron: string | null;
}

/**
 * **What will act on the committed `schedule:` line — the union that is allowed to be one
 * member wide.**
 *
 * `'nobody'` is the whole set on this build. The cron sidecar that used to be the answer left
 * `infra/compose.yaml` at `e4e0bff` (ADR-024), and the coordinator's scheduling plane
 * (`contracts/scheduling.md`) records fires; it does not start runs. There is no timer in this
 * repo that reaches `POST /api/run`.
 *
 * It is a union rather than a `false` boolean because widening it is the event that matters.
 * When an executor lands, adding `'coordinator'` here makes `apps/runner/src/lib/schedule.ts`
 * fail to compile — its `executionNote` is an exhaustive switch over this type — so the
 * sentence a person reads cannot stay behind the mechanism. A boolean flipping to `true`
 * would have compiled silently, which is how the field this one replaces came to lie.
 */
export type ScheduleFiredBy = 'nobody';

/**
 * The reply to `POST /api/schedule`.
 *
 * **It carries no field that implies an execution, and that is load-bearing rather than
 * stylistic.** The shape this replaces had `nextRunAt` and `ofeliaSynced`; the drawer read the
 * first as a promise and rendered *"Saved. Next run 2026-08-20T06:00:00Z."* on a stack where
 * nothing fires, and the second was named for a container that no longer exists. Both were
 * true statements under names that claimed more than they knew — BOARD rule 9, a declared
 * value read as an observed one, and the reason the rename happened here instead of in the
 * caller: a consumer cannot repeat a mistake the type will not let them spell.
 */
export interface ScheduleResponse {
  ok: true;
  agent: string;
  cron: string | null;
  /** SHA of the commit that changed `agents/**`. The audit trail is the git log. */
  commitSha: string;
  /**
   * Who will fire this schedule. `'nobody'` on this build — the commit is real, the execution
   * is not. Branch on this, not on the presence of a time.
   */
  firedBy: ScheduleFiredBy;
  /**
   * ISO 8601 of the next wall-clock instant the cron expression **matches**, or `null` when
   * unscheduled or when the expression matches no day in the four years the evaluator scans.
   *
   * Arithmetic on the expression, computed in UTC by `lib/cron.ts` — the same function behind
   * the map's clock badge, so badge and response agree by construction. It is **not** a
   * scheduled execution: while `firedBy` is `'nobody'`, nothing happens at this time. Any
   * sentence rendered from this field has to say which of the two it means.
   */
  nextMatchAt: string | null;
  /**
   * One sentence, written for a human on a phone, stating what will and will not happen. The
   * server owns this string so that every client tells the same truth; render it rather than
   * composing your own from `nextMatchAt`.
   */
  executionNote: string;
}

// ---------------------------------------------------------------------------
// Approvals   (§3.2)
// ---------------------------------------------------------------------------

/**
 * A row in the **cross-project** approvals queue — `GET /api/all/approvals`, the one route
 * on this surface declared `scope: 'cross-project'` (§2.5.7).
 *
 * Every field below is either an opaque identifier or library metadata read out of
 * frontmatter. Nothing a human typed, and nothing derived from what a human typed.
 *
 * **Why this is a separate type rather than a comment.** PDPL rule 4 — *client data does not
 * cross clients* — is assumed everywhere else on this API, because everywhere else is scoped
 * to one project and the scope does the arguing. A cross-project route is the one place the
 * rule has to be argued **field by field**, and this interface is where that argument lives.
 * A field reaches the cross-project queue only by being written here on purpose.
 */
export interface PendingApprovalRef {
  runId: string;
  /**
   * Project slug. Present on **every** row, including on the project-scoped route where it
   * is redundant — so a client cannot render a cross-project queue that fails to say which
   * client each item belongs to. Labelling a row with its project is not isolation; an
   * unlabelled row is not even triage.
   */
  project: string;
  agent: string;
  /** Frontmatter `name`, so the queue reads like the map. Library metadata, not client data. */
  agentName: string;
  department: string;
  /** ISO 8601. What the queue sorts on, and what "waiting 40 minutes" is computed from. */
  requestedAt: string;
  /**
   * **How many** inputs the human filled in — never which, and never what.
   *
   * The count is what a queue legitimately needs: it separates "approve this scheduled run,
   * which nobody typed anything into" from "approve this one, which somebody typed six
   * fields into". The values are `PendingApproval.inputs` and they do not leave their
   * project.
   */
  inputCount: number;
}

/**
 * A row in a **project-scoped** approvals queue — `GET /api/p/:project/approvals`.
 *
 * The ref, plus the two fields that stay inside one client's boundary. Both are payload:
 *
 * - `inputs` is the form data a human typed to start the run. It is the highest-PII surface
 *   the runner serves.
 * - `summary` **contains `inputs`**. `buildPlanSummary` renders them into an `Inputs: …`
 *   line, and appends the `deliver:` Slack channel and email address. It reads like a label
 *   and it is not one — which is why dropping `inputs` from the cross-project row while
 *   keeping `summary` would have moved the payload out of an object and into a string and
 *   changed nothing at all.
 *
 * The two routes therefore no longer return the same shape, and that is the point: the
 * property worth keeping is that a cross-project row always names its project, not that a
 * cross-project row is interchangeable with a project-scoped one.
 */
export interface PendingApproval extends PendingApprovalRef {
  /** The `plan` event's summary — what is being approved. See above: it embeds the inputs. */
  summary: string;
  inputs: Record<string, RunInputValue>;
}

export interface ApprovalsResponse {
  approvals: PendingApproval[];
}

/**
 * `GET /api/all/approvals`.
 *
 * A consumer that needs to show *what* is being approved does a project-scoped fetch —
 * `GET /api/p/:project/approvals` — which is not an extra hop it would have avoided: the
 * decision route is `POST /api/p/:project/approvals/:runId`, so acting on a row already
 * means entering its project. The cross-project queue's job is to say *that* something is
 * waiting and *where*; deciding is project work, and one click is the right price for
 * crossing a client boundary.
 */
export interface AllApprovalsResponse {
  approvals: PendingApprovalRef[];
}

export interface ApprovalDecisionRequest {
  decision: 'approve' | 'deny';
  /** Required in practice for `deny`: a denied run is data, and the note is the data. */
  note?: string;
}

export interface ApprovalDecisionResponse {
  ok: true;
  runId: string;
  decision: 'approve' | 'deny';
  /** ISO 8601. */
  decidedAt: string;
  /** What the run does next: resumes streaming, or aborts cleanly and records why. */
  outcome: 'resumed' | 'aborted';
}

// ---------------------------------------------------------------------------
// Threads, addressing and the mailbox   (ADR-023, `Plan §12`)
// ---------------------------------------------------------------------------
//
// The *semantics* of these payloads belong to `comms/contracts/thread-model.md`
// (`thread-model-engineer`) and are not restated here. What lives here is the wire: the
// route table, the request bodies and the response rows. Two agents editing one contract is
// how a shape acquires two readings, so this file transcribes and never re-argues.
//
// One thing this file *does* own, and it is the only correction made to the specification:
// the route spelling. See `RUNNER_ROUTES.threadMessage`.

/**
 * `POST /api/p/:project/thread` — open a thread from a typed line.
 *
 * `line` is what a person typed, address and all (`@sales/x do the thing`,
 * `@@sales …`, `#sales …`, or no sigil at all for the Chief of Staff). The runner parses
 * it with `parseThreadAddress`, resolves the address against **this project's** roster,
 * and creates the thread. Splitting the address out into its own field was rejected: the
 * composer would then have to parse the line to fill the field, which is the parser living
 * in two places — and the second copy is the one that guesses.
 */
export interface CreateThreadRequest {
  line: string;
  /**
   * Optional first turn's interrupt level. A thread created with a body carries a `human`
   * message, and every `human` message declares a level (`thread-model.md` §4.2).
   * Defaults to `note` — which is a declaration, not an absence.
   */
  interrupt?: 'note' | 'steer' | 'halt';
  /** A thread with a due date **is** a task (`Plan §19`). ISO 8601. */
  dueAt?: string | null;
}

/**
 * What a turn would cost, echoed on thread creation so the composer never has to compute it.
 *
 * `estimatedUsd` is typed `null` (`TurnCost` in `packages/contracts/src/threads.ts`) — zero
 * runs have ever completed, so there is nothing to average, and a cost preview is precisely
 * the surface where a plausible number gets believed (BOARD rule 9).
 */
export interface ThreadCostPreview {
  runs: number;
  /** `false` ⇒ `runs` is a **lower bound** — `#` delegates, and a delegation is a second run. */
  runsAreExact: boolean;
  estimatedUsd: null;
  estimateBasis: 'no-completed-runs';
}

/** A thread row as the API serves it. Project-relative, like the column it comes from. */
export interface ThreadSummary {
  id: string;
  kind: 'agent' | 'department' | 'project' | 'session';
  /** `direct` costs 1 run; `fan-out` costs N. Stored, never inferred — `thread-model.md` §2.4. */
  delivery: 'direct' | 'dispatch' | 'fan-out' | 'default' | 'session';
  /** `{department}/{slug}` · `{department}` · `chief-of-staff` · a session id. */
  addressedTo: string;
  state: 'open' | 'running' | 'waiting' | 'closed' | 'failed';
  createdBy: string;
  dueAt: string | null;
  createdAt: string;
  /**
   * **No `title`.** `thread-model.md` §9.6 answered this: a label is either authored (a
   * field nobody fills) or derived from the first message (a second copy of the highest-PII
   * value in the database, in a column that would end up in every list payload). Deriving is
   * a view concern and belongs with whoever builds the list.
   */
}

export interface CreateThreadResponse {
  thread: ThreadSummary;
  /** Present when `line` carried a body — the first turn, already appended. */
  message: ThreadMessageRef | null;
  cost: ThreadCostPreview;
  /**
   * Can this address actually be dispatched today, and if not, why?
   *
   * A thread is *always* created — `@@sales` parses, stores, previews and refuses to spend.
   * The refusal travels with the row rather than only as an error, so a composer can grey
   * the Run button and say the reason instead of discovering it on click.
   */
  dispatchable: { allowed: boolean; reason: string | null; unblockedBy: string | null };
}

/**
 * `POST /api/p/:project/thread/:id/message` — the one pipe.
 *
 * `interrupt` is declared by the sender and never inferred from context: a `note` is queued
 * for the next tool boundary, a `steer` changes course now, a `halt` stops and asks. A
 * `steer` with no run in flight is **refused** (`interrupt_not_deliverable`), never quietly
 * queued — a human who steered and was silently downgraded believes they changed course,
 * and nothing did (`thread-model.md` invariant 7).
 */
export interface PostThreadMessageRequest {
  body: string;
  interrupt: 'note' | 'steer' | 'halt';
  /**
   * Structured content — a question's options, a halt's checkpoint reference.
   *
   * **An object, never pre-flattened prose**, and that is PDPL rather than style: `redact()`
   * walks object keys and a string has none, so composing `{client_name, address, dob}` into
   * a sentence before storage leaks four of five denylisted keys (found three times in one
   * night during M15). Compose prose at the point of display.
   */
  payload?: Record<string, unknown> | null;
  /** Set to answer a question. Required exactly when the message is an `answer`. */
  inReplyTo?: string | null;
}

/** The receipt for an appended turn. Carries no body — the caller already has it. */
export interface ThreadMessageRef {
  id: string;
  /** Monotonic within the thread. `UNIQUE (thread_id, seq)` — a concurrent append fails loudly. */
  seq: number;
  kind: 'human' | 'agent' | 'question' | 'answer' | 'system';
  interrupt: 'note' | 'steer' | 'halt' | null;
  createdAt: string;
}

export interface PostThreadMessageResponse {
  message: ThreadMessageRef;
  /**
   * Where the message went, in the caller's terms.
   *
   * `queued` — it is in the mailbox and the next tool boundary will drain it.
   * `delivered-to-run` — a run is in flight and it was handed to that run's drain.
   *
   * There is no `injected` value, and that absence is the point: injecting a turn into a
   * *live* SDK session is not built (see `interrupt_not_deliverable` and the runner spec),
   * so no response can claim it happened.
   */
  disposition: 'queued' | 'delivered-to-run';
  /**
   * The thread's state **as at the append** — read before the message was written, and
   * returned unchanged by it.
   *
   * A `halt` does not move it here. The run's next drain reads the halt, aborts the session
   * and moves the thread; until that happens the thread really is still `running`, so that
   * is what this says. A composer that renders "stopping" off this field is rendering a
   * state the runner has not reached — poll `GET /api/p/:project/thread/:id` for the move.
   *
   * Pinned by `apps/runner/src/lib/__tests__/thread-refusals.test.ts`, which reads *this
   * comment* and the value the service actually returns, and fails when they disagree.
   */
  threadState: ThreadSummary['state'];
}

/** `GET /api/p/:project/thread/:id` — the thread and its turns, oldest first. */
/**
 * One row of `GET /api/p/:project/threads`.
 *
 * `ThreadSummary` and nothing else from the row, plus two counts the list needs and the
 * detail route already computes per thread. **No `body`, no `title`, no first-message
 * excerpt** — see `ThreadSummary` for why, and `RUNNER_ROUTES.threads` for why that decision
 * survived the route landing rather than being traded away for a nicer list.
 */
export interface ThreadListItem extends ThreadSummary {
  /** Turns in the thread. A count, never a preview. */
  messageCount: number;
  /**
   * The newest turn's timestamp, or `createdAt` for a thread nobody has answered.
   * This is the list's sort key: a thread is interesting because it moved, not because
   * it was created.
   */
  lastActivityAt: string;
}

/**
 * `GET /api/p/:project/threads` — the project's threads, newest activity first.
 *
 * Carries the ledger status for the same reason every other read does: an empty `threads`
 * array means *no threads*, and a missing ledger means *no answer*, and a view that cannot
 * tell those apart prints "0" over an outage (BOARD rule 9 — `unknown` is not `zero`).
 */
export interface ThreadListResponse {
  threads: readonly ThreadListItem[];
  /** Total matching threads before `limit`, so a truncated list can say it is truncated. */
  total: number;
}

export interface ThreadDetail {
  thread: ThreadSummary;
  messages: Array<
    ThreadMessageRef & {
      author: string;
      /** **Free text a person typed.** Served only inside its project, never traced, never pushed. */
      body: string;
      payload: Record<string, unknown> | null;
      inReplyTo: string | null;
      expiresAt: string | null;
      /** `null` ⇒ still in the mailbox. Set when a run's drain read it at a tool boundary. */
      deliveredAt: string | null;
    }
  >;
  /** How many turns are still undelivered. The mailbox is a predicate, not a table. */
  mailboxDepth: number;
}

// ---------------------------------------------------------------------------
// Reads   (§3.2, §3.3)
// ---------------------------------------------------------------------------

/**
 * `GET /api/graph` serves the **stored** layout artifact (ADR-003) — it never simulates.
 * The payload shape is owned by `map-galaxy-engineer` in `graph.ts` /
 * `contracts/graph-layout.md`; it is deliberately not re-declared here, because a second
 * copy of a contract is how the two drift.
 *
 * The runner overlays exactly one field on the stored payload: `core.brainCompleteness`
 * (§3.3), which it computes from `company/` — see `BrainCompleteness`.
 */
export type GraphReadBody = Record<string, unknown>;

/**
 * `WS /ws/graph` — layout **deltas**, never a full payload (Part V, graph-layout.md).
 * Existing nodes keep their coordinates; only new nodes animate in.
 *
 * `TNode` is the node type from `graph.ts`; it is a parameter rather than an import so
 * this file does not fork the graph contract. Consumers write `GraphDelta<GraphNode>`.
 */
export interface GraphDelta<TNode = unknown> {
  /** Layout version hash — matches `version` in the `/api/graph` payload. */
  version: string;
  /** ISO 8601. */
  computedAt: string;
  added: TNode[];
  changed: TNode[];
  /** Node ids only. */
  removed: string[];
}

/** Frames pushed over `WS /ws/graph`. */
export type GraphSocketMessage<TNode = unknown> =
  | { type: 'hello'; version: string; brainCompleteness: number }
  | { type: 'delta'; delta: GraphDelta<TNode> }
  /**
   * The watcher saw a change it could not turn into a delta (layout engine unavailable).
   * Say so rather than pushing a plausible fake — the client refetches `/api/graph`.
   */
  | { type: 'stale'; reason: string };

/**
 * `GET /api/agents` — the list projection of `agents/**`, for CHART's matrix (§2.6).
 *
 * Deliberately **not** `AgentDetail[]`: the list omits `body` and `runnable`. A matrix of
 * twelve agents does not need twelve system prompts to draw a grid, and shipping them
 * would make the cheapest read in the app the most expensive one. A caller that needs
 * either field is looking at one agent, and `GET /api/agents/:slug` is that route.
 *
 * Files that fail the frontmatter schema are **absent**, not half-parsed — the same rule
 * the map follows (frontmatter-schema.md § Validation). `skipped[]` names them so a
 * missing tile has a reason instead of being silently fewer rows.
 */
export interface AgentSummary {
  /** `department/agent-slug`. */
  slug: string;
  /** Repo-relative path of the SKILL.md this was parsed from. */
  path: string;
  /** Frontmatter exactly as parsed. Shape is `frontmatter.ts` (agent-library-curator). */
  frontmatter: Record<string, unknown>;
}

export interface AgentsIndex {
  agents: AgentSummary[];
  /** Agents excluded from `agents[]`, with the reason. Render as a warning, never as a row. */
  skipped: Array<{ slug: string; reason: string }>;
}

/** `GET /api/agents/:slug` — parsed frontmatter + body, for the drawer and chart drawer. */
export interface AgentDetail {
  /** `department/agent-slug`. */
  slug: string;
  /** Repo-relative path of the SKILL.md this was parsed from. */
  path: string;
  /**
   * `{layer}:{path}@sha256:…` — which file **wins the cascade** for this agent in this
   * project, at what content (ADR-014 §2). The same grammar as `SseStartData.sourceRef`;
   * `drawer-engineer` renders the layer half as the provenance badge (`⌂` global · `▣`
   * project) in the drawer header (`Plan §23.6`).
   *
   * Required, not optional, and that is the load-bearing part. This route resolves through
   * the same call dispatch uses, so there is no state in which the runner has an
   * `AgentDetail` and does not know where it came from. An optional field would have to be
   * rendered as `unknown` in a state that cannot occur, and "unknown" would then be
   * indistinguishable from the state that *can*: no run has started yet. The header used to
   * say SOURCE UNKNOWN ~100% of the time for precisely that reason.
   *
   * It is never synthesised from `path`. If the resolver did not produce it, it is not sent.
   */
  sourceRef: string;
  /** Frontmatter exactly as parsed. Shape is `frontmatter.ts` (agent-library-curator). */
  frontmatter: Record<string, unknown>;
  /** Everything after the closing `---`: the system prompt body. */
  body: string;
  /** Derived, so the drawer's Run button does not have to re-derive it. */
  runnable: {
    /** The exact tool allowlist this agent would run with — its `wired_into`. */
    tools: string[];
    /** `wired_into` names with no connector wired. Non-empty ⇒ a run is rejected. */
    missingConnectors: string[];
    approvalRequired: boolean;
    scheduled: boolean;
  };
}

/** One row of `LAST RUNS` (§2.3). Shared with `observability-engineer`'s widgets. */
export interface RunSummary {
  runId: string;
  agent: string;
  status: RunStatus;
  /** ISO 8601. Clients format relative time themselves so it stays live without polling. */
  startedAt: string;
  durationMs: number | null;
  costUsd: number | null;
  traceUrl: string | null;
}

export interface RunsResponse {
  runs: RunSummary[];
}

/** §3.3 — honest, computed, never a constant. Drives the galaxy's particles. */
export interface BrainCompleteness {
  /** 0…1. Fraction of the interview's topics COMPANY.md actually answers. */
  value: number;
  /** Topics answered / total topics — so the UI can say "13 of 20", not just a bar. */
  answered: number;
  total: number;
  /** Files under `company/sources/`. */
  sources: number;
  /** ISO 8601 of the last COMPANY.md commit — git history is brain versioning. */
  updatedAt: string | null;
  /** Topic keys still unanswered, in interview order. The drawer lists these. */
  missing: string[];
}

/** Part V billing split — the runner's own workspace, with a hard monthly cap. */
export interface BudgetStatus {
  /** `null` when no cap is configured, which is itself worth surfacing. */
  capUsd: number | null;
  spentUsd: number;
  /** `null` when uncapped. */
  remainingUsd: number | null;
  /** True ⇒ `POST /api/run` refuses with `monthly_cap_reached`. */
  blocked: boolean;
  /** `YYYY-MM` the spend is counted against. */
  period: string;
  /**
   * Has `spend.json` actually been written?
   *
   * `true` — `spentUsd` survives a restart and the cap is hard.
   * `false` — the write failed; `spentUsd` is this process's memory only, so the cap
   *           resets on restart and **is not a hard cap** (Part V).
   * `null` — no run has finished yet, so durability is untested. This is the honest state
   *          of a fresh runner and is deliberately not probed by writing a zero, because a
   *          spend figure the runner invented is a fabricated number inside a billing
   *          control.
   *
   * It exists because `spentUsd: 0` meant "nothing was spent" and "we cannot remember what
   * was spent" with the same digit — for months, while `/workspaces` was unwritable.
   */
  persisted: boolean | null;
}

/**
 * Reachability of the durable run ledger (`ops.agent_runs`), reported on `GET /api/status`
 * and on **every** `/api/metrics/*` and `/api/cost/today` response.
 *
 * It exists because these two were once the same answer:
 *
 *   - the ledger is unreachable, so we do not know how many runs there were;
 *   - the ledger is fine and there were no runs.
 *
 * Both rendered as "no cost data" and an empty LAST RUNS. A broken state wearing the
 * honest empty state's clothes is worse than a visible outage (BOARD rule 9 / Part VII.3),
 * so the state is explicit and **a count we do not have is `null`, never `0`**.
 *
 * `absent` is not a failure: `--profile dev` runs with no Postgres on purpose.
 */
export type LedgerState = 'connected' | 'unreachable' | 'absent';

export interface LedgerHealth {
  state: LedgerState;
  /** ISO 8601 — when this state began. A five-second outage reads differently to a five-hour one. */
  since: string;
  /** Consecutive failed connection attempts; `0` while connected. */
  attempts: number;
  /** Last connection error, message only — never a DSN, never a password. */
  lastError: string | null;
  /** ISO 8601 for the next reconnect attempt, or `null` when none is scheduled. */
  nextRetryAt: string | null;
  /** Written for a human on a phone. Always present, including when healthy. */
  hint: string;
}

/** `GET /api/status` — the bottom-right status pill and the approvals badge (§2.0). */
export interface StatusResponse {
  /**
   * Tailnet reachability **as observed by this process** — `online` only when one of its
   * own interfaces carries a `100.64.0.0/10` or `fd7a:115c:a1e0::/48` address.
   *
   * `unknown` means *this process cannot tell*, which is the normal answer from inside a
   * compose container when Tailscale runs on the host. It is **not** a claim that the
   * tailnet is down. `tailscaleHint` says which case it is, in a sentence.
   *
   * It used to be `TAILSCALE_IP || TS_HOSTNAME ? 'online' : 'unknown'`, which reported
   * `online` on a machine with no Tailscale installed at all — a setting read back as a
   * connection.
   */
  tailscale: 'online' | 'unknown';
  /** The observed tailnet address, or `null`. Reported because it is checkable. */
  tailscaleAddress: string | null;
  /** Why `tailscale` says what it says. Written for a human on a phone. */
  tailscaleHint: string;
  /** Runs queued behind the concurrency limit. */
  queueDepth: number;
  activeRuns: number;
  pendingApprovals: number;
  /** False ⇒ no API key: runs are refused with `runner_not_configured`. */
  runnerConfigured: boolean;
  budget: BudgetStatus;
  /** `null` when the runner would have had to guess which project to answer for — see `projects`. */
  brain: BrainCompleteness | null;
  /**
   * Durable-ledger reachability. `state: "unreachable"` means LAST RUNS, the cost ticker
   * and every KPI are reporting *unknown*, not *zero* — read this before believing a zero.
   */
  ledger: LedgerHealth;
  /** False ⇒ `/api/graph` will answer `graph_not_built`. */
  graphBuilt: boolean;
  startedAt: string;
  /**
   * The project axis, reported on the one route that is deliberately unscoped (ADR-015).
   *
   * `brain` and `graphBuilt` above are project-shaped facts on a coordinator-scoped route.
   * They answer for `projects.answeredFor`, which is stated rather than assumed. When more
   * than one project is mounted and none is named, they are **`null` and `answeredFor` is
   * `null`** — the runner refuses to pick one, because picking one is exactly the ambient
   * default this design exists to remove. Today one project is mounted, so nothing changes
   * for any existing consumer; the day a second appears, the refusal is loud instead of
   * silent.
   */
  projects: {
    /** How many projects the ledger knows about. `null` when the ledger is unreachable — never `0`. */
    count: number | null;
    /** The project `brain` / `graphBuilt` above describe, or `null` if the runner would have had to guess. */
    answeredFor: string | null;
    /** The project whose library this coordinator process actually mounts. */
    mounted: string;
    /**
     * Is database-level project isolation actually in force on this connection?
     *
     * `'enforced'` — row-level security applies; an unscoped query raises.
     * `'bypassed'` — the runner connects as a superuser or a `BYPASSRLS` role, so every
     *                policy in migration 0005 is **inert**. This is the state on the stack
     *                as it ships today and it is reported rather than assumed, because an
     *                isolation guarantee nobody can check the status of is a claim.
     * `'unknown'`  — no ledger to ask.
     */
    scopeEnforcement: 'enforced' | 'bypassed' | 'unknown';
  };
}

// ---------------------------------------------------------------------------
// Route table — one place a client can read the whole surface
// ---------------------------------------------------------------------------

/**
 * Every runner route. Kept as data so tests can assert the server mounts exactly this set
 * and no more; an undocumented route is an unowned route.
 *
 * **Every route that reads or writes a project's data carries `/api/p/:project`** (ADR-015
 * Q1). Routes that describe the coordinator itself do not, and are marked
 * `scope: 'coordinator'`. A route that deliberately spans projects lives under `/api/all/`
 * and is marked `scope: 'cross-project'`; there is currently exactly **one**, which is the
 * number a reviewer can hold in their head, and that is the point of giving them a
 * namespace instead of letting them look like ordinary routes. (This said "two" until
 * 2026-08-17 and there was only ever one — a count in a comment nothing checks. The
 * checkable version is `RUNNER_ROUTES` itself: filter on `scope`.)
 *
 * **The scope marker is a claim about the route, not about the row it returns.** Marking a
 * route `cross-project` says a caller may see every project's rows; it says nothing about
 * what a row contains, and the two were run together here once already — see `allApprovals`.
 * Adding a route to this namespace means arguing PDPL rule 4 **field by field**, because the
 * scope is no longer available to do the arguing for you.
 *
 * The unscoped forms (`/api/run`, `/api/agents`, …) still exist on the server, and answer
 * **400 `project_scope_missing`** naming the scoped path. Not a redirect and not a default:
 * a stale client must get a named refusal, never another project's rows, and never a 404
 * that reads as though the route had been forgotten.
 */
export const RUNNER_ROUTES = {
  run: { method: 'POST', path: '/api/p/:project/run', scope: 'project' },
  /** Reconnect path for a phone that slept: honours `Last-Event-ID`. */
  runStream: { method: 'GET', path: '/api/p/:project/run/:runId/stream', scope: 'project' },
  runArtifact: { method: 'GET', path: '/api/p/:project/run/:runId/artifact', scope: 'project' },
  schedule: { method: 'POST', path: '/api/p/:project/schedule', scope: 'project' },
  approvals: { method: 'GET', path: '/api/p/:project/approvals', scope: 'project' },
  approvalDecision: { method: 'POST', path: '/api/p/:project/approvals/:runId', scope: 'project' },
  graph: { method: 'GET', path: '/api/p/:project/graph', scope: 'project' },
  /**
   * The collection. Registered before the wildcard below so `…/agents` is a list and not
   * "an agent whose id is the empty string" — the 400 it used to return read like the
   * caller's mistake when the route was simply missing.
   */
  agentsIndex: { method: 'GET', path: '/api/p/:project/agents', scope: 'project' },
  agent: { method: 'GET', path: '/api/p/:project/agents/*', scope: 'project' },
  runs: { method: 'GET', path: '/api/p/:project/runs', scope: 'project' },

  /**
   * Threads (ADR-023, `Plan §12`). Singular `thread` for one thread's sub-resources, which
   * is the same shape `run/:runId/stream` already uses.
   */
  threadCreate: { method: 'POST', path: '/api/p/:project/thread', scope: 'project' },
  thread: { method: 'GET', path: '/api/p/:project/thread/:id', scope: 'project' },
  /**
   * **The collection route, absent since M16 on a reason that has now been met.**
   *
   * M16 recorded it as deliberately not done, and the reason was specific rather than a
   * shrug: *"a list needs a label, and `thread-model.md` §9.6 answered that a label is a
   * view concern — authoring one is a field nobody fills; deriving one puts a second copy of
   * the highest-PII value in every list payload. Building the payload before its renderer
   * exists produces a plausible spec."*
   *
   * Both halves are now settled, and neither by waiving the objection:
   *
   *   - **The label never enters the payload.** This route serves `ThreadSummary`, which
   *     already carries no `title` and says at its own definition why. The list is addressed
   *     by `addressedTo` and ordered by `lastActivityAt`; the *label* is composed by the view
   *     out of fields it already has. §9.6's answer is honoured rather than routed around —
   *     no message body crosses this boundary, so nothing here is a second copy of anything.
   *   - **The renderer exists.** THREADS shipped in M16 and has been printing
   *     `threads.agent.unreadable` since. `threads/lib/threadListRoute.ts` is a self-expiring
   *     stub whose test asserts this route is absent *and names the view to wire when it
   *     lands* — declaring it here is what turns that test red, on purpose.
   *
   * One half of that view's sentence is already false: it says the table "has never met a
   * running database", and `ops.thread` now holds real rows on a migrated Postgres. A view
   * explaining an absence that ended is the same defect running backwards, which is exactly
   * what the stub was built to catch.
   */
  threads: { method: 'GET', path: '/api/p/:project/threads', scope: 'project' },
  /**
   * **`Plan §12` spells this `POST /api/thread/:id/message`, and that route cannot be
   * implemented — the correction is a consequence of an accepted decision, not a style
   * preference.** `thread-model-engineer` proposed the spelling below; it is confirmed here,
   * with one part of their reasoning corrected rather than inherited.
   *
   * *Their argument, which holds and is the load-bearing one:* ADR-015 Q1 makes the project
   * a path segment on **every** route that reads or writes one project's data, with no
   * default, no header and no session state. A thread is one project's data — `ops.thread`
   * carries `project_id NOT NULL` with an RLS policy from its first migration. So the
   * segment is not optional and the plan's path is missing a required part of itself.
   *
   * *Their second argument, corrected:* they add that deriving the project *from the thread
   * row* is impossible because an unscoped read of `ops.thread` **raises** by design (0005
   * §5). That is true of the schema and **inert on this stack today** — compose's Postgres
   * user is a superuser, RLS is bypassed, and `GET /api/status` reports exactly that as
   * `projects.scopeEnforcement: 'bypassed'`. So the unscoped read would currently *succeed*.
   * Resting the correction on it would be resting it on a guarantee this repo can only make
   * structurally (`project-scoping.md` §6), and the first person to check would find the
   * reason didn't hold. The route is right; the first reason is why.
   *
   * And a third reason neither of us wrote down, which survives without any database at all:
   * **a lookup-then-scope route is a route whose authorisation depends on its own payload.**
   * `:id` is caller-supplied, so "find the thread, then decide whose it is" makes the caller
   * choose the scope. Every other route here resolves the project *first*, from the path,
   * and only then touches a row — which is why `run_not_found` can be opaque across projects
   * rather than merely quiet.
   */
  threadMessage: { method: 'POST', path: '/api/p/:project/thread/:id/message', scope: 'project' },

  /**
   * Work products (M17, `Plan §13`, ADR-026, `comms/contracts/work-product.md`).
   *
   * **Project-scoped, and the frame's shorthand `GET /api/work-product/:runId` is not the
   * route.** `drawer-engineer` asked this in wave 0 and it is the M15 class: a run id is
   * opaque across projects, and what sits behind this one is another project's **file paths and
   * file contents**. A route that looks a run up in order to learn whose it is has let a
   * caller-supplied id choose its own scope — the same argument as `threadMessage` above, with
   * a bigger blast radius. The project is resolved from the path first, and the read carries
   * `WHERE project_id = $1` on the statement that finds the row rather than after it.
   *
   *   `workProducts`     — the roster, and with `?review=true` the **review queue**, which is a
   *                        query and not a table (hazard 4; there is no `ops.review`). One
   *                        route for N runs: a roster assembled from N fetches is a spinner.
   *   `workProduct`      — one run. 200 with `workProduct: null` and a stated `absent` reason
   *                        when the run touched no repository; `run_not_found` (404) when it
   *                        belongs to another project.
   *   `workProductDiff`  — one page of the diff, pinned to `head_sha`. `?cursor=` and
   *                        `?files=`. Refuses a cursor from another tree state with
   *                        `work_product_moved` (409) rather than serving two trees as one.
   */
  workProducts: { method: 'GET', path: '/api/p/:project/work-products', scope: 'project' },
  workProduct: { method: 'GET', path: '/api/p/:project/work-product/:runId', scope: 'project' },
  workProductDiff: { method: 'GET', path: '/api/p/:project/work-product/:runId/diff', scope: 'project' },

  /**
   * The scheduling plane (M18, ADR-024, `contracts/scheduling.md` §13).
   *
   * **Plural, and the singular `schedule` above is left exactly as it is.** §13 spelled these
   * `/api/p/:project/schedule`, which collides with a live route — and the collision is the
   * interesting part rather than an inconvenience. `POST .../schedule` writes an agent's
   * **frontmatter** and commits it; these write **`ops.schedule` rows**. Those are precisely the
   * two authorities of ADR-024's *"one table, two authorities"*: `source = 'library'` is the
   * frontmatter side and `source = 'ops'` is this one. Serving both from one path would make a
   * request ambiguous about which authority it is addressing, which is the ambiguity `source`
   * exists to remove. §13 is corrected in `contracts/scheduling.md` with that reasoning.
   *
   *   `schedulePreview` — `{trigger, tz, followMe}` → `FireTimePreview`. **Writes nothing and
   *                       needs no database.** It is the only one of the six that works on this
   *                       stack today, and it is the one the save is not allowed to skip:
   *                       `Plan §14` — *never save an unpreviewed cron expression*.
   *   `schedules`       — POST creates an `ops` row; the body carries `previewToken` and the
   *                       server recomputes it, refusing `schedule_preview_stale` on a mismatch.
   *                       GET lists this project's rows with `source`, so a UI can render the
   *                       `library` half read-only — today that half is always empty and says so.
   *   `schedule`(PATCH) — `enabled`, `until_at`, `review_at` and the policies. A `library` row is
   *                       `schedule_read_only` (409): it is edited by PR.
   *   `scheduleFires`   — one schedule's fire ledger, newest first. The calendar's read. **No
   *                       money field**, ever (`scheduling.md` §6).
   *   `scheduleFireNow` — fire out of band. Writes a `pending` row **before** starting, like
   *                       every other path, so a manual fire is not a second unrecorded way to
   *                       start a run.
   *
   * Every path carries the project segment (ADR-015 Q1). A schedule id is opaque across
   * projects and a lookup-then-scope route would let a caller-supplied id choose its own scope —
   * the same argument as `threadMessage`.
   */
  schedulePreview: { method: 'POST', path: '/api/p/:project/schedules/preview', scope: 'project' },
  scheduleCreate: { method: 'POST', path: '/api/p/:project/schedules', scope: 'project' },
  schedules: { method: 'GET', path: '/api/p/:project/schedules', scope: 'project' },
  scheduleUpdate: { method: 'PATCH', path: '/api/p/:project/schedules/:id', scope: 'project' },
  scheduleFires: { method: 'GET', path: '/api/p/:project/schedules/:id/fires', scope: 'project' },
  scheduleFireNow: { method: 'POST', path: '/api/p/:project/schedules/:id/fire', scope: 'project' },

  panels: { method: 'GET', path: '/api/p/:project/panels', scope: 'project' },
  panel: { method: 'GET', path: '/api/p/:project/panels/:id', scope: 'project' },
  graphSocket: { method: 'WS', path: '/ws/p/:project/graph', scope: 'project' },

  /** The coordinator's own health. Says which project its project-shaped fields answered for. */
  status: { method: 'GET', path: '/api/status', scope: 'coordinator' },
  /** What the switcher lists. A mount registry is coordinator metadata, not project data. */
  projects: { method: 'GET', path: '/api/projects', scope: 'coordinator' },

  /**
   * The approvals badge in the shell footer (§2.5.7) is genuinely cross-project: a human
   * wants to know that *something* is waiting, wherever it is. Every row carries `project`,
   * and the badge is a sum of per-project figures — the same rule ADR-014 §2.1 puts on the
   * LIVE counter, for the same reason.
   *
   * **`scope: 'cross-project'` is a claim about the route, not about its payload**, and the
   * two were confused here once already: this route served every project's run `inputs` for
   * the whole of M15 because the scope was argued and the fields were not. It returns
   * `AllApprovalsResponse` — `PendingApprovalRef`, no `inputs` and no `summary`. Adding a
   * field to this row is a PDPL rule 4 decision; make it there, with a sentence.
   */
  allApprovals: { method: 'GET', path: '/api/all/approvals', scope: 'cross-project' },
} as const;

/**
 * The pre-project paths, still mounted, answering `project_scope_missing`.
 *
 * They exist so the migration is **visible**: a client that has not been updated gets a
 * sentence telling it what to change, on a real 400, instead of silently reading whatever
 * a default would have picked. Delete a row from here only when no client can still send
 * it — and never replace one with a redirect to a default project.
 */
export const LEGACY_UNSCOPED_PATHS: readonly { method: 'GET' | 'POST'; path: string; scopedKey: keyof typeof RUNNER_ROUTES }[] = [
  { method: 'POST', path: '/api/run', scopedKey: 'run' },
  { method: 'GET', path: '/api/run/:runId/stream', scopedKey: 'runStream' },
  { method: 'GET', path: '/api/run/:runId/artifact', scopedKey: 'runArtifact' },
  { method: 'POST', path: '/api/schedule', scopedKey: 'schedule' },
  { method: 'GET', path: '/api/approvals', scopedKey: 'approvals' },
  { method: 'POST', path: '/api/approvals/:runId', scopedKey: 'approvalDecision' },
  { method: 'GET', path: '/api/graph', scopedKey: 'graph' },
  { method: 'GET', path: '/api/agents', scopedKey: 'agentsIndex' },
  { method: 'GET', path: '/api/agents/*', scopedKey: 'agent' },
  { method: 'GET', path: '/api/runs', scopedKey: 'runs' },
  { method: 'GET', path: '/api/panels', scopedKey: 'panels' },
  { method: 'GET', path: '/api/panels/:id', scopedKey: 'panel' },
];

/**
 * `GET /api/cost/today` (§2.0 cost ticker) is **`observability-engineer`'s** route and is
 * deliberately absent above. It reads Langfuse directly; the runner does not proxy it,
 * because two owners of one number is how the ticker starts lying.
 */
export const COST_TICKER_ROUTE = {
  method: 'GET',
  path: '/api/p/:project/cost/today',
  scope: 'project',
} as const;

/**
 * The pre-project spelling, still mounted and answering **400 `project_scope_missing`**,
 * exactly like `LEGACY_UNSCOPED_PATHS` above. Kept as a named constant rather than a bare
 * string so a client can grep for the thing it must stop calling.
 *
 * It is not a fallback and must not be used as one: the ticker is chrome and must not
 * error out on an *unknown value*, but a missing project segment is a client fault with a
 * one-line fix, and answering it with a plausible `usd: null` would hide the migration
 * from the only people who can finish it.
 */
export const LEGACY_COST_TICKER_PATH = '/api/cost/today' as const;

/**
 * `POST /api/ops/prune` (ADR-008 nightly retention) is **`observability-engineer`'s**.
 *
 * **Nothing fires it.** The cron sidecar that was going to left the stack at `e4e0bff`
 * (ADR-024) and the coordinator has no executor yet, so retention runs only when a human
 * calls this route. Metrics reads and `POST /api/run` never call `ops.prune()`.
 */
export const OPS_PRUNE_ROUTE = { method: 'POST', path: '/api/ops/prune' } as const;

// ---------------------------------------------------------------------------
// §3.1 relay — owned by `sessions-relay-engineer`
// ---------------------------------------------------------------------------

/**
 * The relay's types live below this line and only `sessions-relay-engineer` edits them.
 * The invariant that governs the whole section: **the server never sees plaintext.**
 * Decryption is client-side, with the user's key. Any type here that implies otherwise is
 * rejected on sight (§3.1).
 *
 * (Empty at M0 — the relay owner fills it in at M4.)
 */
export type SessionsRelayPlaceholder = never;
