/**
 * **A run's durable bytes live under its project, and bytes that do not are refused.**
 *
 * ## The defect this file closes
 *
 * `rtl-arabic-pdpl-specialist`'s isolation sign-off, second pass, *Deliberately not done*:
 *
 * > **Artefacts are still `artifactsRoot/<runId>/`.** Moving them to
 * > `artifactsRoot/<project>/<runId>/` is the structural fix …
 *
 * and, in the path table, the reason it mattered — the download was graded *"no today, by
 * cache"*: `runInProject` compares `state.project` in an **in-memory store bounded at 200
 * that dies with the process**, while the bytes themselves carried no project at all. So the
 * isolation of the durable half was a property of a cache, not of the store.
 *
 * It is the same defect class as the ledger's missing `project_id`, one layer down, and
 * worse in one specific way: **a filesystem has no constraint that can refuse the write.**
 * `assertAttributed` can throw before an INSERT; `copyFile` cannot. The only mechanism
 * available is that the destination is *derived* from the project rather than remembered by
 * the caller — so `artifacts.ts` takes `MountedProject` and does not import `RunnerConfig`.
 * PDPL rule 4 (*client data does not cross clients*) · rule 6 (*anything that must persist
 * is written deliberately to a named location*), Part VII.4.
 *
 * ## Three kinds of test, because no one of them is the guarantee
 *
 * **Behavioural** — two projects, one artefacts root, and *the same run id*: the state that
 * used to be a single directory. **Structural** — `artifacts.ts` may not name `RunnerConfig`,
 * which is the only assertion that can see a *future* caller reaching for the coordinator's
 * root. **Route** — a pre-M15 `artifactsRoot/<runId>/` directory attached to a real run,
 * fetched through the real handler, refused with `artifact_unattributed` and still on disk
 * afterwards. That last one is the migration decision, executed rather than described.
 */
