/**
 * The coordinator's tick, as a pure function — `scheduler-engineer`, ADR-024, `Plan §14`.
 *
 * `planTick` takes what is true and returns what should be written. It has **no clock, no
 * database, no network and no side effects**: `now` is an argument, the fire rows it may already
 * have written are an argument, and the result is a list of actions somebody else executes.
 *
 * That shape is not stylistic. `Plan §14` detail 2 calls a double-fire on coordinator restart
 * *"the single most common scheduler bug in existence"*, and the only way to prove a restart does
 * not double-fire is to run the same tick twice against the ledger the first one produced and
 * watch the second one plan nothing. With a clock and a connection inside, that test needs a
 * sleeping laptop and a Postgres. As a function it needs neither, which is why it exists today
 * and why `schedule-plan.test.ts` can drive it.
 *
 * ## The order the decisions are taken in, and why it is that order
 *
 *   record → expiry/disabled → missed-run policy → overlap → budget → concurrency cap → start
 *
 * **Recording is unconditional and comes first** (detail 1). Every occurrence that is due gets a
 * `pending` row before any policy is consulted, so a schedule that is refused every night is
 * visible as nine hundred skipped fires rather than as silence. Everything after that only ever
 * decides what the row *becomes*.
 *
 * Budget sits **before** the concurrency cap because a refused fire must not consume a start
 * slot — otherwise a project over its cap quietly starves the projects that are not.
 *
 * ## The one refusal that is deliberately not a fire row
 *
 * A schedule whose **firing zone cannot be resolved** produces no occurrences and therefore no
 * rows. `follow_me: true` with no current-zone signal means nobody knows *when* this schedule is
 * due; an occurrence you cannot place in time is not an occurrence, and recording one against
 * `tz` would write the very fallback `SCHEDULE_FOLLOW_ME` exists to refuse — with the extra harm
 * that `occurrence_time` is the idempotency key, so the keys would all move the day the zone
 * resolved. It comes back in `TickPlan.unresolvable` instead, which is a per-schedule fault for
 * detail 7's ladder rather than a nightly stream of identical skipped fires.
 */
import {
  budgetQuestion,
  fireBudgetVerdict,
  resolveFiringZone,
  SCHEDULE_BUDGET_ENFORCEMENT,
  type MissedRunPolicy,
  type OverlapPolicy,
  type ScheduleBudgetArmed,
  type ScheduleBudgetEnforcement,
  type ScheduleBudgetQuestion,
  type ScheduleFireState,
  type ScheduleRefusalCode,
  type ScheduleZoneIntent,
} from '@agnetos/contracts';
import { occurrencesInWindow, type ComputableTrigger } from './scheduleClock';

/* -------------------------------------------------------------------------- *
 * What the planner reads
 * -------------------------------------------------------------------------- */

/** The columns of `ops.schedule` a tick actually consults. Nothing else is loaded. */
export interface PlannerSchedule {
  id: string;
  projectId: string;
  /** `null` for the four trigger kinds no clock can answer for. They are skipped silently. */
  trigger: ComputableTrigger | null;
  zone: ScheduleZoneIntent;
  jitterSeconds: number;
  missedRunPolicy: MissedRunPolicy;
  overlapPolicy: OverlapPolicy;
  enabled: boolean;
  untilAt: string | null;
}

/** The columns of `ops.schedule_fire` a tick consults, for rows that already exist. */
export interface KnownFire {
  scheduleId: string;
  /** ISO-8601 UTC. Half of the idempotency key. */
  occurrenceTime: string;
  state: ScheduleFireState;
  /** Non-null ⇒ an `ask` is waiting on a human, and the missed sweep leaves it alone. */
  questionMessageId: string | null;
}

