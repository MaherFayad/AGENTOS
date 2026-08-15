import { describe, expect, it } from 'vitest';
import { fuzzyMatch, highlightSegments, search, type SearchItem } from './search';

const items: SearchItem[] = [
  {
    id: 'sales/account-enrichment',
    kind: 'agent',
    label: 'Account Enrichment',
    description: 'Appends firmographics and tech stack to a raw account row.',
    department: 'sales',
    href: '/map/sales/account-enrichment',
    live: true,
  },
  {
    id: 'sales/database-mining',
    kind: 'agent',
    label: 'Database Mining',
    description: 'Finds dormant accounts worth re-opening.',
    department: 'sales',
    href: '/map/sales/database-mining',
  },
  {
    id: 'marketing/content-calendar',
    kind: 'agent',
    label: 'Content Calendar',
    description: 'Plans the week of posts.',
    department: 'marketing',
    href: '/map/marketing/content-calendar',
  },
  { id: 'sales', kind: 'department', label: 'Sales', href: '/map/sales' },
  { id: 'pipeline', kind: 'panel', label: 'Sales Pipeline', href: '/dashboards/pipeline' },
];

describe('fuzzyMatch', () => {
  it('matches a non-contiguous subsequence', () => {
    expect(fuzzyMatch('acen', 'Account Enrichment')).not.toBeNull();
  });

  it('returns null when a character is missing', () => {
    expect(fuzzyMatch('zz', 'Account Enrichment')).toBeNull();
  });

  it('is case-insensitive', () => {
    expect(fuzzyMatch('ACCOUNT', 'account enrichment')).not.toBeNull();
  });

  it('scores a prefix above a mid-word hit', () => {
    const prefix = fuzzyMatch('data', 'Database Mining');
    const middle = fuzzyMatch('data', 'Refresh the database nightly');
    expect(prefix?.score ?? 0).toBeGreaterThan(middle?.score ?? 0);
  });

  it('rewards an acronym across word boundaries', () => {
    const acronym = fuzzyMatch('ae', 'Account Enrichment');
    expect(acronym?.ranges).toEqual([
      [0, 1],
      [8, 9],
    ]);
  });

  it('reports contiguous ranges for highlighting', () => {
    expect(fuzzyMatch('acc', 'Account Enrichment')?.ranges).toEqual([[0, 3]]);
  });
});

describe('search', () => {
  it('returns nothing for an empty query rather than guessing', () => {
    expect(search(items, '')).toEqual([]);
    expect(search(items, '   ')).toEqual([]);
  });

  it('ranks a label match above a description-only match', () => {
    const results = search(items, 'account');
    expect(results[0]?.item.id).toBe('sales/account-enrichment');
    // "Account Enrichment" also appears in no other label; the description hit on
    // Database Mining must not outrank it.
    expect(results[0]?.ranges.length).toBeGreaterThan(0);
  });

  it('searches descriptions too', () => {
    const results = search(items, 'dormant');
    expect(results.map((result) => result.item.id)).toContain('sales/database-mining');
  });

  it('finds an agent by acronym', () => {
    expect(search(items, 'ae')[0]?.item.id).toBe('sales/account-enrichment');
  });

  it('honours the limit', () => {
    expect(search(items, 'a', { limit: 2 })).toHaveLength(2);
  });

  it('carries the href a result navigates to', () => {
    expect(search(items, 'sales pipeline')[0]?.item.href).toBe('/dashboards/pipeline');
  });
});

describe('highlightSegments', () => {
  it('splits a label into matched and unmatched runs', () => {
    expect(highlightSegments('Account Enrichment', [[0, 3]])).toEqual([
      { text: 'Acc', matched: true },
      { text: 'ount Enrichment', matched: false },
    ]);
  });

  it('returns the whole label when nothing matched', () => {
    expect(highlightSegments('Account', [])).toEqual([{ text: 'Account', matched: false }]);
  });
});
