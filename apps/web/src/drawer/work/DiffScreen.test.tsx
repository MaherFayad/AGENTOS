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

import { cleanup, render, screen } from '@testing-library/react';
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
