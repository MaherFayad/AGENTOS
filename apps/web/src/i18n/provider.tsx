'use client';

/* =============================================================================
 * i18n/provider.tsx — the React surface. One context, one hook.
 *
 * Owner: rtl-arabic-pdpl-specialist · Spec §1.4.
 *
 * Deliberately not a library. `next-intl` and friends bring routing opinions,
 * a message compiler and a bundle; Part V says no component library and the
 * same reasoning applies here — this product is 1px borders and type
 * discipline, and its i18n need is a lookup table with plural rules that the
 * platform already ships (`Intl.PluralRules`).
 * ============================================================================= */

import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { DEFAULT_LOCALE, HTML_LANG, directionOf, type Direction, type Locale } from './config';
import { formatCost, formatDuration, formatNumber, formatRelativeTime } from './format';
import { inlineSign } from './direction';
import { translate, translateParts, type AccentPart, type StringKey, type Vars } from './t';

export interface I18n {
  readonly locale: Locale;
  readonly dir: Direction;
  readonly lang: string;
  /** +1 in RTL, −1 in LTR — for Framer/d3 offsets only (see direction.ts). */
  readonly sign: 1 | -1;
  readonly t: (key: StringKey, vars?: Vars) => string;
  /** Headlines with an `[[accent]]` phrase (§1.4). */
  readonly tParts: (key: StringKey, vars?: Vars) => AccentPart[];
  readonly num: (value: number) => string;
  readonly cost: (usd: number) => string;
  readonly duration: (ms: number) => string;
  readonly since: (date: Date) => string;
}

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({
  locale = DEFAULT_LOCALE,
  children,
}: {
  locale?: Locale;
  children: ReactNode;
}) {
  const value = useMemo<I18n>(() => {
    const dir = directionOf(locale);
    return {
      locale,
      dir,
      lang: HTML_LANG[locale],
      sign: inlineSign(dir),
      t: (key, vars) => translate(locale, key, vars),
      tParts: (key, vars) => translateParts(locale, key, vars),
      num: (value) => formatNumber(value, locale),
      cost: (usd) => formatCost(usd, locale),
      duration: (ms) => formatDuration(ms, locale),
      since: (date) => formatRelativeTime(date, locale),
    };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * The hook every component uses.
 *
 * It throws outside a provider rather than silently defaulting to English,
 * because a component rendering English inside an Arabic page is the exact
 * failure this whole layer exists to prevent, and a thrown error in dev is
 * cheaper than finding it in a screenshot.
 */
export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>.');
  return ctx;
}

/** Shorthand for the common case. */
export const useT = (): I18n['t'] => useI18n().t;

/**
 * Renders a headline whose accent phrase is marked `[[like this]]`.
 *
 * Latin: Instrument Serif italic + `tracking-accent` (§1.4 — the brand signature).
 * Arabic: the same phrase in heavier weight, upright and untracked. Both come
 * from `.u-accent` in styles/rtl.css plus the token utility; this component
 * does not branch on locale and no component ever should.
 */
export function Accented({ k, vars }: { k: StringKey; vars?: Vars }) {
  const { tParts } = useI18n();
  return (
    <>
      {tParts(k, vars).map((part, i) =>
        part.accent ? (
          <em key={i} className="u-accent tracking-accent">
            {part.text}
          </em>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}
