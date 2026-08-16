/**
 * Every SQL statement this service runs. There is no query builder and no string
 * concatenation of user input anywhere in this file: values reach Postgres as bind
 * parameters, and the only identifiers that vary are ones we wrote ourselves.
 *
 * Two halves:
 *   1. METRIC queries  — the ops numbers behind `query.source: "langfuse"` in the
 *                        panel contract (runs / cost / latency_p50 / error_rate),
 *                        plus LAST RUNS, the activity feed and status derivation.
 *   2. NAMED queries   — the `query.source: "sql"` registry for business widgets.
 *                        A panel references a query by NAME. The panel contract says
 *                        "a panel file can never contain raw SQL"; this registry is
 *                        how that stays true rather than being a house rule.
 */

import type { DbClient } from '../observability/types.ts';

/** Windows a panel or KPI tile may ask for. Anything else is rejected. */
export const RANGES = {
  '24h': 24,
  '7d': 24 * 7,
  '14d': 24 * 14,
  '28d': 24 * 28,
  '30d': 24 * 30,
  '90d': 24 * 90,
} as const;

export type Range = keyof typeof RANGES;

export function isRange(value: string): value is Range {
  return Object.hasOwn(RANGES, value);
}

export type MetricName = 'runs' | 'cost' | 'latency_p50' | 'error_rate';

export const METRICS: MetricName[] = ['runs', 'cost', 'latency_p50', 'error_rate'];

export function isMetric(value: string): value is MetricName {
  return (METRICS as string[]).includes(value);
}

export type MetricFilter = {
  agent?: string;
  department?: string;
  /** `mission-control.json` has a "Failed runs" tile: `filter: {status: "error"}`. */
  status?: string;
};

/** Columns a metric may be grouped by. A closed set — never a value from a request. */
export const GROUP_BY = { agent: 'agent', department: 'department' } as const;
export type GroupBy = keyof typeof GROUP_BY;
export const isGroupBy = (v: string): v is GroupBy => Object.hasOwn(GROUP_BY, v);

/** Buckets a series may use. Also closed. */
export const BUCKETS = { hour: 'hour', day: 'day', week: 'week' } as const;
export type Bucket = keyof typeof BUCKETS;
export const isBucket = (v: string): v is Bucket => Object.hasOwn(BUCKETS, v);

/**
 * Real runs only, everywhere. Dry runs are traced (you can still debug them) but they
 * are not work: counting them would inflate the LIVE counter and the cost ticker with
 * rehearsals.
 */
const REAL_RUNS = `dry_run = false AND status <> 'awaiting-approval'`;

/**
 * The SQL expression behind each metric name. Selecting from this map is the only way a
 * metric name reaches a query: the request supplies a key, never an expression.
 */
const EXPRESSION: Record<MetricName, string> = {
  runs: 'count(*)::float8',
  cost: 'sum(cost_usd)::float8',
  latency_p50: 'percentile_cont(0.5) WITHIN GROUP (ORDER BY duration_ms)::float8',
  error_rate: `(count(*) FILTER (WHERE status = 'error'))::float8 / NULLIF(count(*), 0)`,
};

/**
 * "N hours ago", as an expression Postgres can resolve without a function lookup.
 *
 * The obvious spelling — `make_interval(hours => $n)` — is a trap. `make_interval`
 * takes `int` for every unit except `secs`, and Postgres resolves the overload at
 * **parse** time, so a `float8` argument throws before a single row is read and before
 * a `IS NULL` guard can spare it. It fails identically whether the parameter is 24,
 * 24.5 or NULL. Multiplying a unit interval has no overload to resolve, keeps the
 * parameter `float8`, and is exact for fractional windows rather than truncating them
 * (`0.5` really means thirty minutes, not zero hours).
 *
 * Every time window in this file goes through these two helpers. Nothing here calls
 * `make_interval`, and nothing should: a query in this file is only ever checked by a
 * real Postgres, so the safest expression is the one with no signature to get wrong.
 */
const hoursAgo = (param: string) => `(${param}::float8 * interval '1 hour')`;

/**
 * Window + filter predicate shared by every ops query. `$1` and `$2` are the window
 * bounds in hours ago; `$3`–`$5` are the optional filters, each a no-op when null.
 */
const RUN_SCOPE = `
    ${REAL_RUNS}
      AND started_at >= now() - ${hoursAgo('$1')}
      AND started_at <  now() - ${hoursAgo('$2')}
      AND ($3::text IS NULL OR agent = $3)
      AND ($4::text IS NULL OR department = $4)
      AND ($5::text IS NULL OR status = $5)
`;

