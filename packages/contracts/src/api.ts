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
  // scheduling (§3.2)
  | 'invalid_cron'
  | 'git_write_refused'
  | 'git_failed'
  | 'ofelia_sync_failed'
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
  invalid_cron: 400,
  git_write_refused: 403,
  git_failed: 500,
  ofelia_sync_failed: 502,
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

export interface ScheduleResponse {
  ok: true;
  agent: string;
  cron: string | null;
  /** SHA of the commit that changed `agents/**`. The audit trail is the git log. */
  commitSha: string;
  /** ISO 8601 of the next firing, or `null` when unscheduled. */
  nextRunAt: string | null;
  /** False when the commit landed but ofelia did not reload — the schedule is still true. */
  ofeliaSynced: boolean;
}

// ---------------------------------------------------------------------------
// Approvals   (§3.2)
// ---------------------------------------------------------------------------

export interface PendingApproval {
  runId: string;
  /**
   * Project slug. Present on **every** row, including on the project-scoped route where it
   * is redundant — so that `/api/all/approvals` and `/api/p/:project/approvals` return the
   * same shape and a client cannot render a cross-project queue that fails to say which
   * client each item belongs to.
   */
  project: string;
  agent: string;
  /** Frontmatter `name`, so the queue reads like the map. */
  agentName: string;
  department: string;
  /** The `plan` event's summary — what is being approved. */
  summary: string;
  /** ISO 8601. */
  requestedAt: string;
  inputs: Record<string, RunInputValue>;
}

export interface ApprovalsResponse {
  approvals: PendingApproval[];
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
 * and is marked `scope: 'cross-project'`; there are currently exactly two, which is the
 * number a reviewer can hold in their head, and that is the point of giving them a
 * namespace instead of letting them look like ordinary routes.
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
export const COST_TICKER_ROUTE = { method: 'GET', path: '/api/cost/today' } as const;

/**
 * `POST /api/ops/prune` (ADR-008 nightly retention) is **`observability-engineer`'s**.
 * ofelia fires it; metrics reads and `POST /api/run` never call `ops.prune()`.
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
