/* =============================================================================
 * list.test.mjs — ordering and the numbers in each row (spec §3.1)
 * ========================================================================== */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { sortSessions, countWaiting, stateLabel, STATE_ORDER } from '../lib/sort.ts';
import { formatElapsed, formatCost, formatRelative, shortenRepo } from '../lib/format.ts';

const session = (id, state, updatedAt) => ({
  envelope: { id, seq: 1, updatedAt, active: true, encryptedMetadata: 'x' },
  meta: {
    name: id,
    repo: '/repo',
    model: 'claude-opus-4',
    state,
    startedAt: 0,
    costUsd: 0,
    billing: 'claude-subscription',
  },
});

/* ------------------------------------------------------------------ order */

test('waiting-permission sorts first — it is the state that costs the human time', () => {
  const sorted = sortSessions([
    session('idle-1', 'idle', 300),
    session('working-1', 'working', 200),
    session('waiting-1', 'waiting-permission', 100),
  ]);
  assert.deepEqual(
    sorted.map((s) => s.envelope.id),
    ['waiting-1', 'working-1', 'idle-1'],
  );
});

test('waiting-permission beats a much more recent working session', () => {
  const sorted = sortSessions([
    session('working-now', 'working', 9_999_999),
    session('waiting-old', 'waiting-permission', 1),
  ]);
  assert.equal(sorted[0].envelope.id, 'waiting-old');
});

test('within a state group, most recently updated first', () => {
  const sorted = sortSessions([
    session('old', 'working', 100),
    session('new', 'working', 300),
    session('mid', 'working', 200),
  ]);
  assert.deepEqual(
    sorted.map((s) => s.envelope.id),
    ['new', 'mid', 'old'],
  );
});

test('sortSessions does not mutate its input', () => {
  const input = [session('a', 'idle', 1), session('b', 'waiting-permission', 2)];
  const before = input.map((s) => s.envelope.id);
  sortSessions(input);
  assert.deepEqual(
    input.map((s) => s.envelope.id),
    before,
  );
});

test('STATE_ORDER matches the sort, so the header and the list cannot disagree', () => {
  const sorted = sortSessions(STATE_ORDER.map((s, i) => session(s, s, 100 - i)));
  assert.deepEqual(
    sorted.map((s) => s.meta.state),
    [...STATE_ORDER],
  );
});

test('countWaiting drives the badge', () => {
  assert.equal(
    countWaiting([
      session('a', 'waiting-permission', 1),
      session('b', 'working', 2),
      session('c', 'waiting-permission', 3),
    ]),
    2,
  );
  assert.equal(countWaiting([]), 0);
});

test('the state label spells out the one state a two-word label would hide', () => {
  assert.equal(stateLabel('waiting-permission'), 'waiting on permission');
  assert.equal(stateLabel('working'), 'working');
  assert.equal(stateLabel('idle'), 'idle');
});

/* ----------------------------------------------------------------- numbers */

test('elapsed reads at most two units so the column width never twitches', () => {
  assert.equal(formatElapsed(12_000), '12s');
  assert.equal(formatElapsed(252_000), '4m 12s');
  assert.equal(formatElapsed(3_840_000), '1h 04m');
  assert.equal(formatElapsed(187_200_000), '2d 04h');
});

test('elapsed pads the second unit, so 1h 4m and 1h 40m align', () => {
  assert.equal(formatElapsed(3_840_000).length, formatElapsed(6_000_000).length);
});

test('elapsed is honest about nonsense rather than rendering NaN', () => {
  assert.equal(formatElapsed(NaN), '—');
  assert.equal(formatElapsed(-1), '—');
});

test('cost truncates, so the tab never claims a session spent more than it did', () => {
  assert.equal(formatCost(0.004), '$0.00');
  assert.equal(formatCost(0.419), '$0.41');
  assert.equal(formatCost(12.4), '$12.40');
  assert.equal(formatCost(0), '$0.00');
  assert.equal(formatCost(NaN), '—');
});

test('relative time is coarse on purpose — a phone glance, not a stopwatch', () => {
  const now = 1_000_000_000;
  assert.equal(formatRelative(now - 10_000, now), 'now');
  assert.equal(formatRelative(now - 240_000, now), '4m ago');
  assert.equal(formatRelative(now - 7_200_000, now), '2h ago');
  assert.equal(formatRelative(now - 259_200_000, now), '3d ago');
});

test('a long repo path keeps its tail — the end tells you which project it is', () => {
  assert.equal(shortenRepo('/repo'), '/repo');
  const short = shortenRepo('/Users/admin/Documents/GitHub/agnetos');
  assert.ok(short.endsWith('agnetos'), `expected the tail, got ${short}`);
  assert.ok(short.length <= 30);
  assert.ok(short.startsWith('…/'));
});
