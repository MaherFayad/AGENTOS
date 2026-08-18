/**
 * Work products and the diff review payload — M17, `Plan §13`, ADR-026.
 *
 * Owner: `runner-engineer`. The prose contract is `comms/contracts/work-product.md` and it is
 * normative; this file is the code half of it (ADR-002).
 *
 * **The read side of this contract has one author on purpose.** `drawer-engineer` renders every
 * shape below — roster line, diff review screen, approve — and forks none of them. That seam is
 * BOARD's M17 frame: *"the boundary object is the work-product route and the diff payload
 * shape, and the lead writes it."* If a field here is wrong for the screen, that is a
 * `decision-request`, not a second type.
 *
 * ## Two things this file does not contain, both deliberate
 *
 * 1. **No diff text anywhere except `DiffLine.text`, which is only ever produced by the read
 *    route and only ever travels to one reader.** A diff is a body. It is not stored in
 *    Postgres, not attached to a span, not interpolated into an error, and not written into a
 *    thread message where the next run's prompt would carry it out of the tailnet
 *    (`work-product.md` §6). The `withhold()` register cannot help: a diff would exhaust it and
 *    it now refuses at capacity, returning `false`.
 * 2. **No merge, push or PR verb.** M17 *records* push state; it does not perform a push
 *    (hazard 5, ADR-038 is `proposed`). A payload that implied one exists would be a fake
 *    control, which the drawer's own rules forbid.
 */

/**
 * Where a run's commits are, **observed**, or `null` when nothing has ever looked.
 *
 * The `null` is the whole design and not an oversight. `Plan §13` gives three values; a fourth
 * state exists in reality — *nobody examined this* — and collapsing it into `none` tells a
 * person their work is safe when nothing checked. That is the house defect (*a declared value
 * read as an observed one*) landing on the one screen where it costs real work.
 *
 * `pushed` is reachable and truthful in M17 **only because a human may have pushed the branch**.
 * Nothing in this build performs a push.
 */
export type PushState = 'none' | 'local' | 'pushed';

/** `Plan §13`'s outcome fields. Recorded, never produced by M17 — every one is `null` today. */
export type PrState = 'open' | 'merged' | 'closed' | 'draft';
export type CiState = 'pending' | 'passing' | 'failing' | 'unknown';

/**
 * One line per run, and every value on it precomputed or trivially derivable — because §13's
 * roster is *"read in two seconds on a phone"* and a roster assembled from N fetches is a
 * spinner.
 *
 * Elapsed time is deliberately **not** here: it is derived client-side from `startedAt`, so it
 * cannot go stale in a cache and become a declared value.
 */
export interface WorkProductSummary {
  runId: string;
  /** `department/agent-slug`, so the roster line can name the agent without a second read. */
  agent: string;
  /** The run's thread. `asked you something` is a question message in it (ADR-023). */
  threadId: string;
  branch: string;
  baseSha: string;
  headSha: string;
  commits: number;
  filesChanged: number;
  insertions: number;
  deletions: number;
  /** `null` ⇒ nothing has ever looked. Render it as unknown, never as "nothing to push". */
  pushState: PushState | null;
  /** ISO 8601. Non-null exactly when `pushState` is — the schema pins the pair. */
  pushCheckedAt: string | null;
  prUrl: string | null;
  prState: PrState | null;
  ciState: CiState | null;
  testsRun: number | null;
  testsPassed: number | null;
  /**
   * `false` ⇒ the worktree is gone and this run's diff can no longer be read. Distinct from a
   * work product with zero files: *the tree was removed* and *nothing changed* are the same
   * empty list and completely different news.
   */
  diffAvailable: boolean;
  createdAt: string;
}

export type DiffFileStatus = 'added' | 'modified' | 'deleted' | 'renamed' | 'binary';

export interface DiffLine {
  origin: ' ' | '+' | '-';
  /** The line **without** its origin marker. The client never re-parses a diff. */
  text: string;
}

export interface DiffHunk {
  /** The `@@ … @@` line verbatim, for display. Structure is in the four numbers below it. */
  header: string;
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: DiffLine[];
}

export interface DiffFile {
  /** `null` on an added file. */
  oldPath: string | null;
  /** `null` on a deleted file. A rename is one row with both. */
  newPath: string | null;
  status: DiffFileStatus;
  insertions: number;
  deletions: number;
  /** `null` for a binary file — flagged, never sent as bytes. */
  hunks: DiffHunk[] | null;
  /** True when this file's body was cut. A cut that does not say so is a lie by omission. */
  truncated: boolean;
  /** How many lines were withheld. Never a silent tail, never a vague ellipsis. */
  linesWithheld: number;
}

/**
 * One page of a diff, pinned to a tree state.
 *
 * **Two axes, because a diff is not a list of rows:** files (this page), and lines within a
 * file (`DiffFile.truncated`). `totalFiles` is on every page, because a file list that cannot
 * say how many files there are cannot be read in two seconds.
 *
 * `headSha` is the pin. A worktree is a live directory; a cursor presented against a different
 * head is refused with `work_product_moved` (409) rather than served as a consistent-looking
 * mixture of two trees, which is how a reviewer approves a diff that never existed as a whole.
 */
export interface DiffPage {
  runId: string;
  headSha: string;
  files: DiffFile[];
  totalFiles: number;
  /** Opaque. `null` on the last page. Pass it back verbatim; do not construct one. */
  nextCursor: string | null;
}

/**
 * `GET /api/p/:project/work-product/:runId`.
 *
 * **A discriminated absence, not a 404.** A run in this project that touched no repository
 * answers 200 with `workProduct: null` and a stated reason; a 404 would be indistinguishable
 * from a mistyped id on a phone. A run belonging to **another** project is `run_not_found`
 * (404) and stays opaque — confirming an id exists elsewhere is itself a cross-project
 * disclosure, and on this route the thing behind the id is file contents.
 */
export interface WorkProductResponse {
  runId: string;
  workProduct: WorkProductSummary | null;
  /**
   * Why there is none. `no_repo` — the run never touched a repository (the ordinary case in
   * this build, where no project has a checked-out repo path). `not_finished` — the run is
   * still going, and the row is written when it ends.
   */
  absent: 'no_repo' | 'not_finished' | null;
}

/** `GET /api/p/:project/work-products` — the roster, and the review queue, in one route. */
export interface WorkProductListResponse {
  workProducts: WorkProductSummary[];
  /**
   * True when this list was narrowed to the review queue
   * (`push_state = 'local' OR pr_state = 'open'`). **A query, not a table** — M11 stays
   * absorbed and there is no `ops.review`.
   */
  reviewQueue: boolean;
}
