import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEGACY_UNSCOPED_PATHS, projectPath, RUNNER_ROUTES } from '@agnetos/contracts';
import { isPlaceholderSecret, loadConfig } from '../../lib/config.ts';
import { buildRunner } from '../../server.ts';

const SKILL = `---
name: Test Agent
description: A fixture.
department: sales
cluster: enrichment
icon: building
tier: autonomous
phase: 1-foundation
status: draft
wired_into: [workspace]
replaces: "A test."
ladder:
  human-led: "A person does it."
  assisted: "A person checks it."
  autonomous: "It runs."
the_human: "The human reads the output."
approval: none
---

Body.
`;

/** The slug `loadConfig` mounts by default and migration 0005 seeds. */
const PROJECT = 'agentos';

/** `/api/p/agentos/…` — the only shape a project route answers on (ADR-015 Q1). */
const p = (key: keyof typeof RUNNER_ROUTES): string =>
  projectPath(RUNNER_ROUTES[key].path, PROJECT);

async function fixtureRepo(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'agnetos-api-'));
  await mkdir(join(root, 'agents', 'sales', 'test-agent'), { recursive: true });
  await mkdir(join(root, 'company', 'sources'), { recursive: true });
  await mkdir(join(root, 'panels'), { recursive: true });
  await writeFile(join(root, 'agents', 'sales', 'test-agent', 'SKILL.md'), SKILL, 'utf8');
  return root;
}

test('GET /healthz and GET /api/status and GET /api/agents/:slug mount', async () => {
  const root = await fixtureRepo();
  const previous = process.env.AGNETOS_REPO_ROOT;
  process.env.AGNETOS_REPO_ROOT = root;
  const runner = await buildRunner({ config: loadConfig(), watch: false, observe: false });
  try {
    const health = await runner.app.inject({ method: 'GET', url: '/healthz' });
    assert.equal(health.statusCode, 200);
    assert.equal(health.json().ok, true);

    const status = await runner.app.inject({ method: 'GET', url: RUNNER_ROUTES.status.path });
    assert.equal(status.statusCode, 200);
    const body = status.json();
    assert.equal(body.brain.total, 20);
    assert.equal(body.runnerConfigured, !isPlaceholderSecret(process.env.ANTHROPIC_API_KEY));
    assert.equal(Array.isArray(body.brain.missing), true);

    const agent = await runner.app.inject({
      method: 'GET',
      url: `${p('agentsIndex')}/sales/test-agent`,
    });
    assert.equal(agent.statusCode, 200);
    assert.deepEqual(agent.json().runnable.tools, ['Read', 'Write', 'Edit', 'Glob', 'Grep']);
    assert.equal(agent.json().runnable.approvalRequired, false);

    const missing = await runner.app.inject({ method: 'GET', url: '/api/nope' });
    assert.equal(missing.statusCode, 404);
    assert.equal(missing.json().error.code, 'not_found');

    // The switcher's list, and the one route that says which project the coordinator's
    // own project-shaped fields answered for.
    const projects = await runner.app.inject({ method: 'GET', url: RUNNER_ROUTES.projects.path });
    assert.equal(projects.statusCode, 200);
    assert.equal(projects.json().mounted, PROJECT);
    assert.equal(
      projects.json().scopeEnforced,
      null,
      'with no ledger, isolation status is unknown — never a confident false',
    );
    assert.equal(body.projects.mounted, PROJECT);
    assert.equal(body.projects.answeredFor, PROJECT, 'brain/graphBuilt say which project they are about');
    assert.equal(body.projects.scopeEnforcement, 'unknown');
  } finally {
    await runner.close();
    if (previous === undefined) delete process.env.AGNETOS_REPO_ROOT;
    else process.env.AGNETOS_REPO_ROOT = previous;
  }
});

/**
 * The whole point of `ledgerConnection.ts`, asserted at the wire.
 *
 * A runner with no ledger must never produce a payload that a caller could read as
 * "connected, and there were zero runs". Every response says which of the three states it
 * is in, and every count it cannot know is `null`.
 */
test('a runner with no ledger is distinguishable from a ledger with no rows', async () => {
  const root = await fixtureRepo();
  const previous = process.env.AGNETOS_REPO_ROOT;
  process.env.AGNETOS_REPO_ROOT = root;
  const runner = await buildRunner({ config: loadConfig(), watch: false, observe: false });
  try {
    const status = (await runner.app.inject({ method: 'GET', url: RUNNER_ROUTES.status.path })).json();
    assert.equal(status.ledger.state, 'absent', '/api/status names the state, it does not imply it');
    assert.equal(typeof status.ledger.hint, 'string');
    assert.ok(status.ledger.hint.length > 0, 'the hint is what a human on a phone reads');

    // The cost ticker still renders (200, `usd: null` → "no cost data") but the run count
    // is `null`, not `0`. `0` would be a claim we are not entitled to make.
    // `observability-engineer`'s routes now carry the project segment too, so the
    // ticker is asked for a named project rather than for "whatever this box has".
    const cost = await runner.app.inject({ method: 'GET', url: `/api/p/${PROJECT}/cost/today` });
    assert.equal(cost.statusCode, 200);
    assert.equal(cost.json().usd, null);
    assert.equal(cost.json().runs, null, 'an unknown count is null — never zero');
    assert.equal(cost.json().ledger.state, 'absent');

    // Everything else says so with a real HTTP status and the uniform error envelope.
    const runs = await runner.app.inject({ method: 'GET', url: `/api/p/${PROJECT}/metrics/runs` });
    assert.equal(runs.statusCode, 503);
    assert.equal(runs.json().error.code, 'metrics_unavailable');
    assert.equal(runs.json().ledger.state, 'absent');
    assert.notDeepEqual(runs.json().runs, [], 'a 503 must not also carry an empty result set');

    // …and the in-memory queue, which has nothing to do with the ledger, is still an
    // honest empty list. These two routes are the pair that used to be confused.
    const live = await runner.app.inject({ method: 'GET', url: p('runs') });
    assert.equal(live.statusCode, 200);
    assert.deepEqual(live.json().runs, []);
  } finally {
    await runner.close();
    if (previous === undefined) delete process.env.AGNETOS_REPO_ROOT;
    else process.env.AGNETOS_REPO_ROOT = previous;
  }
});

