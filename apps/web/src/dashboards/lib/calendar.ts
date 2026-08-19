/**
 * `calendar` payload → a week grid, and the arithmetic that decides which sentence the
 * widget prints (ADR-028 · `Plan §14` · `comms/contracts/scheduling.md`).
 *
 * Pure, and separate from the component for the reason `rows.ts` is: the interesting part
 * here is not the markup, it is *what counts as placed*, and that has to be checkable under
 * `node --test` without a browser.
 *
 * THE ONE RULE THIS MODULE EXISTS FOR
 *
 * **It never computes an occurrence.** Nothing in this repo parses a cron beyond a
 * five-field shape check and nothing computes a next fire time (`scheduling.md` §6); the
 * coordinator owns the clock (ADR-024). A browser that derived occurrences from
 * `trigger_spec` would be a second occurrence engine, and the two would disagree the first
 * time a DST boundary or a `follow_me` zone came up — the same argument ADR-023 used to
 * keep one run and one trace. So a lane arrives with its days already placed, or it does
 * not arrive placed at all.
 *
 * A lane that arrives with no cell is therefore **counted, not drawn as an empty row**. An
 * empty row claims *this schedule fires nothing this week*; the true statement is *nobody
 * has computed when this schedule fires*. Unknown is not zero, and a row of blanks is a
 * claim (BRIEF).
 *
 * The converse is what makes a blank cell readable: a lane is in the grid only because the
 * source enumerated its whole week, so inside a drawn lane a blank day genuinely is zero
 * occurrences. Both facts are on screen at once, which is why `unplaceableState` renders
 * *under* a grid rather than instead of one.
 *
 * Owner: dashboards-engineer · Spec §2.5.5 · ADR-028
 */

// Type-only imports, both of them. This module is verified under `node --test`, which
// strips TypeScript types but resolves nothing extensionless — a value import from
// `../../i18n/config` (as `lib/format.ts` has) would make the whole suite unloadable. So the
// locale is a parameter with no default and the caller owns it; there is no second copy of
// `DEFAULT_LOCALE` here to drift from the first.
import type { CalendarProjection } from '@agnetos/contracts';
import type { Locale } from '../../i18n/config';

/** Seven columns. A week grid is a week; there is no month view and no `Nd` window. */
export const CALENDAR_DAYS = 7;

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null);

const int = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isInteger(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isInteger(Number(v))) return Number(v);
  return null;
};

/** One drawn row: a schedule, its label, and seven day counts. */
export interface CalendarLaneView {
  id: string;
  label: string;
  trigger: string | null;
  /** `false` ⇒ every count in this lane is a lower bound (`scheduling.md` §6). */
  firesAreExact: boolean;
  /** Length 7. A `0` here is observed: the source enumerated this lane's whole week. */
  days: number[];
  /** This lane's occurrences across the week. */
  fires: number;
}

export interface CalendarWeekView {
  /**
   * The grid's first column, or `null` when the source did not name one — in which case
   * **nothing is placeable**, because a day offset with no origin places nothing.
   */
  weekStart: string | null;
  /** Lanes with at least one placed occurrence, most active first. */
  lanes: CalendarLaneView[];
  /**
   * Schedules that arrived and could not be placed: no occurrence in this week, or no week
   * start to place them against. The number `unplaceableState` prints — observed, never
   * declared.
   */
  unplaceable: number;
  /** `Plan §14`'s annotation. The count is real; the money is `null` and typed that way. */
  projection: CalendarProjection;
}

const emptyProjection = (): CalendarProjection => ({
  fires: 0,
  firesAreExact: true,
  estimatedUsd: null,
  estimateBasis: 'no-completed-runs',
});

/**
 * `{ weekStart, lanes, cells }` → the grid, in one pass, dropping anything it cannot read
 * rather than rendering `undefined` (contract rule 1: one malformed row must not take down
 * the five widgets beside it).
 *
 * `firesAreExact` defaults to **false**, never true. The flag is the source's statement
 * that the trigger has a derivable count, and only `cron` and `interval` do; a renderer
 * that promoted a missing flag to "exact" would print a confident number under a Gmail
 * filter, which `scheduling.md` §6 calls a plausible zero one decimal place up.
 */
