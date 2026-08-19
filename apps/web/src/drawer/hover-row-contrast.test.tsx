/**
 * REQ-DRW-CONTRAST-HOVER — nothing rendered inside a row that fills `--card-2` on hover may
 * be painted in a token that goes sub-AA there.
 *
 * ## The finding this generalises
 *
 * `design-system-guardian` re-ruled `.runMetaAbsent` on 20260816-2145 and, while re-measuring,
 * found the thing neither of us had flagged: **`.runRow:hover` fills `--card-2`**, and light
 * `--ink-2` measures **4.25:1** there — sub-AA at the exact moment the reader is most likely
 * to be reading the row. `drawer-contrast.test.ts` was green throughout, because it asserts
 * `--ink-2` against `--bg` only and said so.
 *
 * Their housekeeping note asked me not to let a green assertion imply more than it checks.
 * This file is the answer, and it is deliberately not a second hand-written list: a list of
 * classes-inside-hover-rows is a declaration, and a declaration goes stale the day someone
 * adds a fourteenth cell. **So both halves are derived** —
 *
 *   - the hover rows come from the stylesheet: every rule whose selector carries `:hover` and
 *     whose body fills `var(--card-2)`;
 *   - the classes inside them come from **rendering the components** and walking the DOM.
 *
 * A cell added to either row next month is covered without anyone editing this file, which is
 * the property the `--ink-3` allowlist next door does not have and cannot.
 *
 * The remedy, when it fires, is tokens contract **§9.4b**: *when "a caveat sits one rung below
 * the value it qualifies" collides with the AA floor, raise the value — never lower the
 * caveat.* The caveat is required reading; the gap gets opened from above.
 *
 * ## What this suite cannot see
 *
 * - **Only these two rows.** It renders `LastRuns` and `RosterLine`. A third hover row
 *   elsewhere in the drawer is invisible to it — but the *derivation* below fails loudly if
 *   the stylesheet grows a hover row this file does not render, which converts that blind
 *   spot into a red rather than a silence.
 * - **Only `drawer.module.css`.** A colour set in another stylesheet, inline, or by a
 *   primitive's own Tailwind classes is not read here. `Pill` and `Chip` are the token
 *   owner's and carry their own tests.
 * - **It measures nothing.** It refuses two tokens by name. The numbers behind that refusal
 *   are in `drawer-contrast.test.ts`, and §9.5's fix for `--ink-2` is ADR-011, still
 *   `proposed`. If ADR-011 lands and light `--ink-2` clears AA on `--card-2`, this file
 *   should be relaxed deliberately — not quietly.
 *
 * Owner: drawer-engineer · Consumes: comms/contracts/design-tokens.md §9.4b, §9.5
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { WorkProductSummary } from '@agnetos/contracts';
import type { RunRow } from './data/types';
import { LastRuns } from './sections/LastRuns';
import { RosterLine } from './work/RosterLine';

const CSS = readFileSync(resolve(process.cwd(), 'src/drawer/drawer.module.css'), 'utf8');

/** Tokens that are below WCAG AA on `--card-2` in at least one theme (§9.5). */
const SUB_AA_ON_CARD_2 = ['--ink-2', '--ink-3'];

interface Rule {
  selector: string;
  body: string;
}

function rules(): Rule[] {
  const bare = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    selector: m[1].trim().replace(/\s+/g, ' '),
    body: m[2],
  }));
}

/** The `color:` declared in a rule body, or `null`. */
function colourIn(body: string): string | null {
  const m = /(?:^|[;\s])color:\s*(var\(--[\w-]+\))/.exec(body);
  return m ? m[1] : null;
}

interface HoverRow {
  cls: string;
  /**
   * The colour the SAME rule sets alongside the fill, if any.
   *
   * This distinction is the difference between a gate and a nuisance, and it cost a false
   * positive to learn: `.close:hover` fills `--card-2` **and** raises `color` to `--ivory` in
   * one rule, so its base `--ink-2` is never painted on that fill. Reading the base class
   * alone reported it as a violation of a state that does not exist. The cascade is what is
   * being asserted, so the cascade is what has to be read.
   */
  hoverColour: string | null;
}

/** Every class whose `:hover` fills `--card-2`. Derived, so a new one arrives on its own. */
function hoverRows(): HoverRow[] {
  const found = new Map<string, HoverRow>();
  for (const r of rules()) {
    if (!r.selector.includes(':hover')) continue;
    if (!/background:\s*var\(--card-2\)/.test(r.body)) continue;
    const base = r.selector.replace(/:hover.*$/, '').trim();
    if (!/^\.[A-Za-z][\w-]*$/.test(base)) continue;
    found.set(base.slice(1), { cls: base.slice(1), hoverColour: colourIn(r.body) });
  }
  return [...found.values()];
}

const hoverRowClasses = (): string[] => hoverRows().map((r) => r.cls);

/**
 * `_workRecorded_75b240` → `workRecorded`.
 *
 * CSS-module class names are hashed by the bundler, and the test needs the authored name to
 * look the rule up. Vitest's transform uses `_<name>_<hash>`; anything that does not match is
 * returned unchanged so a Tailwind utility from a primitive falls through rather than
 * silently becoming a lookup miss.
 */
