'use client';

import { useMemo } from 'react';
import type { SearchItem } from '../../lib/search';
import { useEndpoint, type Resource } from './useEndpoint';

/**
 * The searchable universe, built from the same source every view projects: the graph
 * payload (`GET /api/graph`, contracts/graph-layout.md) and the panel list
 * (`GET /api/panels`, contracts/panel-schema.md). Frontmatter is the single source of
 * truth (standing rule 4) — the shell keeps no list of its own.
 *
 * Structural types, not imported ones: `packages/contracts` is owned by another agent
 * and does not exist yet. Every field below is read defensively, so a payload that
 * drifts degrades to "nothing indexed" rather than a crash in the top bar.
 */

interface GraphNodeLike {
  id: string;
  label: string;
  department?: string;
  description?: string;
  status?: string;
}

interface GraphDepartmentLike {
  id: string;
  label: string;
  liveCount?: number;
  totalCount?: number;
  sublabels?: string[];
}

export interface DepartmentCounts {
  live: number;
  total: number;
}

export interface GraphIndex {
  items: SearchItem[];
  /** Per-department live/total for the `N OF 22 LIVE` counter (§2.2). Real, or absent. */
  counts: Map<string, DepartmentCounts>;
  /** Sum across departments, for the galaxy view. */
  all: DepartmentCounts | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const str = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

const num = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

function parseGraph(json: unknown): GraphIndex | null {
  if (!isRecord(json)) return null;
  const rawNodes = Array.isArray(json.nodes) ? json.nodes : null;
  const rawDepartments = Array.isArray(json.departments) ? json.departments : [];
  if (rawNodes === null) return null;

  const nodes: GraphNodeLike[] = [];
  for (const raw of rawNodes) {
    if (!isRecord(raw)) continue;
    const id = str(raw.id);
    const label = str(raw.label);
    if (!id || !label) continue;
    nodes.push({
      id,
      label,
      department: str(raw.department),
      description: str(raw.description),
      status: str(raw.status),
    });
  }

  const departments: GraphDepartmentLike[] = [];
  for (const raw of rawDepartments) {
    if (!isRecord(raw)) continue;
    const id = str(raw.id);
    const label = str(raw.label);
    if (!id || !label) continue;
    departments.push({
      id,
      label,
      liveCount: num(raw.liveCount),
      totalCount: num(raw.totalCount),
      sublabels: Array.isArray(raw.sublabels) ? raw.sublabels.filter((s): s is string => typeof s === 'string') : undefined,
    });
  }

  const items: SearchItem[] = [
    ...departments.map((department) => ({
      id: department.id,
      kind: 'department' as const,
      label: department.label,
      description: department.sublabels?.join(' · '),
      department: department.id,
      href: `/map/${department.id}`,
    })),
    ...nodes.map((node) => ({
      id: node.id,
      kind: 'agent' as const,
      label: node.label,
      description: node.description,
      department: node.department,
      href: node.department ? `/map/${node.department}/${node.id.split('/').pop()}` : '/map',
      live: node.status === 'live',
    })),
  ];

  const counts = new Map<string, DepartmentCounts>();
  for (const department of departments) {
    if (department.liveCount === undefined || department.totalCount === undefined) continue;
    counts.set(department.id, { live: department.liveCount, total: department.totalCount });
  }

  const all =
    counts.size === 0
      ? null
      : [...counts.values()].reduce(
          (total, entry) => ({ live: total.live + entry.live, total: total.total + entry.total }),
          { live: 0, total: 0 },
        );

  return { items, counts, all };
}

function parsePanels(json: unknown): SearchItem[] | null {
  const list = Array.isArray(json) ? json : isRecord(json) && Array.isArray(json.panels) ? json.panels : null;
  if (list === null) return null;
  const items: SearchItem[] = [];
  for (const raw of list) {
    if (!isRecord(raw)) continue;
    const id = str(raw.id);
    const title = str(raw.title);
    if (!id || !title) continue;
    items.push({
      id,
      kind: 'panel',
      label: title,
      description: str(raw.subtitle) ?? str(raw.provider),
      href: `/dashboards/${id}`,
    });
  }
  return items;
}

const GRAPH_INTERVAL_MS = 60_000;

/** The agent/department half of the index, plus the live counts. */
export function useGraphIndex(): Resource<GraphIndex> {
  return useEndpoint<GraphIndex>('/api/graph', {
    intervalMs: GRAPH_INTERVAL_MS,
    parse: parseGraph,
    notBuiltMessage:
      "The map hasn't been built yet, so there's nothing to search. Run the graph precompute and the agents will show up here.",
    offlineMessage:
      "Can't reach the runner, so search has nothing to look through. This box may be off the tailnet.",
  });
}

/** The dashboards half. Empty on non-dashboard views is fine — it is one small fetch. */
export function usePanelIndex(): Resource<SearchItem[]> {
  return useEndpoint<SearchItem[]>('/api/panels', {
    intervalMs: GRAPH_INTERVAL_MS,
    parse: parsePanels,
    notBuiltMessage: 'No dashboards are defined yet. Add a panels/*.json file and it will be searchable.',
    offlineMessage: "Can't reach the runner, so the dashboard list is unavailable.",
  });
}

export interface SearchIndex {
  items: SearchItem[];
  /** Present only when there is nothing (or not everything) to search, and it says why. */
  message: string | null;
}

/** Merge both halves into the list the search pill queries. */
export function useSearchIndex(graph: Resource<GraphIndex>, panels: Resource<SearchItem[]>): SearchIndex {
  return useMemo(() => {
    const items: SearchItem[] = [];
    if (graph.state === 'ready') items.push(...graph.data.items);
    if (panels.state === 'ready') items.push(...panels.data);

    if (items.length > 0) return { items, message: null };
    if (graph.state === 'loading' || panels.state === 'loading') return { items, message: null };
    const message =
      graph.state === 'unavailable'
        ? graph.message
        : panels.state === 'unavailable'
          ? panels.message
          : 'Nothing is indexed yet.';
    return { items, message };
  }, [graph, panels]);
}
