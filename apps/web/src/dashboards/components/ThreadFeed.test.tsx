/**
 * `thread-feed`'s honest empty states (ADR-028).
 *
 * The widget renders nothing today and will keep rendering nothing after the first real
 * run, because `ops.agent_runs.thread_id` is nullable and no writer sets it
 * (`thread-model.md` §5.3). So the thing worth pinning is not the list — it is *which
 * sentence appears*, and that the number in it was counted rather than declared.
 *
 * Vitest rather than `node --test`: this file imports `@agnetos/contracts` as a value
 * through the component, and the node runner cannot resolve that barrel.
 */

import { describe, expect, it } from 'vitest';

import { emptyCopyFor, shortThreadId } from './ThreadFeed';

const copy = {
  emptyState: 'No runs yet, so no thread has anything to show.',
  // Phrased so the count can be any number: a panel file has no plural mechanism, and
  // "1 runs" is the kind of seam that makes a real reading look like a placeholder.
  unthreadedState: 'Runs in this window that belong to no thread: {value}.',
};

const row = (over: Record<string, unknown> = {}) => ({
  at: '2026-08-18T09:41:00Z',
  event: 'Ran',
  attribution: 'Ops',
  ...over,
});

describe('thread-feed empty states', () => {
  it('says nothing arrived when nothing arrived', () => {
    expect(emptyCopyFor(copy, [])).toBe(copy.emptyState);
  });

  it('distinguishes "no runs" from "runs, none threaded" — the true state today', () => {
    // Two layers of emptiness sit on top of each other here. Only this one is a claim the
    // widget can make from what it observed, and it is the one that stops a reader
    // concluding something about their thread from a fact about the writer.
    const text = emptyCopyFor(copy, [row(), row(), row()]);
    expect(text).toBe('Runs in this window that belong to no thread: 3.');
    expect(text).not.toContain('{value}');
  });

  it('counts only the unthreaded rows, and never reports a zero it did not observe', () => {
    expect(emptyCopyFor(copy, [row({ threadId: 't-1' }), row()])).toBe(
      'Runs in this window that belong to no thread: 1.',
    );
  });

  it('truncates a thread id for display without touching the data', () => {
    expect(shortThreadId('3f8a1c2d-9b47-4c1e-8a2f-77c1d9e4b012')).toBe('3f8a1c2d');
    expect(shortThreadId('short')).toBe('short');
  });
});
