/**
 * A run as a **turn of a thread** (M16, ADR-023, `Plan §12`) — halt, checkpoint, and history.
 *
 * ## What is real here and what is faked, stated before the assertions
 *
 * The session factory is a fake generator and the thread store is a recording client, so
 * **no model is called and no Postgres is touched** — which is not a compromise, it is this
 * repo's actual state (`RUNNER_ANTHROPIC_API_KEY` is unset, `DATABASE_URL` is unset, and
 * `thread-model.md` §8 lists "a thread with an agent on the other end" among the things M16
 * cannot validate).
 *
 * What that leaves is worth having, because it is the part that fails **silently**:
 *
 *   - the drain runs at a settled tool call and the run actually *stops* on a halt — an
 *     `abort()` that does not leave the `for await` hangs on a generator that never yields
 *     again, holding a concurrency slot with nothing in it, and no test of `drainMailbox`
 *     alone can see that;
 *   - the checkpoint is extracted **before** the `finally` destroys the scratch workspace —
 *     get that order wrong and "we stopped when you asked and threw your work away" passes
 *     every unit test of its parts;
 *   - the thread's history reaches the *user* turn and not the system prompt.
 *
 * `ANTHROPIC_API_KEY` is set to a non-placeholder string so the billing gate opens, exactly
 * as `cascade-ceiling.test.ts` and `one-door.test.ts` already do. It is never sent anywhere:
 * the session is a generator in this file. **`RUNNER_ANTHROPIC_API_KEY` is not touched.**
 */
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loadConfig } from '../config.ts';
import { mountedProject } from '../project.ts';
import { buildPrompt } from '../prompt.ts';
import { createRunnerServices, startRun } from '../runService.ts';
import type { AgentSessionEvent, AgentSessionFactory } from '../agentSession.ts';
import type { DbClient, Observability, RunTrace } from '../../observability/index.ts';

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

