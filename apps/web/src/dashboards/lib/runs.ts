/**
 * Agent runs → dashboard data.
 *
 * **Agent runs ARE the activity feed** (§2.5 data note). This module is that sentence
 * implemented: it takes `GET /api/runs` (the one aggregate route that exists today,
 * `contracts/api-contracts.md` → Reads) and turns it into activity rows, table rows and
 * the four ops metrics — runs, cost, p50 latency, error rate.
 *
 * THE TRUNCATION GUARD, which is the only interesting thing in here:
 *
 * `/api/runs` takes a `limit`, not a time window. Counting "runs in the last 7 days" from
 * a list that was capped at 200 rows gives a number that is wrong and looks right — the
 * exact failure standing rule 9 exists to prevent. So `aggregate()` refuses: when the
 * response came back at the cap *and* the oldest row it contains is newer than the start
 * of the window, the window is not fully covered and the answer is `unavailable`, not a
 * plausible undercount.
 *
 * All of this is interim. When `observability-engineer` lands the aggregate route
 * (decision-request in their inbox), `resolve.ts` prefers it and these derivations retire.
 *
 * Owner: dashboards-engineer · Spec §2.5, §3.5
 */

import type { ActivityRow, LangfuseQuery, QueryResult } from '@agnetos/contracts';

