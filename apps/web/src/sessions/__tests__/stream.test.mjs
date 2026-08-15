/* =============================================================================
 * stream.test.mjs — reconnect, replay and windowing (spec §3.1, §3.6)
 *
 * These are the tests that decide whether the tab works on a train.
 * ========================================================================== */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { mergeByCursor, cursorOf, hasGap, backoffMs } from '../lib/replay.ts';
import { buildOffsets, windowFor, isPinnedToBottom } from '../lib/virtual.ts';
import { toSessionMeta, toTranscriptEntry, deriveState, pendingPermission } from '../relay/happy-adapter.ts';

const entry = (seq, text = `line ${seq}`) => ({
  id: `m${seq}`,
  seq,
  at: 1000 + seq,
  kind: 'assistant',
  text,
});

/* ----------------------------------------------------------------- replay */

test('a reconnect that replays entries we already hold produces no duplicates', () => {
  const held = [entry(1), entry(2), entry(3)];
  const replayed = [entry(2), entry(3), entry(4)];
  const merged = mergeByCursor(held, replayed);
  assert.deepEqual(
    merged.map((e) => e.seq),
    [1, 2, 3, 4],
  );
});

test('a replayed entry replaces the earlier one rather than appearing twice', () => {
  const merged = mergeByCursor([entry(2, 'partial')], [entry(2, 'complete')]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].text, 'complete');
});

test('out-of-order arrivals come back ascending', () => {
  const merged = mergeByCursor([], [entry(5), entry(1), entry(3)]);
  assert.deepEqual(
    merged.map((e) => e.seq),
    [1, 3, 5],
  );
});

test('merging nothing is a no-op that still returns a fresh array', () => {
  const held = [entry(1)];
  const merged = mergeByCursor(held, []);
  assert.deepEqual(merged, held);
  assert.notEqual(merged, held);
});

test('the cursor is the highest seq held — a cold start asks from 0', () => {
  assert.equal(cursorOf([entry(1), entry(7), entry(3)]), 7);
  assert.equal(cursorOf([]), 0);
});

test('a gap is detected when the relay replay buffer aged out', () => {
  assert.equal(hasGap([entry(1), entry(2)], [entry(9)]), true);
  assert.equal(hasGap([entry(1), entry(2)], [entry(3)]), false);
  assert.equal(hasGap([entry(1), entry(2)], [entry(2)]), false, 'an overlap is not a gap');
  assert.equal(hasGap([], [entry(9)]), false, 'a cold start is not a gap');
});

test('backoff climbs to a low ceiling — a phone leaving a tunnel should not sulk', () => {
  const nojitter = () => 0.5;
  assert.equal(backoffMs(0, nojitter), 500);
  assert.equal(backoffMs(1, nojitter), 1000);
  assert.equal(backoffMs(3, nojitter), 4000);
  assert.equal(backoffMs(10, nojitter), 15_000);
  assert.equal(backoffMs(99, nojitter), 15_000);
});

test('backoff jitter stays within ±20%', () => {
  for (const r of [0, 0.25, 0.75, 1]) {
    const ms = backoffMs(2, () => r);
    assert.ok(ms >= 1600 && ms <= 2400, `${ms} out of range`);
  }
});

/* -------------------------------------------------------------- windowing */

test('offsets are a prefix sum, using the estimate for unmeasured rows', () => {
  const offsets = buildOffsets(4, new Map([[1, 40]]), 20);
  assert.deepEqual(offsets, [0, 20, 60, 80, 100]);
});

test('the window covers the viewport plus overscan on both sides', () => {
  const offsets = buildOffsets(100, new Map(), 20); // 2000px tall
  const w = windowFor(offsets, 500, 400, 6);
  assert.ok(w.start <= 25 - 6, 'overscan above');
  assert.ok(w.end >= 45, 'overscan below');
  assert.equal(w.total, 2000);
  assert.equal(w.padTop, offsets[w.start]);
  assert.equal(w.padBottom, 2000 - offsets[w.end]);
});

test('spacers plus rendered rows always add up to the full height — no scroll drift', () => {
  const offsets = buildOffsets(50, new Map([[10, 120]]), 18);
  for (const scrollTop of [0, 100, 400, 9999]) {
    const w = windowFor(offsets, scrollTop, 300);
    const rendered = offsets[w.end] - offsets[w.start];
    assert.equal(w.padTop + rendered + w.padBottom, w.total);
  }
});