import { mkdir, mkdtemp, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { API_ERROR_STATUS, projectPath, RUNNER_ROUTES } from '@agnetos/contracts';
import { loadConfig } from '../../lib/config.ts';
import { mountedProject, type MountedProject } from '../../lib/project.ts';
import { assertArtifactInProject, createScratch, extractArtifact } from '../../lib/artifacts.ts';
import { buildRunner } from '../../server.ts';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PROJECT = 'agentos';

/** One coordinator's roots, two projects mounted from them. */
function projectAt(roots: { scratch: string; artifacts: string; library: string }, slug: string): MountedProject {
  return {
    id: `id-of-${slug}`,
    slug,
    name: slug,
    status: 'active',
    libraryPath: roots.library,
    workspaceRoot: join(roots.scratch, slug),
    artifactsDir: join(roots.artifacts, slug),
    agentsDir: join(roots.library, 'agents'),
    overridesDir: join(roots.library, 'agents', '_overrides'),
    companyDir: join(roots.library, 'company'),
    companyFile: join(roots.library, 'company', 'COMPANY.md'),
    companySourcesDir: join(roots.library, 'company', 'sources'),
    panelsDir: join(roots.library, 'panels'),
    graphFile: join(roots.library, 'graph.json'),
  };
}

async function roots(): Promise<{ scratch: string; artifacts: string; library: string }> {
  const root = await mkdtemp(join(tmpdir(), 'agnetos-artifacts-'));
  return { scratch: join(root, 'scratch'), artifacts: join(root, 'artifacts'), library: root };
}

/**
 * The behavioural proof, and it is deliberately run with **one run id shared by two
 * projects**. Under the old layout that was not a collision that "should not happen" — it was
 * the *same directory*, and the second write would have overwritten the first client's
 * deliverable with no error anywhere. Run ids are UUIDs, so this is not the likely path to
 * the bug; it is the shortest statement of what the project segment buys.
 */
test("two projects' artefacts cannot share a directory, even on the same run id", async () => {
  const r = await roots();
  const a = projectAt(r, 'client-a');
  const b = projectAt(r, 'client-b');
  const runId = 'run_shared_id';

  const scratchA = await createScratch(a, runId);
  const scratchB = await createScratch(b, runId);
  assert.notEqual(scratchA, scratchB, 'the scratch workspace is the project’s too, not the coordinator’s');

  await writeFile(join(scratchA, 'output.md'), '# Client A quarterly plan\n', 'utf8');
  await writeFile(join(scratchB, 'output.md'), '# Client B quarterly plan\n', 'utf8');

  const savedA = await extractArtifact(a, runId, scratchA);
  const savedB = await extractArtifact(b, runId, scratchB);
  assert.ok(savedA && savedB, 'both runs produced an artefact');

  assert.notEqual(savedA.absolutePath, savedB.absolutePath);
  assert.equal(await readFile(savedA.absolutePath, 'utf8'), '# Client A quarterly plan\n');
  assert.equal(
    await readFile(savedB.absolutePath, 'utf8'),
    '# Client B quarterly plan\n',
    'the second write did not land on the first client’s file',
  );

  // The path the API returns names the project, so a run row, a ledger row and a directory
  // listing all answer "whose output is this?" the same way — without a database.
  assert.match(savedA.path, /(^|\/)client-a\//);
  assert.match(savedB.path, /(^|\/)client-b\//);

  // And the tree itself is segmented: the artefacts root holds projects, not run ids.
  const top = (await readdir(r.artifacts)).sort();
  assert.deepEqual(top, ['client-a', 'client-b']);
});

/**
 * The structural half. A behavioural test sees today's call sites; it cannot see the handler
 * somebody adds next year that reaches for `config.artifactsRoot`. A type that is not
 * imported makes that handler fail to compile — the same arrangement `graph.ts` and
 * `panels.ts` carry (`project-derived-reads.test.ts`).
 */
test('artifacts.ts cannot reach the coordinator’s roots at all', async () => {
  const source = await readFile(join(SRC, 'lib', 'artifacts.ts'), 'utf8');

  // Import statements, not prose — `project-derived-reads.test.ts`'s precedent. The file
  // *discusses* `RunnerConfig` in the comment explaining why it no longer takes one, and a
  // scan that could not tell the difference would make the fix undocumentable.
  const IMPORTS = /import\s+(?:type\s+)?\{[^}]*\}\s+from\s+['"][^'"]+['"]/g;
  const bindings = [...source.matchAll(IMPORTS)].join(' ');
  assert.equal(
    /\bRunnerConfig\b/.test(bindings),
    false,
    'artifacts.ts must take MountedProject only — a destination it can compute from config is a ' +
      'destination two projects can share',
  );
  assert.match(bindings, /\bMountedProject\b/);
  assert.equal(/config\.(artifactsRoot|scratchRoot)/.test(source), false);
  assert.match(source, /project\.artifactsDir/, 'the destination is derived from the project');
  assert.match(source, /project\.workspaceRoot/);

  // And no shipped caller may hand it something else. The compiler already refuses it; this
  // says so in a sentence a reviewer can read, and catches an `as never` cast.
  const runService = await readFile(join(SRC, 'lib', 'runService.ts'), 'utf8');
  for (const call of ['createScratch(config', 'extractArtifact(config']) {
    assert.equal(runService.includes(call), false, `runService.ts must not call ${call}…)`);
  }
});

/**
 * The migration decision, as code rather than as a paragraph.
 *
 * There is nothing to migrate today — zero runs have executed, so no artefact exists — and
 * that sentence expires the moment one does, which is why the *rule* is what is asserted:
 * **a directory in the old layout is refused, never adopted, and never deleted.** Adopting
 * one would file whichever client's output it holds under whichever project happens to be
 * mounted, on the strength of a coincidence; that is exactly what the ledger's
 * `run_unattributed` refusal was written to prevent, and a filesystem cannot refuse on its
 * own behalf.
 */
test('a pre-M15 artifactsRoot/<runId>/ directory is refused, not adopted', async () => {
  const r = await roots();
  const a = projectAt(r, 'client-a');
  const legacy = join(r.artifacts, 'run_from_before_the_project_axis', 'output.md');
  await mkdir(dirname(legacy), { recursive: true });
  await writeFile(legacy, '# Whose is this?\n', 'utf8');

  assert.throws(
    () => assertArtifactInProject(a, legacy),
    (err: { code?: string; hint?: string }) => {
      assert.equal(err.code, 'artifact_unattributed');
      assert.match(err.hint ?? '', /Nothing was deleted/);
      return true;
    },
    'an unattributed directory is refused rather than served under the mounted project',
  );

  // Refused, and still there. A runner that deleted a client's bytes to tidy a layout would
  // be making a decision that is not the runner's to make.
  assert.ok((await stat(legacy)).isFile());

  // And the other half of rule 4: one project's artefact is not servable by another.
  const b = projectAt(r, 'client-b');
  const mine = join(a.artifactsDir, 'run_1', 'output.md');
  assert.doesNotThrow(() => assertArtifactInProject(a, mine));
  assert.throws(() => assertArtifactInProject(b, mine), /not stored inside "client-b"/);
});

/**
 * The route, end to end, because a guard that is exported and never called is a comment with
 * a test. `GET /api/p/:project/run/:runId/artifact` is the only surface that turns saved
 * bytes into a download.
 */
test('the download route refuses bytes that are not the project’s, and serves the ones that are', async () => {
  const repo = await mkdtemp(join(tmpdir(), 'agnetos-artifact-route-'));
  await mkdir(join(repo, 'agents'), { recursive: true });
  const previous = process.env.AGNETOS_REPO_ROOT;
  process.env.AGNETOS_REPO_ROOT = repo;
  const runner = await buildRunner({ config: loadConfig(), watch: false, observe: false });
  const project = mountedProject(runner.services.config);

  try {
    const state = runner.services.store.create({
      project: PROJECT,
      agent: 'sales/probe',
      agentRef: `${PROJECT}/sales/probe`,
      sourceRef: 'project:agents/sales/probe/SKILL.md@sha256:probe',
      agentName: 'Probe',
      department: 'sales',
      inputs: {},
      traceUrl: null,
    });

    // A directory in the old layout — no project segment — attached to a real run in this
    // project. This is the state a coordinator upgraded across this change would find.
    const legacyDir = join(dirname(project.artifactsDir), state.runId);
    await mkdir(legacyDir, { recursive: true });
    const legacyFile = join(legacyDir, 'output.md');
    await writeFile(legacyFile, '# Bytes with no project\n', 'utf8');
    state.artifact = { path: 'artifacts/output.md', absolutePath: legacyFile, kind: 'md', bytes: 24 };

    const url = projectPath(RUNNER_ROUTES.runArtifact.path, PROJECT).replace(':runId', state.runId);
    const refused = await runner.app.inject({ method: 'GET', url });
    assert.equal(refused.statusCode, API_ERROR_STATUS.artifact_unattributed);
    assert.equal(refused.json().error.code, 'artifact_unattributed');
    assert.ok((await stat(legacyFile)).isFile(), 'refusing did not delete it');

    // The same run, with its artefact where this project keeps them, downloads normally —
    // so this is a boundary, not a broken route.
    const properDir = join(project.artifactsDir, state.runId);
    await mkdir(properDir, { recursive: true });
    const properFile = join(properDir, 'output.md');
    await writeFile(properFile, '# Bytes that belong here\n', 'utf8');
    state.artifact = { path: 'artifacts/output.md', absolutePath: properFile, kind: 'md', bytes: 25 };

    const served = await runner.app.inject({ method: 'GET', url });
    assert.equal(served.statusCode, 200);
    assert.match(served.payload, /Bytes that belong here/);
  } finally {
    await runner.close();
    if (previous === undefined) delete process.env.AGNETOS_REPO_ROOT;
    else process.env.AGNETOS_REPO_ROOT = previous;
  }
});
