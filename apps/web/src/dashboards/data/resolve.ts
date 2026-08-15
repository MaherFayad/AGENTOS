/**
 * Panel query → `QueryResult`.
 *
 * Phase 1 resolves `langfuse` (via `GET /api/runs` + `lib/runs.ts`) and `static`.
 * `sql` is a named query the runner owns; until that registry is live every sql
 * query is `unavailable` and the widget prints its `emptyState`. That is the honest
 * state, not a gap to hide (standing rule 9).
 *
 * `$range` is bound here, client-side, before anything leaves the browser.
 *
 * Owner: dashboards-engineer · Spec §2.5 · contracts/panel-schema.md
 */

import type { LangfuseQuery, PanelQuery, QueryResult, ResolveContext } from '@agnetos/contracts';
import { aggregate, normalizeRuns, type AggregateContext, type RunRecord } from '../lib/runs';
import { bindRange } from './bind';

export const RUNS_LIMIT = 200;
export const RUNS_PATH = `/api/runs?limit=${RUNS_LIMIT}`;

export interface RunsBundle {
  runs: RunRecord[];
  requestedLimit: number;
}

export function parseRunsPayload(json: unknown): RunsBundle | null {
  if (Array.isArray(json)) return { runs: normalizeRuns(json), requestedLimit: RUNS_LIMIT };
  if (json && typeof json === 'object' && Array.isArray((json as { runs?: unknown }).runs)) {
    return { runs: normalizeRuns(json), requestedLimit: RUNS_LIMIT };
  }
  return null;
}

export { bindRange };

const SQL_UNAVAILABLE: QueryResult = {
  status: 'unavailable',
  message:
    'This number is a named Postgres query. It lights up when the agent that writes those rows has run — not before.',
};

/**
 * Pure resolution given an already-fetched run list. Widgets never talk to transport.
 *
 * `sql` short-circuits. `static` returns the literal. `langfuse` goes through `aggregate`,
 * whose truncation guard refuses a plausible undercount.
 */
export function resolveQuery(
  query: PanelQuery,
  runs: RunsBundle | null,
  ctx: ResolveContext = {},
): QueryResult {
  const bound = ctx.range ? bindRange(query, ctx.range) : query;

  if (bound.source === 'sql') return SQL_UNAVAILABLE;

  if (bound.source === 'static') {
    return { status: 'ok', data: bound.value };
  }

  if (!runs) {
    return {
      status: 'unavailable',
      message: 'No run list to read. The activity feed and ops KPIs come from GET /api/runs.',
    };
  }

  const langfuse = bound as LangfuseQuery;
  const agg: AggregateContext = {
    requestedLimit: runs.requestedLimit,
    now: Date.now(),
  };
  return aggregate(runs.runs, langfuse, agg);
}

export const RUNS_NOT_BUILT =
  'The runner has not exposed GET /api/runs yet, so there is no activity to show. Ops KPIs stay empty rather than guessed.';

export const RUNS_OFFLINE =
  'Cannot reach the runner, so Langfuse-backed numbers are unavailable. This box may be off the tailnet.';
