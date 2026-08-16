/* =============================================================================
 * i18n/t.ts — the translator. Framework-free so the runner, scripts and tests
 * can use it too.
 *
 * Owner: rtl-arabic-pdpl-specialist · Spec §1.4.
 * ============================================================================= */

import { DEFAULT_LOCALE, type Locale } from './config';
import { isolate } from './format';
import { isPlural, isTodo, type Entry } from './entry';
import { en, type StringKey } from './strings.en';
import { ar } from './strings.ar';

export type { StringKey };

const CATALOGUES: Record<Locale, Record<string, Entry>> = { en, ar };

export type Vars = Readonly<Record<string, string | number>>;

/**
 * `{name}` → the matching var. An unmatched placeholder is left visible on
 * purpose: a stray `{count}` in a screenshot is a bug report; a silently
 * emptied one is a mystery.
 *
 * EVERY INTERPOLATED VALUE IS BIDI-ISOLATED IN AN RTL LOCALE, and that is the
 * answer to a question `design-system-guardian` asked about one string
 * (`'نسخة متفرّعة {commit}'` — a Latin hex run inside an Arabic sentence).
 *
 * Answering it per-string would have meant isolation marks typed into the
 * catalogue, which is a thing translators delete, reorder and forget. Answering
 * it here covers `{commit}`, `{parent}`, `{name}`, `{id}`, `{query}`, `{tool}`,
 * `{amount}` and every future one, in both catalogues, with no call site
 * knowing. It is the same decision `format.ts` already made for numbers, moved
 * one layer up so it applies to values the formatters never see.
 *
 * `isolate()` uses U+2068 FIRST STRONG ISOLATE, so an Arabic-valued variable is
 * unaffected — the isolate takes the direction of the first strong character in
 * the value itself. Applying it to everything is therefore safe rather than
 * merely convenient, and nesting it inside an already-isolated number is a no-op.
 *
 * Nothing should ever parse the result. `stripIsolates()` exists for tests and
 * for anything that will be read back.
 */
const interpolate = (locale: Locale, template: string, vars?: Vars): string =>
  vars
    ? template.replace(/\{(\w+)\}/g, (m, k: string) =>
        k in vars ? isolate(String(vars[k]), locale) : m,
      )
    : template;

const pluralRules = new Map<Locale, Intl.PluralRules>();
const rulesFor = (locale: Locale): Intl.PluralRules => {
  let r = pluralRules.get(locale);
  if (!r) {
    r = new Intl.PluralRules(locale);
    pluralRules.set(locale, r);
  }
  return r;
};

/**
 * Resolve one entry to a string.
 *
 * Count selection uses `Intl.PluralRules`, which knows that Arabic has six
 * classes and English two. This is the whole reason the catalogue holds
 * objects rather than "1 run / N runs" — see entry.ts.
 */
const resolve = (locale: Locale, entry: Entry, vars?: Vars): string => {
  if (isTodo(entry)) return interpolate(locale, entry.todo, vars);

  if (isPlural(entry)) {
    const count = Number(vars?.count ?? 0);
    const category = count === 0 && entry.zero !== undefined ? 'zero' : rulesFor(locale).select(count);
    const chosen = entry[category as keyof typeof entry] ?? entry.other;
    return interpolate(locale, String(chosen), vars);
  }

  return interpolate(locale, entry, vars);
};

/**
 * Translate. Falls back to English rather than to the key: a user staring at
 * `drawer.section.buildsOn` learns nothing, a user staring at "Builds on"
 * learns almost everything.
 */
export function translate(locale: Locale, key: StringKey, vars?: Vars): string {
  const entry = CATALOGUES[locale]?.[key] ?? CATALOGUES[DEFAULT_LOCALE][key];
  if (entry === undefined) {
    if (process.env.NODE_ENV !== 'production') {
      throw new Error(`i18n: unknown key "${key}"`);
    }
    return key;
  }
  return resolve(locale, entry, vars);
}

/* -----------------------------------------------------------------------------
 * Accent phrases.
 *
 * `[[double brackets]]` mark the emphasised phrase inside a headline (§1.4 —
 * "the italic serif inside bold sans headlines is THE brand signature").
 * The marker travels with the sentence, so a translator can move the emphasis
 * onto whichever words carry it in their language, and no component ever
 * concatenates two catalogue keys to build one headline.
 *
 * In Latin the accent renders as Instrument Serif italic. In Arabic it renders
 * as WEIGHT CONTRAST — never obliqued, because Arabic has no italic form.
 * That difference is one CSS rule in rtl.css, not a branch in a component.
 * -------------------------------------------------------------------------- */
export interface AccentPart {
  readonly text: string;
  readonly accent: boolean;
}

export function translateParts(locale: Locale, key: StringKey, vars?: Vars): AccentPart[] {
  const full = translate(locale, key, vars);
  const parts: AccentPart[] = [];
  let cursor = 0;

  for (const match of full.matchAll(/\[\[(.+?)\]\]/g)) {
    const at = match.index ?? 0;
    if (at > cursor) parts.push({ text: full.slice(cursor, at), accent: false });
    parts.push({ text: match[1], accent: true });
    cursor = at + match[0].length;
  }
  if (cursor < full.length) parts.push({ text: full.slice(cursor), accent: false });

  return parts.length ? parts : [{ text: full, accent: false }];
}

/* -----------------------------------------------------------------------------
 * Gap reporting. A translation gap should be a number on a dashboard, not a
 * discovery in a client demo.
 * -------------------------------------------------------------------------- */
export const untranslatedKeys = (locale: Locale): StringKey[] =>
  (Object.keys(en) as StringKey[]).filter((k) => {
    const entry = CATALOGUES[locale]?.[k];
    return entry === undefined || isTodo(entry);
  });

export const translationCoverage = (locale: Locale): number => {
  const total = Object.keys(en).length;
  return total === 0 ? 1 : (total - untranslatedKeys(locale).length) / total;
};
