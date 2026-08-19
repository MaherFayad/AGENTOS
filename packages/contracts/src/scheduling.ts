/**
 * Scheduling — `scheduler-engineer`, ADR-024, `AGENTOS-V2-PLAN.md` `Plan §14`.
 *
 * The code half of `comms/contracts/scheduling.md`. Normative source is the prose contract and
 * `apps/runner/src/db/migrations/0011_scheduling.sql`; this module is hand-generated from them
 * and `apps/runner/src/db/__tests__/schedule-schema-pinning.test.ts` asserts the three of them
 * agree, in both directions.
 *
 * **Nothing here fires anything.** There is no clock in this repo. M18's foundation slice is two
 * tables, one grammar restriction and two typed refusals; the coordinator process, the cron
 * parser, the next-ten preview and the calendar are all later slices with named owners.
 *
 * Three things in this file are load-bearing and are types rather than comments, because a
 * comment is not a mechanism:
 *
 *   1. `ScheduleCostProjection.estimatedUsd` is typed `null`. Zero runs have completed, so there
 *      is nothing to average — and a schedule multiplies a cost estimate by every future
 *      occurrence, which makes it the worst surface in the product for a plausible number
 *      (BOARD rule 9). Same instrument as `TurnCost.estimatedUsd`, same reason.
 *   2. `SCHEDULE_BUDGET_ENFORCEMENT.enforced` is typed `false`. `Plan §14`'s headline mechanism
 *      has never refused anything, and arming it should be a reviewable type-level act.
 *   3. `SCHEDULE_LIBRARY_MATERIALIZATION.possibleToday` is typed `false`. Frontmatter's
 *      `schedule:` is a bare cron and cannot satisfy the mandatory policy columns.
 */

import type { ResolvedThreadAddress } from './threads';

/* -------------------------------------------------------------------------- *
 * 1. The vocabularies — each one is a CHECK in 0011_scheduling.sql
 * -------------------------------------------------------------------------- */

/**
 * One table, two authorities (`Plan §14`). A `library` row is materialized from an agent's
 * frontmatter on library sync, is read-only in the UI and is edited by PR; an `ops` row is
 * created ad-hoc in the app. Not two tables: the authority is a property of a row, and two
 * tables means every reader unions them and the first one that forgets hides a schedule.
 */
export const SCHEDULE_SOURCES = ['library', 'ops'] as const;
export type ScheduleSource = (typeof SCHEDULE_SOURCES)[number];

/** `Plan §14`'s six. A swarm that only reacts to the clock is half a swarm. */
export const TRIGGER_KINDS = [
  'cron',
  'interval',
  'event',
  'condition',
  'chain',
  'manual',
] as const;
export type TriggerKind = (typeof TRIGGER_KINDS)[number];

/**
 * `Plan §14` detail 3, **mandatory with no default**. The host *will* be asleep.
 *
 * There is no safe default and that is the argument, not caution: `skip` silently loses a
 * briefing, `catch_up_all` silently spends four figures on a laptop that slept a week, and the
 * two failures point in opposite directions. A default would let a writer that never considered
 * the question look exactly like one that did.
 */
export const MISSED_RUN_POLICIES = ['skip', 'catch_up_once', 'catch_up_all', 'ask'] as const;
export type MissedRunPolicy = (typeof MISSED_RUN_POLICIES)[number];

/** `Plan §14` detail 4, mandatory with no default. If 08:00 is still running at 09:00. */
export const OVERLAP_POLICIES = ['skip', 'queue', 'kill_previous', 'allow_parallel'] as const;
export type OverlapPolicy = (typeof OVERLAP_POLICIES)[number];

/**
 * `Plan §14` detail 1. The row is written at the occurrence time in `pending`, **before** the
 * run — fire-then-record makes "never fired" invisible, which is the failure most worth seeing.
 * `schedule_fire_recorded_before_run` in 0011 is the enforcer.
 */
export const SCHEDULE_FIRE_STATES = [
  'pending',
  'running',
  'done',
  'failed',
  'missed',
  'skipped',
] as const;
export type ScheduleFireState = (typeof SCHEDULE_FIRE_STATES)[number];

/**
 * The delivery modes a schedule may target — **a strict subset of `ops.thread.delivery`**.
 *
 * `fan-out` and `session` are absent deliberately, and the reason is in
 * `assertScheduleAddressable` below rather than here, because a reader who hits the refusal is
 * the reader who needs it.
 */
export const SCHEDULE_DELIVERIES = ['direct', 'dispatch', 'default'] as const;
export type ScheduleDelivery = (typeof SCHEDULE_DELIVERIES)[number];

