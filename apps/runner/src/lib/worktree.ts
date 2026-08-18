/**
 * **Worktree isolation, one per run** (`Plan §13`, ADR-026, M17).
 *
 *   > Parallel agents in one project must not share a working tree. Git worktrees, one per
 *   > run, cleaned when unchanged. **Without this, "run three agents at once" corrupts all
 *   > three.**
 *
 * This is the first mechanism in this repo whose failure corrupts *data* rather than a claim,
 * and it is also the first that can be **proven today**: git is local, so `git worktree add`
 * against a temp fixture repo is a real operation with a real filesystem outcome — no API key,
 * no Postgres, no model call. `worktree.test.ts` exercises every function here against real
 * repositories and every assertion in it has been red.
 *
 * ## A worktree is not a jail — the sentence this module exists to stop being a docstring
 *
 * `workspace` confinement was once *"scoped to the per-run scratch cwd"* written in a comment,
 * twelve agents were widened on the strength of it, and a run overwrote `.env`. **A comment is
 * not a mechanism.** So, plainly, what does and does not stop a write outside this directory:
 *
 *   - **cwd stops nothing.** It decides where a *relative* path resolves. The SDK's file tools
 *     take absolute paths.
 *   - **What confines the file tools is `isPathInsideRunRoots`** (`allowlist.ts`), applied per
 *     path argument, on the runner's side of the wire. `createWorktree` returns a root that is
 *     added to that gate's set; the gate is the mechanism, and this module's contribution is
 *     that the root it hands out is a real, separate, non-nested directory.
 *   - **Nothing confines a shell.** `Bash` takes a command string; `pathArgumentsOf` finds no
 *     path in it and the gate returns `true`. One `cd ..` leaves. The same is true of every
 *     MCP connector, whose arguments are interpreted by another process entirely.
 *
 * The answer to that is a **refusal, not a claim**: `assertWorktreeConfinable` declines to hand
 * a worktree to a run holding a connector whose writes this runner cannot gate. We do not
 * pretend to jail a shell; we decline to give it a repository. The connector registry now
 * carries `writes` as a **required** field, so the next connector added cannot be silent about
 * this — that is what stops the check being an include-list that is blind to whatever is added
 * next (BRIEF: *an include-list is a decision to be blind to everything unnamed*).
 *
 * ## What has never happened
 *
 * **No run has ever been given a worktree**, because zero agent runs have executed *and* no
 * project has a checked-out repo path a run could work in — two missing preconditions, not
 * one. Everything below is exercised against fixture repositories in tests. The mechanic is
 * `real`; its use by a run is not.
 */
import { mkdir, stat } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { ApiError } from './errors';
import { git } from './git';
import type { ResolvedAllowlist } from './allowlist';
import { CONNECTOR_REGISTRY } from './allowlist';

export interface RunWorktree {
  /** Absolute path to this run's working tree. The only directory the run may write in. */
  path: string;
  /** The checked-out repository it was cut from. */
  repoPath: string;
  /** `agnetos/run/<runId>` — one branch per run, so two runs cannot share a ref either. */
  branch: string;
  /** The commit the run started from. `Plan §13`'s `base_sha`. */
  baseSha: string;
}

/** `Plan §13`'s "how much", observed from git rather than reported by the agent. */
export interface WorktreeFacts {
  branch: string;
  baseSha: string;
  headSha: string;
  commits: number;
  filesChanged: number;
  insertions: number;
  deletions: number;
  /**
   * `none | local | pushed`, **observed**, with the time it was observed at.
   *
   * Never a default. The column is nullable precisely so *"nothing has ever looked"* is a
   * different value from *"we looked and there was nothing to push"* — this function is the
   * only thing that produces the second one, and it stamps the time in the same breath.
   */
  pushState: 'none' | 'local' | 'pushed';
  pushCheckedAt: string;
}

const RUN_BRANCH_PREFIX = 'agnetos/run/';

