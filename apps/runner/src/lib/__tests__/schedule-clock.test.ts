/**
 * `scheduleClock.ts` — occurrence computation, the two DST days, and the preview receipt.
 *
 * **What this instrument cannot see, written down rather than discovered later:**
 *
 * 1. **It fires nothing and touches no database.** Every assertion is about a computed instant.
 *    That a coordinator would then *act* on that instant is `schedule-plan.test.ts`'s subject,
 *    and that a fire row would land in Postgres is nobody's yet — `0011` has never been applied.
 * 2. **It trusts the host's ICU.** The DST cases below are real transitions in the IANA database
 *    for `America/New_York`; if a host shipped a stale tzdata these would go red for a reason
 *    that is not a bug in this file. That is the correct trade: the alternative is hard-coding
 *    offsets, which is a second timezone database that silently disagrees with the first.
 * 3. **It says nothing about whether ten is the right number.** `Plan §14` says ten; the
 *    constant is pinned against the plan's number, not derived from anything.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  PREVIEW_FIRE_TIME_COUNT,
  fireTimePreviewToken,
  type ScheduleZoneIntent,
} from '@agnetos/contracts';
import { nextRunAt } from '../cron';
import {
  assertTriggerIsComputable,
  formatWallClock,
  instantsForWallClock,
  occurrencesInWindow,
  previewFireTimes,
  type ComputableTrigger,
} from '../scheduleClock';

const utc = (iso: string): Date => new Date(iso);
const homeTime = (tz: string): ScheduleZoneIntent => ({ tz, followMe: false });
const cron = (expression: string): ComputableTrigger => ({ kind: 'cron', expression });

/* -------------------------------------------------------------------------- *
 * The anti-drift gate: two cron implementations must not disagree
 * -------------------------------------------------------------------------- */

test('in UTC this module and nextRunAt agree — the two cron paths cannot drift', () => {
  // `nextRunAt` is the ofelia-era path and is UTC-only; this module is tz-aware. While both
  // exist, the only thing keeping them from answering differently for the same expression is
  // that they share `parseCron` — and this assertion, which is what would catch a fork.
  const expressions = [
    '0 6 * * 1',
    '*/15 * * * *',
    '0 0 1 * *',
    '30 4 * * 0',
    '0 6 1 * 1', // the OR quirk: fires on the 1st *and* on Mondays
    '15 9,17 * * 1-5',
  ];
  const from = utc('2026-02-14T03:07:00Z');
  let compared = 0;
  for (const expression of expressions) {
    const mine = occurrencesInWindow(cron(expression), 'UTC', { after: from, through: null, max: 1 });
    const theirs = nextRunAt(expression, from);
    assert.equal(mine.occurrences.length, 1, `${expression} produced no occurrence`);
    assert.equal((mine.occurrences[0] as Date).toISOString(), theirs, expression);
    compared += 1;
  }
  // A floor, because an empty loop is a green test. This is the family BRIEF calls "checkers go
  // blind silently": a comparison that compares nothing looks exactly like one that passed.
  assert.equal(compared, expressions.length);
});

/* -------------------------------------------------------------------------- *
 * Detail 6 — the zone is not decoration
 * -------------------------------------------------------------------------- */

test('a 07:00 briefing on Asia/Riyadh is 04:00Z, not 07:00Z', () => {
  const scan = occurrencesInWindow(cron('0 7 * * *'), 'Asia/Riyadh', {
    after: utc('2026-08-18T00:00:00Z'),
    through: null,
    max: 2,
  });
  assert.deepEqual(
    scan.occurrences.map((d) => d.toISOString()),
    ['2026-08-18T04:00:00.000Z', '2026-08-19T04:00:00.000Z'],
  );
  // The same expression through the UTC-only path is three hours wrong and looks perfectly
  // plausible in every view. This is the failure `Plan §14` detail 6 exists to prevent.
  assert.equal(nextRunAt('0 7 * * *', utc('2026-08-18T00:00:00Z')), '2026-08-18T07:00:00.000Z');
});