/** The thread kinds those three deliveries pair with, per `schedule_delivery_matches_kind`. */
export const SCHEDULE_THREAD_KINDS = ['agent', 'department', 'project'] as const;
export type ScheduleThreadKind = (typeof SCHEDULE_THREAD_KINDS)[number];

/* -------------------------------------------------------------------------- *
 * 2. What a writer must name — the other side of every NOT NULL
 * -------------------------------------------------------------------------- */

/**
 * Every column of `ops.schedule` that is `NOT NULL` with **no `DEFAULT`**, so any future writer
 * must supply it.
 *
 * **This list exists to be graded from both sides.** BRIEF: *a `NOT NULL` nobody can satisfy and
 * one that holds look identical in a schema dump.* 0005 added four the ledger writer never
 * named, and the first paid run would have failed to record *after* the model was paid for. So
 * the schema's mandatory set is written down here where a writer's author will meet it, and
 * `schedule-schema-pinning.test.ts` asserts this array and the migration agree **both ways** —
 * a column added to 0011 without a DEFAULT and not added here fails the build, and vice versa.
 *
 * The `ops` writer can satisfy all seventeen: they are exactly the fields the save dialog
 * `Plan §14` describes has to collect. The `library` writer cannot — see
 * `SCHEDULE_LIBRARY_MATERIALIZATION`.
 */
export const SCHEDULE_REQUIRED_COLUMNS = [
  'id',
  'project_id',
  'source',
  'trigger_kind',
  'trigger_spec',
  'kind',
  'delivery',
  'addressed_to',
  'tz',
  'follow_me',
  'jitter_seconds',
  'missed_run_policy',
  'overlap_policy',
  'enabled',
  'auto_disable_after',
  'review_at',
  'created_by',
] as const;

/** Same rule, for `ops.schedule_fire`. */
export const SCHEDULE_FIRE_REQUIRED_COLUMNS = [
  'id',
  'schedule_id',
  'project_id',
  'occurrence_time',
  'state',
  'catch_up',
] as const;

/**
 * The four `Plan §14` requirements an agent's frontmatter would have to carry before a
 * `source: 'library'` row could exist.
 *
 * `AgentFrontmatter.schedule` is `z.string().refine(isCronExpression).optional()` — a bare
 * 5-field cron with no timezone, no intent and no policy. So **no library row is writable
 * today**, and that is the intended outcome rather than a gap: the alternative is four invented
 * policy values written onto every scheduled agent in the library and displayed as its author's
 * choices, which is this repo's house defect (a declared value read as an observed one) applied
 * to the two settings that decide whether a sleeping laptop costs nothing or costs four figures.
 *
 * Widening `schedule:` is `agent-library-curator`'s call on `frontmatter-schema.md`; filed as a
 * `decision-request`, not decided here. `schedule-schema-pinning.test.ts` asserts the frontmatter
 * schema still lacks these keys, so the day it grows them the assertion goes red and points at
 * this comment.
 */
export interface ScheduleLibraryMaterialization {
  possibleToday: false;
  missingFromFrontmatter: readonly ['tz', 'follow_me', 'missed_run_policy', 'overlap_policy'];
  owner: 'agent-library-curator';
}

export const SCHEDULE_LIBRARY_MATERIALIZATION: ScheduleLibraryMaterialization = {
  possibleToday: false,
  missingFromFrontmatter: ['tz', 'follow_me', 'missed_run_policy', 'overlap_policy'],
  owner: 'agent-library-curator',
};

/* -------------------------------------------------------------------------- *
 * 3. What a schedule costs — the count is real, the money is not
 * -------------------------------------------------------------------------- */

/**
 * The save dialog's preview (`Plan §14`: *"the dialog shows projected monthly spend for this
 * schedule and the project's total scheduled burn against `budget_monthly`"*).
 *
 * **The fire count is knowable exactly from the trigger. The money has no source.** Zero runs
 * have ever executed, so there is nothing to average, and this is the one preview in the product
 * where a plausible number is multiplied by every occurrence for the next month before anybody
 * checks it. `estimatedUsd` is therefore typed as the only value it may hold: the day real runs
 * exist, making it a number **stops this file compiling**, and the diff that widens the type is
 * the diff that has to say where the figure came from.
 *
 * The precedent is `TurnCost` in `./threads`, which held under review in M16. This is the same
 * instrument on a surface where the multiplier is larger.
 */