You write a short note about the account.
`;

async function fixtureRepo(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'agnetos-thread-run-'));
  await mkdir(join(root, 'agents', 'sales', 'test-agent'), { recursive: true });
  await mkdir(join(root, 'company', 'sources'), { recursive: true });
  await mkdir(join(root, 'panels'), { recursive: true });
  await writeFile(join(root, 'agents', 'sales', 'test-agent', 'SKILL.md'), SKILL, 'utf8');
  await writeFile(join(root, 'company', 'COMPANY.md'), '## Identity\n\nWe sell a real, specific thing.\n', 'utf8');
  return root;
}

const silent = () => ({ info: () => {}, warn: () => {}, error: () => {} });

const THREAD = '00000000-0000-4000-8000-00000000cafe';

type Call = { sql: string; params: readonly unknown[] };

/**
 * A recording thread store.
 *
 * The mailbox answers *once* with whatever `mailbox` holds and empty thereafter, which is
 * what a real drain sees: the first boundary reads the pending turns, the second finds them
 * marked delivered. Faking a mailbox that never empties would let a broken drain loop and
 * still pass.
 */
function threadStore(mailbox: Record<string, unknown>[]): { db: DbClient; calls: Call[] } {
  const calls: Call[] = [];
  let mailboxServed = false;
  const db: DbClient = {
    async query(sql: string, params: readonly unknown[] = []) {
      calls.push({ sql, params });
      if (/SELECT[\s\S]*FROM ops\.thread/i.test(sql)) {
        return {
          rows: [
            {
              id: THREAD,
              project_id: params[1] ?? 'p',
              kind: 'agent',
              delivery: 'direct',
              addressed_to: 'sales/test-agent',
              state: 'open',
              parent_thread_id: null,
              created_by: 'human:unattributed',
              due_at: null,
              account_id: null,
              created_at: '2026-08-17T21:00:00.000Z',
            },
          ] as never[],
        };
      }
      if (/FROM ops\.message[\s\S]*delivered_at IS NULL/i.test(sql)) {
        if (mailboxServed) return { rows: [] as never[] };
        mailboxServed = true;
        return { rows: mailbox as never[] };
      }
      if (/UPDATE ops\.thread/i.test(sql)) return { rows: [{ id: THREAD }] as never[] };
      if (/INSERT INTO ops\.message/i.test(sql)) return { rows: [{ id: 'm1', seq: 1 }] as never[] };
      return { rows: [] as never[] };
    },
  };
  return { db, calls };
}

/**
 * Every literal this run was told to withhold. Module-level because the trace double is built
 * per run and the assertion is about what reached the register across one.
 */
const withheldByTrace: string[] = [];

/** Just enough of the observability handle for `startRun` to take the thread path. */
function fakeObs(db: DbClient): Observability {
  const trace: RunTrace = {
    runId: 'run-thread-probe',
    traceId: 'trace-thread-probe',
    traceUrl: null,
    tool: () => ({ ok: () => {}, error: () => {} }),
    usage: () => {},
    event: () => {},
    // Required on `RunTrace` as of the withheld-literal register (`observability/withhold.ts`).
    // Returns `boolean` since 2026-08-18: the register refuses at capacity rather than
    // evicting, so the caller is told whether the text is actually protected. `true` for a
    // double that never fills. One-token edit by `observability-engineer` for that change.
    withhold: (text: string) => {
      withheldByTrace.push(text);
      return true;
    },
    finish: async () => ({}) as never,
  };
  return { startRun: () => trace, db, close: async () => {} } as unknown as Observability;
}

async function runWithMailbox(mailbox: Record<string, unknown>[]) {
  withheldByTrace.length = 0;
  const root = await fixtureRepo();
  const previousRoot = process.env.AGNETOS_REPO_ROOT;
  const previousKey = process.env.ANTHROPIC_API_KEY;
  process.env.AGNETOS_REPO_ROOT = root;
  process.env.ANTHROPIC_API_KEY = 'test-key-not-a-placeholder';

  try {
    const { db, calls } = threadStore(mailbox);
    const services = createRunnerServices(loadConfig(), silent());
    services.obs = fakeObs(db);

    let yieldedAfterTool = false;
    services.session = (async function* (options): AsyncIterable<AgentSessionEvent> {
      // The agent writes its deliverable *before* the tool settles, so the halt below has
      // something real to checkpoint. Anything not extracted is destroyed with the scratch
      // workspace, which is the whole point of doing the extraction on this path.
      await writeFile(join(options.cwd, 'output.md'), '# Partial work\n\nHalf a deliverable.\n', 'utf8');
      yield { type: 'tool', name: 'Write', input: { path: 'output.md' }, status: 'start' };
      yield { type: 'tool', name: 'Write', input: null, status: 'ok', durationMs: 1 };
      // If the run does not stop at the halt, it reaches here — and the flag says so more
      // usefully than a timeout would.
      yieldedAfterTool = true;
      yield { type: 'token', text: 'kept going after a halt' };
      yield { type: 'result', costUsd: 0.01 };
    }) as AgentSessionFactory;

    const state = await startRun(services, mountedProject(services.config), {
      agent: 'sales/test-agent',
      inputs: {},
    });
    await new Promise<void>((resolve) => state.stream.whenEnded(resolve));

    const frames: string[] = [];
    state.stream.attach((chunk) => frames.push(chunk));
    return { state, calls, frames: frames.join(''), yieldedAfterTool };
  } finally {
    if (previousRoot === undefined) delete process.env.AGNETOS_REPO_ROOT;
    else process.env.AGNETOS_REPO_ROOT = previousRoot;
    if (previousKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = previousKey;
  }
}

const halt = {
  id: 'msg-halt',
  thread_id: THREAD,
  project_id: 'p',
  seq: 1,
  kind: 'human',
  interrupt: 'halt',
  author: 'human:unattributed',
  body: 'stop — the client changed the brief',
  payload: null,
  in_reply_to: null,
  expires_at: null,
  delivered_at: null,
  created_at: '2026-08-17T21:00:00.000Z',
};

test('a halt read at a tool boundary stops the run, and the run really stops', async () => {
  const { state, frames, yieldedAfterTool } = await runWithMailbox([halt]);

  assert.equal(
    yieldedAfterTool,
    false,
    'the session generator kept being consumed after the halt. `abort()` alone does not leave ' +
      'a `for await`, and a bare `break` inside the switch leaves only the switch — this is ' +
      'why the loop carries a label.',
  );
  assert.equal(state.status, 'canceled', 'a halted run ended by a human is canceled, not error');
  assert.match(frames, /event: done/);
  assert.match(frames, /"status":"canceled"/);
  // The human's own words reach the console, inside the project, bracketed like every other
  // runner-spoken notice so it is not mistaken for the agent's output.
  assert.match(frames, /\[halt from human:unattributed: stop — the client changed the brief\]/);
});

test('the work so far is checkpointed before the scratch workspace is destroyed', async () => {
  const { state, frames } = await runWithMailbox([halt]);

  assert.ok(
    state.artifact,
    'a halt extracted no artifact. "We stopped when you asked and threw your work away" is ' +
      'not a checkpoint, and every unit test of the parts passes while it is true.',
  );
  assert.match(state.artifact!.path, /output\.md$/);
  assert.match(frames, /event: artifact/, 'the checkpoint is announced, not silently saved');
  assert.match(frames, /\[halted\. The work so far was saved/);
});

test('a halt asks: a question with a mandatory expiry, and the thread moves to waiting', async () => {
  const { calls } = await runWithMailbox([halt]);

  const inserts = calls.filter((c) => /INSERT INTO ops\.message/i.test(c.sql));
  assert.equal(inserts.length, 1, 'exactly one turn is written for a halted run');
  // `appendMessage`'s parameter order: id, threadId, kind, interrupt, author, body, payload,
  // inReplyTo, expiresAt, requiresRunning.
  assert.equal(inserts[0]!.params[2], 'question', 'a halt is the agent asking whether to continue');
  assert.notEqual(
    inserts[0]!.params[8],
    null,
    'expires_at is mandatory on a question (message_question_expires): a run blocked forever ' +
      'on a question nobody saw looks idle, holds a slot, and delivers nothing',
  );

  const transitions = calls
    .filter((c) => /UPDATE ops\.thread SET state/i.test(c.sql))
    .map((c) => [c.params[1], c.params[2]]);
  assert.deepEqual(
    transitions,
    [['open', 'running'], ['running', 'waiting']],
    'open → running for the turn, running → waiting because a question is outstanding. Every ' +
      'move goes through assertThreadTransition, which is the only place the order is written.',
  );
});

test('a run with an empty mailbox finishes normally and returns its thread to open', async () => {
  // The control. Without it, "the halt path works" could equally mean "every run halts".
  const { state, calls, yieldedAfterTool } = await runWithMailbox([]);
  assert.equal(yieldedAfterTool, true, 'nothing interrupted this run');
  assert.equal(state.status, 'ok');

  const transitions = calls
    .filter((c) => /UPDATE ops\.thread SET state/i.test(c.sql))
    .map((c) => [c.params[1], c.params[2]]);
  assert.deepEqual(transitions, [['open', 'running'], ['running', 'open']]);

  const inserts = calls.filter((c) => /INSERT INTO ops\.message/i.test(c.sql));
  assert.equal(inserts[0]!.params[2], 'agent', 'the agent\'s turn is recorded on the thread');
  assert.match(
    String(inserts[0]!.params[5]),
    /output\.md/,
    'the turn references the deliverable rather than copying it — a second copy of a run\'s ' +
      'output in ops.message is a second copy in the one table nothing prunes and no delete ' +
      'verb can reach (thread-model.md §7.3)',
  );
});

/* -------------------------------------------------------------------------- *
 * History seeding — REQ-RUN-53, and it needs no run at all
 * -------------------------------------------------------------------------- */

test('a continued thread seeds the user turn, never the system prompt', async () => {
  const root = await fixtureRepo();
  const previous = process.env.AGNETOS_REPO_ROOT;
  process.env.AGNETOS_REPO_ROOT = root;
  try {
    const config = loadConfig();
    const { loadAgent } = await import('../agents.ts');
    const record = await loadAgent(config, 'sales/test-agent');

    const history = [
      { author: 'human:unattributed', kind: 'human', body: 'use the Q3 numbers' },
      { author: 'agent:sales/test-agent', kind: 'agent', body: 'Finished and wrote output.md.' },
    ];
    const withHistory = buildPrompt(record, {}, '# Co', history);
    const without = buildPrompt(record, {}, '# Co');

    assert.match(withHistory.user, /## Thread so far/);
    assert.match(withHistory.user, /use the Q3 numbers/);
    assert.match(withHistory.user, /oldest first/);
    assert.equal(
      withHistory.system.includes('use the Q3 numbers'),
      false,
      'a conversation in the system prompt arrives with the authority of the agent\'s own ' +
        'instructions — which is how a prompt-injected earlier turn becomes a standing rule',
    );
    assert.equal(
      withHistory.system,
      without.system,
      'seeding history must not change who the agent is or which company it works for; §3.3 ' +
        'requires COMPANY.md in every invocation and that block is the same either way',
    );
    assert.equal(without.user.includes('Thread so far'), false, 'a fresh thread has no history block');
  } finally {
    if (previous === undefined) delete process.env.AGNETOS_REPO_ROOT;
    else process.env.AGNETOS_REPO_ROOT = previous;
  }
});

/**
 * **The drain line is wired, not merely written** (`observability-engineer`'s decision-request,
 * closed with M17).
 *
 * `mailbox.test.ts` asserts that `renderDrainedMessage` registers the body when it is handed a
 * trace. That is the unit; this is the wiring, and the two are different claims — deleting the
 * argument at the call site in `runService` leaves every mailbox unit test green, which is
 * precisely the *producer without a consumer* shape (a required `sourceRef` shipped while the
 * drawer's type dropped it, and nothing was red).
 *
 * What it buys: a body that reaches an interpolated error string later in the run is scrubbed
 * out of it, because the register learned the literal here. Nothing else can reach an
 * interpolated string — not a key rule, not a type.
 */
test('the run registers a drained body with its trace, so an interpolation cannot leak it', async () => {
  await runWithMailbox([halt]);
  assert.deepEqual(
    withheldByTrace,
    [halt.body],
    'the halt body did not reach RunTrace.withhold. The drain line in runService is the only ' +
      'point where the body still has provenance — after an interpolation there is nothing left ' +
      'for any rule to match on.',
  );
});
