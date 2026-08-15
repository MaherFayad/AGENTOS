import { describe, expect, it } from 'vitest';

import { DEFAULT_LOCALE, NUMERIC_LOCALE, directionOf, isCursiveScript } from './config';
import { DRAWER_ANCHOR, DOES_NOT_MIRROR, MIRRORS, inlineSign } from './direction';
import { isPlural, isTodo, todo } from './entry';
import { formatCost, formatNumber, stripIsolates } from './format';
import { ar } from './strings.ar';
import { en, type StringKey } from './strings.en';
import { translate, translateParts, untranslatedKeys } from './t';

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

  it('admits the one untranslated idiom instead of guessing', () => {
    expect(isTodo(ar['drawer.action.take'])).toBe(true);
    expect(untranslatedKeys('ar')).toEqual(['drawer.action.take']);
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