/**
 * Per-repository serialization of `git worktree add`.
 *
 * `git worktree add` writes into `.git/worktrees/` and takes git's own locks; two concurrent
 * adds against one repository can lose one to a lock error. The isolation requirement is that
 * **N concurrent runs get N usable trees**, so a mechanism that is correct-but-flaky under
 * concurrency fails the requirement — and it would fail it intermittently, which is worse than
 * failing it always.
 *
 * A promise chain per repo path, in this process. Deliberately *not* a cross-process lock: this
 * runner is one process per host (`maxConcurrentRuns` gates runs inside it), and a lock file
 * pretending to coordinate two hosts that share a checkout would be a claim the design does not
 * make. If two runners ever share a repository, that is an ADR, not a wider mutex.
 */
const repoQueues = new Map<string, Promise<unknown>>();

function serialize<T>(repoPath: string, work: () => Promise<T>): Promise<T> {
  const previous = repoQueues.get(repoPath) ?? Promise.resolve();
  const next = previous.then(work, work);
  // Swallow rejection on the *chain* only: the caller still receives `next` and its error.
  repoQueues.set(repoPath, next.then(
    () => {},
    () => {},
  ));
  return next;
}

function isInside(root: string, target: string): boolean {
  const rel = relative(resolve(root), resolve(target));
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel) && !rel.split(sep).includes('..');
}

/**
 * **The confinement refusal.**
 *
 * A run is given a worktree only when every connector it holds either does not write, or
 * writes through arguments this runner can gate. `writes: 'ungated'` means the tool's effects
 * are decided somewhere this process cannot see — a shell command string, or an MCP server in
 * another process — so no path check can bound it.
 *
 * This is not confinement and does not claim to be. It is the decision not to hand a repository
 * to something that could walk out of it, which is the honest half of a problem whose other
 * half (jailing a shell) needs a sandbox this build does not have.
 *
 * Today **no agent in the library declares `shell`**, so this refusal costs nothing and forbids
 * nothing that exists. That is the point of landing it now rather than when it does cost
 * something: a rule introduced at the moment it first blocks someone gets argued with; one that
 * is already there gets designed around.
 */
export function assertWorktreeConfinable(allowlist: ResolvedAllowlist, agentSlug: string): void {
  const ungated = allowlist.connectors.filter((name) => CONNECTOR_REGISTRY[name]?.writes === 'ungated');
  if (ungated.length === 0) return;
  throw new ApiError(
    'worktree_unconfinable',
    `"${agentSlug}" is wired into ${ungated.join(', ')}, whose writes this runner cannot confine to a worktree.`,
    {
      hint:
        'Nothing was created and nothing was run. A worktree is a directory, not a sandbox: a ' +
        'shell command or an MCP server can leave it in one step, and this runner has no way to ' +
        'check. Remove the connector from the agent\'s wired_into, or decide deliberately (in an ' +
        'ADR) that this agent may work in a repository unconfined.',
      retryable: false,
    },
  );
}

/** Refuse anything that is not a git checkout we can write to, before a run is started. */
export async function assertRepoUsable(repoPath: string): Promise<void> {
  const info = await stat(repoPath).catch(() => null);
  if (!info?.isDirectory()) {
    throw new ApiError('repo_unavailable', `There is no repository at ${repoPath}.`, {
      hint: 'This project has no checked-out repository on this host, so there is nothing for a run to work in. Nothing was started.',
      retryable: false,
    });
  }
  const top = await git(repoPath, ['rev-parse', '--show-toplevel']).catch(() => null);
  if (top === null) {
    throw new ApiError('repo_unavailable', `${repoPath} is not a git checkout.`, {
      hint: 'A work product needs a repository with history — a plain directory has no base commit to diff against. Nothing was started.',
      retryable: false,
    });
  }
}

/**
 * Create this run's worktree. One call, one tree, one branch.
 *
 * `runId` is the only thing that varies between concurrent calls, and it is what makes the
 * paths distinct — which is exactly what `worktree.test.ts` falsifies by returning a constant.
 */
