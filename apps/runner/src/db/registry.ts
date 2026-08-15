/**
 * The named-query registry (§3.5, panel-schema contract).
 *
 * The panel contract says: "A panel file can never contain raw SQL." This file is how
 * that stays true structurally rather than by convention. A panel names a query; the
 * registry owns the SQL; the only things that travel from the panel are bind parameters
 * that have been type-checked first.
 *
 * Three properties hold for every entry, and the checker in scripts/check-metrics.mjs
 * asserts them:
 *
 *   1. **Named.** The panel supplies a key into this object. An unknown key is a 400
 *      with a hint, never an attempt.
 *   2. **Parameterised.** No identifier and no value is interpolated from a request.
 *      Even the *payload field names* below are bound (`payload->>$3`), so a query is a
 *      constant string plus a parameter array — nothing else.
 *   3. **Honest when empty.** Every business query declares the output `kind` it reads.
 *      Before it runs, the API checks whether any agent has ever written that kind
 *      (`hasOutputs`). If not, the widget gets an empty state and a reason — never a
 *      zero. A zero says "the pipeline is empty"; the truth is "no agent writes deals
 *      yet", and Part VII.3 is the difference between those two sentences.
 *
 * `needs.fields` is not documentation. It is the write contract: the agent that will
 * light this widget up must put exactly those keys in its `writeOutput` payload. Change
 * a field name here and you have changed an agent's obligation — message its owner.
 */

/* -------------------------------------------------------------------------- *
 * Types
 * -------------------------------------------------------------------------- */

export type ParamType = 'int' | 'string' | 'range';

export type ParamSpec = {
  name: string;
  type: ParamType;
  default?: number | string;
  /** What the parameter means, shown by `GET /api/metrics/sql`. */
  note?: string;
};

/** `served`: SQL exists and runs. `pending`: registered, deliberately unbuilt. */
export type QueryStatus = 'served' | 'pending';

/**
 * The shape the caller gets back, so a widget knows what it is rendering:
 *   scalar   → `{value}`                       KPI tile, signal
 *   labelled → `[{label, value}]`              bar-list, source-bar-list, cost-table
 *   series   → `[{t, v}]`                      area-chart, sparkline
 *   rows     → `[{…payload, entityKey, …}]`    data-table
 *   progress → `[{label, phase, progress, status}]` progress-table
 */
export type ResultShape = 'scalar' | 'labelled' | 'series' | 'rows' | 'progress';

export type NamedQuery = {
  description: string;
  status: QueryStatus;
  returns: ResultShape;
  params: ParamSpec[];
  /** The output kind this reads and the payload fields it needs. The write contract. */
  needs?: { kind: string; fields: string[] };
  /** Bind values the registry supplies itself. They occupy `$1 … $fixed.length`. */
  fixed: unknown[];
  /** Absent for `pending` entries — a query with no SQL cannot be accidentally run. */
  sql?: string;
  /** For `pending`: what would have to exist first. Surfaced in the empty state. */
  blockedBy?: string;
};

/* -------------------------------------------------------------------------- *
 * Builders
 *
 * Each builder returns a complete NamedQuery. They exist so that forty queries are
 * forty *declarations* rather than forty hand-written SQL strings — a hand-written
 * string is where an unparameterised value eventually gets pasted in.
 * -------------------------------------------------------------------------- */

/** Row selector: which rows of `app.agent_outputs` a query is about. */
type Scope = {
  kind: string;
  /** `payload->>field = value` */
  eq?: Record<string, string>;
  /** `payload->>field = ANY(values)` */
  oneOf?: Record<string, string[]>;
  /** `payload->>field <> ALL(values)` — and a NULL field counts as "not in". */
  noneOf?: Record<string, string[]>;
  /** `payload->>field IS NOT NULL` */
  present?: string[];
  /** `payload->>field IS NULL` */
  absent?: string[];
};

/** How a query is bounded in time. `null` means "current state, not a window". */
type Window = { field: string; days: number } | null;

/** Allocates bind slots in order and renders the WHERE clause. */
function scopeOf(scope: Scope) {
  const fixed: unknown[] = [];
  const p = (v: unknown) => `$${fixed.push(v)}`;
  const clauses = [`kind = ${p(scope.kind)}`];

  for (const [field, value] of Object.entries(scope.eq ?? {})) {
    clauses.push(`payload->>${p(field)} = ${p(value)}`);
  }
  for (const [field, values] of Object.entries(scope.oneOf ?? {})) {
    clauses.push(`payload->>${p(field)} = ANY(${p(values)})`);
  }
  for (const [field, values] of Object.entries(scope.noneOf ?? {})) {
    clauses.push(`coalesce(payload->>${p(field)}, '') <> ALL(${p(values)})`);
  }
  for (const field of scope.present ?? []) clauses.push(`payload->>${p(field)} IS NOT NULL`);
  for (const field of scope.absent ?? []) clauses.push(`payload->>${p(field)} IS NULL`);

  return { fixed, p, where: clauses.join('\n        AND ') };
}