test('spring forward: a wall-clock time the zone skipped produces no occurrence, and is named', () => {
  // US DST 2026 begins Sunday 8 March. 02:30 local does not exist that day.
  const scan = occurrencesInWindow(cron('30 2 * * *'), 'America/New_York', {
    after: utc('2026-03-07T12:00:00Z'),
    through: null,
    max: 3,
  });
  assert.deepEqual(
    scan.occurrences.map((d) => d.toISOString()),
    ['2026-03-09T06:30:00.000Z', '2026-03-10T06:30:00.000Z', '2026-03-11T06:30:00.000Z'],
  );
  assert.deepEqual(scan.nonexistentLocalTimes, ['2026-03-08T02:30']);
  assert.deepEqual(scan.ambiguousLocalTimes, []);
});

test('fall back: a wall-clock time that happens twice fires once, at the earlier instant', () => {
  // US DST 2026 ends Sunday 1 November. 01:30 local happens at 05:30Z (EDT) and again at
  // 06:30Z (EST). Firing on both would be two rows with two different `occurrence_time`s —
  // two *different* idempotency keys, so `schedule_fire_idempotent` cannot catch the second.
  // The duplicate has to be prevented here or not at all.
  const scan = occurrencesInWindow(cron('30 1 * * *'), 'America/New_York', {
    after: utc('2026-10-31T12:00:00Z'),
    through: null,
    max: 2,
  });
  assert.deepEqual(
    scan.occurrences.map((d) => d.toISOString()),
    ['2026-11-01T05:30:00.000Z', '2026-11-02T06:30:00.000Z'],
  );
  assert.deepEqual(scan.ambiguousLocalTimes, ['2026-11-01T01:30']);
  // And the raw fact underneath it, so the collapse above is not the only witness.
  const both = instantsForWallClock('America/New_York', {
    year: 2026,
    month: 11,
    day: 1,
    hour: 1,
    minute: 30,
  });
  assert.equal(both.length, 2);
  assert.equal((both[0] as Date).toISOString(), '2026-11-01T05:30:00.000Z');
  assert.equal((both[1] as Date).toISOString(), '2026-11-01T06:30:00.000Z');
  const none = instantsForWallClock('America/New_York', {
    year: 2026,
    month: 3,
    day: 8,
    hour: 2,
    minute: 30,
  });
  assert.equal(none.length, 0);
});

test('formatWallClock renders a wall clock with no offset, because a wall clock has none', () => {
  assert.equal(formatWallClock({ year: 2026, month: 3, day: 8, hour: 2, minute: 5 }), '2026-03-08T02:05');
});

test('a three-letter abbreviation is refused, because ICU resolves it to somewhere else entirely', () => {
  // The observation this test was written from, on this host, Node 22:
  //   Intl.DateTimeFormat('en-US', { timeZone: 'AST' }).resolvedOptions().timeZone
  //     → 'America/Anchorage'
  // A person in Riyadh writing AST for Arabia Standard Time gets Alaska, with no error, and a
  // 07:00 briefing fires at 19:00 local forever while every view agrees it is correct.
  assert.equal(
    new Intl.DateTimeFormat('en-US', { timeZone: 'AST' }).resolvedOptions().timeZone,
    'America/Anchorage',
    'if this stops being true the refusal below is defending against nothing and should be re-argued',
  );
  for (const bogus of ['AST', 'EST', 'Japan', 'Mars/Olympus']) {
    assert.throws(
      () => occurrencesInWindow(cron('0 6 * * *'), bogus, { after: utc('2026-01-01T00:00:00Z'), through: null, max: 1 }),
      (err: { code?: string }) => err.code === 'schedule_tz_unknown',
      bogus,
    );
  }
  // And the two forms that are real still work, including the one legal single-word zone.
  for (const good of ['UTC', 'Asia/Riyadh', 'America/Halifax']) {
    assert.doesNotThrow(() =>
      occurrencesInWindow(cron('0 6 * * *'), good, { after: utc('2026-01-01T00:00:00Z'), through: null, max: 1 }),
    );
  }
});

/* -------------------------------------------------------------------------- *
 * Intervals — the anchor is the reason a key can stay a key
 * -------------------------------------------------------------------------- */

