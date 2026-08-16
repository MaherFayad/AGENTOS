/**
 * The ledger connection supervisor.
 *
 * The bug under test is not "Postgres was down". It is that a runner which failed to
 * reach Postgres **once, at boot** stayed detached forever and reported the resulting
 * emptiness as if it were the honest "no runs yet" empty state (BOARD rule 9). So these
 * tests assert two things a reader should be able to check without running Docker:
 *
 *   1. a failed connection is retried and a later success reattaches;
 *   2. `unreachable` and `absent` never look like `connected`-with-no-rows.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLedgerConnection, isConnectionError } from '../ledgerConnection.ts';
import type { Observability } from '../../observability/index.ts';

function fakeObservability(overrides: Partial<{ query: (sql: string) => Promise<{ rows: unknown[] }> }> = {}) {
  let closed = false;
  const handle = {
    startRun: (() => {
      throw new Error('not used in this test');
    }) as unknown as Observability['startRun'],
    db: {
      query: overrides.query ?? (async () => ({ rows: [] })),
      end: async () => {
        closed = true;
      },
    },
    close: async () => {
      closed = true;
    },
  } as unknown as Observability;
  return { handle, wasClosed: () => closed };
}

const tick = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test('no DATABASE_URL is "absent", not a failure, and opens no retry loop', async () => {
  let opens = 0;
  const ledger = createLedgerConnection({
    configured: false,
    probeIntervalMs: 0,
    open: async () => {
      opens += 1;
      throw new Error('should never be called');
    },
  });
  await ledger.start();

  const health = ledger.health();
  assert.equal(health.state, 'absent');
  assert.equal(opens, 0, '--profile dev has no Postgres by design; do not dial it');
  assert.equal(ledger.current(), undefined);
  assert.match(health.hint, /dev profile/i);
  assert.doesNotMatch(health.hint, /no runs/i, 'absent must not be phrased as an empty result');
  await ledger.close();
});

test('a boot-time failure is retried, and a later success reattaches — the latch is gone', async () => {
  let opens = 0;
  const { handle } = fakeObservability();
  const published: Array<'obs' | 'none'> = [];

  const ledger = createLedgerConnection({
    configured: true,
    probeIntervalMs: 0,
    backoffMs: [5, 5, 5],
    onChange: (obs) => published.push(obs ? 'obs' : 'none'),
    open: async () => {
      opens += 1;
      // Exactly the race infra hit: initdb is still running for the first two attempts.
      if (opens < 3) throw new Error('the database system is starting up');
      return handle;
    },
  });

  await ledger.start();
  assert.equal(ledger.health().state, 'unreachable', 'the first attempt failed');
  assert.equal(ledger.current(), undefined);
  assert.ok(ledger.health().attempts >= 1);
  assert.ok(ledger.health().nextRetryAt !== null, 'a retry must be scheduled, not abandoned');

  await tick(60);

  assert.equal(opens >= 3, true, `expected retries, saw ${opens} attempt(s)`);
  assert.equal(ledger.health().state, 'connected');
  assert.equal(ledger.health().attempts, 0);
  assert.equal(ledger.health().lastError, null);
  assert.ok(ledger.current(), 'the handle is published once the database answers');
  assert.deepEqual(published, ['obs'], 'onChange fires with the live handle');

  await ledger.close();
});

test('a connection lost after boot drops the handle and re-dials', async () => {
  const dead = fakeObservability({
    query: async () => {
      const err = new Error('Connection terminated unexpectedly') as Error & { code?: string };
      err.code = '57P01';
      throw err;
    },
  });
  const alive = fakeObservability();
  let opens = 0;

  const ledger = createLedgerConnection({
    configured: true,
    probeIntervalMs: 0,
    backoffMs: [5],
    open: async () => {
      opens += 1;
      return opens === 1 ? dead.handle : alive.handle;
    },
  });

  await ledger.start();
  assert.equal(ledger.health().state, 'connected');

  // A query through the supervised handle fails the way a killed Postgres fails.
  await assert.rejects(() => ledger.current()!.db.query('SELECT 1'));

  assert.equal(ledger.health().state, 'unreachable', 'a dead connection is reported, not cached');
  assert.equal(ledger.current(), undefined);
  assert.equal(dead.wasClosed(), true, 'the pool we no longer trust is released');

  await tick(40);
  assert.equal(ledger.health().state, 'connected', 'it reconnects without a process restart');
  await ledger.close();
});

test('a query bug is not a connection failure — it must not drop the pool', async () => {
  const { handle } = fakeObservability({
    query: async () => {
      const err = new Error('function make_interval(unknown) does not exist') as Error & { code?: string };
      err.code = '42883'; // undefined_function — a bug in our SQL, not a dead socket
      throw err;
    },
  });
  const ledger = createLedgerConnection({
    configured: true,
    probeIntervalMs: 0,
    open: async () => handle,
  });

  await ledger.start();
  await assert.rejects(() => ledger.current()!.db.query('SELECT make_interval()'));

  assert.equal(ledger.health().state, 'connected', 'a bad query does not mean a bad database');
  assert.ok(ledger.current());
  await ledger.close();
});

test('isConnectionError separates the socket from the SQL', () => {
  assert.equal(isConnectionError(Object.assign(new Error('x'), { code: 'ECONNREFUSED' })), true);
  assert.equal(isConnectionError(Object.assign(new Error('x'), { code: '08006' })), true);
  assert.equal(isConnectionError(Object.assign(new Error('x'), { code: '57P03' })), true);
  assert.equal(isConnectionError(Object.assign(new Error('x'), { code: '42883' })), false);
  assert.equal(isConnectionError(Object.assign(new Error('x'), { code: '23505' })), false);
  assert.equal(isConnectionError(null), false);
});

test('the hint for unreachable says the number is unknown, not zero', async () => {
  const ledger = createLedgerConnection({
    configured: true,
    probeIntervalMs: 0,
    backoffMs: [50_000],
    open: async () => {
      throw new Error('connect ECONNREFUSED 172.18.0.2:5432');
    },
  });
  await ledger.start();
  const { hint, state, lastError } = ledger.health();
  assert.equal(state, 'unreachable');
  assert.match(hint, /unknown, not zero/i);
  assert.match(hint, /Runs still work/);
  assert.ok(lastError && lastError.includes('ECONNREFUSED'));
  await ledger.close();
});
