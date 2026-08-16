/**
 * Panel query → metrics endpoint. The routing table, checked.
 *
 * The truncation-guard suite that used to live here is gone with the derivation it
 * guarded (see `lib/runs.ts`): dashboards no longer count runs in the browser out of a
 * capped `/api/runs` list, so there is no undercount left to refuse. What matters now is
 * that each declared query shape reaches the route that can actually answer it — and that
 * the shapes no route answers say so instead of being approximated.
 *
 * Resolution (the zero-vs-null grammar and the two guards) is tested next door in
 * `data/resolve.test.ts` under Vitest, which can resolve extensionless TS imports.
 *
 * Run: node --test apps/web/src/dashboards/__tests__/runs.test.mjs
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeRuns } from '../lib/runs.ts';
import { planLangfuse, toRunnerRange, urlsOf } from '../data/endpoints.ts';

const DEPARTMENTS = ['sales', 'deals', 'marketing', 'operations', 'intelligence', 'customer', 'back-office'];

test('normalizeRuns drops a row without an id, agent or time', () => {
  const rows = normalizeRuns({
    runs: [{ runId: 'x' }, { runId: 'r1', agent: 'operations/audit', startedAt: '2026-08-15T12:00:00Z' }],
  });
  assert.equal(rows.length, 1);
});

test('a scalar metric goes to /api/metrics/query, never to the in-memory /api/runs', () => {
  const plan = planLangfuse({ metric: 'runs', range: '7d' });
  assert.equal(plan.kind, 'scalar');
  assert.equal(plan.url, '/api/metrics/query?metric=runs&range=7d');
});

test('an activity-feed list goes to /api/metrics/activity; a data-table list to /api/metrics/runs', () => {
  const feed = planLangfuse({ metric: 'runs', shape: 'list', limit: 12 }, { intent: 'activity' });
  assert.equal(feed.url, '/api/metrics/activity?limit=12');
  const table = planLangfuse({ metric: 'runs', shape: 'list', limit: 10, range: '7d' });
  assert.equal(table.url, '/api/metrics/runs?limit=10');
  assert.equal(table.sinceHours, 168);
});

test('a department-scoped feed passes the department the activity route accepts', () => {
  const plan = planLangfuse(
    { metric: 'runs', shape: 'list', limit: 8, filter: { department: 'sales' } },
    { intent: 'activity' },
  );
  assert.equal(plan.url, '/api/metrics/activity?limit=8&department=sales');
});

test('a daily runs series uses the registered runs_per_day query rather than bucketing here', () => {
  const plan = planLangfuse({ metric: 'runs', shape: 'series', groupBy: 'day', range: '28d' });
  assert.equal(plan.url, '/api/metrics/sql/runs_per_day?days=28');
});

test('spend by agent uses the registered cost_by_agent query', () => {
  const plan = planLangfuse({ metric: 'cost', shape: 'list', groupBy: 'agent', range: '7d' });
  assert.equal(plan.url, '/api/metrics/sql/cost_by_agent?days=7');
});

test('a series the runner does not serve is unsupported, not approximated', () => {
  assert.equal(planLangfuse({ metric: 'cost', shape: 'series', groupBy: 'day', range: '7d' }).kind, 'unsupported');
  assert.equal(
    planLangfuse({ metric: 'error_rate', shape: 'series', groupBy: 'day', range: '7d' }).kind,
    'unsupported',
  );
});

test('a status filter is refused because the metrics route does not apply one', () => {
  // Left alone this would fetch a perfectly good *unfiltered* count and label it
  // "Failed runs", which is the one failure mode standing rule 9 exists to stop.
  assert.equal(planLangfuse({ metric: 'runs', range: '7d', filter: { status: 'error' } }).kind, 'unsupported');
});

test('per-model spend stays unsupported — a run row carries no model', () => {
  assert.equal(planLangfuse({ metric: 'cost', shape: 'list', groupBy: 'model', range: '7d' }).kind, 'unsupported');
});

test('a department split fans out one server-side count per department plus the total', () => {
  const plan = planLangfuse(
    { metric: 'runs', shape: 'list', groupBy: 'department', range: '7d' },
    { departments: DEPARTMENTS },
  );
  assert.equal(plan.kind, 'runs-by-department');
  assert.equal(plan.parts.length, 7);
  assert.equal(urlsOf(plan).length, 8);
  assert.ok(urlsOf(plan).every((url) => url.startsWith('/api/metrics/query?')));
});

test('weeks map onto the runner range table; a window outside it is refused', () => {
  assert.equal(toRunnerRange('4w').token, '28d');
  assert.equal(toRunnerRange('9d'), null);
  assert.equal(planLangfuse({ metric: 'runs', range: '9d' }).kind, 'unsupported');
});
