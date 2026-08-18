/**
 * The diff review read (M17, `Plan §13`, ADR-026, `work-product.md` §4).
 *
 * One function, and every line of it is a refusal that exists because the alternative is a
 * reviewer approving something they were not shown:
 *
 *   - the tree is gone            → `work_product_unavailable` (410), never an empty file list;
 *   - the cursor is from another
 *     tree state                  → `work_product_moved` (409), never two trees served as one;
 *   - the run is another project's → `run_not_found` (404), opaque.
 *
 * **The diff is read here and stored nowhere.** There is no diff column in `ops.work_product`
 * and no diff on any other plane: not a span, not an error string, not a thread message, not a
 * model prompt (`work-product.md` §6, `diff-never-leaves.test.ts`). This function is the only
 * producer of diff text in the runner, and its output goes to one reader.
 */
import type { DiffPage } from '@agnetos/contracts';
import { ApiError } from './errors';
import type { MountedProject } from './project';
import { readWorkProductLocation } from '../db/workProducts.ts';
import { readDiffPage, MAX_DIFF_FILES_PER_PAGE } from './worktree';
import type { DbClient } from '../observability/types.ts';

/**
 * A cursor is `<headSha>:<fileIndex>`.
 *
 * **Opaque to the client and self-describing to the server**, which is the whole reason it is a
 * cursor rather than an offset. `drawer-engineer`'s wave-0 note is the argument, and it is a
 * correctness one rather than an ergonomic one: *a worktree is a live directory. If page 2 can
 * be served from a tree that moved between pages, the reviewer approves a diff that never
 * existed as a whole.* An offset cannot carry the tree state; this does, and a mismatch is
 * refused rather than papered over.
 */
function parseCursor(raw: string | undefined): { headSha: string; fromFile: number } | null {
  if (!raw) return null;
  const at = raw.lastIndexOf(':');
  if (at <= 0) throw new ApiError('bad_request', 'That diff cursor is not one this route issued.', {
    hint: 'Pass back the `nextCursor` from the previous page verbatim, or omit it to start again.',
    retryable: false,
  });
  const headSha = raw.slice(0, at);
  const fromFile = Number(raw.slice(at + 1));
  if (!Number.isInteger(fromFile) || fromFile < 0) {
    throw new ApiError('bad_request', 'That diff cursor is not one this route issued.', {
      hint: 'Pass back the `nextCursor` from the previous page verbatim, or omit it to start again.',
      retryable: false,
    });
  }
  return { headSha, fromFile };
}

export async function readWorkProductDiff(
  db: DbClient,
  project: MountedProject,
  runId: string,
  query: { cursor?: string; files?: string },
): Promise<DiffPage> {
  // Project first, from the path, on the same statement that finds the row. A lookup followed
  // by a check would let a caller-supplied run id choose its own scope, and behind this id is
  // another client's file contents (`thread-model.md` §4.1, one plane over).
  const location = await readWorkProductLocation(db, project.id, runId);
  if (!location) {
    throw new ApiError('run_not_found', `No work product for run ${runId} in "${project.slug}".`, {
      hint: 'Either this run touched no repository, or it belongs to another project. Nothing was read.',
      retryable: false,
    });
  }

  if (location.worktreeRemovedAt !== null) {
    throw new ApiError('work_product_unavailable', `The working tree for run ${runId} has been removed.`, {
      hint:
        `The work was in ${location.worktreePath}, on branch ${location.branch}. Its diff cannot ` +
        'be shown because the tree is gone — this is not the same as "this run changed nothing", ' +
        'and the counts on the roster line are still the record of what it did.',
      retryable: false,
    });
  }

  const cursor = parseCursor(query.cursor);
  const requested = query.files === undefined ? MAX_DIFF_FILES_PER_PAGE : Number(query.files);
  const maxFiles = Number.isInteger(requested) && requested > 0 ? Math.min(requested, MAX_DIFF_FILES_PER_PAGE) : MAX_DIFF_FILES_PER_PAGE;

  const page = await readDiffPage(
    { path: location.worktreePath, baseSha: location.baseSha },
    { maxFiles, ...(cursor ? { fromFile: cursor.fromFile } : {}) },
  );

  if (cursor && cursor.headSha !== page.headSha) {
    throw new ApiError('work_product_moved', 'This diff has changed since the page you are reading.', {
      hint:
        'The working tree moved on to a new commit while you were paging through it, so the rest ' +
        'of this diff would be a mixture of two states. Reload the diff to see it whole — nothing ' +
        'was approved and nothing was changed.',
      retryable: true,
    });
  }

  return {
    runId,
    headSha: page.headSha,
    files: page.files,
    totalFiles: page.totalFiles,
    // The pin travels with the cursor, which is what makes the 409 above possible at all.
    nextCursor: page.nextCursor === null ? null : `${page.headSha}:${page.nextCursor}`,
  };
}
