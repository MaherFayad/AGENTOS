/* =============================================================================
 * i18n/format.ts — numbers, money, durations and relative time.
 *
 * Owner: rtl-arabic-pdpl-specialist · Spec §1.4 (numerals), §2.0 (cost ticker),
 * §2.3 (LAST RUNS rows), §2.5 (KPI tiles).
 *
 * TWO RULES, AND THEY ARE BOTH ABOUT BIDI:
 *
 * 1. Western digits in both locales (config.NUMERIC_LOCALE). A console is read
 *    down a column; two numeral systems means two column rhythms.
 *
 * 2. A number sitting inside an Arabic sentence is an LTR island. Without an
 *    isolate, the bidi algorithm reorders the run against the neighbouring
 *    Arabic and "$12.40 today" renders as "12.40$" — a real, shipped-looking
 *    bug that nobody notices until a client reads it aloud. So every formatter
 *    here wraps its output in U+2068 FIRST STRONG ISOLATE … U+2069 POP
 *    DIRECTIONAL ISOLATE when the surrounding locale is RTL.
 *
 * Charts and numeric axes are the same problem one level up, and they are
 * solved in CSS instead — see `.u-ltr-island` in styles/rtl.css.
 * ============================================================================= */

import { COST_CURRENCY, NUMERIC_LOCALE, directionOf, type Locale } from './config';

const FSI = '⁨';
const PDI = '⁩';

/** Wrap a bidi-neutral or LTR run so it cannot be reordered by its neighbours. */
export const isolate = (value: string, locale: Locale): string =>
  directionOf(locale) === 'rtl' ? `${FSI}${value}${PDI}` : value;

/** Remove the isolates. For tests and for anything that will be parsed again. */
export const stripIsolates = (value: string): string => value.replace(/[⁨⁩]/g, '');

const numberFmt = new Intl.NumberFormat(NUMERIC_LOCALE);
const costFmt = new Intl.NumberFormat(NUMERIC_LOCALE, {
  style: 'currency',
  currency: COST_CURRENCY,
  minimumFractionDigits: 2,
});

/** KPI numerals, counters, job counts. Pair with `.u-nums` for tabular figures. */
export const formatNumber = (value: number, locale: Locale): string =>
  isolate(numberFmt.format(value), locale);

/** The shell cost ticker (§2.0) and LAST RUNS cost column (§2.3). */
export const formatCost = (usd: number, locale: Locale): string =>
  isolate(costFmt.format(usd), locale);

/**
 * Run durations. Deliberately not `Intl.DurationFormat` — it is not in every
 * runtime we target yet, and a duration in this product is always short and
 * always coarse: "1.4s", "2m 10s". The unit letters stay Latin in both locales
 * because they are read as symbols, like ms or km.
 */
export function formatDuration(ms: number, locale: Locale): string {
  const seconds = ms / 1000;
  if (seconds < 60) return isolate(`${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)}s`, locale);
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return isolate(s ? `${m}m ${s}s` : `${m}m`, locale);
}

/**
 * "3 minutes ago" in the LAST RUNS rows. `Intl.RelativeTimeFormat` is correct
 * in both locales including the Arabic dual ("منذ يومين"), which is exactly
 * the class of thing a hand-rolled helper gets wrong.
 */
const relativeFmt = new Map<Locale, Intl.RelativeTimeFormat>();

export function formatRelativeTime(from: Date, locale: Locale, now: Date = new Date()): string {
  let fmt = relativeFmt.get(locale);
  if (!fmt) {
    fmt = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    relativeFmt.set(locale, fmt);
  }

  const deltaSeconds = Math.round((from.getTime() - now.getTime()) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
    ['second', 1],
  ];

  for (const [unit, size] of units) {
    if (Math.abs(deltaSeconds) >= size || unit === 'second') {
      return fmt.format(Math.trunc(deltaSeconds / size), unit);
    }
  }
  return fmt.format(0, 'second');
}
