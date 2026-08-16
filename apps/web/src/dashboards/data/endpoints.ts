/**
 * Panel query → runner endpoint. The one place that knows which HTTP route answers a
 * `query` object, and the only place allowed to decide that none of them does.
 *
 * WHY THIS FILE REPLACED A CLIENT-SIDE AGGREGATOR
 *
 * DASHBOARDS used to read `GET /api/runs?limit=200` — the runner's **in-memory** run
 * store — and derive runs / cost / p50 / error rate in the browser. That store holds only
 * the runs the current runner *process* executed, so it is empty after every restart, and
 * it will still be empty after every restart once real agents are running. The durable
 * history lives in Postgres (`ops.agent_runs`) behind `GET /api/metrics/*`. Every number
 * on a dashboard now comes from an aggregate Postgres computed over the whole window.
 *
 * That kills the truncation guard along with the derivation it protected: a `count(*)`
 * over a window cannot be an undercount of that window, so there is nothing left to
 * refuse. What replaces it is the **receipt check** — `/api/metrics/query` echoes the
 * filter it applied, so a filter the route silently ignored is caught here and answered
 * `unavailable` rather than rendered as an unfiltered number wearing a filtered label.
 * Same principle, one layer down: refuse rather than look right.
 *
 * WHAT IS NOT SERVED YET (and is therefore honestly blank, not faked)
 *
 * `apps/runner/src/db/queries.ts` already has `metricSeries()` and `metricBreakdown()`,
 * but `routes/metrics.ts` exposes neither, and it does not read `status` off the query
 * string. So three declared panel shapes have no HTTP surface: a series of any metric
 * other than `runs`, a `groupBy: "agent"` of any metric other than `cost`, and any
 * `filter: {status}`. Those return `unsupported` with a sentence saying so. Filed with
 * `observability-engineer`; nothing here guesses around it.
 *
 * Pure and dependency-free on purpose — `node --test` loads it directly, and it must not
 * value-import `@agnetos/contracts` (Node ESM cannot resolve that package's extensionless
 * barrel). The department list is injected by the caller for the same reason.
 *
 * Owner: dashboards-engineer · Spec §2.5, §3.5 · contracts/panel-schema.md
 */

/* --------------------------------------------------------------- the ranges */

/**
 * The windows the runner will accept (`RANGES` in `apps/runner/src/db/queries.ts`).
 * Anything else is refused here rather than sent and 400'd — a panel author gets a
 * sentence, not a network error in a console they are not looking at.
 */
export const RUNNER_RANGES: Record<string, { hours: number; days: number }> = {
  '24h': { hours: 24, days: 1 },
  '7d': { hours: 24 * 7, days: 7 },
  '14d': { hours: 24 * 14, days: 14 },
  '28d': { hours: 24 * 28, days: 28 },
  '30d': { hours: 24 * 30, days: 30 },
  '90d': { hours: 24 * 90, days: 90 },
};

export interface RunnerRange {
  token: string;
  hours: number;
  days: number;
}

/**
 * `7d` → itself. `4w` → `28d`, because the panel contract's range pattern allows weeks
 * and the runner's table does not. A token that lands outside the table is `null`, not
 * the nearest thing — "roughly 28 days" is not a window anyone asked for.
 */
export function toRunnerRange(range: string | undefined): RunnerRange | null {
  if (!range) return null;
  const direct = RUNNER_RANGES[range];
  if (direct) return { token: range, ...direct };
  const weeks = /^(\d{1,3})w$/.exec(range);
  if (weeks) {
    const token = `${Number(weeks[1]) * 7}d`;
    const mapped = RUNNER_RANGES[token];
    if (mapped) return { token, ...mapped };
  }
  return null;
}

/* ----------------------------------------------------------------- the plan */

export interface AppliedFilter {
  agent?: string;
  department?: string;
  status?: string;
}

/**
 * What a query resolves to. `unsupported` carries the sentence the widget prints; it is
 * a `QueryResult.unavailable`, i.e. "correct source, not wired in this phase", never an
 * error and never a zero.
 */
export type Plan =
  /** `/api/metrics/query` — one aggregate over one window, plus `previous` and `delta`. */
  | { kind: 'scalar'; url: string; metric: string; want: AppliedFilter; delta: boolean }
  /** `/api/metrics/sql/runs_per_day` — the only daily series the runner serves. */
  | { kind: 'runs-series'; url: string }
  /** `/api/metrics/sql/cost_by_agent` — spend per agent, with the unpriced count. */
  | { kind: 'cost-by-agent'; url: string }
  /** One windowed `count(*)` per department, plus the ungrouped total to check against. */
  | { kind: 'runs-by-department'; parts: { slug: string; url: string }[]; totalUrl: string }
  /** `/api/metrics/runs` — the durable ledger rows behind the `data-table`. */
  | { kind: 'runs-list'; url: string; limit: number; sinceHours: number | null }
  /** `/api/metrics/activity` — human sentences; agent runs ARE the activity (§2.5). */
  | { kind: 'activity'; url: string; limit: number }
  | { kind: 'unsupported'; message: string };

export const NO_SERIES_ROUTE =
  'Only run volume has a daily series today. The runner computes this one but does not serve it yet.';

export const NO_BREAKDOWN_ROUTE =
  'This breakdown has no metrics route yet. The runner computes it; it is not exposed.';

export const NO_MODEL_FIELD =
  'A run row does not carry the model it used, so per-model spend has nothing to group on.';

export const NO_STATUS_FILTER =
  'This figure needs a status filter the metrics route does not apply yet, so it is not shown rather than shown unfiltered.';