export interface ScheduleCostProjection {
  /** How many times this schedule fires in the window. Real, and derived from the trigger. */
  fires: number;
  /**
   * `false` ⇒ `fires` is a **lower bound**, and it is `false` for four of the six trigger kinds.
   *
   * Only `cron` and `interval` have a knowable count in a window. `event`, `condition` and
   * `chain` fire on the world, and `manual` fires on a person. Printing a flat number beside a
   * Gmail trigger is a plausible zero one decimal place up — the same defect `TurnCost`
   * documents for `#department`.
   */
  firesAreExact: boolean;
  /** No completed run exists to average. Typed `null`, not commented `null`. */
  estimatedUsd: null;
  estimateBasis: 'no-completed-runs';
  /**
   * How many runs one fire starts, which is where the multiplier would come from if there were
   * a per-run figure. `dispatch` may delegate, so it is a lower bound — the same asymmetry
   * `TurnCost.runsAreExact` carries.
   */
  runsPerFire: number;
  runsPerFireAreExact: boolean;
}

/**
 * @param fires how many occurrences fall in the window. **No default, deliberately**: a default
 *   of `0` would let a caller that never computed an occurrence produce an *exactly zero*
 *   projection, which is the bug `addressCost`'s `memberCount` parameter already had once and
 *   had to have removed. A caller with nothing measured must not call this.
 *
 * Callers must pass `firesAreExact: false` for any trigger whose count is not derivable — this
 * function cannot know the trigger kind and deliberately does not guess. `scheduleFiresAreExact`
 * below is the one place that mapping lives.
 */
export function scheduleCost(
  address: ResolvedThreadAddress,
  fires: number,
  firesAreExact: boolean,
): ScheduleCostProjection {
  const perFire =
    address.form === 'direct'
      ? { runsPerFire: 1, runsPerFireAreExact: true }
      : // `dispatch` reaches a lead who answers *or delegates*, and a delegation is a second
        // run. `default` reaches the Chief of Staff, who triages, answers or routes.
        { runsPerFire: 1, runsPerFireAreExact: false };

  return {
    fires,
    firesAreExact,
    estimatedUsd: null,
    estimateBasis: 'no-completed-runs',
    ...perFire,
  };
}

/**
 * Whether a fire count in a window is derivable from the trigger alone.
 *
 * Two of six. This is the honest denominator behind `firesAreExact`, and it is a function rather
 * than a comment so that a calendar cannot print a confident number under a Gmail filter.
 */
export function scheduleFiresAreExact(kind: TriggerKind): boolean {
  return kind === 'cron' || kind === 'interval';
}

/* -------------------------------------------------------------------------- *
 * 4. The two refusals — both typed, both currently unexercised
 * -------------------------------------------------------------------------- */

/**
 * `Plan §14`: *"A fire that would exceed the project cap does not run — it raises a question."*
 *
 * **It has never refused anything, and every clause of that is checkable.**
 * `ops.project.budget_monthly` is declared and unenforced (ADR-015 Q6, `0005` line 95);
 * `apps/runner/src/lib/project.ts:261` returns `budgetMonthlyUsd: null` unconditionally, so no
 * caller has ever seen a cap at all; Part V's workspace cap is the only enforced ceiling in the
 * product and zero runs have executed against it.
 *
 * Typed `false` for the same reason `FanOutDispatchPolicy.allowed` is: arming this is a
 * reviewable type-level act with a diff, not a config edit at 2am. When it arms, the refusal is
 * `assertFireWithinBudget` and its shape is already written; only the number is missing.
 */
export interface ScheduleBudgetEnforcement {
  enforced: false;
  /** Named, so "which cap?" is not a research task. */
  cap: 'ops.project.budget_monthly';
  /** It has never fired. Stated, not implied. */
  everRefused: false;
  /** Where the refusal lands when it exists: a fire row, not a silent no-op. */
  recordedAs: 'ops.schedule_fire.state = skipped + refusal_code = budget_would_exceed_cap';
  /** And a question, per `Plan §12` — `ops.message.kind = 'question'`, not a new table. */
  raises: 'ops.message kind=question';
  unblockedBy: 'a project budget that is read + one proven cap refusal';
}

export const SCHEDULE_BUDGET_ENFORCEMENT: ScheduleBudgetEnforcement = {
  enforced: false,
  cap: 'ops.project.budget_monthly',
  everRefused: false,
  recordedAs: 'ops.schedule_fire.state = skipped + refusal_code = budget_would_exceed_cap',
  raises: 'ops.message kind=question',
  unblockedBy: 'a project budget that is read + one proven cap refusal',
};