const scopeParams = (filter: MetricFilter, from: number, to: number) =>
  [from, to, filter.agent ?? null, filter.department ?? null, filter.status ?? null] as const;

/**
 * One metric over one window. The metric name selects a fixed SQL expression from a
 * closed set — it is never interpolated from a request.
 */
export async function metric(
  db: DbClient,
  name: MetricName,
  filter: MetricFilter,
  fromHoursAgo: number,
  toHoursAgo = 0,
): Promise<{ value: number | null; runs: number; unpriced: number }> {
  const sql = `
    SELECT ${EXPRESSION[name]} AS value,
           count(*)::int AS runs,
           (count(*) FILTER (WHERE cost_usd IS NULL))::int AS unpriced
    FROM ops.agent_runs
    WHERE ${RUN_SCOPE}
  `;

  const { rows } = await db.query<{ value: number | null; runs: number; unpriced: number }>(sql, [
    ...scopeParams(filter, fromHoursAgo, toHoursAgo),
  ]);

  const row = rows[0] ?? { value: null, runs: 0, unpriced: 0 };
  return { value: row.value === null ? null : Number(row.value), runs: row.runs, unpriced: row.unpriced };
}

/**
 * The same metric bucketed over time — KPI sparklines and the `area-chart` widget
 * (`shape: "series", groupBy: "day"` in the panel contract).
 *
 * Buckets with no runs are absent rather than zero-filled: the chart draws what
 * happened, and a day the runner was off is not a day of zero work. The renderer
 * decides how to span a gap; inventing rows here would take that choice away from it.
 */
export async function metricSeries(
  db: DbClient,
  name: MetricName,
  filter: MetricFilter,
  fromHoursAgo: number,
  bucket: Bucket,
): Promise<{ t: string; v: number | null; runs: number }[]> {
  const sql = `
    SELECT date_trunc('${BUCKETS[bucket]}', started_at) AS t,
           ${EXPRESSION[name]} AS v,
           count(*)::int AS runs
    FROM ops.agent_runs
    WHERE ${RUN_SCOPE}
    GROUP BY 1
    ORDER BY 1
  `;
  const { rows } = await db.query<{ t: unknown; v: number | null; runs: number }>(sql, [
    ...scopeParams(filter, fromHoursAgo, 0),
  ]);
  return rows.map((r) => ({
    t: r.t instanceof Date ? r.t.toISOString() : String(r.t),
    v: r.v === null ? null : Number(r.v),
    runs: r.runs,
  }));
}

/**
 * The same metric split by agent or department — `cost-table` and `bar-list`
 * (`shape: "list", groupBy: "agent"`), and the per-department live counts in §2.2.
 */
export async function metricBreakdown(
  db: DbClient,
  name: MetricName,
  filter: MetricFilter,
  fromHoursAgo: number,
  groupBy: GroupBy,
  limit: number,
): Promise<{ label: string; value: number | null; runs: number; unpriced: number }[]> {
  const sql = `
    SELECT ${GROUP_BY[groupBy]} AS label,
           ${EXPRESSION[name]} AS value,
           count(*)::int AS runs,
           (count(*) FILTER (WHERE cost_usd IS NULL))::int AS unpriced
    FROM ops.agent_runs
    WHERE ${RUN_SCOPE}
    GROUP BY 1
    ORDER BY value DESC NULLS LAST
    LIMIT $6
  `;
  const { rows } = await db.query<{ label: string; value: number | null; runs: number; unpriced: number }>(
    sql,
    [...scopeParams(filter, fromHoursAgo, 0), limit],
  );
  return rows.map((r) => ({
    label: r.label,
    value: r.value === null ? null : Number(r.value),
    runs: r.runs,
    unpriced: r.unpriced,
  }));
}

/**
 * The shell cost ticker (§2.0). "Today" is the human's today, so the day boundary is
 * taken in the configured timezone rather than UTC.
 */
export async function costToday(
  db: DbClient,
  timezone: string,
): Promise<{ usd: number | null; runs: number; unpricedRuns: number }> {
  // `sum` of no rows (or of only-NULL costs) is NULL. Do not coalesce to 0:
  // `$0.00 today` is a real reading, and an empty ledger is not a reading
  // (Part VII.3 / standing rule 9).
  const sql = `
    SELECT sum(cost_usd)::float8 AS usd,
           count(*)::int AS runs,
           (count(*) FILTER (WHERE cost_usd IS NULL))::int AS unpriced_runs
    FROM ops.agent_runs
    WHERE ${REAL_RUNS}
      AND started_at >= date_trunc('day', now() AT TIME ZONE $1) AT TIME ZONE $1
  `;
  const { rows } = await db.query<{ usd: number | null; runs: number; unpriced_runs: number }>(sql, [timezone]);
  const row = rows[0] ?? { usd: null, runs: 0, unpriced_runs: 0 };
  return {
    usd: row.usd === null ? null : Number(row.usd),
    runs: row.runs,
    unpricedRuns: row.unpriced_runs,
  };
}

