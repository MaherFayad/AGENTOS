/**
 * The shapes the drawer reads. Spec §2.3, §2.6.5 · Part IV.
 *
 * THE LOCAL MIRROR IS GONE. When this module was first written,
 * `packages/contracts/src/{frontmatter,api}.ts` were `export {}` stubs and these types
 * were transcribed from the prose contracts. Both owners have since filled them in
 * (`comms/inbox/_all/20260815-1857-runner-engineer-api-contract-concrete.md`), so this
 * file now *imports* them and adds only the three things the drawer legitimately owns:
 *
 *   1. A frontmatter type that is honest about what the API guarantees. The contract's
 *      `AgentFrontmatter` has every field required; `GET /api/agents/:slug` hands back
 *      `Record<string, unknown>` and a file can be half-written. So the drawer works with
 *      `Partial<>` plus the three fields it refuses to render without, and collapses the
 *      rest (§2.3's collapse rule is only implementable on optional data).
 *   2. A *flattened* SSE union. The wire shape is `{event, data}`; a reducer is far easier
 *      to read as `{type, ...data}`. The flattening is derived from the contract's data
 *      interfaces, so a field added upstream appears here and a field removed upstream
 *      breaks this file — which is the point.
 *   3. `RunRow`, the LAST RUNS row, which is `RunSummary` with every optional field
 *      actually optional, because a row that lost its cost is still a row worth showing.
 *
 * Owner: drawer-engineer · Consumes: comms/contracts/frontmatter-schema.md,
 * comms/contracts/api-contracts.md
 */

import type {
  AgentDetail,
  AgentFrontmatter as ContractFrontmatter,
  InputField as ContractInputField,
  InputType,
  Ladder,
  RunStatus,
  SseArtifactData,
  SseDoneData,
  SseErrorData,
  SsePlanData,
  SseStartData,
  SseTokenData,
  SseToolData,
  Status as AgentStatus,
  Tier,
} from '@agnetos/contracts';

export type { AgentStatus, InputType, Ladder, RunStatus, Tier };

/**
 * Frontmatter as the drawer may actually receive it.
 *
 * `department` is deliberately widened back to `string`: the API can hand back a slug that
 * is not in ADR-001's table (a new department, a typo), and casting an arbitrary string to
 * the `Department` union would be a lie the compiler then believes. The drawer resolves it
 * through `findDepartment()` and falls back to a title-cased slug.
 */
export type AgentFrontmatter = Omit<Partial<ContractFrontmatter>, 'department'> & {
  name: string;
  department: string;
  tier: Tier;
};

/** Frontmatter `inputs[]`. Re-exported so nothing under `src/drawer` redeclares it. */
export type AgentInput = ContractInputField;

/** The derived block `GET /api/agents/:slug` returns, so the drawer re-derives nothing. */
export type Runnable = AgentDetail['runnable'];

/** `GET /api/agents/:slug`, after `normalizeAgentDoc` has vouched for the three musts. */
export interface AgentDoc {
  /** `department/agent-name`, matching the node ids in contracts/graph-layout.md. */
  slug: string;
  /** Repo-relative path of the SKILL.md. Shown in no UI; useful in an error sentence. */
  path?: string;
  /**
   * `{layer}:{path}@sha256:…` — which file **won the cascade** for this agent in this
   * project, at what content (ADR-014 §2), straight from `AgentDetail.sourceRef`. The header
   * projects the layer half of it as the provenance badge (`Plan §23.6`); `data/provenance.ts`
   * is its only reader and holds nothing of its own.
   *
   * **A required key with a nullable value, and both halves are deliberate.**
   *
   * *Required*, unlike `path` above, because this field is the one that got lost. The
   * contract shipped `sourceRef` and the drawer's model did not, so the header said SOURCE
   * UNKNOWN for every agent for the whole of M15 and no test was red (M15 verdict, blocking
   * item 1). A required key means `normalizeAgentDoc` cannot quietly stop carrying it again:
   * deleting the line fails to compile rather than falling back to an honest-looking blank.
   *
   * *Nullable*, unlike the contract's `sourceRef: string`, because the contract describes
   * what today's runner sends and this type describes what this app may actually receive —
   * a runner older than the contract sends nothing, and `null` says so without fabricating
   * an `''` that would read like a value. It is never rendered; `parseSourceRef` turns
   * anything it cannot read into `unknown`, which is the only other thing the header says.
   */
  sourceRef: string | null;
  frontmatter: AgentFrontmatter;
  /** The SKILL.md body below the frontmatter block. Unused by the drawer today. */
  body?: string;
  /** Absent when the runner is an older build than the contract. Then nothing derives. */
  runnable?: Runnable;
}

/**
 * `GET /api/metrics/runs?agent=&limit=5` row — the durable ledger, `ops.agent_runs`.
 *
 * `startedAt` is ISO 8601 and relative time is rendered client-side — the contract is
 * explicit about it, so LAST RUNS stays live without polling. Every other field is
 * optional here because a row that is missing its cost is still a real run.
 */
export interface RunRow {
  runId?: string;
  startedAt?: string;
  status: RunStatus;
  costUsd?: number;
  /**
   * How `costUsd` was arrived at, straight from the ledger (`ops.agent_runs.cost_source`).
   * A database CHECK ties the two together: `unpriced` **implies** `cost_usd IS NULL`, and
   * any other source implies a non-null cost. So this is the difference between "this run
   * cost nothing to speak of" and "nobody ever priced this run" — two facts that a bare
   * missing number cannot tell apart, and that LAST RUNS must not conflate (Part VII.3).
   *
   * Optional because `GET /api/runs` (the in-memory queue view) does not send it.
   */
  costSource?: CostSource;
  durationMs?: number;
  traceUrl?: string;
}

/** `ops.agent_runs.cost_source` — mirrors `apps/runner/src/observability/pricing.ts`. */
export type CostSource = 'sdk' | 'derived' | 'unpriced';

/* -----------------------------------------------------------------------------
 * SSE union — flattened from `RunStreamEvent` in packages/contracts/src/api.ts.
 * The console renders these and nothing else.
 * -------------------------------------------------------------------------- */

export type RunEvent =
  | ({ type: 'start' } & SseStartData)
  | ({ type: 'token' } & SseTokenData)
  | ({ type: 'tool' } & SseToolData)
  | ({ type: 'plan' } & SsePlanData)
  | ({ type: 'artifact' } & SseArtifactData)
  | ({ type: 'done' } & SseDoneData)
  | ({ type: 'error' } & SseErrorData);

export type RunEventName = RunEvent['type'];

/** Uniform error envelope. `hint` is shown verbatim — it is written for a human. */
export interface ApiError {
  error: { code: string; message: string; hint?: string };
}
