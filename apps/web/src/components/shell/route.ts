/**
 * URL ⇄ shell state. Spec §2.0 (the four tabs) plus the routing rule from the build
 * brief: the URL reflects state so a phone can be handed a link and the back button
 * behaves.
 *
 * The fourth tab is **THREADS** as of M16 (`Plan §23.5`, `Plan §23.8`). It replaced
 * SESSIONS in the slot; §3.1's `/sessions` paths survive underneath it. See
 * `MAX_SEGMENTED_TABS` and `SESSIONS_PATH` for both halves of that.
 *
 * Pure functions only — the whole of the shell's routing logic is testable without a
 * router.
 *
 * ---
 *
 * ## The project segment (M15 / `Plan §9`, `Plan §23.10`)
 *
 * Every view path is prefixed with `/p/:project`:
 *
 *   /p/agentos/map · /p/agentos/map/sales · /p/agentos/map/sales/account-enrichment
 *   /p/agentos/chart/sales · /p/agentos/dashboards/pipeline
 *   /p/agentos/threads · /p/agentos/threads/<uuid> · /p/agentos/sessions/abc
 *
 * The shape is copied from the API deliberately, not invented here.
 * `packages/contracts/src/project.ts` fixes `/api/p/:project/…` and says why in one
 * sentence — *"a request names its project in its path, and there is no default"* — and
 * the UI has the same failure mode the API does: a link handed to a phone that does not
 * say which project it is about will render **some** project's data under a name the
 * reader supplies from memory. One shape, one grep, one mental model.
 *
 * **`project` is nullable, and that is not a default.** A path with no `/p/` segment
 * parses to `project: null`, which means *this URL does not say*. Nothing in the shell
 * substitutes a value for it: `app/(views)/[...legacy]/page.tsx` asks the coordinator
 * which project it mounts and rewrites the URL to name it, and if the coordinator cannot
 * be reached it says so rather than picking. A `null` that silently became `'agentos'`
 * here would be exactly the ambient default the API contract refuses.
 */

import { isProjectSlug } from '@agnetos/contracts';

export type ShellView = 'map' | 'dashboards' | 'chart' | 'threads';

/**
 * Tab order is the spec's, with our fourth appended (§2.0). The fourth slot was
 * `SESSIONS` (§3.1) until M16; it is `THREADS` now (`Plan §23.8` — *"THREADS — replaces
 * SESSIONS"*). A **replacement**, never a fifth tab: see `MAX_SEGMENTED_TABS`.
 */
export const VIEWS: readonly ShellView[] = ['map', 'dashboards', 'chart', 'threads'];

export const VIEW_LABELS: Readonly<Record<ShellView, string>> = {
  map: 'MAP',
  dashboards: 'DASHBOARDS',
  chart: 'CHART',
  threads: 'THREADS',
};

/**
 * **The shell cannot hold six tabs** (`Plan §23.5`). This is the number, and
 * `route.test.ts` fails the build on a fifth.
 *
 * §23.5 measured it rather than asserting it: `ViewTabs` renders wide-tracked 11px caps at
 * `+0.25em`, four labels come to ~400px, and `TopBar` already reflows to two rows below
 * `sm` to fit them. Part Two adds BOARD and CALENDAR and renames SESSIONS to THREADS —
 * six labels, ~600px, and the bar breaks. Of the three ways out, §23.5 takes the third:
 *
 * > The segmented control keeps the four **spatial** views — places you *look at the org*.
 * > THREADS and CALENDAR are **temporal** and belong in the right cluster of the top bar
 * > as a persistent pair with counts, next to `+ New`.
 *
 * So the end state is `MAP · CHART · DASHBOARDS · BOARD` in here, with THREADS moved out.
 * Neither BOARD nor CALENDAR exists yet, so M16 spends the slot SESSIONS was occupying and
 * the count never moves. **The day BOARD lands, THREADS leaves this array rather than
 * BOARD joining it** — that migration is the reason this constant is a gate and not a
 * comment. A rule that names no enforcer enforces nothing.
 */
export const MAX_SEGMENTED_TABS = 4;

