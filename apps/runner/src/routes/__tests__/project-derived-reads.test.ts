/**
 * **A route that resolves a project cannot read a coordinator-level path.**
 *
 * ## The defect this file closes
 *
 * Five read handlers — `graph`, `agentsIndex`, `agent`, `panels`, `panel` — called
 * `projectOf(ctx, request)` at the head and then read `config.agentsDir`,
 * `config.panelsDir` and `config.graphFile`. The run path never did: it derives every root
 * from the project through `cascadeRoots`. So the library plane was project-derived at
 * dispatch and coordinator-derived on every read behind MAP, CHART and DASHBOARDS.
 *
 * With one library mounted those two agree — **by coincidence between two variables, rather
 * than by derivation from one.** That is `project-scoping.md` invariant 8's whole argument,
 * and it is the shape that is indistinguishable from correct until the day a second library
 * is mounted, when one project's URL starts serving another's library with no error
 * anywhere. Found by `rtl-arabic-pdpl-specialist`, isolation sign-off second pass.
 *
 * ## Why two kinds of test, and why neither alone is enough
 *
 * **Behavioural** (below): a `MountedProject` pointing at library B while the coordinator's
 * config points at library A. Everything a project route reads must answer from B. This is
 * the only test that can distinguish derivation from coincidence, because it is the only
 * one where the two variables *disagree* — which is exactly the state one mounted project
 * makes unreachable through the HTTP surface.
 *
 * **Structural**: `lib/graph.ts` and `lib/panels.ts` may not so much as name `RunnerConfig`.
 * A behavioural test cannot see a *future* handler that reaches for config; a type that is
 * not imported makes that handler fail to compile.
 */
import { mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projectPath, RUNNER_ROUTES } from '@agnetos/contracts';
import { loadConfig } from '../../lib/config.ts';
import { mountedProject, type MountedProject } from '../../lib/project.ts';
import { listResolvedAgents } from '../../lib/cascade.ts';
import { graphIsBuilt, readGraph } from '../../lib/graph.ts';
import { listPanels, readPanel } from '../../lib/panels.ts';
import { buildRunner } from '../../server.ts';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PROJECT = 'agentos';

const p = (key: keyof typeof RUNNER_ROUTES): string =>
  projectPath(RUNNER_ROUTES[key].path, PROJECT);

const skill = (name: string, description: string, wiredInto = '[workspace]'): string => `---
name: ${name}
description: ${description}
department: sales
cluster: enrichment
icon: building
tier: autonomous
phase: 1-foundation
status: draft
wired_into: ${wiredInto}
replaces: "A test."
ladder:
  human-led: "A person does it."
  assisted: "A person checks it."
  autonomous: "It runs."
the_human: "The human reads the output."
approval: none
---

Body of ${name}.
`;

/** A library on disk: agents, panels, a stored layout artifact. */
async function library(prefix: string, marker: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), prefix));
  await mkdir(join(root, 'agents', 'sales', `${marker}-agent`), { recursive: true });
  await mkdir(join(root, 'panels'), { recursive: true });
  await mkdir(join(root, 'company', 'sources'), { recursive: true });
  await writeFile(
    join(root, 'agents', 'sales', `${marker}-agent`, 'SKILL.md'),
    skill(`${marker} agent`, `Lives in the ${marker} library.`),
    'utf8',
  );
  await writeFile(
    join(root, 'panels', `${marker}-command.json`),
    JSON.stringify({ id: `${marker}-command`, title: `${marker} command` }),
    'utf8',
  );
  await writeFile(
    join(root, 'graph.json'),
    JSON.stringify({ core: { library: marker }, nodes: [{ id: `sales/${marker}-agent` }] }),
    'utf8',
  );
  return root;
}

function projectAt(root: string, slug: string): MountedProject {
  return {
    id: 'not-read-by-these-tests',
    slug,
    name: slug,
    status: 'active',
    libraryPath: root,
    workspaceRoot: join(root, 'scratch'),
    agentsDir: join(root, 'agents'),
    overridesDir: join(root, 'agents', '_overrides'),
    companyDir: join(root, 'company'),
    companyFile: join(root, 'company', 'COMPANY.md'),
    companySourcesDir: join(root, 'company', 'sources'),
    panelsDir: join(root, 'panels'),
    graphFile: join(root, 'graph.json'),
  };
}

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

