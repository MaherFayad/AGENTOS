/**
 * The diff review screen's state — paging, the tree pin, and the two refusals.
 *
 * `comms/contracts/work-product.md` §4.3. The server parses; **the client never parses diff
 * text**, and there is nothing in this file that looks at a line's characters. `origin` is a
 * field on `DiffLine`, not a marker to strip, precisely so that a second parser with a
 * different author cannot exist on this side of the seam.
 *
 * ## Two axes, and both of them are declared
 *
 * Files paginate (`MAX_DIFF_FILES_PER_PAGE = 20`, server-side); lines inside a file are cut
 * at `MAX_DIFF_LINES_PER_FILE = 400` and the cut says so — `truncated: true`,
 * `linesWithheld: n`. This module carries both through untouched, and in particular it never
 * recomputes a file's `insertions` from the lines it received: a cut body must not shrink the
 * number beside it, or a reviewer reads "+3" over a change that inserted three hundred.
 *
 * ## The tree pin is enforced here too, on purpose
 *
 * The server refuses a cursor presented against a different `head_sha` with
 * `work_product_moved` (409). `appendPage` refuses the same thing again, on the client, and
 * that is not redundancy for its own sake: this is the process holding the pages a human is
 * about to read as one change, and *"serving page 2 from a tree that moved shows a reviewer a
 * diff that never existed as a whole, and then asks them to approve it."* A duplicated
 * refusal on the side that owns the consequence is cheap; discovering that the server's was
 * bypassed by a retry, a cache or a future route is not.
 *
 * Owner: drawer-engineer · Consumes: comms/contracts/work-product.md §4.3
 */

import type { DiffFile, DiffPage } from '@agnetos/contracts';

export interface DiffState {
  runId: string;
  /** The tree every file in `files` was read from. Every page must agree with it. */
  headSha: string;
  files: DiffFile[];
  /** From the server, on **every** page — a file list that cannot say how many files there
   * are cannot be read in two seconds. Never derived from `files.length`. */
  totalFiles: number;
  /** Opaque. `null` on the last page. Passed back verbatim; never constructed here. */
  nextCursor: string | null;
}

export function firstPage(page: DiffPage): DiffState {
  return {
    runId: page.runId,
    headSha: page.headSha,
    files: page.files,
    totalFiles: page.totalFiles,
    nextCursor: page.nextCursor,
  };
}

export type AppendResult =
  | { ok: true; state: DiffState }
  /** The page came from a different tree. Nothing is merged, and the reader is told. */
  | { ok: false; refusal: 'moved' };

export function appendPage(state: DiffState, page: DiffPage): AppendResult {
  if (page.headSha !== state.headSha) return { ok: false, refusal: 'moved' };
  return {
    ok: true,
    state: {
      ...state,
      files: [...state.files, ...page.files],
      // The server sends `totalFiles` on every page; take the newest rather than keeping the
      // first, so a count that changed is visible instead of frozen at what page 1 believed.
      totalFiles: page.totalFiles,
      nextCursor: page.nextCursor,
    },
  };
}

/** A stable key for a file row. A rename is one row with both paths, so both are in the key. */
export function fileKey(file: DiffFile, index: number): string {
  return `${index}:${file.oldPath ?? ''}→${file.newPath ?? ''}`;
}

/**
 * What to call a file, given that either path may be `null`.
 *
 * A rename is **one** row carrying both, and it is drawn as both: `old → new`. Showing only
 * the new path would silently lose the fact that a file moved, which on a review screen is
 * one of the changes most worth seeing.
 */
export function filePathLabel(file: DiffFile): string {
  if (file.oldPath && file.newPath && file.oldPath !== file.newPath) {
    return `${file.oldPath} → ${file.newPath}`;
  }
  return file.newPath ?? file.oldPath ?? '';
}
