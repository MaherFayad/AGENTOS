/**
 * `planTick` — detail 1's ordering, detail 2's idempotency, details 3, 4, 5 and §5's refusal.
 *
 * **The restart test is the point of this file.** `Plan §14` detail 2 calls a double-fire on
 * coordinator restart *"the single most common scheduler bug in existence"*, and the usual way to
 * find it is to restart a live coordinator and watch the bill. `planTick` is a pure function, so
 * the same proof is a loop: plan a tick, apply its `record`s into the ledger, plan the identical
 * tick again, and assert the second one plans nothing. No clock, no database, no sleeping laptop.
 *
 * **What this instrument cannot see:**
 *
 * 1. **Nothing executes.** Every assertion is about a list of intentions. That a `start` action
 *    would place a run is `runner-engineer`'s, and zero runs have ever executed anywhere.
 * 2. **No row is written.** The idempotency proof below is against a `Map`, not against
 *    `schedule_fire_idempotent`, which has never been enforced by a Postgres. The two agree by
 *    construction — the Map is keyed on `(schedule_id, occurrence_time)` and so is the UNIQUE —
 *    and that agreement is asserted as text by `schedule-schema-pinning.test.ts`, not executed.
 * 3. **`applyPlan` below is a test double.** A real executor writes rows, starts runs and can
 *    fail halfway. What it shares with the real one is the only property under test: a `record`
 *    becomes a row keyed by `(scheduleId, occurrenceTime)`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  SCHEDULE_BUDGET_ENFORCEMENT,
  assertFireTransition,
  fireBudgetVerdict,
  type MissedRunPolicy,
  type OverlapPolicy,
  type ScheduleBudgetArmed,
} from '@agnetos/contracts';
import {
  jitterOffsetSeconds,
  planTick,
  type KnownFire,
  type PlannedAction,
  type PlannerSchedule,
  type TickInput,
} from '../schedulePlan';

const HOURLY: PlannerSchedule = {
  id: 'sch-hourly',
  projectId: 'proj-1',
  trigger: { kind: 'cron', expression: '0 * * * *' },
  zone: { tz: 'UTC', followMe: false },
  jitterSeconds: 0,
  missedRunPolicy: 'catch_up_all',
  overlapPolicy: 'allow_parallel',
  enabled: true,
  untilAt: null,
};

function tick(over: Partial<TickInput> = {}): TickInput {
  return {
    now: new Date('2026-08-18T12:00:30Z'),
    since: new Date('2026-08-18T11:00:30Z'),
    schedules: [HOURLY],
    knownFires: [],
    latenessToleranceSeconds: 300,
    maxStartsPerTick: 8,
    maxOccurrencesPerSchedule: 64,
    ...over,
  };
}

/** The test double described in the header: a `record` becomes a ledger row. */
function applyPlan(actions: PlannedAction[], ledger: KnownFire[]): KnownFire[] {
  const next = [...ledger];
  for (const action of actions) {
    if (action.action !== 'record') continue;
    next.push({
      scheduleId: action.scheduleId,
      occurrenceTime: action.occurrenceTime,
      state: 'pending',
      questionMessageId: null,
    });
  }
  return next;
}

const of = (actions: PlannedAction[], kind: PlannedAction['action']): PlannedAction[] =>
  actions.filter((a) => a.action === kind);

/* -------------------------------------------------------------------------- *
 * Detail 2 — the restart
 * -------------------------------------------------------------------------- */

test('a coordinator restart re-deriving the same window plans nothing — detail 2', () => {
  const input = tick();
  const first = planTick(input);
  assert.equal(of(first.actions, 'record').length, 1, 'the first tick must have had work to do');
  assert.equal(first.startsPlanned, 1);

  // The coordinator dies here and comes back. `now` and `since` are unchanged because the
  // restart was instant — the worst case, and the one that double-fires.
  const ledger = applyPlan(first.actions, []);
  const second = planTick({ ...input, knownFires: ledger });

  assert.deepEqual(of(second.actions, 'record'), []);
  assert.deepEqual(of(second.actions, 'start'), []);
  assert.equal(second.startsPlanned, 0);
});

