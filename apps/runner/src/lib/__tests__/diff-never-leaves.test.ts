/**
 * **A diff is a body, and this build does not let one out** (M17 hazards 5 and 6, ADR-026,
 * `work-product.md` §6).
 *
 * Two rulings, one file, because they are the same sentence pointed at two exits:
 *
 *   **Hazard 6 — a diff must not reach a trace, an error string, or a model prompt.** This is
 *   the flattening finding at 100× the volume. A message body leaking through an interpolated
 *   error cost four rounds; a diff contains file contents, so the surface is the whole working
 *   tree. `withhold()` is the only mechanism that reaches interpolated text and it cannot help
 *   here: a diff would exhaust `MAX_LITERALS` instantly and the register now **refuses** rather
 *   than evicting, returning `false`. So the rule is not *withhold it* — it is **do not put it
 *   there**, and the mechanisms are that nothing stores it and nothing on those two planes can
 *   even import the function that produces it.
 *
 *   **Hazard 5 — M17 records push state; it does not push, open a PR, or merge.** A push sends
 *   code and commit messages to a third-party host, which is data egress; ADR-038 is `proposed`
 *   and awaiting a human. The mechanism is a scan for the verb, because a rule with no enforcer
 *   enforces nothing.
 *
 * Both scans carry vacuity controls and both are falsified in-file against planted text.
 */
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { git } from '../git.ts';
import { createWorktree, readDiffPage, readWorktreeFacts } from '../worktree.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const RUNNER_SRC = resolve(HERE, '..', '..');
const SELF = resolve(HERE, 'diff-never-leaves.test.ts');

async function* walk(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.name.endsWith('.ts')) yield full;
  }
}

/* -------------------------------------------------------------------------- *
 * Hazard 6 — the two planes that must not be able to reach a diff
 * -------------------------------------------------------------------------- */

test('nothing on the trace or prompt plane can even import the diff reader', async () => {
  /**
   * A **denylist of two planes**, not an allowlist of importers — and the distinction is the
   * standing finding. *An include-list is a decision to be blind to everything unnamed*: a list
   * of permitted importers would silently permit the next module nobody thought about. These
   * two are named because hazard 6 names them: `lib/prompt.ts` renders prior turns into the
   * model prompt, which leaves the tailnet under a region this repo has not asserted, and
   * `observability/` is where a span attribute is built.
   */
  const forbidden = [join(RUNNER_SRC, 'lib', 'prompt.ts'), join(RUNNER_SRC, 'observability')];
  const offenders: string[] = [];
  let scanned = 0;

  for (const root of forbidden) {
    const files: string[] = [];
    const info = await readdir(root, { withFileTypes: true }).catch(() => null);
    if (info === null) files.push(root);
    else for await (const file of walk(root)) files.push(file);

    for (const file of files) {
      if (file.startsWith(join(RUNNER_SRC, 'observability', '__tests__'))) continue;
      scanned += 1;
      const text = await readFile(file, 'utf8');
      if (/from\s+'[^']*worktree(\.ts)?'/.test(text) || /readDiffPage|DiffPage|DiffHunk/.test(text)) {
        offenders.push(relative(RUNNER_SRC, file));
      }
    }
  }

  assert.ok(scanned >= 5, `only ${scanned} files scanned — the walker is broken and this would pass by reading nothing`);
  assert.deepEqual(
    offenders,
    [],
    'A diff must not reach a span or a model prompt (work-product.md §6). `withhold()` cannot ' +
      'defend one: it refuses at MAX_LITERALS and returns false, which means the run is holding ' +
      'text it cannot scrub out of its own error strings.\n\n' + offenders.join('\n'),
  );
});

