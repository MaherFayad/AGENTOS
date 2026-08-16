/**
 * The metrics API, exercised through the real handler with a fake DbClient.
 *
 * The fake records the SQL and the bind parameters, which is how the "no raw SQL from
 * a panel" rule gets tested rather than merely asserted in prose.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { deltaOf, handleMetricsRequest, relativeTime, splitProjectPath } from '../../routes/metrics.ts';
import { bindNamedQuery, NAMED_QUERIES, PROJECT_ID_SLOT } from '../../db/registry.ts';
import { projectIdForSlug } from '../../lib/project.ts';
import { buildRunner } from '../../server.ts';
import type { DbClient } from '../types.ts';

type Call = { sql: string; params: readonly unknown[] };

/**
 * The project every request below names. Real id, computed the same way the SQL computes
 * it, so a test that asserts on `params[0]` is asserting on the value a route would
 * actually send rather than on a placeholder.
 */
const PROJECT = { id: projectIdForSlug('agentos'), slug: 'agentos' };
const P = `/api/p/${PROJECT.slug}`;

/** Every call passes a resolved project; there is no default and no test may imply one. */
/**
 * Every request in this file names its project. There is no default here and no test may
 * imply one — a suite that could omit the project would be proving the opposite of what it
 * is for.
 */
const req = (method: string, url: string, db: DbClient, options: Record<string, unknown> = {}) =>
  handleMetricsRequest(method, url, db, { project: PROJECT, ...options });

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
  const res = await req('GET', `${P}/cost/today`, db, { timezone: 'Asia/Riyadh' });

  assert.equal(res.status, 200);
  const body = res.body as Record<string, unknown>;
  assert.equal(body.usd, 12.4, 'the ticker shows $12.40 today');
  // Two of today's runs could not be priced. The ticker shows one number; this field
  // is how a caller knows whether that number is the whole story.
  assert.equal(body.unpricedRuns, 2);
  assert.equal(db.calls[0].params[0], PROJECT.id, 'the project is $1 on every ops statement');
  assert.equal(db.calls[0].params[1], 'Asia/Riyadh', 'the day boundary is the human’s, not UTC');
});

test('GET /api/cost/today is honestly empty when nothing has run', async () => {
  const db = fakeDb(() => [{ usd: null, runs: 0, unpriced_runs: 0 }]);
  const res = await req('GET', `${P}/cost/today`, db, { timezone: 'Asia/Riyadh' });
  assert.equal(res.status, 200);
  const body = res.body as Record<string, unknown>;
  assert.equal(body.usd, null, 'CostTicker renders `no cost data`, never a plausible $0.00');
  assert.equal(body.runs, 0);
});

test('GET /api/metrics/live returns a numerator and refuses to invent a denominator', async () => {
  const db = fakeDb(() => [
    { agent: 'sales/a', department: 'sales', total_runs: 5, successful_runs: 5, recent_runs: 5, recent_errors: 0 },
    { agent: 'sales/never-run', department: 'sales', total_runs: 0, successful_runs: 0, recent_runs: 0, recent_errors: 0 },
    { agent: 'deals/b', department: 'deals', total_runs: 8, successful_runs: 2, recent_runs: 8, recent_errors: 6 },
  ]);

  const res = await req('GET', `${P}/metrics/live`, db);
  const body = res.body as Record<string, unknown>;

  assert.equal(body.live, 1);
  assert.deepEqual(body.liveAgents, ['sales/a']);
  assert.deepEqual(body.byDepartment, { sales: 1 });
  assert.equal(body.failing, 1);
  assert.equal('total' in body, false, 'the total comes from the frontmatter projection, not from us');
  assert.equal(body.totalSource, 'GET /api/graph');
});