/**
 * Adds the time bound and returns the `days` parameter spec.
 *
 * A window on `occurred_at` uses the column; a window on a payload timestamp casts the
 * bound field. An unparseable timestamp in a payload excludes the row rather than
 * raising — one malformed row written by one agent must not blank a whole dashboard.
 */
function windowOf(
  win: Window,
  p: (v: unknown) => string,
  nextParamIndex: () => number,
  paramName = 'days',
): { clause: string; params: ParamSpec[] } {
  if (!win) return { clause: '', params: [] };
  const column =
    win.field === 'occurred_at' ? 'occurred_at' : `safe_ts(payload->>${p(win.field)})`;
  const idx = nextParamIndex();
  return {
    clause: `\n        AND ${column} >= now() - make_interval(days => $${idx})`,
    params: [{ name: paramName, type: 'int', default: win.days, note: `window in days on ${win.field}` }],
  };
}

/** Wrap a builder body so `fixed` and the panel parameters are numbered consistently. */
function build(
  scope: Scope,
  win: Window,
  body: (ctx: { where: string; p: (v: unknown) => string; nextIndex: () => number }) => string,
  extraParams: ParamSpec[] = [],
): { sql: string; fixed: unknown[]; params: ParamSpec[] } {
  const s = scopeOf(scope);
  // Panel parameters are numbered after every fixed value, so a builder can keep
  // pushing fixed values while it renders.
  let allocated = 0;
  const nextIndex = () => {
    allocated += 1;
    return -allocated; // placeholder, resolved below
  };

  const win2 = windowOf(win, s.p, nextIndex);
  const rendered = body({ where: s.where + win2.clause, p: s.p, nextIndex });

  const params = [...win2.params, ...extraParams];
  // Resolve the negative placeholders now that `fixed` is final.
  const sql = rendered.replace(/\$-(\d+)/g, (_m, n) => `$${s.fixed.length + Number(n)}`);
  return { sql, fixed: s.fixed, params };
}

const OUTPUTS = 'app.agent_outputs';

/** Count of matching rows → scalar. */
function count(cfg: {
  description: string;
  scope: Scope;
  window: Window;
  fields: string[];
}): NamedQuery {
  const { sql, fixed, params } = build(cfg.scope, cfg.window, ({ where }) => `
      SELECT count(*)::float8 AS value, count(*)::int AS rows
      FROM ${OUTPUTS}
      WHERE ${where}
  `);
  return {
    description: cfg.description,
    status: 'served',
    returns: 'scalar',
    params,
    needs: { kind: cfg.scope.kind, fields: cfg.fields },
    fixed,
    sql,
  };
}

/** Sum of a numeric payload field → scalar. */
function total(cfg: {
  description: string;
  scope: Scope;
  window: Window;
  field: string;
  fields: string[];
  /** Extra "older than N days" bound on a payload timestamp — the "stalled" queries. */
  staleOn?: { field: string; param: string; days: number };
}): NamedQuery {
  const extra: ParamSpec[] = cfg.staleOn
    ? [{ name: cfg.staleOn.param, type: 'int', default: cfg.staleOn.days, note: `older than N days on ${cfg.staleOn.field}` }]
    : [];
  const { sql, fixed, params } = build(
    cfg.scope,
    cfg.window,
    ({ where, p, nextIndex }) => {
      const valueField = p(cfg.field);
      const stale = cfg.staleOn
        ? `\n        AND safe_ts(payload->>${p(cfg.staleOn.field)}) < now() - make_interval(days => $-${
            // stale param is always the last declared parameter
            nextIndex() * -1
          })`
        : '';
      return `
      SELECT coalesce(sum(safe_num(payload->>${valueField})), 0)::float8 AS value,
             count(*)::int AS rows,
             (count(*) FILTER (WHERE safe_num(payload->>${valueField}) IS NULL))::int AS unvalued
      FROM ${OUTPUTS}
      WHERE ${where}${stale}
  `;
    },
    extra,
  );
  return {
    description: cfg.description,
    status: 'served',
    returns: 'scalar',
    params,
    needs: { kind: cfg.scope.kind, fields: cfg.fields },
    fixed,
    sql,
  };
}

