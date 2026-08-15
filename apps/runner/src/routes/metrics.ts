/**
 * The metrics API (§3.5). Everything the product renders as a number comes from here.
 *
 * Framework-agnostic on purpose: `handleMetricsRequest` takes a URL and returns
 * `{status, body}`, so `runner-engineer` mounts it in one line whatever HTTP library
 * the runner settles on, and the tests exercise the real handler rather than a mock of
 * one. Errors use the uniform envelope from `contracts/api-contracts.md`:
 * `{error: {code, message, hint?}}` — `hint` is written for a human on a phone.
 *
 * Routes owned here:
 *   GET /api/cost/today            shell cost ticker (§2.0)
 *   GET /api/runs                  LAST RUNS (§2.3)
 *   GET /api/runs/:runId/tools     span detail behind a LAST RUNS row
 *   GET /api/metrics/live          LIVE numerator + per-department (§2.0, §2.2)
 *   GET /api/metrics/status        derived node status, drives the amber halo (§3.4)
 *   GET /api/metrics/query         KPI tiles + `query.source: "langfuse"` (§2.5)
 *   GET /api/metrics/activity      activity feed (§2.5)
 *   GET /api/metrics/sql/:name     `query.source: "sql"` named business queries
 */

import {
  activityFeed,
  agentEvidence,
  bindNamedQuery,
  costToday,
  isMetric,
  isRange,
  lastRuns,
  metric,
  runToolCalls,
  NAMED_QUERIES,
  RANGES,
  type MetricName,
  type Range,
} from '../db/queries.ts';
import { countLive, deriveStatus, THRESHOLDS, type AgentEvidence } from '../observability/status.ts';
import type { DbClient } from '../observability/types.ts';

export type MetricsOptions = {
  /** Day boundary for the cost ticker. "Today" means the human's today. */
  timezone?: string;
};

export type MetricsResponse = { status: number; body: unknown };

const DEFAULT_TIMEZONE = process.env.CC_TIMEZONE ?? 'Asia/Riyadh';

function fail(status: number, code: string, message: string, hint?: string): MetricsResponse {
  return { status, body: { error: { code, message, ...(hint ? { hint } : {}) } } };
}

function clampLimit(raw: string | null, fallback: number, max: number): number {
  const n = raw === null ? fallback : Number(raw);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(Math.floor(n), max);
}