test('a run records counts and tells its thread nothing that contains a diff', async () => {
  // The runtime half. A fixture repository whose change is a line no redactor would catch —
  // free text with a name in it, exactly like `ops.message.body`, which is why key-based
  // redaction is not the answer here.
  const root = await mkdtemp(join(tmpdir(), 'agnetos-diff-leak-'));
  const repo = join(root, 'repo');
  await mkdir(repo, { recursive: true });
  await git(repo, ['init', '--initial-branch=main']);
  await git(repo, ['config', 'user.email', 'f@x']);
  await git(repo, ['config', 'user.name', 'F']);
  await writeFile(join(repo, 'notes.md'), 'nothing yet\n', 'utf8');
  await git(repo, ['add', '--', 'notes.md']);
  await git(repo, ['-c', 'user.email=f@x', '-c', 'user.name=F', 'commit', '-m', 'init']);

  const w = await createWorktree({ repoPath: repo, worktreeRoot: join(root, 'worktrees'), runId: 'run-leak' });
  const SECRET_LINE = 'Fatima Al-Harbi signs the Olaya lease on 3 March';
  await writeFile(join(w.path, 'notes.md'), `${SECRET_LINE}\n`, 'utf8');
  await git(w.path, ['add', '--', 'notes.md']);
  await git(w.path, ['-c', 'user.email=f@x', '-c', 'user.name=F', 'commit', '-m', 'note']);

  const facts = await readWorktreeFacts(w);
  // Everything the roster line and the row get, serialised. Not "we redacted it" — there is no
  // field for it to be in, which is the mechanism (`messageSpanAttributes` established the
  // shape: a type with nothing to forget).
  const serialisedFacts = JSON.stringify(facts);
  assert.equal(serialisedFacts.includes('Fatima'), false, 'the roster facts carry a name from the diff');
  assert.equal(serialisedFacts.includes('Olaya'), false);
  assert.equal(facts.insertions, 1, 'and they are still useful: the count is there');

  // …while the diff itself, read through the one route that may produce it, does carry it —
  // which is the point. The contract is *where* it may travel, not that it is unreadable.
  const page = await readDiffPage(w);
  assert.equal(
    JSON.stringify(page).includes(SECRET_LINE),
    true,
    'the review route serves the real diff to one reader; if this ever goes false the screen is ' +
      'showing a reviewer something other than the change',
  );

  await rm(root, { recursive: true, force: true });
});

/* -------------------------------------------------------------------------- *
 * Hazard 5 — no push, no PR, no merge, anywhere
 * -------------------------------------------------------------------------- */

/** A git invocation that would send anything to a remote, or a CLI that opens a PR. */
const EGRESS = /(['"`])push\1|git\s+push|gh\s+pr\s+(?:create|merge)|(['"`])remote\2/;

/**
 * The one way it may be written: on a line that says it is not done. Same device as the
 * superseded-route scanner, and for the same reason — a checker that cannot tell a prohibition
 * from a specification forces the prohibition to go unwritten.
 */
const PERMITTED = /never|not perform|does not|refus|forbid|no push|would|could/i;

test('no code path in the runner pushes, opens a PR, or merges', async () => {
  const offenders: string[] = [];
  let scanned = 0;

  for await (const file of walk(RUNNER_SRC)) {
    if (resolve(file) === SELF) continue;
    scanned += 1;
    const text = await readFile(file, 'utf8');
    for (const [index, line] of text.split(/\r?\n/).entries()) {
      if (!EGRESS.test(line)) continue;
      if (PERMITTED.test(line)) continue;
      offenders.push(`${relative(RUNNER_SRC, file)}:${index + 1}: ${line.trim()}`);
    }
  }

  assert.ok(scanned > 40, `only ${scanned} files scanned — the walker is broken`);
  assert.deepEqual(
    offenders,
    [],
    'M17 records push state; it does not push, open a PR, or merge (hazard 5). A push sends code ' +
      'and commit messages to a third-party host — data egress, and ADR-038 is `proposed`, ' +
      'awaiting a DPA answer and a region from a human. `push_state: pushed` stays reachable ' +
      'only because a *person* may have pushed the branch.\n\n' + offenders.join('\n'),
  );
});

test('the egress scanner would catch a planted push — falsified in place', () => {
  assert.equal(EGRESS.test(`await git(cwd, ['push', 'origin', branch]);`), true);
  assert.equal(EGRESS.test('await exec("git push --set-upstream origin HEAD");'), true);
  assert.equal(EGRESS.test('await exec("gh pr create --fill");'), true);
  assert.equal(EGRESS.test(`await git(repo, ['remote', 'add', 'origin', url]);`), true);

  // And what it must *not* catch, or it becomes a gate someone disables: the words in prose,
  // the observation of push state, and this milestone's own refusals.
  assert.equal(EGRESS.test("  pushState: 'local',"), false, 'observing is not pushing');
  assert.equal(EGRESS.test("const ahead = await git(p, ['rev-list', '--count', '@{u}..HEAD']);"), false);
  assert.equal(
    EGRESS.test('// M17 never runs git push') && PERMITTED.test('// M17 never runs git push'),
    true,
    'a line that forbids it is permitted to name it',
  );
});
