/**
 * The mailbox drain (M16, ADR-023, `Plan §12` — `comms/contracts/thread-model.md` §4.3).
 *
 * ## What this can and cannot prove, stated first
 *
 * **No thread has ever been created, no message delivered and no run has ever executed.**
 * `thread-model.md` §8 lists that as the thing M16 cannot validate, and this file does not
 * pretend otherwise: it drives the drain against a recording fake, so what it proves is the
 * *ordering and consumption rules*, with no database and no model call. What it cannot prove
 * is that a real agent, at a real tool boundary, changes what it does — that needs
 * `RUNNER_ANTHROPIC_API_KEY`.
 *
 * That is still the highest-value half available, because every rule below fails **silently**
 * when it is wrong: a second drain that rewrites `delivered_at` makes *"when did the agent
 * first see this"* unanswerable, and a drain that consumes past a halt discards messages
 * nobody will ever look for again.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { drainMailbox, renderDrainedMessage, MID_RUN_STEER } from '../mailbox.ts';
import type { DbClient } from '../../observability/types.ts';

const PROJECT = '3f1b1d9c-0000-4000-8000-000000000001';
const THREAD = '00000000-0000-4000-8000-00000000beef';

type Row = Record<string, unknown>;

/** One `ops.message` row, in the shape `thread-reads.ts` selects it. */
const row = (seq: number, over: Partial<Record<string, unknown>> = {}): Row => ({
  id: `msg-${seq}`,
  thread_id: THREAD,
  project_id: PROJECT,
  seq,
  kind: 'human',
  interrupt: 'note',
  author: 'human:unattributed',
  body: `turn ${seq}`,
  payload: null,
  in_reply_to: null,
  expires_at: null,
  delivered_at: null,
  created_at: '2026-08-17T21:00:00.000Z',
  ...over,
});

/**
 * A recording client. Returns the pending rows to the mailbox read and records the UPDATE,
 * so the assertions are about the statement that would have reached Postgres rather than
 * about a value this file chose.
 */
function fakeDb(pending: Row[]): { db: DbClient; calls: Array<{ sql: string; params: readonly unknown[] }> } {
  const calls: Array<{ sql: string; params: readonly unknown[] }> = [];
  const db: DbClient = {
    async query(sql: string, params: readonly unknown[] = []) {
      calls.push({ sql, params });
      if (/SELECT[\s\S]*FROM ops\.message/i.test(sql)) return { rows: pending as never[] };
      return { rows: [] as never[] };
    },
  };
  return { db, calls };
}

test('the drain reads the mailbox scoped to its project, in seq order', async () => {
  const { db, calls } = fakeDb([row(1), row(2)]);
  const drained = await drainMailbox(db, PROJECT, THREAD);

  const read = calls[0]!;
  assert.match(read.sql, /delivered_at IS NULL/, 'the mailbox is a predicate, not a table');
  assert.match(read.sql, /ORDER BY seq ASC/, 'a conversation read out of order is a different conversation');
  assert.match(
    read.sql,
    /project_id = \$2/,
    'the project is in the WHERE, not only in an RLS policy — RLS is inert while compose\'s ' +
      'Postgres user is a superuser, and GET /api/status reports exactly that',
  );
  assert.deepEqual(read.params, [THREAD, PROJECT]);
  assert.deepEqual(
    drained.messages.map((m) => m.seq),
    [1, 2],
  );
  assert.equal(drained.halted, null);
  assert.equal(drained.remaining, 0);
});

test('a drain marks exactly what it consumed, once', async () => {
  const { db, calls } = fakeDb([row(1), row(2)]);
  await drainMailbox(db, PROJECT, THREAD);

  const update = calls.find((c) => /UPDATE ops\.message/i.test(c.sql));
  assert.ok(update, 'the drain marks messages delivered');
  assert.match(
    update.sql,
    /AND delivered_at IS NULL/,
    'without this predicate a second drain rewrites the timestamp and "when did the agent ' +
      'first see this" stops being answerable',
  );
  assert.deepEqual(update.params[0], ['msg-1', 'msg-2']);
});

test('an empty mailbox issues no UPDATE at all', async () => {
  const { db, calls } = fakeDb([]);
  const drained = await drainMailbox(db, PROJECT, THREAD);
  assert.deepEqual(drained.messages, []);
  assert.equal(
    calls.some((c) => /UPDATE/i.test(c.sql)),
    false,
    'a drain at every tool boundary of a long run must not write a row per boundary',
  );
});

test('a drain that finds a halt stops at it and leaves the rest in the mailbox', async () => {
  const { db, calls } = fakeDb([
    row(1),
    row(2, { id: 'msg-halt', interrupt: 'halt', body: 'stop, the client changed the brief' }),
    row(3),
    row(4),
  ]);
  const drained = await drainMailbox(db, PROJECT, THREAD);

  assert.deepEqual(
    drained.messages.map((m) => m.id),
    ['msg-1', 'msg-halt'],
    'inclusive of the halt — the agent did read it, and that is why it stopped',
  );
  assert.equal(drained.halted?.id, 'msg-halt');
  assert.equal(drained.remaining, 2, 'the turns behind a halt survive for the run that resumes the thread');

  const update = calls.find((c) => /UPDATE ops\.message/i.test(c.sql))!;
  assert.deepEqual(
    update.params[0],
    ['msg-1', 'msg-halt'],
    'marking msg-3 and msg-4 delivered would lose two human messages nobody would ever look for again',
  );
});

