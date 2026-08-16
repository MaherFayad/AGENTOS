import { describe, expect, it } from 'vitest';

import { DEFAULT_LOCALE, NUMERIC_LOCALE, directionOf, isCursiveScript } from './config';
import { DRAWER_ANCHOR, DOES_NOT_MIRROR, MIRRORS, inlineSign } from './direction';
import { isPlural, isTodo, todo } from './entry';
import { formatCost, formatNumber, stripIsolates } from './format';
import { ar } from './strings.ar';
import { en, type StringKey } from './strings.en';
import { translate, translateParts, translationCoverage, untranslatedKeys } from './t';

describe('locale config', () => {
  it('defaults to English LTR', () => {
    expect(DEFAULT_LOCALE).toBe('en');
    expect(directionOf('en')).toBe('ltr');
    expect(directionOf('ar')).toBe('rtl');
  });

  it('treats Arabic as the cursive script and never italicises it via a locale branch', () => {
    expect(isCursiveScript('ar')).toBe(true);
    expect(isCursiveScript('en')).toBe(false);
  });

  it('keeps Western digits for both UI locales', () => {
    expect(NUMERIC_LOCALE).toBe('en-US');
  });
});

describe('direction', () => {
  it('mirrors drawers and chrome, not the galaxy or charts', () => {
    expect(MIRRORS['drawer.map']).toBeTruthy();
    expect(MIRRORS['drawer.chart']).toBeTruthy();
    expect(DOES_NOT_MIRROR['map.canvas']).toBeTruthy();
    expect(DOES_NOT_MIRROR['dashboards.charts']).toBeTruthy();
    expect(DRAWER_ANCHOR.map).toBe('inline-start');
    expect(DRAWER_ANCHOR.chart).toBe('inline-end');
  });

  it('signs the inline axis for Framer/d3 without a locale === ar check', () => {
    expect(inlineSign('rtl')).toBe(1);
    expect(inlineSign('ltr')).toBe(-1);
  });
});

describe('catalogue', () => {
  it('has an Arabic answer for every English key', () => {
    const missing = (Object.keys(en) as StringKey[]).filter((k) => !(k in ar));
    expect(missing).toEqual([]);
  });

  it('uses plural objects, not "N item(s)"', () => {
    expect(isPlural(en['chart.row.jobCount'])).toBe(true);
    expect(isPlural(ar['chart.row.jobCount'])).toBe(true);
    expect(JSON.stringify(en)).not.toMatch(/item\(s\)/);
  });

  it('admits an untranslated string instead of guessing, and does not punish admitting it', () => {
    expect(isTodo(ar['drawer.action.take'])).toBe(true);
    expect(untranslatedKeys('ar')).toContain('drawer.action.take');

    // This assertion used to be `toEqual(['drawer.action.take'])`, pinning the gap
    // set to exactly one entry. `design-system-guardian` found the trap that
    // creates: filing an honest `todo()` broke the suite for the agent who filed
    // it, so the cheapest way to a green build was to GUESS a translation — in a
    // catalogue whose own header says a confident wrong translation is the worse
    // failure, because the gap gets fixed and the wrong one gets quoted back at
    // you in a client meeting. The lock pointed the incentive at the thing it was
    // written to prevent.
    //
    // What is worth locking is the opposite property: the gap must stay small and
    // must stay *visible*. A ceiling does that; an equality does not.
    expect(untranslatedKeys('ar').length).toBeLessThanOrEqual(5);
    expect(translationCoverage('ar')).toBeGreaterThan(0.95);
  });
});

describe('translate', () => {
  it('selects the Arabic dual', () => {
    expect(translate('ar', 'chart.row.jobCount', { count: 2 })).toBe('مهمّتان');
  });

  it('does not concatenate fragments — one key is one sentence', () => {
    const parts = translateParts('en', 'dashboards.subtitle');
    expect(parts.some((p) => p.accent)).toBe(true);
    expect(parts.map((p) => p.text).join('')).toContain('when the work runs itself');
  });

  it('bidi-isolates every interpolated value in an RTL locale', () => {
    // `design-system-guardian` asked whether an interpolated commit SHA needs its
    // own isolation inside an Arabic provenance label. It does — a Latin hex run
    // inside an RTL sentence is the same reordering bug `format.ts` already fixes
    // for numbers — and the answer is here rather than as isolation marks typed
    // into the catalogue, which translators delete, reorder and forget.
    const label = translate('ar', 'provenance.badge.fork', { commit: '4e0bbe6' });
    expect(label).toContain('⁨4e0bbe6⁩');
    expect(stripIsolates(label)).toBe('نسخة متفرّعة 4e0bbe6');

    // English is untouched — no invisible characters in an LTR string.
    expect(translate('en', 'provenance.badge.fork', { commit: '4e0bbe6' })).toBe('Fork 4e0bbe6');

    // FIRST STRONG, not LEFT-TO-RIGHT: an Arabic-valued variable keeps its own
    // direction, which is what makes applying this to every value safe rather
    // than merely convenient.
    expect(stripIsolates(translate('ar', 'map.node.open', { name: 'إثراء الحسابات' }))).toBe(
      'فتح إثراء الحسابات',
    );
  });

  it('moves the Arabic accent onto the words that carry it', () => {
    const parts = translateParts('ar', 'dashboards.subtitle');
    const accent = parts.find((p) => p.accent);
    expect(accent?.text).toBe('حين يُدير العمل نفسه');
  });
});

describe('numerals', () => {
  it('formats Western digits and isolates them in Arabic', () => {
    expect(stripIsolates(formatNumber(12.4, 'en'))).toBe('12.4');
    const arNum = formatNumber(12.4, 'ar');
    expect(arNum.startsWith('\u2068')).toBe(true);
    expect(stripIsolates(arNum)).toBe('12.4');
  });

  it('formats USD the same way in both locales', () => {
    expect(stripIsolates(formatCost(12.4, 'ar'))).toBe(stripIsolates(formatCost(12.4, 'en')));
  });
});

describe('todo()', () => {
  it('is enumerable, not silent', () => {
    const gap = todo('Take it');
    expect(isTodo(gap)).toBe(true);
    expect(gap.todo).toBe('Take it');
  });
});