/**
 * `/sessions` is a path under the THREADS tab, not a view of its own (M16, `Plan §23.8`).
 *
 * §3.1's two session routes are still live and still render `SessionView` — see
 * `parseShellRoute`. They keep their own path because a **relay session id is not an
 * `ops.thread` uuid** (`contracts/thread-model.md` §5.1; §9.1 is still OPEN), so
 * rewriting `/sessions/abc` to `/threads/abc` would resolve to a thread that does not
 * exist. A dead route that still resolves is worse than one that 404s.
 */
const SESSIONS_PATH = 'sessions';

export interface ShellRoute {
  /**
   * The `/p/:project` segment, or `null` when the URL does not name a project.
   *
   * `null` is a *question*, never a default. Read `ShellState.project` for what the
   * coordinator says about it; read this only for what the URL says.
   */
  project: string | null;
  view: ShellView;
  /** `/map/:department`, `/chart/:department` — null on the galaxy/all view. */
  department: string | null;
  /** `/map/:department/:agent` — the drawer is open on this agent (§2.3). */
  agent: string | null;
  /** `/dashboards/:id` (§2.5). */
  panel: string | null;
  /** `/threads/:id` — an `ops.thread` uuid (`thread-model.md` §5.1). */
  thread: string | null;
  /**
   * `/sessions/:id` — a **relay** session id (§3.1), which is a different namespace from
   * `thread`. Two fields rather than one on purpose: an id that means two things is how a
   * link lands on somebody else's record, and §9.1 of `thread-model.md` — *do session
   * threads get a mailbox* — is open, so nothing may assume the two ever merge.
   */
  session: string | null;
  /** True when a breadcrumb strip should be shown — i.e. we are inside something. */
  isDrillIn: boolean;
}

const EMPTY: Omit<ShellRoute, 'view' | 'isDrillIn' | 'project'> = {
  department: null,
  agent: null,
  panel: null,
  thread: null,
  session: null,
};

/** The URL namespace the project segment lives in — mirrors `/api/p/:project`. */
export const PROJECT_SEGMENT = 'p';

/**
 * Split a pathname into its project segment and the view path underneath it.
 *
 * A leading `/p/<slug>` is consumed **only** when `<slug>` is a legal project slug per
 * `packages/contracts` — the same predicate the runner applies, so the shell and the
 * coordinator cannot disagree about what a project id looks like. `p`, `all` and `api`
 * are reserved there, so `/p/all/map` cannot be mistaken for a project called `all`.
 */
export function splitProject(pathname: string): { project: string | null; rest: string[] } {
  const segments = pathname.split('/').filter(Boolean);
  if (segments[0] === PROJECT_SEGMENT && segments[1] !== undefined && isProjectSlug(segments[1])) {
    return { project: segments[1], rest: segments.slice(2) };
  }
  return { project: null, rest: segments };
}

/** `/` and anything unrecognised resolve to MAP — the product's home (§2.1). */
export function parseShellRoute(pathname: string): ShellRoute {
  const { project, rest } = splitProject(pathname);
  const [head, second, third] = rest;

  // `/sessions` and `/sessions/:id` are paths *under* THREADS (`Plan §23.8`), so the tab
  // bar lights THREADS while you are on a session. Without this they would fall through
  // to the `map` default below and the shell would claim you were somewhere you are not —
  // and that is the state every already-delivered push notification deep-links into
  // (`sessions/push/payload.ts`, §3.6).
  if (head === SESSIONS_PATH) {
    return {
      ...EMPTY,
      project,
      view: 'threads',
      session: second ?? null,
      isDrillIn: Boolean(second),
    };
  }

  const view: ShellView = VIEWS.includes(head as ShellView) ? (head as ShellView) : 'map';

  switch (view) {
    case 'map':
      return {
        ...EMPTY,
        project,
        view,
        department: second ?? null,
        agent: third ?? null,
        isDrillIn: Boolean(second),
      };
    case 'chart':
      return { ...EMPTY, project, view, department: second ?? null, isDrillIn: Boolean(second) };
    case 'dashboards':
      return { ...EMPTY, project, view, panel: second ?? null, isDrillIn: Boolean(second) };
    case 'threads':
      return { ...EMPTY, project, view, thread: second ?? null, isDrillIn: Boolean(second) };
  }
}

