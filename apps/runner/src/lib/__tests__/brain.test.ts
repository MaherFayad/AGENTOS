/**
 * Brain completeness (§3.3) — the number the galaxy's particle count and brightness scale
 * with, so it is a progress indicator a person reads as truth.
 *
 * `fidelity-qa-reviewer` found it reporting **45%** against a COMPANY.md whose own header
 * says "0 of 20 answered" and which carries all twenty `<!-- UNANSWERED -->` markers: the
 * character-count heuristic was reading the template's *instructions* as the section's
 * *answer*. Step 0.4 of the v2 plan is "answer the twenty questions", and its entire
 * feedback loop is watching this number move — a counter that starts at 45% destroys it.
 *
 * The heuristic is gone. The counter is now `scripts/lib/brain-completeness.mjs`
 * (`map-galaxy-engineer`'s), shared with `scripts/build-graph.mjs` so the two producers
 * that disagreed cannot disagree again. These tests pin the runner's half of that: the
 * shapes it returns, and that it never reports more than the markers admit.
 */
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../config.ts';
import { computeBrainCompleteness, writeBackBrain, INTERVIEW_AGENT_SLUG } from '../brain.ts';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..');

/**
 * A fixture repo needs `scripts/lib/` reachable, because the runner imports the counter
 * from the repo root rather than reimplementing it — that indirection is the fix, so the
 * test exercises it rather than stubbing past it.
 */
async function brainOf(markdown: string | null) {
  const root = await mkdtemp(join(tmpdir(), 'agnetos-brain-'));
  await mkdir(join(root, 'company', 'sources'), { recursive: true });
  await mkdir(join(root, 'agents'), { recursive: true });
  await mkdir(join(root, 'scripts', 'lib'), { recursive: true });
  await writeFile(
    join(root, 'scripts', 'lib', 'brain-completeness.mjs'),
    `export * from ${JSON.stringify(
      new URL('file://' + join(REPO, 'scripts', 'lib', 'brain-completeness.mjs').replace(/\\/g, '/')).href,
    )};\n`,
    'utf8',
  );
  if (markdown !== null) await writeFile(join(root, 'company', 'COMPANY.md'), markdown, 'utf8');

  const previous = process.env.AGNETOS_REPO_ROOT;
  process.env.AGNETOS_REPO_ROOT = root;
  try {
    return await computeBrainCompleteness(loadConfig());
  } finally {
    if (previous === undefined) delete process.env.AGNETOS_REPO_ROOT;
    else process.env.AGNETOS_REPO_ROOT = previous;
  }
}

test('a section of instructions with an UNANSWERED marker scores nothing, however long', async () => {
  const brain = await brainOf(
    [
      '## 3. ICP',
      '',
      'Sector · size · geography · maturity · who signs. Then the exclusion list — the client',
      'shape we regret — which `sales/database-mining` applies before scoring, not after.',
      '',
      '<!-- UNANSWERED: Q7 best client -->',
      '',
    ].join('\n'),
  );
  assert.equal(brain.answered, 19, 'exactly one question is still marked');
  assert.deepEqual(brain.missing, ['Q7'], 'the gap is named by question, so it is findable');
  assert.equal(brain.total, 20);
});

test('a missing COMPANY.md is 0, with every question named — the honest empty state', async () => {
  const brain = await brainOf(null);
  assert.equal(brain.value, 0);
  assert.equal(brain.answered, 0);
  assert.equal(brain.missing.length, 20);
  assert.deepEqual(brain.missing.slice(0, 3), ['Q1', 'Q2', 'Q3']);
  assert.equal(brain.updatedAt, null);
});

test('`sources/` is reported but never blended into the score', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agnetos-brain-src-'));
  await mkdir(join(root, 'company', 'sources'), { recursive: true });
  await mkdir(join(root, 'agents'), { recursive: true });
  await writeFile(join(root, 'company', 'sources', 'deck.md'), 'x', 'utf8');
  await writeFile(join(root, 'company', 'sources', 'pricing.md'), 'x', 'utf8');
  await writeFile(
    join(root, 'company', 'COMPANY.md'),
    Array.from({ length: 20 }, (_, i) => `<!-- UNANSWERED: Q${i + 1} -->`).join('\n'),
    'utf8',
  );
  const previous = process.env.AGNETOS_REPO_ROOT;
  process.env.AGNETOS_REPO_ROOT = root;
  try {
    const brain = await computeBrainCompleteness(loadConfig());
    assert.equal(brain.sources, 2, 'files are counted…');
    assert.equal(brain.value, 0, '…and cannot move the score. Dropping in PDFs is not answering.');
  } finally {
    if (previous === undefined) delete process.env.AGNETOS_REPO_ROOT;
    else process.env.AGNETOS_REPO_ROOT = previous;
  }
});