export async function createWorktree(options: {
  repoPath: string;
  worktreeRoot: string;
  runId: string;
  /** Where to branch from. Defaults to the repository's current HEAD. */
  baseRef?: string;
}): Promise<RunWorktree> {
  const repoPath = resolve(options.repoPath);
  const worktreeRoot = resolve(options.worktreeRoot);
  const path = join(worktreeRoot, options.runId);

  await assertRepoUsable(repoPath);

  /**
   * **A worktree inside the repository is not isolation, it is a second copy of the tree
   * inside the tree.** git will happily do it; the result is a working tree that appears in
   * its own `git status`, that `git clean` can delete, and whose files a `git add -A` in the
   * parent would stage. Refused rather than normalised, in the same shape as
   * `assertInsideAgents`: resolved paths compared, so `..` and an absolute path both fail
   * closed.
   */
  if (isInside(repoPath, path) || resolve(path) === repoPath) {
    throw new ApiError('bad_request', 'A run worktree may not live inside the repository it is cut from.', {
      hint: `Point RUNNER_WORKTREE_ROOT somewhere outside ${repoPath}. Nothing was created.`,
      retryable: false,
    });
  }

  return serialize(repoPath, async () => {
    const baseRef = options.baseRef ?? 'HEAD';
    const baseSha = await git(repoPath, ['rev-parse', baseRef]);
    const branch = `${RUN_BRANCH_PREFIX}${options.runId}`;

    await mkdir(worktreeRoot, { recursive: true });
    // `-b` creates the branch as part of the add, so there is no window in which the branch
    // exists and the tree does not. `--no-track` because a run's branch is not a copy of
    // anything upstream — and an accidental upstream would make `push_state` read `pushed`
    // for commits that are on no remote at all, which is the exact lie this milestone is
    // about (`work-product.md` §5).
    await git(repoPath, ['worktree', 'add', '--no-track', '-b', branch, path, baseSha]);

    return { path, repoPath, branch, baseSha };
  });
}

/**
 * Remove one run's worktree. **Does not touch any other.**
 *
 * `git worktree remove` is given one path and refuses to walk anywhere else; the `--force`
 * covers a tree with uncommitted changes, which is the ordinary state of a run that produced
 * work and did not commit it. The administrative record in `.git/worktrees/` goes with it, so
 * the repository does not accumulate stale entries for trees that are gone.
 */
export async function removeWorktree(repoPath: string, worktreePath: string): Promise<void> {
  await serialize(resolve(repoPath), async () => {
    await git(repoPath, ['worktree', 'remove', '--force', worktreePath]).catch(async (err) => {
      // A tree whose directory has already been deleted (the killed-run case) cannot be
      // "removed" — it is pruned. Falling through to a prune here means cleanup is idempotent
      // rather than an error a caller has to classify.
      const info = await stat(worktreePath).catch(() => null);
      if (info) throw err;
      await git(repoPath, ['worktree', 'prune']);
    });
  });
}

/**
 * Prune worktrees whose directories are gone — **the killed-run case**.
 *
 * A run whose process died leaves a directory that may or may not exist and an administrative
 * entry that certainly does. The requirement is that this leaves a **prunable** worktree rather
 * than a locked repository: the next `prune` reclaims it, and a live sibling is untouched.
 *
 * Returns the paths that were reclaimed, which is what makes "it pruned the right one" an
 * assertion rather than an inspection.
 */
export async function pruneWorktrees(repoPath: string): Promise<string[]> {
  return serialize(resolve(repoPath), async () => {
    /**
     * **Read from `worktree list --porcelain`, not from `prune --dry-run --verbose`.**
     *
     * The obvious implementation asks prune what it would do. It is wrong twice, and both are
     * the checker-goes-blind family: `--verbose` writes its report to **stderr**, so a helper
     * that returns stdout gets an empty string and reports *"nothing was prunable"* — a
     * confident, silent zero, which is the shape of every defect on this board. And the report
     * names git's internal worktree id rather than the path the caller knows.
     *
     * Found by this function's own test going red on `expected one prunable tree, got []`,
     * which is the whole argument for having written the test first.
     *
     * The porcelain list is stdout, is structured, and annotates each entry with `prunable`
     * and its reason, so what comes back is the caller's own absolute paths.
     */
    const listing = await git(repoPath, ['worktree', 'list', '--porcelain']);
    const reclaimed: string[] = [];
    let current: string | null = null;
    for (const line of listing.split('\n')) {
      if (line.startsWith('worktree ')) current = resolve(line.slice('worktree '.length).trim());
      else if (line.startsWith('prunable') && current) reclaimed.push(current);
    }
    if (reclaimed.length > 0) await git(repoPath, ['worktree', 'prune']);
    return reclaimed;
  });
}

