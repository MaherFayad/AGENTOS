'use client';

import { useMemo } from 'react';
import type { SearchItem } from '../../lib/search';
import { RUNNER_ROUTES, projectPath } from '@agnetos/contracts';
import { useEndpoint, type Resource } from './useEndpoint';
import { withProject } from './route';

/**
 * The searchable universe, built from the same source every view projects: the graph
 * payload (`GET /api/graph`, contracts/graph-layout.md) and the panel list
 * (`GET /api/panels`, contracts/panel-schema.md). Frontmatter is the single source of
 * truth (standing rule 4) — the shell keeps no list of its own.
 *
 * Structural types, not imported ones: `packages/contracts` is owned by another agent
 * and does not exist yet. Every field below is read defensively, so a payload that
 * drifts degrades to "nothing indexed" rather than a crash in the top bar.
 *
 * ---
 *
 * ## Project scope (M15, `Plan §23.10`)
 *
 * Search is the accessibility path into a canvas galaxy, and under a cascade the same
 * `(department, slug)` in two projects is **two different agents** with two histories
 * (ADR-014 §2). An index that quietly spanned projects would offer to fly the map to a
 * node that is not on the map you are looking at.
 *
 * So both reads are project-scoped, at the paths `packages/contracts` fixes rather than
 * at strings typed here. **There is deliberately no fallback to the pre-project spelling.**
 * `/api/graph` and `/api/panels` are still mounted and now answer 400
 * `project_scope_missing` — kept, per `LEGACY_UNSCOPED_PATHS`, *"so the migration is
 * visible… instead of silently reading whatever a default would have picked."* Calling
 * them anyway would convert that deliberate 400 into a shrug. When there is no project
 * there is no index, and the search panel says which of the two it is.
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

function parseGraph(json: unknown, project: string | null): GraphIndex | null {
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
      href: withProject(`/map/${department.id}`, project),
    })),
    ...nodes.map((node) => ({
      id: node.id,
      kind: 'agent' as const,
      label: node.label,
      description: node.description,
      department: node.department,
      href: withProject(
        node.department ? `/map/${node.department}/${node.id.split('/').pop()}` : '/map',
        project,
      ),
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

function parsePanels(json: unknown, project: string | null): SearchItem[] | null {
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
      href: withProject(`/dashboards/${id}`, project),
    });
  }
  return items;
}

const GRAPH_INTERVAL_MS = 60_000;

/**
 * The project-scoped API URL for a route template, or `null` when there is no project to
 * scope to — which is *"do not ask"*, not *"ask the wide one"*.
 *
 * `projectPath` is `packages/contracts`' own helper and it **throws** on a slug that is
 * not a slug, so a bad segment in the address bar cannot become a request. Catching it
 * here rather than letting it escape keeps the top bar rendering: a malformed URL is a
 * reason to stop asking, not a reason to white-screen the shell.
 */
export function projectApiUrl(template: string, project: string | null): string | null {
  if (project === null) return null;
  try {
    return projectPath(template, project);
  } catch {
    return null;
  }
}

/** Printed wherever an index or a figure is missing because the URL named no project. */
export const NO_PROJECT_SENTENCE =
  'This address does not name a project, and every data route now belongs to one. ' +
  'Open it from the project switcher and this fills in.';

/** The agent/department half of the index, plus the live counts. */
export function useGraphIndex(project: string | null): Resource<GraphIndex> {
  return useEndpoint<GraphIndex>(projectApiUrl(RUNNER_ROUTES.graph.path, project), {
    intervalMs: GRAPH_INTERVAL_MS,
    noTargetMessage: NO_PROJECT_SENTENCE,
    parse: (json) => parseGraph(json, project),
    notBuiltMessage:
      "The map hasn't been built yet, so there's nothing to search. Run the graph precompute and the agents will show up here.",
    // Distinct from the line above on purpose: a route that answers is not a route that
    // is missing, and telling someone to run the precompute when it has already run sends
    // them to fix the wrong thing (see useEndpoint's note).
    malformedMessage:
      "The map answered with a payload this build doesn't understand, so search has nothing to look through. The graph and this app are out of step — that is a bug here, not a missing map.",
    offlineMessage:
      "Can't reach the runner, so search has nothing to look through. This box may be off the tailnet.",
  });
}

/** The dashboards half. Empty on non-dashboard views is fine — it is one small fetch. */
export function usePanelIndex(project: string | null): Resource<SearchItem[]> {
  return useEndpoint<SearchItem[]>(projectApiUrl(RUNNER_ROUTES.panels.path, project), {
    intervalMs: GRAPH_INTERVAL_MS,
    noTargetMessage: NO_PROJECT_SENTENCE,
    parse: (json) => parsePanels(json, project),
    notBuiltMessage: 'No dashboards are defined yet. Add a panels/*.json file and it will be searchable.',
    malformedMessage:
      "The dashboard list came back in a shape this build doesn't understand, so none of it is searchable. That is a bug here, not an empty panels/ folder.",
    offlineMessage: "Can't reach the runner, so the dashboard list is unavailable.",
  });
}

/**
 * Whose agents these results are.
 *
 * `project` — the index came from this project's scoped routes.
 * `unscoped` — the URL named no project, so nothing was asked for and nothing is claimed.
 *
 * There is deliberately no third value. An earlier draft had `coordinator`, for an index
 * read from the pre-project routes and labelled as wider than the project — that state no
 * longer exists, because the contract removed the endpoint that would have produced it.
 * The narrower design is the stronger one: the shell cannot show you another project's
 * agents under this project's name, rather than showing them with a caveat.
 */
export type SearchScope = 'project' | 'unscoped';

export interface SearchIndex {
  items: SearchItem[];
  /** Present only when there is nothing (or not everything) to search, and it says why. */
  message: string | null;
  scope: SearchScope;
  /** The sentence the search panel prints when `scope` is not `project`, else `null`. */
  scopeMessage: string | null;
}

/** Merge both halves into the list the search pill queries. */
export function useSearchIndex(
  graph: Resource<GraphIndex>,
  panels: Resource<SearchItem[]>,
  project: string | null,
): SearchIndex {
  return useMemo(() => {
    const items: SearchItem[] = [];
    if (graph.state === 'ready') items.push(...graph.data.items);
    if (panels.state === 'ready') items.push(...panels.data);

    const scope: SearchScope = project === null ? 'unscoped' : 'project';
    const scopeMessage = scope === 'unscoped' ? NO_PROJECT_SENTENCE : null;

    if (items.length > 0) return { items, message: null, scope, scopeMessage };
    if (graph.state === 'loading' || panels.state === 'loading')
      return { items, message: null, scope, scopeMessage };
    const message =
      graph.state === 'unavailable'
        ? graph.message
        : panels.state === 'unavailable'
          ? panels.message
          : 'Nothing is indexed yet.';
    return { items, message, scope, scopeMessage };
  }, [graph, panels, project]);
}