test('a restart after a long sleep re-derives every missed occurrence exactly once', () => {
  // Twelve hourly occurrences slept through. The first tick records twelve; a restart in the
  // middle of executing them must not record a thirteenth for any key it already wrote.
  const input = tick({
    since: new Date('2026-08-18T00:00:30Z'),
    now: new Date('2026-08-18T12:00:30Z'),
    maxStartsPerTick: 100,
  });
  const first = planTick(input);
  const records = of(first.actions, 'record');
  assert.equal(records.length, 12);

  // Only half the records made it to the ledger before the process died.
  const partial = applyPlan(records.slice(0, 6), []);
  const second = planTick({ ...input, knownFires: partial });
  const secondRecords = of(second.actions, 'record');
  assert.equal(secondRecords.length, 6, 'exactly the six that were never written');

  const allKeys = [...records, ...secondRecords].map(
    (a) => `${a.scheduleId}|${(a as { occurrenceTime: string }).occurrenceTime}`,
  );
  // Twelve occurrences, eighteen record actions across two ticks, twelve distinct keys — the
  // UNIQUE constraint is what would catch a thirteenth, and there is not one to catch.
  assert.equal(new Set(allKeys).size, 12);
});

/* -------------------------------------------------------------------------- *
 * Detail 1 — the row exists before the run does
 * -------------------------------------------------------------------------- */

test('every start is preceded, in the same plan, by the record for its own key', () => {
  const plan = planTick(tick({ since: new Date('2026-08-18T08:00:30Z'), maxStartsPerTick: 100 }));
  const seen = new Set<string>();
  let starts = 0;
  for (const action of plan.actions) {
    const key = `${action.scheduleId}|${'occurrenceTime' in action ? action.occurrenceTime : ''}`;
    if (action.action === 'record') seen.add(key);
    if (action.action === 'start') {
      starts += 1;
      assert.ok(seen.has(key), `start for ${key} was planned before its record`);
    }
  }
  assert.equal(starts, 4, 'a floor — an empty loop is a green test');
});

test('a pending row that was never started becomes missed, which fire-then-record could not show', () => {
  const plan = planTick(
    tick({
      knownFires: [
        {
          scheduleId: HOURLY.id,
          occurrenceTime: '2026-08-18T09:00:00.000Z',
          state: 'pending',
          questionMessageId: null,
        },
      ],
    }),
  );
  const missed = of(plan.actions, 'mark-missed');
  assert.equal(missed.length, 1);
  assert.equal((missed[0] as { occurrenceTime: string }).occurrenceTime, '2026-08-18T09:00:00.000Z');
});

test('a pending row holding an unanswered question is not swept into missed', () => {
  const plan = planTick(
    tick({
      knownFires: [
        {
          scheduleId: HOURLY.id,
          occurrenceTime: '2026-08-18T09:00:00.000Z',
          state: 'pending',
          questionMessageId: 'msg-1',
        },
      ],
    }),
  );
  assert.deepEqual(of(plan.actions, 'mark-missed'), []);
});

test('missed and skipped are different answers and the planner never conflates them', () => {
  // A policy declining an occurrence is `skip` with a reason. A row nobody ever acted on is
  // `mark-missed` with none. Both appear in one plan here, on the same schedule.
  const plan = planTick(
    tick({
      schedules: [{ ...HOURLY, missedRunPolicy: 'skip' }],
      since: new Date('2026-08-18T09:00:30Z'),
      knownFires: [
        {
          scheduleId: HOURLY.id,
          occurrenceTime: '2026-08-18T08:00:00.000Z',
          state: 'pending',
          questionMessageId: null,
        },
      ],
    }),
  );
  assert.equal(of(plan.actions, 'mark-missed').length, 1);
  const skips = of(plan.actions, 'skip') as { refusalCode: string }[];
  assert.ok(skips.length >= 2);
  assert.ok(skips.every((s) => s.refusalCode === 'missed_run_policy_skip'));
});

/* -------------------------------------------------------------------------- *
 * Detail 3 — all four missed-run policies do something different
 * -------------------------------------------------------------------------- */