/**
 * The one branch that keeps a schedule from targeting `@@`.
 *
 * `thread-model.md` §3 is the only addressing grammar and this does not add a second one — the
 * grammar parses `@@sales` exactly as it always did. What is refused is **storing** it as a
 * recurring intent, and the reason is that `@@`'s existing refusal is *interactive*:
 * `assertFanOutDispatchable` throws a sentence a human reads while typing, and the composer must
 * name the count in an explicit confirm. A schedule fires unattended at 03:00 with nobody to
 * read anything. So a stored `@@` schedule is a row whose only reachable outcome is a nightly
 * failure — and it is the most likely route by which fan-out gets quietly re-enabled, because a
 * schedule that fails every night reads as a bug somebody should go and fix.
 *
 * `session` is refused because a schedule cannot host a CLI: `sessions-relay-engineer`'s
 * ADR-037 already established that a session thread has no mailbox and no runner reach.
 *
 * Deliberately a single reversible branch, like `assertFanOutDispatchable`: the day the cap has
 * proven a refusal, widening `SCHEDULE_DELIVERIES` and deleting this is one reviewed diff.
 */
export function assertScheduleAddressable(address: ResolvedThreadAddress): void {
  if (address.form !== 'fan-out') return;
  throw Object.assign(
    new Error(
      `A schedule cannot target @@${address.department}. Fan-out dispatch is refused until the ` +
        'monthly cap has proven it can refuse a run, and that refusal is one a person reads ' +
        'while typing — a schedule fires unattended with nobody there to read it, so the row ' +
        'would be a nightly failure and the most likely way fan-out gets switched back on by ' +
        'accident.',
    ),
    {
      code: 'schedule_address_not_schedulable',
      hint: `Schedule the department lead with #${address.department}, which costs one run per fire, or schedule one agent with @.`,
    },
  );
}

/* -------------------------------------------------------------------------- *
 * 5. The fire ledger as a state machine — detail 1, one level below the CHECK
 * -------------------------------------------------------------------------- */

/**
 * A fire row is **born `pending`**, always, and the birth happens at the occurrence time
 * before anything runs. `0011`'s `schedule_fire_pending_has_not_started` enforces the half a
 * row can see; this constant is the half a *writer* has to obey, and it is a named value
 * rather than a string typed at four call sites.
 */
export const SCHEDULE_FIRE_BIRTH_STATE = 'pending' as const;

/**
 * The legal moves. Everything absent from this table is refused.
 *
 * Three of the entries are decisions and not bookkeeping:
 *
 * - **`pending → missed`.** `missed` is what a row that was recorded and never started
 *   becomes. That state is *only reachable because the row is written first* — under
 *   fire-then-record a coordinator that died between deciding and starting leaves nothing at
 *   all, and "never fired" is invisible. `missed` is the visible form of that failure, and it
 *   is why detail 1 is worth its cost.
 * - **`pending → skipped`.** Somebody *decided*: a policy, a budget refusal, an expiry.
 *   `missed` means nobody decided. Collapsing the two would hide a crashed coordinator inside
 *   a column that reads as a normal policy outcome.
 * - **`running → running`** is legal **only when `attempts` strictly increases** — detail 7's
 *   retry ladder, which increments the existing row rather than writing a second one (§4: a
 *   second row would carry the same `(schedule_id, occurrence_time)` and defeat the key the
 *   ladder depends on). A `running → running` that increments nothing is a writer touching a
 *   row it did not advance, which is indistinguishable from a stuck run.
 *
 * There is no edge out of a terminal state. A catch-up does **not** revive a `missed` row: it
 * is a fresh decision about an occurrence, taken at planning time, and it is either a `running`
 * that was never recorded before or it is not taken at all.
 */
export const SCHEDULE_FIRE_TRANSITIONS: Readonly<
  Record<ScheduleFireState, readonly ScheduleFireState[]>
> = {
  pending: ['running', 'missed', 'skipped'],
  running: ['running', 'done', 'failed'],
  done: [],
  failed: [],
  missed: [],
  skipped: [],
};

export const SCHEDULE_FIRE_TERMINAL_STATES: readonly ScheduleFireState[] = [
  'done',
  'failed',
  'missed',
  'skipped',
];

export const isTerminalFireState = (state: ScheduleFireState): boolean =>
  SCHEDULE_FIRE_TERMINAL_STATES.includes(state);

export interface FireTransition {
  from: ScheduleFireState;
  to: ScheduleFireState;
  /** `attempts` before the move, and after it. The retry ladder is the only self-edge. */
  attemptsBefore: number;
  attemptsAfter: number;
}

/**
 * Throws `schedule_fire_transition_refused` on an illegal move.
 *
 * This is the ledger's `assertThreadTransition` (`thread-model.md` §4.5), and it exists for the
 * same reason: **Postgres cannot check a transition.** `schedule_fire_state_known` proves the
 * value is in the vocabulary and says nothing about the move — a writer can take a `done` row
 * back to `pending` and every CHECK in `0011` passes. The transition rule has no enforcer in
 * SQL, so it has one here, and a mechanism beats the comment that would otherwise carry it.
 */