/** ISO timestamp → the relative string LAST RUNS shows ("14m ago"). */
export function relativeTime(iso: string, now = Date.now()): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const seconds = Math.max(0, Math.round((now - then) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.round(days / 30)}mo ago`;
}

/**
 * Main entry point. `url` may be absolute or path-and-query.
 */
export async function handleMetricsRequest(
  method: string,
  url: string,
  db: DbClient,
  options: MetricsOptions = {},
): Promise<MetricsResponse> {
  if (method !== 'GET') {
    return fail(405, 'method_not_allowed', 'The metrics API is read-only.', 'Use GET.');
  }

  const parsed = new URL(url, 'http://runner.internal');
  const path = parsed.pathname.replace(/\/+$/, '') || '/';
  const q = parsed.searchParams;
  const timezone = options.timezone ?? DEFAULT_TIMEZONE;

  try {
    if (path === '/api/cost/today') {
      const { usd, runs, unpricedRuns } = await costToday(db, timezone);
      return {
        status: 200,
        body: {
          usd: Math.round(usd * 100) / 100,
          runs,
          // How many of today's runs we could not price. The ticker shows a bare
          // number; this is how a caller knows whether that number is the whole story.
          unpricedRuns,
          timezone,
          asOf: new Date().toISOString(),
        },
      };
    }

    if (path === '/api/runs') {
      const agent = q.get('agent');
      const limit = clampLimit(q.get('limit'), 5, 50);
      const rows = await lastRuns(db, agent, limit);
      const now = Date.now();
      return {
        status: 200,
        body: {
          runs: rows.map((r: Record<string, unknown>) => ({
            runId: r.run_id,
            agent: r.agent,
            agentName: r.agent_name,
            relativeTime: relativeTime(toIso(r.started_at), now),
            startedAt: toIso(r.started_at),
            status: r.status,
            durationMs: r.duration_ms,
            costUsd: r.cost_usd === null ? null : Number(r.cost_usd),
            costSource: r.cost_source,
            traceUrl: r.trace_url,
          })),
        },
      };
    }

    const toolsMatch = path.match(/^\/api\/runs\/([A-Za-z0-9_-]{1,64})\/tools$/);
    if (toolsMatch) {
      const rows = await runToolCalls(db, toolsMatch[1]);
      return {
        status: 200,
        body: {
          toolCalls: rows.map((r: Record<string, unknown>) => ({
            seq: r.seq,
            name: r.name,
            status: r.status,
            startedAt: toIso(r.started_at),
            durationMs: r.duration_ms,
            error: r.error,
          })),
        },
      };
    }

    if (path === '/api/metrics/live' || path === '/api/metrics/status') {
      const statuses = (await agentEvidence(db, THRESHOLDS.window)).map((row: Record<string, unknown>) =>
        deriveStatus(toEvidence(row)),
      );

      if (path === '/api/metrics/live') {
        const counts = countLive(statuses);
        return {
          status: 200,
          body: {
            ...counts,
            // Deliberately no `total`. How many agents exist is a frontmatter fact and
            // belongs to GET /api/graph. Splitting numerator from denominator is what
            // makes it structurally impossible for this endpoint to inflate the count
            // (Part VII.3).
            totalSource: 'GET /api/graph',
            asOf: new Date().toISOString(),
          },
        };
      }

      return {
        status: 200,
        body: {
          agents: statuses.map((s) => ({
            agent: s.agent,
            department: s.department,
            status: s.status,
            errorRate: s.errorRate,
            reason: s.reason,
            runs: s.evidence.totalRuns,
            successfulRuns: s.evidence.successfulRuns,
            lastRunAt: s.evidence.lastRunAt,
          })),
          thresholds: THRESHOLDS,
          asOf: new Date().toISOString(),
        },
      };
    }

    if (path === '/api/metrics/query') {
      const name = q.get('metric') ?? '';
      if (!isMetric(name)) {
        return fail(
          400,
          'unknown_metric',
          `"${name}" is not a metric.`,
          'Use runs, cost, latency_p50 or error_rate.',
        );
      }
      const range = q.get('range') ?? '7d';
      if (!isRange(range)) {
        return fail(
          400,
          'bad_range',
          `"${range}" is not a supported range.`,
          `Use one of ${Object.keys(RANGES).join(', ')}.`,
        );
      }
      const filter = { agent: q.get('agent') ?? undefined, department: q.get('department') ?? undefined };
      const hours = RANGES[range as Range];
      const current = await metric(db, name as MetricName, filter, hours, 0);

      // The KPI chip's ▲/▼ compares against the immediately preceding window of the
      // same length — "vs previous 28d" in the panel contract's caption.
      const compare = q.get('compare') !== 'false';
      const previous = compare ? await metric(db, name as MetricName, filter, hours * 2, hours) : null;

      return {
        status: 200,
        body: {
          metric: name,
          range,
          filter,
          value: current.value,
          runs: current.runs,
          unpricedRuns: name === 'cost' ? current.unpriced : undefined,
          previous: previous?.value ?? null,
          delta: deltaOf(current.value, previous?.value ?? null),
          asOf: new Date().toISOString(),
        },
      };
    }

    if (path === '/api/metrics/activity') {
      const limit = clampLimit(q.get('limit'), 12, 100);
      const department = q.get('department');
      const rows = await activityFeed(db, department, limit);
      return {
        status: 200,
        body: {
          items: rows.map((r: Record<string, unknown>) => ({
            runId: r.run_id,
            at: toIso(r.started_at),
            // The feed's leading `09:41`. Rendered in the ticker's timezone so a row
            // reads as the time the human remembers it happening.
            time: formatClock(toIso(r.started_at), timezone),
            event: r.activity_event,
            detail: r.activity_detail,
            agent: r.agent,
            agentName: r.agent_name,
            department: r.department,
            status: r.status,
            traceUrl: r.trace_url,
          })),
        },
      };
    }

    const sqlMatch = path.match(/^\/api\/metrics\/sql\/([a-z][a-z0-9_]{1,48})$/);
    if (sqlMatch) {
      const params: Record<string, unknown> = {};
      for (const [key, value] of q.entries()) params[key] = value;
      const bound = bindNamedQuery(sqlMatch[1], params);
      const { rows } = await db.query(bound.sql, bound.params);
      return { status: 200, body: { name: sqlMatch[1], rows } };
    }

    if (path === '/api/metrics/sql') {
      return {
        status: 200,
        body: {
          queries: Object.entries(NAMED_QUERIES).map(([name, q2]) => ({
            name,
            description: q2.description,
            params: q2.params,
          })),
        },
      };
    }

    return fail(404, 'not_found', `No metrics route matches ${path}.`);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === 'unknown_query' || code === 'missing_param' || code === 'bad_param') {
      const e = error as Error & { hint?: string };
      return fail(400, code, e.message, e.hint);
    }
    const message = error instanceof Error ? error.message : String(error);
    return fail(
      503,
      'metrics_unavailable',
      message,
      'The metrics database is not answering. Runs still work; numbers will fill in once it is back.',
    );
  }
}

/** Signed relative change, or null when there is no honest comparison to draw. */
export function deltaOf(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 1000;
}

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return typeof value === 'string' ? value : '';
}

function formatClock(iso: string, timezone: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return '';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timezone,
    }).format(new Date(ms));
  } catch {
    return new Date(ms).toISOString().slice(11, 16);
  }
}

function toEvidence(row: Record<string, unknown>): AgentEvidence {
  return {
    agent: String(row.agent),
    department: String(row.department ?? ''),
    totalRuns: Number(row.total_runs ?? 0),
    successfulRuns: Number(row.successful_runs ?? 0),
    recentRuns: Number(row.recent_runs ?? 0),
    recentErrors: Number(row.recent_errors ?? 0),
    lastRunAt: row.last_run_at ? toIso(row.last_run_at) : null,
    lastSuccessAt: row.last_success_at ? toIso(row.last_success_at) : null,
  };
}

/** The route table, for whatever mounts this. */
export const METRICS_ROUTES = [
  'GET /api/cost/today',
  'GET /api/runs',
  'GET /api/runs/:runId/tools',
  'GET /api/metrics/live',
  'GET /api/metrics/status',
  'GET /api/metrics/query',
  'GET /api/metrics/activity',
  'GET /api/metrics/sql',
  'GET /api/metrics/sql/:name',
] as const;
