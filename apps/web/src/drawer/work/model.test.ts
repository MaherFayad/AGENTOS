/**
 * REQ-DRW-WORK-EVIDENCE — a value nothing observed is never drawn as one.
 *
 * `contracts/work-product.md` §0 grades every capability, and §7 gives the rule for the two
 * that matter here: *"`PR #42 · CI green` — `structural`. Render them; claim nothing observed
 * them."* This suite is that rule as a gate.
 *
 * ## Why this reads the contract file and not a constant
 *
 * The newest costume of the house defect, and it happened in this repo last night: **a pin
 * comparing two declarations is satisfiable by a lie.** The thread-id pin held a contract
 * against a constant and stayed green when the constant was flipped with the consumer still
 * dead. So the assertion below runs **the normative contract text** against **the cells
 * `rosterCells` actually emits** for a populated payload. One side is prose somebody has to
 * edit deliberately; the other side is behaviour. Neither is a copy of the other.
 *
 * ## What this suite cannot see, written down rather than assumed
 *
 * - It reads §0's table only. A grading stated anywhere else in the contract — in §5, in a
 *   footnote, in `api-contracts.md` — is invisible to it. The blindness guards below fail
 *   loudly if that table stops parsing, which converts "silently sees nothing" into "fails";
 *   they cannot convert it into "sees everywhere".
 * - It says nothing about the **rendering**. A cell graded `recorded` here could still be
 *   painted like an observation. `RosterLine.test.tsx` is the half that looks at the DOM.
 * - It cannot tell a correct grading from a coincidence on a field the contract does not
 *   name. Fields outside §0's structural row are only checked in one direction: they may not
 *   claim to be `recorded`.
 *
 * Owner: drawer-engineer · Consumes: comms/contracts/work-product.md §0, §5.1, §7
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { WorkProductSummary } from '@agnetos/contracts';
import { EVIDENCE_MAY_CARRY_DATA_INK, prNumberOf, rosterCells } from './model';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..');
const CONTRACT = resolve(repoRoot, 'comms/contracts/work-product.md');

const NOW = Date.parse('2026-08-19T12:00:00.000Z');

/** Everything populated, and every structural value carrying **good news** on purpose. */
const FULL: WorkProductSummary = {
  runId: 'run-1',
  agent: 'sales/account-enrichment',
  threadId: 'thread-1',
  branch: 'agnetos/run/run-1',
  baseSha: 'aaaaaaa',
  headSha: 'bbbbbbb',
  commits: 3,
  filesChanged: 4,
  insertions: 40,
  deletions: 7,
  pushState: 'local',
  pushCheckedAt: '2026-08-19T11:56:00.000Z',
  prUrl: 'https://example.invalid/o/r/pull/42',
  prState: 'open',
  ciState: 'passing',
  testsRun: 12,
  testsPassed: 12,
  diffAvailable: true,
  createdAt: '2026-08-19T11:56:00.000Z',
};

const cellsOf = (summary: WorkProductSummary) => rosterCells(summary, { now: NOW });
const byField = (summary: WorkProductSummary) =>
  new Map(cellsOf(summary).map((cell) => [cell.field, cell]));

/* ------------------------------------------------------------------------ *
 * The contract, parsed — with the guards that make a zero mean zero.
 * ------------------------------------------------------------------------ */

interface StructuralRow {
  columns: string[];
  /** The columns the same row exempts as observed, e.g. `push_state`. */
  observed: string[];
}

function structuralRow(): StructuralRow {
  const text = readFileSync(CONTRACT, 'utf8');
  const section = text.slice(text.indexOf('## 0.'), text.indexOf('## 1.'));
  const rows = section
    .split(/\r?\n/)
    .filter((line) => line.trimStart().startsWith('|'))
    .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()));
  // A table that stops parsing must fail, not pass with nothing to check. §0 has a header,
  // a separator and six claim rows at the time of writing.
  expect(rows.length).toBeGreaterThanOrEqual(6);

  const structural = rows.filter((cells) => /\bstructural\b/.test(cells[1] ?? ''));
  expect(structural.length).toBeGreaterThanOrEqual(1);

  const columns = structural.flatMap((cells) =>
    [...(cells[0] ?? '').matchAll(/`([a-z][a-z_]*\*?)`/g)].map((m) => m[1]),
  );
  const observed = structural.flatMap((cells) =>
    [...(cells[2] ?? '').matchAll(/`([a-z][a-z_]*)`\s+is\s+\*observed\*/g)].map((m) => m[1]),
  );
  return { columns, observed };
}

