/**
 * Every SQL string this service can emit, executed against a real Postgres.
 *
 * ## Why this file exists
 *
 * The rest of the runner's tests stub `DbClient`. A stub records the SQL and hands back
 * rows; it never asks Postgres whether the SQL is *legal*. That gap hid two bugs of the
 * same class for the whole life of the project, and both surfaced within an hour of the
 * database being started for the first time:
 *
 *   1. `queries.ts` built its LAST RUNS window with `make_interval(hours => $4::float8)`.
 *      `make_interval` takes `int` for `hours`, Postgres resolves the overload at parse
 *      time, and so `GET /api/metrics/runs` returned 503 unconditionally — even with no
 *      `hours` argument, because the `$4::float8 IS NULL` guard runs long after parsing.
 *   2. `registry.ts` called `safe_num(...)` and `safe_ts(...)` in roughly thirty business
 *      queries. Neither function was defined in any migration or in the database.
 *
 * Neither is reachable by a unit test, a type checker, or `docker compose config`. Both
 * are caught in milliseconds by asking Postgres to parse the string. So: this suite gets
 * the SQL out of the real code paths and makes the real server judge it.
 *
 * ## Executing, not just PREPAREing
 *
 * `PREPARE` would catch a parse or function-resolution error. Executing catches those
 * *and* the bind-time errors a prepare with hand-declared types would paper over — a
 * fractional value sent to an `int` parameter, a text array bound to `= ANY`, a `$6` the
 * caller forgot to supply. Every statement here is a SELECT, and every one runs inside
 * `BEGIN READ ONLY` … `ROLLBACK`, so the suite cannot mutate the ledger it reads. That
 * transaction is also an assertion in itself: a registered "query" that tries to write
 * fails here.
 *
 * The ledger is empty and the assertions never depend on rows coming back — only on the
 * statement being accepted. This suite passes on an empty database, which is the state
 * it will normally be run in (standing rule 9: no seeded demo data, ever).
 *
 * ## Running it
 *
 *   docker compose -f infra/compose.yaml --env-file .env up -d postgres
 *   set -a && . ./.env && set +a
 *   DATABASE_URL="postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@127.0.0.1:5433/$APP_DB" \
 *     ./node_modules/.bin/tsx --test apps/runner/src/db/__tests__/sql-executes.test.ts
 *
 * With `DATABASE_URL` unset the whole suite skips with a message that says how to get a
 * database. A laptop with no Docker must stay green — a test that fails for the absence
 * of infrastructure gets commented out within a week, and then it protects nothing.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as Q from '../queries.ts';
import { NAMED_QUERIES, bindNamedQuery } from '../registry.ts';
import { migrate } from '../client.ts';
import { createLedger, writeOutput } from '../ledger.ts';
import { pruneRetention } from '../prune.ts';
import type { DbClient } from '../../observability/types.ts';

const DATABASE_URL = process.env.DATABASE_URL;
const SKIP = !DATABASE_URL;
const SKIP_REASON =
  'DATABASE_URL is not set. Start the data plane ' +
  '(`docker compose -f infra/compose.yaml --env-file .env up -d postgres`) and export ' +
  'DATABASE_URL to run the SQL against a real Postgres.';

/* -------------------------------------------------------------------------- *
 * Harvesting: get the SQL out of the real call paths.
 *
 * The alternative — exporting every SQL string as a constant so a test can read it —
 * would test the constants rather than the code. Several of these statements are
 * assembled at call time from the metric name, the bucket and the group-by column, so
 * the string that reaches Postgres only exists once a query function has been called.
 * A recording DbClient is how we get exactly that string.
 * -------------------------------------------------------------------------- */

type Statement = { label: string; sql: string; params: readonly unknown[] };

function recorder(): { db: DbClient; statements: Statement[]; label: (l: string) => void } {
  const statements: Statement[] = [];
  let current = 'unlabelled';
  return {
    statements,
    label: (l: string) => {
      current = l;
    },
    db: {
      async query(sql: string, params: readonly unknown[] = []) {
        statements.push({ label: current, sql, params });
        return { rows: [] as never[] };
      },
    },
  };
}

/** Every filter shape a route can produce, including "all filters at once". */
const FILTERS: Q.MetricFilter[] = [
  {},
  { agent: 'sales/follow-up-coordinator' },
  { department: 'sales' },
  { agent: 'sales/follow-up-coordinator', department: 'sales', status: 'error' },
];

