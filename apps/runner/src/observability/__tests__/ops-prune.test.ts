/**
 * ADR-008 prune hook — ofelia POSTs here; metrics GETs never call ops.prune().
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { handleOpsPruneRequest } from '../../routes/ops-prune.ts';
import type { DbClient } from '../types.ts';

type Call = { sql: string; params: readonly unknown[] };

function fakeDb(responder: (call: Call) => Record<string, unknown>[]): DbClient & { calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    async query(sql: string, params: readonly unknown[] = []) {
      const call = { sql, params };
      calls.push(call);
      return { rows: responder(call) as never[] };
    },
  };
}

test('POST /api/ops/prune calls ops.prune() and returns counts', async () => {
  const db = fakeDb(() => [{ spans_deleted: 3, runs_deleted: 1 }]);
  const res = await handleOpsPruneRequest('POST', '/api/ops/prune', db);
  assert.equal(res.status, 200);
  const body = res.body as Record<string, unknown>;
  assert.equal(body.ok, true);
  assert.equal(body.spansDeleted, 3);
  assert.equal(body.runsDeleted, 1);
  assert.equal(db.calls[0]?.sql.includes('ops.prune()'), true);
});

test('GET /api/ops/prune is refused — prune is never a read side-effect', async () => {
  const db = fakeDb(() => []);
  const res = await handleOpsPruneRequest('GET', '/api/ops/prune', db);
  assert.equal(res.status, 405);
  assert.equal(db.calls.length, 0, 'ops.prune must not run on GET');
});