const snakeToCamel = (name: string): string => name.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

/** `tests_*` → every summary field whose camel name starts with `tests`. */
function expand(column: string, summary: WorkProductSummary): (keyof WorkProductSummary)[] {
  const keys = Object.keys(summary) as (keyof WorkProductSummary)[];
  if (column.endsWith('*')) {
    // `tests_*` → `tests`. The trailing separator has to go before the camel conversion, or
    // the prefix is `tests_`, nothing matches, and the assertion below examines two fewer
    // fields while still passing. Caught by the `checked` floor rather than by reading.
    const prefix = snakeToCamel(column.slice(0, -1).replace(/_$/, ''));
    return keys.filter((key) => key.startsWith(prefix));
  }
  const camel = snakeToCamel(column) as keyof WorkProductSummary;
  return keys.includes(camel) ? [camel] : [];
}

describe('the contract is readable and its §0 table still parses', () => {
  it('can see the file it makes a claim about', () => {
    expect(existsSync(CONTRACT)).toBe(true);
    expect(readFileSync(CONTRACT, 'utf8').length).toBeGreaterThan(2000);
  });

  it('finds columns in the structural row, and the one it exempts as observed', () => {
    const { columns, observed } = structuralRow();
    // Not "contains ci_state" — that would be the test naming the thing it is supposed to
    // discover. Non-empty, and every entry resolving to a real payload field, is the
    // property that makes the assertions below mean something.
    expect(columns.length).toBeGreaterThanOrEqual(4);
    expect(columns.flatMap((c) => expand(c, FULL)).length).toBeGreaterThanOrEqual(5);
    // Exactly one column in that row is called out as observed. If the contract reworded
    // this, the exemption below would silently widen, so it fails here instead.
    expect(observed).toHaveLength(1);
  });
});

describe('evidence grading, checked against the contract rather than against a copy of it', () => {
  it('never grades a contract-structural field as observed', () => {
    const { columns, observed } = structuralRow();
    const cells = cellsOf(FULL);
    const exempt = new Set(observed.map(snakeToCamel));

    const offenders: string[] = [];
    let checked = 0;
    for (const column of columns) {
      for (const field of expand(column, FULL)) {
        if (exempt.has(field)) continue;
        for (const cell of cells) {
          if (!cell.sources.includes(field)) continue;
          checked += 1;
          if (cell.evidence === 'observed') offenders.push(`${cell.field} draws ${field}`);
        }
      }
    }
    // A loop that examined nothing passes trivially. This is the same blindness guard the
    // rest of the suite carries, applied to the assertion itself.
    expect(checked).toBeGreaterThanOrEqual(4);
    expect(offenders).toEqual([]);
  });

  it('grades nothing as recorded that the contract did not name', () => {
    const { columns } = structuralRow();
    const named = new Set(columns.flatMap((c) => expand(c, FULL)));
    const overclaimed = cellsOf(FULL)
      .filter((cell) => cell.evidence === 'recorded')
      .flatMap((cell) => cell.sources.filter((source) => !named.has(source)).map((s) => `${cell.field}:${s}`));
    // The direction that stops the cheap way out. Marking every cell "recorded" would
    // satisfy the assertion above and tell a reader nothing; this refuses it.
    expect(overclaimed).toEqual([]);
  });

  it('draws every structural column that carries a value — none is quietly dropped', () => {
    const { columns } = structuralRow();
    const drawn = new Set(cellsOf(FULL).flatMap((cell) => [...cell.sources]));
    const missing = columns
      .flatMap((c) => expand(c, FULL))
      .filter((field) => !drawn.has(field));
    expect(missing).toEqual([]);
  });
});

describe('push state — the fourth value is null, and it is the news', () => {
  it('renders unknown with a reason, never "nothing to push"', () => {
    const cell = byField({ ...FULL, pushState: null, pushCheckedAt: null }).get('pushState');
    expect(cell?.evidence).toBe('unknown');
    expect(cell?.key).toBe('work.push.unknown');
    expect(cell?.whyKey).toBe('work.push.unknownWhy');
    // The specific confusion the contract forbids: `null` must not become `none`.
    expect(cell?.key).not.toBe('work.push.none');
  });

  it('carries the observation time when something did look', () => {
    const cell = byField(FULL).get('pushState');
    expect(cell?.evidence).toBe('observed');
    expect(cell?.key).toBe('work.push.local');
    expect(cell?.whyKey).toBe('work.push.observedAt');
    expect(cell?.whyVars?.time).toBe('4m ago');
  });

  it('states "nothing to push" only when something looked and found nothing', () => {
    const cell = byField({ ...FULL, pushState: 'none' }).get('pushState');
    expect(cell?.key).toBe('work.push.none');
    expect(cell?.evidence).toBe('observed');
  });
});