/** Share of rows in `scope` that also match `of` → scalar 0..1. */
function share(cfg: {
  description: string;
  scope: Scope;
  of: Scope;
  window: Window;
  fields: string[];
}): NamedQuery {
  // The numerator's own scope is rendered as a FILTER clause against the same rows.
  const s = scopeOf(cfg.scope);
  const filterParts: string[] = [];
  for (const [field, value] of Object.entries(cfg.of.eq ?? {})) {
    filterParts.push(`payload->>${s.p(field)} = ${s.p(value)}`);
  }
  for (const [field, values] of Object.entries(cfg.of.oneOf ?? {})) {
    filterParts.push(`payload->>${s.p(field)} = ANY(${s.p(values)})`);
  }
  for (const field of cfg.of.present ?? []) filterParts.push(`payload->>${s.p(field)} IS NOT NULL`);
  for (const field of cfg.of.absent ?? []) filterParts.push(`payload->>${s.p(field)} IS NULL`);

  const win = cfg.window
    ? `\n        AND ${
        cfg.window.field === 'occurred_at' ? 'occurred_at' : `safe_ts(payload->>${s.p(cfg.window.field)})`
      } >= now() - make_interval(days => $${s.fixed.length + 1})`
    : '';

  const sql = `
      SELECT (count(*) FILTER (WHERE ${filterParts.join(' AND ')}))::float8
               / NULLIF(count(*), 0) AS value,
             count(*)::int AS rows
      FROM ${OUTPUTS}
      WHERE ${s.where}${win}
  `;

  return {
    description: cfg.description,
    status: 'served',
    returns: 'scalar',
    params: cfg.window ? [{ name: 'days', type: 'int', default: cfg.window.days }] : [],
    needs: { kind: cfg.scope.kind, fields: cfg.fields },
    fixed: s.fixed,
    sql,
  };
}

/** sum(a) / sum(b) → scalar 0..1. Engagement rate and friends. */
function ratio(cfg: {
  description: string;
  scope: Scope;
  window: Window;
  numerator: string;
  denominator: string;
  fields: string[];
}): NamedQuery {
  const { sql, fixed, params } = build(cfg.scope, cfg.window, ({ where, p }) => `
      SELECT sum(safe_num(payload->>${p(cfg.numerator)}))
               / NULLIF(sum(safe_num(payload->>${p(cfg.denominator)})), 0) AS value,
             count(*)::int AS rows
      FROM ${OUTPUTS}
      WHERE ${where}
  `);
  return {
    description: cfg.description,
    status: 'served',
    returns: 'scalar',
    params,
    needs: { kind: cfg.scope.kind, fields: cfg.fields },
    fixed,
    sql,
  };
}

/**
 * Median elapsed milliseconds between two payload timestamps → scalar duration.
 * `to: null` measures against now(), which is what "median deal age" means.
 */
function medianElapsed(cfg: {
  description: string;
  scope: Scope;
  window: Window;
  from: string;
  to: string | null;
  fields: string[];
}): NamedQuery {
  const { sql, fixed, params } = build(cfg.scope, cfg.window, ({ where, p }) => {
    const start = `safe_ts(payload->>${p(cfg.from)})`;
    const end = cfg.to === null ? 'now()' : `safe_ts(payload->>${p(cfg.to)})`;
    return `
      SELECT percentile_cont(0.5) WITHIN GROUP (
               ORDER BY extract(epoch FROM (${end} - ${start})) * 1000
             ) AS value,
             count(*) FILTER (WHERE ${start} IS NOT NULL AND ${end} IS NOT NULL)::int AS rows
      FROM ${OUTPUTS}
      WHERE ${where}
        AND ${start} IS NOT NULL
        AND ${end} IS NOT NULL
  `;
  });
  return {
    description: cfg.description,
    status: 'served',
    returns: 'scalar',
    params,
    needs: { kind: cfg.scope.kind, fields: cfg.fields },
    fixed,
    sql,
  };
}

/** Group by a payload field → `[{label, value}]`. `value` is a count or a sum. */
function grouped(cfg: {
  description: string;
  scope: Scope;
  window: Window;
  by: string;
  /** Omit to count rows. */
  sum?: string;
  fields: string[];
  limit?: number;
}): NamedQuery {
  const { sql, fixed, params } = build(cfg.scope, cfg.window, ({ where, p, nextIndex }) => {
    const label = `coalesce(payload->>${p(cfg.by)}, ${p('Unattributed')})`;
    const value = cfg.sum
      ? `coalesce(sum(safe_num(payload->>${p(cfg.sum)})), 0)::float8`
      : 'count(*)::float8';
    return `
      SELECT ${label} AS label, ${value} AS value, count(*)::int AS rows
      FROM ${OUTPUTS}
      WHERE ${where}
      GROUP BY 1
      ORDER BY value DESC
      LIMIT $-${nextIndex() * -1}
  `;
  }, [{ name: 'limit', type: 'int', default: cfg.limit ?? 12 }]);
  return {
    description: cfg.description,
    status: 'served',
    returns: 'labelled',
    params,
    needs: { kind: cfg.scope.kind, fields: cfg.fields },
    fixed,
    sql,
  };
}