test('GET /api/approvals starts empty and GET /api/runs is the live list', async () => {
  const root = await fixtureRepo();
  const previous = process.env.AGNETOS_REPO_ROOT;
  process.env.AGNETOS_REPO_ROOT = root;
  const runner = await buildRunner({ config: loadConfig(), watch: false, observe: false });
  try {
    const approvals = await runner.app.inject({ method: 'GET', url: p('approvals') });
    assert.equal(approvals.statusCode, 200);
    assert.deepEqual(approvals.json().approvals, []);

    const runs = await runner.app.inject({ method: 'GET', url: `${p('runs')}?limit=5` });
    assert.equal(runs.statusCode, 200);
    assert.deepEqual(runs.json().runs, []);
  } finally {
    await runner.close();
    if (previous === undefined) delete process.env.AGNETOS_REPO_ROOT;
    else process.env.AGNETOS_REPO_ROOT = previous;
  }
});

/**
 * The project axis, asserted at the wire (ADR-015).
 *
 * Three refusals, three different meanings, and the whole reason they are three:
 * "you did not say which project" is a client that needs updating, "no such project" is a
 * typo, and "not mounted here" is a project that exists on another host. Collapsing them
 * would send all three people looking in the same wrong place.
 *
 * The one this suite cares about most is the first. **Every pre-project path still exists
 * and answers 400 with the scoped path in its hint** — not 404, which reads as a deleted
 * feature, and above all not a redirect to whichever project we happen to mount, which is
 * the ambient default the entire axis exists to remove.
 */
test('every pre-project path answers project_scope_missing, naming its replacement', async () => {
  const root = await fixtureRepo();
  const previous = process.env.AGNETOS_REPO_ROOT;
  process.env.AGNETOS_REPO_ROOT = root;
  const runner = await buildRunner({ config: loadConfig(), watch: false, observe: false });
  try {
    assert.ok(LEGACY_UNSCOPED_PATHS.length > 0, 'the contract lists the legacy paths');

    for (const legacy of LEGACY_UNSCOPED_PATHS) {
      // Fastify binds `:runId` / `*` to literal text here; the refusal fires before any
      // handler would look at them, which is exactly the property under test.
      const url = legacy.path.replace(':runId', 'run_x').replace('*', 'sales/test-agent');
      const res = await runner.app.inject({ method: legacy.method, url, payload: {} });

      assert.equal(res.statusCode, 400, `${legacy.method} ${url} must refuse, not serve`);
      const body = res.json();
      assert.equal(body.error.code, 'project_scope_missing');
      assert.match(
        body.error.hint,
        /\/api\/p\/agentos\//,
        'the hint names the scoped path a human should use',
      );
      assert.equal(
        Object.hasOwn(body, 'runs') || Object.hasOwn(body, 'agents') || Object.hasOwn(body, 'approvals'),
        false,
        'a refusal must not also carry a result set — that is how an empty answer gets believed',
      );
    }
  } finally {
    await runner.close();
    if (previous === undefined) delete process.env.AGNETOS_REPO_ROOT;
    else process.env.AGNETOS_REPO_ROOT = previous;
  }
});

test('a project this coordinator does not mount is refused, and not with "not found"', async () => {
  const root = await fixtureRepo();
  const previous = process.env.AGNETOS_REPO_ROOT;
  process.env.AGNETOS_REPO_ROOT = root;
  const runner = await buildRunner({ config: loadConfig(), watch: false, observe: false });
  try {
    // A well-formed slug for a project that may exist perfectly well on another host.
    // `project_not_mounted` (503), because "not found" would send someone hunting a typo
    // in a name that is correct (`Plan §9`, host_affinity).
    const elsewhere = await runner.app.inject({ method: 'GET', url: '/api/p/client-x/runs' });
    assert.equal(elsewhere.statusCode, 503);
    assert.equal(elsewhere.json().error.code, 'project_not_mounted');
    assert.match(elsewhere.json().error.hint, /agentos/);

    // Not a slug at all — this one really is 404.
    const nonsense = await runner.app.inject({ method: 'GET', url: '/api/p/Not_A_Slug/runs' });
    assert.equal(nonsense.statusCode, 404);
    assert.equal(nonsense.json().error.code, 'project_not_found');

    // Reserved, because `/api/all/…` is the cross-project namespace and a project called
    // `all` would make the URL ambiguous. Mirrors `ops.project.slug_is_not_reserved`.
    const reserved = await runner.app.inject({ method: 'GET', url: '/api/p/all/runs' });
    assert.equal(reserved.statusCode, 404);
    assert.equal(reserved.json().error.code, 'project_not_found');

    // And the deliberate cross-project route is mounted and honest when empty.
    const all = await runner.app.inject({ method: 'GET', url: RUNNER_ROUTES.allApprovals.path });
    assert.equal(all.statusCode, 200);
    assert.deepEqual(all.json().approvals, []);
  } finally {
    await runner.close();
    if (previous === undefined) delete process.env.AGNETOS_REPO_ROOT;
    else process.env.AGNETOS_REPO_ROOT = previous;
  }
});
