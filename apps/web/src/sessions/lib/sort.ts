/* =============================================================================
 * sessions/lib/sort.ts — list ordering (spec §3.1)
 *
 * Sorted with `waiting-permission` first. That is not a cosmetic preference:
 * a session waiting on a permission prompt is burning the human's time, and
 * every other state is not. Ordering the list by "which row costs me money
 * right now" is the single most useful thing this tab does before you tap it.
 *
 * This runs in the BROWSER. Session metadata is encrypted, so the relay cannot
 * sort by state even in principle (ADR-005).
 *
 * NODE-LOADABLE LEAF: no runtime imports. `import type` only.
 * ========================================================================== */

import type { DecryptedSession, SessionState } from '../types';

/** Lower sorts first. */
const STATE_RANK: Record<SessionState, number> = {
  'waiting-permission': 0,
  working: 1,
  idle: 2,
};

export const STATE_ORDER: readonly SessionState[] = [
  'waiting-permission',
  'working',
  'idle',
];

/** Human-facing label for a state. Kept here so the list and the header agree. */
export function stateLabel(state: SessionState): string {
  return state === 'waiting-permission' ? 'waiting on permission' : state;
}

/**
 * Order: waiting-permission → working → idle; within a group, most recently
 * updated first. Pure and stable — returns a new array, never mutates.
 */
export function sortSessions(
  sessions: readonly DecryptedSession[],
): DecryptedSession[] {
  return [...sessions].sort((a, b) => {
    const byState = STATE_RANK[a.meta.state] - STATE_RANK[b.meta.state];
    if (byState !== 0) return byState;
    return b.envelope.updatedAt - a.envelope.updatedAt;
  });
}

/** How many rows are asking for a human. Drives the tab badge and the header. */
export function countWaiting(sessions: readonly DecryptedSession[]): number {
  return sessions.filter((s) => s.meta.state === 'waiting-permission').length;
}
