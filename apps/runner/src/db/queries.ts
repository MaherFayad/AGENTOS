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

/**
 * The bucket a run lands in when nobody recorded who paid for it.
 *
 * `unattributed` is a **value**, not a `NULL` and not an absence — migration 0005's
 * `account_provenance` CHECK makes the database say it too. A cost-by-account chart that
 * dropped these rows would show a total smaller than the ticker's and neither number would
 * be wrong, which is the worst kind of disagreement to debug. (ADR-015 Q20.)
 */
export const UNATTRIBUTED_ACCOUNT = 'unattributed';

/**
 * Every ops query is scoped to exactly one project, and `projectId` is **required** rather
 * than an optional field on the filter.
 *
 * That is the whole mechanism and it is worth one sentence: an optional project is a
 * project you can forget, and a forgotten project on a metrics read does not throw, it
 * quietly widens the answer. Making it a required property means the type checker refuses
 * every call site that has not thought about it — the cheapest possible version of
 * `project-scoping.md` invariant 8, bought at compile time.
 */
export type MetricFilter = {
  /** `ops.project.id` — the deterministic uuid from the slug. Never a slug. */
  projectId: string;
  agent?: string;
  department?: string;
  /** `mission-control.json` has a "Failed runs" tile: `filter: {status: "error"}`. */
  status?: string;
  /**
   * `ops.billing_account.id`, or the literal `unattributed` for runs whose payer was never
   * recorded. Validated at the route before it reaches here (`Plan §11`).
   */
  account?: string;
  /**
   * `ops.thread.id` — *"which runs belong to this thread"* (`Plan §12`, ADR-023).
   *
   * A filter, deliberately, and **not a second aggregation model.** A thread is a set of
   * runs; a run is still a run and still one trace. So `thread` joins `agent`, `department`
   * and `account` as one more optional predicate over `ops.agent_runs`, and every metric,
   * series, breakdown, LAST RUNS row and activity row answers for a thread by the same
   * code path that answers for an agent. Nothing new aggregates, nothing new is cached, and
   * there is no `/metrics/threads` rollup to fall out of step with `/metrics/query`.
   *
   * Not a `GROUP BY` option — see `GROUP_BY`.
   */
  threadId?: string;
};

/**
 * Columns a metric may be grouped by. A closed set — never a value from a request.
 *
 * **`thread` is deliberately not in it, and the reason is a label rather than a join.**
 * Grouping by `thread_id` is one word of SQL; the result is a `bar-list` whose labels are
 * uuids. A thread has no title by decision — `contracts/thread-model.md` §9.6 answers it
 * *no, not in M16*, because a title is either a field nobody fills or the first message
 * truncated, and the second is a copy of the highest-PII value in the database. So a
 * thread breakdown could only render identifiers, and a widget full of uuids is a panel
 * that looks like data and answers nothing. It is added the day threads have a label that
 * is safe to render, and `MetricFilter.threadId` already answers *"this thread's runs"*
 * without it.
 */
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
 * The project predicate. `$1` on **every** ops statement in this file, in the same slot,
 * so "does this query carry a project?" is answerable by looking at one character.
 *
 * It is a bind parameter and it is not optional. Compare `account`, which genuinely is
 * optional: an unfiltered account means "every account in this project" and that is a
 * sentence someone might mean. There is no reading of "every project" that a dashboard
 * widget or a KPI tile ever means, so no query here offers one.
 */
const PROJECT_PREDICATE = `project_id = $1::uuid`;

/**
 * The account predicate. Optional, and it has to handle `unattributed` specially because
 * that bucket is stored as `account_id IS NULL` alongside `account_source =
 * 'unattributed'` — comparing against the text form rather than casting to uuid keeps a
 * malformed parameter a no-match instead of a 500.
 */
const ACCOUNT_PREDICATE = `
      AND ($7::text IS NULL
           OR ($7 = '${UNATTRIBUTED_ACCOUNT}' AND account_id IS NULL)
           OR account_id::text = $7)`;

/**
 * The thread predicate (`Plan §12`, ADR-023). Optional, like `account` and unlike the
 * project: *"every thread in this project"* is a sentence someone means every time they
 * open a dashboard.
 *
 * Compared as `::text` rather than cast to `uuid` for the same reason `account` is: a
 * malformed parameter becomes a no-match instead of a 500 from a cast Postgres performs
 * before it reads a row. The route refuses a non-uuid first (`bad_thread`); this is the
 * second mechanism, and it is what catches a caller that is not the route.
 *
 * A run with `thread_id IS NULL` never matches a thread filter — which is correct and, for
 * now, total: **zero runs have executed, so this table is empty** and every thread filter
 * answers zero runs. That is an honest zero from a real query, not a stub.
 */