/** Absolute paths of every worktree git currently knows about, excluding the main checkout. */
export async function listWorktrees(repoPath: string): Promise<string[]> {
  const out = await git(repoPath, ['worktree', 'list', '--porcelain']);
  const paths = [...out.matchAll(/^worktree (.+)$/gm)].map((m) => resolve((m[1] as string).trim()));
  const main = resolve(await git(repoPath, ['rev-parse', '--show-toplevel']));
  return paths.filter((p) => p !== main);
}

/**
 * Read the facts `ops.work_product` records, from git, in the worktree.
 *
 * **Counts, never content.** Everything here is a number, a sha or a branch name — which is
 * what makes the roster line renderable without a diff ever leaving the tree
 * (`work-product.md` §6). `--numstat` is parsed rather than `--stat`, because `--stat` is a
 * human-formatted table with abbreviated paths and it is a text-shaped answer to a numeric
 * question.
 */
export async function readWorktreeFacts(worktree: RunWorktree): Promise<WorktreeFacts> {
  const { path, baseSha, branch } = worktree;
  const headSha = await git(path, ['rev-parse', 'HEAD']);
  const commits = Number(await git(path, ['rev-list', '--count', `${baseSha}..HEAD`]));

  // Committed *and* uncommitted work, because a run that wrote files and did not commit has
  // still produced something a person needs to see. `git diff <base>` against the working
  // tree answers both at once.
  const numstat = await git(path, ['diff', '--numstat', baseSha, '--']);
  let filesChanged = 0;
  let insertions = 0;
  let deletions = 0;
  for (const line of numstat.split('\n')) {
    if (line.trim() === '') continue;
    filesChanged += 1;
    const [added, removed] = line.split('\t');
    // `-` in both columns means binary. Counted as a changed file with no line counts, which
    // is the truth; counting it as zero-change would hide it from the roster entirely.
    if (added !== '-') insertions += Number(added) || 0;
    if (removed !== '-') deletions += Number(removed) || 0;
  }

  return {
    branch,
    baseSha,
    headSha,
    commits,
    filesChanged,
    insertions,
    deletions,
    ...(await observePushState(path, commits)),
  };
}

/**
 * **The question you actually asked**, answered by looking rather than by assuming.
 *
 * Local git can answer all three states with no network and no credentials:
 *
 *   - no commits at all           → `none`   (there is nothing to push)
 *   - commits, no upstream        → `local`  (they exist on this machine only)
 *   - commits ahead of upstream   → `local`
 *   - commits, none ahead         → `pushed`
 *
 * `pushed` is **reachable and truthful** in M17 even though nothing here performs a push: a
 * human may have pushed the branch, and hazard 5 forbids the *action*, not the observation.
 * `no-egress-verbs.test.ts` is what enforces the action half, by scanning this source for a
 * push verb — a mechanism rather than this sentence.
 *
 * The returned time is when the observation was made, and it is returned *with* the state
 * rather than stamped by the caller, so a state can never reach the row without one.
 */
async function observePushState(
  worktreePath: string,
  commits: number,
): Promise<{ pushState: WorktreeFacts['pushState']; pushCheckedAt: string }> {
  const pushCheckedAt = new Date().toISOString();
  if (commits === 0) return { pushState: 'none', pushCheckedAt };

  const upstream = await git(worktreePath, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']).catch(
    () => null,
  );
  if (upstream === null) return { pushState: 'local', pushCheckedAt };

  const ahead = Number(await git(worktreePath, ['rev-list', '--count', '@{u}..HEAD']).catch(() => '1'));
  return { pushState: ahead > 0 ? 'local' : 'pushed', pushCheckedAt };
}