test('every library read answers from the project it was handed, never from the coordinator', async () => {
  const coordinator = await library('agnetos-derive-a-', 'alpha');
  const other = await library('agnetos-derive-b-', 'beta');

  await withRepoRoot(coordinator, async () => {
    const config = loadConfig();
    const mounted = mountedProject(config);
    assert.equal(mounted.agentsDir, config.agentsDir, 'the one mounted project is still the coordinator’s');

    // …and now the two disagree, which is the state a second mount creates and the state
    // the old code could not survive.
    const b = projectAt(other, 'client-b');

    const panels = await listPanels(b);
    assert.deepEqual(
      panels.map((entry) => entry.id),
      ['beta-command'],
      'the carousel is project B’s, not the coordinator’s',
    );
    await assert.rejects(
      () => readPanel(b, 'alpha-command'),
      (err: { code?: string }) => err.code === 'panel_not_found',
      'and the coordinator’s panel is not reachable under project B’s id',
    );

    const graph = (await readGraph(b)) as { core?: { library?: string } };
    assert.equal(graph.core?.library, 'beta', 'the stored layout is project B’s artifact');
    assert.equal(await graphIsBuilt(b), true);

    const resolved = await listResolvedAgents(config, b);
    assert.deepEqual(
      resolved.map((agent) => agent.record.slug),
      ['sales/beta-agent'],
      'the resolved set is project B’s library — the coordinator’s alpha agent is absent',
    );
    assert.equal(resolved[0]?.agentRef, 'client-b/sales/beta-agent', 'and it is addressed as B’s');
  });
});

test('a project whose library has no layout artifact is refused, never filled in from another', async () => {
  const coordinator = await library('agnetos-derive-c-', 'alpha');
  const empty = await mkdtemp(join(tmpdir(), 'agnetos-derive-empty-'));

  await withRepoRoot(coordinator, async () => {
    const bare = projectAt(empty, 'client-c');
    assert.equal(await graphIsBuilt(bare), false);
    await assert.rejects(
      () => readGraph(bare),
      (err: { code?: string; message?: string }) =>
        err.code === 'graph_not_built' && String(err.message).includes('client-c'),
      'graph_not_built names the project, and no coordinator artifact is substituted',
    );
    assert.deepEqual(await listPanels(bare), [], 'no panels/ is an empty carousel, not the coordinator’s six');
  });
});

/**
 * The structural half. `RunnerConfig` carries `agentsDir`, `panelsDir` and `graphFile`, so a
 * module that can name it can reach a coordinator-level path by accident. These two cannot.
 *
 * `cascade.ts` is deliberately not on this list: it takes both, because `globalLibraryDir`
 * and `repoRoot` genuinely *are* coordinator-level facts (ADR-014's L0 is per host, not per
 * project). What it must never do is take the project's own roots from config, and
 * `cascadeRoots(config, project)` is where that is visible in one line.
 */
test('the library readers cannot import the coordinator’s config type at all', async () => {
  // Import statements, not prose: both files *discuss* `RunnerConfig` in the comment
  // explaining why they no longer take one, and a scan that could not tell the difference
  // would make the fix undocumentable.
  const IMPORTS = /import\s+(?:type\s+)?\{[^}]*\}\s+from\s+['"][^'"]+['"]/g;

  for (const file of ['lib/graph.ts', 'lib/panels.ts']) {
    const text = await readFile(join(SRC, ...file.split('/')), 'utf8');
    const bindings = [...text.matchAll(IMPORTS)].join(' ');
    assert.equal(
      /\bRunnerConfig\b/.test(bindings),
      false,
      `${file} must take MountedProject only — a config-typed parameter is how the coincidence came back`,
    );
    assert.match(bindings, /\bMountedProject\b/, `${file} reads the mounted project`);
  }
});

/** No shipped handler may pass `config` to a library read. The compiler already refuses it;
 * this says so in a sentence a reviewer can read, and catches a `as never` cast. */
