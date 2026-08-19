/**
 * REQ-DRW-DIFF-SCREEN — a reviewer is never shown less than they think they are being shown.
 *
 * Four ways that could happen, one assertion each. `diff-model.test.ts` proves the state
 * carries the facts; this suite proves the screen renders them, because a `linesWithheld: 298`
 * that nothing draws is a silent tail with extra steps.
 *
 *   1. A cut body that does not say it was cut.
 *   2. A binary file drawn as if it were empty.
 *   3. `work_product_unavailable` (410) drawn as "this run changed nothing".
 *   4. An enabled Approve that would post a verdict naming no tree.
 *   5. A first page of 8,000 line rows mounted at once — which is not a lie about the diff
 *      but is a phone that stops responding while someone is trying to read one.

 *
 *
 * ## What this suite cannot see
 *
 * - It renders the default locale only, and asserts against `en`. The Arabic screen is the
 *   largest English-in-RTL surface this app will have (§9.5) and nothing here looks at it.
 * - It never fetches. Whether `useDiffReview` maps a 409 to `refusal: 'moved'` is not
 *   asserted here — the component is handed the state directly.
 * - It does not lay out. jsdom computes no styles, so nothing here would notice the panel
 *   rendering off-screen.
 *
 * Owner: drawer-engineer · Consumes: comms/contracts/work-product.md §4.2, §4.3, §8
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DiffFile } from '@agnetos/contracts';
import { en } from '@/i18n';
import { DiffScreen, type DiffViewState } from './DiffScreen';
import type { DiffState } from './diff-model';

const file = (over: Partial<DiffFile> = {}): DiffFile => ({
  oldPath: 'src/a.ts',
  newPath: 'src/a.ts',
  status: 'modified',
  insertions: 300,
  deletions: 2,
  hunks: [
    {
      header: '@@ -1,2 +1,3 @@',
      oldStart: 1,
      oldCount: 2,
      newStart: 1,
      newCount: 3,
      lines: [
        { origin: ' ', text: 'const a = 1;' },
        { origin: '+', text: 'const b = 2;' },
        { origin: '-', text: 'const gone = 0;' },
      ],
    },
  ],
  truncated: false,
  linesWithheld: 0,
  ...over,
});

const diff = (over: Partial<DiffState> = {}): DiffState => ({
  runId: 'run-1',
  headSha: 'bbbbbbb',
  files: [file()],
  totalFiles: 1,
  nextCursor: null,
  ...over,
});

function draw(state: DiffViewState, over: Partial<Parameters<typeof DiffScreen>[0]> = {}) {
  const onVerdict = vi.fn();
  const onLoadMore = vi.fn();
  render(
    <DiffScreen
      open
      state={state}
      loadingMore={false}
      onLoadMore={onLoadMore}
      onClose={() => {}}
      note=""
      onNoteChange={() => {}}
      onVerdict={onVerdict}
      result={null}
      reviewRefusal={null}
      busy={false}
      {...over}
    />,
  );
  return { onVerdict, onLoadMore, panel: screen.getByTestId('diff-review') };
}

describe('a cut says it was cut', () => {
  it('renders the withheld count as a sentence, not as an ellipsis', () => {
    const { panel } = draw({
      kind: 'ready',
      diff: diff({ files: [file({ truncated: true, linesWithheld: 298 })] }),
    });
    expect(panel.textContent).toContain('298');
    expect(panel.textContent).toContain('further lines in this file were not sent');
  });

  it('still shows the whole change’s insertion count beside the cut body', () => {
    const { panel } = draw({
      kind: 'ready',
      diff: diff({ files: [file({ truncated: true, linesWithheld: 298, insertions: 300 })] }),
    });
    // Two lines are on screen; the change inserted three hundred, and that is the number
    // rendered. A count recomputed from what arrived is the defect this assertion names.
    expect(panel.textContent).toContain('+300');
  });

  it('says nothing about withholding when nothing was withheld', () => {
    const { panel } = draw({ kind: 'ready', diff: diff() });
    expect(panel.textContent).not.toContain('not sent');
  });
});

describe('a binary file is flagged, never drawn as empty', () => {
  it('names it and explains the absence of a body', () => {
    const { panel } = draw({
      kind: 'ready',
      diff: diff({
        files: [file({ status: 'binary', hunks: null, insertions: 0, deletions: 0 })],
      }),
    });
    expect(panel.textContent).toContain(en['work.diff.binary']);
    expect(panel.textContent).toContain(en['work.diff.status.binary']);
  });
});

describe('a diff line carries its origin as a character, not only as a colour', () => {
  it('renders + and - beside the text', () => {
    const { panel } = draw({ kind: 'ready', diff: diff() });
    const lines = [...panel.querySelectorAll('[data-origin]')];
    expect(lines).toHaveLength(3);
    expect(lines.map((l) => l.getAttribute('data-origin'))).toEqual([' ', '+', '-']);
    // The character is in the text, so a reader who cannot separate teal from coral still
    // knows which line was added. WCAG 1.4.1, on the surface where it decides an approval.
    expect(lines[1]!.textContent).toContain('+');
    expect(lines[2]!.textContent).toContain('-');
  });

  it('never strips the origin off the text — the client does not parse diffs', () => {
    const { panel } = draw({ kind: 'ready', diff: diff() });
    expect(panel.textContent).toContain('const b = 2;');
    expect(panel.textContent).toContain('const gone = 0;');
  });
});

describe('the three absences do not look alike', () => {
  it('says the tree is gone, not that nothing changed', () => {
    const { panel } = draw({ kind: 'refused', refusal: 'unavailable' });
    expect(panel.textContent).toContain(en['work.diff.unavailable']);
    expect(panel.textContent).not.toContain(en['work.diff.empty']);
  });

  it('says the tree moved, and asks for a reload rather than showing two trees as one', () => {
    const { panel } = draw({ kind: 'refused', refusal: 'moved' });
    expect(panel.textContent).toContain(en['work.diff.moved']);
    expect(panel.textContent).not.toContain(en['work.diff.unavailable']);
  });

  it('says a run changed no files when that is what happened', () => {
    const { panel } = draw({ kind: 'ready', diff: diff({ files: [], totalFiles: 0 }) });
    expect(panel.textContent).toContain(en['work.diff.empty']);
    expect(panel.textContent).not.toContain(en['work.diff.unavailable']);
  });
});

describe('the tree is named on screen and on the verdict', () => {
  it('shows the head sha the page was read from', () => {
    const { panel } = draw({ kind: 'ready', diff: diff() });
    expect(panel.textContent).toContain('bbbbbbb');
  });

  it('shows no tree while there is no page — it does not carry one over from a refusal', () => {
    const { panel } = draw({ kind: 'refused', refusal: 'moved' });
    expect(panel.textContent).not.toContain('bbbbbbb');
  });
});

describe('approve is honest about what it can do', () => {
  it('sends a verdict when the page named a tree', () => {
    const { onVerdict } = draw({ kind: 'ready', diff: diff() });
    screen.getByRole('button', { name: en['work.review.approve'] }).click();
    expect(onVerdict).toHaveBeenCalledWith('approved');
  });

  it('is disabled, with the reason, when a verdict could not name what it read', () => {
    const { onVerdict } = draw(
      { kind: 'refused', refusal: 'moved' },
      { reviewRefusal: en['work.review.noTree'] },
    );
    const approve = screen.getByRole('button', { name: en['work.review.approve'] });
    expect((approve as HTMLButtonElement).disabled).toBe(true);
    approve.click();
    expect(onVerdict).not.toHaveBeenCalled();
    // The reason is rendered, not only hovered.
    expect(screen.getByTestId('diff-review').textContent).toContain(en['work.review.noTree']);
  });

  it('says it is not a merge, on every state of the screen', () => {
    for (const state of [
      { kind: 'loading' } as const,
      { kind: 'ready', diff: diff() } as const,
      { kind: 'refused', refusal: 'unavailable' } as const,
    ]) {
      const { panel } = draw(state);
      expect(panel.textContent).toContain(en['work.review.notMerge']);
      cleanup();
    }
  });
});

describe('paging is offered only when there is another page', () => {
  it('offers more files and says how many there are in total', () => {
    const { panel, onLoadMore } = draw({
      kind: 'ready',
      diff: diff({ nextCursor: 'bbbbbbb:20', totalFiles: 40 }),
    });
    screen.getByRole('button', { name: en['work.diff.more'] }).click();
    expect(onLoadMore).toHaveBeenCalled();
    expect(panel.textContent).toContain('40 files');
  });

  it('offers nothing on the last page', () => {
    draw({ kind: 'ready', diff: diff({ nextCursor: null }) });
    expect(screen.queryByRole('button', { name: en['work.diff.more'] })).toBeNull();
  });
});

/* -----------------------------------------------------------------------------
 * The DOM bound. `MAX_DIFF_FILES_PER_PAGE = 20` × `MAX_DIFF_LINES_PER_FILE = 400` is the
 * server's own ceiling for a single page, so this is not a pathological fixture — it is the
 * largest ordinary one, and before windowing every row of it was mounted synchronously.
 *
 * These assertions are about the DOM that exists, not about which module was imported. A
 * pin on `import { windowFor }` would be satisfied by an import that is never called.
 * -------------------------------------------------------------------------- */