export interface RunRecord {
  runId: string;
  /** `department/agent-slug` — invariant 1 of the frontmatter contract. */
  agent: string;
  status: string;
  /** ISO 8601. */
  startedAt: string;
  durationMs: number | null;
  costUsd: number | null;
  traceUrl: string | null;
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const numOrNull = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

/** `GET /api/runs` payload → run records. Rows without an id, agent or time are dropped. */
export function normalizeRuns(payload: unknown): RunRecord[] {
  const list = Array.isArray(payload) ? payload : isObj(payload) && Array.isArray(payload.runs) ? payload.runs : [];
  return list
    .map((row) => {
      if (!isObj(row)) return null;
      const runId = typeof row.runId === 'string' ? row.runId : null;
      const agent = typeof row.agent === 'string' ? row.agent : null;
      const startedAt = typeof row.startedAt === 'string' ? row.startedAt : null;
      if (!runId || !agent || !startedAt || Number.isNaN(Date.parse(startedAt))) return null;
      return {
        runId,
        agent,
        status: typeof row.status === 'string' ? row.status : 'ok',
        startedAt,
        durationMs: numOrNull(row.durationMs),
        costUsd: numOrNull(row.costUsd),
        traceUrl: typeof row.traceUrl === 'string' ? row.traceUrl : null,
      };
    })
    .filter((r): r is RunRecord => r !== null);
}

/* -------------------------------------------------------------------- time */

/** `7d` · `24h` · `4w` → milliseconds. `null` for anything else, including `$range`. */
export function rangeToMs(range: string | undefined): number | null {
  if (!range) return null;
  const m = /^(\d{1,3})([hdw])$/.exec(range);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = { h: 3_600_000, d: 86_400_000, w: 604_800_000 }[m[2] as 'h' | 'd' | 'w'];
  return n * unit;
}

/** `YYYY-MM-DD` in local time — the bucket key for a `groupBy: "day"` series. */
export function dayKey(at: string | number): string {
  const d = new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* ------------------------------------------------------------------ filter */

const departmentOf = (agent: string): string => agent.split('/')[0] ?? '';

export function applyFilter(runs: readonly RunRecord[], filter: LangfuseQuery['filter']): RunRecord[] {
  if (!filter) return [...runs];
  return runs.filter((r) => {
    if (filter.agent && r.agent !== filter.agent && !r.agent.endsWith(`/${filter.agent}`)) return false;
    if (filter.department && departmentOf(r.agent) !== filter.department) return false;
    if (filter.status === 'error' && r.status !== 'error') return false;
    if (filter.status === 'ok' && r.status !== 'ok') return false;
    return true;
  });
}

const inWindow = (runs: readonly RunRecord[], from: number, to: number): RunRecord[] =>
  runs.filter((r) => {
    const t = Date.parse(r.startedAt);
    return t >= from && t < to;
  });

/**
 * Can this list answer a question about `[from, to)`?
 *
 * Only if the API did not truncate it, or if it did but still reaches back past the start
 * of the window. See the header — this predicate is the difference between a real number
 * and a convincing one.
 */
export function coversWindow(runs: readonly RunRecord[], requestedLimit: number, from: number): boolean {
  if (runs.length < requestedLimit) return true;
  const oldest = Math.min(...runs.map((r) => Date.parse(r.startedAt)));
  return oldest <= from;
}

/* --------------------------------------------------------------- metrics */

const median = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const sum = (values: number[]): number => values.reduce((a, b) => a + b, 0);

/** One metric over one already-filtered, already-windowed set of runs. */
export function metricOf(runs: readonly RunRecord[], metric: LangfuseQuery['metric']): number | null {
  switch (metric) {
    case 'runs':
      return runs.length;
    case 'cost': {
      const costs = runs.map((r) => r.costUsd).filter((c): c is number => c !== null);
      // No cost lines at all is unknown, not zero — a run whose cost was never recorded
      // is not a free run.
      return costs.length === 0 ? (runs.length === 0 ? 0 : null) : sum(costs);
    }
    case 'latency_p50':
      return median(runs.map((r) => r.durationMs).filter((d): d is number => d !== null));
    case 'error_rate':
      return runs.length === 0 ? null : runs.filter((r) => r.status === 'error').length / runs.length;
    default:
      return null;
  }
}

const groupKeyOf = (run: RunRecord, groupBy: LangfuseQuery['groupBy']): string | null => {
  switch (groupBy) {
    case 'agent':
      return run.agent;
    case 'department':
      return departmentOf(run.agent);
    case 'day':
      return dayKey(run.startedAt);
    // `model` is not a field on a run summary (contracts/api-contracts.md → Reads). Rather
    // than guess a model name we report the grouping as unavailable.
    default:
      return null;
  }
};

const UNAVAILABLE = (message: string): QueryResult => ({ status: 'unavailable', message });

export interface AggregateContext {
  /** The `limit` that was sent to `/api/runs`, for the truncation guard. */
  requestedLimit: number;
  now?: number;
}

/**
 * The whole derivation, in one function: filter → window → metric | group | series.
 *
 * Returns a `QueryResult` rather than a number so every honest failure has somewhere to
 * go: `unavailable` when the window is not covered or the grouping is not derivable,
 * `empty` when the window genuinely holds no runs.
 */
export function aggregate(
  runs: readonly RunRecord[],
  query: LangfuseQuery,
  ctx: AggregateContext,
): QueryResult {
  const now = ctx.now ?? Date.now();
  const span = rangeToMs(query.range);
  const filtered = applyFilter(runs, query.filter);
  const shape = query.shape ?? 'scalar';

  if (shape === 'list' && query.groupBy === 'model')
    return UNAVAILABLE('Per-model spend needs the Langfuse aggregate route; a run summary does not carry the model.');

  const from = span === null ? 0 : now - span;
  const to = now + 1;
  if (span !== null && !coversWindow(runs, ctx.requestedLimit, from))
    return UNAVAILABLE('More runs in this window than this view can count — the aggregate lands with the metrics route.');

  const windowed = span === null ? filtered : inWindow(filtered, from, to);

  /* ------ scalar, optionally compared against the previous window ---------- */
  if (shape === 'scalar') {
    const value = metricOf(windowed, query.metric);
    if (!query.compare) {
      if (value === null) return windowed.length === 0 ? { status: 'empty' } : UNAVAILABLE('Not recorded on these runs.');
      return { status: 'ok', data: value };
    }
    if (span === null) return UNAVAILABLE('A comparison needs a window to compare against.');
    if (!coversWindow(runs, ctx.requestedLimit, from - span))
      return UNAVAILABLE('The previous window is beyond what this view can read.');
    const previous = metricOf(inWindow(filtered, from - span, from), query.metric);
    if (value === null || previous === null || previous === 0) return { status: 'empty' };
    return { status: 'ok', data: (value - previous) / Math.abs(previous) };
  }

  /* ------ series: one point per day across the window --------------------- */
  if (shape === 'series') {
    if (span === null) return UNAVAILABLE('A series needs a window.');
    const days = Math.max(1, Math.ceil(span / 86_400_000));
    const buckets = new Map<string, RunRecord[]>();
    for (let i = days - 1; i >= 0; i--) buckets.set(dayKey(now - i * 86_400_000), []);
    for (const run of windowed) {
      const key = dayKey(run.startedAt);
      if (buckets.has(key)) buckets.get(key)!.push(run);
    }
    if (windowed.length === 0) return { status: 'empty' };
    const points = [...buckets.entries()].map(([t, rows]) => ({ t, v: metricOf(rows, query.metric) ?? 0 }));
    return { status: 'ok', data: points };
  }

  /* ------ list: either grouped totals, or the runs themselves ------------- */
  if (windowed.length === 0) return { status: 'empty' };

  if (query.groupBy) {
    const groups = new Map<string, RunRecord[]>();
    for (const run of windowed) {
      const key = groupKeyOf(run, query.groupBy);
      if (key === null) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(run);
    }
    const rows = [...groups.entries()]
      .map(([label, rows_]) => ({ label: labelFromSlug(label), value: metricOf(rows_, query.metric) ?? 0 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, query.limit ?? 12);
    return rows.length === 0 ? { status: 'empty' } : { status: 'ok', data: rows };
  }

  const rows = [...windowed]
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))
    .slice(0, query.limit ?? 12);
  return { status: 'ok', data: rows };
}

/* ------------------------------------------------------- presentation bits */

/** `sales/account-enrichment` → `Account Enrichment`. */
export function labelFromSlug(slug: string): string {
  const tail = slug.split('/').pop() ?? slug;
  return tail
    .split(/[-_]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

const EVENT: Record<string, string> = {
  ok: 'Run completed',
  error: 'Run failed',
  running: 'Running now',
  queued: 'Queued',
  'awaiting-approval': 'Waiting on your approval',
  denied: 'Run denied',
  canceled: 'Run canceled',
};

const FEED_STATUS: Record<string, ActivityRow['status']> = {
  ok: 'ok',
  error: 'error',
  running: 'running',
  denied: 'error',
};

/**
 * A run → a feed row (§2.5.5.7): bold event, plain continuation, `--ink-2` attribution.
 *
 * The continuation carries only figures the run actually recorded. A run with no cost
 * line gets no `$0.00`; it gets a shorter sentence, which is the honest version of the
 * same row.
 */
export function runToActivityRow(run: RunRecord, format: {
  duration: (ms: number) => string | null;
  currency: (usd: number) => string | null;
}): ActivityRow {
  const parts: string[] = [];
  if (run.durationMs !== null) {
    const d = format.duration(run.durationMs);
    if (d) parts.push(d);
  }
  if (run.costUsd !== null) {
    const c = format.currency(run.costUsd);
    if (c) parts.push(c);
  }
  const status = FEED_STATUS[run.status];
  return {
    at: run.startedAt,
    event: EVENT[run.status] ?? 'Run recorded',
    ...(parts.length ? { detail: parts.join(' · ') } : {}),
    attribution: labelFromSlug(run.agent),
    ...(status ? { status } : {}),
    ...(run.traceUrl ? { traceUrl: run.traceUrl } : {}),
  };
}