async function harvestOpsQueries(): Promise<Statement[]> {
  const rec = recorder();
  const { db, label } = rec;

  for (const filter of FILTERS) {
    for (const name of Q.METRICS) {
      // Fractional hours on purpose. `RANGES` is all whole numbers today, but the
      // parameter is typed `number` and the bug this suite exists for was exactly a
      // fractional value meeting an int-only function signature.
      label(`metric(${name})`);
      await Q.metric(db, name, filter, 24, 0);
      label(`metric(${name}) fractional window`);
      await Q.metric(db, name, filter, 0.5, 0);

      for (const bucket of Object.keys(Q.BUCKETS) as Q.Bucket[]) {
        label(`metricSeries(${name}, ${bucket})`);
        await Q.metricSeries(db, name, filter, 168, bucket);
      }
      for (const groupBy of Object.keys(Q.GROUP_BY) as Q.GroupBy[]) {
        label(`metricBreakdown(${name}, ${groupBy})`);
        await Q.metricBreakdown(db, name, filter, 168, groupBy, 10);
      }
    }

    label('lastRuns (no window) — the LAST RUNS default');
    await Q.lastRuns(db, filter, 5);
    label('lastRuns (24h window)');
    await Q.lastRuns(db, filter, 5, 24);
    // The regression itself. Before the fix this statement threw at parse time whether
    // the value was 24, 0.5 or null.
    label('lastRuns (fractional window) — the make_interval regression');
    await Q.lastRuns(db, filter, 5, 0.5);
  }

  for (const range of Object.keys(Q.RANGES) as Q.Range[]) {
    label(`metric over range ${range}`);
    await Q.metric(db, 'runs', {}, Q.RANGES[range], 0);
    // The KPI chip's previous window: `hours * 2` to `hours`.
    label(`metric over previous window of ${range}`);
    await Q.metric(db, 'runs', {}, Q.RANGES[range] * 2, Q.RANGES[range]);
  }

  label('costToday');
  await Q.costToday(db, 'Asia/Riyadh');
  label('costToday (UTC)');
  await Q.costToday(db, 'UTC');
  label('activityFeed (all departments)');
  await Q.activityFeed(db, null, 12);
  label('activityFeed (one department)');
  await Q.activityFeed(db, 'sales', 12);
  label('agentEvidence — status derivation');
  await Q.agentEvidence(db, 20);
  label('runToolCalls — the drawer span expansion');
  await Q.runToolCalls(db, 'run_0000000000');

  return rec.statements;
}

/** Every `served` entry in the named-query registry, bound with its declared defaults. */
function harvestNamedQueries(): Statement[] {
  const out: Statement[] = [];
  for (const [name, query] of Object.entries(NAMED_QUERIES)) {
    if (query.status !== 'served') continue;
    const supplied: Record<string, unknown> = {};
    for (const spec of query.params) {
      // `bindNamedQuery` supplies declared defaults; a parameter without one is
      // required, and a panel would have to pass it. `kind` is the only such case.
      if (spec.default === undefined) supplied[spec.name] = spec.type === 'int' ? 1 : 'deal';
    }
    const bound = bindNamedQuery(name, supplied);
    assert.ok(bound.sql, `${name} is served but carries no SQL`);
    out.push({ label: `NAMED_QUERIES.${name}`, sql: bound.sql!, params: bound.params });
  }
  return out;
}

/* -------------------------------------------------------------------------- *
 * The suite
 * -------------------------------------------------------------------------- */

test('every SQL statement the runner can emit is accepted by a real Postgres', { skip: SKIP && SKIP_REASON }, async (t) => {
  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString: DATABASE_URL, max: 2 });

  try {
    // The functions the registry calls (`app.safe_num`, `app.safe_ts`) arrive in a
    // migration. Applying them here is why "the SQL parses" and "the schema this SQL
    // needs exists" are one assertion rather than two that can drift apart.
    await migrate({
      query: (sql, params) =>
        pool.query(sql, params ? [...params] : undefined) as never,
    });

    const statements = [...(await harvestOpsQueries()), ...harvestNamedQueries()];
    assert.ok(statements.length > 50, `harvested only ${statements.length} statements — the harvester is broken`);

    const client = await pool.connect();
    const failures: string[] = [];
    try {
      // READ ONLY: this suite reads a live ledger. It must not be able to change it,
      // and a "query" that tries to write must fail rather than succeed quietly.
      await client.query('BEGIN READ ONLY');
      for (const s of statements) {
        try {
          await client.query({ text: s.sql, values: [...s.params] });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          failures.push(`${s.label}: ${message}\n${s.sql.trim()}`);
          // A failed statement aborts the transaction; restart it so the remaining
          // statements are still checked. One run, every problem, not a bisect.
          await client.query('ROLLBACK');
          await client.query('BEGIN READ ONLY');
        }
      }
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }

    assert.deepEqual(
      failures,
      [],
      `${failures.length} of ${statements.length} statements were rejected by Postgres:\n\n${failures.join('\n\n')}`,
    );
    t.diagnostic(`${statements.length} statements accepted`);
  } finally {
    await pool.end();
  }
});

/**
 * The write path, and the prune, checked without writing anything.
 *
 * These statements have the same never-run-against-Postgres history as the reads, and
 * higher stakes. `recordRun` inserts 26 columns into `ops.agent_runs`; one column name
 * that does not exist and the very first real run fails to be recorded, leaving every
 * dashboard empty for a reason nobody would look for — the ledger would be empty in
 * exactly the way an honest empty ledger is empty. `writeOutput`'s `ON CONFLICT
 * (kind, entity_key) WHERE entity_key IS NOT NULL` additionally has to match a partial
 * unique index by predicate, which is inferred at plan time and is easy to get subtly
 * wrong.
 *
 * They cannot be executed the way the reads are: they mutate. `PREPARE` is the right
 * instrument — it parses *and plans* the statement, so it resolves every column, every
 * function and the ON CONFLICT index inference, then stops before touching a row.
 */
