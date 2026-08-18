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
  /**
   * `ops.thread.id` — **the thread this run is a turn of** (ADR-023, `Plan §12`).
   *
   * Optional here, and it is the *column's* nullability that decides that, not taste:
   * `ops.agent_runs.thread_id` ships nullable in `0008` because a `NOT NULL` its only writer
   * cannot satisfy is M15's most expensive defect wearing a different column name.
   *
   * **As of M16 the writer exists.** `runner-engineer`'s `startRun` opens a thread for every
   * run and `recordRun` names the column, so the constraint is now *satisfiable* — but it is
   * not landed in this change, and the reason is written down rather than left as a gap: this
   * plane was being edited by `observability-engineer` in the same session, and
   * `observability/__tests__/threads-observability.test.ts` already encodes the handshake for
   * the day it lands (it reads every migration, and requires `SpanScope`'s
   * `agnetos.thread.id` to lose its `?` the moment one says `SET NOT NULL`). Two agents
   * editing one shape in one session is how a shape acquires two readings, which is the
   * defect this board has now paid for four times. The trigger is theirs and it is armed.
   *
   * Consumer: `observability-engineer` — `thread_id` on the metrics endpoints and LAST RUNS.
   */
  threadId?: string;
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
  /**
   * Set when the run was started from a SESSIONS thread (§3.1).
   *
   * **Not a synonym for `threadId`,** which `RunAttribution` above declares. A session
   * thread's conversation is end-to-end encrypted and cannot enter `ops.message` at all
   * (`message_never_holds_session_content`, CLAUDE.md rule 5); a thread id is a row in
   * `ops.thread`. The two travel together on a session-started run and mean different
   * things.
   */
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
  /**
   * `ops.agent_runs.thread_id`. `null` ⇒ this run belongs to no thread.
   *
   * **Nullable because the column is, and that is the rule rather than a coincidence:
   * this type is the shape of a row that was *read back*, not of a call that was made.**
   * `ops.agent_runs.thread_id` is nullable (`0008_threads.sql` §3), so a NULL is a legal
   * row, and a `RunRecord` typed `string` would be a claim about the database that the
   * schema does not make. It becomes `string` in the same change as migration `0009`'s
   * `SET NOT NULL` and not before — the same anchor `SpanScope` uses, for the same reason.
   *
   * **Carried here because a writer cannot name a column the record does not hold.**
   * `db/ledger.ts`'s INSERT — `runner-engineer`'s, not this module's — names `thread_id`
   * and binds this value as of M16 (REQ-OBS-38), so the chain from `RunInit` to the ledger
   * is complete in source. **It has never carried a value: zero runs have executed.**
   */
  threadId: string | null;
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
  /**
   * Register a literal as client text this run may never emit — in a span attribute, a
   * ledger column, an activity line or an **error message**. Traces nothing by itself.
   *
   * Call it the moment the process reads free text a human typed, *before* anything can be
   * composed from it. `contracts/thread-model.md` §7.1: a message body may not leave through
   * the observability plane at any granularity, and §9.3 refuses truncation by name — so
   * the register matches a 32-character window of a registered literal as well as the whole
   * of it, and `body.slice(0, 40)` in an error string is caught.
   *
   * **Why this is a method and not a type.** `rtl-arabic-pdpl-specialist` asked whether the
   * tracer's entry points could refuse a message-shaped argument at compile time. They can
   * for the object case, and it would not be worth it — see the verdict in the handoff — but
   * more importantly no type reaches the case that matters: `` `halted: ${message.body}` ``
   * is a `string` by the time any signature sees it. Interpolation erases provenance, so the
   * only handle left is the characters, which is what this registers.
   *
   * **Returns whether the run can now withhold that text.** `false` means it cannot — the
   * string is under `MIN_LITERAL`, or the register is at capacity — and a caller holding a
   * body that came back `false` is holding text this run will emit if it interpolates it.
   * Refusals for capacity are counted onto the root span as `withheld_refused`. Before
   * 2026-08-18 this returned `void` and the register evicted its oldest literal to make room,
   * so exhaustion silently *reduced* protection; see `withhold.ts`, *The bound refuses*.
   */
  withhold(text: string): boolean;
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