/** Bucketed over a payload timestamp → `[{t, v}]`. */
function series(cfg: {
  description: string;
  scope: Scope;
  window: Window;
  on: string;
  /** Omit to count rows per bucket. */
  sum?: string;
  bucket?: 'day' | 'week';
  fields: string[];
}): NamedQuery {
  const bucket = cfg.bucket ?? 'day';
  const { sql, fixed, params } = build(cfg.scope, cfg.window, ({ where, p }) => {
    const value = cfg.sum ? `coalesce(sum(safe_num(payload->>${p(cfg.sum)})), 0)::float8` : 'count(*)::float8';
    return `
      SELECT date_trunc('${bucket}', safe_ts(payload->>${p(cfg.on)})) AS t, ${value} AS v
      FROM ${OUTPUTS}
      WHERE ${where}
        AND safe_ts(payload->>${p(cfg.on)}) IS NOT NULL
      GROUP BY 1
      ORDER BY 1
  `;
  });
  return {
    description: cfg.description,
    status: 'served',
    returns: 'series',
    params,
    needs: { kind: cfg.scope.kind, fields: cfg.fields },
    fixed,
    sql,
  };
}

/**
 * Whole rows for a `data-table` or `progress-table`.
 *
 * The payload is returned as one JSON column and flattened by the API, so a widget's
 * `columns[].key` reads a payload field directly and adding a column never needs a new
 * query. `trace_url` rides along: every business row can answer "which run wrote this?".
 */
function rows(cfg: {
  description: string;
  scope: Scope;
  window: Window;
  orderBy: string;
  direction?: 'asc' | 'desc';
  returns?: 'rows' | 'progress';
  fields: string[];
  limit?: number;
}): NamedQuery {
  const direction = cfg.direction === 'asc' ? 'ASC NULLS LAST' : 'DESC NULLS LAST';
  const { sql, fixed, params } = build(cfg.scope, cfg.window, ({ where, p, nextIndex }) => `
      SELECT o.entity_key, o.occurred_at, o.agent, o.department, o.payload, r.trace_url
      FROM ${OUTPUTS} o
      LEFT JOIN ops.agent_runs r ON r.run_id = o.run_id
      WHERE ${where.replace(/\bkind =/g, 'o.kind =').replace(/\bpayload->>/g, 'o.payload->>').replace(/\boccurred_at\b/g, 'o.occurred_at')}
      ORDER BY ${cfg.orderBy === 'occurred_at' ? 'o.occurred_at' : `safe_ts(o.payload->>${p(cfg.orderBy)})`} ${direction}
      LIMIT $-${nextIndex() * -1}
  `, [{ name: 'limit', type: 'int', default: cfg.limit ?? 20 }]);
  return {
    description: cfg.description,
    status: 'served',
    returns: cfg.returns ?? 'rows',
    params,
    needs: { kind: cfg.scope.kind, fields: cfg.fields },
    fixed,
    sql,
  };
}

/** A query we have registered but deliberately not built. Resolves to an empty state. */
function pending(cfg: {
  description: string;
  returns: ResultShape;
  blockedBy: string;
  needs?: { kind: string; fields: string[] };
  params?: ParamSpec[];
}): NamedQuery {
  return {
    description: cfg.description,
    status: 'pending',
    returns: cfg.returns,
    params: cfg.params ?? [],
    needs: cfg.needs,
    fixed: [],
    blockedBy: cfg.blockedBy,
  };
}

/* -------------------------------------------------------------------------- *
 * The registry
 *
 * Grouped by the panel that references each name, because that is how anyone reading
 * this will arrive: "the Pipeline dashboard shows nothing — which query is that?"
 * -------------------------------------------------------------------------- */

