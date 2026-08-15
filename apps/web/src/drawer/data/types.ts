/**
 * The shapes the drawer reads. Spec §2.3, §2.6.5 · Part IV.
 *
 * LOCAL MIRROR, ON PURPOSE AND TEMPORARILY. `packages/contracts/src/frontmatter.ts` and
 * `src/api.ts` are still `export {}` stubs owned by `agent-library-curator` and
 * `runner-engineer`. These types are transcribed from the prose contracts
 * (`comms/contracts/frontmatter-schema.md`, `comms/contracts/api-contracts.md`) and are
 * deleted the moment the real ones land — see the messages in
 * `comms/inbox/agent-library-curator/` and `comms/inbox/runner-engineer/`.
 *
 * The department table is NOT mirrored: ADR-001 says `packages/contracts/departments.ts`
 * is the only place a department may be written down, so we import it.
 *
 * Owner: drawer-engineer
 */

/** Frontmatter `tier` (Part IV) — CHART row, drawer eyebrow, THE LADDER active row. */
export type Tier = 'human-led' | 'assisted' | 'autonomous';

/** Frontmatter `status` — node halo and the LIVE counter. */
export type AgentStatus = 'live' | 'draft' | 'failing';

/** Frontmatter `inputs[].type`. A value outside this union is a schema gap, not a default. */
export type InputType = 'text' | 'url' | 'number' | 'select' | 'textarea' | 'date';

export interface AgentInput {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  /** `select` only. */
  options?: string[];
  placeholder?: string;
}

export interface Ladder {
  'human-led': string;
  assisted: string;
  autonomous: string;
}

export interface AgentFrontmatter {
  name: string;
  description: string;
  department: string;
  cluster?: string;
  icon?: string;
  tier: Tier;
  phase?: string;
  status?: AgentStatus;
  breaks_into?: string[];
  builds_on?: string[];
  wired_into?: string[];
  replaces?: string;
  ladder?: Partial<Ladder>;
  the_human?: string;
  inputs?: AgentInput[];
  /** 5-field cron (§3.2). */
  schedule?: string;
  approval?: 'none' | 'required';
  deliver?: { slack?: string; email?: string };
  /**
   * §2.6.5 `HOW TO RUN IT`. Not yet in the schema — requested from
   * `agent-library-curator`. Until it exists the drawer composes the paragraph from
   * facts already in the frontmatter (schedule / wired_into / approval / inputs) and
   * collapses the section when there are none.
   */
  how_to_run?: string;
}

/** `GET /api/agents/:slug` — "parsed frontmatter + body". */
export interface AgentDoc {
  /** `department/agent-name`, matching the node ids in contracts/graph-layout.md. */
  slug: string;
  frontmatter: AgentFrontmatter;
  /** The SKILL.md body below the frontmatter block. Unused by the drawer today. */
  body?: string;
}

/** `GET /api/runs?agent=&limit=5` row. */
export interface RunRow {
  runId?: string;
  /** Server-rendered ("4h ago"). The drawer never invents one from a missing timestamp. */
  relativeTime?: string;
  startedAt?: string;
  status: 'ok' | 'error' | 'running' | 'awaiting-approval';
  costUsd?: number;
  durationMs?: number;
  traceUrl?: string;
}

/* -----------------------------------------------------------------------------
 * SSE union — comms/contracts/api-contracts.md, `POST /api/run`.
 * The console renders these and nothing else.
 * -------------------------------------------------------------------------- */

export type RunEvent =
  | { type: 'start'; runId: string; agent: string; traceUrl?: string }
  | { type: 'token'; text: string }
  | { type: 'tool'; name: string; input?: unknown; status: 'start' | 'ok' | 'error' }
  | { type: 'plan'; summary: string }
  | { type: 'artifact'; path: string; kind?: string; url?: string }
  | { type: 'done'; status: 'ok' | 'error'; costUsd?: number; durationMs?: number; traceUrl?: string }
  | { type: 'error'; message: string; retryable?: boolean };

export type RunEventName = RunEvent['type'];

/** Uniform error envelope. `hint` is shown verbatim — it is written for a human. */
export interface ApiError {
  error: { code: string; message: string; hint?: string };
}