test('GET /api/metrics/runs shapes durable LAST RUNS rows, trace link included', async () => {
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

  const res = await req(
    'GET',
    `${P}/metrics/runs?agent=sales/account-enrichment&limit=5`,
    db,
  );
  const row = (res.body as { runs: Record<string, unknown>[] }).runs[0];

  assert.equal(row.startedAt, startedAt, 'ISO 8601 — relative time is the client\'s job');
  assert.equal('relativeTime' in row, false, 'do not pre-render "14m ago"');
  assert.equal(row.costUsd, 0.041, 'numeric columns arrive as strings from pg and must be coerced');
  assert.equal(row.traceUrl, 'http://langfuse.tailnet:3000/project/local/traces/deadbeef');
  assert.equal(db.calls[0].params[0], PROJECT.id, 'the project is $1');
  assert.equal(db.calls[0].params[1], 'sales/account-enrichment');
  assert.equal(db.calls[0].params[5], 5);
});

test('GET /api/runs is not claimed here — runner-engineer serves the live view', async () => {
  const db = fakeDb(() => [{ run_id: 'should-not-run' }]);
  const res = await req('GET', `${P}/runs?agent=sales/account-enrichment`, db);
  assert.equal(res.status, 404);
  assert.equal(db.calls.length, 0);
});

test('a KPI query returns the window, the previous window and the delta', async () => {
  let call = 0;
  const db = fakeDb(() => [{ value: call++ === 0 ? 120 : 100, runs: 120, unpriced: 0 }]);
  const res = await req('GET', `${P}/metrics/query?metric=runs&range=28d`, db);
  const body = res.body as Record<string, unknown>;

  assert.equal(body.value, 120);
  assert.equal(body.previous, 100);
  assert.equal(body.delta, 0.2, 'the ▲ chip on the KPI tile');
  // Project, window and offset are all bound parameters, not interpolated text — and the
  // previous window carries the same project as the current one, which is what makes the
  // ▲ chip a comparison rather than two unrelated numbers.
  assert.deepEqual(db.calls[0].params.slice(0, 3), [PROJECT.id, 672, 0]);
  assert.deepEqual(db.calls[1].params.slice(0, 3), [PROJECT.id, 1344, 672]);
});

test('a delta against nothing is null, not zero and not infinity', () => {
  assert.equal(deltaOf(5, 0), null);
  assert.equal(deltaOf(5, null), null);
  assert.equal(deltaOf(null, 5), null);
  assert.equal(deltaOf(150, 100), 0.5);
});

test('unknown metrics and ranges are rejected with a hint a human can act on', async () => {
  const db = fakeDb(() => []);

  const badMetric = await req('GET', `${P}/metrics/query?metric=vibes`, db);
  assert.equal(badMetric.status, 400);
  assert.equal((badMetric.body as { error: { code: string } }).error.code, 'unknown_metric');

  const badRange = await req('GET', `${P}/metrics/query?metric=runs&range=all-time`, db);
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

  const res = await req('GET', `${P}/metrics/activity?limit=12`, db, {
    timezone: 'Asia/Riyadh',
  });
  const item = (res.body as { items: Record<string, unknown>[] }).items[0];

  assert.equal(item.time, '09:41', 'rendered in the operator’s timezone');
  assert.equal(item.event, 'Meeting transcript processed');
  assert.equal(item.agentName, 'Follow-Up Coordinator');
});

test('a panel can only reach SQL through the named registry', async () => {
  const db = fakeDb(() => [{ label: 'deal', value: 12 }]);

  const ok = await req('GET', `${P}/metrics/sql/outputs_by_kind?days=30`, db);
  assert.equal(ok.status, 200);
  // The project leads the bind array and the panel's own parameter follows it. A panel
  // supplies `days`; it does not supply the isolation boundary.
  assert.deepEqual(db.calls[0].params, [PROJECT.id, 30]);
  assert.equal(db.calls[0].sql, NAMED_QUERIES.outputs_by_kind.sql);

  const pending = await req('GET', `${P}/metrics/sql/runway_estimate`, db);
  assert.equal(pending.status, 200);
  const pendingBody = pending.body as { rows: unknown[]; empty: boolean; reason: string };
  assert.deepEqual(pendingBody.rows, []);
  assert.equal(pendingBody.empty, true);
  assert.match(pendingBody.reason, /cash balance/);

  const unknown = await req('GET', `${P}/metrics/sql/drop_everything`, db);
  assert.equal(unknown.status, 400);
  assert.equal((unknown.body as { error: { code: string } }).error.code, 'unknown_query');

  // A path that is not a registry name does not resolve to a route at all.
  const injected = await req(
    'GET',
    `${P}/metrics/sql/${encodeURIComponent('SELECT 1; DROP TABLE ops.agent_runs')}`,
    db,
  );
  assert.equal(injected.status, 404);
  assert.equal(db.calls.length, 1, 'only the legitimate query ever executed');
});