test('the four missed-run policies produce four different plans for the same sleep', () => {
  // Six hourly occurrences in the window (07:00 … 12:00). **Five of them are catch-ups and one
  // is not**: 12:00 is thirty seconds old against a five-minute tolerance, so it is simply due.
  // Kept that way rather than rounded off, because the boundary is where a missed-run policy
  // would most plausibly be applied to an occurrence that was never missed.
  const base = tick({ since: new Date('2026-08-18T06:00:30Z'), maxStartsPerTick: 100 });
  const outcome = (policy: MissedRunPolicy) => {
    const plan = planTick({ ...base, schedules: [{ ...HOURLY, missedRunPolicy: policy }] });
    return {
      records: of(plan.actions, 'record').length,
      starts: of(plan.actions, 'start').length,
      skips: (of(plan.actions, 'skip') as { refusalCode: string }[]).map((s) => s.refusalCode),
      asks: of(plan.actions, 'ask').length,
    };
  };

  const skip = outcome('skip');
  assert.equal(skip.records, 6, 'every occurrence is still recorded — detail 1 is unconditional');
  assert.equal(skip.starts, 1, 'the one that is merely due is not a missed run and still fires');
  assert.equal(skip.skips.length, 5);
  assert.deepEqual(new Set(skip.skips), new Set(['missed_run_policy_skip']));

  const all = outcome('catch_up_all');
  assert.equal(all.starts, 6);
  assert.deepEqual(all.skips, []);

  const once = outcome('catch_up_once');
  assert.equal(once.starts, 2, 'the newest catch-up, plus the occurrence that was never missed');
  assert.equal(once.skips.length, 4);
  assert.deepEqual(new Set(once.skips), new Set(['catch_up_once_superseded']));

  const ask = outcome('ask');
  assert.equal(ask.records, 6);
  assert.equal(ask.starts, 1);
  assert.equal(ask.asks, 1, 'one question for the batch, never one per occurrence');
});

test('`ask` names every occurrence it is asking about, so the count is real', () => {
  const plan = planTick(
    tick({
      since: new Date('2026-08-18T06:00:30Z'),
      schedules: [{ ...HOURLY, missedRunPolicy: 'ask' }],
    }),
  );
  const ask = of(plan.actions, 'ask')[0] as { occurrenceTimes: string[] };
  // Five, not six: the sixth occurrence was never missed and is not something to ask about.
  // A question that overstated its own batch would be the count-that-is-not-real defect on the
  // one surface whose entire job is to let a person judge a number.
  assert.deepEqual(ask.occurrenceTimes, [
    '2026-08-18T07:00:00.000Z',
    '2026-08-18T08:00:00.000Z',
    '2026-08-18T09:00:00.000Z',
    '2026-08-18T10:00:00.000Z',
    '2026-08-18T11:00:00.000Z',
  ]);
});

/* -------------------------------------------------------------------------- *
 * Detail 4 — all four overlap policies
 * -------------------------------------------------------------------------- */

test('the four overlap policies produce four different plans against one in-flight run', () => {
  const running: KnownFire[] = [
    {
      scheduleId: HOURLY.id,
      occurrenceTime: '2026-08-18T11:00:00.000Z',
      state: 'running',
      questionMessageId: null,
    },
  ];
  const outcome = (policy: OverlapPolicy) => {
    const plan = planTick(
      tick({ schedules: [{ ...HOURLY, overlapPolicy: policy }], knownFires: running }),
    );
    return {
      starts: of(plan.actions, 'start').length,
      kills: of(plan.actions, 'kill').length,
      skips: (of(plan.actions, 'skip') as { refusalCode: string }[]).map((s) => s.refusalCode),
      defers: (of(plan.actions, 'defer') as { reason: string }[]).map((d) => d.reason),
      records: of(plan.actions, 'record').length,
    };
  };

  const skip = outcome('skip');
  assert.equal(skip.records, 1, 'the occurrence is recorded either way');
  assert.equal(skip.starts, 0);
  assert.deepEqual(skip.skips, ['overlap_policy_skip']);

  const queue = outcome('queue');
  assert.equal(queue.starts, 0);
  assert.deepEqual(queue.defers, ['overlap-queue']);
  assert.deepEqual(queue.skips, [], 'a queued fire is not refused — the row stays pending');

  const kill = outcome('kill_previous');
  assert.equal(kill.kills, 1);
  assert.equal(kill.starts, 1);

  const parallel = outcome('allow_parallel');
  assert.equal(parallel.starts, 1);
  assert.equal(parallel.kills, 0);
});

