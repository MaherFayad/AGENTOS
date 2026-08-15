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
 * Window + filter predicate shared by every ops query. `$1` and `$2` are the window
 * bounds in hours ago; `$3`–`$5` are the optional filters, each a no-op when null.
 */
const RUN_SCOPE = `
    ${REAL_RUNS}
      AND started_at >= now() - make_interval(hours => $1)
      AND started_at <  now() - make_interval(hours => $2)
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
): Promise<{ usd: number; runs: number; unpricedRuns: number }> {
  const sql = `
    SELECT coalesce(sum(cost_usd), 0)::float8 AS usd,
           count(*)::int AS runs,
           (count(*) FILTER (WHERE cost_usd IS NULL))::int AS unpriced_runs
    FROM ops.agent_runs
    WHERE ${REAL_RUNS}
      AND started_at >= date_trunc('day', now() AT TIME ZONE $1) AT TIME ZONE $1
  `;
  const { rows } = await db.query<{ usd: number; runs: number; unpriced_runs: number }>(sql, [timezone]);
  const row = rows[0] ?? { usd: 0, runs: 0, unpriced_runs: 0 };
  return { usd: Number(row.usd), runs: row.runs, unpricedRuns: row.unpriced_runs };
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
      AND ($4::float8 IS NULL OR started_at >= now() - make_interval(hours => $4))
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
 * Named query registry — `query.source: "sql"` in the panel contract.
 * ------------------------------------------------------------------------- */

export type ParamType = 'int' | 'string' | 'range';

export type NamedQuery = {
  /** What the panel is asking for, in a sentence. Shown in the panel validator's errors. */
  description: string;
  /** Ordered parameter list. `$1` is params[0], and so on. */
  params: { name: string; type: ParamType; default?: number | string }[];
  sql: string;
};

/**
 * Business queries, addressable by name. Adding one is a code change with a review —
 * which is the point: it is the boundary that keeps a JSON file in `panels/` from
 * being able to read arbitrary rows.
 *
 * These read `app.agent_outputs`, so a widget lights up the moment an agent starts
 * writing that `kind` and shows an honest empty state until then.
 */
export const NAMED_QUERIES: Record<string, NamedQuery> = {
  outputs_by_kind: {
    description: 'Row count per output kind over the last N days — the "is anything writing yet" query.',
    params: [{ name: 'days', type: 'int', default: 30 }],
    sql: `
      SELECT kind AS label, count(*)::int AS value
      FROM app.agent_outputs
      WHERE occurred_at >= now() - make_interval(days => $1)
      GROUP BY kind
      ORDER BY value DESC
    `,
  },

  outputs_by_department: {
    description: 'Rows written per department over the last N days (bar-list widget).',
    params: [{ name: 'days', type: 'int', default: 30 }],
    sql: `
      SELECT department AS label, count(*)::int AS value
      FROM app.agent_outputs
      WHERE occurred_at >= now() - make_interval(days => $1)
      GROUP BY department
      ORDER BY value DESC
    `,
  },

  outputs_recent: {
    description: 'Most recent rows of one kind, newest first (data-table widget).',
    params: [
      { name: 'kind', type: 'string' },
      { name: 'limit', type: 'int', default: 20 },
    ],
    sql: `
      SELECT o.entity_key, o.occurred_at, o.agent, o.payload, r.trace_url
      FROM app.agent_outputs o
      LEFT JOIN ops.agent_runs r ON r.run_id = o.run_id
      WHERE o.kind = $1
      ORDER BY o.occurred_at DESC
      LIMIT $2
    `,
  },

  cost_by_agent: {
    description: 'Runner spend per agent over the last N days (cost-table widget).',
    params: [{ name: 'days', type: 'int', default: 28 }],
    sql: `
      SELECT agent AS label,
             coalesce(sum(cost_usd), 0)::float8 AS value,
             count(*)::int AS runs,
             (count(*) FILTER (WHERE cost_usd IS NULL))::int AS unpriced
      FROM ops.agent_runs
      WHERE ${REAL_RUNS}
        AND started_at >= now() - make_interval(days => $1)
      GROUP BY agent
      ORDER BY value DESC
    `,
  },

  runs_per_day: {
    description: 'Daily run volume over the last N days (area-chart widget).',
    params: [{ name: 'days', type: 'int', default: 28 }],
    sql: `
      SELECT date_trunc('day', started_at)::date AS t, count(*)::int AS v
      FROM ops.agent_runs
      WHERE ${REAL_RUNS}
        AND started_at >= now() - make_interval(days => $1)
      GROUP BY 1
      ORDER BY 1
    `,
  },
};

/**
 * Validate and order a named query's parameters. Rejects unknown names, wrong types
 * and missing required values — before anything is bound, let alone executed.
 */
export function bindNamedQuery(
  name: string,
  supplied: Record<string, unknown> = {},
): { sql: string; params: unknown[] } {
  const query = NAMED_QUERIES[name];
  if (!query) {
    throw Object.assign(new Error(`Unknown query "${name}".`), {
      code: 'unknown_query',
      hint: `Known queries: ${Object.keys(NAMED_QUERIES).join(', ')}.`,
    });
  }

  const params = query.params.map((spec) => {
    const raw = supplied[spec.name] ?? spec.default;
    if (raw === undefined) {
      throw Object.assign(new Error(`Query "${name}" needs a "${spec.name}" parameter.`), {
        code: 'missing_param',
        hint: `Add "params": { "${spec.name}": … } to the panel's query.`,
      });
    }
    if (spec.type === 'int') {
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 0 || n > 3_650) {
        throw Object.assign(new Error(`"${spec.name}" must be a whole number between 0 and 3650.`), {
          code: 'bad_param',
          hint: 'Check the panel definition.',
        });
      }
      return n;
    }
    if (spec.type === 'range') {
      const value = String(raw);
      if (!isRange(value)) {
        throw Object.assign(new Error(`"${spec.name}" must be one of ${Object.keys(RANGES).join(', ')}.`), {
          code: 'bad_param',
          hint: 'Check the panel definition.',
        });
      }
      return RANGES[value];
    }
    const value = String(raw);
    if (value.length > 128) {
      throw Object.assign(new Error(`"${spec.name}" is too long.`), {
        code: 'bad_param',
        hint: 'Check the panel definition.',
      });
    }
    return value;
  });

  return { sql: query.sql, params };
}