/**
 * LAST RUNS — the drawer's five rows (§2.3) and Mission Control's `data-table`.
 *
 * `trace_url` is selected here rather than composed by the caller: the drawer row must
 * deep-link to the trace of *that* run, and the only place that knows the trace id is
 * the row the instrumentation wrote.
 */
export async function lastRuns(
  db: DbClient,
  filter: MetricFilter,
  limit: number,
  fromHoursAgo: number | null = null,
) {
  const sql = `
    SELECT run_id, agent, agent_name, department, status, started_at, duration_ms,
           cost_usd, cost_source, tool_call_count, trace_url
    FROM ops.agent_runs
    WHERE ${REAL_RUNS}
      AND ($1::text IS NULL OR agent = $1)
      AND ($2::text IS NULL OR department = $2)
      AND ($3::text IS NULL OR status = $3)
      AND ($4::float8 IS NULL OR started_at >= now() - ${hoursAgo('$4')})
    ORDER BY started_at DESC
    LIMIT $5
  `;
  const { rows } = await db.query(sql, [
    filter.agent ?? null,
    filter.department ?? null,
    filter.status ?? null,
    fromHoursAgo,
    limit,
  ]);
  return rows;
}

/** The activity feed (§2.5). Agent runs are the activity in phase 1. */
export async function activityFeed(db: DbClient, department: string | null, limit: number) {
  const sql = `
    SELECT run_id, agent, agent_name, department, status, started_at,
           activity_event, activity_detail, trace_url
    FROM ops.agent_runs
    WHERE ${REAL_RUNS}
      AND activity_event IS NOT NULL
      AND ($1::text IS NULL OR department = $1)
    ORDER BY started_at DESC
    LIMIT $2
  `;
  const { rows } = await db.query(sql, [department, limit]);
  return rows;
}

/**
 * Per-agent evidence for status derivation (§3.4). The "recent" window is the last N
 * runs per agent, not the last N days — a weekly agent should not read as healthy
 * merely because it has been idle.
 */
export async function agentEvidence(db: DbClient, window: number) {
  const sql = `
    WITH ranked AS (
      SELECT agent, department, status, started_at,
             row_number() OVER (PARTITION BY agent ORDER BY started_at DESC) AS rn
      FROM ops.agent_runs
      WHERE ${REAL_RUNS}
    )
    SELECT agent,
           min(department) AS department,
           count(*)::int AS total_runs,
           (count(*) FILTER (WHERE status = 'ok'))::int AS successful_runs,
           (count(*) FILTER (WHERE rn <= $1))::int AS recent_runs,
           (count(*) FILTER (WHERE rn <= $1 AND status = 'error'))::int AS recent_errors,
           max(started_at) AS last_run_at,
           max(started_at) FILTER (WHERE status = 'ok') AS last_success_at
    FROM ranked
    GROUP BY agent
    ORDER BY agent
  `;
  const { rows } = await db.query(sql, [window]);
  return rows;
}

/** Tool spans for one run — what the drawer expands into. */
export async function runToolCalls(db: DbClient, runId: string) {
  const sql = `
    SELECT seq, name, status, started_at, duration_ms, error
    FROM ops.agent_run_tools
    WHERE run_id = $1
    ORDER BY seq
  `;
  const { rows } = await db.query(sql, [runId]);
  return rows;
}

/* ------------------------------------------------------------------------- *
 * The named query registry does NOT live here.
 *
 * It is `./registry.ts`, and it is the only one. A second copy used to sit at the
 * bottom of this file — same five names, subtly different SQL (`count(*)::int` here
 * against `::float8` there, which is a different JSON type on the wire). Nothing
 * imported it; `routes/metrics.ts` and `scripts/check-metrics.mjs` both read
 * `registry.ts`. It was removed rather than reconciled: two definitions of
 * `outputs_by_kind` is one definition too many, and the dead one is the one a reader
 * finds first because this is the file called `queries.ts`.
 *
 * Add a business query in `registry.ts`. This file holds the ops metrics only.
 * ------------------------------------------------------------------------- */