test('an interval counts from its stored anchor, so a restart re-derives the same instants', () => {
  const trigger: ComputableTrigger = {
    kind: 'interval',
    everySeconds: 1800,
    anchor: '2026-08-18T00:00:00Z',
  };
  const first = occurrencesInWindow(trigger, 'UTC', {
    after: utc('2026-08-18T09:07:00Z'),
    through: null,
    max: 3,
  });
  assert.deepEqual(
    first.occurrences.map((d) => d.toISOString()),
    ['2026-08-18T09:30:00.000Z', '2026-08-18T10:00:00.000Z', '2026-08-18T10:30:00.000Z'],
  );
  // Asked again from a *different* moment inside the same period, the grid does not move. An
  // anchor of "now" would have shifted every future occurrence — and `occurrence_time` is the
  // idempotency key, so a key that moves is not a key.
  const second = occurrencesInWindow(trigger, 'UTC', {
    after: utc('2026-08-18T09:29:59Z'),
    through: null,
    max: 1,
  });
  assert.equal((second.occurrences[0] as Date).toISOString(), '2026-08-18T09:30:00.000Z');
});

test('an interval with no usable anchor or period is refused, never defaulted', () => {
  for (const trigger of [
    { kind: 'interval', everySeconds: 60, anchor: 'soon' },
    { kind: 'interval', everySeconds: 0, anchor: '2026-08-18T00:00:00Z' },
  ] as ComputableTrigger[]) {
    assert.throws(
      () => occurrencesInWindow(trigger, 'UTC', { after: utc('2026-08-18T00:00:00Z'), through: null, max: 1 }),
      (err: { code?: string }) => err.code === 'bad_request',
    );
  }
});

test('a scan with no positive bound is refused — a week of sleep is not a free query', () => {
  assert.throws(
    () => occurrencesInWindow(cron('* * * * *'), 'UTC', { after: utc('2026-08-11T00:00:00Z'), through: utc('2026-08-18T00:00:00Z'), max: 0 }),
    (err: { code?: string }) => err.code === 'bad_request',
  );
});

test('four of the six trigger kinds are refused rather than answered', () => {
  for (const kind of ['event', 'condition', 'chain', 'manual'] as const) {
    assert.throws(
      () => assertTriggerIsComputable(kind),
      (err: { code?: string }) => err.code === 'schedule_trigger_not_computable',
      kind,
    );
  }
  assert.doesNotThrow(() => assertTriggerIsComputable('cron'));
  assert.doesNotThrow(() => assertTriggerIsComputable('interval'));
});

/* -------------------------------------------------------------------------- *
 * The preview — `Plan §14`'s ten, and the receipt
 * -------------------------------------------------------------------------- */

test('the preview returns exactly ten fire times, in UTC and in the local wall clock', () => {
  assert.equal(PREVIEW_FIRE_TIME_COUNT, 10);
  const preview = previewFireTimes({
    trigger: cron('0 7 * * 1-5'),
    zone: homeTime('Asia/Riyadh'),
    from: utc('2026-08-18T00:00:00Z'),
  });
  assert.equal(preview.fireTimes.length, 10);
  assert.equal(preview.complete, true);
  assert.equal(preview.tz, 'Asia/Riyadh');
  assert.equal(preview.fireTimes[0]?.utc, '2026-08-18T04:00:00.000Z');
  assert.equal(preview.fireTimes[0]?.local, '2026-08-18T07:00');
  // Weekdays only: the tenth is two working weeks out, not ten calendar days.
  assert.equal(preview.fireTimes[9]?.local, '2026-08-31T07:00');
});

test('an expression that never fires previews as empty and incomplete, not as an error', () => {
  const preview = previewFireTimes({
    trigger: cron('0 0 30 2 *'), // 30 February
    zone: homeTime('UTC'),
    from: utc('2026-08-18T00:00:00Z'),
  });
  assert.deepEqual(preview.fireTimes, []);
  assert.equal(preview.complete, false);
});

test('the preview token is the receipt that these ten times were on screen', () => {
  const base = { trigger: cron('0 6 * * 1'), zone: homeTime('UTC'), from: utc('2026-08-18T00:00:00Z') };
  const a = previewFireTimes(base);
  const b = previewFireTimes(base);
  assert.equal(a.previewToken, b.previewToken, 'the same preview must produce the same receipt');

  // The bug this defends against is ordinary, not adversarial: a dialog that previewed Mondays,
  // a field edited to the 1st of the month before save, and a schedule that fires monthly under
  // a confirmation screen that said weekly.
  const edited = previewFireTimes({ ...base, trigger: cron('0 6 1 * *') });
  assert.notEqual(a.previewToken, edited.previewToken);

  // Same expression, different zone: different instants, so a different receipt.
  const elsewhere = previewFireTimes({ ...base, zone: homeTime('Asia/Riyadh') });
  assert.notEqual(a.previewToken, elsewhere.previewToken);

  // And the token is a pure function of what was displayed, so the save route can recompute it.
  assert.equal(
    a.previewToken,
    fireTimePreviewToken({ expression: '0 6 * * 1', tz: 'UTC', followMe: false, fireTimes: a.fireTimes }),
  );
});