describe('absent optional values collapse silently', () => {
  const bare: WorkProductSummary = {
    ...FULL,
    prUrl: null,
    prState: null,
    ciState: null,
    testsRun: null,
    testsPassed: null,
  };

  it('draws no PR, CI or tests cell at all — no dash, no "N/A"', () => {
    const fields = cellsOf(bare).map((cell) => cell.field);
    expect(fields).not.toContain('prNumber');
    expect(fields).not.toContain('prState');
    expect(fields).not.toContain('ciState');
    expect(fields).not.toContain('tests');
  });

  it('still draws the observed half of the line', () => {
    const fields = cellsOf(bare).map((cell) => cell.field);
    expect(fields).toEqual(expect.arrayContaining(['branch', 'commits', 'files', 'lines', 'age']));
  });

  it('needs both test counts before it will draw either', () => {
    expect(byField({ ...bare, testsRun: 12 }).has('tests')).toBe(false);
    expect(byField({ ...bare, testsPassed: 12 }).has('tests')).toBe(false);
  });
});

describe('a removed worktree is not a run that changed nothing', () => {
  it('says the tree is gone', () => {
    const cell = byField({ ...FULL, diffAvailable: false }).get('diffAvailable');
    expect(cell?.key).toBe('work.diffGone');
    // Observed: `worktree_removed_at` is a real timestamp written by a real removal.
    expect(cell?.evidence).toBe('observed');
  });

  it('says nothing at all while the tree is readable', () => {
    expect(byField(FULL).has('diffAvailable')).toBe(false);
  });
});

describe('blocked has one representation and it is the thread state', () => {
  it('draws nothing when nothing told us — the roster route does not carry it', () => {
    expect(byField(FULL).has('blocked')).toBe(false);
    expect(rosterCells(FULL, { now: NOW, threadState: null }).some((c) => c.field === 'blocked')).toBe(
      false,
    );
  });

  it('draws it when a run said its thread is waiting', () => {
    const cells = rosterCells(FULL, { now: NOW, threadState: 'waiting' });
    expect(cells.find((c) => c.field === 'blocked')?.key).toBe('work.blocked');
  });

  it('does not claim blocked for any other thread state', () => {
    for (const state of ['open', 'running', 'closed', 'failed'] as const) {
      expect(rosterCells(FULL, { now: NOW, threadState: state }).some((c) => c.field === 'blocked')).toBe(
        false,
      );
    }
  });
});

describe('the PR number is derived only when the derivation cannot be wrong', () => {
  it('reads a trailing all-digits segment', () => {
    expect(prNumberOf('https://example.invalid/o/r/pull/42')).toBe('#42');
    expect(prNumberOf('https://example.invalid/o/r/pull/42/')).toBe('#42');
  });

  it('returns null rather than guessing at any other shape', () => {
    expect(prNumberOf('https://example.invalid/o/r/merge_requests/abc')).toBeNull();
    expect(prNumberOf('https://example.invalid/o/r/pulls')).toBeNull();
    expect(prNumberOf(null)).toBeNull();
  });

  it('draws no PR-number cell when it could not read one, and still draws the state', () => {
    const cells = byField({ ...FULL, prUrl: 'https://example.invalid/o/r/pulls' });
    expect(cells.has('prNumber')).toBe(false);
    expect(cells.get('prState')?.evidence).toBe('recorded');
  });
});

describe('elapsed time is derived here, not sent', () => {
  it('comes from createdAt and the clock the caller supplies', () => {
    expect(byField(FULL).get('age')?.text).toBe('4m ago');
    expect(byField({ ...FULL, createdAt: '2026-08-19T09:00:00.000Z' }).get('age')?.text).toBe('3h ago');
  });
});

describe('colour is only ever spent on an observation', () => {
  it('permits data ink for observed values and refuses it for the other two', () => {
    expect(EVIDENCE_MAY_CARRY_DATA_INK.observed).toBe(true);
    expect(EVIDENCE_MAY_CARRY_DATA_INK.recorded).toBe(false);
    expect(EVIDENCE_MAY_CARRY_DATA_INK.unknown).toBe(false);
  });
});
