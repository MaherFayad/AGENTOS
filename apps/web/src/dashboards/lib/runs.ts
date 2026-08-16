/**
 * Ledger run rows → the shapes widgets render.
 *
 * **Agent runs ARE the activity feed** (§2.5 data note), so this file is the boundary
 * between `GET /api/metrics/runs` (the durable Postgres ledger) and a table row or a feed
 * line.
 *
 * WHAT USED TO BE HERE AND IS NOW GONE
 *
 * `aggregate()`, `coversWindow()`, `metricOf()` and their friends derived runs / cost /
 * p50 / error rate in the browser from `GET /api/runs?limit=200` — the runner's in-memory
 * store — and refused whenever the capped list could not cover the requested window. That
 * truncation guard was the right answer to the wrong data source: the process-local buffer
 * is empty after every restart, so the dashboards blanked out whether or not the guard
 * fired. Every metric now comes from an aggregate Postgres computed over the whole window
 * (`data/endpoints.ts`), and a `count(*)` over a window cannot undercount that window, so
 * there is nothing left for the guard to protect. It was deleted rather than left dormant:
 * a second, differently-behaved way to compute a KPI is how two screens start disagreeing.
 *
 * Owner: dashboards-engineer · Spec §2.5, §3.5
 */

import type { ActivityRow } from '@agnetos/contracts';

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

/** `GET /api/metrics/runs` payload → run records. Rows without an id, agent or time are dropped. */
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