function unhash(token: string): string {
  const m = /^_(.+)_[0-9a-z]+$/.exec(token);
  return m ? m[1] : token;
}

/** The colour a class is painted, from its plain `.class { }` rule, or `null`. */
function colourOf(authored: string): string | null {
  const rule = rules().find((r) => r.selector === `.${authored}`);
  return rule ? colourIn(rule.body) : null;
}

const RUN: RunRow = {
  runId: 'run-1',
  status: 'ok',
  startedAt: '2026-08-19T11:56:00.000Z',
  durationMs: 4200,
  // `undefined`, not `null` — `RunRow` spells absence that way, and `npm run typecheck:tests`
  // is what said so. Vitest does not typecheck, so this fixture ran green while being wrong.
  costUsd: undefined,
  costSource: 'unpriced',
  traceUrl: undefined,
};

const SUMMARY: WorkProductSummary = {
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
  pushState: null,
  pushCheckedAt: null,
  prUrl: 'https://example.invalid/o/r/pull/42',
  prState: 'open',
  ciState: 'passing',
  testsRun: 12,
  testsPassed: 12,
  diffAvailable: true,
  createdAt: '2026-08-19T11:56:00.000Z',
};

/** Every authored class name on every element inside the rendered tree. */
function classesIn(root: Element): string[] {
  const out = new Set<string>();
  for (const el of [root, ...root.querySelectorAll('*')]) {
    for (const token of el.className.toString().split(/\s+/).filter(Boolean)) {
      out.add(unhash(token));
    }
  }
  return [...out];
}

describe('every element that fills --card-2 on hover, derived from the stylesheet', () => {
  it('finds them, and finds more than the two rows this file renders', () => {
    const found = hoverRowClasses();
    // A derivation that found nothing would make the assertion below pass over an empty
    // set. This is the blindness guard; it is what makes the derivation safe to trust.
    expect(found.length).toBeGreaterThanOrEqual(2);
    expect(found).toContain('runRow');
    expect(found).toContain('workRow');
  });

  it('paints none of them in a token that goes sub-AA on the fill they apply', () => {
    // Complete over the stylesheet, unlike the DOM walk below: chips, the close button and
    // the composer levels all fill `--card-2` under the pointer too, and each of them is a
    // control whose own label is required reading. This checks their own colour; the walk
    // below is what reaches the *descendants* of the two rows, which is where the defect
    // `design-system-guardian` found actually lived.
    const offenders = hoverRows()
      // The hover rule's own colour wins; the base rule's is only what is painted when the
      // hover rule does not set one. Anything else asserts a state the cascade never enters.
      .map((r) => ({ cls: r.cls, colour: r.hoverColour ?? colourOf(r.cls) }))
      .filter((c) => c.colour !== null && SUB_AA_ON_CARD_2.some((t) => c.colour!.includes(t)))
      .map((c) => `${c.cls}: ${c.colour}`);
    expect(offenders).toEqual([]);
  });
});

describe('nothing inside a hover row is painted in a token that goes sub-AA there', () => {
  function offenders(root: Element): string[] {
    return classesIn(root)
      .map((cls) => ({ cls, colour: colourOf(cls) }))
      .filter((c) => c.colour !== null && SUB_AA_ON_CARD_2.some((t) => c.colour!.includes(t)))
      .map((c) => `${c.cls}: ${c.colour}`);
  }

  it('LAST RUNS — including the unpriced caveat, which is the one that was wrong', () => {
    const { container } = render(<LastRuns state={{ kind: 'ready', rows: [RUN] }} />);
    const row = container.querySelector('[class*="runRow"]');
    expect(row, 'a run row should have rendered').not.toBeNull();
    expect(offenders(row!)).toEqual([]);
  });

  it('the M17 roster line — including the recorded and unknown qualifiers', () => {
    const { container } = render(
      <RosterLine
        summary={SUMMARY}
        now={Date.parse('2026-08-19T12:00:00.000Z')}
        onReview={() => {}}
        threadHref={null}
      />,
    );
    const row = container.querySelector('[class*="workRow"]');
    expect(row, 'a work-product row should have rendered').not.toBeNull();
    // Every cell: branch, commits, files, lines, the unknown push state, PR number, PR
    // state, CI state, tests, age — plus the line-level qualifier sentence. All of it is on
    // a surface that fills `--card-2` under the pointer.
    expect(offenders(row!)).toEqual([]);
  });

  it('would catch it — the walk really does reach the cells', () => {
    const { container } = render(
      <RosterLine
        summary={SUMMARY}
        now={Date.parse('2026-08-19T12:00:00.000Z')}
        onReview={() => {}}
        threadHref={null}
      />,
    );
    const row = container.querySelector('[class*="workRow"]')!;
    // Not a tautology and not decoration: an assertion over an empty class set passes, and
    // an `offenders()` that resolved nothing to a colour would too. This proves the walk
    // reaches real rules with real colours in them.
    const resolved = classesIn(row).filter((cls) => colourOf(cls) !== null);
    expect(resolved.length).toBeGreaterThanOrEqual(3);
    expect(resolved).toContain('workRecorded');
  });
});