export function toCalendarWeek(payload: unknown): CalendarWeekView {
  if (!isObj(payload)) return { weekStart: null, lanes: [], unplaceable: 0, projection: emptyProjection() };

  const weekStart = isoDate(payload.weekStart);
  const rawLanes = Array.isArray(payload.lanes) ? payload.lanes : [];
  const rawCells = Array.isArray(payload.cells) ? payload.cells : [];

  const lanes = new Map<string, CalendarLaneView>();
  for (const lane of rawLanes) {
    if (!isObj(lane)) continue;
    const id = str(lane.id);
    const label = str(lane.label);
    if (id === null || label === null || lanes.has(id)) continue;
    lanes.set(id, {
      id,
      label,
      trigger: str(lane.trigger),
      firesAreExact: lane.firesAreExact === true,
      days: new Array<number>(CALENDAR_DAYS).fill(0),
      fires: 0,
    });
  }

  // A cell for a lane nobody declared is dropped rather than given a lane of its own: the
  // lane carries the address and the exactness flag, and inventing one would put an
  // occurrence on screen under a label this module made up.
  if (weekStart !== null) {
    for (const cell of rawCells) {
      if (!isObj(cell)) continue;
      const lane = lanes.get(str(cell.laneId) ?? '');
      const day = int(cell.day);
      const fires = int(cell.fires);
      if (!lane || day === null || day < 0 || day >= CALENDAR_DAYS || fires === null || fires <= 0) continue;
      lane.days[day] += fires;
      lane.fires += fires;
    }
  }

  const placed = [...lanes.values()]
    .filter((lane) => lane.fires > 0)
    .sort((a, b) => b.fires - a.fires || a.label.localeCompare(b.label));

  const fires = placed.reduce((total, lane) => total + lane.fires, 0);

  return {
    weekStart,
    lanes: placed,
    unplaceable: lanes.size - placed.length,
    projection: {
      fires,
      // One lane that cannot count itself makes the whole annotation a lower bound. The
      // sum of an exact number and a lower bound is a lower bound.
      firesAreExact: placed.every((lane) => lane.firesAreExact),
      estimatedUsd: null,
      estimateBasis: 'no-completed-runs',
    },
  };
}

/** `YYYY-MM-DD`, and only that. A timestamp would imply an instant; a column is a date. */
export function isoDate(value: unknown): string | null {
  const s = str(value);
  if (s === null || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return Number.isNaN(Date.parse(`${s}T00:00:00Z`)) ? null : s;
}

export interface CalendarColumn {
  /** `2026-08-17`. */
  iso: string;
  /** `Mon` — from `Intl`, so it is neither an English literal nor a translation to catalogue. */
  weekday: string;
  /** `17`, as the locale writes it. */
  dayOfMonth: string;
}

/**
 * The seven column headers, derived from the source's `weekStart`.
 *
 * **Fixed to UTC on purpose, and it is not a timezone claim.** These are calendar dates,
 * not instants: the source placed each occurrence on a day in the schedule's own zone
 * (`ops.schedule.tz`, and `follow_me` on top of it), and this module refuses to do that
 * arithmetic a second time. Formatting in UTC is what keeps the header stable regardless of
 * where the browser is standing, so a grid does not shift a column when read from Riyadh.
 * The widget prints no clock time anywhere, which is what makes that safe.
 */
export function weekColumns(weekStart: string | null, locale: Locale): CalendarColumn[] {
  const iso = isoDate(weekStart);
  if (iso === null) return [];
  const start = Date.parse(`${iso}T00:00:00Z`);
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' });
  const day = new Intl.DateTimeFormat(locale, { day: 'numeric', timeZone: 'UTC' });
  return Array.from({ length: CALENDAR_DAYS }, (_, i) => {
    const date = new Date(start + i * 86_400_000);
    return {
      iso: date.toISOString().slice(0, 10),
      weekday: weekday.format(date),
      dayOfMonth: day.format(date),
    };
  });
}
