import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RUNNER_ROUTES } from '@agnetos/contracts';
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

    const agent = await runner.app.inject({ method: 'GET', url: '/api/agents/sales/test-agent' });
    assert.equal(agent.statusCode, 200);
    assert.deepEqual(agent.json().runnable.tools, ['Read', 'Write', 'Edit', 'Glob', 'Grep']);
    assert.equal(agent.json().runnable.approvalRequired, false);

    const missing = await runner.app.inject({ method: 'GET', url: '/api/nope' });
    assert.equal(missing.statusCode, 404);
    assert.equal(missing.json().error.code, 'not_found');
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
    const cost = await runner.app.inject({ method: 'GET', url: '/api/cost/today' });
    assert.equal(cost.statusCode, 200);
    assert.equal(cost.json().usd, null);
    assert.equal(cost.json().runs, null, 'an unknown count is null — never zero');
    assert.equal(cost.json().ledger.state, 'absent');

    // Everything else says so with a real HTTP status and the uniform error envelope.
    const runs = await runner.app.inject({ method: 'GET', url: '/api/metrics/runs' });
    assert.equal(runs.statusCode, 503);
    assert.equal(runs.json().error.code, 'metrics_unavailable');
    assert.equal(runs.json().ledger.state, 'absent');
    assert.notDeepEqual(runs.json().runs, [], 'a 503 must not also carry an empty result set');

    // …and the in-memory queue, which has nothing to do with the ledger, is still an
    // honest empty list. These two routes are the pair that used to be confused.
    const live = await runner.app.inject({ method: 'GET', url: RUNNER_ROUTES.runs.path });
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
    const approvals = await runner.app.inject({ method: 'GET', url: RUNNER_ROUTES.approvals.path });
    assert.equal(approvals.statusCode, 200);
    assert.deepEqual(approvals.json().approvals, []);

    const runs = await runner.app.inject({ method: 'GET', url: `${RUNNER_ROUTES.runs.path}?limit=5` });
    assert.equal(runs.statusCode, 200);
    assert.deepEqual(runs.json().runs, []);
  } finally {
    await runner.close();
    if (previous === undefined) delete process.env.AGNETOS_REPO_ROOT;
    else process.env.AGNETOS_REPO_ROOT = previous;
  }
});
