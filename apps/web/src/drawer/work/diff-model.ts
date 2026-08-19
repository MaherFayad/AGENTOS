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

import type { DiffFile, DiffLine, DiffPage } from '@agnetos/contracts';

/**
 * How many rows the browser will hold across all loaded pages before it stops accepting
 * more. **The DOM is bounded by windowing (`DiffScreen`); this bounds the model.**
 *
 * The server's own caps are `MAX_DIFF_FILES_PER_PAGE = 20` × `MAX_DIFF_LINES_PER_FILE =
 * 400`, so a first page is up to ~8,400 rows and every *Show more files* adds another
 * page with nothing ever released. Two and a half pages is the ceiling: past it the
 * control is disabled **with the reason on screen**, because a *Show more* that silently
 * stops loading is the same defect as a diff that silently stops rendering.
 *
 * It is deliberately far above the first page. A ceiling a normal review can hit is a
 * ceiling that trains people to ignore it.
 */
export const MAX_DIFF_ROWS_HELD = 20_000;

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


/* -----------------------------------------------------------------------------
 * The flat row list, and why the screen needs one.
 *
 * `DiffScreen` renders through `sessions/lib/virtual.ts` — the ~90-line windowing
 * primitive this repo already had, written for *"one list, one axis, top-anchored, no
 * horizontal scrolling"*, which is exactly this shape at 4× the console's volume. Before
 * that, every line of every loaded page was mounted at once: 20 files × 400 lines is
 * ~8,000 rows and ~24,000 elements, dropped into a panel mid-320ms-slide.
 *
 * Windowing needs one flat, indexable axis; the screen still draws a card per file. So the
 * rows carry `file`, and `groupWindow` folds a slice of them back into per-file runs. That
 * keeps `drawer.module.css` untouched — `.diffFile`, `.diffFileHead`, `.diffLine` and the
 * `data-origin` ink are all exactly as reviewed — and confines the change to arithmetic.
 *
 * **Nothing here hides anything.** A window is not a cut: every row stays reachable by
 * scrolling, and `truncated` / `linesWithheld` — the cut the *server* made — is still a row
 * in this list and still renders as a sentence with a number in it.
 * -------------------------------------------------------------------------- */

export type DiffRow =
  /** The file's own header: path, status, and the whole change's counts. */
  | { kind: 'head'; file: number; key: string }
  | { kind: 'hunk'; file: number; key: string; text: string }
  | { kind: 'line'; file: number; key: string; origin: DiffLine['origin']; text: string }
  | { kind: 'binary'; file: number; key: string }
  /** The server's cut, said out loud. Always last in its file's run. */
  | { kind: 'withheld'; file: number; key: string; count: number };

/** Every row of every loaded file, in reading order. Pure; no DOM, no measurement. */
export function diffRows(files: readonly DiffFile[]): DiffRow[] {
  const rows: DiffRow[] = [];
  files.forEach((file, index) => {
    const base = fileKey(file, index);
    rows.push({ kind: 'head', file: index, key: `${base}#head` });
    if (file.hunks === null) {
      rows.push({ kind: 'binary', file: index, key: `${base}#binary` });
    } else {
      file.hunks.forEach((hunk, h) => {
        rows.push({ kind: 'hunk', file: index, key: `${base}#h${h}`, text: hunk.header });
        hunk.lines.forEach((line, l) => {
          rows.push({
            kind: 'line',
            file: index,
            key: `${base}#h${h}l${l}`,
            origin: line.origin,
            text: line.text,
          });
        });
      });
    }
    if (file.truncated) {
      rows.push({ kind: 'withheld', file: index, key: `${base}#withheld`, count: file.linesWithheld });
    }
  });
  return rows;
}

export interface DiffRowGroup {
  file: number;
  /** Absolute index of `rows[0]` in the full row list — what the height cache is keyed on. */
  start: number;
  rows: DiffRow[];
}

/**
 * `rows[start … end)`, folded back into contiguous per-file runs.
 *
 * A window can open mid-file, and then the run legitimately has no `head` row in it — the
 * card is the continuation of a file whose header is scrolled off. That is the honest
 * rendering of a window and not a missing header.
 */
export function groupWindow(rows: readonly DiffRow[], start: number, end: number): DiffRowGroup[] {
  const groups: DiffRowGroup[] = [];
  for (let i = Math.max(0, start); i < Math.min(rows.length, end); i++) {
    const row = rows[i];
    const last = groups[groups.length - 1];
    if (last && last.file === row.file) last.rows.push(row);
    else groups.push({ file: row.file, start: i, rows: [row] });
  }
  return groups;
}
