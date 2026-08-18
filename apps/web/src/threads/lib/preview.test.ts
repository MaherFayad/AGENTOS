import { describe, expect, it } from 'vitest';
import { addressCost, type ResolvedThreadAddress } from '@agnetos/contracts';
import { previewLine } from './preview';
import { rosterFrom, UNCOUNTED_ROSTER } from './roster';
import type { SearchItem } from '@/lib/search';

/**
 * REQ-SES-57…60.
 *
 * `Plan §12`: *"a UI that makes broadcast easy to trigger accidentally will cost
 * real money on the first day."* Everything below asserts one of two things —
 * **what the preview counts**, and **what it refuses to count** — because both
 * halves are load-bearing and only the first one is obvious.
 */

const dept = (id: string): SearchItem => ({ id, kind: 'department', label: id, href: `/map/${id}` });
const agent = (department: string, slug: string): SearchItem => ({
  id: `${department}/${slug}`,
  kind: 'agent',
  label: slug,
  department,
  href: `/map/${department}/${slug}`,
});

/** Sales with four members — `Plan §23.8`'s own example. */
const SALES = rosterFrom(
  [
    dept('sales'),
    agent('sales', 'account-enrichment'),
    agent('sales', 'outreach'),
    agent('sales', 'qualification'),
    agent('sales', 'handoff'),
    dept('finance'),
  ],
  true,
);

describe('previewLine — the count is real and the money is not', () => {
  it('has no field anywhere that could hold a money figure', () => {
    const preview = previewLine('@@sales go', SALES);
    const cost = preview.cost;
    // Narrowed rather than cast, on purpose: a cast would draw its own error and
    // the `@ts-expect-error` below would be *consumed by the cast* instead of by
    // the assignment — a directive that fires for the wrong reason is a gate that
    // has never been red for the reason it claims.
    if (cost === null || cost === 'unresolved') throw new Error('a fan-out with a counted roster has a cost');

    // `TurnCost.estimatedUsd` is typed `null` so a money figure stops the file
    // compiling. `npm run typecheck:tests` reads this file, so the directive is
    // live: the day someone widens the type, this becomes an *unused
    // `@ts-expect-error`*, which is itself an error, and the diff that widens it
    // is the diff that has to say where the number came from.
    //
    // Falsified 2026-08-18: deleting this directive produces
    // `preview.test.ts(53,11): error TS2322: Type 'null' is not assignable to
    // type 'number'` and `typecheck:tests` exits 2. It is a live gate, not a
    // decoration — which the web suite's directives were until this morning.
    // @ts-expect-error a money figure must not be assignable out of TurnCost.
    const forbidden: number = cost.estimatedUsd;
    void forbidden;

    // The value-level half, over every branch: no key on the preview holds a
    // number that is not a run count.
    expect(JSON.stringify(preview)).not.toMatch(/[$£€]/);
    expect(cost).toMatchObject({ estimatedUsd: null, estimateBasis: 'no-completed-runs' });
  });

  it('counts @@ from the resolved roster and calls it exact', () => {
    const preview = previewLine('@@sales ship it', SALES);
    expect(preview.cost).toMatchObject({ runs: 4, runsAreExact: true });
    expect(preview.needsFanOutConfirm).toBe(true);
  });

  it('refuses to count @@ when nobody has counted — never a zero', () => {
    const preview = previewLine('@@sales ship it', UNCOUNTED_ROSTER);
    // Not `{ runs: 0 }`. A department that resolved and has no members, and a
    // roster nobody read, are two different facts; `AddressBadge` draws
    // `'unresolved'` with no numeral at all so the absence of a figure is the
    // signal. This is the assertion that would have caught the defect the
    // contract removed by deleting `memberCount`'s default.
    expect(preview.cost).toBe('unresolved');
    expect(preview.needsFanOutConfirm).toBe(true);
  });

  it('prints # as a LOWER BOUND, because the lead may delegate', () => {
    const preview = previewLine('#sales look at this', SALES);
    // `Plan §23.8` says `#sales` "says 1 run". It does not: the lead answers *or
    // delegates*, and a delegation is a second run. A flat "1 run" beside a
    // mechanism that routinely costs two is a plausible number one decimal place
    // up — the same defect as a plausible zero.
    expect(preview.cost).toMatchObject({ runs: 1, runsAreExact: false });
    expect(preview.needsFanOutConfirm).toBe(false);
  });

  it('prints a bare line as a lower bound too — the Chief of Staff routes', () => {
    expect(previewLine('do the thing', SALES).cost).toMatchObject({
      runs: 1,
      runsAreExact: false,
    });
  });

  it('costs a complete @ address exactly once and an incomplete one not at all', () => {
    expect(previewLine('@sales/outreach hi', SALES).cost).toMatchObject({
      runs: 1,
      runsAreExact: true,
    });
    // `@outreach` is legal to type and is not yet an address: the parser returns
    // `department: null` rather than picking, because picking runs an agent the
    // human did not mean. A count for a recipient nobody has chosen is a count
    // for nothing.
    expect(previewLine('@outreach hi', SALES).cost).toBe('unresolved');
  });

  it('never disagrees with addressCost — the composer computes nothing of its own', () => {
    const cases: Array<[string, ResolvedThreadAddress, number]> = [
      ['@sales/outreach x', { form: 'direct', department: 'sales', slug: 'outreach' }, 0],
      ['#sales x', { form: 'dispatch', department: 'sales' }, 0],
      ['@@sales x', { form: 'fan-out', department: 'sales' }, 4],
      ['x', { form: 'default' }, 0],
    ];
    for (const [line, address, members] of cases) {
      expect(previewLine(line, SALES).cost).toEqual(addressCost(address, members));
    }
  });
});

describe('previewLine — refusals and hints', () => {
  it('surfaces the parser refusal verbatim rather than rewriting it', () => {
    const preview = previewLine('&sales hello', SALES);
    expect(preview.address).toBeNull();
    expect(preview.cost).toBeNull();
    expect(preview.refusal?.code).toBe('unknown_sigil');
    // The token is carried so the UI can point at it — the contract's reason for
    // the field, and the reason this is not re-derived here.
    expect(preview.refusal?.token).toBe('&sales');
  });

  it('reports a department the map does not have — but only when it counted something', () => {
    expect(previewLine('#legal x', SALES).unknownDepartment).toBe('legal');
    // With nothing counted, "missing" would be an absence rendered as a finding.
    expect(previewLine('#legal x', UNCOUNTED_ROSTER).unknownDepartment).toBeNull();
    expect(previewLine('#sales x', SALES).unknownDepartment).toBeNull();
  });

  it('treats an empty line as nothing to say rather than as an error', () => {
    const preview = previewLine('   ', SALES);
    expect(preview.address).toBeNull();
    expect(preview.refusal).toBeNull();
    expect(preview.cost).toBeNull();
  });

  it('only @@ raises the confirm', () => {
    for (const line of ['@sales/outreach x', '#sales x', 'x', '&bad x']) {
      expect(previewLine(line, SALES).needsFanOutConfirm).toBe(false);
    }
    expect(previewLine('@@sales x', SALES).needsFanOutConfirm).toBe(true);
  });
});