const THREAD_PREDICATE = `
      AND ($8::text IS NULL OR thread_id::text = $8)`;

/**
 * Window + filter predicate shared by every ops query.
 *
 * `$1` is the project. `$2`/`$3` are the window bounds in hours ago; `$4`–`$8` are the
 * optional filters, each a no-op when null.
 */
const RUN_SCOPE = `
    ${PROJECT_PREDICATE}
      AND ${REAL_RUNS}
      AND started_at >= now() - ${hoursAgo('$2')}
      AND started_at <  now() - ${hoursAgo('$3')}
      AND ($4::text IS NULL OR agent = $4)
      AND ($5::text IS NULL OR department = $5)
      AND ($6::text IS NULL OR status = $6)${ACCOUNT_PREDICATE}${THREAD_PREDICATE}
`;

const scopeParams = (filter: MetricFilter, from: number, to: number) =>
  [
    requireProject(filter),
    from,
    to,
    filter.agent ?? null,
    filter.department ?? null,
    filter.status ?? null,
    filter.account ?? null,
    filter.threadId ?? null,
  ] as const;

/**
 * The runtime half of the required-`projectId` rule.
 *
 * TypeScript stops a *typed* caller forgetting the project. This stops an untyped one —
 * the checker script, a JSON body, a `as never` in a test — and it throws rather than
 * defaulting, because there is no project this could default to that would not be a guess
 * about whose data the caller wanted.
 */
function requireProject(filter: MetricFilter): string {
  const id = filter.projectId;
  if (typeof id !== 'string' || id === '') {
    throw Object.assign(new Error('An ops query was built with no project id.'), {
      code: 'project_scope_unset',
    });
  }
  return id;
}

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
    LIMIT $9
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
  projectId: string,
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
    WHERE ${PROJECT_PREDICATE}
      AND ${REAL_RUNS}
      AND started_at >= date_trunc('day', now() AT TIME ZONE $2) AT TIME ZONE $2
  `;
  const { rows } = await db.query<{ usd: number | null; runs: number; unpriced_runs: number }>(sql, [
    requireProject({ projectId }),
    timezone,
  ]);
  const row = rows[0] ?? { usd: null, runs: 0, unpriced_runs: 0 };
  return {
    usd: row.usd === null ? null : Number(row.usd),
    runs: row.runs,
    unpricedRuns: row.unpriced_runs,
  };
}

/** One row of the per-account cost split (`Plan §11`, ADR-015 Q20). */
export type AccountSpend = {
  /** `null` for the `unattributed` bucket — no account was recorded, not "account zero". */
  accountId: string | null;
  /** `ops.billing_account.slug`, or `unattributed`. What a chip renders. */
  account: string;
  label: string | null;
  /** `project-default` · `run-override` · `unattributed`. How the payer was chosen. */
  source: string;
  usd: number | null;
  runs: number;
  unpricedRuns: number;
};

const ACCOUNT_SPEND_SELECT = `
    SELECT r.account_id,
           coalesce(a.slug, '${UNATTRIBUTED_ACCOUNT}') AS account,
           a.label,
           r.account_source AS source,
           sum(r.cost_usd)::float8 AS usd,
           count(*)::int AS runs,
           (count(*) FILTER (WHERE r.cost_usd IS NULL))::int AS unpriced_runs
    FROM ops.agent_runs r
    LEFT JOIN ops.billing_account a ON a.id = r.account_id