test('follow_me with no current-zone signal refuses the preview instead of falling back to tz', () => {
  assert.throws(
    () =>
      previewFireTimes({
        trigger: cron('0 7 * * *'),
        zone: { tz: 'Asia/Riyadh', followMe: true, standingIn: null },
        from: utc('2026-08-18T00:00:00Z'),
      }),
    (err: { code?: string }) => err.code === 'schedule_zone_unresolved',
  );
  // With a signal it previews in the zone the person is standing in, not in home time.
  const preview = previewFireTimes({
    trigger: cron('0 7 * * *'),
    zone: { tz: 'Asia/Riyadh', followMe: true, standingIn: 'Europe/London' },
    from: utc('2026-08-18T00:00:00Z'),
  });
  assert.equal(preview.tz, 'Europe/London');
  assert.equal(preview.fireTimes[0]?.utc, '2026-08-18T06:00:00.000Z'); // BST
});

test('follow_me on an interval is refused, because it would change nothing', () => {
  assert.throws(
    () =>
      previewFireTimes({
        trigger: { kind: 'interval', everySeconds: 1800, anchor: '2026-08-18T00:00:00Z' },
        zone: { tz: 'Asia/Riyadh', followMe: true, standingIn: 'Europe/London' },
        from: utc('2026-08-18T00:00:00Z'),
      }),
    (err: { code?: string }) => err.code === 'schedule_zone_intent_incoherent',
  );
});

/**
 * The receipt's canonical form, pinned as **behaviour** — and a note about how it was stored.
 *
 * `fireTimePreviewToken` joins its parts with `U+0000`, which is the one character a cron
 * expression, an IANA zone name and an ISO instant can none of them contain. With an ordinary
 * separator the fields run together and two genuinely different confirmations collide: a preview
 * of `0 6 * * 1` in `UTC` and a preview of `0 6 * *` in a zone literally named `1 UTC` are the
 * same string under a space. A collision here is not cosmetic — it is `schedule_preview_stale`
 * failing to refuse the save it exists to refuse.
 *
 * The first version of this test used an *empty* second field for the collision and stayed green
 * under a planted space separator, because an empty field still contributes its own separator.
 * The plant had applied; the assertion was simply not aimed at the boundary. Recorded because a
 * falsification that passes is worth more than one that was never run.
 *
 * **The separator was a literal NUL byte in the source until 2026-08-19**, which made the whole
 * of `packages/contracts/src/scheduling.ts` a binary file to ripgrep — `grep -n` answered
 * *"Binary file matches"* instead of showing a line, so every content search over the scheduling
 * contract silently returned nothing. It is `'\u0000'` now: identical string, identical digest,
 * and a file a search can see. Same family as the comment-stripper that deleted half its corpus
 * and passed — an instrument that goes blind without saying so.
 */
test('the preview receipt cannot be collided by moving a field boundary', () => {
  const fireTimes = [{ utc: '2026-08-24T06:00:00.000Z' }];
  const honest = fireTimePreviewToken({ expression: '0 6 * * 1', tz: 'UTC', followMe: false, fireTimes });
  const smuggled = fireTimePreviewToken({ expression: '0 6 * *', tz: '1 UTC', followMe: false, fireTimes });
  assert.notEqual(
    honest,
    smuggled,
    'Two different confirmations produce the same receipt, so the field separator is a character ' +
      'that can appear inside a field. schedule_preview_stale cannot refuse a save it cannot ' +
      'distinguish.',
  );

  // The same fields in the same order must be stable across processes — the browser previews and
  // the runner recomputes, and a receipt that depends on anything else is not a receipt.
  assert.equal(honest, fireTimePreviewToken({ expression: '0 6 * * 1', tz: 'UTC', followMe: false, fireTimes }));
  assert.match(honest, /^pv1_[0-9a-f]{8}$/);
});