export const NO_WINDOW =
  'This figure needs a time window the metrics API recognises (24h, 7d, 14d, 28d, 30d, 90d).';

export const FILTER_NOT_APPLIED =
  'The metrics route returned a figure without the filter this asked for, so it is withheld rather than mislabelled.';

/** A `shape: "list"` query on an `activity-feed` widget wants sentences, not rows. */
export type QueryIntent = 'activity' | 'default';

export interface PlanOptions {
  intent?: QueryIntent;
  /** ADR-001's ordered department slugs, injected so this module imports nothing. */
  departments?: readonly string[];
}

const qs = (params: Record<string, string | number | undefined>): string => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  return search.toString();
};

/**
 * The mapping table, as code. A `langfuse` query is a *question*; this picks the route
 * that answers it. When no route answers it, that is stated, not approximated.
 */
export function planLangfuse(
  query: {
    metric: string;
    shape?: string;
    groupBy?: string;
    filter?: AppliedFilter;
    range?: string;
    limit?: number;
    compare?: string;
  },
  options: PlanOptions = {},
): Plan {
  const shape = query.shape ?? 'scalar';
  const filter = query.filter ?? {};
  const range = toRunnerRange(query.range);

  if (shape === 'scalar') {
    if (!range) return { kind: 'unsupported', message: NO_WINDOW };
    if (filter.status) return { kind: 'unsupported', message: NO_STATUS_FILTER };
    const want: AppliedFilter = {};
    if (filter.agent) want.agent = filter.agent;
    if (filter.department) want.department = filter.department;
    return {
      kind: 'scalar',
      url: `/api/metrics/query?${qs({ metric: query.metric, range: range.token, ...want })}`,
      metric: query.metric,
      want,
      delta: query.compare === 'previous-period',
    };
  }

  if (shape === 'series') {
    // `runs_per_day` is a registered ops query over the same ledger `/api/metrics/query`
    // reads. It takes no filter and only counts runs, which is exactly its limit.
    if (query.metric !== 'runs' || filter.agent || filter.department || filter.status) {
      return { kind: 'unsupported', message: NO_SERIES_ROUTE };
    }
    if (!range) return { kind: 'unsupported', message: NO_WINDOW };
    return { kind: 'runs-series', url: `/api/metrics/sql/runs_per_day?${qs({ days: range.days })}` };
  }

  if (shape !== 'list') return { kind: 'unsupported', message: NO_BREAKDOWN_ROUTE };

  if (query.groupBy === 'model') return { kind: 'unsupported', message: NO_MODEL_FIELD };

  if (query.groupBy === 'agent') {
    if (query.metric !== 'cost' || filter.agent || filter.department || filter.status) {
      return { kind: 'unsupported', message: NO_BREAKDOWN_ROUTE };
    }
    if (!range) return { kind: 'unsupported', message: NO_WINDOW };
    return { kind: 'cost-by-agent', url: `/api/metrics/sql/cost_by_agent?${qs({ days: range.days })}` };
  }

  if (query.groupBy === 'department') {
    const departments = options.departments ?? [];
    if (query.metric !== 'runs' || filter.agent || filter.status || departments.length === 0) {
      return { kind: 'unsupported', message: NO_BREAKDOWN_ROUTE };
    }
    if (!range) return { kind: 'unsupported', message: NO_WINDOW };
    // One `count(*)` per department, each computed by Postgres over the same window —
    // not a client-side group-by. `totalUrl` is the ungrouped count for the identical
    // window; `resolve.ts` refuses the whole widget unless the parts sum to it, so a run
    // filed under a department this list does not know about cannot become a silent
    // undercount. It retires the moment `/api/metrics/query` accepts `groupBy`.
    return {
      kind: 'runs-by-department',
      parts: departments.map((slug) => ({
        slug,
        url: `/api/metrics/query?${qs({ metric: 'runs', range: range.token, department: slug })}`,
      })),
      totalUrl: `/api/metrics/query?${qs({ metric: 'runs', range: range.token })}`,
    };
  }

  if (query.groupBy) return { kind: 'unsupported', message: NO_BREAKDOWN_ROUTE };

  /* ------ ungrouped list: the activity feed, or the ledger rows themselves ------ */

  const limit = query.limit ?? 12;

  if (options.intent === 'activity') {
    if (filter.agent || filter.status) return { kind: 'unsupported', message: NO_BREAKDOWN_ROUTE };
    return {
      kind: 'activity',
      url: `/api/metrics/activity?${qs({ limit, department: filter.department })}`,
      limit,
    };
  }

  if (filter.department) return { kind: 'unsupported', message: NO_BREAKDOWN_ROUTE };
  if (filter.status) return { kind: 'unsupported', message: NO_STATUS_FILTER };
  return {
    kind: 'runs-list',
    url: `/api/metrics/runs?${qs({ limit, agent: filter.agent })}`,
    limit,
    // `/api/metrics/runs` takes a row cap, not a window, so a "last 10 in this window"
    // table trims client-side. Trimming can only *remove* rows from a top-N list; it can
    // never invent one, which is why it is allowed here and counting was not.
    sinceHours: range?.hours ?? null,
  };
}

/** Every URL a plan needs, for the provider's fetch set. */
export function urlsOf(plan: Plan): string[] {
  switch (plan.kind) {
    case 'scalar':
    case 'runs-series':
    case 'cost-by-agent':
    case 'runs-list':
    case 'activity':
      return [plan.url];
    case 'runs-by-department':
      return [plan.totalUrl, ...plan.parts.map((p) => p.url)];
    case 'unsupported':
      return [];
    default: {
      const never: never = plan;
      return never;
    }
  }
}
