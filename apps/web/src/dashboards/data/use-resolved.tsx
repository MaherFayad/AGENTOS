'use client';

/**
 * Shared run list + range/segment for one dashboard. Every widget and KPI reads
 * through `useResolved` so a malformed query cannot take its neighbours down.
 *
 * Owner: dashboards-engineer · Spec §2.5
 */

import { createContext, useContext, useMemo } from 'react';
import type { PanelQuery, QueryResult, ResolveContext } from '@agnetos/contracts';
import { useEndpoint } from '@/components/shell/useEndpoint';
import {
  parseRunsPayload,
  resolveQuery,
  RUNS_NOT_BUILT,
  RUNS_OFFLINE,
  RUNS_PATH,
  type RunsBundle,
} from './resolve';

export type QueryState = QueryResult & { loading: boolean };

const DashboardQueryContext = createContext<{
  range?: string;
  segment?: string;
  runs: RunsBundle | null;
  runsLoading: boolean;
  runsMessage?: string;
} | null>(null);

export function DashboardQueryProvider({
  range,
  segment,
  children,
}: {
  range?: string;
  segment?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const resource = useEndpoint<RunsBundle>(RUNS_PATH, {
    intervalMs: 60_000,
    parse: parseRunsPayload,
    notBuiltMessage: RUNS_NOT_BUILT,
    offlineMessage: RUNS_OFFLINE,
  });

  const value = useMemo(() => {
    if (resource.state === 'ready') {
      return { range, segment, runs: resource.data, runsLoading: false };
    }
    if (resource.state === 'loading') {
      return { range, segment, runs: null, runsLoading: true };
    }
    return {
      range,
      segment,
      runs: null,
      runsLoading: false,
      runsMessage: resource.message,
    };
  }, [range, segment, resource]);

  return <DashboardQueryContext.Provider value={value}>{children}</DashboardQueryContext.Provider>;
}

export function useResolved(query: PanelQuery): QueryState {
  const ctx = useContext(DashboardQueryContext);
  const resolveCtx: ResolveContext = { range: ctx?.range, segment: ctx?.segment };

  if (query.source === 'sql') {
    return { ...resolveQuery(query, null, resolveCtx), loading: false };
  }
  if (query.source === 'static') {
    return { ...resolveQuery(query, null, resolveCtx), loading: false };
  }

  if (!ctx || ctx.runsLoading) {
    return { status: 'empty', loading: true };
  }
  if (!ctx.runs) {
    return {
      status: 'unavailable',
      message: ctx.runsMessage ?? RUNS_OFFLINE,
      loading: false,
    };
  }
  return { ...resolveQuery(query, ctx.runs, resolveCtx), loading: false };
}
