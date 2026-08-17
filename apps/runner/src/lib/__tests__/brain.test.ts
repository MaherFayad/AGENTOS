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
import { mountedProject } from '../project.ts';
import {
  brainWriteRef,
  computeBrainCompleteness,
  writeBackBrain,
  INTERVIEW_AGENT_SLUG,
} from '../brain.ts';

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

const BEFORE = '## 1. Identity\n\nThe brain as it stands, which must survive.\n';

/**
 * Build a repo fixture with a brain, an artifact and (optionally) a git repo.
 *
 * Returns the pieces rather than running the write-back, because the isolation tests below
 * need to hand `writeBackBrain` a project and a ref that **disagree** — which is the whole
 * question — and a fixture that computed both from one config could not express that.
 */
async function repoFixture(markdown: string, git = false) {
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
  await writeFile(join(root, 'company', 'COMPANY.md'), BEFORE, 'utf8');
  const artifactPath = join(root, 'scratch', 'output.md');
  await writeFile(artifactPath, markdown, 'utf8');
  return { root, artifactPath, brainPath: join(root, 'company', 'COMPANY.md') };
}

/** Run `fn` with `AGNETOS_REPO_ROOT` pointed at a fixture, and put it back afterwards. */
async function withRepoRoot<T>(root: string, fn: () => Promise<T>): Promise<T> {
  const previous = process.env.AGNETOS_REPO_ROOT;
  process.env.AGNETOS_REPO_ROOT = root;
  try {
    return await fn();
  } finally {
    if (previous === undefined) delete process.env.AGNETOS_REPO_ROOT;
    else process.env.AGNETOS_REPO_ROOT = previous;
  }
}