test('the write path and the prune plan cleanly against a real Postgres', { skip: SKIP && SKIP_REASON }, async (t) => {
  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString: DATABASE_URL, max: 2 });

  try {
    const rec = recorder();
    rec.label('recordRun — ops.agent_runs insert + its tool spans');
    await createLedger(rec.db).recordRun(
      {
        runId: 'run_probe', traceId: null, traceUrl: null,
        agent: 'sales/probe', agentName: 'Probe', department: 'sales', model: 'claude-opus-4',
        trigger: 'manual', sessionId: null, dryRun: false, status: 'ok',
        startedAt: new Date().toISOString(), endedAt: new Date().toISOString(), durationMs: 1,
        inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0,
        costUsd: 0, costSource: 'sdk', toolCallCount: 1, errorCount: 0, redactionCount: 0,
        activityEvent: 'Probe', activityDetail: 'probe', error: null,
      } as never,
      [
        {
          runId: 'run_probe', spanId: 'span_1', seq: 1, name: 'Read', status: 'ok',
          startedAt: new Date().toISOString(), durationMs: 1, error: null,
        } as never,
      ],
    );
    rec.label('writeOutput — app.agent_outputs upsert');
    await writeOutput(rec.db, {
      runId: 'run_probe', agent: 'sales/probe', department: 'sales',
      kind: 'deal', entityKey: 'probe', payload: { value: 1 },
    });
    rec.label('pruneRetention — ops.prune()');
    await pruneRetention(rec.db);

    const client = await pool.connect();
    const failures: string[] = [];
    try {
      for (const [i, s] of rec.statements.entries()) {
        const name = `probe_${i}`;
        try {
          await client.query(`PREPARE ${name} AS ${s.sql}`);
          await client.query(`DEALLOCATE ${name}`);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          failures.push(`${s.label}: ${message}\n${s.sql.trim()}`);
        }
      }
    } finally {
      client.release();
    }

    assert.deepEqual(
      failures,
      [],
      `${failures.length} write statements failed to plan:\n\n${failures.join('\n\n')}`,
    );
    t.diagnostic(`${rec.statements.length} write statements planned`);

    // Nothing was written. This is the assertion that says the probe above is a probe.
    const { rows } = await pool.query(
      `SELECT (SELECT count(*) FROM ops.agent_runs      WHERE run_id = 'run_probe') AS runs,
              (SELECT count(*) FROM ops.agent_run_tools WHERE run_id = 'run_probe') AS tools,
              (SELECT count(*) FROM app.agent_outputs   WHERE entity_key = 'probe') AS outputs`,
    );
    assert.deepEqual(
      { runs: Number(rows[0].runs), tools: Number(rows[0].tools), outputs: Number(rows[0].outputs) },
      { runs: 0, tools: 0, outputs: 0 },
      'PREPARE must plan without writing — a test that seeds the ledger breaks standing rule 9',
    );
  } finally {
    await pool.end();
  }
});

/**
 * The harvester is the weak point of the suite above: a query function added to
 * `queries.ts` and not called by `harvestOpsQueries` is untested, and nothing would say
 * so. This asserts the harvester keeps up with the module.
 *
 * It needs no database, so it runs everywhere — including the laptop that skips the
 * suite above. If it fails there, the coverage gap is visible before anyone has Docker.
 */
test('the harvester covers every query function exported by queries.ts', () => {
  const HARVESTED = new Set([
    'metric',
    'metricSeries',
    'metricBreakdown',
    'costToday',
    'lastRuns',
    'activityFeed',
    'agentEvidence',
    'runToolCalls',
  ]);

  const exported = Object.entries(Q)
    .filter(([, v]) => typeof v === 'function' && v.constructor.name === 'AsyncFunction')
    .map(([k]) => k);

  const missing = exported.filter((name) => !HARVESTED.has(name));
  assert.deepEqual(
    missing,
    [],
    `queries.ts exports ${missing.join(', ')}, which no statement in this suite ever executes. ` +
      `Add a call to harvestOpsQueries() and the name to HARVESTED — an unexecuted query is ` +
      `an unverified query, and that is exactly how the make_interval bug survived.`,
  );

  const stale = [...HARVESTED].filter((name) => !exported.includes(name));
  assert.deepEqual(stale, [], `HARVESTED lists ${stale.join(', ')}, which queries.ts no longer exports.`);
});

/**
 * Every `served` registry entry must be reached by the suite. `pending` entries carry no
 * SQL by construction, so there is nothing to execute — that is the point of the status.
 */
test('every served named query has SQL and every pending one has none', () => {
  for (const [name, query] of Object.entries(NAMED_QUERIES)) {
    if (query.status === 'served') {
      assert.ok(query.sql, `${name} is served but has no SQL — it would 200 with a silent empty payload.`);
    } else {
      assert.equal(query.sql, undefined, `${name} is pending but carries SQL — it could be run by accident.`);
      assert.ok(query.blockedBy, `${name} is pending without a reason a panel can show.`);
    }
  }
});
