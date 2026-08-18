/**
 * **`0009_run_thread_required.sql`, graded from the writer's side.**
 *
 * `ops.agent_runs.thread_id` is `NOT NULL` as of 0009. BRIEF's standing finding is that a
 * constraint has two sides and a schema dump shows only one: *a `NOT NULL` nobody can satisfy
 * and one that holds look identical.* 0005 shipped four of the unsatisfiable kind on this same
 * table, and the failure mode is the expensive one — **the run happens, the model is paid for,
 * and the row that records it is refused.**
 *
 * The schema side of 0009 is checked with no database by `writer-schema-agreement.test.ts`:
 * the migration moves `thread_id` into the mandatory set and the ledger INSERT is then
 * required to name it. This file is the *other* side — the one that says a run which cannot
 * name a thread never gets started, rather than getting started and failing to record.
 *
 * ## What this observes, and what it does not
 *
 * **Structural, and the label matters.** Zero agent runs have executed in this product and no
 * migration in this repo has met a live Postgres, so nothing here observes a `NOT NULL` being
 * enforced by a database. What it observes is that the one code path which produces ledger
 * rows refuses the state that constraint forbids, **before** a session is spawned — which is
 * the half that is free to check and the half that costs money to get wrong.
 *
 * ## Falsification
 *
 * Delete the `services.obs && !thread` guard in `runService.startRun` and the first test goes
 * red on the session factory having been invoked: without it, the run spawns, spends, and dies
 * at the INSERT. Planted, watched red, reverted.
 */
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loadConfig } from '../config.ts';
import { mountedProject } from '../project.ts';
import { createRunnerServices, startRun } from '../runService.ts';
import type { AgentSessionEvent } from '../agentSession.ts';
import type { Observability, RunTrace } from '../../observability/index.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(HERE, '..', '..', 'db', 'migrations');

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
inputs: []
approval: none
---

Write a note.
`;

async function fixtureRepo(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'agnetos-thread-required-'));
  await mkdir(join(root, 'agents', 'sales', 'test-agent'), { recursive: true });
  await writeFile(join(root, 'agents', 'sales', 'test-agent', 'SKILL.md'), SKILL, 'utf8');
  await mkdir(join(root, 'company'), { recursive: true });
  await writeFile(join(root, 'company', 'COMPANY.md'), '# Fixture\n\nA company.\n', 'utf8');
  return root;
}

const silent = () => ({ info: () => {}, warn: () => {}, error: () => {} });

/**
 * An observability handle with a ledger and **no thread store** — the shape the guard exists
 * for. It is unreachable through `createObservability`, whose `Observability` type declares
 * `db` as required, and that is precisely why it is worth a test: *unreachable by inspection*
 * is what M15 believed about four other columns on this table.
 */
function obsWithoutThreadStore(): Observability {
  const trace: RunTrace = {
    runId: 'run-probe',
    traceId: 'trace-probe',
    traceUrl: null,
    tool: () => ({ ok: () => {}, error: () => {} }),
    usage: () => {},
    event: () => {},
    withhold: () => true,
    finish: async () => ({}) as never,
  };
  return { startRun: () => trace, close: async () => {} } as unknown as Observability;
}

test('a runner with a ledger and no thread store refuses the run, having spawned nothing', async () => {
  const root = await fixtureRepo();
  const previousRoot = process.env.AGNETOS_REPO_ROOT;
  const previousKey = process.env.ANTHROPIC_API_KEY;
  process.env.AGNETOS_REPO_ROOT = root;
  // Set so the billing gate is not the thing refusing: this test is about the order of the
  // two refusals, and a missing key would make it pass for the wrong reason.
  process.env.ANTHROPIC_API_KEY = 'test-key-not-a-placeholder';

  try {
    const services = createRunnerServices(loadConfig(), silent());
    services.obs = obsWithoutThreadStore();

    let spawned = false;
    services.session = (async function* (): AsyncIterable<AgentSessionEvent> {
      spawned = true;
      yield { type: 'result', costUsd: 0.42 };
    }) as typeof services.session;

    await assert.rejects(
      () => startRun(services, mountedProject(services.config), { agent: 'sales/test-agent' }),
      (err: { code?: string; hint?: string }) => {
        assert.equal(err.code, 'thread_store_unavailable');
        assert.match(String(err.hint), /Nothing was spent/);
        return true;
      },
    );

    assert.equal(
      spawned,
      false,
      'the session was started before the refusal — which is the M15 shape exactly: the model ' +
        'is paid for and then the row recording it is refused by a NOT NULL',
    );
  } finally {
    if (previousRoot === undefined) delete process.env.AGNETOS_REPO_ROOT;
    else process.env.AGNETOS_REPO_ROOT = previousRoot;
    if (previousKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = previousKey;
  }
});

test('0009 is one statement on an empty table, and it is the only NOT NULL it adds', async () => {
  // Narrow on purpose. The value of reading the migration here is not "it exists" — the
  // agreement test already proves the parser sees it — it is that this file does **not**
  // quietly carry a second schema change under a name that describes one. `0010_` is M17's
  // and is claimed separately on BOARD; a migration that did two things would put a work
  // product table behind a number nobody reviewed for it.
  const sql = await readFile(join(MIGRATIONS, '0009_run_thread_required.sql'), 'utf8');
  const code = sql.replace(/^\s*--.*$/gm, '');

  const statements = code.split(';').map((s) => s.trim()).filter((s) => s !== '');
  assert.equal(statements.length, 2, `0009 should be one ALTER and one COMMENT, got:\n${statements.join('\n---\n')}`);
  assert.match(code, /ALTER TABLE ops\.agent_runs\s+ALTER COLUMN thread_id SET NOT NULL/);
  assert.equal(/CREATE\s+TABLE/i.test(code), false, 'no table is created here — 0010 is M17\'s migration');
  assert.equal(
    (code.match(/SET NOT NULL/gi) ?? []).length,
    1,
    'exactly one column becomes mandatory in this migration',
  );
});