/**
 * `/p/agentos` — or `''` when the project is unknown.
 *
 * The empty string is what makes every href builder below degrade to the pre-project
 * shape on a legacy URL rather than emit `/p/null/map`. A link built while the project is
 * unknown stays honest: it does not claim a project it cannot name.
 */
export function projectPrefix(project: string | null): string {
  return project === null ? '' : `/${PROJECT_SEGMENT}/${project}`;
}

/** Put an existing view path under a project. `withProject('/map/sales', 'clientx')`. */
export function withProject(path: string, project: string | null): string {
  return `${projectPrefix(project)}${path}`;
}

export function viewHref(view: ShellView, project: string | null = null): string {
  return withProject(`/${view}`, project);
}

/**
 * Where the switcher sends you when you pick a different project.
 *
 * **The view and the department survive; the agent, the panel and the session do not.**
 * That is `project-scoping.md` invariant 6 turned into a navigation rule — *"the shape is
 * shared; the roster is not. Every project gets the same departments so navigation
 * transfers instantly. Sales-in-AgentOS and Sales-in-ClientX are different rosters in an
 * identical frame."* Carrying `account-enrichment` across would land on a node that very
 * probably does not exist in the destination, and — worse under ADR-014 §2 — one that
 * *does* exist there is a **different agent** with a different history. A 404 you caused
 * by switching is a bad welcome; a same-named different agent is the bug class with no
 * error message (§21 risk 9).
 *
 * Panels are dropped for a weaker but sufficient reason: whether `panels/*.json` cascade
 * at all is `project-scoping.md` Q8, still open. Landing on a panel id that may or may
 * not be a per-project concept is a guess, and the carousel is one keystroke away.
 */
export function switchProjectHref(route: ShellRoute, project: string): string {
  const base = `/${PROJECT_SEGMENT}/${project}/${route.view}`;
  const keepsDepartment = route.view === 'map' || route.view === 'chart';
  return keepsDepartment && route.department ? `${base}/${route.department}` : base;
}

/**
 * Placeholder text for the search pill, per §2.0: "Search jobs" on MAP/CHART,
 * "Search panels" on DASHBOARDS. THREADS is ours, so it gets the same grammar.
 */
export function searchPlaceholder(view: ShellView): string {
  switch (view) {
    case 'dashboards':
      return 'Search panels';
    case 'threads':
      return 'Search threads';
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
  const p = route.project;
  switch (route.view) {
    case 'map':
      // From an open drawer, back goes to the department; from a department, to the galaxy.
      return route.agent
        ? { label: 'ALL JOBS', href: withProject(`/map/${route.department}`, p) }
        : { label: 'ALL DEPARTMENTS', href: withProject('/map', p) };
    case 'chart':
      return { label: 'ALL DEPARTMENTS', href: withProject('/chart', p) };
    case 'dashboards':
      return { label: 'ALL DASHBOARDS', href: withProject('/dashboards', p) };
    case 'threads':
      // One label for both id namespaces: from a session as much as from a thread, "up"
      // is the thread list, because THREADS is the tab you are in either way.
      return { label: 'ALL THREADS', href: withProject('/threads', p) };
  }
}

/**
 * The `AgentOS › Sales › account-enrichment` trail (`Plan §23.10`).
 *
 * Returned as data rather than markup so the ordering can be asserted without a DOM and
 * so RTL gets the separator from the renderer rather than from a string (§1.4: a `›`
 * baked into copy points the wrong way in Arabic).
 *
 * The head crumb is **only ever the project the URL names**, never the coordinator's
 * mounted project: a trail is a statement about where you are, and inventing the head
 * from configuration is how "a configured value is read as an observed one" reaches the
 * one place in the shell a reader trusts absolutely.
 */
export interface ProjectTrail {
  /** Project slug, or `null` when the URL does not name one. */
  project: string | null;
  /** Department slug, when the route has one. */
  department: string | null;
  /** The leaf — an agent slug, a panel id, a thread id or a session id. */
  leaf: string | null;
}

export function projectTrail(route: ShellRoute): ProjectTrail {
  return {
    project: route.project,
    department: route.department,
    leaf: route.agent ?? route.panel ?? route.thread ?? route.session,
  };
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