export const NAMED_QUERIES: Record<string, NamedQuery> = {
  /* --- ops: real today, backed by ops.agent_runs -------------------------- */

  outputs_by_kind: {
    description: 'Rows written per output kind over the last N days — the "is anything writing yet" query.',
    status: 'served',
    returns: 'labelled',
    params: [{ name: 'days', type: 'int', default: 30 }],
    fixed: [],
    sql: `
      SELECT kind AS label, count(*)::float8 AS value
      FROM app.agent_outputs
      WHERE occurred_at >= now() - make_interval(days => $1)
      GROUP BY 1
      ORDER BY value DESC
    `,
  },

  outputs_by_department: {
    description: 'Rows written per department over the last N days.',
    status: 'served',
    returns: 'labelled',
    params: [{ name: 'days', type: 'int', default: 30 }],
    fixed: [],
    sql: `
      SELECT department AS label, count(*)::float8 AS value
      FROM app.agent_outputs
      WHERE occurred_at >= now() - make_interval(days => $1)
      GROUP BY 1
      ORDER BY value DESC
    `,
  },

  outputs_recent: {
    description: 'Most recent rows of one output kind, newest first.',
    status: 'served',
    returns: 'rows',
    params: [
      { name: 'kind', type: 'string' },
      { name: 'limit', type: 'int', default: 20 },
    ],
    fixed: [],
    sql: `
      SELECT o.entity_key, o.occurred_at, o.agent, o.department, o.payload, r.trace_url
      FROM app.agent_outputs o
      LEFT JOIN ops.agent_runs r ON r.run_id = o.run_id
      WHERE o.kind = $1
      ORDER BY o.occurred_at DESC
      LIMIT $2
    `,
  },

  cost_by_agent: {
    description: 'Runner spend per agent over the last N days. Real from the first run.',
    status: 'served',
    returns: 'labelled',
    params: [{ name: 'days', type: 'int', default: 28 }],
    fixed: [],
    sql: `
      SELECT agent AS label,
             sum(cost_usd)::float8 AS value,
             count(*)::int AS runs,
             (count(*) FILTER (WHERE cost_usd IS NULL))::int AS unpriced
      FROM ops.agent_runs
      WHERE dry_run = false AND status <> 'awaiting-approval'
        AND started_at >= now() - make_interval(days => $1)
      GROUP BY 1
      ORDER BY value DESC
    `,
  },

  runs_per_day: {
    description: 'Daily run volume over the last N days.',
    status: 'served',
    returns: 'series',
    params: [{ name: 'days', type: 'int', default: 28 }],
    fixed: [],
    sql: `
      SELECT date_trunc('day', started_at) AS t, count(*)::float8 AS v
      FROM ops.agent_runs
      WHERE dry_run = false AND status <> 'awaiting-approval'
        AND started_at >= now() - make_interval(days => $1)
      GROUP BY 1
      ORDER BY 1
    `,
  },

  /* --- pipeline.json ------------------------------------------------------ */

  pipeline_value: total({
    description: 'Open pipeline value: the sum of every open deal opened in the window.',
    scope: { kind: 'deal', eq: { status: 'open' } },
    window: { field: 'opened_at', days: 30 },
    field: 'value',
    fields: ['status', 'value', 'opened_at'],
  }),

  deals_open_count: count({
    description: 'How many deals are open right now. Current state, not a window.',
    scope: { kind: 'deal', eq: { status: 'open' } },
    window: null,
    fields: ['status'],
  }),

  pipeline_stalled_value: total({
    description: 'Value of open deals with no activity for `stale_days` — the reactivation signal.',
    scope: { kind: 'deal', eq: { status: 'open' } },
    window: null,
    field: 'value',
    staleOn: { field: 'last_activity_at', param: 'stale_days', days: 21 },
    fields: ['status', 'value', 'last_activity_at'],
  }),

  deal_win_rate: share({
    description: 'Of the deals closed in the window, the share that were won.',
    scope: { kind: 'deal', oneOf: { status: ['won', 'lost'] } },
    of: { kind: 'deal', eq: { status: 'won' } },
    window: { field: 'closed_at', days: 90 },
    fields: ['status', 'closed_at'],
  }),

  deal_age_p50: medianElapsed({
    description: 'Median age of the currently open deals, measured from when they opened.',
    scope: { kind: 'deal', eq: { status: 'open' } },
    window: null,
    from: 'opened_at',
    to: null,
    fields: ['status', 'opened_at'],
  }),

  pipeline_by_stage: grouped({
    description: 'Open pipeline value by stage.',
    scope: { kind: 'deal', eq: { status: 'open' } },
    window: null,
    by: 'stage',
    sum: 'value',
    fields: ['status', 'stage', 'value'],
  }),

  pipeline_by_source: grouped({
    description: 'Open pipeline value by acquisition source.',
    scope: { kind: 'deal', eq: { status: 'open' } },
    window: null,
    by: 'source',
    sum: 'value',
    fields: ['status', 'source', 'value'],
  }),

  deals_open_list: rows({
    description: 'The open deals, oldest activity first — the table you work down.',
    scope: { kind: 'deal', eq: { status: 'open' } },
    window: null,
    orderBy: 'last_activity_at',
    direction: 'asc',
    fields: ['status', 'deal', 'stage', 'value', 'owner', 'opened_at', 'last_activity_at'],
  }),

  pipeline_created_series: series({
    description: 'Deal value created per day over the window.',
    scope: { kind: 'deal' },
    window: { field: 'opened_at', days: 28 },
    on: 'opened_at',
    sum: 'value',
    fields: ['value', 'opened_at'],
  }),

  /* --- client-delivery.json ----------------------------------------------- */

  engagements_active_count: count({
    description: 'Engagements that are neither closed nor cancelled.',
    scope: { kind: 'engagement', noneOf: { state: ['closed', 'cancelled'] } },
    window: null,
    fields: ['state'],
  }),

  engagements_on_track_share: share({
    description: 'Share of active engagements whose health is on-track.',
    scope: { kind: 'engagement', noneOf: { state: ['closed', 'cancelled'] } },
    of: { kind: 'engagement', eq: { health: 'on-track' } },
    window: null,
    fields: ['state', 'health'],
  }),

  engagements_at_risk_count: count({
    description: 'Active engagements flagged at risk — drives the warn signal.',
    scope: { kind: 'engagement', eq: { health: 'at-risk' }, noneOf: { state: ['closed', 'cancelled'] } },
    window: null,
    fields: ['state', 'health'],
  }),

  engagements_progress: rows({
    description: 'Active engagements with phase and progress, for the progress-table.',
    scope: { kind: 'engagement', noneOf: { state: ['closed', 'cancelled'] } },
    window: null,
    orderBy: 'started_at',
    direction: 'asc',
    returns: 'progress',
    fields: ['client', 'state', 'phase', 'progress', 'health', 'started_at'],
  }),

  deliverables_shipped: count({
    description: 'Deliverables shipped in the last N days.',
    scope: { kind: 'deliverable', eq: { state: 'shipped' } },
    window: { field: 'shipped_at', days: 7 },
    fields: ['state', 'shipped_at'],
  }),

  deliverable_cycle_p50: medianElapsed({
    description: 'Median time from starting a deliverable to shipping it.',
    scope: { kind: 'deliverable', eq: { state: 'shipped' } },
    window: { field: 'shipped_at', days: 90 },
    from: 'started_at',
    to: 'shipped_at',
    fields: ['state', 'started_at', 'shipped_at'],
  }),

  deliverables_queue: rows({
    description: 'Unshipped deliverables, soonest due first.',
    scope: { kind: 'deliverable', noneOf: { state: ['shipped', 'cancelled'] } },
    window: null,
    orderBy: 'due_at',
    direction: 'asc',
    fields: ['deliverable', 'client', 'state', 'phase', 'due_at'],
  }),

  deliverables_by_phase: grouped({
    description: 'Open deliverables per delivery phase.',
    scope: { kind: 'deliverable', noneOf: { state: ['shipped', 'cancelled'] } },
    window: null,
    by: 'phase',
    fields: ['state', 'phase'],
  }),

  /* --- content-studio.json ------------------------------------------------ */

  content_published_count: count({
    description: 'Pieces published in the window.',
    scope: { kind: 'content_piece', eq: { state: 'published' } },
    window: { field: 'published_at', days: 14 },
    fields: ['state', 'published_at'],
  }),

  content_views_total: total({
    description: 'Views across pieces published in the window.',
    scope: { kind: 'content_piece', eq: { state: 'published' } },
    window: { field: 'published_at', days: 14 },
    field: 'views',
    fields: ['state', 'views', 'published_at'],
  }),

  content_engagement_rate: ratio({
    description: 'Engagements divided by views, across pieces published in the window.',
    scope: { kind: 'content_piece', eq: { state: 'published' } },
    window: { field: 'published_at', days: 14 },
    numerator: 'engagements',
    denominator: 'views',
    fields: ['state', 'views', 'engagements', 'published_at'],
  }),

  content_drafts_in_review: count({
    description: 'Drafts sitting in review right now — the "waiting on a human" number.',
    scope: { kind: 'content_piece', eq: { state: 'in-review' } },
    window: null,
    fields: ['state'],
  }),

  content_time_to_publish_p50: medianElapsed({
    description: 'Median time from first draft to publication.',
    scope: { kind: 'content_piece', eq: { state: 'published' } },
    window: { field: 'published_at', days: 90 },
    from: 'drafted_at',
    to: 'published_at',
    fields: ['state', 'drafted_at', 'published_at'],
  }),

  content_views_series: series({
    description: 'Views by publication day — views attributed to the day the piece went out, not the day they happened.',
    scope: { kind: 'content_piece', eq: { state: 'published' } },
    window: { field: 'published_at', days: 28 },
    on: 'published_at',
    sum: 'views',
    fields: ['state', 'views', 'published_at'],
  }),

  content_views_by_channel: grouped({
    description: 'Views by channel over the window.',
    scope: { kind: 'content_piece', eq: { state: 'published' } },
    window: { field: 'published_at', days: 28 },
    by: 'channel',
    sum: 'views',
    fields: ['state', 'channel', 'views', 'published_at'],
  }),

  content_top_pieces: grouped({
    description: 'Best-performing pieces by views over the window.',
    scope: { kind: 'content_piece', eq: { state: 'published' } },
    window: { field: 'published_at', days: 28 },
    by: 'title',
    sum: 'views',
    limit: 8,
    fields: ['state', 'title', 'views', 'published_at'],
  }),

  content_queue: rows({
    description: 'Drafts and scheduled pieces, soonest first.',
    scope: { kind: 'content_piece', noneOf: { state: ['published', 'archived'] } },
    window: null,
    orderBy: 'scheduled_at',
    direction: 'asc',
    fields: ['piece', 'channel', 'state', 'scheduled_at'],
  }),

  /* --- finance.json ------------------------------------------------------- */

  infra_cost_total: total({
    description: 'Infrastructure spend recorded in the window. Model spend is separate — that comes from the run ledger.',
    scope: { kind: 'infra_cost_line' },
    window: { field: 'occurred_at', days: 28 },
    field: 'amount',
    fields: ['service', 'amount'],
  }),

  infra_cost_by_service: grouped({
    description: 'Infrastructure spend per service over the window.',
    scope: { kind: 'infra_cost_line' },
    window: { field: 'occurred_at', days: 28 },
    by: 'service',
    sum: 'amount',
    fields: ['service', 'amount'],
  }),

  revenue_booked: total({
    description: 'Invoiced revenue in the window — issued invoices, whether or not they are paid.',
    scope: { kind: 'invoice', oneOf: { state: ['sent', 'paid', 'overdue'] } },
    window: { field: 'issued_at', days: 28 },
    field: 'amount',
    fields: ['state', 'amount', 'issued_at'],
  }),

  invoices_outstanding: total({
    description: 'Money owed to us right now: issued invoices that are not paid. Current state, not a window.',
    scope: { kind: 'invoice', oneOf: { state: ['sent', 'overdue'] } },
    window: null,
    field: 'amount',
    fields: ['state', 'amount'],
  }),

  invoice_ledger: rows({
    description: 'Unpaid invoices, oldest first.',
    scope: { kind: 'invoice', oneOf: { state: ['sent', 'overdue'] } },
    window: null,
    orderBy: 'issued_at',
    direction: 'asc',
    fields: ['invoice', 'client', 'state', 'amount', 'issued_at', 'due_at'],
  }),

  runway_estimate: pending({
    description: 'Months of runway at the current burn rate.',
    returns: 'scalar',
    blockedBy:
      'Runway needs a cash balance, and nothing in this system knows one. Invoiced revenue is not cash, ' +
      'and an estimate built from what we do have would be a confident wrong number on a finance dashboard. ' +
      'Register a `cash_balance` output kind (a bank-reconciliation agent) and this becomes one line of SQL.',
    needs: { kind: 'cash_balance', fields: ['as_of', 'amount', 'currency'] },
  }),

  /* --- product-funnels.json ----------------------------------------------- */

  product_signups: count({
    description: 'Users who signed up in the window.',
    scope: { kind: 'product_user' },
    window: { field: 'signed_up_at', days: 28 },
    fields: ['user_key', 'signed_up_at'],
  }),

  product_activated: count({
    description: 'Users who reached activation in the window.',
    scope: { kind: 'product_user', present: ['activated_at'] },
    window: { field: 'activated_at', days: 28 },
    fields: ['user_key', 'activated_at'],
  }),

  product_activation_rate: share({
    description: 'Share of users who signed up in the window and have since activated.',
    scope: { kind: 'product_user' },
    of: { kind: 'product_user', present: ['activated_at'] },
    window: { field: 'signed_up_at', days: 28 },
    fields: ['user_key', 'signed_up_at', 'activated_at'],
  }),

  product_dropoff_share: share({
    description: 'Share of users who signed up in the window and never activated.',
    scope: { kind: 'product_user' },
    of: { kind: 'product_user', absent: ['activated_at'] },
    window: { field: 'signed_up_at', days: 28 },
    fields: ['user_key', 'signed_up_at', 'activated_at'],
  }),

  product_time_to_activate_p50: medianElapsed({
    description: 'Median time from signup to activation, for users who activated in the window.',
    scope: { kind: 'product_user', present: ['activated_at'] },
    window: { field: 'activated_at', days: 90 },
    from: 'signed_up_at',
    to: 'activated_at',
    fields: ['signed_up_at', 'activated_at'],
  }),

  product_weekly_active: count({
    description: 'Users seen in the last N days. "Weekly active" is this with days = 7.',
    scope: { kind: 'product_user' },
    window: { field: 'last_active_at', days: 7 },
    fields: ['user_key', 'last_active_at'],
  }),

  product_signups_by_source: grouped({
    description: 'Signups per acquisition source over the window.',
    scope: { kind: 'product_user' },
    window: { field: 'signed_up_at', days: 28 },
    by: 'source',
    fields: ['source', 'signed_up_at'],
  }),

  product_funnel_steps: grouped({
    description: 'Users reaching each funnel step over the window.',
    scope: { kind: 'product_event' },
    window: { field: 'occurred_at', days: 28 },
    by: 'step',
    fields: ['step', 'user_key'],
  }),

  product_active_series: series({
    description: 'Distinct-user activity per week over the window.',
    scope: { kind: 'product_event' },
    window: { field: 'occurred_at', days: 90 },
    on: 'occurred_at',
    bucket: 'week',
    fields: ['user_key'],
  }),

  product_retention_d7: pending({
    description: 'Share of a signup cohort still active seven days later.',
    returns: 'scalar',
    blockedBy:
      'Cohort retention needs a per-user event history, not the latest-state row `product_user` holds. ' +
      'Computing it from `last_active_at` would answer a different question and label it D7 retention. ' +
      'It becomes real when a product-analytics agent writes `product_event` rows per user per day.',
    needs: { kind: 'product_event', fields: ['user_key', 'event', 'occurred_at'] },
  }),

  product_top_events: pending({
    description: 'Events most associated with activation, with their lift.',
    returns: 'rows',
    blockedBy:
      'The panel asks for a "lift" column — a causal claim. We can count events honestly; we cannot ' +
      'attribute activation to them from this table. Either the widget drops `lift` (then this is ' +
      '`product_funnel_steps` with a different grouping) or an analysis agent writes the attribution ' +
      'as its own output kind, with its method recorded.',
    needs: { kind: 'product_event', fields: ['event', 'user_key', 'occurred_at'] },
  }),
};