test('an empty transcript windows to nothing rather than throwing', () => {
  const w = windowFor(buildOffsets(0, new Map(), 20), 0, 400);
  assert.deepEqual(w, { start: 0, end: 0, padTop: 0, padBottom: 0, total: 0 });
});

test('scrolling past the end clamps instead of producing a negative pad', () => {
  const offsets = buildOffsets(10, new Map(), 20);
  const w = windowFor(offsets, 100_000, 100);
  assert.ok(w.padBottom >= 0);
  assert.equal(w.end, 10);
});

test('auto-scroll only when the reader is already at the bottom', () => {
  assert.equal(isPinnedToBottom(1600, 400, 2000), true);
  assert.equal(isPinnedToBottom(1570, 400, 2000), true, 'within the momentum threshold');
  assert.equal(isPinnedToBottom(200, 400, 2000), false, 'reading history — do not yank');
});

/* -------------------------------------------------- the upstream adapter */

test('waiting-permission wins over working — a blocked session is blocked', () => {
  assert.equal(deriveState({ thinking: true, permissionRequest: { id: 'r1' } }, true), 'waiting-permission');
  assert.equal(deriveState({ state: 'running' }, true), 'working');
  assert.equal(deriveState({ thinking: true }, true), 'working');
  assert.equal(deriveState({}, false), 'idle', 'no daemon attached is idle');
  assert.equal(deriveState({ state: 'idle' }, true), 'idle');
});

test('billing is hardcoded to the subscription — Part V, and upstream does not get a vote', () => {
  const meta = toSessionMeta(
    { name: 'Refactor', path: '/repo/agnetos', model: 'claude-opus-4', usage: { costUsd: 1.5 }, billing: 'runner-api-key' },
    { updatedAt: 500, active: true },
  );
  assert.equal(meta.billing, 'claude-subscription');
  assert.equal(meta.costUsd, 1.5);
  assert.equal(meta.repo, '/repo/agnetos');
});

test('missing metadata degrades to something honest, not something plausible', () => {
  const meta = toSessionMeta({}, { updatedAt: 500, active: false });
  assert.equal(meta.name, 'Untitled session');
  assert.equal(meta.repo, 'unknown path');
  assert.equal(meta.model, 'unknown model');
  assert.equal(meta.costUsd, 0);
  assert.equal(meta.startedAt, 500);
  assert.equal(meta.state, 'idle');
});

test('a permission message becomes a card with its detail intact', () => {
  const e = toTranscriptEntry(
    {
      role: 'assistant',
      permission: { id: 'req_1', tool: 'Bash', input: { command: 'rm -rf build' } },
    },
    { id: 'm1', seq: 1, at: 10 },
  );
  assert.equal(e.kind, 'permission');
  assert.equal(e.permission.tool, 'Bash');
  assert.deepEqual(e.permission.detail, ['command: rm -rf build']);
  assert.match(e.permission.summary, /Bash/, 'the summary must name what is being permitted');
});

test('assistant content arrives as an array of parts and flattens to text', () => {
  const e = toTranscriptEntry(
    { role: 'assistant', content: [{ text: 'Reading ' }, { text: 'the file.' }] },
    { id: 'm2', seq: 2, at: 11 },
  );
  assert.equal(e.kind, 'assistant');
  assert.equal(e.text, 'Reading the file.');
});

test('an unknown role becomes system rather than throwing away the entry', () => {
  const e = toTranscriptEntry({ role: 'wat', text: 'hi' }, { id: 'm3', seq: 3, at: 12 });
  assert.equal(e.kind, 'system');
  assert.equal(e.text, 'hi');
});

test('the pending permission is the newest unresolved one', () => {
  const entries = [
    { ...entry(1), kind: 'permission', permission: { requestId: 'r1', tool: 'Bash', summary: 's' } },
    entry(2),
    { ...entry(3), kind: 'permission', permission: { requestId: 'r2', tool: 'Edit', summary: 's' } },
  ];
  assert.equal(pendingPermission(entries, new Set()).requestId, 'r2');
  assert.equal(pendingPermission(entries, new Set(['r2'])).requestId, 'r1');
  assert.equal(pendingPermission(entries, new Set(['r1', 'r2'])), null);
});
