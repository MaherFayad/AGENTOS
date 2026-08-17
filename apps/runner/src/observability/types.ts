/**
 * The observability contract. `runner-engineer` codes against exactly this file;
 * everything else under `observability/` is private and may change without a message.
 *
 * Spec: §3.2 (runs emit traces) → §3.5 (Langfuse is the agent-ops data plane).
 */

import type { AccountSource } from '@agnetos/contracts';

export type RunStatus = 'ok' | 'error' | 'cancelled' | 'awaiting-approval';
export type RunTrigger = 'manual' | 'schedule' | 'api' | 'audit';
export type ToolStatus = 'ok' | 'error';

/**
 * Who a run belongs to. **Required**, all three, and that is a reversal recorded rather
 * than a silent edit.
 *
 * These fields shipped optional on `RunInit` with a comment defending the split: the
 * ledger's `assertAttributed` refuses an unattributed row at runtime, and requiring them
 * here was said to break `--profile dev` and the metrics fakes. That reasoning was wrong
 * in one specific way. `assertAttributed` guards **Postgres**, which is one of the three
 * places a run's data lands; the other two are the **trace store** and the **artefact
 * directory**, and neither is behind that check. So a run could reach Langfuse with no
 * project and be recorded there, and only fail later at the ledger — which is a leak that
 * has already happened by the time anything refuses.
 *
 * The dev-profile argument does not survive contact either: naming your project has never
 * needed a database. Every real caller resolves a `MountedProject` before it calls
 * `startRun`, in every profile. What optionality bought was that a *test* could omit them,
 * which is exactly the caller that should not be allowed to.
 *
 * `assertAttributed` stays. Two mechanisms, deliberately redundant, for the same reason
 * the read path has two: the type is what stops the mistake being written, and the
 * runtime check is what catches an `as` cast, a JSON boundary or a value that is present
 * and empty. Neither is a substitute for the other.
 */
export type RunAttribution = {
  /** `ops.project.id` — which project's ledger, trace and artefacts this run belongs in. */
  projectId: string;
  /**
   * `{project}/{department}/{slug}` (ADR-014 §2) — the addressable agent, and the identity
   * every operations row hangs off. Run history never follows a fork or a promotion.
   */
  agentRef: string;
  /**
   * `{layer}:{path}@sha256:…` — which file actually won the cascade, at what content.
   *
   * Never derived. "Which code-reviewer did I run?" is a bug class with no error message
   * (`Plan §21.9`), so a plausible reconstruction here would be worse than a refusal.
   */
  sourceRef: string;
  /** `ops.billing_account.id`, when the payer is known. */
  accountId?: string | null;
  /**
   * How the payer was chosen (ADR-015 Q20). `unattributed` is a **named** state, not a
   * missing one: "we do not know who paid" must be its own bucket on a cost-by-account
   * surface rather than rows a chart quietly drops.
   *
   * This one stays optional because `unattributed` is a truthful default — it asserts
   * ignorance. `projectId` has no truthful default; any value it could fall back to is a
   * guess about whose data this is.
   */
  accountSource?: AccountSource;
};

/** Everything known when a run starts. Passed to `startRun`. */
export type RunInit = RunAttribution & {
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
  /** `null` when traces are not being shipped. Never a link to a trace that was not sent. */
  traceUrl: string | null;
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
  /** The project axis, carried from `RunInit`. `null` ⇒ the run was never attributed. */
  projectId: string | null;
  agentRef: string | null;
  sourceRef: string | null;
  accountId: string | null;
  /** Never `null` — an unknown payer is the value `unattributed`, not an absent one. */
  accountSource: AccountSource;
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
  /**
   * Deep link for the drawer's LAST RUNS row (§2.3). Valid immediately.
   * `null` when traces are not being shipped — see `createNullSink`.
   */
  traceUrl: string | null;
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
  /**
   * Deterministic URL for a trace id — computed locally, never fetched.
   *
   * `null` when there is no trace to link to (the null sink, i.e. Langfuse unconfigured).
   * A plausible URL to a project that does not exist is worse than no link at all.
   */
  urlFor(traceId: string): string | null;
};