export function assertFireTransition(move: FireTransition): void {
  const legal = SCHEDULE_FIRE_TRANSITIONS[move.from];
  if (!legal.includes(move.to)) {
    throw Object.assign(
      new Error(
        `A fire cannot go from ${move.from} to ${move.to}.` +
          (legal.length === 0
            ? ` ${move.from} is terminal.`
            : ` From ${move.from} the only moves are ${legal.join(', ')}.`),
      ),
      {
        code: 'schedule_fire_transition_refused',
        hint:
          legal.length === 0
            ? 'A finished occurrence stays finished. A catch-up is a decision about an occurrence that has no row yet, not a revival of one that does.'
            : 'Advance the fire one step at a time, and record the step that is actually happening.',
      },
    );
  }
  if (move.from === 'running' && move.to === 'running' && move.attemptsAfter <= move.attemptsBefore) {
    throw Object.assign(
      new Error(
        `A running fire may only stay running when it is retrying, and attempts did not increase (${move.attemptsBefore} → ${move.attemptsAfter}).`,
      ),
      {
        code: 'schedule_fire_transition_refused',
        hint: 'The retry ladder increments attempts on the existing row. A second row would carry the same (schedule_id, occurrence_time) and defeat the idempotency key.',
      },
    );
  }
}

/* -------------------------------------------------------------------------- *
 * 6. `0011`'s CHECKs, mirrored where a writer meets them before Postgres does
 * -------------------------------------------------------------------------- */

/**
 * The subset of an `ops.schedule_fire` row every CHECK in `0011` reads. ISO-8601 strings, not
 * `Date`, because that is what crosses the wire and what `pg` hands back.
 */
export interface ScheduleFireRow {
  scheduleId: string;
  projectId: string;
  occurrenceTime: string;
  state: ScheduleFireState;
  catchUp: boolean;
  attempts: number;
  recordedAt: string;
  startedAt: string | null;
  endedAt: string | null;
  threadId: string | null;
  refusalCode: string | null;
  questionMessageId: string | null;
}

/**
 * Every row-local CHECK in `0011_scheduling.sql`, restated as a predicate under **the constraint's
 * own name**.
 *
 * The reason this exists rather than trusting the database: **neither table has met a Postgres**
 * (§9.2 of the prose contract). `0005`–`0011` have never been applied, `sql-executes.test.ts`
 * skips on an unset `DATABASE_URL`, and a gate that skips protects nothing. So today these
 * CHECKs are enforced *here or nowhere*, and when a database does arrive they are enforced
 * twice — which is the right number for the constraint that makes "never fired" visible.
 *
 * Names are the SQL names on purpose. `schedule-schema-pinning.test.ts` asserts this list and
 * the migration name the same set, in both directions, so a CHECK added to `0011` that no writer
 * mirrors fails the build — 0005's defect, which was four constraints the ledger writer never
 * named and which would have failed to record a run *after* the model was paid for.
 */
export const SCHEDULE_FIRE_ROW_CHECKS: readonly {
  name: string;
  holds: (row: ScheduleFireRow) => boolean;
  hint: string;
}[] = [
  {
    name: 'schedule_fire_state_known',
    holds: (r) => (SCHEDULE_FIRE_STATES as readonly string[]).includes(r.state),
    hint: `state must be one of ${SCHEDULE_FIRE_STATES.join(', ')}.`,
  },
  {
    name: 'schedule_fire_attempts_sane',
    holds: (r) => Number.isInteger(r.attempts) && r.attempts >= 0,
    hint: 'attempts counts what has been tried and starts at zero.',
  },
  {
    name: 'schedule_fire_recorded_before_run',
    holds: (r) => r.startedAt === null || r.recordedAt <= r.startedAt,
    hint: 'The row is written at the occurrence time, before the run. A row recorded after its own start is fire-then-record, which is the pattern that makes "never fired" invisible.',
  },
  {
    name: 'schedule_fire_ends_after_it_starts',
    holds: (r) => r.endedAt === null || (r.startedAt !== null && r.startedAt <= r.endedAt),
    hint: 'A fire that ended must have started first.',
  },
  {
    name: 'schedule_fire_pending_has_not_started',
    holds: (r) => r.state !== 'pending' || r.startedAt === null,
    hint: 'pending means the occurrence is due and nothing has started.',
  },
  {
    name: 'schedule_fire_finished_has_an_end',
    holds: (r) => !(r.state === 'done' || r.state === 'failed') || r.endedAt !== null,
    hint: 'done and failed are terminal and carry an end time.',
  },
  {
    name: 'schedule_fire_skip_names_a_reason',
    holds: (r) => r.state !== 'skipped' || r.refusalCode !== null,
    hint: 'A skip with no reason is visible and says nothing, which is the failure one level down from "never fired".',
  },
];

