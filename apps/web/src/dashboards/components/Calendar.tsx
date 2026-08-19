'use client';

import type { CalendarWidget } from '@agnetos/contracts';
import { formatCount, interpolate } from '../lib/format';
import { toCalendarWeek, weekColumns, type CalendarWeekView } from '../lib/calendar';
import { DEFAULT_LOCALE } from '../../i18n/config';
import { EmptyLine } from './states';
import { QueryGate, WidgetChrome } from './widget-chrome';

/**
 * `calendar` (ADR-028 · `Plan §14`) — a week grid of what will run.
 *
 * The second of ADR-028's three extensions, built in M18 because the reason it was deferred
 * went away: `ops.schedule` exists (`0011_scheduling.sql`). One remains reserved.
 *
 * **Three things this deliberately does not do, each of which would be a decision made by
 * accident:**
 *
 * 1. **No colour.** `Plan §14` asks for a grid *coloured by department*; `CALENDAR_INK` in
 *    `packages/contracts/src/panels.ts` rules that it does not get one, and department is
 *    not the lane axis either. Chrome is monochrome and colour is data ink (CLAUDE.md rule
 *    1, §1.3), the palette has seven hues, and there are seven departments — a tiled
 *    seven-hue grid is where that rule dies first (`scheduling.md` §10). The only value here
 *    that would earn ink is a fire *outcome*, and `ops.schedule_fire` has never held a row.
 *    `Calendar.test.tsx` reads this file and fails on any data-ink class.
 * 2. **No drag.** `Plan §14` mentions drag-to-reschedule. ADR-029's drag primitive is
 *    unwritten, which is precisely why `board` is still reserved; a pointer handler here
 *    would decide that ADR sideways. The same test fails on one.
 * 3. **No occurrence arithmetic and no clock.** The coordinator owns the clock (ADR-024) and
 *    nothing computes a fire time yet (`scheduling.md` §6). Lanes arrive placed or they
 *    arrive uncounted; see `lib/calendar.ts`.
 *
 * **Every sentence comes from the panel JSON** — there is no English literal in this file,
 * for the reason `ThreadFeed` has none: dashboards are data (§2.5), and copy in a data file
 * is copy a panel author and a translator can both reach. The day names are `Intl`'s, so
 * they are neither literals nor a catalogue entry.
 *
 * **It renders one of two sentences today and cannot render anything else.** `ops.schedule`
 * has never held a row and no `source: 'library'` row is even writable (ADR-024:
 * `AgentFrontmatter.schedule` is a bare cron that cannot satisfy the mandatory policy
 * columns). Nothing arrived → `emptyState`; schedules arrived that nobody can place on a day
 * → `unplaceableState`, carrying the count observed in the payload.
 *
 * Owner: dashboards-engineer · ADR-028 · §2.5.5
 */
