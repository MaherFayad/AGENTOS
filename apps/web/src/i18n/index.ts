/* =============================================================================
 * i18n — the string layer. Import from here, never from a sibling file.
 *
 * Owner: rtl-arabic-pdpl-specialist · Spec §1.4, Part VI row 8.
 *
 *   import { useI18n } from '@/i18n';
 *   const { t, num, dir } = useI18n();
 *   <button>{t('drawer.action.run')}</button>
 *
 * Adding copy: put it in strings.en.ts and give strings.ar.ts the same key
 * (`todo('English')` is an acceptable answer; a guess is not). TypeScript
 * fails the build if the Arabic catalogue is missing a key, so the gap can
 * never be silent.
 *
 * `scripts/check-rtl.mjs` fails on user-facing text typed straight into a
 * component. That is not bureaucracy: a string in a component is a string
 * nobody can translate, and every one of them has to be hunted down later by
 * somebody reading JSX line by line.
 * ============================================================================= */

export {
  LOCALES,
  DEFAULT_LOCALE,
  DIRECTION,
  HTML_LANG,
  NUMERIC_LOCALE,
  COST_CURRENCY,
  isLocale,
  directionOf,
  isCursiveScript,
  type Locale,
  type Direction,
} from './config';

export { todo, isTodo, isPlural, type Plural, type Todo, type Entry } from './entry';

export {
  translate,
  translateParts,
  untranslatedKeys,
  translationCoverage,
  type StringKey,
  type Vars,
  type AccentPart,
} from './t';

export {
  isolate,
  stripIsolates,
  formatNumber,
  formatCost,
  formatDuration,
  formatRelativeTime,
} from './format';

export {
  MIRRORS,
  DOES_NOT_MIRROR,
  DRAWER_ANCHOR,
  mirrors,
  inlineSign,
  inlineSignFor,
  type MirroredSurface,
  type FixedSurface,
  type DrawerAnchor,
} from './direction';

export { I18nProvider, useI18n, useT, Accented, type I18n } from './provider';

export { en } from './strings.en';
export { ar } from './strings.ar';