test('two catch-ups planned in one tick see each other, not only what was already running', () => {
  // The bug this catches: reading in-flight once, before the loop. With `overlap_policy = skip`
  // and nothing running, six catch-ups would all start "because nothing is running", which is
  // six parallel runs under a policy whose whole purpose is to forbid the second.
  const plan = planTick(
    tick({
      since: new Date('2026-08-18T06:00:30Z'),
      schedules: [{ ...HOURLY, overlapPolicy: 'skip', missedRunPolicy: 'catch_up_all' }],
      maxStartsPerTick: 100,
    }),
  );
  assert.equal(of(plan.actions, 'start').length, 1);
  assert.equal(of(plan.actions, 'skip').length, 5);
});

/* -------------------------------------------------------------------------- *
 * Detail 5 — jitter and the cap
 * -------------------------------------------------------------------------- */

test('jitter is derived from the key, so a restart re-derives the same start time', () => {
  const a = jitterOffsetSeconds('sch-1', '2026-08-18T09:00:00.000Z', 600);
  const b = jitterOffsetSeconds('sch-1', '2026-08-18T09:00:00.000Z', 600);
  assert.equal(a, b);
  assert.ok(a >= 0 && a <= 600);
  assert.equal(jitterOffsetSeconds('sch-1', '2026-08-18T09:00:00.000Z', 0), 0);

  // Fourteen schedules at 09:00 must not land on one instant. The spread is the whole feature.
  const offsets = new Set(
    Array.from({ length: 14 }, (_, i) =>
      jitterOffsetSeconds(`sch-${i}`, '2026-08-18T09:00:00.000Z', 600),
    ),
  );
  assert.ok(offsets.size >= 12, `expected a spread, got ${offsets.size} distinct offsets`);
});

test('a jittered start is after the occurrence, never before it', () => {
  const plan = planTick(tick({ schedules: [{ ...HOURLY, jitterSeconds: 600 }] }));
  const start = of(plan.actions, 'start')[0] as { occurrenceTime: string; startAt: string };
  // Not merely later than the occurrence: later than `now`, because `recorded_at` is the
  // database's clock and `schedule_fire_recorded_before_run` refuses a start before it.
  assert.ok(Date.parse(start.startAt) >= Date.parse('2026-08-18T12:00:30Z'));
  assert.ok(Date.parse(start.startAt) >= Date.parse(start.occurrenceTime));
});

test('the concurrency cap defers the surplus and the next tick starts it', () => {
  const many: PlannerSchedule[] = Array.from({ length: 10 }, (_, i) => ({
    ...HOURLY,
    id: `sch-${i}`,
  }));
  const input = tick({ schedules: many, maxStartsPerTick: 4 });
  const first = planTick(input);

  assert.equal(first.startsPlanned, 4);
  assert.equal(of(first.actions, 'record').length, 10, 'every occurrence is recorded regardless');
  const defers = of(first.actions, 'defer') as { reason: string }[];
  assert.equal(defers.length, 6);
  assert.ok(defers.every((d) => d.reason === 'concurrency-cap'));

  // A deferred fire is a `pending` row and nothing else — no queue in the coordinator's memory,
  // which is a queue a restart loses. Six rows, six starts next tick.
  const ledger = applyPlan(first.actions, []).filter((f) =>
    defers.some((d) => (d as unknown as { scheduleId: string }).scheduleId === f.scheduleId),
  );
  assert.equal(ledger.length, 6);
});

/* -------------------------------------------------------------------------- *
 * Detail 6 — the zone the schedule declared, and the zone it cannot resolve
 * -------------------------------------------------------------------------- */

