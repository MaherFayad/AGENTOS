/* =============================================================================
 * i18n/config.ts — locales, direction, and the numeral policy.
 *
 * Owner: rtl-arabic-pdpl-specialist · Spec §1.4 (Arabic note), Part VI row 8.
 *
 * Arabic ships after English. The reason this file exists on day one anyway is
 * that every string written into a component today is a string somebody has to
 * dig back out later. Retrofitting the string layer costs more than writing it
 * now, and retrofitting RTL costs more than both.
 * ============================================================================= */

export const LOCALES = ['en', 'ar'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

export type Direction = 'ltr' | 'rtl';

/** The only place a locale is mapped to a writing direction. */
export const DIRECTION: Readonly<Record<Locale, Direction>> = {
  en: 'ltr',
  ar: 'rtl',
};

/**
 * The `lang` attribute value handed to the DOM. Kept separate from `Locale`
 * because `:lang(ar)` selectors in rtl.css key off this, and because a future
 * `ar-SA` region variant must not break the CSS.
 */
export const HTML_LANG: Readonly<Record<Locale, string>> = {
  en: 'en',
  ar: 'ar',
};

/**
 * NUMERALS — Western digits in both locales, deliberately.
 *
 * Arabic-Indic digits (٠١٢٣) are correct MSA typography for prose, but this is
 * an operations console: KPI tiles, cost tickers, run durations and chart axes
 * are all `tabular-nums` and are read against each other down a column. Mixing
 * numeral systems between locales would mean the same dashboard has two
 * different column widths and two different glyph rhythms.
 *
 * So: one numeric locale for both UI locales. If the human asks for
 * Arabic-Indic digits later, change this constant and nothing else — that is
 * the whole reason it is a constant.
 */
export const NUMERIC_LOCALE = 'en-US';

/** Currency for the shell cost ticker (§2.0). Langfuse reports USD. */
export const COST_CURRENCY = 'USD';

export const isLocale = (value: unknown): value is Locale =>
  typeof value === 'string' && (LOCALES as readonly string[]).includes(value);

export const directionOf = (locale: Locale): Direction => DIRECTION[locale];

/**
 * True when the locale's script is cursive (connected). Callers use this to
 * decide *typographic* behaviour, never layout behaviour — layout is decided by
 * `dir`, which the browser already knows.
 *
 * The two rules it gates (§1.4):
 *   1. no italics — Arabic has no italic form; use weight contrast
 *   2. no letter-spacing — tracking severs the joins between letters
 */
export const isCursiveScript = (locale: Locale): boolean => locale === 'ar';
