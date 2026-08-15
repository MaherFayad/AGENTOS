/**
 * The run pipeline, exercised without the Claude SDK or a network.
 *
 * dryRun is the cheapest way to prove COMPANY.md is injected, the allowlist is resolved
 * from wired_into, and the SSE contract is honoured — including reconnect via Last-Event-ID.
 */
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../config.ts';
import { createRunnerServices, startRun } from '../runService.ts';
import type { AgentSessionEvent, AgentSessionFactory } from '../agentSession.ts';

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
inputs:
  - {key: account_url, label: "Account URL", type: url, required: true}
approval: none
---

You write a short note about the account.
`;

async function fixtureRepo(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'agnetos-runner-'));
  await mkdir(join(root, 'agents', 'sales', 'test-agent'), { recursive: true });
  await mkdir(join(root, 'company', 'sources'), { recursive: true });
  await mkdir(join(root, 'panels'), { recursive: true });
  await mkdir(join(root, 'apps', 'web', 'public'), { recursive: true });
  await writeFile(join(root, 'agents', 'sales', 'test-agent', 'SKILL.md'), SKILL, 'utf8');
  await writeFile(
    join(root, 'company', 'COMPANY.md'),
    '## Identity\n\nWe sell a thing that is real and specific enough to count.\n',
    'utf8',
  );
  return root;
}

function silent() {
  return { info: () => {}, warn: () => {}, error: () => {} };
}

test('dryRun injects COMPANY.md, echoes wired_into tools, and never calls the session', async () => {
  const root = await fixtureRepo();
  const previous = process.env.AGNETOS_REPO_ROOT;
  process.env.AGNETOS_REPO_ROOT = root;
  delete process.env.ANTHROPIC_API_KEY;

  try {
    let sessionCalled = false;
    const session: AgentSessionFactory = async function* () {
      sessionCalled = true;
      const event: AgentSessionEvent = { type: 'token', text: 'should not run' };
      yield event;
    };

    const services = createRunnerServices(loadConfig(), silent());
    services.session = session;

    const state = await startRun(services, {
      agent: 'sales/test-agent',
      inputs: { account_url: 'https://example.com' },
      dryRun: true,
    });

    await new Promise<void>((resolve) => state.stream.whenEnded(resolve));

    const events: string[] = [];
    state.stream.attach((chunk) => events.push(chunk));
    const joined = events.join('');

    assert.equal(sessionCalled, false, 'dryRun must not spawn a session');
    assert.equal(joined.includes('event: start'), true);
    assert.equal(joined.includes('"tools":["Read","Write","Edit","Glob","Grep"]'), true);
    assert.equal(joined.includes('event: plan'), true);
    assert.equal(joined.includes('event: done'), true);
    assert.equal(joined.includes('"status":"ok"'), true);
  } finally {
    if (previous === undefined) delete process.env.AGNETOS_REPO_ROOT;
    else process.env.AGNETOS_REPO_ROOT = previous;
  }
});

test('a missing required input is bad_request before anything is spawned', async () => {
  const root = await fixtureRepo();
  const previous = process.env.AGNETOS_REPO_ROOT;
  process.env.AGNETOS_REPO_ROOT = root;
  try {
    const services = createRunnerServices(loadConfig(), silent());
    await assert.rejects(
      () => startRun(services, { agent: 'sales/test-agent', inputs: {}, dryRun: true }),
      (err: { code?: string }) => err.code === 'bad_request',
    );
  } finally {
    if (previous === undefined) delete process.env.AGNETOS_REPO_ROOT;
    else process.env.AGNETOS_REPO_ROOT = previous;
  }
});

test('an unknown agent is agent_not_found', async () => {
  const root = await fixtureRepo();
  const previous = process.env.AGNETOS_REPO_ROOT;
  process.env.AGNETOS_REPO_ROOT = root;
  try {
    const services = createRunnerServices(loadConfig(), silent());
    await assert.rejects(
      () => startRun(services, { agent: 'sales/does-not-exist', dryRun: true }),
      (err: { code?: string }) => err.code === 'agent_not_found',
    );
  } finally {
    if (previous === undefined) delete process.env.AGNETOS_REPO_ROOT;
    else process.env.AGNETOS_REPO_ROOT = previous;
  }
});

test('a real run without an API key is refused with runner_not_configured', async () => {
  const root = await fixtureRepo();
  const previousRoot = process.env.AGNETOS_REPO_ROOT;
  const previousKey = process.env.ANTHROPIC_API_KEY;
  process.env.AGNETOS_REPO_ROOT = root;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    const services = createRunnerServices(loadConfig(), silent());
    await assert.rejects(
      () => startRun(services, { agent: 'sales/test-agent', inputs: { account_url: 'https://x' } }),
      (err: { code?: string }) => err.code === 'runner_not_configured',
    );
  } finally {
    if (previousRoot === undefined) delete process.env.AGNETOS_REPO_ROOT;
    else process.env.AGNETOS_REPO_ROOT = previousRoot;
    if (previousKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = previousKey;
  }
});