/**
 * The constraints in `0011` that a **single row cannot answer**, named so the pinning test's
 * both-directions assertion has somewhere to put them rather than silently tolerating a gap.
 *
 * `schedule_fire_idempotent` is `UNIQUE (schedule_id, occurrence_time)`: it is a statement about
 * a *table*, and the only honest mirror of it in code is a planner that refuses to emit a second
 * record for a key it already holds. That planner is `apps/runner/src/lib/schedulePlan.ts`, and
 * `plannedFires` is where the refusal lives.
 */
export const SCHEDULE_FIRE_TABLE_CONSTRAINTS: readonly string[] = ['schedule_fire_idempotent'];

/** Throws `schedule_fire_row_invalid` naming the first CHECK the row breaks. */
export function assertFireRowValid(row: ScheduleFireRow): void {
  for (const check of SCHEDULE_FIRE_ROW_CHECKS) {
    if (check.holds(row)) continue;
    throw Object.assign(new Error(`Fire row violates ${check.name}.`), {
      code: 'schedule_fire_row_invalid',
      hint: check.hint,
    });
  }
}

/* -------------------------------------------------------------------------- *
 * 7. Why a fire did not run — a closed vocabulary in TS, open in Postgres
 * -------------------------------------------------------------------------- */

/**
 * The values `ops.schedule_fire.refusal_code` may hold.
 *
 * **`refusal_code` has no CHECK in `0011`, and that is a gap, not a design.** It was left
 * unconstrained when no writer existed and no vocabulary had been decided; this array is the
 * vocabulary, and the CHECK belongs in the migration that lands alongside the first real writer.
 * Recorded in `contracts/scheduling.md` §9 rather than fixed by a speculative migration, because
 * a migration number is claimed on BOARD and this wave has no claim.
 */
export const SCHEDULE_REFUSAL_CODES = [
  /** §5's headline. Typed unreachable today — see `fireBudgetVerdict`. */
  'budget_would_exceed_cap',
  /** `missed_run_policy = 'skip'` declined an occurrence the host slept through. */
  'missed_run_policy_skip',
  /** `missed_run_policy = 'catch_up_once'`: an older missed occurrence that a newer one replaced. */
  'catch_up_once_superseded',
  /** `overlap_policy = 'skip'` and the previous run is still in flight. */
  'overlap_policy_skip',
  /** `overlap_policy = 'kill_previous'`, written on the run that was killed, not on the new one. */
  'killed_by_overlap_policy',
  /**
   * `follow_me: true` and nothing in this build knows which zone the person is standing in.
   *
   * **The one code in this list that names a schedule rather than a fire.** An occurrence nobody
   * can place in time is not an occurrence, so there is no row to write it on — `planTick`
   * returns it in `unresolvable` instead. Kept in this vocabulary because it is a refusal with
   * the same weight as the others and splitting the list would hide it.
   */
  'zone_intent_unresolved',
  /** The occurrence is after `until_at` (detail 8). */
  'schedule_expired',
  /** `enabled = false` — either turned off, or auto-disabled by detail 7's ladder. */
  'schedule_disabled',
] as const;
export type ScheduleRefusalCode = (typeof SCHEDULE_REFUSAL_CODES)[number];

/* -------------------------------------------------------------------------- *
 * 8. The budget refusal — written, tested, and typed unreachable
 * -------------------------------------------------------------------------- */

/**
 * The other arm of the union `fireBudgetVerdict` takes: what an **armed** cap would need.
 *
 * Three numbers, and **this repo can produce none of them.** `ops.project.budget_monthly` is
 * declared and never read (`apps/runner/src/lib/project.ts:261` returns `budgetMonthlyUsd: null`
 * unconditionally); `committedUsdThisMonth` needs completed runs and zero runs have ever
 * executed; `projectedUsdThisFire` is the figure `ScheduleCostProjection.estimatedUsd` is typed
 * `null` precisely to refuse to invent.
 *
 * So the armed branch is fully written and fully tested, and the **only** way to construct its
 * input is a test literal. That is deliberate: the refusal exists as code that has been driven
 * red and green, not as a paragraph promising it will be written later.
 */
