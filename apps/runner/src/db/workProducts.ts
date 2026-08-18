/**
 * The `ops.work_product` writer and its reads (M17, `Plan §13`, ADR-026).
 *
 * One insert, two reads, and no third door:
 *
 *   - `recordWorkProduct` — at the end of a run that had a worktree.
 *   - `readWorkProduct`   — one run, for the diff screen.
 *   - `listWorkProducts`  — the roster, and (with `reviewQueue`) **the review queue as a query
 *                           rather than a table**. There is no `ops.review`; M11 stays absorbed.
 *
 * ## Graded from both sides, before it has ever executed
 *
 * `0010_work_products.sql` has thirteen NOT NULL columns with no default. BRIEF's standing
 * finding is that a `NOT NULL` nobody can satisfy and one that holds are identical in a schema
 * dump — 0005 shipped four of the first kind and the first paid run would have failed to record
 * *after* the model was paid for. So this writer is added to `harvestWrites()` in
 * `writer-schema-agreement.test.ts` in the same commit as the migration, which checks the
 * column list against the schema **with no database**. A column this file forgets is red in
 * milliseconds rather than at the first repo-touching run.
 *
 * **It has never executed.** Zero agent runs, and no project with a checked-out repo path.
 */
import { randomUUID } from 'node:crypto';
import type {
  CiState,
  PrState,
  PushState,
  WorkProductSummary,
} from '@agnetos/contracts';
import type { DbClient } from '../observability/types.ts';

export interface WorkProductRecord {
  runId: string;
  projectId: string;
  threadId: string;
  repoPath: string;
  worktreePath: string;
  branch: string;
  baseSha: string;
  headSha: string;
  commits: number;
  filesChanged: number;
  insertions: number;
  deletions: number;
  /**
   * `null` ⇒ **nothing looked**. There is no default, deliberately: a writer that filled in
   * `none` for a run it never examined would produce the row that tells a person their work is
   * safe when nothing checked it. `pushCheckedAt` moves with it — the schema pins the pair with
   * an equality CHECK, and this type does the same by making both required and nullable.
   */
  pushState: PushState | null;
  pushCheckedAt: string | null;
}

/**
 * Write the row. Idempotent on `run_id`, like `recordRun`: a retry after a partial failure
 * records once rather than raising, and a second work product for one run is not a thing that
 * can exist (`ops.work_product.run_id` is UNIQUE).
 *
 * **The outcome fields are not parameters.** `pr_url`, `pr_state`, `ci_state`, `tests_run` and
 * `tests_passed` are `recorded, not produced` in M17's evidence tiers — nothing in this build
 * opens a PR, reads CI or runs a test suite on an agent's behalf, so a parameter for them would
 * be an argument no caller could truthfully supply. They are omitted from the INSERT and are
 * NULL, which reads as *nobody looked*. When something does look, it names them here and the
 * agreement test requires nothing, because they are nullable.
 */
export async function recordWorkProduct(db: DbClient, record: WorkProductRecord): Promise<string> {
  assertRecordable(record);
  const id = randomUUID();

  await db.query(
    `INSERT INTO ops.work_product (
       id, run_id, project_id, thread_id,
       repo_path, worktree_path, branch, base_sha, head_sha,
       commits, files_changed, insertions, deletions,
       push_state, push_checked_at
     ) VALUES (
       $1,$2,$3,$4,
       $5,$6,$7,$8,$9,
       $10,$11,$12,$13,
       $14,$15
     )
     ON CONFLICT (run_id) DO NOTHING`,
    [
      id,
      record.runId,
      record.projectId,
      record.threadId,
      record.repoPath,
      record.worktreePath,
      record.branch,
      record.baseSha,
      record.headSha,
      record.commits,
      record.filesChanged,
      record.insertions,
      record.deletions,
      record.pushState,
      record.pushCheckedAt,
    ],
  );

  return id;
}

/**
 * Refuse a row that cannot be attributed or that carries a state with no time.
 *
 * The same shape as `assertAttributed` in `db/ledger.ts` and for the same reason: a Postgres
 * constraint violation names a column and no layer, and it arrives after the run has already
 * happened. This names the layer, in this process, in one sentence.
 *
 * The push pair is checked here as well as in the schema because **this is the one invariant
 * the milestone is about**. A state without a time is a claim with no observation behind it,
 * which is the house defect in its most common costume.
 */
function assertRecordable(record: WorkProductRecord): void {
  const missing = (['runId', 'projectId', 'threadId', 'repoPath', 'worktreePath', 'branch', 'baseSha', 'headSha'] as const)
    .filter((key) => !record[key]);
  if (missing.length > 0) {
    throw Object.assign(
      new Error(
        `Work product for run ${record.runId || '(no run id)'} is missing ${missing.join(', ')}. ` +
          'This is a wiring fault in the runner, not a bad request: the work exists on disk and ' +
          'recording it under a guessed project or an invented path would make it unfindable.',
      ),
      { code: 'run_unattributed' },
    );
  }
  if ((record.pushState === null) !== (record.pushCheckedAt === null)) {
    throw Object.assign(
      new Error(
        `Work product for run ${record.runId} has pushState=${String(record.pushState)} and ` +
          `pushCheckedAt=${String(record.pushCheckedAt)}. A push state without the time it was ` +
          'observed at is a declared value, and "nothing has ever looked" is a different answer ' +
          'from "we looked and there was nothing to push".',
      ),
      { code: 'run_unattributed' },
    );
  }
}

