/**
 * The observability contract. `runner-engineer` codes against exactly this file;
 * everything else under `observability/` is private and may change without a message.
 *
 * Spec: §3.2 (runs emit traces) → §3.5 (Langfuse is the agent-ops data plane).
 */

export type RunStatus = 'ok' | 'error' | 'cancelled' | 'awaiting-approval';
export type RunTrigger = 'manual' | 'schedule' | 'api' | 'audit';
export type ToolStatus = 'ok' | 'error';

/** Everything known when a run starts. Passed to `startRun`. */
export type RunInit = {
  /** `department/agent` — the same slug the graph payload uses. */
  agent: string;
  /** Department slug from ADR-001. Denormalised so metrics never join to frontmatter. */
  department: string;
  /** Display name, for the activity feed's attribution clause ("— Follow-Up Coordinator"). */
  agentName?: string;
  /** Frontmatter `inputs:` as submitted. Redacted here; never stored raw. */
  inputs?: Record<string, unknown>;
  model?: string;
  trigger: RunTrigger;
  /** Set when the run was started from a SESSIONS thread (§3.1). */
  sessionId?: string;
  /** `dryRun: true` runs are traced but excluded from cost, LIVE and status derivation. */
  dryRun?: boolean;
};

/** Token counts for one model call. Whatever the SDK reports; all fields optional. */
export type Usage = {
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  /**
   * Cost as reported by the Agent SDK, when it reports one. Preferred over our own
   * arithmetic — an SDK figure is measured, ours is derived.
   */
  costUsd?: number;
};

/** Handle for one tool call. Exactly one of `ok`/`error` must be called. */
export type ToolSpan = {
  ok(output?: unknown): void;
  error(message: string): void;
};

/** How the run ended. Passed to `finish`. */
export type RunOutcome = {
  status: RunStatus;
  /** Final artifact paths (§3.2 step 6). Paths only — never contents. */
  artifacts?: { path: string; kind: string }[];
  /** Error message when `status: 'error'`. Redacted before it is stored. */
  error?: string;
  /**
   * One human sentence describing what the run actually did, for the activity feed
   * (§2.5). Supply it and the feed reads like the spec's example; omit it and we fall
   * back to a truthful but plainer sentence built from run facts.
   */
  summary?: { event: string; detail?: string };
};

/** The row the ledger stores and the metrics API reads. */
export type RunRecord = {
  runId: string;
  traceId: string;
  traceUrl: string;
  agent: string;
  agentName: string | null;
  department: string;
  model: string | null;
  trigger: RunTrigger;
  sessionId: string | null;
  dryRun: boolean;
  status: RunStatus;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  /** Null when the cost is genuinely unknown. Never a guess (Part VII.3). */
  costUsd: number | null;
  /** How `costUsd` was arrived at — the provenance every number owes. */
  costSource: 'sdk' | 'derived' | 'unpriced';
  toolCallCount: number;
  errorCount: number;
  redactionCount: number;
  activityEvent: string | null;
  activityDetail: string | null;
  error: string | null;
};

export type ToolCallRecord = {
  runId: string;
  spanId: string;
  seq: number;
  name: string;
  status: ToolStatus;
  startedAt: string;
  durationMs: number;
  error: string | null;
};

/** The live trace handle handed back to the runner. */
export type RunTrace = {
  runId: string;
  traceId: string;
  /** Deep link for the drawer's LAST RUNS row (§2.3). Valid immediately. */
  traceUrl: string;
  /** Open a span for one tool call. */
  tool(name: string, input?: unknown): ToolSpan;
  /** Record token usage for one model call. Call once per model turn. */
  usage(u: Usage): void;
  /** Free-form milestone (plan emitted, approval requested, artifact written). */
  event(name: string, detail?: unknown): void;
  /** Close the run. Flushes the trace and writes the ledger row. */
  finish(outcome: RunOutcome): Promise<RunRecord>;
};

/**
 * What the observability module needs from a database. Structural, so the metrics
 * tests can pass a fake and the runner can pass `pg`.
 */
export type DbClient = {
  query<R = Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<{ rows: R[] }>;
};

/** Where a redacted trace payload is shipped. Swappable so tests can capture it. */
export type TraceSink = {
  send(payload: unknown): Promise<void>;
  /** Deterministic URL for a trace id — computed locally, never fetched. */
  urlFor(traceId: string): string;
};
