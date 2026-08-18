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