const bigFile = (n: number): DiffFile => ({
  oldPath: `src/f${n}.ts`,
  newPath: `src/f${n}.ts`,
  status: 'modified',
  insertions: 400,
  deletions: 0,
  hunks: [
    {
      header: `@@ -1,400 +1,400 @@ file ${n}`,
      oldStart: 1,
      oldCount: 400,
      newStart: 1,
      newCount: 400,
      lines: Array.from({ length: 400 }, (_, i) => ({
        origin: '+' as const,
        text: `f${n} line ${i}`,
      })),
    },
  ],
  truncated: false,
  linesWithheld: 0,
});

/** One full server page: 20 files × 400 lines = 8,000 line rows. */
const FULL_PAGE = Array.from({ length: 20 }, (_, n) => bigFile(n));

describe('a full page does not mount as a full page', () => {
  it('renders a small window of a 8,000-line diff instead of all of it', () => {
    const { panel } = draw({ kind: 'ready', diff: diff({ files: FULL_PAGE, totalFiles: 20 }) });

    const mounted = panel.querySelectorAll('[data-origin]').length;
    // The number that matters is the order of magnitude. Before windowing this was 8,000
    // `<div>`s and 16,000 `<span>`s, inside a panel mid-320ms-slide.
    expect(mounted).toBeGreaterThan(0);
    expect(mounted).toBeLessThan(400);
  });

  it('starts at the top of the change rather than at some arbitrary row', () => {
    const { panel } = draw({ kind: 'ready', diff: diff({ files: FULL_PAGE, totalFiles: 20 }) });

    expect(panel.textContent).toContain('src/f0.ts');
    expect(panel.textContent).toContain('f0 line 0');
    // …and nothing from the far end is mounted, which is the whole point.
    expect(panel.textContent).not.toContain('f19 line 399');
  });

  /**
   * A window is not a cut, and the difference has to be observable: the rows that are not
   * mounted must still be *reachable*. Scrolling is the mechanism, so scrolling is what is
   * asserted — not the presence of a spacer div.
   */
  it('mounts later rows when the reader scrolls to them', () => {
    const { panel } = draw({ kind: 'ready', diff: diff({ files: FULL_PAGE, totalFiles: 20 }) });

    const scroller = panel.querySelector('[data-testid="diff-scroller"]') as HTMLElement;
    expect(scroller).toBeTruthy();
    expect(panel.textContent).not.toContain('f2 line 100');

    // jsdom has no layout, so `scrollTop` is defined onto the element the way a real
    // scroll would have set it, and the same `scroll` event is then dispatched.
    // Row arithmetic, stated rather than tuned: each file is 1 head + 1 hunk header + 400
    // lines = 402 rows, and the un-measured estimate is 20px. `f2 line 100` is therefore
    // absolute row 2×402 + 2 + 100 = 906.
    Object.defineProperty(scroller, 'scrollTop', { value: 906 * 20, configurable: true });
    fireEvent.scroll(scroller);

    expect(panel.textContent).toContain('f2 line 100');
    expect(panel.textContent).not.toContain('f0 line 0');
  });

  /**
   * The scrollbar has to describe the whole diff. Without the spacers it would describe the
   * mounted window, so a 8,000-line change would look ten screens long — a claim about the
   * size of a change, made by a scrollbar.
   */
  it('holds the scroll height of the whole diff, not of the mounted window', () => {
    const { panel } = draw({ kind: 'ready', diff: diff({ files: FULL_PAGE, totalFiles: 20 }) });

    const spacers = [...panel.querySelectorAll('[aria-hidden="true"]')].filter(
      (el) => el instanceof HTMLElement && el.style.height !== '',
    ) as HTMLElement[];
    expect(spacers).toHaveLength(2);
    const padBottom = Number.parseFloat(spacers[1]!.style.height);
    // 8,000 lines + 20 heads + 20 hunk headers, minus the mounted window, at the estimate.
    expect(padBottom).toBeGreaterThan(100_000);
  });
});

describe('the hold ceiling is stated, never silent', () => {
  it('says nothing while the browser can still take another page', () => {
    const { panel } = draw({
      kind: 'ready',
      diff: diff({ files: FULL_PAGE, totalFiles: 60, nextCursor: 'bbbbbbb:20' }),
    });
    expect(panel.textContent).not.toContain('will not load more');
    expect(screen.getByRole('button', { name: en['work.diff.more'] as string }).hasAttribute('disabled')).toBe(false);
  });

  it('disables Show more with the reason once the ceiling is reached', () => {
    // Enough pages to pass MAX_DIFF_ROWS_HELD (20,000). 3 pages ≈ 25,260 rows.
    const held = [...FULL_PAGE, ...FULL_PAGE, ...FULL_PAGE];
    const { panel } = draw({
      kind: 'ready',
      diff: diff({ files: held, totalFiles: 200, nextCursor: 'bbbbbbb:60' }),
    });
    expect(screen.getByRole('button', { name: en['work.diff.more'] as string }).hasAttribute('disabled')).toBe(true);
    expect(panel.textContent).toContain('will not load more');
  });
});