export function Calendar({ widget }: { widget: CalendarWidget }): React.JSX.Element {
  return (
    <WidgetChrome title={widget.title} subtitle={widget.subtitle} span={widget.span}>
      <QueryGate query={widget.query} emptyState={widget.emptyState} height={200}>
        {(data) => {
          const week = toCalendarWeek(data);
          const columns = weekColumns(week.weekStart, DEFAULT_LOCALE);

          if (week.lanes.length === 0 || columns.length === 0) {
            return <EmptyLine>{calendarCopyFor(widget, week)}</EmptyLine>;
          }

          return (
            <div className="flex flex-col gap-3">
              <div className="overflow-x-auto">
                <table className="w-full text-meta">
                  <thead>
                    <tr className="border-b border-line text-ink-2">
                      {/* The corner cell names nothing: the row header is an address and the
                          column header is a date, and a word here would be a literal. */}
                      <th className="py-2" />
                      {columns.map((column) => (
                        <th key={column.iso} scope="col" className="py-2 text-center font-medium">
                          <span className="block uppercase tracking-wider-1">{column.weekday}</span>
                          <span className="block tabular-nums text-ivory-2">{column.dayOfMonth}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {week.lanes.map((lane) => (
                      <tr key={lane.id} className="border-b border-line last:border-0">
                        <th scope="row" className="py-2 pe-3 text-start font-normal">
                          <span className="block text-ivory">{lane.label}</span>
                          {lane.trigger ? (
                            <span className="block text-label uppercase tracking-wider-1 text-ink-2">
                              {lane.trigger}
                            </span>
                          ) : null}
                        </th>
                        {lane.days.map((fires, day) => (
                          <td key={columns[day].iso} className="py-2 text-center tabular-nums text-ivory">
                            {cellLabel(fires, lane.firesAreExact)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* `Plan §14`'s "annotated with projected cost", answered with the half that is
                  real. The count is summed from the cells on screen; the money is absent and
                  the panel's sentence is required to say so. */}
              <p className="text-meta text-ivory-2">{projectionCopyFor(widget, week)}</p>

              {/* Lanes nobody could place, reported *under* the grid rather than instead of
                  it: hiding them would make a partial week read as the whole one, which is
                  the undercount-that-looks-like-data the department split already refuses. */}
              {week.unplaceable > 0 ? (
                <p className="text-meta text-ink-2">{unplaceableCopyFor(widget, week) ?? widget.emptyState}</p>
              ) : null}
            </div>
          );
        }}
      </QueryGate>
    </WidgetChrome>
  );
}

/**
 * The three sentences, as their own type.
 *
 * Not `Pick<CalendarWidget, …>`: `check-rtl` reads the quoted key names inside a `Pick` as
 * user-facing copy and reports three uncatalogued strings that do not exist. The checker is
 * `rtl-arabic-pdpl-specialist`'s and raising their baseline for a false positive is worse
 * than writing the interface out, which is also what the functions below actually need.
 */
export interface CalendarCopy {
  emptyState: string;
  unplaceableState: string;
  projectionState: string;
}

/**
 * Which of the two emptinesses this is, as a function, so the honest-empty-state rule is
 * checkable without a browser.
 *
 * Nothing arrived at all → `emptyState`. Schedules arrived and none of them could be placed
 * on a day → `unplaceableState` with the count. The second is the state this widget will be
 * in for as long as nothing computes an occurrence, and collapsing the two would let *"you
 * have nothing scheduled"* stand for *"nobody has worked out when your schedules fire"*.
 */
export function calendarCopyFor(widget: CalendarCopy, week: Pick<CalendarWeekView, 'unplaceable'>): string {
  if (week.unplaceable <= 0) return widget.emptyState;
  return unplaceableCopyFor(widget, week) ?? widget.emptyState;
}

const unplaceableCopyFor = (widget: CalendarCopy, week: Pick<CalendarWeekView, 'unplaceable'>): string | null =>
  interpolate(widget.unplaceableState, formatCount(week.unplaceable));

/**
 * The annotation line. `{value}` is the occurrence count, summed from the placed cells —
 * and prefixed with `≥` when any lane told us its own count was a lower bound, because
 * `event`, `condition`, `chain` and `manual` triggers fire on the world rather than on a
 * clock (`scheduling.md` §6).
 *
 * There is no money in it and there cannot be: `CalendarProjection.estimatedUsd` is typed
 * `null`, and the validator refuses a currency symbol anywhere in this sentence.
 */
export function projectionCopyFor(widget: CalendarCopy, week: Pick<CalendarWeekView, 'projection'>): string {
  const count = formatCount(week.projection.fires);
  const shown = count === null ? null : week.projection.firesAreExact ? count : `≥ ${count}`;
  return interpolate(widget.projectionState, shown) ?? widget.emptyState;
}

/**
 * A cell's content. `0` renders as **nothing**, and that is a reading rather than a gap:
 * a lane is only in the grid because the source enumerated its whole week, so a blank day
 * in a drawn lane is an observed zero. A lane nobody could enumerate never becomes a row of
 * blanks — it is counted into `unplaceable` instead. That split is what keeps "unknown is
 * not zero" true in a grid where most cells are empty by nature.
 */
export function cellLabel(fires: number, firesAreExact: boolean): string {
  if (fires <= 0) return '';
  const count = formatCount(fires);
  if (count === null) return '';
  return firesAreExact ? count : `≥ ${count}`;
}