/** Every output kind the registry reads, and the fields each one owes. The write contract. */
export function outputContract(): { kind: string; fields: string[]; queries: string[] }[] {
  const byKind = new Map<string, { fields: Set<string>; queries: string[] }>();
  for (const [name, query] of Object.entries(NAMED_QUERIES)) {
    if (!query.needs) continue;
    const entry = byKind.get(query.needs.kind) ?? { fields: new Set<string>(), queries: [] };
    for (const f of query.needs.fields) entry.fields.add(f);
    entry.queries.push(name);
    byKind.set(query.needs.kind, entry);
  }
  return [...byKind.entries()]
    .map(([kind, v]) => ({ kind, fields: [...v.fields].sort(), queries: v.queries.sort() }))
    .sort((a, b) => a.kind.localeCompare(b.kind));
}

export type BoundQuery = {
  name: string;
  status: QueryStatus;
  returns: ResultShape;
  description: string;
  needs?: { kind: string; fields: string[] };
  blockedBy?: string;
  /** Absent when `status` is `pending` — there is nothing to run. */
  sql?: string;
  params: unknown[];
};

/**
 * Validate and order a named query's parameters. Rejects unknown names, wrong types and
 * missing values — before anything is bound, let alone executed.
 */
export function bindNamedQuery(name: string, supplied: Record<string, unknown> = {}): BoundQuery {
  const query = NAMED_QUERIES[name];
  if (!query) {
    throw Object.assign(new Error(`Unknown query "${name}".`), {
      code: 'unknown_query',
      hint: `Register it in apps/runner/src/db/registry.ts. Known queries: ${Object.keys(NAMED_QUERIES).join(', ')}.`,
    });
  }

  const bound = query.params.map((spec) => {
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
      if (!Object.hasOwn(RANGE_DAYS, value)) {
        throw Object.assign(new Error(`"${spec.name}" must be one of ${Object.keys(RANGE_DAYS).join(', ')}.`), {
          code: 'bad_param',
          hint: 'Check the panel definition.',
        });
      }
      return RANGE_DAYS[value];
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

  return {
    name,
    status: query.status,
    returns: query.returns,
    description: query.description,
    needs: query.needs,
    blockedBy: query.blockedBy,
    sql: query.sql,
    params: [...query.fixed, ...bound],
  };
}

/** Range token → days, for `type: 'range'` parameters. Mirrors RANGES in queries.ts. */
const RANGE_DAYS: Record<string, number> = { '24h': 1, '7d': 7, '14d': 14, '28d': 28, '30d': 30, '90d': 90 };