test('the occurrence is computed in the schedule\'s own zone, not in the coordinator\'s', () => {
  // **Added because a falsification found this suite blind.** Substituting `'UTC'` for
  // `zone.tz` at the one call site where `planTick` hands a zone to the clock left every test in
  // this file green — every fixture above declares UTC, so the wiring between the schedule's
  // declared intent and the computation had no witness at all. `schedule-clock.test.ts` proved
  // the clock honours a zone; nothing proved the planner passed it one. That is the
  // producer-without-a-consumer shape, arriving as a consumer without a producer.
  const plan = planTick(
    tick({
      schedules: [
        {
          ...HOURLY,
          trigger: { kind: 'cron', expression: '0 7 * * *' },
          zone: { tz: 'Asia/Riyadh', followMe: false },
        },
      ],
      since: new Date('2026-08-18T00:00:00Z'),
      now: new Date('2026-08-18T12:00:30Z'),
    }),
  );
  const recorded = of(plan.actions, 'record').map((a) => (a as { occurrenceTime: string }).occurrenceTime);
  // 07:00 in Riyadh is 04:00Z. Computed in UTC it would be 07:00Z — three hours late, every
  // day, and correct-looking in every view.
  assert.deepEqual(recorded, ['2026-08-18T04:00:00.000Z']);
});

test('a follow_me schedule with no zone signal records nothing and is reported as a fault', () => {
  const plan = planTick(
    tick({
      schedules: [{ ...HOURLY, zone: { tz: 'Asia/Riyadh', followMe: true, standingIn: null } }],
    }),
  );
  assert.deepEqual(plan.actions, [], 'an occurrence nobody can place in time is not an occurrence');
  assert.equal(plan.unresolvable.length, 1);
  assert.equal(plan.unresolvable[0]?.refusalCode, 'zone_intent_unresolved');
  // And the hint says why the fallback was not taken, because the fallback is the defect.
  assert.match(plan.unresolvable[0]?.hint ?? '', /follow-me/);
});

/* -------------------------------------------------------------------------- *
 * Detail 8 — expiry, and the disabled schedule
 * -------------------------------------------------------------------------- */

test('an occurrence after until_at is never recorded, and a pending one past it resolves', () => {
  const plan = planTick(
    tick({
      since: new Date('2026-08-18T06:00:30Z'),
      schedules: [{ ...HOURLY, untilAt: '2026-08-18T09:00:00.000Z' }],
      knownFires: [
        {
          scheduleId: HOURLY.id,
          occurrenceTime: '2026-08-18T11:00:00.000Z',
          state: 'pending',
          questionMessageId: null,
        },
      ],
      maxStartsPerTick: 100,
    }),
  );
  const recorded = of(plan.actions, 'record').map((a) => (a as { occurrenceTime: string }).occurrenceTime);
  assert.deepEqual(recorded, ['2026-08-18T07:00:00.000Z', '2026-08-18T08:00:00.000Z', '2026-08-18T09:00:00.000Z']);
  const expired = (of(plan.actions, 'skip') as { refusalCode: string }[]).filter(
    (s) => s.refusalCode === 'schedule_expired',
  );
  assert.equal(expired.length, 1);
});

test('a disabled schedule produces no occurrences, and resolves the rows it left behind', () => {
  const plan = planTick(
    tick({
      schedules: [{ ...HOURLY, enabled: false }],
      knownFires: [
        {
          scheduleId: HOURLY.id,
          occurrenceTime: '2026-08-18T11:00:00.000Z',
          state: 'pending',
          questionMessageId: 'msg-1',
        },
      ],
    }),
  );
  assert.deepEqual(of(plan.actions, 'record'), []);
  const skips = of(plan.actions, 'skip') as { refusalCode: string }[];
  assert.deepEqual(skips.map((s) => s.refusalCode), ['schedule_disabled']);
});

/* -------------------------------------------------------------------------- *
 * §5 — the budget refusal: built, driven, and typed unreachable
 * -------------------------------------------------------------------------- */

