/**
 * REQ-DRW-WORK-ROSTER — the half of the evidence rule that `model.test.ts` cannot see.
 *
 * `model.test.ts` checks the grading against the contract. A grading nothing renders is a
 * comment. This suite reads the DOM and the stylesheet, and asserts the three ways a
 * recorded value could still reach a reader as an observed one:
 *
 *   1. the qualifier lives only in a `title`, which AT drops and a phone cannot hover;
 *   2. the qualifier is per-cell only, so a reader who inspects nothing sees `CI passing`
 *      and nothing else;
 *   3. the value is painted in data ink, where the colour out-argues any sentence beside it.
 *
 * ## What this suite cannot see
 *
 * - It renders in the default locale. It says nothing about the Arabic line, whose cells
 *   contain the same numbers in a right-to-left flow (§9.5 is `rtl-arabic-pdpl-specialist`'s).
 * - The stylesheet assertions are textual. They prove the declarations in
 *   `drawer.module.css`, not the computed colour after a cascade — jsdom does not lay this
 *   out, and no test here would notice a rule in another file overriding one of these.
 * - It asserts nothing about the diff origin colours, which ARE data ink deliberately.
 *
 * Owner: drawer-engineer · Consumes: comms/contracts/work-product.md §0, §5.1, §7
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { WorkProductSummary } from '@agnetos/contracts';
import { en } from '@/i18n';
import { RosterLine } from './RosterLine';

// Resolved from the Vitest root, like `drawer-contrast.test.ts` — under jsdom the module
// URL is not a `file:` URL and `fileURLToPath` throws.
const CSS = readFileSync(resolve(process.cwd(), 'src/drawer/drawer.module.css'), 'utf8');

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

const NOW = Date.parse('2026-08-19T12:00:00.000Z');

function draw(summary: WorkProductSummary, threadHref: string | null = '/p/agentos/threads/thread-1') {
  const onReview = vi.fn();
  render(
    <RosterLine summary={summary} now={NOW} onReview={onReview} threadHref={threadHref} />,
  );
  return { onReview, line: screen.getByTestId(`work-product-${summary.runId}`) };
}

/** Every text node not inside an `aria-hidden` subtree — what a screen reader reads. */
function accessibleText(root: Element): string {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      for (let el = node.parentElement; el && el !== root.parentElement; el = el.parentElement) {
        if (el.getAttribute('aria-hidden') === 'true') return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const out: string[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) out.push(n.textContent ?? '');
  return out.join(' ').replace(/\s+/g, ' ').trim();
}

const cell = (line: Element, field: string) => line.querySelector(`[data-field="${field}"]`);

describe('a recorded value is rendered, and nothing claims it was observed', () => {
  it('renders the good news it was given — the rule is not to hide it', () => {
    const { line } = draw(FULL);
    expect(accessibleText(line)).toContain(en['work.ci.passing']);
    expect(accessibleText(line)).toContain('#42');
  });

  it('marks every structural cell as recorded in the DOM', () => {
    const { line } = draw(FULL);
    for (const field of ['prNumber', 'prState', 'ciState', 'tests']) {
      expect(cell(line, field), field).not.toBeNull();
      expect(cell(line, field)!.getAttribute('data-evidence'), field).toBe('recorded');
    }
  });

  it('puts the qualifier in the accessible tree, not only in a title', () => {
    const { line } = draw(FULL);
    const ci = cell(line, 'ciState')!;
    expect(ci.getAttribute('title')).toBe(en['work.recordedWhy']);
    // The assertion that matters: a reader who cannot hover still gets the sentence.
    expect(accessibleText(ci)).toContain(en['work.recordedWhy']);
  });

  it('states it once for the whole line, visibly, for the reader who inspects nothing', () => {
    const { line } = draw(FULL);
    expect(line.querySelectorAll('p')).toHaveLength(1);
    expect(line.querySelector('p')!.textContent).toBe(en['work.recordedWhy']);
  });

  it('says nothing about recording when the line has nothing recorded on it', () => {
    const { line } = draw({
      ...FULL,
      prUrl: null,
      prState: null,
      ciState: null,
      testsRun: null,
      testsPassed: null,
    });
    // The collapse rule: no empty header, no "N/A", and no caveat about values that are
    // not on screen. A caveat with nothing to qualify is noise that trains people to skip it.
    expect(line.querySelector('p')).toBeNull();
    expect(accessibleText(line)).not.toContain(en['work.recordedWhy']);
  });
});

describe('colour is only ever spent on an observation', () => {
  /** The four data-ink tokens. A structural cell may reference none of them. */
  const DATA_INK = /var\(--ink-(teal|coral|amber|copper)\)/;

  function block(selector: string): string {
    const bare = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
    const found = [...bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find(
      (m) => m[1].trim().replace(/\s+/g, ' ') === selector,
    );
    // A selector that stopped existing must fail here, not vanish from the check. This is
    // the blindness guard: a renamed class would otherwise make the assertions below pass
    // over nothing at all.
    expect(found, `${selector} should exist in drawer.module.css`).toBeDefined();
    return found![2];
  }

  it('paints a recorded cell in monochrome, one step quieter than the numbers', () => {
    const recorded = block(".workCell[data-evidence='recorded']");
    const observed = block(".workCell[data-evidence='observed']");
    expect(recorded).not.toMatch(DATA_INK);
    // `--ivory-2` under `--ivory`, and NOT `--ink-2` under `--ivory-2`. The rung gap is
    // opened from above (tokens contract §9.4b) because `.workRow:hover` fills `--card-2`,
    // where light `--ink-2` is 4.25:1 — and everything a qualified cell says is required
    // reading. `hover-row-contrast.test.tsx` is the gate that enforces that generally.
    // Anchored, not `toContain`: `var(--ivory)` is a substring of `var(--ivory-2)`, so a
    // `toContain` here would pass with both tiers on the same token and the rung gap gone —
    // "a substring is a claim you did not narrow", on the assertion that exists to keep them
    // apart. Falsified by setting both to `--ivory-2`.
    expect(recorded).toMatch(/color:\s*var\(--ivory-2\);/);
    expect(observed).toMatch(/color:\s*var\(--ivory\);/);
    expect(recorded).not.toContain('var(--ink-2)');
  });

  it('paints an unknown cell in monochrome too, and distinguishes it without colour', () => {
    const recorded = block(".workCell[data-evidence='recorded']");
    const unknown = block(".workCell[data-evidence='unknown']");
    expect(unknown).not.toMatch(DATA_INK);
    // Distinguishable by something that is not hue — dotted versus dashed — because a
    // reader who cannot separate the two colours still has to separate the two claims.
    expect(recorded).toContain('dotted');
    expect(unknown).toContain('dashed');
  });

  it('renders no status dot on the roster line — a dot is a colour-only claim', () => {
    const { line } = draw(FULL);
    expect(line.querySelectorAll('[data-status]')).toHaveLength(0);
  });
});

describe('push state, on screen', () => {
  it('renders unknown with its reason, and never the reassuring word', () => {
    const { line } = draw({ ...FULL, pushState: null, pushCheckedAt: null });
    const push = cell(line, 'pushState')!;
    expect(push.getAttribute('data-evidence')).toBe('unknown');
    expect(accessibleText(push)).toContain(en['work.push.unknown']);
    expect(accessibleText(push)).toContain(en['work.push.unknownWhy']);
    expect(accessibleText(push)).not.toContain(en['work.push.none']);
  });

  it('renders the observation time beside a state something did look at', () => {
    const { line } = draw(FULL);
    expect(accessibleText(cell(line, 'pushState')!)).toContain('4m ago');
  });
});

describe('the controls tell the truth about what they can do', () => {
  it('opens the review screen for a readable tree', () => {
    const { onReview } = draw(FULL);
    screen.getByRole('button', { name: en['work.review.open'] }).click();
    expect(onReview).toHaveBeenCalledWith(FULL);
  });

  it('disables review with the reason when the worktree is gone', () => {
    const { line } = draw({ ...FULL, diffAvailable: false });
    const button = screen.getByRole('button', { name: en['work.review.open'] });
    // `toBeDisabled` is jest-dom, which this app does not install. The property is the
    // assertion anyway, and reading it directly is one fewer dependency to justify.
    expect((button as HTMLButtonElement).disabled).toBe(true);
    // Not "there is no diff" — that would read as a run that changed nothing.
    expect(button.getAttribute('title')).toBe(en['work.diffGone']);
    expect(accessibleText(line)).toContain(en['work.diffGone']);
  });

  it('links to the run’s thread', () => {
    draw(FULL);
    expect(screen.getByText(en['work.thread.open']).getAttribute('href')).toBe(
      '/p/agentos/threads/thread-1',
    );
  });

  it('renders no link at all when the address bar names no project', () => {
    // Not a link to the unscoped legacy path: a `null` project means *do not ask*, and a
    // href into `/threads/:id` with no project segment is asking.
    draw(FULL, null);
    expect(screen.queryByText(en['work.thread.open'])).toBeNull();
  });
});