async function writeBackFixture(
  markdown: string,
  inputs: Record<string, unknown>,
  git = false,
) {
  const { root, artifactPath, brainPath } = await repoFixture(markdown, git);
  return withRepoRoot(root, async () => {
    const config = loadConfig();
    const project = mountedProject(config);
    const result = await writeBackBrain(
      config,
      project,
      brainWriteRef(project),
      { absolutePath: artifactPath, kind: 'md' },
      inputs,
    );
    const after = await readFile(brainPath, 'utf8');
    return { result, after, unchanged: after === BEFORE };
  });
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

/* --------------------------------------------------------------------------
 * Cross-project isolation on the brain's WRITE path.
 *
 * `company/COMPANY.md` rule 9 states the failure in full: every project has its own
 * `intelligence/company-interview`, so a gate keyed on `department/slug` and a target read
 * from one configured `companyFile` are **both** project-blind. At N=2, project two's
 * interview overwrites project one's brain and the commit that follows enshrines the
 * overwrite as that brain's history — on the file §3.3 injects into every subsequent run of
 * the project it just destroyed. No error message, no defect anywhere else.
 *
 * These three tests are the structural proof that the mechanism is now the mechanism. They
 * do not need a database, an API key or a second real library, which is why they are
 * obtainable in M15 at all: `project-scoping.md` §6 says cross-project isolation can only be
 * proved **structurally** here, and this is what structurally means on a write path.
 * -------------------------------------------------------------------------- */

/** A second project mounted from the same coordinator, with its own library on disk. */
async function secondProject(root: string) {
  const dir = join(root, 'projects', 'client-b');
  await mkdir(join(dir, 'company', 'sources'), { recursive: true });
  await mkdir(join(dir, 'agents'), { recursive: true });
  await writeFile(join(dir, 'company', 'COMPANY.md'), '## 1. Identity\n\nClient B.\n', 'utf8');
  return {
    id: 'ignored-in-these-tests',
    slug: 'client-b',
    name: 'Client B',
    status: 'active' as const,
    libraryPath: dir,
    workspaceRoot: join(dir, 'scratch'),
    agentsDir: join(dir, 'agents'),
    overridesDir: join(dir, 'agents', '_overrides'),
    companyDir: join(dir, 'company'),
    companyFile: join(dir, 'company', 'COMPANY.md'),
    companySourcesDir: join(dir, 'company', 'sources'),
    panelsDir: join(dir, 'panels'),
    graphFile: join(dir, 'graph.json'),
  };
}

test("project two's interview cannot overwrite project one's brain", async () => {
  const { root, artifactPath, brainPath } = await repoFixture(REAL_BRAIN, true);
  await withRepoRoot(root, async () => {
    const config = loadConfig();
    const projectOne = mountedProject(config);
    const projectTwo = await secondProject(root);

    // The exact shape of the failure rule 9 describes: the *same* agent, `department/slug`
    // identical in both libraries, running for client-b, handed project one's mount.
    const result = await writeBackBrain(
      config,
      projectOne,
      brainWriteRef(projectTwo),
      { absolutePath: artifactPath, kind: 'md' },
      { mode: 'first-run' },
    );

    assert.equal(result, null, 'refused: the agent_ref names client-b, the mount is agentos');
    assert.equal(
      await readFile(brainPath, 'utf8'),
      BEFORE,
      "project one's brain is byte-identical — and therefore nothing was committed over it",
    );
  });
});

test('the target is derived from the mounted project, not from a path in the config', async () => {
  // The other half of the same gate. If the file written were `config.companyFile`, this
  // would write project one's brain while claiming to be client-b's run — which is the
  // overwrite above arriving from the write side instead of the gate side.
  const { root, artifactPath, brainPath } = await repoFixture(REAL_BRAIN, true);
  await withRepoRoot(root, async () => {
    const config = loadConfig();
    // Mounted as client-b, but sharing the fixture's git repo so the commit can succeed.
    const projectTwo = { ...(await secondProject(root)), companyDir: join(root, 'company') };
    projectTwo.companyFile = join(root, 'company', 'CLIENT-B.md');
    projectTwo.companySourcesDir = join(root, 'company', 'sources');

    const result = await writeBackBrain(
      config,
      projectTwo,
      brainWriteRef(projectTwo),
      { absolutePath: artifactPath, kind: 'md' },
      { mode: 'first-run' },
    );

    assert.ok(result, 'client-b writing client-b is the legitimate case and must work');
    assert.equal(result.path, 'company/CLIENT-B.md', 'the reported path is the one written…');
    assert.equal(await readFile(projectTwo.companyFile, 'utf8'), REAL_BRAIN, '…and it was written');
    assert.equal(
      await readFile(brainPath, 'utf8'),
      BEFORE,
      'the coordinator-configured COMPANY.md was not touched — the config path is no longer the target',
    );
  });
});

test('a write to the global tier is refused outright, loudly', async () => {
  // COMPANY.md rule 9: the global tier is injected into every run of every project, so a
  // client's facts written there reach every other client on every invocation. The interview
  // is a client-facing agent; this is never a legitimate write, so it throws rather than
  // returning the `null` that the legitimate refusals return — a silent null here reads as
  // "the interview produced nothing", which is the sentence that stops anyone looking.
  const { root, artifactPath } = await repoFixture(REAL_BRAIN, true);
  const globalRoot = join(root, 'global');
  await mkdir(join(globalRoot, 'company'), { recursive: true });
  await mkdir(join(globalRoot, 'agents'), { recursive: true });
  const globalBrain = join(globalRoot, 'company', 'COMPANY.md');
  await writeFile(globalBrain, BEFORE, 'utf8');

  const previousGlobal = process.env.AGNETOS_GLOBAL_LIBRARY;
  process.env.AGNETOS_GLOBAL_LIBRARY = globalRoot;
  try {
    await withRepoRoot(root, async () => {
      const config = loadConfig();
      const global = { ...(await secondProject(root)), slug: 'global-tier' };
      global.companyDir = join(globalRoot, 'company');
      global.companyFile = globalBrain;
      global.companySourcesDir = join(globalRoot, 'company', 'sources');

      await assert.rejects(
        () =>
          writeBackBrain(
            config,
            global,
            brainWriteRef(global),
            { absolutePath: artifactPath, kind: 'md' },
            { mode: 'first-run' },
          ),
        // `brain_write_refused`, not `git_write_refused`: this refusal happens before git
        // is reached, and the two codes send a reader to different files. Adopted from
        // `rtl-arabic-pdpl-specialist`'s decision-request, 2026-08-17.
        (error: unknown) => (error as { code?: string }).code === 'brain_write_refused',
        'the refusal must be an error a human sees, not a null a caller ignores',
      );
      assert.equal(await readFile(globalBrain, 'utf8'), BEFORE, 'and nothing was written');
    });
  } finally {
    if (previousGlobal === undefined) delete process.env.AGNETOS_GLOBAL_LIBRARY;
    else process.env.AGNETOS_GLOBAL_LIBRARY = previousGlobal;
  }
});

test('INTERVIEW_AGENT_SLUG alone is not a key — the ref must carry the project', async () => {
  // Guards the regression directly: if the gate ever goes back to comparing the bare slug,
  // this passes a ref that is *not* project-qualified and the write must still be refused.
  const { root, artifactPath, brainPath } = await repoFixture(REAL_BRAIN, true);
  await withRepoRoot(root, async () => {
    const config = loadConfig();
    const project = mountedProject(config);
    const result = await writeBackBrain(
      config,
      project,
      INTERVIEW_AGENT_SLUG,
      { absolutePath: artifactPath, kind: 'md' },
      { mode: 'first-run' },
    );
    assert.equal(result, null);
    assert.equal(await readFile(brainPath, 'utf8'), BEFORE);
  });
});