test('named-query parameters are validated before binding', () => {
  assert.deepEqual(
    bindNamedQuery('outputs_by_kind', PROJECT.id, {}).params,
    [PROJECT.id, 30],
    'defaults apply, behind the project',
  );
  assert.throws(() => bindNamedQuery('outputs_by_kind', PROJECT.id, { days: '30; DROP TABLE x' }), /whole number/);
  assert.throws(() => bindNamedQuery('outputs_by_kind', PROJECT.id, { days: 99_999 }), /between 0 and 3650/);
  assert.throws(() => bindNamedQuery('outputs_recent', PROJECT.id, {}), /needs a "kind" parameter/);
});

test('a named query cannot be bound without a project, and cannot exist without a predicate', () => {
  // The runtime half of `project-scoping.md` invariant 8 at the registry seam. A widget
  // that reached this point with no project would not error on the way to the database —
  // it would return every project's rows under one project's heading.
  assert.throws(() => bindNamedQuery('outputs_by_kind', '', {}), /bound with no project/);

  for (const [name, query] of Object.entries(NAMED_QUERIES)) {
    if (query.status !== 'served') continue;
    assert.equal(
      query.fixed[0],
      PROJECT_ID_SLOT,
      `"${name}" does not reserve $1 for the project id — start \`fixed\` with PROJECT_ID_SLOT`,
    );
    assert.match(
      query.sql ?? '',
      /project_id\s*=\s*\$1::uuid/,
      `"${name}" has no project predicate. A query without one does not fail, it widens the answer.`,
    );
  }
});

test('every registered query binds every placeholder it declares', () => {
  for (const [name, query] of Object.entries(NAMED_QUERIES)) {
    if (!query.sql) continue;
    const placeholders = new Set(query.sql.match(/\$\d+/g) ?? []);
    const expected = query.fixed.length + query.params.length;
    assert.equal(
      placeholders.size,
      expected,
      `query "${name}" declares ${expected} binds but uses ${placeholders.size} placeholders`,
    );
  }
});

test('the metrics API is read-only', async () => {
  const db = fakeDb(() => []);
  const res = await req('POST', `${P}/cost/today`, db);
  assert.equal(res.status, 405);
  assert.equal(db.calls.length, 0);
});

