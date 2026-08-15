/* =============================================================================
 * sessions/lib/format.ts — elapsed and cost, rendered for a thumb (spec §3.1)
 *
 * Two rules behind these functions:
 *
 *  1. Fixed width. These numbers sit in a list that updates every second. A
 *     format that changes character count makes the row twitch, so elapsed
 *     always reads two units and cost always reads two decimals. Paired with
 *     `tabular-nums` in the stylesheet, nothing moves but the digits.
 *
 *  2. No rounding that flatters. A session that has cost $0.004 says `$0.00`,
 *     not `$0.01`. Part VII.3: an honest number beats a plausible one.
 *
 * NODE-LOADABLE LEAF: no runtime imports.
 * ========================================================================== */

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const pad = (n: number) => String(Math.floor(n)).padStart(2, '0');

/**
 * `12s` · `4m 12s` · `1h 04m` · `2d 04h`. Always at most two units, so the
 * column width is stable while the clock runs.
 */
export function formatElapsed(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  if (ms < MINUTE) return `${Math.floor(ms / SECOND)}s`;
  if (ms < HOUR) return `${Math.floor(ms / MINUTE)}m ${pad((ms % MINUTE) / SECOND)}s`;
  if (ms < DAY) return `${Math.floor(ms / HOUR)}h ${pad((ms % HOUR) / MINUTE)}m`;
  return `${Math.floor(ms / DAY)}d ${pad((ms % DAY) / HOUR)}h`;
}

/**
 * `$0.42`. Truncates rather than rounds up, so the tab never claims a session
 * spent more than it did.
 */
export function formatCost(usd: number): string {
  if (!Number.isFinite(usd) || usd < 0) return '—';
  return `$${(Math.floor(usd * 100) / 100).toFixed(2)}`;
}

/** `now` · `4m ago` · `2h ago` · `3d ago`. For the "last activity" meta line. */
export function formatRelative(at: number, now: number = Date.now()): string {
  const delta = now - at;
  if (!Number.isFinite(delta)) return '—';
  if (delta < 45 * SECOND) return 'now';
  if (delta < HOUR) return `${Math.floor(delta / MINUTE)}m ago`;
  if (delta < DAY) return `${Math.floor(delta / HOUR)}h ago`;
  return `${Math.floor(delta / DAY)}d ago`;
}

/**
 * Repo paths are long and phones are narrow. Keep the tail — `…/agnetos` tells
 * you which project you are about to steer; `/Users/admin/Doc…` does not.
 */
export function shortenRepo(repo: string, max = 28): string {
  if (repo.length <= max) return repo;
  const parts = repo.split('/').filter(Boolean);
  let out = parts[parts.length - 1] ?? repo;
  for (let i = parts.length - 2; i >= 0; i--) {
    const next = `${parts[i]}/${out}`;
    if (next.length + 1 > max) break;
    out = next;
  }
  return `…/${out}`;
}