export type PlannedAction =
  | { action: 'record'; scheduleId: string; occurrenceTime: string; catchUp: boolean }
  | { action: 'start'; scheduleId: string; occurrenceTime: string; startAt: string }
  | {
      action: 'skip';
      scheduleId: string;
      occurrenceTime: string;
      refusalCode: ScheduleRefusalCode;
      question?: ScheduleBudgetQuestion;
    }
  /** Detail 3's fourth policy. One question for the whole batch, never one per occurrence. */
  | { action: 'ask'; scheduleId: string; occurrenceTimes: string[] }
  | { action: 'mark-missed'; scheduleId: string; occurrenceTime: string }
  /** `overlap_policy = 'kill_previous'`, aimed at the run already in flight. */
  | { action: 'kill'; scheduleId: string; occurrenceTime: string }
  /** The row stays `pending` and the next tick reconsiders it. Not a refusal. */
  | {
      action: 'defer';
      scheduleId: string;
      occurrenceTime: string;
      reason: 'concurrency-cap' | 'overlap-queue';
    };

export interface TickPlan {
  actions: PlannedAction[];
  /** Starts this tick allowed to begin, against `maxStartsPerTick`. */
  startsPlanned: number;
  /** Schedules that produced nothing because nobody knows when they are due. See the header. */
  unresolvable: { scheduleId: string; refusalCode: ScheduleRefusalCode; hint: string }[];
  /**
   * Schedules whose occurrence scan hit its own bound. The caller must tick again rather than
   * assume it caught up — which is safe only because `record` is idempotent, and it is.
   */
  incomplete: string[];
}

export interface TickInput {
  now: Date;
  /**
   * The end of the window the previous tick covered. Occurrences in `(since, now]` are the ones
   * this tick is responsible for. After a laptop sleeps a week this is a week ago, and that is
   * the entire mechanism behind catch-up — there is no separate "was I asleep" detector.
   */
  since: Date;
  schedules: PlannerSchedule[];
  /** Every fire row this coordinator already holds for these schedules. */
  knownFires: KnownFire[];
  /**
   * How late a `pending` row may be before it counts as never having run, and equally how old an
   * occurrence must be to count as a catch-up. **No default** — one is a lost briefing and thirty
   * is a run started half an hour after the meeting it was for, and neither is safe to assume.
   */
  latenessToleranceSeconds: number;
  /**
   * `Plan §14` detail 5's cap on simultaneous starts. **No default**, and note what it is not:
   * `contracts/scheduling.md` §11.3 leaves the *per-host* ceiling open, because that is a
   * property of a host. This is the coordinator's own ceiling on how much it will set going in
   * one tick, and the surplus is `defer`red rather than dropped — the rows are already `pending`,
   * so the next tick picks them up with no state to remember.
   */
  maxStartsPerTick: number;
  /** Bound on the occurrence scan per schedule. **No default**, same reason. */
  maxOccurrencesPerSchedule: number;
  /**
   * Typed `ScheduleBudgetEnforcement` at every live call site, whose `enforced` is `false`, so
   * the refusal below is statically unreachable in this build. Widening it is a compile error at
   * the constant, which is the point.
   */
  budget?: ScheduleBudgetEnforcement | ScheduleBudgetArmed;
}

/* -------------------------------------------------------------------------- *
 * Jitter — deterministic, because the key it decorates must not move
 * -------------------------------------------------------------------------- */

/**
 * `Plan §14` detail 5: *"fourteen schedules at 09:00 is a rate-limit spike and a cost spike."*
 *
 * **Derived from `(schedule_id, occurrence_time)`, never from `Math.random()`**, and that is the
 * decision in this function. A random offset makes a restart re-derive a *different* start time
 * for the same occurrence, so the same fire has two answers to "when did this begin"; every
 * duplicate-suppression window that reasons about elapsed time then reasons about a moving
 * target, and a fire ledger stops being reproducible from its own inputs. Hashing the key gives
 * the spread jitter is for and keeps the answer stable across every restart, forever.
 *
 * FNV-1a, eight lines, no dependency, same digest everywhere.
 */
