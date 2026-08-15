/**
 * The shared formatters (`comms/contracts/panel-schema.md` rule 3).
 *
 * EVERY number printed on a dashboard passes through `formatValue`. Not for tidiness:
 * a KPI tile, a bar-list value, a table cell and a signal sentence that each round
 * differently are four different claims about the same figure.
 *
 * The other rule, and it is the load-bearing one (standing rule 9): **these functions
 * never invent a value.** Given something that is not a number they return `null`, and
 * the caller prints a sentence. `0` and "no data" are different facts and this module
 * refuses to blur them.
 *
 * Imports are relative to `../../i18n/*` rather than the `@/i18n` barrel on purpose: the
 * barrel re-exports `provider.tsx`, and these functions are verified under `node --test`,
 * which strips TypeScript types but does not transform JSX. The two modules imported here
 * are constants and pure functions with no React in their import graph.
 *
 * Owner: dashboards-engineer · Spec §2.5.3, §2.5.5
 */

import { NUMERIC_LOCALE, DEFAULT_LOCALE, type Locale } from '../../i18n/config';
import { isolate } from '../../i18n/format';
import type { Format } from '@agnetos/contracts';

/* ------------------------------------------------------------------ helpers */

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** `Intl` instances are expensive to construct and cheap to keep. */
const cache = new Map<string, Intl.NumberFormat>();
function nf(key: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(NUMERIC_LOCALE, options);
    cache.set(key, f);
  }
  return f;
}

/* ---------------------------------------------------------------- currency */

/**
 * `$44,500` · `$12.40` · `<$0.01`.
 *
 * Cents below a thousand, none above it: a pipeline figure with two decimals reads like
 * an invoice, and an invoice rounded to the dollar reads like an estimate. The sub-cent
 * case is printed as `<$0.01` because a real, tiny run cost displayed as `$0.00` reads
 * as "free", which is the one thing it is not.
 */
export function formatCurrency(usd: unknown, locale: Locale = DEFAULT_LOCALE): string | null {
  if (!isNum(usd)) return null;
  const abs = Math.abs(usd);
  if (abs > 0 && abs < 0.01) return isolate(usd < 0 ? '>-$0.01' : '<$0.01', locale);
  const digits = abs >= 1000 ? 0 : 2;
  return isolate(
    nf(`cur${digits}`, {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(usd),
    locale,
  );
}

/* ------------------------------------------------------------------ number */

/** `1,284`. Grouped, never compacted — these sit in columns that are read downward. */
export function formatCount(value: unknown, locale: Locale = DEFAULT_LOCALE): string | null {
  if (!isNum(value)) return null;
  const digits = Number.isInteger(value) ? 0 : 1;
  return isolate(nf(`num${digits}`, { maximumFractionDigits: digits }).format(value), locale);
}

/* ----------------------------------------------------------------- percent */

/**
 * Takes a **fraction** (0.043), prints `4.3%`.
 *
 * A percent is the format most likely to be handed the wrong magnitude, so anything
 * above 1.5 is treated as already-percent and passed through — a `4300%` error rate on
 * screen is worse than a forgiving parse, and the alternative is silently dividing a
 * number some agent wrote correctly.
 */
export function formatPercent(value: unknown, locale: Locale = DEFAULT_LOCALE): string | null {
  if (!isNum(value)) return null;
  const fraction = Math.abs(value) > 1.5 ? value / 100 : value;
  const digits = Math.abs(fraction) < 0.1 ? 1 : 0;
  return isolate(
    nf(`pct${digits}`, { style: 'percent', minimumFractionDigits: 0, maximumFractionDigits: digits }).format(
      fraction,
    ),
    locale,
  );
}

/* ---------------------------------------------------------------- duration */

/**
 * Milliseconds in, coarse human out: `840ms` · `4.2s` · `2m 04s` · `1h 03m` · `12d`.
 *
 * Coarse on purpose. A dashboard duration answers "roughly how long", and precision it
 * cannot support (a p50 to the millisecond over nine runs) is a false claim of rigour.
 */
export function formatDurationMs(ms: unknown, locale: Locale = DEFAULT_LOCALE): string | null {
  if (!isNum(ms) || ms < 0) return null;
  if (ms < 1000) return isolate(`${Math.round(ms)}ms`, locale);
  const s = ms / 1000;
  if (s < 60) return isolate(`${s < 10 ? s.toFixed(1) : Math.round(s)}s`, locale);
  const m = Math.floor(s / 60);
  if (m < 60) return isolate(`${m}m ${String(Math.round(s % 60)).padStart(2, '0')}s`, locale);
  const h = Math.floor(m / 60);
  if (h < 24) return isolate(`${h}h ${String(m % 60).padStart(2, '0')}m`, locale);
  const d = Math.floor(h / 24);
  return isolate(d < 10 ? `${d}d ${h % 24}h` : `${d}d`, locale);
}

/* ----------------------------------------------------------- relative time */

const relative = new Map<Locale, Intl.RelativeTimeFormat>();

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31_536_000],
  ['month', 2_592_000],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
  ['second', 1],
];

