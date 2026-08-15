import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RUNNER_ROUTES } from '@agnetos/contracts';
import { loadConfig } from '../../lib/config.ts';
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
    assert.equal(body.runnerConfigured, Boolean(process.env.ANTHROPIC_API_KEY));
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
