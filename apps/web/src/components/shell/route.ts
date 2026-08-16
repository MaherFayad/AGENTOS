/**
 * URL ⇄ shell state. Spec §2.0 (the four tabs) plus the routing rule from the build
 * brief: the URL reflects state so a phone can be handed a link and the back button
 * behaves.
 *
 * Pure functions only — the whole of the shell's routing logic is testable without a
 * router.
 */

export type ShellView = 'map' | 'dashboards' | 'chart' | 'sessions';

/** Tab order is the spec's, with SESSIONS appended as the fourth (§2.0, §3.1). */
export const VIEWS: readonly ShellView[] = ['map', 'dashboards', 'chart', 'sessions'];

export const VIEW_LABELS: Readonly<Record<ShellView, string>> = {
  map: 'MAP',
  dashboards: 'DASHBOARDS',
  chart: 'CHART',
  sessions: 'SESSIONS',
};

export interface ShellRoute {
  view: ShellView;
  /** `/map/:department`, `/chart/:department` — null on the galaxy/all view. */
  department: string | null;
  /** `/map/:department/:agent` — the drawer is open on this agent (§2.3). */
  agent: string | null;
  /** `/dashboards/:id` (§2.5). */
  panel: string | null;
  /** `/sessions/:id` (§3.1). */
  session: string | null;
  /** True when a breadcrumb strip should be shown — i.e. we are inside something. */
  isDrillIn: boolean;
}

const EMPTY: Omit<ShellRoute, 'view' | 'isDrillIn'> = {
  department: null,
  agent: null,
  panel: null,
  session: null,
};

/** `/` and anything unrecognised resolve to MAP — the product's home (§2.1). */
export function parseShellRoute(pathname: string): ShellRoute {
  const [head, second, third] = pathname.split('/').filter(Boolean);
  const view: ShellView = VIEWS.includes(head as ShellView) ? (head as ShellView) : 'map';

  switch (view) {
    case 'map':
      return {
        ...EMPTY,
        view,
        department: second ?? null,
        agent: third ?? null,
        isDrillIn: Boolean(second),
      };
    case 'chart':
      return { ...EMPTY, view, department: second ?? null, isDrillIn: Boolean(second) };
    case 'dashboards':
      return { ...EMPTY, view, panel: second ?? null, isDrillIn: Boolean(second) };
    case 'sessions':
      return { ...EMPTY, view, session: second ?? null, isDrillIn: Boolean(second) };
  }
}

export function viewHref(view: ShellView): string {
  return `/${view}`;
}

/**
 * Placeholder text for the search pill, per §2.0: "Search jobs" on MAP/CHART,
 * "Search panels" on DASHBOARDS. SESSIONS is ours, so it gets the same grammar.
 */
export function searchPlaceholder(view: ShellView): string {
  switch (view) {
    case 'dashboards':
      return 'Search panels';
    case 'sessions':
      return 'Search sessions';
    default:
      return 'Search jobs';
  }
}

export interface BreadcrumbConfig {
  /** The `← ALL DEPARTMENTS` label (§2.0) — `← ALL DASHBOARDS` inside a panel (§2.5.1). */
  label: string;
  href: string;
}

export function breadcrumbFor(route: ShellRoute): BreadcrumbConfig | null {
  if (!route.isDrillIn) return null;
  switch (route.view) {
    case 'map':
      // From an open drawer, back goes to the department; from a department, to the galaxy.
      return route.agent
        ? { label: 'ALL JOBS', href: `/map/${route.department}` }
        : { label: 'ALL DEPARTMENTS', href: '/map' };
    case 'chart':
      return { label: 'ALL DEPARTMENTS', href: '/chart' };
    case 'dashboards':
      return { label: 'ALL DASHBOARDS', href: '/dashboards' };
    case 'sessions':
      return { label: 'ALL SESSIONS', href: '/sessions' };
  }
}

/**
 * How a view relates to the chrome band — the §2.0 shell contract.
 *
 * `canvas` — the view paints edge to edge *under* the transparent bar on purpose.
 *   MAP's galaxy must be draggable from edge to edge; DASHBOARDS' carousel is an
 *   absolutely-positioned full-bleed composition. These views place their own
 *   content clear of the chrome using `var(--shell-inset-t/b)`.
 * `flow` — the view lays content out in document flow from the top. The shell
 *   reserves its own band for it, so the first row starts below the bar.
 *
 * **`flow` is the default, and that is the whole point.** The bug this replaced was
 * CHART rendering its department tabs on the same row as the search pill. Listing
 * the exceptions rather than the members means a view added tomorrow is safe on the
 * day it is added, and a view that wants to paint under the bar has to say so.
 */
export type ViewSurface = 'canvas' | 'flow';

const CANVAS_VIEWS: readonly ShellView[] = ['map', 'dashboards'];

export function viewSurface(view: ShellView): ViewSurface {
  return CANVAS_VIEWS.includes(view) ? 'canvas' : 'flow';
}

/** Zoom applies to the two canvas views only (contracts/graph-layout.md). */
export function viewHasZoom(view: ShellView): boolean {
  return view === 'map' || view === 'chart';
}

/** The counter in the breadcrumb strip is a map/chart concept (§2.2). */
export function viewHasLiveCounter(view: ShellView): boolean {
  return view === 'map' || view === 'chart';
}