type Row = {
  run_id: string;
  agent: string;
  thread_id: string;
  branch: string;
  base_sha: string;
  head_sha: string;
  commits: number;
  files_changed: number;
  insertions: number;
  deletions: number;
  push_state: PushState | null;
  push_checked_at: string | Date | null;
  pr_url: string | null;
  pr_state: PrState | null;
  ci_state: CiState | null;
  tests_run: number | null;
  tests_passed: number | null;
  worktree_removed_at: string | Date | null;
  created_at: string | Date;
};

const iso = (value: string | Date | null): string | null =>
  value === null ? null : value instanceof Date ? value.toISOString() : value;

function toSummary(row: Row): WorkProductSummary {
  return {
    runId: row.run_id,
    agent: row.agent,
    threadId: row.thread_id,
    branch: row.branch,
    baseSha: row.base_sha,
    headSha: row.head_sha,
    commits: Number(row.commits),
    filesChanged: Number(row.files_changed),
    insertions: Number(row.insertions),
    deletions: Number(row.deletions),
    pushState: row.push_state,
    pushCheckedAt: iso(row.push_checked_at),
    prUrl: row.pr_url,
    prState: row.pr_state,
    ciState: row.ci_state,
    testsRun: row.tests_run === null ? null : Number(row.tests_run),
    testsPassed: row.tests_passed === null ? null : Number(row.tests_passed),
    // **Derived from the removal timestamp, not from a filesystem check on read.** A stat here
    // would be a second source of truth that disagrees with the row the moment a tree is
    // deleted by hand; the route that serves bytes checks the tree, and this flag says what the
    // record knows. Either way the reader gets `work_product_unavailable` rather than an empty
    // file list — the two must never look alike.
    diffAvailable: row.worktree_removed_at === null,
    createdAt: iso(row.created_at) as string,
  };
}

/**
 * The columns every read selects. Written once because the two reads must not drift: a roster
 * line and a diff header showing different push states for one run is the kind of disagreement
 * nobody reports as a bug.
 */
const SELECT_SUMMARY = `
  SELECT w.run_id, r.agent, w.thread_id, w.branch, w.base_sha, w.head_sha,
         w.commits, w.files_changed, w.insertions, w.deletions,
         w.push_state, w.push_checked_at, w.pr_url, w.pr_state, w.ci_state,
         w.tests_run, w.tests_passed, w.worktree_removed_at, w.created_at
    FROM ops.work_product w
    JOIN ops.agent_runs r ON r.run_id = w.run_id AND r.project_id = w.project_id`;

/**
 * One run's work product, **scoped by project on the same statement that finds it**.
 *
 * `WHERE w.project_id = $1 AND w.run_id = $2` — not a lookup followed by a check. The order
 * matters and `thread-model.md` §4.1 is the precedent: a lookup-then-scope route lets a
 * caller-supplied id choose its own scope, and what is behind this particular id is another
 * client's file paths.
 */
export async function readWorkProduct(
  db: DbClient,
  projectId: string,
  runId: string,
): Promise<WorkProductSummary | null> {
  const { rows } = await db.query<Row>(`${SELECT_SUMMARY} WHERE w.project_id = $1 AND w.run_id = $2`, [
    projectId,
    runId,
  ]);
  const row = rows[0];
  return row ? toSummary(row) : null;
}

/**
 * The roster — and the review queue, which is this same query with one predicate.
 *
 * **Hazard 4, made structural.** Three finished runs awaiting review look exactly like a task
 * list, and that is how `ops.task` gets rebuilt by accident. The queue is
 * `push_state = 'local' OR pr_state = 'open'`, ordered, served by the partial index
 * `work_product_review_queue_idx`. One route for N runs, because a roster assembled from N
 * fetches is a spinner that no test catches.
 */
export async function listWorkProducts(
  db: DbClient,
  projectId: string,
  options: { limit?: number; reviewQueue?: boolean } = {},
): Promise<WorkProductSummary[]> {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
  const predicate = options.reviewQueue ? `AND (w.push_state = 'local' OR w.pr_state = 'open')` : '';
  const { rows } = await db.query<Row>(
    `${SELECT_SUMMARY} WHERE w.project_id = $1 ${predicate} ORDER BY w.created_at DESC LIMIT $2`,
    [projectId, limit],
  );
  return rows.map(toSummary);
}

/**
 * Where the work physically is — **internal, and deliberately not on `WorkProductSummary`**.
 *
 * `Plan §13` lists `worktree_path` as *"where to find it"*, and it is: for a person on the host,
 * in the row and in the refusal hint when the tree is gone. It is not on the read payload,
 * because the diff screen has no use for an absolute host path and a payload that carries one
 * hands a client the filesystem layout of the machine. The diff route resolves it server-side.
 */
export async function readWorkProductLocation(
  db: DbClient,
  projectId: string,
  runId: string,
): Promise<{ worktreePath: string; baseSha: string; branch: string; worktreeRemovedAt: string | null } | null> {
  const { rows } = await db.query<{
    worktree_path: string;
    base_sha: string;
    branch: string;
    worktree_removed_at: string | Date | null;
  }>(
    `SELECT worktree_path, base_sha, branch, worktree_removed_at
       FROM ops.work_product
      WHERE project_id = $1 AND run_id = $2`,
    [projectId, runId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    worktreePath: row.worktree_path,
    baseSha: row.base_sha,
    branch: row.branch,
    worktreeRemovedAt: iso(row.worktree_removed_at),
  };
}

/** Mark the tree gone, so a later read says *the diff is unavailable* rather than *no changes*. */
export async function markWorktreeRemoved(db: DbClient, projectId: string, runId: string): Promise<void> {
  await db.query(
    `UPDATE ops.work_product
        SET worktree_removed_at = now()
      WHERE project_id = $1 AND run_id = $2 AND worktree_removed_at IS NULL`,
    [projectId, runId],
  );
}
