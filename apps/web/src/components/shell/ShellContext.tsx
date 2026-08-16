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
import { useReducedMotion } from '../primitives/motion';
import { parseShellRoute, type ShellRoute } from './route';
import { useGraphIndex, usePanelIndex, useSearchIndex, type DepartmentCounts, type SearchIndex } from './useSearchIndex';
import { useProjectScope, useProjectsEndpoint, type ProjectScope, type ProjectsReading } from './useProjects';
import type { Resource } from './useEndpoint';
import type { GraphIndex } from './useSearchIndex';

/**
 * True when the OS asks for less motion (§1.6).
 *
 * A thin alias over the guardian's `useReducedMotion`, kept only because the shell's
 * public surface (`components/shell/index.ts`) already exports this name. The
 * hand-rolled `useState` + `useEffect` version this replaced was a second
 * implementation of a §1.6 rule, and a worse one: it read `window.matchMedia`
 * unguarded (so it threw outright in any environment without it, jsdom included) and
 * had no `addListener` fallback for Safari < 14.
 *
 * Imported from `../primitives/motion` rather than from `./ui`, deliberately: `./ui` is
 * the shell's *component* import site and the shell's tests replace it wholesale, so a
 * behavioural hook routed through it would be silently stubbed out.
 */
export function usePrefersReducedMotion(): boolean {
  return useReducedMotion();
}

export interface ShellState {
  route: ShellRoute;
  /**
   * Which project the shell is showing, and how sure it is (M15, `Plan §9`).
   *
   * Read this rather than `route.project` whenever the answer is going to be *displayed*:
   * `route.project` is what the URL says, `project` is what the URL says **plus what the
   * coordinator was willing to confirm about it**, and those are different claims. The
   * cost ticker, the breadcrumb and the switcher all need the second one.
   */
  project: ProjectScope;
  /** The raw `GET /api/projects` read, for surfaces that need the failure sentence. */
  projects: Resource<ProjectsReading>;
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

  const projects = useProjectsEndpoint();
  const project = useProjectScope(route.project, projects);

  // Both index reads are project-scoped: the searchable universe is one project's
  // resolved library (ADR-014 §2 — the same `(department, slug)` in two projects is two
  // agents), so a search index that spans projects would offer to fly the map to a node
  // that is not on it.
  const graph = useGraphIndex(route.project);
  const panels = usePanelIndex(route.project);
  const search = useSearchIndex(graph, panels, route.project);
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
      project,
      projects,
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
    [route, project, projects, zoom, yourTree, toggleYourTree, counts, message, search, reducedMotion, helpOpen],
  );

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}