/** One file in a diff, as structure. The client never parses diff text (`work-product.md` §4). */
export interface DiffFile {
  oldPath: string | null;
  newPath: string | null;
  status: 'added' | 'modified' | 'deleted' | 'renamed' | 'binary';
  insertions: number;
  deletions: number;
  /** `null` for binary, and for a file whose body was withheld by the line cap. */
  hunks: DiffHunk[] | null;
  /** True when this file's body was cut. Never a silent tail. */
  truncated: boolean;
  /** How many lines of this file's diff were withheld. `0` when nothing was cut. */
  linesWithheld: number;
}

export interface DiffHunk {
  header: string;
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: Array<{ origin: ' ' | '+' | '-'; text: string }>;
}

export interface DiffPage {
  /** The tree state this page was read from. A cursor from another head is refused. */
  headSha: string;
  files: DiffFile[];
  /** Every changed file, not just this page's — a list that cannot say how many is unreadable. */
  totalFiles: number;
  /** Opaque; `null` on the last page. */
  nextCursor: string | null;
}

/** Per-file body cap. See `work-product.md` §4.3 for why a cut must be declared. */
export const MAX_DIFF_LINES_PER_FILE = 400;
/** Files per page. Two axes, because a diff is not a list of rows. */
export const MAX_DIFF_FILES_PER_PAGE = 20;

/**
 * Read one page of this worktree's diff, as structure.
 *
 * **The server parses; the client never does.** A client that parses unified diff text to find
 * its own structure is a second implementation of this function with a different author, which
 * is the shape M17's seam was drawn to prevent.
 *
 * **Nothing here is stored.** The diff is computed from the tree on demand and handed to one
 * reader. There is no diff column in `ops.work_product`, no diff in a span, and no diff in a
 * prompt — see `work-product.md` §6 for the whole ruling and the reason `withhold()` cannot be
 * the answer to it.
 */
export async function readDiffPage(
  worktree: Pick<RunWorktree, 'path' | 'baseSha'>,
  options: { fromFile?: number; maxFiles?: number; maxLinesPerFile?: number } = {},
): Promise<DiffPage> {
  const maxFiles = options.maxFiles ?? MAX_DIFF_FILES_PER_PAGE;
  const maxLines = options.maxLinesPerFile ?? MAX_DIFF_LINES_PER_FILE;
  const from = options.fromFile ?? 0;
  const headSha = await git(worktree.path, ['rev-parse', 'HEAD']);

  const entries = await readFileList(worktree);
  const page = entries.slice(from, from + maxFiles);

  const files: DiffFile[] = [];
  for (const entry of page) {
    files.push(await readOneFile(worktree, entry, maxLines));
  }

  return {
    headSha,
    files,
    totalFiles: entries.length,
    nextCursor: from + maxFiles < entries.length ? String(from + maxFiles) : null,
  };
}

interface FileEntry {
  status: DiffFile['status'];
  oldPath: string | null;
  newPath: string | null;
  insertions: number;
  deletions: number;
  binary: boolean;
}

/**
 * The file axis, from `--numstat` and `--name-status` with `-z`.
 *
 * `-z` rather than newline-delimited, and that is not a preference: a path may contain a
 * newline, and a parser split on `\n` would read one file as two and mis-attribute both. It is
 * also why paths are never quoted-escaped here — `-z` disables the quoting `core.quotePath`
 * would otherwise apply to non-ASCII paths, which matters in a product whose second language is
 * Arabic.
 */
