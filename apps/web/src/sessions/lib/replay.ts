/* =============================================================================
 * sessions/lib/replay.ts — reconnect without losing the thread (spec §3.1, §3.6)
 *
 * Assume the network is bad and the device sleeps. That is not a pessimistic
 * edge case for this tab, it is the normal case: the phone is the reason the
 * PWA exists, and a phone is asleep most of the time.
 *
 * So the transcript is a CURSOR, not a stream. Every entry carries a monotonic
 * `seq`. On reconnect we ask for everything after the highest `seq` we hold and
 * merge; if the relay replays entries we already have (it may, and that is
 * cheaper than it guaranteeing exactly-once), the merge drops the duplicates.
 * The user sees a transcript that healed, not a gap and not a double.
 *
 * NODE-LOADABLE LEAF: no runtime imports.
 * ========================================================================== */

import type { TranscriptEntry } from '../types';

/** The highest cursor we hold, or 0 for a cold start. */
export function cursorOf(entries: readonly { seq: number }[]): number {
  let max = 0;
  for (const e of entries) if (e.seq > max) max = e.seq;
  return max;
}

/**
 * Merge replayed/streamed entries into what we already have.
 *
 * - de-duplicates by `seq` (last write wins, so a corrected entry replaces the
 *   earlier one rather than appearing twice)
 * - returns ascending by `seq`
 * - pure: neither argument is mutated
 */
export function mergeByCursor(
  existing: readonly TranscriptEntry[],
  incoming: readonly TranscriptEntry[],
): TranscriptEntry[] {
  if (incoming.length === 0) return [...existing];
  const bySeq = new Map<number, TranscriptEntry>();
  for (const e of existing) bySeq.set(e.seq, e);
  for (const e of incoming) bySeq.set(e.seq, e);
  return [...bySeq.values()].sort((a, b) => a.seq - b.seq);
}

/**
 * Did we lose entries between what we hold and what arrived? A gap means the
 * relay's replay buffer aged out (the runner keeps 5 minutes — api-contracts),
 * and the view says so instead of pretending the transcript is complete.
 */
export function hasGap(
  existing: readonly TranscriptEntry[],
  incoming: readonly TranscriptEntry[],
): boolean {
  if (existing.length === 0 || incoming.length === 0) return false;
  const held = cursorOf(existing);
  const firstIncoming = Math.min(...incoming.map((e) => e.seq));
  return firstIncoming > held + 1;
}

/**
 * Reconnect backoff: 0.5s, 1s, 2s, 4s, 8s, then hold at 15s, each with ±20%
 * jitter. Capped low on purpose — a phone coming out of a tunnel should
 * reconnect in seconds, not sulk for a minute, and one client cannot stampede
 * a relay that only serves one human.
 */
export function backoffMs(attempt: number, random: () => number = Math.random): number {
  const base = Math.min(500 * 2 ** Math.max(0, attempt), 15_000);
  const jitter = 1 + (random() - 0.5) * 0.4;
  return Math.round(base * jitter);
}