export function jitterOffsetSeconds(
  scheduleId: string,
  occurrenceTime: string,
  jitterSeconds: number,
): number {
  if (jitterSeconds <= 0) return 0;
  const canonical = `${scheduleId}|${occurrenceTime}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i += 1) {
    hash ^= canonical.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % (jitterSeconds + 1);
}

/* -------------------------------------------------------------------------- *
 * The tick
 * -------------------------------------------------------------------------- */

const fireKey = (scheduleId: string, occurrenceTime: string): string =>
  `${scheduleId}|${occurrenceTime}`;

export function planTick(input: TickInput): TickPlan {
  const budget = input.budget ?? SCHEDULE_BUDGET_ENFORCEMENT;
  const toleranceMs = input.latenessToleranceSeconds * 1000;
  const actions: PlannedAction[] = [];
  const unresolvable: TickPlan['unresolvable'] = [];
  const incomplete: string[] = [];

  // The ledger, indexed by the idempotency key. **This is detail 2, and it is one Map.**
  const known = new Map<string, KnownFire>();
  for (const fire of input.knownFires) known.set(fireKey(fire.scheduleId, fire.occurrenceTime), fire);

  const scheduleById = new Map(input.schedules.map((s) => [s.id, s] as const));

  /* -- Phase 1: rows that already exist and have stopped being `pending` honestly ---------- */

  for (const fire of input.knownFires) {
    if (fire.state !== 'pending') continue;
    const schedule = scheduleById.get(fire.scheduleId);
    // A pending row whose schedule this tick cannot see is left alone. Acting on a schedule that
    // was not loaded would mean deciding on a policy nobody read.
    if (!schedule) continue;

    if (!schedule.enabled) {
      // Reachable: an `ask` holds rows pending, and the human's answer may be to turn the whole
      // schedule off. Those rows have to resolve to something, and `skipped` with a named reason
      // is the only honest one.
      actions.push({
        action: 'skip',
        scheduleId: fire.scheduleId,
        occurrenceTime: fire.occurrenceTime,
        refusalCode: 'schedule_disabled',
      });
      continue;
    }
    if (schedule.untilAt !== null && fire.occurrenceTime > schedule.untilAt) {
      actions.push({
        action: 'skip',
        scheduleId: fire.scheduleId,
        occurrenceTime: fire.occurrenceTime,
        refusalCode: 'schedule_expired',
      });
      continue;
    }
    // An unanswered question is a hold, not a stall. Sweeping it into `missed` would delete the
    // human's chance to answer and would look, in every view, exactly like a crashed coordinator.
    if (fire.questionMessageId !== null) continue;

    const dueMs = Date.parse(fire.occurrenceTime);
    if (Number.isFinite(dueMs) && input.now.getTime() - dueMs > toleranceMs) {
      // **The state that only exists because the row is written first.** This row was recorded at
      // its occurrence time and never started, which under fire-then-record would have left
      // nothing at all to look at.
      actions.push({
        action: 'mark-missed',
        scheduleId: fire.scheduleId,
        occurrenceTime: fire.occurrenceTime,
      });
    }
  }

  /* -- Phase 2: occurrences that are due and have no row yet ------------------------------- */

  // In-flight per schedule, tracked *as we plan* and not only as we found it: two catch-up
  // occurrences planned in the same tick are two runs, and the second one must see the first.
  const inFlight = new Map<string, string[]>();
  for (const fire of input.knownFires) {
    if (fire.state !== 'running') continue;
    inFlight.set(fire.scheduleId, [...(inFlight.get(fire.scheduleId) ?? []), fire.occurrenceTime]);
  }

  let startsRemaining = input.maxStartsPerTick;
  let startsPlanned = 0;

  for (const schedule of input.schedules) {
    if (!schedule.enabled) continue;
    if (schedule.trigger === null) continue;

    const zone = resolveFiringZone(schedule.zone);
    if (!zone.ok) {
      unresolvable.push({
        scheduleId: schedule.id,
        refusalCode: zone.refusalCode,
        hint: zone.hint,
      });
      continue;
    }

    // An occurrence after `until_at` is not an occurrence. Clamping here rather than refusing
    // later is what keeps an expired schedule from filling the ledger with nightly skips.
    const untilMs = schedule.untilAt === null ? null : Date.parse(schedule.untilAt);
    const throughMs =
      untilMs !== null && Number.isFinite(untilMs)
        ? Math.min(input.now.getTime(), untilMs)
        : input.now.getTime();
    if (throughMs <= input.since.getTime()) continue;

    const scan = occurrencesInWindow(schedule.trigger, zone.tz, {
      after: input.since,
      through: new Date(throughMs),
      max: input.maxOccurrencesPerSchedule,
    });
    if (!scan.complete) incomplete.push(schedule.id);

    // **Detail 2.** Everything below runs only for occurrences with no row. A coordinator that
    // restarts and re-derives the same window plans nothing, because every key is already here.
    const fresh: string[] = [];
    const stale: string[] = [];
    for (const occurrence of scan.occurrences) {
      const iso = occurrence.toISOString();
      if (known.has(fireKey(schedule.id, iso))) continue;
      (input.now.getTime() - occurrence.getTime() > toleranceMs ? stale : fresh).push(iso);
    }
    if (fresh.length === 0 && stale.length === 0) continue;

    for (const iso of stale) {
      actions.push({ action: 'record', scheduleId: schedule.id, occurrenceTime: iso, catchUp: true });
    }
    for (const iso of fresh) {
      actions.push({ action: 'record', scheduleId: schedule.id, occurrenceTime: iso, catchUp: false });
    }

    // Detail 3. The candidates that survive the missed-run policy, in occurrence order.
    const candidates: string[] = [...fresh];
    if (stale.length > 0) {
      const decided = applyMissedRunPolicy(schedule, stale);
      actions.push(...decided.actions);
      candidates.unshift(...decided.proceed);
    }
    candidates.sort();

    for (const iso of candidates) {
      const decision = disposeOccurrence({
        schedule,
        occurrenceTime: iso,
        now: input.now,
        zoneTz: zone.tz,
        inFlight,
        budget,
        startsRemaining,
      });
      actions.push(...decision.actions);
      if (decision.started) {
        startsRemaining -= 1;
        startsPlanned += 1;
        inFlight.set(schedule.id, [...(inFlight.get(schedule.id) ?? []), iso]);
      }
    }
  }

  return { actions, startsPlanned, unresolvable, incomplete };
}

/* -------------------------------------------------------------------------- *
 * Detail 3 — the missed-run policy, executed
 * -------------------------------------------------------------------------- */

function applyMissedRunPolicy(
  schedule: PlannerSchedule,
  stale: string[],
): { actions: PlannedAction[]; proceed: string[] } {
  const sorted = [...stale].sort();
  switch (schedule.missedRunPolicy) {
    case 'skip':
      return {
        actions: sorted.map((occurrenceTime) => ({
          action: 'skip' as const,
          scheduleId: schedule.id,
          occurrenceTime,
          refusalCode: 'missed_run_policy_skip' as const,
        })),
        proceed: [],
      };
    case 'catch_up_all':
      // The user asked for every one of them. The concurrency cap is the only brake, and it
      // defers rather than drops — which is the difference between "slow" and "silently lost".
      return { actions: [], proceed: sorted };
    case 'catch_up_once': {
      const newest = sorted[sorted.length - 1] as string;
      return {
        actions: sorted.slice(0, -1).map((occurrenceTime) => ({
          action: 'skip' as const,
          scheduleId: schedule.id,
          occurrenceTime,
          refusalCode: 'catch_up_once_superseded' as const,
        })),
        proceed: [newest],
      };
    }
    case 'ask':
      // One question naming the batch. A question per occurrence would be 2,016 questions after
      // a week of a five-minute job, which is a denial of service dressed as consent. The rows
      // stay `pending` with the question attached, and phase 1's missed sweep leaves them alone.
      return {
        actions: [{ action: 'ask', scheduleId: schedule.id, occurrenceTimes: sorted }],
        proceed: [],
      };
  }
}

/* -------------------------------------------------------------------------- *
 * Details 4, 5 and §5 — overlap, budget, the cap, and the start
 * -------------------------------------------------------------------------- */

function disposeOccurrence(ctx: {
  schedule: PlannerSchedule;
  occurrenceTime: string;
  now: Date;
  zoneTz: string;
  inFlight: Map<string, string[]>;
  budget: ScheduleBudgetEnforcement | ScheduleBudgetArmed;
  startsRemaining: number;
}): { actions: PlannedAction[]; started: boolean } {
  const { schedule, occurrenceTime } = ctx;
  const actions: PlannedAction[] = [];
  const running = ctx.inFlight.get(schedule.id) ?? [];

  // ---- Detail 4: overlap ----
  if (running.length > 0) {
    switch (schedule.overlapPolicy) {
      case 'skip':
        actions.push({
          action: 'skip',
          scheduleId: schedule.id,
          occurrenceTime,
          refusalCode: 'overlap_policy_skip',
        });
        return { actions, started: false };
      case 'queue':
        // The row stays `pending`. Nothing is remembered anywhere else, because a queue held in
        // the coordinator's memory is a queue a restart loses; the ledger *is* the queue.
        actions.push({
          action: 'defer',
          scheduleId: schedule.id,
          occurrenceTime,
          reason: 'overlap-queue',
        });
        return { actions, started: false };
      case 'kill_previous':
        for (const previous of running) {
          actions.push({ action: 'kill', scheduleId: schedule.id, occurrenceTime: previous });
        }
        ctx.inFlight.set(schedule.id, []);
        break;
      case 'allow_parallel':
        break;
    }
  }

  // ---- §5: the budget refusal, statically unreachable in this build ----
  const verdict = fireBudgetVerdict(ctx.budget);
  if (!verdict.allowed) {
    // `expiresAt` is the schedule's **next** occurrence: after it, a question about this one is
    // asking about a fire that has already been overtaken. Derived, with the basis stated, rather
    // than a round number picked because one was needed.
    const next = occurrencesInWindow(schedule.trigger as ComputableTrigger, ctx.zoneTz, {
      after: new Date(occurrenceTime),
      through: null,
      max: 1,
    }).occurrences[0];
    actions.push({
      action: 'skip',
      scheduleId: schedule.id,
      occurrenceTime,
      refusalCode: verdict.refusalCode,
      ...(next
        ? {
            question: budgetQuestion({
              scheduleId: schedule.id,
              occurrenceTime,
              overByUsd: verdict.overBy,
              expiresAt: next.toISOString(),
            }),
          }
        : {}),
    });
    return { actions, started: false };
  }

  // ---- Detail 5: the cap ----
  if (ctx.startsRemaining <= 0) {
    actions.push({
      action: 'defer',
      scheduleId: schedule.id,
      occurrenceTime,
      reason: 'concurrency-cap',
    });
    return { actions, started: false };
  }

  // ---- Detail 5: jitter, then the start ----
  const dueMs = Date.parse(occurrenceTime);
  // A catch-up is due in the past; it starts now, not then. `Math.max` and not the occurrence,
  // because a `startAt` before `recorded_at` is a row `schedule_fire_recorded_before_run` refuses.
  const base = Math.max(Number.isFinite(dueMs) ? dueMs : ctx.now.getTime(), ctx.now.getTime());
  const offset = jitterOffsetSeconds(schedule.id, occurrenceTime, schedule.jitterSeconds) * 1000;
  actions.push({
    action: 'start',
    scheduleId: schedule.id,
    occurrenceTime,
    startAt: new Date(base + offset).toISOString(),
  });
  return { actions, started: true };
}