async function readFileList(worktree: Pick<RunWorktree, 'path' | 'baseSha'>): Promise<FileEntry[]> {
  const numstat = await git(worktree.path, ['diff', '--numstat', '-z', '-M', worktree.baseSha, '--']);
  const status = await git(worktree.path, ['diff', '--name-status', '-z', '-M', worktree.baseSha, '--']);

  const statusByPath = new Map<string, { code: string; oldPath: string | null }>();
  const statusFields = status.split('\0').filter((f) => f !== '');
  for (let i = 0; i < statusFields.length; ) {
    const code = statusFields[i] as string;
    if (code.startsWith('R') || code.startsWith('C')) {
      const oldPath = statusFields[i + 1] as string;
      const newPath = statusFields[i + 2] as string;
      statusByPath.set(newPath, { code, oldPath });
      i += 3;
    } else {
      const path = statusFields[i + 1] as string;
      statusByPath.set(path, { code, oldPath: null });
      i += 2;
    }
  }

  const entries: FileEntry[] = [];
  const fields = numstat.split('\0').filter((f) => f !== '');
  for (let i = 0; i < fields.length; ) {
    const record = fields[i] as string;
    const [added, removed, inlinePath] = record.split('\t');
    let oldPath: string | null = null;
    let newPath: string;
    if (inlinePath === '') {
      // A rename in `-z` numstat is three fields: the counts record with an empty path, then
      // the old path, then the new one.
      oldPath = fields[i + 1] as string;
      newPath = fields[i + 2] as string;
      i += 3;
    } else {
      newPath = inlinePath as string;
      i += 1;
    }

    const binary = added === '-' && removed === '-';
    const known = statusByPath.get(newPath);
    const code = known?.code ?? 'M';
    if (!oldPath) oldPath = known?.oldPath ?? null;

    entries.push({
      status: binary
        ? 'binary'
        : code.startsWith('R')
          ? 'renamed'
          : code.startsWith('A')
            ? 'added'
            : code.startsWith('D')
              ? 'deleted'
              : 'modified',
      oldPath: code.startsWith('A') ? null : (oldPath ?? newPath),
      newPath: code.startsWith('D') ? null : newPath,
      insertions: binary ? 0 : Number(added) || 0,
      deletions: binary ? 0 : Number(removed) || 0,
      binary,
    });
  }

  return entries;
}

/** One file's hunks, capped, with the cut declared. */
async function readOneFile(
  worktree: Pick<RunWorktree, 'path' | 'baseSha'>,
  entry: FileEntry,
  maxLines: number,
): Promise<DiffFile> {
  const base: DiffFile = {
    oldPath: entry.oldPath,
    newPath: entry.newPath,
    status: entry.status,
    insertions: entry.insertions,
    deletions: entry.deletions,
    hunks: null,
    truncated: false,
    linesWithheld: 0,
  };

  // **Binary files are flagged and never sent as bytes.** There is nothing a reviewer can read
  // in them on a phone, and shipping them would put arbitrary file content on the wire under a
  // field typed as text.
  if (entry.binary) return base;

  const target = entry.newPath ?? entry.oldPath;
  if (!target) return base;

  const raw = await git(worktree.path, [
    'diff',
    '--unified=3',
    '-M',
    worktree.baseSha,
    '--',
    ...(entry.oldPath && entry.oldPath !== entry.newPath ? [entry.oldPath, target] : [target]),
  ]);

  const hunks: DiffHunk[] = [];
  let current: DiffHunk | null = null;
  let emitted = 0;
  let withheld = 0;

  for (const line of raw.split('\n')) {
    const header = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
    if (header) {
      current = {
        header: line,
        oldStart: Number(header[1]),
        oldCount: header[2] === undefined ? 1 : Number(header[2]),
        newStart: Number(header[3]),
        newCount: header[4] === undefined ? 1 : Number(header[4]),
        lines: [],
      };
      hunks.push(current);
      continue;
    }
    if (!current) continue;
    if (line === '' || line.startsWith('\\')) continue;
    const origin = line[0];
    if (origin !== ' ' && origin !== '+' && origin !== '-') continue;
    if (emitted >= maxLines) {
      withheld += 1;
      continue;
    }
    current.lines.push({ origin, text: line.slice(1) });
    emitted += 1;
  }

  return {
    ...base,
    hunks,
    // **A cut that does not say it was cut is the declared-value defect wearing diff clothing:**
    // a reviewer approves code they were never shown. The count is the withheld lines, not a
    // percentage and not a vague "…".
    truncated: withheld > 0,
    linesWithheld: withheld,
  };
}

/** Everything this module knows about a run's tree, for the writer. `null` when there is none. */
export async function summarize(worktree: RunWorktree): Promise<WorktreeFacts> {
  return readWorktreeFacts(worktree);
}

export { RUN_BRANCH_PREFIX };
