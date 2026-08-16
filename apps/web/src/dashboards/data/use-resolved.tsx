'use client';

/**
 * The dashboard's network layer: one poll cycle for the whole panel.
 *
 * The provider walks the panel once, turns every query into a `Plan`, collects the URLs
 * those plans need, and fetches that set. Widgets then read synchronously out of the
 * result map, so a malformed query cannot take its neighbours down and two tiles asking
 * the same question cost one request — Mission Control's six KPIs, three signals and five
 * widgets resolve from about ten URLs, several of which are shared (the Runs tile, its
 * delta chip and the department split all read the same `metric=runs&range=7d` response).
 *
 * WHY THE PLAN MAP IS KEYED BY THE QUERY OBJECT
 *
 * Routing an `activity-feed`'s `shape: "list"` to `/api/metrics/activity` and a
 * `data-table`'s to `/api/metrics/runs` needs the widget type, which only the panel walk
 * can see. Keying plans by the query object's identity carries that decision to
 * `useResolved` without threading a prop through five components. Panel objects are
 * loaded once and never rewritten, so the identity holds.
 *
 * Owner: dashboards-engineer · Spec §2.5, §3.5
 */

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Panel, PanelQuery, ResolveContext } from '@agnetos/contracts';
import { DEPARTMENT_SLUGS } from '@agnetos/contracts';
import {
  bindRange,
  METRICS_NOT_BUILT,
  METRICS_OFFLINE,
  planLangfuse,
  resolveQuery,
  urlsOf,
  type Entry,
  type ResolvedState,
} from './resolve';
import type { Plan, QueryIntent } from './endpoints';

export type QueryState = ResolvedState;

const POLL_MS = 60_000;

const EMPTY_STORE: ReadonlyMap<string, Entry> = new Map();
const PENDING: Entry = { state: 'loading' };

interface DashboardQueryValue {
  range?: string;
  segment?: string;
  plans: ReadonlyMap<PanelQuery, Plan>;
  store: ReadonlyMap<string, Entry>;
}

const DashboardQueryContext = createContext<DashboardQueryValue | null>(null);

/* ------------------------------------------------------------- the panel walk */

/** Every data-bearing query in a panel, paired with the intent its widget implies. */
export function collectQueries(panel: Panel): { query: PanelQuery; intent: QueryIntent }[] {
  const out: { query: PanelQuery; intent: QueryIntent }[] = [];
  const add = (query: PanelQuery | undefined, intent: QueryIntent = 'default'): void => {
    if (query) out.push({ query, intent });
  };
  for (const kpi of panel.kpis) {
    add(kpi.query);
    add(kpi.delta?.query);
    add(kpi.sparkline?.query);
  }
  for (const signal of panel.signals) add(signal.query);
  for (const widget of panel.widgets) {
    add(widget.query, widget.type === 'activity-feed' ? 'activity' : 'default');
  }
  return out;
}

/* ------------------------------------------------------------------ transport */

async function readOne(url: string, signal: AbortSignal): Promise<Entry | null> {
  try {
    const response = await fetch(url, { signal, headers: { accept: 'application/json' } });
    if (response.status === 404 || response.status === 501) {
      return { state: 'unavailable', message: METRICS_NOT_BUILT };
    }
    if (!response.ok) return { state: 'unavailable', message: METRICS_OFFLINE };
    return { state: 'ready', json: await response.json() };
  } catch (error) {
    if (signal.aborted || (error instanceof Error && error.name === 'AbortError')) return null;
    return { state: 'unavailable', message: METRICS_OFFLINE };
  }
}

/**
 * Poll a set of URLs. Deliberately not `useEndpoint` (that hook is one URL per hook and
 * this needs a variable set), and deliberately not SWR — a shared `Map` behind one
 * interval is the whole requirement.
 *
 * A URL that survives a range change keeps its previous value instead of flashing back to
 * a skeleton: re-reading `metric=runs&range=7d` should not blank the tile that already
 * shows it.
 */
function useUrlStore(urls: readonly string[]): ReadonlyMap<string, Entry> {
  const key = urls.join('\n');
  const [store, setStore] = useState<ReadonlyMap<string, Entry>>(EMPTY_STORE);

  useEffect(() => {
    const list = key === '' ? [] : key.split('\n');
    const controller = new AbortController();
    let cancelled = false;

    setStore((prev) => {
      const next = new Map<string, Entry>();
      for (const url of list) next.set(url, prev.get(url) ?? PENDING);
      return next;
    });

    const cycle = async (): Promise<void> => {
      const results = await Promise.all(list.map((url) => readOne(url, controller.signal)));
      if (cancelled) return;
      setStore((prev) => {
        const next = new Map(prev);
        list.forEach((url, i) => {
          const result = results[i];
          if (result) next.set(url, result);
        });
        return next;
      });
    };

    void cycle();

    const tick = (): void => {
      if (typeof document !== 'undefined' && document.hidden) return;
      void cycle();
    };
    const timer = setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('online', tick);

    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('online', tick);
    };
  }, [key]);

  return store;
}

/* ------------------------------------------------------------------ provider */

export function DashboardQueryProvider({
  panel,
  range,
  segment,
  children,
}: {
  panel: Panel;
  range?: string;
  segment?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const plans = useMemo(() => {
    const map = new Map<PanelQuery, Plan>();
    for (const { query, intent } of collectQueries(panel)) {
      if (query.source !== 'langfuse') continue;
      const bound = range ? bindRange(query, range) : query;
      if (bound.source !== 'langfuse') continue;
      map.set(query, planLangfuse(bound, { intent, departments: DEPARTMENT_SLUGS }));
    }
    return map;
  }, [panel, range]);

  const urls = useMemo(() => {
    const seen = new Set<string>();
    for (const plan of plans.values()) for (const url of urlsOf(plan)) seen.add(url);
    return [...seen].sort();
  }, [plans]);

  const store = useUrlStore(urls);

  const value = useMemo<DashboardQueryValue>(
    () => ({ range, segment, plans, store }),
    [range, segment, plans, store],
  );

  return <DashboardQueryContext.Provider value={value}>{children}</DashboardQueryContext.Provider>;
}

/* ---------------------------------------------------------------------- hook */

export function useResolved(query: PanelQuery): QueryState {
  const ctx = useContext(DashboardQueryContext);
  const store = ctx?.store ?? EMPTY_STORE;
  // A URL the provider has not asked for yet reads as pending, never as absent: outside a
  // provider (a widget rendered in isolation) every langfuse query is simply still loading.
  const read = (url: string): Entry => store.get(url) ?? PENDING;
  const resolveCtx: ResolveContext = { range: ctx?.range, segment: ctx?.segment };
  return resolveQuery(query, read, resolveCtx, ctx?.plans.get(query), {
    departments: DEPARTMENT_SLUGS,
  });
}
