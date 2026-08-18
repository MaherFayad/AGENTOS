/**
 * **Worktree isolation, against real git** (M17, `Plan §13`, ADR-026).
 *
 * ## Why this file is the milestone's evidence
 *
 * M17's frame sets three evidence tiers and one hard bar: *the milestone may not close on
 * `structural` for the worktree mechanic.* Everything else in M17 — the table, the writer, the
 * outcome fields — describes something that has not happened. **This does not.** Git is local:
 * `git worktree add` against a temp fixture repository is a real operation with a real
 * filesystem outcome, and it needs no API key, no Postgres and no model call. Every test below
 * runs `git` against a repository this file created.
 *
 * What it therefore proves, exactly:
 *
 *   - N concurrent `createWorktree` calls yield **N distinct, non-nested paths**;
 *   - no two share a `.git/index`, which is the file that makes "run three agents at once
 *     corrupts all three" true when it is shared;
 *   - cleanup of one live worktree **does not touch a sibling**;
 *   - a killed run leaves a **prunable** worktree, not a locked repository;
 *   - the counts on the roster line come from git rather than from an agent's claim;
 *   - a diff arrives as **structure**, capped, with the cut declared.
 *
 * What it does not prove, stated so nobody quotes it as more: **that three real agents running
 * concurrently stay correct.** Three real agents have never run. This is the mechanism under
 * them, exercised alone.
 *
 * ## Falsification
 *
 * Two planted defects, both watched red and reverted, and one of them is kept **in the file**
 * as an executable control (`the concurrency assertion would catch a constant path`) — because a
 * gate nobody has seen fail is a gate nobody should believe, and this is the gate the milestone
 * rests on.
 */
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { git } from '../git.ts';
import { resolveAllowlist } from '../allowlist.ts';
import { isPathInsideRunRoots } from '../allowlist.ts';
import {
  assertRepoUsable,
  assertWorktreeConfinable,
  createWorktree,
  listWorktrees,
  MAX_DIFF_LINES_PER_FILE,
  pruneWorktrees,
  readDiffPage,
  readWorktreeFacts,
  removeWorktree,
} from '../worktree.ts';

/** A real repository with one commit. Every test gets its own. */
async function fixtureRepo(): Promise<{ repo: string; worktrees: string }> {
  const root = await mkdtemp(join(tmpdir(), 'agnetos-worktree-'));
  const repo = join(root, 'repo');
  const worktrees = join(root, 'worktrees');
  await mkdir(repo, { recursive: true });
  await git(repo, ['init', '--initial-branch=main']);
  await git(repo, ['config', 'user.email', 'fixture@agnetos.local']);
  await git(repo, ['config', 'user.name', 'Fixture']);
  await writeFile(join(repo, 'README.md'), '# fixture\n\nline one\nline two\n', 'utf8');
  await git(repo, ['add', '--', 'README.md']);
  await git(repo, ['-c', 'user.email=f@x', '-c', 'user.name=F', 'commit', '-m', 'initial', '--', 'README.md']);
  return { repo, worktrees };
}

/* -------------------------------------------------------------------------- *
 * 1. The hard bar — concurrency
 * -------------------------------------------------------------------------- */