/** `3 minutes ago`. Accepts an ISO string or epoch milliseconds. */
export function formatRelative(
  at: unknown,
  locale: Locale = DEFAULT_LOCALE,
  now: number = Date.now(),
): string | null {
  const t = toEpoch(at);
  if (t === null) return null;
  let fmt = relative.get(locale);
  if (!fmt) {
    fmt = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    relative.set(locale, fmt);
  }
  const delta = Math.round((t - now) / 1000);
  for (const [unit, size] of UNITS) {
    if (Math.abs(delta) >= size || unit === 'second') return isolate(fmt.format(Math.trunc(delta / size), unit), locale);
  }
  return isolate(fmt.format(0, 'second'), locale);
}

/** ISO-8601 or epoch ms → epoch ms. `null` for anything unparseable. */
export function toEpoch(at: unknown): number | null {
  if (isNum(at)) return at;
  if (typeof at !== 'string' || !at.trim()) return null;
  const t = Date.parse(at);
  return Number.isNaN(t) ? null : t;
}

/**
 * `09:41` — the activity feed's left gutter (§2.5.5.7).
 *
 * 24-hour and zero-padded in both locales: the gutter is a column of equal-width stamps,
 * and `9:41 AM` breaks the column the moment one row is `11:41 PM`.
 */
export function formatClock(at: unknown, locale: Locale = DEFAULT_LOCALE): string | null {
  const t = toEpoch(at);
  if (t === null) return null;
  const d = new Date(t);
  return isolate(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`, locale);
}

/* ------------------------------------------------------------- the switch */

/** The one entry point. `format` comes from the panel JSON; there is no default. */
export function formatValue(value: unknown, format: Format, locale: Locale = DEFAULT_LOCALE): string | null {
  switch (format) {
    case 'currency':
      return formatCurrency(value, locale);
    case 'number':
      return formatCount(value, locale);
    case 'percent':
      return formatPercent(value, locale);
    case 'duration':
      return formatDurationMs(value, locale);
    case 'relative-time':
      return formatRelative(value, locale);
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ deltas */

export type DeltaDirection = 'up' | 'down' | 'flat';

export interface DeltaChip {
  /** `▲ 12.4%`. */
  text: string;
  /** Which way the number moved — for the caret. */
  direction: DeltaDirection;
  /** Whether that movement is good *for this metric*. Drives the colour, never the sign. */
  good: boolean | null;
}

/**
 * §2.5.3 delta chip. `change` is the fractional change against the previous window, as
 * the `previous-period` comparison returns it.
 *
 * `goodDirection` exists because a cost delta of −18% is teal and a runs delta of −18%
 * is coral, and the difference is the metric's meaning, not the sign (§1.3). A flat delta
 * is neither good nor bad — `good` is `null` and the chip stays monochrome.
 */
export function formatDelta(
  change: unknown,
  goodDirection: 'up' | 'down',
  locale: Locale = DEFAULT_LOCALE,
): DeltaChip | null {
  if (!isNum(change)) return null;
  const direction: DeltaDirection = change > 0.0005 ? 'up' : change < -0.0005 ? 'down' : 'flat';
  const magnitude = formatPercent(Math.abs(change), locale);
  if (magnitude === null) return null;
  const caret = direction === 'up' ? '▲' : direction === 'down' ? '▼' : '·';
  return {
    text: `${caret} ${magnitude}`,
    direction,
    good: direction === 'flat' ? null : direction === goodDirection,
  };
}

/**
 * Substitutes `{value}` in a signal's lead (§2.5.4).
 *
 * When the value is missing the caller must fall back to `pending` rather than print a
 * sentence with a hole in it — so this returns `null` instead of leaving the token
 * visible, which is how a `{value}` ends up shipped to a screen.
 */
export function interpolate(lead: string, formatted: string | null): string | null {
  if (!lead.includes('{value}')) return lead;
  if (formatted === null) return null;
  return lead.split('{value}').join(formatted);
}