export interface ScheduleBudgetArmed {
  enforced: true;
  capUsd: number;
  committedUsdThisMonth: number;
  projectedUsdThisFire: number;
}

export type FireBudgetVerdict =
  | { allowed: true; because: 'not-enforced' | 'within-cap' }
  | {
      allowed: false;
      refusalCode: 'budget_would_exceed_cap';
      /** For the question's payload — an object, never prose (§7 / PDPL rule 2). */
      overBy: number;
    };

/**
 * `Plan §14`: *"a fire that would exceed the project cap does not run — it raises a question."*
 *
 * The discriminated union is the mechanism. `SCHEDULE_BUDGET_ENFORCEMENT` is typed
 * `enforced: false`, so **the compiler proves the refusal branch is unreachable from the live
 * call site** — the planner passes that constant and narrows to `not-enforced` statically. The
 * day the cap is armed, a caller has to construct a `ScheduleBudgetArmed`, which means naming
 * where all three numbers came from, in a diff somebody reviews.
 *
 * `>` and not `>=`: a fire that lands exactly on the cap is within it. A cap that refuses at
 * equality refuses the run the user budgeted for.
 */
export function fireBudgetVerdict(
  budget: ScheduleBudgetEnforcement | ScheduleBudgetArmed,
): FireBudgetVerdict {
  if (!budget.enforced) return { allowed: true, because: 'not-enforced' };
  const total = budget.committedUsdThisMonth + budget.projectedUsdThisFire;
  if (total <= budget.capUsd) return { allowed: true, because: 'within-cap' };
  return { allowed: false, refusalCode: 'budget_would_exceed_cap', overBy: total - budget.capUsd };
}

/**
 * The question a refused fire raises. **A message kind, not an entity** (ADR-023): there is no
 * `ops.question` table and M18 adds no second delivery path.
 *
 * `expiresAt` has **no default and no derivation inside this function**, and that is the same
 * discipline as `scheduleCost`'s `fires`. A question about the 09:00 fire is meaningless once
 * the 10:00 fire has come and gone, so the natural expiry is the schedule's *next* occurrence —
 * but four of the six trigger kinds have no next occurrence to compute (`scheduleFiresAreExact`
 * is the same denominator), so a caller that cannot name one must not raise the question.
 */
export interface ScheduleBudgetQuestion {
  kind: 'question';
  author: string;
  body: string;
  /** Structured. The prose is composed at display, never before storage (PDPL rule 2). */
  payload: {
    reason: 'budget_would_exceed_cap';
    scheduleId: string;
    occurrenceTime: string;
    overByUsd: number;
    options: readonly ['raise-the-cap', 'skip-this-fire', 'disable-the-schedule'];
  };
  expiresAt: string;
}

export function budgetQuestion(input: {
  scheduleId: string;
  occurrenceTime: string;
  overByUsd: number;
  /** No default: see the interface comment. The caller names the instant this stops mattering. */
  expiresAt: string;
}): ScheduleBudgetQuestion {
  return {
    kind: 'question',
    author: `system:scheduler`,
    body: 'This scheduled run would take the project past its monthly cap, so it has not started.',
    payload: {
      reason: 'budget_would_exceed_cap',
      scheduleId: input.scheduleId,
      occurrenceTime: input.occurrenceTime,
      overByUsd: input.overByUsd,
      options: ['raise-the-cap', 'skip-this-fire', 'disable-the-schedule'],
    },
    expiresAt: input.expiresAt,
  };
}

/* -------------------------------------------------------------------------- *
 * 9. Timezone intent — detail 6, and the half of it nothing can answer yet
 * -------------------------------------------------------------------------- */

/**
 * `Plan §14` detail 6: *"`tz:` **and** `follow_me: true|false`. Both are correct answers; only
 * one is correct per job, and the system cannot guess."*
 *
 * `follow_me: true` means *fire at 07:00 wherever I am standing*, which requires knowing where
 * that is. **Nothing in this repo knows.** There is no presence signal, no device zone, no
 * identity preference carrying one — `ops.device` records hosts, not people, and the preferences
 * surface that would own it is M11/M19's and unbuilt (the same owner as §11.4's quiet hours).
 *
 * So `resolveFiringZone` **refuses** rather than falling back to `tz`. The fallback is the exact
 * shape of the defect detail 6 exists to prevent: a job the user set to follow them, quietly
 * firing on home time forever, looking correct in every view. The refusal is a `skipped` fire
 * with `refusal_code = 'zone_intent_unresolved'` — visible in the ledger, which is the whole
 * argument for recording the row first.
 *
 * Typed `false` for the same reason `SCHEDULE_LIBRARY_MATERIALIZATION.possibleToday` is: the day
 * a resolver exists, widening this is a diff that has to say what supplies the zone.
 */
