'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';
import { emit, on } from '../../lib/shell-bus';
import { parseShellRoute, type ShellRoute } from './route';
import { useGraphIndex, usePanelIndex, useSearchIndex, type DepartmentCounts, type SearchIndex } from './useSearchIndex';
import type { Resource } from './useEndpoint';
import type { GraphIndex } from './useSearchIndex';

/** True when the OS asks for less motion (§1.6). Read once, then live-updated. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(query.matches);
    const listener = (event: MediaQueryListEvent): void => setReduced(event.matches);
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
  }, []);
  return reduced;
}

export interface ShellState {
  route: ShellRoute;
  /** Camera scale reported by the canvas; `null` until a canvas reports one. */
  zoom: number | null;
  /** `YOUR TREE` filter — installed/live agents only (§2.2). */
  yourTree: boolean;
  toggleYourTree: () => void;
  /** Real live/total for the current scope, or `null` when nothing real is known. */
  liveCounts: DepartmentCounts | null;
  /** Why `liveCounts` is null, in a sentence, or null when we have numbers. */
  liveCountsMessage: string | null;
  search: SearchIndex;
  reducedMotion: boolean;
  helpOpen: boolean;
  setHelpOpen: (open: boolean) => void;
}

const ShellContext = createContext<ShellState | null>(null);

export function useShell(): ShellState {
  const state = useContext(ShellContext);
  if (state === null) throw new Error('useShell must be used inside <ShellProvider>');
  return state;
}

function liveCountsFor(
  graph: Resource<GraphIndex>,
  override: { department: string | null; counts: DepartmentCounts } | null,
  department: string | null,
): { counts: DepartmentCounts | null; message: string | null } {
  // A canvas that reports its own counts wins: it knows about client-side filtering.
  if (override && override.department === department) return { counts: override.counts, message: null };
  if (graph.state === 'ready') {
    const counts = department === null ? graph.data.all : (graph.data.counts.get(department) ?? null);
    return counts
      ? { counts, message: null }
      : {
          counts: null,
          message: 'No agent has reported a run yet, so there is no live count to show.',
        };
  }
  if (graph.state === 'unavailable') return { counts: null, message: graph.message };
  return { counts: null, message: null };
}

export function ShellProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const pathname = usePathname() ?? '/map';
  const route = useMemo(() => parseShellRoute(pathname), [pathname]);

  const graph = useGraphIndex();
  const panels = usePanelIndex();
  const search = useSearchIndex(graph, panels);
  const reducedMotion = usePrefersReducedMotion();

  const [zoom, setZoom] = useState<number | null>(null);
  const [yourTree, setYourTree] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [reported, setReported] = useState<{ department: string | null; counts: DepartmentCounts } | null>(null);

  useEffect(() => on('shell:zoomChanged', ({ level }) => setZoom(level)), []);
  useEffect(
    () =>
      on('shell:liveCount', ({ department, live, total }) =>
        setReported({ department, counts: { live, total } }),
      ),
    [],
  );

  // A canvas that goes away should not leave its zoom readout behind.
  useEffect(() => setZoom(null), [route.view]);

  const toggleYourTree = useCallback(() => {
    setYourTree((current) => {
      const next = !current;
      emit('shell:yourTree', { enabled: next });
      return next;
    });
  }, []);

  const { counts, message } = liveCountsFor(graph, reported, route.department);

  const value = useMemo<ShellState>(
    () => ({
      route,
      zoom,
      yourTree,
      toggleYourTree,
      liveCounts: counts,
      liveCountsMessage: message,
      search,
      reducedMotion,
      helpOpen,
      setHelpOpen,
    }),
    [route, zoom, yourTree, toggleYourTree, counts, message, search, reducedMotion, helpOpen],
  );

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}