test('an unreachable counter reports zero — never a guess, never higher than the truth', async () => {
  // No `scripts/lib/brain-completeness.mjs` in this fixture: the container case where
  // `scripts/` is not mounted. Falling back to a local heuristic is what produced the bug.
  const root = await mkdtemp(join(tmpdir(), 'agnetos-brain-nocounter-'));
  await mkdir(join(root, 'company', 'sources'), { recursive: true });
  await mkdir(join(root, 'agents'), { recursive: true });
  await writeFile(join(root, 'company', 'COMPANY.md'), '## Pricing\n\nSAR 18,000/month.\n', 'utf8');
  const previous = process.env.AGNETOS_REPO_ROOT;
  process.env.AGNETOS_REPO_ROOT = root;
  try {
    const brain = await computeBrainCompleteness(loadConfig());
    assert.equal(brain.value, 0);
    assert.equal(brain.answered, 0);
    assert.equal(brain.missing.length, 20);
  } finally {
    if (previous === undefined) delete process.env.AGNETOS_REPO_ROOT;
    else process.env.AGNETOS_REPO_ROOT = previous;
  }
});

test("the repo's own COMPANY.md is 0 of 20 before the interview has ever run", async () => {
  const previous = process.env.AGNETOS_REPO_ROOT;
  process.env.AGNETOS_REPO_ROOT = REPO;
  try {
    const brain = await computeBrainCompleteness(loadConfig());
    assert.equal(brain.answered, 0, 'COMPANY.md:18 says "0 of 20 answered"; the counter must agree');
    assert.equal(brain.value, 0);
    assert.equal(brain.total, 20);
    assert.equal(brain.missing.length, 20);
  } finally {
    if (previous === undefined) delete process.env.AGNETOS_REPO_ROOT;
    else process.env.AGNETOS_REPO_ROOT = previous;
  }
});

// --- writeBackBrain: a document the interview produced is not a replacement brain ---

const REAL_BRAIN = [
  '# COMPANY.md',
  '',
  '## 1. Identity',
  'We build agent systems.',
  '<!-- UNANSWERED: Q2 -->',
  '## 2. Offers',
  'Retainers and projects.',
  '## 3. ICP',
  'Gulf SMEs.',
  '## 4. Pricing',
  'From SAR 18,000.',
  '## 5. Voice',
  'Plain, specific, unhurried.',
  '',
].join('\n');

const GAP_REPORT =
  '# Gap report\n\nSections that are thin: identity, offers, pricing. Nine of twenty answered.\n';

async function writeBackFixture(
  markdown: string,
  inputs: Record<string, unknown>,
  git = false,
) {
  const root = await mkdtemp(join(tmpdir(), 'agnetos-writeback-'));
  await mkdir(join(root, 'company', 'sources'), { recursive: true });
  await mkdir(join(root, 'agents'), { recursive: true });
  await mkdir(join(root, 'scratch'), { recursive: true });
  if (git) {
    for (const args of [['init', '-q'], ['config', 'user.email', 't@t'], ['config', 'user.name', 't']]) {
      await new Promise<void>((done, fail) => {
        execFile('git', args, { cwd: root }, (err) => (err ? fail(err) : done()));
      });
    }
  }
  const before = '## 1. Identity\n\nThe brain as it stands, which must survive.\n';
  await writeFile(join(root, 'company', 'COMPANY.md'), before, 'utf8');
  const artifactPath = join(root, 'scratch', 'output.md');
  await writeFile(artifactPath, markdown, 'utf8');

  const previous = process.env.AGNETOS_REPO_ROOT;
  process.env.AGNETOS_REPO_ROOT = root;
  try {
    const result = await writeBackBrain(
      loadConfig(),
      INTERVIEW_AGENT_SLUG,
      { absolutePath: artifactPath, kind: 'md' },
      inputs,
    );
    const after = await readFile(join(root, 'company', 'COMPANY.md'), 'utf8');
    return { result, after, unchanged: after === before };
  } finally {
    if (previous === undefined) delete process.env.AGNETOS_REPO_ROOT;
    else process.env.AGNETOS_REPO_ROOT = previous;
  }
}

test('review-gaps never replaces the brain, however good its report looks', async () => {
  const { result, unchanged } = await writeBackFixture(REAL_BRAIN, { mode: 'review-gaps' });
  assert.equal(result, null, 'the mode the human chose is consulted, not just the slug');
  assert.equal(unchanged, true, 'COMPANY.md is byte-identical');
});

test('a gap report in a writing mode is still refused — it does not look like the brain', async () => {
  // Belt and braces: if the mode is wrong or absent, the artifact must still carry the
  // brain's structure. "Any .md over 40 chars" was the whole guard before today.
  const { result, unchanged } = await writeBackFixture(GAP_REPORT, { mode: 'first-run' });
  assert.equal(result, null);
  assert.equal(unchanged, true);
});

test('a real brain in first-run mode IS written back — the guard confines, it does not block', async () => {
  // The step-0.4 path. It must survive both new checks, or answering twenty questions
  // lands nowhere. `git: true` because the write-back commits (§3.3: git is the brain's
  // version history), and a fixture without a repo fails at the commit, not at the guard.
  const { result, after } = await writeBackFixture(REAL_BRAIN, { mode: 'first-run' }, true);
  assert.ok(result, 'the path step 0.4 depends on must still work');
  assert.equal(after, REAL_BRAIN);
  assert.equal(result.path, 'company/COMPANY.md');
  assert.ok(result.commitSha.length > 0, 'and it is committed — git history is brain versioning');
});
