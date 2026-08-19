/**
 * REQ-DRW-DIFF-PIN — two pages of a diff are one change, or they are not shown as one.
 *
 * `contracts/work-product.md` §4.3. A worktree is a live directory, and *"serving page 2 from
 * a tree that moved shows a reviewer a diff that never existed as a whole, and then asks them
 * to approve it."* The server refuses that with `work_product_moved` (409); this suite is the
 * client refusing it a second time, on the side that owns the consequence.
 *
 * ## What this suite cannot see
 *
 * - It never contacts the runner. It proves that a page from another tree is not merged; it
 *   proves nothing about whether the server ever sends one. `worktree.test.ts` owns that.
 * - It says nothing about rendering. `DiffScreen.test.tsx` is the half that checks a
 *   truncated file announces its cut.
 * - `nextCursor` is opaque, so this suite deliberately asserts round-trip preservation and
 *   never asserts a format. A test that pinned `<sha>:<index>` would be a second copy of the
 *   server's paging living in the client, which is what §4.3 forbids.
 *
 * Owner: drawer-engineer · Consumes: comms/contracts/work-product.md §4.3
 */

import { describe, expect, it } from 'vitest';
import type { DiffFile, DiffPage } from '@agnetos/contracts';
import { appendPage, fileKey, filePathLabel, firstPage } from './diff-model';

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
      ],
    },
  ],
  truncated: false,
  linesWithheld: 0,
  ...over,
});

const page = (over: Partial<DiffPage> = {}): DiffPage => ({
  runId: 'run-1',
  headSha: 'bbbbbbb',
  files: [file()],
  totalFiles: 40,
  nextCursor: 'bbbbbbb:20',
  ...over,
});

describe('the tree pin', () => {
  it('merges a page from the same tree', () => {
    const result = appendPage(firstPage(page()), page({ files: [file({ newPath: 'src/b.ts' })], nextCursor: null }));
    expect(result.ok).toBe(true);
    expect(result.ok && result.state.files).toHaveLength(2);
    expect(result.ok && result.state.nextCursor).toBeNull();
  });

  it('refuses a page from a different tree, and merges nothing', () => {
    const held = firstPage(page());
    const result = appendPage(held, page({ headSha: 'ccccccc' }));
    expect(result).toEqual({ ok: false, refusal: 'moved' });
    // The pages already read are untouched. A refusal that half-applied would be worse than
    // the merge it refused.
    expect(held.files).toHaveLength(1);
    expect(held.headSha).toBe('bbbbbbb');
  });
});

describe('totalFiles comes from the server, on every page', () => {
  it('is never derived from how many files arrived', () => {
    const state = firstPage(page({ files: [file()], totalFiles: 40 }));
    expect(state.totalFiles).toBe(40);
    expect(state.files).toHaveLength(1);
  });

  it('takes the newest count rather than freezing what page 1 believed', () => {
    const result = appendPage(firstPage(page({ totalFiles: 40 })), page({ totalFiles: 41 }));
    expect(result.ok && result.state.totalFiles).toBe(41);
  });
});

describe('the cursor is opaque and travels back verbatim', () => {
  it('preserves a cursor of any shape, including one this client could not construct', () => {
    const odd = 'not:a:sha:at:all/%20?#';
    expect(firstPage(page({ nextCursor: odd })).nextCursor).toBe(odd);
    const result = appendPage(firstPage(page()), page({ nextCursor: odd }));
    expect(result.ok && result.state.nextCursor).toBe(odd);
  });
});

describe('a cut body never shrinks the number beside it', () => {
  it('keeps the file’s own insertion count when its lines were withheld', () => {
    const cut = file({ truncated: true, linesWithheld: 298, insertions: 300 });
    const state = firstPage(page({ files: [cut] }));
    // Two lines arrived; the change inserted three hundred. Recomputing from what arrived
    // is the declared-value defect in diff clothing.
    expect(state.files[0]!.hunks![0]!.lines).toHaveLength(2);
    expect(state.files[0]!.insertions).toBe(300);
    expect(state.files[0]!.linesWithheld).toBe(298);
  });
});

describe('a binary file is carried through flagged, never as bytes', () => {
  it('keeps hunks null and counts zero', () => {
    const binary = file({ status: 'binary', hunks: null, insertions: 0, deletions: 0 });
    const state = firstPage(page({ files: [binary] }));
    expect(state.files[0]!.hunks).toBeNull();
    expect(state.files[0]!.status).toBe('binary');
  });
});

describe('a rename is one row with both paths, and both are shown', () => {
  it('labels it old → new', () => {
    expect(filePathLabel(file({ oldPath: 'src/a.ts', newPath: 'src/b.ts', status: 'renamed' }))).toBe(
      'src/a.ts → src/b.ts',
    );
  });

  it('labels an add and a delete by the path that exists', () => {
    expect(filePathLabel(file({ oldPath: null, newPath: 'src/new.ts', status: 'added' }))).toBe('src/new.ts');
    expect(filePathLabel(file({ oldPath: 'src/old.ts', newPath: null, status: 'deleted' }))).toBe('src/old.ts');
  });

  it('keys a rename distinctly from either of its paths alone', () => {
    const renamed = file({ oldPath: 'src/a.ts', newPath: 'src/b.ts', status: 'renamed' });
    const added = file({ oldPath: null, newPath: 'src/b.ts', status: 'added' });
    expect(fileKey(renamed, 0)).not.toBe(fileKey(added, 0));
  });
});
