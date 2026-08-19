/**
 * `calendar`'s honest empty states, its refusals, and the two gates that keep the refusals
 * true (ADR-028 · `Plan §14` · `comms/contracts/scheduling.md`).
 *
 * The widget renders nothing today and will keep rendering nothing after `ops.schedule` has
 * rows in it, because nothing computes an occurrence (`scheduling.md` §6) and no
 * `source: 'library'` row is even writable (ADR-024). So the thing worth pinning is not the
 * grid — it is *which sentence appears*, that the number in it was counted rather than
 * declared, and that no money figure and no drag handler got in while nobody was looking.
 *
 * Two of these tests read the component's own source. That is deliberate: "the calendar is
 * monochrome" and "the calendar has no drag interaction" are properties of the file, not of
 * a render, and a render test would only prove it for the one payload it was given. Each
 * source gate also runs its matcher over a planted sample and asserts it fires — an
 * instrument that cannot see the defect is indistinguishable from one that found nothing
 * (BRIEF: *checkers go blind silently*).
 *
 * Vitest rather than `node --test`: this file imports `@agnetos/contracts` as a value.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CalendarProjection } from '@agnetos/contracts';
import { CALENDAR_INK } from '@agnetos/contracts';

import { calendarCopyFor, cellLabel, projectionCopyFor } from './Calendar';
import { toCalendarWeek } from '../lib/calendar';

// Resolved from the Vitest root (`apps/web`), as `dashboards-contrast.test.ts` does: under
// jsdom the module URL is not a `file:` URL and `fileURLToPath` throws.
const read = (rel: string): string => readFileSync(resolve(process.cwd(), rel), 'utf8');

const COMPONENT = 'src/dashboards/components/Calendar.tsx';
const LIB = 'src/dashboards/lib/calendar.ts';

const copy = {
  emptyState: 'No schedules yet — the coordinator writes ops.schedule when an agent is put on a clock.',
  // Phrased so any count reads correctly: a panel file has no plural mechanism.
  unplaceableState: 'Schedules with no occurrence computed for this week: {value}.',
  projectionState: 'Occurrences on this grid: {value}. Nothing is projected beside them.',
};

describe('calendar empty states', () => {
  it('says nothing arrived when nothing arrived', () => {
    expect(calendarCopyFor(copy, { unplaceable: 0 })).toBe(copy.emptyState);
  });

  it('distinguishes "no schedules" from "schedules nobody can place" — the true state today', () => {
    // Two emptinesses sit on top of each other. Only the second is a claim the widget can
    // make from what it observed, and it is the one that stops a reader concluding their
    // week is quiet from a fact about the coordinator never having run.
    expect(calendarCopyFor(copy, { unplaceable: 3 })).toBe(
      'Schedules with no occurrence computed for this week: 3.',
    );
    expect(calendarCopyFor(copy, { unplaceable: 3 })).not.toContain('{value}');
  });

  it('counts unplaceable lanes from the payload, never from a default', () => {
    const week = toCalendarWeek({
      weekStart: '2026-08-17',
      lanes: [
        { id: 'a', label: '#sales', firesAreExact: true },
        { id: 'b', label: '#deals' },
      ],
      cells: [{ laneId: 'a', day: 1, fires: 2 }],
    });
    expect(week.unplaceable).toBe(1);
    expect(calendarCopyFor(copy, week)).toContain(': 1.');
  });
});

describe('the annotation Plan §14 asks for', () => {
  const week = (fires: number, firesAreExact: boolean) => ({
    projection: { fires, firesAreExact, estimatedUsd: null as null, estimateBasis: 'no-completed-runs' as const },
  });

  it('prints the occurrence count, which is real', () => {
    expect(projectionCopyFor(copy, week(12, true))).toBe(
      'Occurrences on this grid: 12. Nothing is projected beside them.',
    );
  });

  it('marks a lower bound as one rather than rounding the caveat away', () => {
    // Only `cron` and `interval` have a count derivable from the trigger; the other four
    // fire on the world or on a person (`scheduling.md` §6).
    expect(projectionCopyFor(copy, week(12, false))).toContain('≥ 12');
  });

  it('carries no money, and the type is what stops one', () => {
    const projection: CalendarProjection = {
      fires: 3,
      firesAreExact: true,
      // Zero runs have completed, so there is nothing to average — and a calendar multiplies
      // a guessed per-run figure by every cell on screen. The directive sits on the
      // offending property, not above the declaration, so it guards an error rather than
      // reporting itself unused.
      // @ts-expect-error a money figure must not compile: estimatedUsd is typed `null`
      estimatedUsd: 12.4,
      estimateBasis: 'no-completed-runs',
    };
    expect(projection.estimatedUsd).toBe(12.4);
  });
});

describe('a cell', () => {
  it('prints a blank for an observed zero and a numeral for an occurrence', () => {
    // A blank inside a drawn lane is a reading: the lane is in the grid only because the
    // source enumerated its whole week. A lane nobody could enumerate is never drawn as a
    // row of blanks — it is counted into `unplaceable`. That split is what keeps "unknown is
    // not zero" true in a grid that is mostly empty by nature.
    expect(cellLabel(0, true)).toBe('');
    expect(cellLabel(2, true)).toBe('2');
    expect(cellLabel(2, false)).toBe('≥ 2');
  });
});

describe('the two refusals, checked against the source rather than against a render', () => {
  it('uses no data ink — Plan §14 asks for a grid coloured by department and does not get one', () => {
    // CLAUDE.md rule 1 is §1.3's "90% of why it looks expensive", and `scheduling.md` §10
    // names this grid as where it dies first: seven departments, seven hues, tiled. The lane
    // axis is the address the schedule row stores, department is a query filter, and colour
    // carries nothing until a fire outcome exists to carry.
    const inked = /(?:className|class)="[^"]*\b(?:text|bg|border|fill|stroke)-(?:ink-)?(?:coral|lavender|teal|amber|copper)\b|var\(--ink-(?:coral|lavender|teal|amber)\)|var\(--copper\)/;
    expect(read(COMPONENT)).not.toMatch(inked);
    expect(read(LIB)).not.toMatch(inked);
    // The instrument can see the defect it is looking for.
    expect('<td className="text-ink-coral tabular-nums">').toMatch(inked);
    expect(CALENDAR_INK.byDepartment).toBe(false);
    expect(CALENDAR_INK.huesUsed).toBe(0);
  });

  it('introduces no drag interaction — ADR-029 is unwritten and stays that way', () => {
    // `Plan §14` mentions drag-to-reschedule. ADR-029's drag primitive is exactly what
    // `board` is still waiting for; a pointer handler here would decide that ADR sideways,
    // in a widget, with no document.
    const dragged = /onPointerDown|onPointerMove|onPointerUp|onMouseDown|onDrag[A-Z]|onDrag=|draggable|setPointerCapture|dnd/;
    expect(read(COMPONENT)).not.toMatch(dragged);
    expect(read(LIB)).not.toMatch(dragged);
    expect('<tr draggable onPointerDown={start}>').toMatch(dragged);
  });

  it('writes no English copy of its own — every sentence comes from the panel file', () => {
    // Dashboards are data (§2.5). A sentence hardcoded here is one a panel author and a
    // translator both cannot reach, and `check-rtl` counts it. The day names are `Intl`'s.
    const prose = /<(?:p|span|th|td|h3|div)[^>]*>[A-Za-z][A-Za-z ,.'’-]{3,}</;
    expect(read(COMPONENT)).not.toMatch(prose);
    // The instrument can see the defect: this is what a hardcoded empty line looks like.
    expect('<p className="text-meta text-ink-2">No schedules.</p>').toMatch(prose);
  });
});
