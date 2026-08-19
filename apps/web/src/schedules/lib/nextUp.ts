/**
 * "Next up" — the ordering behind `Plan §14`'s strip, and the three absences it refuses to merge.
 *
 * Owner: `scheduler-engineer`. Pure, so the one thing that is easy to get wrong here is checkable
 * without a browser.
 *
 * ## The decision
 *
 * A strip called *next up* is a sort by next fire time. The interesting part is what it does with
 * the rows that **have no next fire time**, and there are three genuinely different reasons for
 * that — `ScheduleNextFire` keeps them apart and this module refuses to collapse them:
 *
 * | `because` | What is true | What a merged list would say |
 * |---|---|---|
 * | `not-clockable` | an `event` / `condition` / `chain` / `manual` trigger. It fires when the world does | *"nothing scheduled"* |
 * | `zone-unresolved` | `follow_me: true` and nothing reports where the person is. **This cannot fire at all today** | *"nothing scheduled"* |
 * | `no-further-occurrence` | it had occurrences and has run out — past `until_at`, or `0 0 30 2 *` | *"nothing scheduled"* |
 *
 * Sorting all three to the bottom of one list makes them look like schedules that are merely far
 * away. **`unknown` is not `zero`** (BRIEF), and the middle row is the one that matters most: a
 * schedule that can never fire, sitting quietly in a list of things that will.
 *
 * So `nextUp` returns two collections and a count per reason. A strip renders the first and states
 * the second; it never pads the first with the second.
 */

import type { ScheduleNextFire, ScheduleView } from '@agnetos/contracts';

/** One row of the strip: a schedule that has a computable next fire, with that instant. */
export interface NextUpEntry {
  schedule: ScheduleView;
  at: string;
  /** The wall clock in the schedule's own zone — what the person set, not what the server runs on. */
  local: string;
}

export type UnscheduledReason = Extract<ScheduleNextFire, { at: null }>['because'];

export interface NextUpView {
  /** Ascending by fire time. Only schedules that will actually fire. */
  upcoming: readonly NextUpEntry[];
  /** How many are held back, by reason. Never folded into `upcoming` and never summed away. */
  withoutNextFire: Readonly<Record<UnscheduledReason, number>>;
  /**
   * Schedules that are **disabled**, counted separately again.
   *
   * A disabled schedule has no next fire for a fourth reason, and it is the one reason that is
   * somebody's decision rather than a gap in the build. Detail 7 auto-disables after N
   * consecutive failures *loudly*, and a strip that quietly excluded them would be the exact
   * surface on which "thirty failed nights nobody looked at" happens.
   */
  disabled: number;
}

const EMPTY: Record<UnscheduledReason, number> = {
  'not-clockable': 0,
  'zone-unresolved': 0,
  'no-further-occurrence': 0,
};

/**
 * @param limit how many rows the strip shows. **No default**: a strip is a fixed number of rows
 *   chosen by its layout, and a function that picked one would be deciding a design question in
 *   a data module. The counts below are over *every* schedule regardless of `limit`, because a
 *   count that only covered the visible rows would be a number about a viewport pretending to be
 *   a number about a project.
 */
export function nextUp(schedules: readonly ScheduleView[], limit: number): NextUpView {
  const upcoming: NextUpEntry[] = [];
  const withoutNextFire: Record<UnscheduledReason, number> = { ...EMPTY };
  let disabled = 0;

  for (const schedule of schedules) {
    if (!schedule.enabled) {
      disabled += 1;
      continue;
    }
    const next = schedule.nextFire;
    if (next.at === null) {
      withoutNextFire[next.because] += 1;
      continue;
    }
    upcoming.push({ schedule, at: next.at, local: next.local });
  }

  upcoming.sort((a, b) => {
    if (a.at !== b.at) return a.at < b.at ? -1 : 1;
    // A stable tiebreak, because fourteen schedules at 09:00 is the case detail 5 is about and a
    // strip whose order flickers between polls is a strip nobody can read. Jitter moves when a
    // run *starts*; it never moves `occurrence_time`, so the tie is real and has to be broken by
    // something that does not move either.
    return a.schedule.id < b.schedule.id ? -1 : 1;
  });

  return {
    upcoming: upcoming.slice(0, Math.max(0, limit)),
    withoutNextFire,
    disabled,
  };
}

/**
 * Is this strip's emptiness *"nothing is scheduled"* or *"nothing can be placed in time"*?
 *
 * The same split `Calendar.tsx` makes, and for the same reason: the second is the state this
 * product is actually in, and letting it render as the first would be an honest-looking empty
 * state that is not honest. Returns `null` when there is something to show, so a caller cannot
 * print an empty-state sentence over a populated strip.
 */
export function emptinessOf(view: NextUpView): 'nothing-scheduled' | 'nothing-placeable' | null {
  if (view.upcoming.length > 0) return null;
  const held =
    view.withoutNextFire['not-clockable'] +
    view.withoutNextFire['zone-unresolved'] +
    view.withoutNextFire['no-further-occurrence'];
  return held + view.disabled > 0 ? 'nothing-placeable' : 'nothing-scheduled';
}