test('the budget cap has never refused anything, and the live planner cannot make it', () => {
  // The constant the planner defaults to. `enforced` is typed `false`, so TypeScript narrows
  // `fireBudgetVerdict` to the allowed arm at every live call site.
  assert.equal(SCHEDULE_BUDGET_ENFORCEMENT.enforced, false);
  assert.equal(SCHEDULE_BUDGET_ENFORCEMENT.everRefused, false);
  assert.deepEqual(fireBudgetVerdict(SCHEDULE_BUDGET_ENFORCEMENT), {
    allowed: true,
    because: 'not-enforced',
  });

  const plan = planTick(tick({ since: new Date('2026-08-18T06:00:30Z'), maxStartsPerTick: 100 }));
  const refusals = (of(plan.actions, 'skip') as { refusalCode: string }[]).filter(
    (s) => s.refusalCode === 'budget_would_exceed_cap',
  );
  assert.deepEqual(refusals, [], 'no plan in this build can contain a budget refusal');
});

test('armed, the refusal fires, raises a question, and does not consume a start slot', () => {
  // The only way to construct this input is a literal. `capUsd` would come from
  // `ops.project.budget_monthly`, which no caller has ever read; `committedUsdThisMonth` from
  // completed runs, of which there are zero; `projectedUsdThisFire` from a per-run figure that
  // `ScheduleCostProjection.estimatedUsd` is typed `null` to refuse to invent.
  const armed: ScheduleBudgetArmed = {
    enforced: true,
    capUsd: 100,
    committedUsdThisMonth: 98,
    projectedUsdThisFire: 5,
  };
  const verdict = fireBudgetVerdict(armed);
  assert.deepEqual(verdict, { allowed: false, refusalCode: 'budget_would_exceed_cap', overBy: 3 });
  // Exactly on the cap is within it: a cap that refuses at equality refuses the run the user
  // budgeted for.
  assert.deepEqual(fireBudgetVerdict({ ...armed, projectedUsdThisFire: 2 }), {
    allowed: true,
    because: 'within-cap',
  });

  const plan = planTick(tick({ budget: armed, maxStartsPerTick: 4 }));
  assert.equal(plan.startsPlanned, 0, 'a refused fire must not consume a start slot');
  const skip = of(plan.actions, 'skip')[0] as {
    refusalCode: string;
    question?: { kind: string; expiresAt: string; payload: Record<string, unknown> };
  };
  assert.equal(skip.refusalCode, 'budget_would_exceed_cap');
  assert.equal(skip.question?.kind, 'question', 'a question is a message kind, not an entity');
  // Expiry is the schedule's next occurrence — after that, this question is about a fire that
  // has already been overtaken. Derived with a stated basis, not a round number.
  assert.equal(skip.question?.expiresAt, '2026-08-18T13:00:00.000Z');
  assert.equal(skip.question?.payload.overByUsd, 3);
  // Structured, never prose: key-based redaction walks keys and a sentence has none.
  assert.equal(typeof skip.question?.payload, 'object');
  assert.ok(!('body' in (skip.question?.payload ?? {})));
  // And the row is still recorded, because detail 1 is unconditional.
  assert.equal(of(plan.actions, 'record').length, 1);
});

/* -------------------------------------------------------------------------- *
 * The transitions the plan implies are the ones the ledger allows
 * -------------------------------------------------------------------------- */

test('every state a planned action moves a fire to is a legal transition from pending', () => {
  const plan = planTick(
    tick({
      since: new Date('2026-08-18T06:00:30Z'),
      schedules: [{ ...HOURLY, missedRunPolicy: 'catch_up_once' }],
      knownFires: [
        {
          scheduleId: HOURLY.id,
          occurrenceTime: '2026-08-18T05:00:00.000Z',
          state: 'pending',
          questionMessageId: null,
        },
      ],
      maxStartsPerTick: 100,
    }),
  );
  const target: Partial<Record<PlannedAction['action'], 'running' | 'skipped' | 'missed'>> = {
    start: 'running',
    skip: 'skipped',
    'mark-missed': 'missed',
  };
  let checked = 0;
  for (const action of plan.actions) {
    const to = target[action.action];
    if (!to) continue;
    assert.doesNotThrow(() =>
      assertFireTransition({ from: 'pending', to, attemptsBefore: 0, attemptsAfter: 0 }),
    );
    checked += 1;
  }
  assert.ok(checked >= 3, `a floor on what was actually checked, got ${checked}`);
});
