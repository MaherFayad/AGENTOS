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
 * Routing an `activity-feed`'s `shape: "list"` to the activity route and a `data-table`'s
 * to the runs route needs the widget type, which only the panel walk can see. Keying plans
 * by the query object's identity carries that decision to `useResolved` without threading
 * a prop through five components. Panel objects are loaded once and never rewritten, so
 * the identity holds.
 *
 * WHERE THE PROJECT COMES FROM (M15, ADR-015)
 *
 * `useProjectSegment()`, not `useShell()`. The shell hook throws outside its provider, and
 * `DashboardQueryProvider` is rendered by `DashboardDetail`, whose own tests mount it
 * without the shell around it. The segment hook needs only `next/navigation`, which this
 * subtree already uses — the same reasoning `useProjectHref`'s header gives, one hook over.
 *
 * The project is read **here**, once, and handed to every plan. Widgets never see it: a
 * widget that could name a project could name the wrong one.
 *
 * Owner: dashboards-engineer · Spec §2.5, §3.5
 */

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Panel, PanelQuery, ResolveContext } from '@agnetos/contracts';
import { DEPARTMENT_SLUGS } from '@agnetos/contracts';
import { useProjectSegment } from '@/components/shell/useProjectHref';
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

/**
 * The sentence a 4xx gets. It names the status, because that is the one fact a reader can
 * act on, and it says **refused** rather than unreachable — the distinction the old shared
 * `METRICS_OFFLINE` string erased when it told six dashboards to blame the tailnet for a
 * bug in a query string.
 *
 * Deliberately one clause. An earlier draft added *"the runner is reachable — this is a
 * fault in what was asked for"*, which was true and which `check-rtl` correctly counted as
 * a fourth uncatalogued string in `dashboards/data`. The word "refused" already carries it,
 * and the honest way to not raise the RTL ratchet is to write less copy rather than to
 * raise the baseline for a sentence that was not earning its place.
 */
export const metricsRefused = (status: number): string =>
  `The runner refused this request (HTTP ${status}), so the figure is withheld rather than guessed.`;

interface DashboardQueryValue {
  range?: string;
  segment?: string;
  /** The project every URL in `store` was scoped to, or `null` when none was asked for. */
  project: string | null;
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
    // `thread-feed` reads the same activity plane and then groups by `threadId` — a thread
    // is a filter on the run plane, not a plane of its own (ADR-028), so there is no third
    // intent and no fourth spelling of "runs".
    const wantsSentences = widget.type === 'activity-feed' || widget.type === 'thread-feed';
    add(widget.query, wantsSentences ? 'activity' : 'default');
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
    // A 4xx is this client's fault and a 5xx is the runner's, and they used to arrive at
    // the same sentence — which is how "every dashboard is asking an unscoped route" read
    // for a whole milestone as "this box may be off the tailnet". `endpoints.ts` can no
    // longer build an unscoped URL, so a 4xx here means something new; it must not inherit
    // the old diagnosis. Sending someone to check their network for a bug in a query
    // string is worse than saying less.
    if (response.status >= 400 && response.status < 500) {
      return { state: 'unavailable', message: metricsRefused(response.status) };
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
  const project = useProjectSegment();

  const plans = useMemo(() => {
    const map = new Map<PanelQuery, Plan>();
    for (const { query, intent } of collectQueries(panel)) {
      if (query.source !== 'langfuse') continue;
      const bound = range ? bindRange(query, range) : query;
      if (bound.source !== 'langfuse') continue;
      map.set(query, planLangfuse(bound, { intent, departments: DEPARTMENT_SLUGS, project }));
    }
    return map;
  }, [panel, range, project]);

  const urls = useMemo(() => {
    const seen = new Set<string>();
    for (const plan of plans.values()) for (const url of urlsOf(plan)) seen.add(url);
    return [...seen].sort();
  }, [plans]);

  const store = useUrlStore(urls);

  const value = useMemo<DashboardQueryValue>(
    () => ({ range, segment, project, plans, store }),
    [range, segment, project, plans, store],
  );

  return <DashboardQueryContext.Provider value={value}>{children}</DashboardQueryContext.Provider>;
}

/* ---------------------------------------------------------------------- hook */

export function useResolved(query: PanelQuery): QueryState {
  const ctx = useContext(DashboardQueryContext);
  const store = ctx?.store ?? EMPTY_STORE;
  // A URL the provider has *already asked for* reads as pending until it answers. A widget
  // rendered outside a provider has no project, so its plan is `unsupported` and it prints
  // the no-project sentence — it does not sit on a skeleton forever pretending a request
  // is in flight that nobody made.
  const read = (url: string): Entry => store.get(url) ?? PENDING;
  const resolveCtx: ResolveContext = { range: ctx?.range, segment: ctx?.segment };
  return resolveQuery(query, read, resolveCtx, ctx?.plans.get(query), {
    departments: DEPARTMENT_SLUGS,
    project: ctx?.project ?? null,
  });
}