test('a database outage degrades to an honest error, not a fabricated zero', async () => {
  const db: DbClient = {
    async query() {
      throw new Error('ECONNREFUSED');
    },
  };
  const res = await req('GET', `${P}/cost/today`, db);
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

/**
 * Amended by `runner-engineer` — see
 * `comms/inbox/observability-engineer/…-ledger-state-is-explicit.md`, filed as a
 * decision-request because `/api/cost/today` is your route.
 *
 * This used to assert `runs: 0` when the ledger was unreachable. That was the last place
 * a broken ledger could still impersonate the honest empty state: `{usd:null, runs:0}` is
 * byte-identical to a healthy ledger on a day with no runs. The count is now `null` —
 * unknown, not zero — and every response carries `ledger.state`. The ticker's rendering
 * is unchanged, because it keys on `usd === null`.
 */
test('GET /api/cost/today distinguishes an unreadable ledger from an empty one', async () => {
  const runner = await buildRunner({ watch: false, observe: false });
  try {
    const res = await runner.app.inject({ method: 'GET', url: `${P}/cost/today` });
    assert.equal(res.statusCode, 200);
    const body = res.json() as {
      usd: number | null;
      runs: number | null;
      unpricedRuns: number | null;
      ledger: { state: string; hint: string };
    };
    assert.equal(body.usd, null, 'CostTicker renders `no cost data`, never a plausible $0.00');
    assert.equal(body.runs, null, 'a count we cannot read is null — `0` would be a claim');
    assert.equal(body.unpricedRuns, null);
    assert.equal(body.ledger.state, 'absent');
    assert.ok(body.ledger.hint.length > 0);
  } finally {
    await runner.close();
  }
});

/* -------------------------------------------------------------------------- *
 * M15 — the project axis (`Plan §10`, ADR-015) and the account split (`Plan §11`).
 *
 * The tests below exist for one reason: a filter is the easiest place in this system to
 * manufacture a confident zero, and a project axis multiplies every surface that could
 * produce one. Each of the "no data" states has to come back as its own answer.
 * -------------------------------------------------------------------------- */

test('a metrics request that names no project is refused, not defaulted', async () => {
  const db = fakeDb(() => [{ usd: null, runs: 0, unpriced_runs: 0 }]);

  // Deliberately the raw handler: `req` would inject a project, which is what this asserts
  // cannot happen implicitly.
  const res = await handleMetricsRequest('GET', '/api/cost/today', db, { project: PROJECT });
  assert.equal(res.status, 400);
  const error = (res.body as { error: { code: string; hint: string } }).error;
  assert.equal(error.code, 'project_scope_missing');
  assert.match(error.hint, /\/api\/p\/<project>\/cost\/today/);
  assert.match(error.hint, /no default project/);
  assert.equal(db.calls.length, 0, 'an unscoped request must not reach the database');
});

test('the mount and the path must agree about which project this is', async () => {
  const db = fakeDb(() => [{ usd: 1, runs: 1, unpriced_runs: 0 }]);
  const res = await handleMetricsRequest('GET', '/api/p/client-x/cost/today', db, {
    project: PROJECT,
  });
  assert.equal(res.status, 500);
  assert.equal((res.body as { error: { code: string } }).error.code, 'project_scope_mismatch');
  assert.equal(db.calls.length, 0, 'no numbers are returned while the two disagree');
});

test('an empty project answers 0 runs; an unreadable one answers null — and they are different bodies', async () => {
  // The total, then the per-account split. Both empty, from a ledger we could read.
  const empty = fakeDb((c) => (/GROUP BY/.test(c.sql) ? [] : [{ usd: null, runs: 0, unpriced_runs: 0 }]));
  const res = await req('GET', `${P}/cost/today`, empty);
  const body = res.body as Record<string, unknown>;

  // A real count of zero, from a ledger we could read. `runs: 0` is a claim and it is a
  // true one here — which is exactly why the unreachable case must never produce it.
  assert.equal(body.runs, 0);
  assert.equal(body.usd, null);
  assert.deepEqual(body.byAccount, [], 'no runs today means nothing to split by account');
  assert.deepEqual(body.project, { slug: 'agentos', id: PROJECT.id, state: 'mounted' });
});

test('every metrics body names the project it is about', async () => {
  const db = fakeDb(() => []);
  for (const path of ['/metrics/runs', '/metrics/activity', '/metrics/live', '/metrics/accounts']) {
    const res = await req('GET', `${P}${path}`, db);
    assert.equal(res.status, 200, path);
    const echoed = (res.body as { project?: { slug: string } }).project;
    assert.equal(echoed?.slug, 'agentos', `${path} must say whose numbers these are`);
  }
});

test('a scope violation is reported as a scope violation, never as an outage', async () => {
  // What `ops.project_visible()` raises when a query reaches a project-scoped table with
  // no scope set: SQLSTATE 42501, message `project_scope_missing: …` (migration 0005 §5).
  const db: DbClient = {
    async query() {
      throw Object.assign(
        new Error('project_scope_missing: a query reached a project-scoped table with no project in scope'),
        { code: '42501' },
      );
    },
  };
  const res = await req('GET', `${P}/metrics/runs`, db);
  assert.equal(res.status, 500);
  const error = (res.body as { error: { code: string; hint: string } }).error;
  assert.equal(
    error.code,
    'project_scope_unset',
    'folding this into metrics_unavailable would make a dropped axis look like a dead database',
  );
  assert.match(error.hint, /not reported as a database outage/);
});

test('a run id from another project is "not yours", not an empty drawer', async () => {
  // No spans, and no parent row either: the run belongs to some other project.
  const foreign = fakeDb(() => []);
  const res = await req('GET', `${P}/runs/run_abc123/tools`, foreign);
  assert.equal(res.status, 404);
  assert.equal((res.body as { error: { code: string } }).error.code, 'run_not_in_project');

  // Same empty span list, but the run *is* ours — an honest empty result.
  let call = 0;
  const mine = fakeDb(() => (call++ === 0 ? [] : [{ n: 1 }]));
  const ok = await req('GET', `${P}/runs/run_abc123/tools`, mine);
  assert.equal(ok.status, 200);
  assert.deepEqual((ok.body as { toolCalls: unknown[] }).toolCalls, []);
});

test('tool spans reach the project through the parent row, not a second copy of it', async () => {
  const db = fakeDb(() => [{ seq: 1, name: 'Read', status: 'ok', started_at: '2026-08-15T06:41:00.000Z' }]);
  await req('GET', `${P}/runs/run_abc123/tools`, db);
  assert.match(
    db.calls[0].sql,
    /JOIN ops\.agent_runs r ON r\.run_id = t\.run_id AND r\.project_id = \$1::uuid/,
    'ops.agent_run_tools has no project_id of its own, on purpose — it borrows the parent\'s',
  );
  assert.equal(db.calls[0].params[0], PROJECT.id);
});

test('the account split has an unattributed bucket and says how many accounts exist', async () => {
  let call = 0;
  const db = fakeDb(() =>
    call++ === 0
      ? [
          { account_id: null, account: 'unattributed', label: null, source: 'unattributed', usd: 1.234, runs: 3, unpriced_runs: 1 },
        ]
      : [{ n: 0 }],
  );
  const res = await req('GET', `${P}/metrics/accounts?range=28d`, db);
  assert.equal(res.status, 200);
  const body = res.body as { spend: Record<string, unknown>[]; accountsRegistered: number; accountsEnforced: boolean };

  assert.equal(body.spend[0].account, 'unattributed');
  assert.equal(body.spend[0].usd, 1.23, 'money rounds to cents; it is never invented');
  assert.equal(body.spend[0].accountId, null, 'unattributed is a bucket, not account zero');
  assert.equal(
    body.accountsRegistered,
    0,
    'an empty split beside zero registered accounts says the split has never had anything to split',
  );
  assert.equal(body.accountsEnforced, false, 'structural, not demonstrated — project-scoping.md §6');
});

test('an account filter must be an account id or the unattributed bucket', async () => {
  const db = fakeDb(() => []);
  const bad = await req('GET', `${P}/metrics/query?metric=cost&account=work`, db);
  assert.equal(bad.status, 400);
  assert.equal((bad.body as { error: { code: string } }).error.code, 'bad_account');
  assert.equal(db.calls.length, 0);

  const ok = await req('GET', `${P}/metrics/query?metric=cost&account=unattributed&compare=false`, db);
  assert.equal(ok.status, 200);
  assert.equal(db.calls[0].params[6], 'unattributed', 'the account rides in $7, bound, never interpolated');
});

test('splitProjectPath is the only place the /api/p/ shape is known', () => {
  assert.deepEqual(splitProjectPath('/api/p/agentos/metrics/runs'), {
    slug: 'agentos',
    rest: '/api/metrics/runs',
  });
  assert.deepEqual(splitProjectPath('/api/p/agentos'), { slug: 'agentos', rest: '/api' });
  assert.equal(splitProjectPath('/api/metrics/runs'), null);
  // `p` is a reserved slug precisely so this cannot be a project called "p".
  assert.deepEqual(splitProjectPath('/api/p/client-x/cost/today'), {
    slug: 'client-x',
    rest: '/api/cost/today',
  });
});