test('a halt as the very first message consumes only itself', async () => {
  // The off-by-one this shape exists to catch: an implementation that cut *before* the halt
  // would consume nothing and loop forever re-reading the same message.
  const { db } = fakeDb([row(1, { id: 'msg-halt', interrupt: 'halt' }), row(2)]);
  const drained = await drainMailbox(db, PROJECT, THREAD);
  assert.deepEqual(drained.messages.map((m) => m.id), ['msg-halt']);
  assert.equal(drained.remaining, 1);
});

test('a steer is never consumed as a note — it wedges the mailbox, visibly', async () => {
  const { db, calls } = fakeDb([
    row(1),
    row(2, { id: 'msg-steer', interrupt: 'steer', body: 'use the Q3 numbers instead' }),
    row(3),
  ]);
  const drained = await drainMailbox(db, PROJECT, THREAD);

  assert.deepEqual(drained.messages.map((m) => m.id), ['msg-1']);
  assert.equal(drained.undeliverable?.id, 'msg-steer');
  assert.equal(drained.halted, null, 'a steer is not a halt — the run keeps going');
  assert.equal(drained.remaining, 2, 'the steer and everything behind it stay unread and countable');

  const update = calls.find((c) => /UPDATE ops\.message/i.test(c.sql))!;
  assert.equal(
    (update.params[0] as string[]).includes('msg-steer'),
    false,
    'marking a steer delivered without acting on it is the silent downgrade thread-model.md ' +
      'invariant 7 forbids: the human believes they changed course, and nothing did',
  );
});

test('mid-run steering is declared unsupported as a type, not as a comment', () => {
  // The same instrument as `FAN_OUT_DISPATCH.allowed`: making this true has to be a
  // reviewable, type-level act in the same commit as whatever proves it works.
  const supported: false = MID_RUN_STEER.supported;
  assert.equal(supported, false);
  assert.match(
    MID_RUN_STEER.unblockedBy,
    /RUNNER_ANTHROPIC_API_KEY/,
    'the refusal names what would lift it, so "why does steer not work" is not a research task',
  );
  assert.notEqual(MID_RUN_STEER.reason.trim(), '', 'a refusal with no stated reason is a shrug');
});

test('the console line a drained message produces says who and at what level', () => {
  const [message] = [
    {
      id: 'm',
      threadId: THREAD,
      projectId: PROJECT,
      seq: 1,
      kind: 'human' as const,
      interrupt: 'note' as const,
      author: 'human:unattributed',
      body: 'check the pricing page too',
      payload: null,
      inReplyTo: null,
      expiresAt: null,
      deliveredAt: null,
      createdAt: '2026-08-17T21:00:00.000Z',
    },
  ];
  const line = renderDrainedMessage(message);
  assert.match(line, /^\[note from human:unattributed: check the pricing page too\]\n$/);
  // Bracketed like every other runner-spoken notice, so a reader can tell the agent's own
  // output from the runner talking about it.
  assert.equal(line.startsWith('['), true);
});

/**
 * **The drain line** (`observability-engineer` → `runner-engineer`, 2026-08-18, taken as
 * proposed and closed with M17's contract).
 *
 * The gap it closes, in their words: the sanctioned trace path projects
 * `messageSpanAttributes(message)`, which has no `body` field — correct, and the consequence is
 * that the withheld-literal register never *learns* the body. A run that drains a message and
 * then interpolates it into an error string ten lines later emits it verbatim, and no key rule
 * or type reaches an interpolated string. One call at the point the body is read is the only
 * thing that can close it.
 *
 * Two properties, and the second is the one that only exists because the register changed:
 * `withhold()` returns `boolean` since it began **refusing at capacity rather than evicting**
 * (the old bound silently un-protected the oldest literal — fail-open). `false` is a real
 * answer and must be surfaced, because it means this run cannot protect that text.
 */
test('a drained body is registered as withheld at the moment it is read', () => {
  const withheld: string[] = [];
  const message = {
    id: 'm1',
    threadId: THREAD,
    projectId: PROJECT,
    seq: 1,
    kind: 'human' as const,
    interrupt: 'note' as const,
    author: 'human:unattributed',
    body: 'Chase Fatima Al-Harbi about the Olaya lease',
    payload: null,
    inReplyTo: null,
    expiresAt: null,
    deliveredAt: null,
    createdAt: '2026-08-17T21:00:00.000Z',
  };

  const line = renderDrainedMessage(message, {
    withhold: (text: string) => {
      withheld.push(text);
      return true;
    },
  });

  assert.deepEqual(withheld, [message.body], 'the body itself, not a projection of it');
  assert.match(line, /Fatima Al-Harbi/, 'and the console line inside the project is unchanged');
});

test('a refusal from the register is surfaced, and the surfacing carries no body', () => {
  const refusals: Array<{ messageId: string; bodyChars: number }> = [];
  const message = {
    id: 'm2',
    threadId: THREAD,
    projectId: PROJECT,
    seq: 2,
    kind: 'human' as const,
    interrupt: 'note' as const,
    author: 'human:unattributed',
    body: 'a body the register is full for',
    payload: null,
    inReplyTo: null,
    expiresAt: null,
    deliveredAt: null,
    createdAt: '2026-08-17T21:00:00.000Z',
  };

  renderDrainedMessage(message, {
    withhold: () => false,
    onRefusal: (messageId, bodyChars) => refusals.push({ messageId, bodyChars }),
  });

  assert.deepEqual(refusals, [{ messageId: 'm2', bodyChars: message.body.length }]);
  assert.equal(
    JSON.stringify(refusals).includes('register is full for'),
    false,
    'the refusal names the message and a length — logging the text would be the leak it reports',
  );

  // And a drain with no observability plane at all (`--profile dev`) still renders. An
  // optional trace is a plane that does not exist, not a caller opting out of redaction.
  assert.doesNotThrow(() => renderDrainedMessage(message));
});
