/**
 * Formatting of values that already exist. Nothing here invents a number:
 * every function returns `null` when its input is missing, and the caller renders
 * a sentence instead of a placeholder (Part VII.3).
 *
 * Owner: drawer-engineer
 */

import type { ScheduleResponse } from '@agnetos/contracts';

/** `sales/account-enrichment` -> `Account Enrichment`. `exa` -> `Exa`. */
export function labelFromSlug(slug: string): string {
  const tail = slug.split('/').pop() ?? slug;
  return tail
    .split(/[-_]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** `$0.42`, `$12.40`. Sub-cent runs read `<$0.01` rather than `$0.00`, which reads broken. */
export function formatCost(usd: number | undefined | null): string | null {
  if (typeof usd !== 'number' || !Number.isFinite(usd)) return null;
  if (usd > 0 && usd < 0.01) return '<$0.01';
  return `$${usd.toFixed(2)}`;
}

/** `840ms` · `4.2s` · `2m 04s` · `1h 03m`. */
export function formatDuration(ms: number | undefined | null): string | null {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) return null;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const restSeconds = Math.round(seconds - minutes * 60);
  if (minutes < 60) return `${minutes}m ${String(restSeconds).padStart(2, '0')}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${String(minutes - hours * 60).padStart(2, '0')}m`;
}

/**
 * Relative time. The API sends `relativeTime` already rendered; this is the fallback for
 * a row that only carries `startedAt`. Returns null when there is nothing real to show.
 */
export function relativeTime(iso: string | undefined | null, now: number = Date.now()): string | null {
  if (!iso) return null;
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return null;
  const seconds = Math.max(0, Math.round((now - then) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

/**
 * A 5-field cron rendered for a human, for the fields we can read with certainty.
 * Anything less obvious falls back to the raw expression — a wrong plain-English
 * schedule is worse than a cron string a person can look up.
 */
export function describeCron(cron: string | undefined | null): string | null {
  if (!cron) return null;
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return cron.trim();
  const [minute, hour, dom, month, dow] = parts;
  const numeric = /^\d+$/;
  if (!numeric.test(minute) || !numeric.test(hour)) return cron.trim();
  const time = `${String(Number(hour)).padStart(2, '0')}:${String(Number(minute)).padStart(2, '0')}`;
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  if (dom === '*' && month === '*' && dow === '*') return `every day at ${time}`;
  if (dom === '*' && month === '*' && numeric.test(dow)) {
    const day = DAYS[Number(dow) % 7];
    return `every ${day} at ${time}`;
  }
  if (numeric.test(dom) && month === '*' && dow === '*') return `on day ${Number(dom)} of each month at ${time}`;
  return cron.trim();
}

/**
 * The sentence shown after ⏰ Schedule saves, taken from the server rather than composed.
 *
 * `ScheduleResponse.executionNote` exists *"so that every client tells the same truth; render
 * it rather than composing your own from `nextMatchAt`"* (`packages/contracts/src/api.ts`).
 * The reason it is the server's to write is the defect it replaced: this drawer used to print
 * *"Saved. Next run {nextRunAt}."* while `firedBy` was — and still is — `'nobody'`, so a
 * person scheduled an agent, was told when it would next run, and nothing was ever going to
 * happen. A sentence composed here would drift from the mechanism again the moment an executor
 * lands or fails to; a sentence composed there is behind an exhaustive `switch` on
 * `ScheduleFiredBy`, so the compiler stops the runner until the wording catches up.
 *
 * `null` for a runner older than the contract, which sends no such field — this module's
 * standing rule (see the file header): return `null` when the input is missing and let the
 * caller write the sentence. It matters more than usual here. The honest fallback can only
 * say the one thing this client observed, that the request succeeded, and must claim nothing
 * about firing; composing one from `nextMatchAt` would rebuild the original defect behind a
 * version check.
 */
export function scheduleSentence(response: Pick<ScheduleResponse, 'executionNote'>): string | null {
  // The parameter is the contract's field, so the day it is renamed this stops compiling —
  // which is the whole point, after a rename reached the honest branch by accident of
  // absence. The `typeof` guard is the runtime half of the same question: a runner older
  // than the contract sends nothing here, and TypeScript cannot see across the wire.
  const note: unknown = response.executionNote;
  return typeof note === 'string' && note.trim() !== '' ? note : null;
}
