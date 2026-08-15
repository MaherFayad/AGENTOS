/**
 * The metrics API, exercised through the real handler with a fake DbClient.
 *
 * The fake records the SQL and the bind parameters, which is how the "no raw SQL from
 * a panel" rule gets tested rather than merely asserted in prose.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { deltaOf, handleMetricsRequest, relativeTime } from '../../routes/metrics.ts';
import { bindNamedQuery, NAMED_QUERIES } from '../../db/queries.ts';
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

test('GET /api/cost/today reports the number and how complete it is', async () => {
  const db = fakeDb(() => [{ usd: 12.397, runs: 9, unpriced_runs: 2 }]);
  const res = await handleMetricsRequest('GET', '/api/cost/today', db, { timezone: 'Asia/Riyadh' });

  assert.equal(res.status, 200);
  const body = res.body as Record<string, unknown>;
  assert.equal(body.usd, 12.4, 'the ticker shows $12.40 today');
  // Two of today's runs could not be priced. The ticker shows one number; this field
  // is how a caller knows whether that number is the whole story.
  assert.equal(body.unpricedRuns, 2);
  assert.equal(db.calls[0].params[0], 'Asia/Riyadh', 'the day boundary is the human’s, not UTC');
});

test('GET /api/metrics/live returns a numerator and refuses to invent a denominator', async () => {
  const db = fakeDb(() => [
    { agent: 'sales/a', department: 'sales', total_runs: 5, successful_runs: 5, recent_runs: 5, recent_errors: 0 },
    { agent: 'sales/never-run', department: 'sales', total_runs: 0, successful_runs: 0, recent_runs: 0, recent_errors: 0 },
    { agent: 'deals/b', department: 'deals', total_runs: 8, successful_runs: 2, recent_runs: 8, recent_errors: 6 },
  ]);

  const res = await handleMetricsRequest('GET', '/api/metrics/live', db);
  const body = res.body as Record<string, unknown>;

  assert.equal(body.live, 1);
  assert.deepEqual(body.liveAgents, ['sales/a']);
  assert.deepEqual(body.byDepartment, { sales: 1 });
  assert.equal(body.failing, 1);
  assert.equal('total' in body, false, 'the total comes from the frontmatter projection, not from us');
  assert.equal(body.totalSource, 'GET /api/graph');
});

test('GET /api/runs shapes LAST RUNS rows, trace link included', async () => {
  const startedAt = new Date(Date.now() - 14 * 60_000).toISOString();
  const db = fakeDb(() => [
    {
      run_id: 'abc123',
      agent: 'sales/account-enrichment',
      agent_name: 'Account Enrichment',
      status: 'ok',
      started_at: startedAt,
      duration_ms: 42_000,
      cost_usd: '0.041',
      cost_source: 'derived',
      trace_url: 'http://langfuse.tailnet:3000/project/local/traces/deadbeef',
    },
  ]);

  const res = await handleMetricsRequest('GET', '/api/runs?agent=sales/account-enrichment&limit=5', db);
  const row = (res.body as { runs: Record<string, unknown>[] }).runs[0];

  assert.equal(row.relativeTime, '14m ago');
  assert.equal(row.costUsd, 0.041, 'numeric columns arrive as strings from pg and must be coerced');
  assert.equal(row.traceUrl, 'http://langfuse.tailnet:3000/project/local/traces/deadbeef');
  assert.equal(db.calls[0].params[0], 'sales/account-enrichment');
  assert.equal(db.calls[0].params[1], 5);
});

test('a KPI query returns the window, the previous window and the delta', async () => {
  let call = 0;
  const db = fakeDb(() => [{ value: call++ === 0 ? 120 : 100, runs: 120, unpriced: 0 }]);
  const res = await handleMetricsRequest('GET', '/api/metrics/query?metric=runs&range=28d', db);
  const body = res.body as Record<string, unknown>;

  assert.equal(body.value, 120);
  assert.equal(body.previous, 100);
  assert.equal(body.delta, 0.2, 'the ▲ chip on the KPI tile');
  // Window and offset are bound parameters, not interpolated text.
  assert.deepEqual(db.calls[0].params.slice(0, 2), [672, 0]);
  assert.deepEqual(db.calls[1].params.slice(0, 2), [1344, 672]);
});

test('a delta against nothing is null, not zero and not infinity', () => {
  assert.equal(deltaOf(5, 0), null);
  assert.equal(deltaOf(5, null), null);
  assert.equal(deltaOf(null, 5), null);
  assert.equal(deltaOf(150, 100), 0.5);
});

test('unknown metrics and ranges are rejected with a hint a human can act on', async () => {
  const db = fakeDb(() => []);

  const badMetric = await handleMetricsRequest('GET', '/api/metrics/query?metric=vibes', db);
  assert.equal(badMetric.status, 400);
  assert.equal((badMetric.body as { error: { code: string } }).error.code, 'unknown_metric');

  const badRange = await handleMetricsRequest('GET', '/api/metrics/query?metric=runs&range=all-time', db);
  assert.equal(badRange.status, 400);
  assert.match((badRange.body as { error: { hint: string } }).error.hint, /24h/);

  assert.equal(db.calls.length, 0, 'a rejected request must not reach the database');
});

test('the activity feed is agent runs, timestamped and attributed', async () => {
  const db = fakeDb(() => [
    {
      run_id: 'r1',
      agent: 'operations/follow-up-coordinator',
      agent_name: 'Follow-Up Coordinator',
      department: 'operations',
      status: 'ok',
      started_at: '2026-08-15T06:41:00.000Z',
      activity_event: 'Meeting transcript processed',
      activity_detail: '4 action items assigned, recap drafted',
      trace_url: 'http://langfuse.tailnet:3000/project/local/traces/r1',
    },
  ]);

  const res = await handleMetricsRequest('GET', '/api/metrics/activity?limit=12', db, {
    timezone: 'Asia/Riyadh',
  });
  const item = (res.body as { items: Record<string, unknown>[] }).items[0];

  assert.equal(item.time, '09:41', 'rendered in the operator’s timezone');
  assert.equal(item.event, 'Meeting transcript processed');
  assert.equal(item.agentName, 'Follow-Up Coordinator');
});

test('a panel can only reach SQL through the named registry', async () => {
  const db = fakeDb(() => [{ label: 'deal', value: 12 }]);

  const ok = await handleMetricsRequest('GET', '/api/metrics/sql/outputs_by_kind?days=30', db);
  assert.equal(ok.status, 200);
  assert.deepEqual(db.calls[0].params, [30]);
  assert.equal(db.calls[0].sql, NAMED_QUERIES.outputs_by_kind.sql);

  const unknown = await handleMetricsRequest('GET', '/api/metrics/sql/drop_everything', db);
  assert.equal(unknown.status, 400);
  assert.equal((unknown.body as { error: { code: string } }).error.code, 'unknown_query');

  // A path that is not a registry name does not resolve to a route at all.
  const injected = await handleMetricsRequest(
    'GET',
    `/api/metrics/sql/${encodeURIComponent('SELECT 1; DROP TABLE ops.agent_runs')}`,
    db,
  );
  assert.equal(injected.status, 404);
  assert.equal(db.calls.length, 1, 'only the legitimate query ever executed');
});

test('named-query parameters are validated before binding', () => {
  assert.deepEqual(bindNamedQuery('outputs_by_kind', {}).params, [30], 'defaults apply');
  assert.throws(() => bindNamedQuery('outputs_by_kind', { days: '30; DROP TABLE x' }), /whole number/);
  assert.throws(() => bindNamedQuery('outputs_by_kind', { days: 99_999 }), /between 0 and 3650/);
  assert.throws(() => bindNamedQuery('outputs_recent', {}), /needs a "kind" parameter/);
});

test('every registered query binds every placeholder it declares', () => {
  for (const [name, query] of Object.entries(NAMED_QUERIES)) {
    const placeholders = new Set(query.sql.match(/\$\d+/g) ?? []);
    assert.equal(
      placeholders.size,
      query.params.length,
      `query "${name}" declares ${query.params.length} params but uses ${placeholders.size} placeholders`,
    );
  }
});

test('the metrics API is read-only', async () => {
  const db = fakeDb(() => []);
  const res = await handleMetricsRequest('POST', '/api/cost/today', db);
  assert.equal(res.status, 405);
  assert.equal(db.calls.length, 0);
});

test('a database outage degrades to an honest error, not a fabricated zero', async () => {
  const db: DbClient = {
    async query() {
      throw new Error('ECONNREFUSED');
    },
  };
  const res = await handleMetricsRequest('GET', '/api/cost/today', db);
  assert.equal(res.status, 503);
  const error = (res.body as { error: { code: string; hint: string } }).error;
  assert.equal(error.code, 'metrics_unavailable');
  assert.match(error.hint, /Runs still work/);
});

test('relative time reads the way a person would say it', () => {
  const now = Date.parse('2026-08-15T12:00:00Z');
  assert.equal(relativeTime('2026-08-15T11:59:30Z', now), 'just now');
  assert.equal(relativeTime('2026-08-15T11:46:00Z', now), '14m ago');
  assert.equal(relativeTime('2026-08-15T09:00:00Z', now), '3h ago');
  assert.equal(relativeTime('2026-08-13T12:00:00Z', now), '2d ago');
});