`;

const toAccountSpend = (r: Record<string, unknown>): AccountSpend => ({
  accountId: (r.account_id as string | null) ?? null,
  account: String(r.account ?? UNATTRIBUTED_ACCOUNT),
  label: (r.label as string | null) ?? null,
  source: String(r.source ?? UNATTRIBUTED_ACCOUNT),
  usd: r.usd === null || r.usd === undefined ? null : Number(r.usd),
  runs: Number(r.runs ?? 0),
  unpricedRuns: Number(r.unpriced_runs ?? 0),
});

/**
 * "Which account paid for today's runs, in this project" — the ticker's second axis
 * (`Plan §11`: `work $12.40 · personal $3.10`).
 *
 * Two axes, not one: the same account pays across several projects, so a per-account
 * number is only meaningful with a project beside it. `ops.billing_account` is
 * deliberately *not* row-level-scoped (migration 0005 §5) because a billing account is
 * cross-project by design — the LEFT JOIN is a label lookup, and the rows being counted
 * are `ops.agent_runs`, which is scoped.
 *
 * An empty array means **no runs today in this project**. It never means "no accounts":
 * that would be a claim about `ops.billing_account`, which this query does not make.
 */
export async function costTodayByAccount(
  db: DbClient,
  projectId: string,
  timezone: string,
): Promise<AccountSpend[]> {
  const sql = `${ACCOUNT_SPEND_SELECT}
    WHERE r.${PROJECT_PREDICATE}
      AND r.dry_run = false AND r.status <> 'awaiting-approval'
      AND r.started_at >= date_trunc('day', now() AT TIME ZONE $2) AT TIME ZONE $2
    GROUP BY 1, 2, 3, 4
    ORDER BY usd DESC NULLS LAST, runs DESC
  `;
  const { rows } = await db.query(sql, [requireProject({ projectId }), timezone]);
  return rows.map(toAccountSpend);
}

/** The same split over an arbitrary window — the account chips on a cost surface. */
export async function costByAccount(
  db: DbClient,
  projectId: string,
  fromHoursAgo: number,
  toHoursAgo = 0,
): Promise<AccountSpend[]> {
  const sql = `${ACCOUNT_SPEND_SELECT}
    WHERE r.${PROJECT_PREDICATE}
      AND r.dry_run = false AND r.status <> 'awaiting-approval'
      AND r.started_at >= now() - ${hoursAgo('$2')}
      AND r.started_at <  now() - ${hoursAgo('$3')}
    GROUP BY 1, 2, 3, 4
    ORDER BY usd DESC NULLS LAST, runs DESC
  `;
  const { rows } = await db.query(sql, [requireProject({ projectId }), fromHoursAgo, toHoursAgo]);
  return rows.map(toAccountSpend);
}

/**
 * How many billing accounts this coordinator knows about at all.
 *
 * Reported next to the split so an empty `byAccount` cannot be read as "one account paid
 * for everything". `registered: 0` and `runs: 0` together say *the split has never had
 * anything to split* — which is the true state today and is not the same sentence as
 * "everything was paid by the default account".
 */
export async function billingAccountCount(db: DbClient): Promise<number> {
  const { rows } = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM ops.billing_account WHERE revoked_at IS NULL`,
  );
  return Number(rows[0]?.n ?? 0);
}

/**
 * LAST RUNS — the drawer's five rows (§2.3) and Mission Control's `data-table`.
 *
 * `trace_url` is selected here rather than composed by the caller: the drawer row must
 * deep-link to the trace of *that* run, and the only place that knows the trace id is
 * the row the instrumentation wrote.
 *
 * `thread_id` is selected for the same reason one row over: a LAST RUNS row that belongs
 * to a thread must be able to say so without a second query, and *"the other three runs of
 * this thread"* is then this same function with `filter.threadId` set. One run, one trace,
 * four traces to a four-run thread — correlated here, never merged.
 */
export async function lastRuns(
  db: DbClient,
  filter: MetricFilter,
  limit: number,
  fromHoursAgo: number | null = null,
) {
  const sql = `
    SELECT run_id, agent, agent_ref, agent_name, department, status, started_at, duration_ms,
           cost_usd, cost_source, account_id, account_source, tool_call_count, trace_url,
           thread_id
    FROM ops.agent_runs
    WHERE ${PROJECT_PREDICATE}
      AND ${REAL_RUNS}
      AND ($2::text IS NULL OR agent = $2)
      AND ($3::text IS NULL OR department = $3)
      AND ($4::text IS NULL OR status = $4)
      AND ($5::float8 IS NULL OR started_at >= now() - ${hoursAgo('$5')})
      AND ($6::text IS NULL OR thread_id::text = $6)
    ORDER BY started_at DESC
    LIMIT $7
  `;
  const { rows } = await db.query(sql, [
    requireProject(filter),
    filter.agent ?? null,
    filter.department ?? null,
    filter.status ?? null,
    fromHoursAgo,
    filter.threadId ?? null,
    limit,
  ]);
  return rows;
}