test('N concurrent runs get N distinct, non-nested worktrees with separate indexes', async () => {
  const { repo, worktrees } = await fixtureRepo();
  const runIds = ['run-a', 'run-b', 'run-c'];

  // Concurrent on purpose. Serial creation would pass with a mechanism that cannot survive the
  // thing §13 names — *"run three agents at once"* — and this is the only assertion in the
  // milestone that can see the difference.
  const created = await Promise.all(
    runIds.map((runId) => createWorktree({ repoPath: repo, worktreeRoot: worktrees, runId })),
  );

  const paths = created.map((w) => resolve(w.path));
  assert.equal(new Set(paths).size, 3, 'three runs, three paths');
  assert.equal(new Set(created.map((w) => w.branch)).size, 3, 'and three branches');

  // Non-nested, pairwise. A tree inside another tree is not isolation: the outer one's `git
  // status` shows the inner one's files and `git clean` in the outer deletes them.
  for (const a of paths) {
    for (const b of paths) {
      if (a === b) continue;
      const rel = relative(a, b);
      assert.ok(
        rel.startsWith('..') || rel === '',
        `${b} is nested inside ${a} — one run's tree is inside another's`,
      );
    }
  }

  // **The file that decides whether they corrupt each other.** Each linked worktree has its own
  // `.git` *file* pointing at `repo/.git/worktrees/<name>`, and its own index inside that
  // directory. If two runs shared an index, `git add` in one would stage the other's changes.
  const indexes = await Promise.all(
    paths.map((p) => git(p, ['rev-parse', '--path-format=absolute', '--git-path', 'index'])),
  );
  assert.equal(new Set(indexes.map((i) => resolve(i))).size, 3, 'three separate .git/index files');

  const gitFiles = await Promise.all(paths.map((p) => readFile(join(p, '.git'), 'utf8')));
  assert.equal(new Set(gitFiles).size, 3, 'and three distinct .git pointers');

  // Each tree is a real checkout with the fixture's content in it.
  for (const p of paths) {
    const readme = await readFile(join(p, 'README.md'), 'utf8');
    assert.match(readme, /# fixture/);
  }

  await rm(resolve(worktrees, '..'), { recursive: true, force: true });
});

test('the concurrency assertion would catch a constant path — falsified in place', () => {
  // The frame names the falsification: *"falsify by returning a constant path."* Rather than
  // describe it, the assertion is run against exactly that: three runs whose mechanic handed
  // back one directory. The set collapses to one and the check fails, which is what makes the
  // green above worth reading.
  const constant = ['/tmp/wt', '/tmp/wt', '/tmp/wt'];
  assert.equal(new Set(constant).size, 1);
  assert.throws(
    () => assert.equal(new Set(constant).size, 3, 'three runs, three paths'),
    /three runs, three paths/,
    'the assertion that carries this milestone must be able to fail',
  );

  // And nesting: a mechanic that put each run inside the previous one would pass a
  // distinctness check and still share a tree. That is why both are asserted.
  const nested = ['/tmp/wt', '/tmp/wt/inner'];
  assert.equal(relative(nested[0] as string, nested[1] as string).startsWith('..'), false);
});

/* -------------------------------------------------------------------------- *
 * 2. Cleanup, and the killed run
 * -------------------------------------------------------------------------- */

test('removing one worktree leaves its siblings untouched', async () => {
  const { repo, worktrees } = await fixtureRepo();
  const a = await createWorktree({ repoPath: repo, worktreeRoot: worktrees, runId: 'run-a' });
  const b = await createWorktree({ repoPath: repo, worktreeRoot: worktrees, runId: 'run-b' });

  await writeFile(join(b.path, 'work.md'), 'b was here\n', 'utf8');
  await removeWorktree(repo, a.path);

  assert.equal(await stat(a.path).then(() => true, () => false), false, 'the removed tree is gone');
  assert.equal(
    await readFile(join(b.path, 'work.md'), 'utf8'),
    'b was here\n',
    "the sibling's uncommitted work survived — removing one run's tree must not touch another's",
  );

  const listed = await listWorktrees(repo);
  assert.deepEqual(listed.map((p) => resolve(p)), [resolve(b.path)], 'and git agrees which one is left');

  await rm(resolve(worktrees, '..'), { recursive: true, force: true });
});

test('a killed run leaves a prunable worktree, not a locked repository', async () => {
  const { repo, worktrees } = await fixtureRepo();
  const dead = await createWorktree({ repoPath: repo, worktreeRoot: worktrees, runId: 'run-dead' });
  const live = await createWorktree({ repoPath: repo, worktreeRoot: worktrees, runId: 'run-live' });

  // The process died and its directory went with it — no `git worktree remove` ever ran. This
  // is the state the repository is actually left in by a kill -9, and the requirement is that
  // the *next* run can still work rather than meeting a repository git considers busy.
  await rm(dead.path, { recursive: true, force: true });

  const reclaimed = await pruneWorktrees(repo);
  assert.equal(reclaimed.length, 1, `expected one prunable tree, got ${JSON.stringify(reclaimed)}`);
  assert.equal(resolve(reclaimed[0] as string), resolve(dead.path), 'and it is the dead one, by path');

  // The live one is untouched and still usable — the whole point of "prunable, not locked".
  const listed = await listWorktrees(repo);
  assert.deepEqual(listed.map((p) => resolve(p)), [resolve(live.path)]);
  await writeFile(join(live.path, 'still-working.md'), 'yes\n', 'utf8');

  // And the repository can still cut a new tree afterwards.
  const next = await createWorktree({ repoPath: repo, worktreeRoot: worktrees, runId: 'run-after' });
  assert.ok(await stat(next.path).then(() => true, () => false));

  await rm(resolve(worktrees, '..'), { recursive: true, force: true });
});

test('removeWorktree is idempotent when the directory is already gone', async () => {
  const { repo, worktrees } = await fixtureRepo();
  const w = await createWorktree({ repoPath: repo, worktreeRoot: worktrees, runId: 'run-x' });
  await rm(w.path, { recursive: true, force: true });
  // A caller cleaning up after a crash must not have to classify this: `git worktree remove` on
  // a missing directory is an error, and treating it as one would turn tidy-up into a failure.
  await removeWorktree(repo, w.path);
  assert.deepEqual(await listWorktrees(repo), []);
  await rm(resolve(worktrees, '..'), { recursive: true, force: true });
});

/* -------------------------------------------------------------------------- *
 * 3. Refusals — before anything exists
 * -------------------------------------------------------------------------- */

test('a worktree inside the repository is refused, not normalised', async () => {
  const { repo } = await fixtureRepo();
  await assert.rejects(
    () => createWorktree({ repoPath: repo, worktreeRoot: join(repo, 'nested'), runId: 'run-a' }),
    (err: { code?: string }) => err.code === 'bad_request',
  );
  assert.deepEqual(await listWorktrees(repo), [], 'and nothing was created before the refusal');
});

test('a directory that is not a git checkout is repo_unavailable, not a crash', async () => {
  const plain = await mkdtemp(join(tmpdir(), 'agnetos-not-a-repo-'));
  await assert.rejects(
    () => assertRepoUsable(plain),
    (err: { code?: string; hint?: string }) => {
      assert.equal(err.code, 'repo_unavailable');
      assert.match(String(err.hint), /Nothing was started/);
      return true;
    },
  );
  await assert.rejects(
    () => assertRepoUsable(join(plain, 'does-not-exist')),
    (err: { code?: string }) => err.code === 'repo_unavailable',
  );
});

test('a run holding an ungated connector is refused a worktree, and the refusal names it', () => {
  // **The hazard nobody had named until M17's frame: a worktree is not a jail.** This is the
  // whole of what this build does about it — a refusal rather than a claim.
  assert.throws(
    () => assertWorktreeConfinable(resolveAllowlist(['workspace', 'shell']), 'sales/probe'),
    (err: { code?: string; message?: string }) => {
      assert.equal(err.code, 'worktree_unconfinable');
      assert.match(String(err.message), /shell/);
      return true;
    },
  );

  // `workspace` alone is gated per path argument, so it is confinable and gets a tree.
  assert.doesNotThrow(() => assertWorktreeConfinable(resolveAllowlist(['workspace', 'exa']), 'sales/probe'));

  // **And the honest half, asserted rather than described:** the path gate cannot see inside a
  // shell command, so if a run with `shell` ever *were* given a worktree, nothing would stop it
  // leaving. This assertion is the reason the refusal above exists, and it is written as a
  // passing test on purpose — so nobody reads the gate as confinement it is not.
  assert.equal(
    isPathInsideRunRoots(['/run/worktree'], { command: 'cat /repo/.env' }),
    true,
    'a Bash command carries no path argument, so the gate allows it — which is why a run that ' +
      'holds Bash is refused a worktree instead of being confined to one',
  );
  assert.equal(
    isPathInsideRunRoots(['/run/worktree'], { file_path: '/repo/.env' }),
    false,
    'a declared path, by contrast, is checked — and refused',
  );
});

/* -------------------------------------------------------------------------- *
 * 4. The facts on the roster line come from git
 * -------------------------------------------------------------------------- */

test('counts and push state are observed, and push state carries the time it was observed', async () => {
  const { repo, worktrees } = await fixtureRepo();
  const w = await createWorktree({ repoPath: repo, worktreeRoot: worktrees, runId: 'run-facts' });

  const before = new Date().toISOString();
  const empty = await readWorktreeFacts(w);
  assert.equal(empty.commits, 0);
  assert.equal(empty.filesChanged, 0);
  assert.equal(empty.pushState, 'none', 'nothing to push, and we looked');
  assert.ok(empty.pushCheckedAt >= before, 'the time is the observation, not a default');

  // Uncommitted work counts: a run that wrote files and did not commit has still produced
  // something a person needs to see on the roster.
  await writeFile(join(w.path, 'README.md'), '# fixture\n\nline one\nline two\nline three\n', 'utf8');
  await writeFile(join(w.path, 'new.md'), 'brand new\n', 'utf8');
  const dirty = await readWorktreeFacts(w);
  assert.equal(dirty.filesChanged, 1, 'the tracked file shows; an untracked one is not a diff yet');
  assert.equal(dirty.insertions, 1);
  assert.equal(dirty.deletions, 0);

  await git(w.path, ['add', '--', 'README.md', 'new.md']);
  await git(w.path, ['-c', 'user.email=f@x', '-c', 'user.name=F', 'commit', '-m', 'work']);
  const committed = await readWorktreeFacts(w);
  assert.equal(committed.commits, 1);
  assert.equal(committed.filesChanged, 2, 'both files, once the new one is tracked');
  assert.equal(
    committed.pushState,
    'local',
    'commits with no upstream exist on this machine only — the state ⚠ UNPUSHED renders',
  );
  assert.notEqual(committed.headSha, committed.baseSha, 'and the head moved');

  await rm(resolve(worktrees, '..'), { recursive: true, force: true });
});

/* -------------------------------------------------------------------------- *
 * 5. The diff arrives as structure, capped, with the cut declared
 * -------------------------------------------------------------------------- */

test('a diff page is parsed structure, never text the client has to parse', async () => {
  const { repo, worktrees } = await fixtureRepo();
  const w = await createWorktree({ repoPath: repo, worktreeRoot: worktrees, runId: 'run-diff' });

  await writeFile(join(w.path, 'README.md'), '# fixture\n\nline one\nline two changed\n', 'utf8');
  await writeFile(join(w.path, 'added.md'), 'a new file\n', 'utf8');
  await git(w.path, ['add', '--', 'README.md', 'added.md']);
  await git(w.path, ['-c', 'user.email=f@x', '-c', 'user.name=F', 'commit', '-m', 'edit']);

  const page = await readDiffPage(w);
  assert.equal(page.totalFiles, 2, 'a file list that cannot say how many files there are is unreadable');
  assert.equal(page.nextCursor, null, 'two files fit on one page');
  assert.match(page.headSha, /^[0-9a-f]{40}$/, 'the page is pinned to a tree state');

  const added = page.files.find((f) => f.newPath === 'added.md');
  assert.ok(added, 'the added file is a row');
  assert.equal(added.status, 'added');
  assert.equal(added.oldPath, null, 'an added file has no old path');
  assert.ok(added.hunks && added.hunks.length > 0, 'and it arrives as hunks');
  assert.deepEqual(added.hunks[0]?.lines, [{ origin: '+', text: 'a new file' }]);
  assert.equal(
    added.hunks[0]?.lines[0]?.text.startsWith('+'),
    false,
    'the origin is a field, not a character the client has to strip',
  );

  const modified = page.files.find((f) => f.newPath === 'README.md');
  assert.ok(modified);
  assert.equal(modified.status, 'modified');
  assert.equal(modified.insertions, 1);
  assert.equal(modified.deletions, 1);
  assert.equal(modified.truncated, false);
  assert.equal(modified.linesWithheld, 0);

  await rm(resolve(worktrees, '..'), { recursive: true, force: true });
});

test('a big file is cut, and the cut is declared with a count', async () => {
  const { repo, worktrees } = await fixtureRepo();
  const w = await createWorktree({ repoPath: repo, worktreeRoot: worktrees, runId: 'run-big' });

  const lines = Array.from({ length: MAX_DIFF_LINES_PER_FILE + 250 }, (_, i) => `line ${i}`);
  await writeFile(join(w.path, 'big.md'), `${lines.join('\n')}\n`, 'utf8');
  await git(w.path, ['add', '--', 'big.md']);
  await git(w.path, ['-c', 'user.email=f@x', '-c', 'user.name=F', 'commit', '-m', 'big']);

  const page = await readDiffPage(w);
  const big = page.files.find((f) => f.newPath === 'big.md');
  assert.ok(big);
  assert.equal(big.truncated, true, 'the body was cut');
  assert.equal(big.linesWithheld, 250, 'and it says how many lines were withheld, exactly');
  const emitted = (big.hunks ?? []).reduce((n, h) => n + h.lines.length, 0);
  assert.equal(emitted, MAX_DIFF_LINES_PER_FILE, 'no more than the cap reached the payload');
  assert.equal(
    big.insertions,
    MAX_DIFF_LINES_PER_FILE + 250,
    'and the count still reports the whole change — a cut body must not shrink the number ' +
      'beside it, or the reviewer is told the change is smaller than it is',
  );

  await rm(resolve(worktrees, '..'), { recursive: true, force: true });
});

test('the file axis paginates, with a stable order and a total on every page', async () => {
  const { repo, worktrees } = await fixtureRepo();
  const w = await createWorktree({ repoPath: repo, worktreeRoot: worktrees, runId: 'run-many' });

  for (let i = 0; i < 5; i += 1) await writeFile(join(w.path, `f${i}.md`), `file ${i}\n`, 'utf8');
  await git(w.path, ['add', '--all']);
  await git(w.path, ['-c', 'user.email=f@x', '-c', 'user.name=F', 'commit', '-m', 'many']);

  const first = await readDiffPage(w, { maxFiles: 2 });
  assert.equal(first.files.length, 2);
  assert.equal(first.totalFiles, 5, 'the total is on the first page, not computed by the client');
  assert.equal(first.nextCursor, '2');

  const second = await readDiffPage(w, { maxFiles: 2, fromFile: 2 });
  assert.equal(second.nextCursor, '4');
  assert.equal(second.headSha, first.headSha, 'both pages are the same tree state');

  const seen = [...first.files, ...second.files].map((f) => f.newPath);
  assert.equal(new Set(seen).size, 4, 'pages do not overlap');

  await rm(resolve(worktrees, '..'), { recursive: true, force: true });
});

test('a binary file is flagged and its bytes are never sent', async () => {
  const { repo, worktrees } = await fixtureRepo();
  const w = await createWorktree({ repoPath: repo, worktreeRoot: worktrees, runId: 'run-bin' });

  await writeFile(join(w.path, 'blob.bin'), Buffer.from([0, 1, 2, 0, 255, 0, 7, 0]));
  await git(w.path, ['add', '--', 'blob.bin']);
  await git(w.path, ['-c', 'user.email=f@x', '-c', 'user.name=F', 'commit', '-m', 'binary']);

  const page = await readDiffPage(w);
  const blob = page.files.find((f) => f.newPath === 'blob.bin');
  assert.ok(blob, 'it is still a row — a reviewer must know it changed');
  assert.equal(blob.status, 'binary');
  assert.equal(blob.hunks, null, 'and it carries no body at all');
  assert.equal(blob.insertions, 0, 'binary has no line counts, and 0 is the honest value');

  await rm(resolve(worktrees, '..'), { recursive: true, force: true });
});

test('a rename is one row carrying both paths', async () => {
  const { repo, worktrees } = await fixtureRepo();
  const w = await createWorktree({ repoPath: repo, worktreeRoot: worktrees, runId: 'run-rename' });

  await git(w.path, ['mv', 'README.md', 'DOCS.md']);
  await git(w.path, ['-c', 'user.email=f@x', '-c', 'user.name=F', 'commit', '-m', 'rename']);

  const page = await readDiffPage(w);
  assert.equal(page.totalFiles, 1, 'a rename is one file, not a delete plus an add');
  const renamed = page.files[0];
  assert.equal(renamed?.status, 'renamed');
  assert.equal(renamed?.oldPath, 'README.md');
  assert.equal(renamed?.newPath, 'DOCS.md');

  await rm(resolve(worktrees, '..'), { recursive: true, force: true });
});