export interface ScheduleFollowMeSupport {
  resolvableToday: false;
  needs: 'a current-zone signal for an identity';
  owner: 'client-platform-engineer';
  refusalCode: 'zone_intent_unresolved';
}

export const SCHEDULE_FOLLOW_ME: ScheduleFollowMeSupport = {
  resolvableToday: false,
  needs: 'a current-zone signal for an identity',
  owner: 'client-platform-engineer',
  refusalCode: 'zone_intent_unresolved',
};

export type ScheduleZoneIntent =
  | { tz: string; followMe: false }
  | {
      tz: string;
      followMe: true;
      /**
       * The zone the person is standing in **right now**. `null` is the only value anything in
       * this build can supply, and it is a refusal rather than a fallback.
       */
      standingIn: string | null;
    };

export type FiringZone =
  | { ok: true; tz: string; because: 'home-time' | 'follow-me' }
  | { ok: false; refusalCode: 'zone_intent_unresolved'; hint: string };

export function resolveFiringZone(intent: ScheduleZoneIntent): FiringZone {
  if (!intent.followMe) return { ok: true, tz: intent.tz, because: 'home-time' };
  if (intent.standingIn === null) {
    return {
      ok: false,
      refusalCode: 'zone_intent_unresolved',
      hint: `This schedule was set to follow you, and nothing in this build reports which zone you are in. It has not fired on ${intent.tz} instead, because that is the answer you declined when you chose follow-me.`,
    };
  }
  return { ok: true, tz: intent.standingIn, because: 'follow-me' };
}

/* -------------------------------------------------------------------------- *
 * 10. The preview — `Plan §14`'s ten fire times, and the receipt that they were shown
 * -------------------------------------------------------------------------- */

/**
 * `Plan §14`: *"Never save an unpreviewed cron expression… Cron expressions are famously,
 * quietly wrong."* Ten, literally, because that is the number the plan names.
 */
export const PREVIEW_FIRE_TIME_COUNT = 10;

export interface PreviewedFireTime {
  /** The occurrence instant, UTC, ISO-8601. This is what `occurrence_time` will hold. */
  utc: string;
  /** The same instant as wall-clock in the firing zone — what the human is actually confirming. */
  local: string;
}

export interface FireTimePreview {
  expression: string;
  /** The zone the times were computed in, after `resolveFiringZone`. */
  tz: string;
  followMe: boolean;
  fireTimes: readonly PreviewedFireTime[];
  /**
   * Wall-clock times the expression asks for that **do not exist** on their day, because the
   * zone skipped them (DST spring-forward). A 02:30 daily briefing does not fire that day. Named
   * rather than silently absent: a preview that is quietly one short is the same defect class as
   * an expression that is quietly wrong.
   */
  nonexistentLocalTimes: readonly string[];
  /**
   * Wall-clock times that happen **twice** (DST fall-back), collapsed to the earlier instant.
   * Firing on both would be two rows with different `occurrence_time`s — two paid runs that the
   * idempotency key cannot catch, because they are genuinely different keys.
   */
  ambiguousLocalTimes: readonly string[];
  /** `false` ⇒ the search hit its bound before finding ten. A `0 0 30 2 *` finds none. */
  complete: boolean;
  /**
   * The receipt. Not a security token and not a cache key — a claim that *these ten times were
   * on screen*. The save route recomputes it and refuses a mismatch, which is how "never save an
   * unpreviewed expression" becomes a mechanism instead of a sentence in a design doc.
   */
  previewToken: string;
}

/**
 * A stable, non-cryptographic digest of everything the human confirmed.
 *
 * **Explicitly not a security boundary** (BOARD rule 6: build nothing that is only safe because
 * something else is). Anyone on the tailnet can compute one. What it defends against is the
 * ordinary bug — a dialog that previewed `0 6 * * 1`, a user who edited the field to `0 6 1 * *`
 * before pressing save, and a schedule that fires monthly while the confirmation screen said
 * Mondays.
 *
 * FNV-1a over the canonical string, because it is eight lines, has no dependency, and produces
 * the same digest in the browser and in the runner.
 */
export function fireTimePreviewToken(input: {
  expression: string;
  tz: string;
  followMe: boolean;
  fireTimes: readonly { utc: string }[];
}): string {
  const canonical = [
    input.expression.trim(),
    input.tz,
    String(input.followMe),
    ...input.fireTimes.map((t) => t.utc),
  ].join(' ');
  let hash = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i += 1) {
    hash ^= canonical.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `pv1_${hash.toString(16).padStart(8, '0')}`;
}