/**
 * The activity feed (§2.5). Agent runs are the activity in phase 1.
 *
 * **The feed is still agent runs, and a thread does not become a feed item.** `Plan §12`
 * makes a thread the addressable unit; it does not make it a thing that *happened*. A
 * thread that was opened and has not run has nothing to report, and a feed row saying so
 * would be a timestamped non-event on the one surface whose whole value is that every line
 * is a thing an agent did. So `thread_id` rides on the run row as an attribution handle —
 * a feed line can link to its thread — and the feed's row source is unchanged.
 */
export async function activityFeed(
  db: DbClient,
  projectId: string,
  department: string | null,
  limit: number,
  threadId: string | null = null,
) {
  const sql = `
    SELECT run_id, agent, agent_ref, agent_name, department, status, started_at,
           activity_event, activity_detail, trace_url, thread_id
    FROM ops.agent_runs
    WHERE ${PROJECT_PREDICATE}
      AND ${REAL_RUNS}
      AND activity_event IS NOT NULL
      AND ($2::text IS NULL OR department = $2)
      AND ($3::text IS NULL OR thread_id::text = $3)
    ORDER BY started_at DESC
    LIMIT $4
  `;
  const { rows } = await db.query(sql, [
    requireProject({ projectId }),
    department,
    threadId,
    limit,
  ]);
  return rows;
}

/**
 * Per-agent evidence for status derivation (§3.4). The "recent" window is the last N
 * runs per agent, not the last N days — a weekly agent should not read as healthy
 * merely because it has been idle.
 */
export async function agentEvidence(db: DbClient, projectId: string, window: number) {
  const sql = `
    WITH ranked AS (
      SELECT agent, department, status, started_at,
             row_number() OVER (PARTITION BY agent ORDER BY started_at DESC) AS rn
      FROM ops.agent_runs
      WHERE ${PROJECT_PREDICATE}
        AND ${REAL_RUNS}
    )
    SELECT agent,
           min(department) AS department,
           count(*)::int AS total_runs,
           (count(*) FILTER (WHERE status = 'ok'))::int AS successful_runs,
           (count(*) FILTER (WHERE rn <= $2))::int AS recent_runs,
           (count(*) FILTER (WHERE rn <= $2 AND status = 'error'))::int AS recent_errors,
           max(started_at) AS last_run_at,
           max(started_at) FILTER (WHERE status = 'ok') AS last_success_at
    FROM ranked
    GROUP BY agent
    ORDER BY agent
  `;
  const { rows } = await db.query(sql, [requireProject({ projectId }), window]);
  return rows;
}

/**
 * Tool spans for one run — what the drawer expands into.
 *
 * `ops.agent_run_tools` deliberately has **no** `project_id` of its own (migration 0005
 * §5: two copies of one fact eventually disagree, and here the disagreement would be a
 * tool span attributed to the wrong client). So the project arrives through the parent
 * row, as a join rather than as a second column.
 *
 * That join is not decoration. A `runId` is a global identifier with no project in it: a
 * run id copied out of one project's drawer and pasted into another project's URL would
 * otherwise return that run's spans under the wrong project's name — a cross-project read
 * with no error message, which is the exact bug class `Plan §21.9` is about. With the
 * join, the answer is an empty span list for a run that is not this project's, and the
 * route turns that into `run_not_in_project` rather than into an empty drawer.
 */
export async function runToolCalls(db: DbClient, projectId: string, runId: string) {
  const sql = `
    SELECT t.seq, t.name, t.status, t.started_at, t.duration_ms, t.error
    FROM ops.agent_run_tools t
    JOIN ops.agent_runs r ON r.run_id = t.run_id AND r.${PROJECT_PREDICATE}
    WHERE t.run_id = $2
    ORDER BY t.seq
  `;
  const { rows } = await db.query(sql, [requireProject({ projectId }), runId]);
  return rows;
}

/**
 * Does this run belong to this project at all?
 *
 * Asked separately from the spans so that "this run has no tool calls" and "this run is
 * not yours" are two answers rather than one empty array. The second is the one that must
 * never render as an empty state.
 */
export async function runExistsInProject(
  db: DbClient,
  projectId: string,
  runId: string,
): Promise<boolean> {
  const { rows } = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM ops.agent_runs WHERE ${PROJECT_PREDICATE} AND run_id = $2`,
    [requireProject({ projectId }), runId],
  );
  return Number(rows[0]?.n ?? 0) > 0;
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
