import { describe, expect, it } from 'vitest';
import { rosterFrom, UNCOUNTED_ROSTER } from './roster';
import type { SearchItem } from '@/lib/search';

/**
 * REQ-SES-58.
 *
 * The whole value of this module is what it refuses to answer. Three different
 * facts want to become the number `0` here — a department nobody declared, an
 * index that did not load, and a department that genuinely has no members — and
 * only the last one is a measurement.
 */

const dept = (id: string): SearchItem => ({ id, kind: 'department', label: id, href: '/map' });
const agent = (department: string, slug: string): SearchItem => ({
  id: `${department}/${slug}`,
  kind: 'agent',
  label: slug,
  department,
  href: '/map',
});
const panel = (id: string): SearchItem => ({ id, kind: 'panel', label: id, href: '/dashboards' });

describe('rosterFrom', () => {
  it('counts a department’s agents and ignores everything else', () => {
    const roster = rosterFrom(
      [dept('sales'), agent('sales', 'a'), agent('sales', 'b'), panel('revenue')],
      true,
    );
    expect(roster.get('sales')).toBe(2);
    expect(roster.has('revenue')).toBe(false);
  });

  it('counts NOTHING when the index has not loaded', () => {
    // The failure this prevents: an index that failed to load carries a sentence
    // and no items, which looks exactly like a project with no agents. Counting
    // it would hand `addressCost` a `0` and produce `{ runs: 0, runsAreExact:
    // true }` — an *exactly zero* claim assembled out of an absence.
    const roster = rosterFrom([dept('sales'), agent('sales', 'a')], false);
    expect(roster.size).toBe(0);
    expect(roster.get('sales')).toBeUndefined();
  });

  it('gives no entry to a department the index never declared', () => {
    // An agent filed under a department with no department item. Inventing the
    // department here would be a third copy of the graph's own answer, and the
    // copy is the one that goes stale.
    const roster = rosterFrom([dept('sales'), agent('legal', 'contracts')], true);
    expect(roster.has('legal')).toBe(false);
    expect(roster.get('sales')).toBe(0);
  });

  it('keeps a declared department with no members as a measured zero', () => {
    // This one IS a number: the graph declared the department and reported no
    // agents in it. `undefined` and `0` are the two answers this module has, and
    // they are different on purpose.
    const roster = rosterFrom([dept('sales')], true);
    expect(roster.get('sales')).toBe(0);
  });

  it('UNCOUNTED_ROSTER is empty, which is the honest state before anything loads', () => {
    expect(UNCOUNTED_ROSTER.size).toBe(0);
  });
});