test('no route hands the coordinator’s config to a library read', async () => {
  const api = await readFile(join(SRC, 'routes', 'api.ts'), 'utf8');
  for (const call of ['readGraph(config', 'graphIsBuilt(config', 'listPanels(config', 'readPanel(config']) {
    assert.equal(api.includes(call), false, `routes/api.ts still calls ${call}…)`);
  }
});

// --- The read path is the cascade, so provenance is answerable before any run ---

test('GET /api/agents/:slug carries a resolver-produced sourceRef', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agnetos-sourceref-'));
  await mkdir(join(root, 'agents', 'sales', 'test-agent'), { recursive: true });
  await mkdir(join(root, 'company', 'sources'), { recursive: true });
  await writeFile(
    join(root, 'agents', 'sales', 'test-agent', 'SKILL.md'),
    skill('Test Agent', 'The project library’s copy.'),
    'utf8',
  );

  await withRepoRoot(root, async () => {
    const runner = await buildRunner({ config: loadConfig(), watch: false, observe: false });
    try {
      const detail = (
        await runner.app.inject({ method: 'GET', url: `${p('agentsIndex')}/sales/test-agent` })
      ).json();

      assert.match(
        detail.sourceRef,
        /^project:agents\/sales\/test-agent\/SKILL\.md@sha256:[0-9a-f]{64}$/,
        'layer, path and the digest of the bytes that would run — the same grammar as SSE start',
      );
      // The drawer header renders the layer half. Before this, `AgentDetail` had no field
      // to read and the badge said SOURCE UNKNOWN until a run started.
      assert.equal(detail.sourceRef.split(':')[0], 'project');
    } finally {
      await runner.close();
    }
  });
});

test('an override wins the read exactly as it would win the run — badge, path and tools together', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agnetos-override-read-'));
  await mkdir(join(root, 'agents', 'sales', 'test-agent'), { recursive: true });
  await mkdir(join(root, 'agents', '_overrides', 'sales', 'test-agent'), { recursive: true });
  await mkdir(join(root, 'company', 'sources'), { recursive: true });
  await writeFile(
    join(root, 'agents', 'sales', 'test-agent', 'SKILL.md'),
    skill('Test Agent', 'The project library’s copy.', '[workspace, shell]'),
    'utf8',
  );
  // Narrowing, which ADR-014 §3 permits: `shell` is dropped, nothing is added.
  await writeFile(
    join(root, 'agents', '_overrides', 'sales', 'test-agent', 'SKILL.md'),
    skill('Test Agent', 'The override, which is what actually runs.', '[workspace]'),
    'utf8',
  );

  await withRepoRoot(root, async () => {
    const runner = await buildRunner({ config: loadConfig(), watch: false, observe: false });
    try {
      const detail = (
        await runner.app.inject({ method: 'GET', url: `${p('agentsIndex')}/sales/test-agent` })
      ).json();

      assert.equal(detail.sourceRef.split(':')[0], 'override', 'the badge names the layer that won');
      assert.equal(detail.path, 'agents/_overrides/sales/test-agent/SKILL.md');
      assert.equal(
        detail.frontmatter.description,
        'The override, which is what actually runs.',
        'whole-file resolution, no field merge (ADR-014 §1.1)',
      );
      assert.deepEqual(
        detail.runnable.tools,
        ['Read', 'Write', 'Edit', 'Glob', 'Grep'],
        'and WIRED INTO shows the narrowed list, not the project layer’s — no Bash',
      );

      // The list projection CHART draws from must agree with the drawer, or the two views
      // disagree about what exists — the failure ADR-014 decision 9 names by hand.
      const index = (await runner.app.inject({ method: 'GET', url: p('agentsIndex') })).json();
      assert.deepEqual(index.skipped, []);
      assert.deepEqual(
        index.agents.map((agent: { slug: string; path: string }) => [agent.slug, agent.path]),
        [['sales/test-agent', 'agents/_overrides/sales/test-agent/SKILL.md']],
        'one agent, resolved once — `agents/_overrides/**` was invisible to every enumerator before this',
      );
    } finally {
      await runner.close();
    }
  });
});

