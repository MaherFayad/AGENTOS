/* =============================================================================
 * i18n/entry.ts — what a catalogue value is allowed to be.
 *
 * Owner: rtl-arabic-pdpl-specialist · Spec §1.4.
 *
 * Three shapes, and no fourth:
 *   'a sentence'                 a complete, translatable sentence
 *   { other: '…', many: '…' }    a count-bearing sentence, one per plural class
 *   todo('english fallback')     an admitted gap, rendered in English
 *
 * What is NOT allowed, anywhere, ever: a sentence assembled at the call site
 * from two catalogue keys. English tolerates `t('a') + ' ' + t('b')`; Arabic
 * does not, because the second half may belong before the first half, and
 * because the joining word inflects. A sentence is a unit of translation.
 * ============================================================================= */

/**
 * One string per CLDR plural class. `other` is required; the rest are optional
 * and fall back to it.
 *
 * English uses two classes (one / other). Arabic uses all six, and they map
 * exactly onto the grammar a native reader expects:
 *   zero  0        لا وكلاء
 *   one   1        وكيل واحد
 *   two   2        وكيلان            (the dual — English has no equivalent)
 *   few   3–10     ٣ وكلاء            (plural, genitive)
 *   many  11–99    ١١ وكيلًا           (singular, accusative)
 *   other 100+     ١٠٠ وكيل           (singular, genitive)
 *
 * This is why "N item(s)" is banned rather than discouraged: there is no
 * parenthesised suffix that makes those six lines correct.
 */
export interface Plural {
  readonly zero?: string;
  readonly one?: string;
  readonly two?: string;
  readonly few?: string;
  readonly many?: string;
  readonly other: string;
}

/**
 * An untranslated key. Renders the English text, and is enumerable — so a gap
 * is a number on a report, not a surprise in a screenshot.
 *
 * A confidently wrong translation is worse than a visible gap: the gap gets
 * fixed, the wrong one gets shipped and quoted back at you in a client meeting.
 */
export interface Todo {
  readonly todo: string;
}

export type Entry = string | Plural | Todo;

export const todo = (english: string): Todo => ({ todo: english });

export const isTodo = (e: Entry): e is Todo =>
  typeof e === 'object' && e !== null && 'todo' in e;

export const isPlural = (e: Entry): e is Plural =>
  typeof e === 'object' && e !== null && 'other' in e;

/**
 * A translated catalogue must answer every key the English one asks, with a
 * compatible shape: a plural stays a plural (or admits it is a `todo`). Missing
 * or reshaped keys are a compile error, which is cheaper than a test.
 */
export type EntryFor<T extends Entry> = T extends Plural ? Plural | Todo : string | Todo;
