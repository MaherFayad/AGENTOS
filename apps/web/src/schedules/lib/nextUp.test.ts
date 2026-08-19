/**
 * "Next up" — the ordering, and the three absences it must not merge.
 *
 * **What this instrument cannot see:** whether the times are right. `nextFire` is computed on the
 * server by the same function the coordinator plans with (`scheduleClock.ts`), deliberately — a
 * browser deriving occurrences would be a second occurrence engine, and the two would disagree on
 * exactly the two days a year that are not 24 hours long. This file asserts what a strip does with
 * the answers, never what the answers are.
 */
import { describe, expect, it } from 'vitest';
import type { ScheduleNextFire, ScheduleView } from '@agnetos/contracts';
import { emptinessOf, nextUp } from './nextUp';

let seq = 0;
const schedule = (over: Partial<ScheduleView> = {}): ScheduleView => ({
  id: `s${String(seq++).padStart(3, '0')}`,
  source: 'ops',
  libraryRef: null,
  triggerKind: 'cron',
  triggerSpec: { expression: '0 6 * * 1' },
  kind: 'agent',
  delivery: 'direct',
  addressedTo: 'sales/digest',
  tz: 'Asia/Riyadh',
  followMe: false,
  jitterSeconds: 0,
  missedRunPolicy: 'skip',
  overlapPolicy: 'skip',
  enabled: true,
  autoDisableAfter: 3,
  consecutiveFailures: 0,
  disabledReason: null,
  untilAt: null,
  reviewAt: '2026-11-19T00:00:00.000Z',
  createdBy: 'human:unattributed',
  createdAt: '2026-08-19T00:00:00.000Z',
  nextFire: { at: '2026-08-24T03:00:00.000Z', local: '2026-08-24T06:00' },
  ...over,
});

const at = (utc: string): ScheduleNextFire => ({ at: utc, local: utc.slice(0, 16) });

describe('the sort', () => {
  it('is ascending by fire time and cuts at the limit the caller names', () => {
    const view = nextUp(
      [
        schedule({ nextFire: at('2026-08-25T03:00:00.000Z') }),
        schedule({ nextFire: at('2026-08-23T03:00:00.000Z') }),
        schedule({ nextFire: at('2026-08-24T03:00:00.000Z') }),
      ],
      2,
    );
    expect(view.upcoming.map((e) => e.at)).toEqual([
      '2026-08-23T03:00:00.000Z',
      '2026-08-24T03:00:00.000Z',
    ]);
  });

  /**
   * Fourteen schedules at 09:00 is the case detail 5 is about, and a strip whose order flickers
   * between polls is a strip nobody can read. The tie is broken by id, which never moves — jitter
   * moves when a run *starts* and never touches `occurrence_time`.
   */
  it('breaks a tie by something that does not move', () => {
    const a = schedule({ id: 'aaa', nextFire: at('2026-08-24T06:00:00.000Z') });
    const b = schedule({ id: 'bbb', nextFire: at('2026-08-24T06:00:00.000Z') });
    expect(nextUp([b, a], 5).upcoming.map((e) => e.schedule.id)).toEqual(['aaa', 'bbb']);
    expect(nextUp([a, b], 5).upcoming.map((e) => e.schedule.id)).toEqual(['aaa', 'bbb']);
  });

  it('counts every schedule, not only the visible ones', () => {
    const view = nextUp(
      [
        schedule({ nextFire: { at: null, because: 'zone-unresolved' } }),
        schedule({ nextFire: { at: null, because: 'zone-unresolved' } }),
        schedule({ nextFire: at('2026-08-24T03:00:00.000Z') }),
      ],
      1,
    );
    // A count that only covered the visible rows would be a number about a viewport pretending
    // to be a number about a project.
    expect(view.withoutNextFire['zone-unresolved']).toBe(2);
  });
});

describe('the three absences stay three', () => {
  it('keeps each reason in its own bucket and never adds them to upcoming', () => {
    const view = nextUp(
      [
        schedule({ triggerKind: 'event', nextFire: { at: null, because: 'not-clockable' } }),
        schedule({ followMe: true, nextFire: { at: null, because: 'zone-unresolved' } }),
        schedule({ untilAt: '2026-01-01T00:00:00.000Z', nextFire: { at: null, because: 'no-further-occurrence' } }),
      ],
      10,
    );
    expect(view.upcoming).toEqual([]);
    expect(view.withoutNextFire).toEqual({
      'not-clockable': 1,
      'zone-unresolved': 1,
      'no-further-occurrence': 1,
    });
  });

  /**
   * The row that matters most: `follow_me: true` with nothing reporting where the person is
   * **cannot fire at all** in this build. Sorted to the bottom of one list it looks like a
   * schedule that is merely far away, which is the difference between a user who knows their
   * briefing is broken and one who finds out in November.
   */
  it('does not let a schedule that can never fire read as one that is far away', () => {
    const view = nextUp(
      [
        schedule({ followMe: true, nextFire: { at: null, because: 'zone-unresolved' } }),
        schedule({ nextFire: at('2026-12-31T03:00:00.000Z') }),
      ],
      10,
    );
    expect(view.upcoming).toHaveLength(1);
    expect(view.withoutNextFire['zone-unresolved']).toBe(1);
  });

  /**
   * Detail 7 auto-disables after N consecutive failures **loudly**. A strip that silently
   * excluded disabled schedules would be the exact surface on which *"thirty failed nights
   * nobody looked at"* happens, so they are counted on their own axis rather than dropped or
   * folded into one of the three above — being turned off is somebody's decision, not a gap in
   * the build.
   */
  it('counts a disabled schedule separately from a schedule nobody can place in time', () => {
    const view = nextUp(
      [
        schedule({ enabled: false, disabledReason: 'failed 3 nights', nextFire: at('2026-08-24T03:00:00.000Z') }),
        schedule({ nextFire: { at: null, because: 'not-clockable' } }),
      ],
      10,
    );
    expect(view.disabled).toBe(1);
    expect(view.withoutNextFire['not-clockable']).toBe(1);
    expect(view.upcoming).toEqual([]);
  });
});

describe('the two emptinesses', () => {
  it('says nothing-scheduled only when there is genuinely nothing', () => {
    expect(emptinessOf(nextUp([], 5))).toBe('nothing-scheduled');
  });

  /**
   * The state this product is actually in. *"You have nothing scheduled"* over three schedules
   * nobody can place in time is an honest-looking empty state that is not honest — the same
   * split `Calendar.tsx` makes between `emptyState` and `unplaceableState`.
   */
  it('says nothing-placeable when schedules exist and none of them can be placed', () => {
    const view = nextUp([schedule({ followMe: true, nextFire: { at: null, because: 'zone-unresolved' } })], 5);
    expect(emptinessOf(view)).toBe('nothing-placeable');
  });

  it('returns null when there is something to show, so no empty-state sentence can be printed over it', () => {
    expect(emptinessOf(nextUp([schedule()], 5))).toBeNull();
  });
});