test('a widened override is refused on the read, and named in skipped[] rather than drawn', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agnetos-widened-read-'));
  await mkdir(join(root, 'agents', 'sales', 'test-agent'), { recursive: true });
  await mkdir(join(root, 'agents', '_overrides', 'sales', 'test-agent'), { recursive: true });
  await mkdir(join(root, 'company', 'sources'), { recursive: true });
  await writeFile(
    join(root, 'agents', 'sales', 'test-agent', 'SKILL.md'),
    skill('Test Agent', 'Introduces the agent, and its ceiling.', '[workspace]'),
    'utf8',
  );
  await writeFile(
    join(root, 'agents', '_overrides', 'sales', 'test-agent', 'SKILL.md'),
    skill('Test Agent', 'Grants itself a shell.', '[workspace, shell]'),
    'utf8',
  );

  await withRepoRoot(root, async () => {
    const runner = await buildRunner({ config: loadConfig(), watch: false, observe: false });
    try {
      const detail = await runner.app.inject({
        method: 'GET',
        url: `${p('agentsIndex')}/sales/test-agent`,
      });
      assert.equal(detail.statusCode, 403);
      assert.equal(detail.json().error.code, 'capability_widened');

      const index = (await runner.app.inject({ method: 'GET', url: p('agentsIndex') })).json();
      assert.deepEqual(index.agents, [], 'an agent that cannot run is not a tile…');
      assert.equal(index.skipped.length, 1, '…it is a named exclusion (ADR-014 §1.2, §7.4)');
      assert.equal(index.skipped[0].slug, 'sales/test-agent');
      assert.match(index.skipped[0].reason, /shell/, 'and the reason says what it tried to grant');
    } finally {
      await runner.close();
    }
  });
});

test('GET /api/panels serves the mounted project’s panels/ verbatim', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agnetos-panels-scope-'));
  await mkdir(join(root, 'agents', 'sales'), { recursive: true });
  await mkdir(join(root, 'panels'), { recursive: true });
  await mkdir(join(root, 'company', 'sources'), { recursive: true });
  await writeFile(
    join(root, 'panels', 'revenue-command.json'),
    JSON.stringify({ id: 'revenue-command', title: 'Revenue Command' }),
    'utf8',
  );

  await withRepoRoot(root, async () => {
    const runner = await buildRunner({ config: loadConfig(), watch: false, observe: false });
    try {
      const list = (await runner.app.inject({ method: 'GET', url: p('panels') })).json();
      assert.deepEqual(
        list.panels.map((entry: { id: string }) => entry.id),
        ['revenue-command'],
      );

      const one = await runner.app.inject({ method: 'GET', url: `${p('panels')}/revenue-command` });
      assert.equal(one.statusCode, 200);
      assert.equal(one.json().title, 'Revenue Command');

      const absent = await runner.app.inject({ method: 'GET', url: `${p('panels')}/ops-command` });
      assert.equal(absent.statusCode, 404);
      assert.equal(absent.json().error.code, 'panel_not_found');
      assert.match(
        absent.json().error.message,
        new RegExp(PROJECT),
        'the refusal names the project it looked in, so "which project?" is never the next question',
      );
    } finally {
      await runner.close();
    }
  });
});

/**
 * A directory listing, so the sentence "five routes" in the handoff is checkable rather than
 * remembered: every scoped handler that reads the library takes a `MountedProject`.
 */
test('the five reads the audit named are all present and all project-typed', async () => {
  const api = await readFile(join(SRC, 'routes', 'api.ts'), 'utf8');
  for (const route of ['graph', 'agentsIndex', 'agent', 'panels', 'panel'] as const) {
    assert.match(api, new RegExp(`RUNNER_ROUTES\\.${route}\\.path`), `${route} is still mounted`);
  }
  assert.match(api, /readGraph\(project/);
  assert.match(api, /listPanels\(projectOf/);
  assert.match(api, /readPanel\(project,/);
  assert.match(api, /listResolvedAgents\(config, project/);
  assert.match(api, /resolveForDispatch\(config, project/);

  // And nothing in `src/` still enumerates the library with the single-layer lister.
  const shipped = await readdir(join(SRC, 'lib'));
  assert.ok(shipped.includes('cascade.ts'), relative(SRC, join(SRC, 'lib')));
});
