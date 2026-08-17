import { describe, expect, it } from 'vitest';
import {
  breadcrumbFor,
  MAX_SEGMENTED_TABS,
  parseShellRoute,
  projectPrefix,
  projectTrail,
  searchPlaceholder,
  splitProject,
  switchProjectHref,
  VIEW_LABELS,
  VIEWS,
  viewHasLiveCounter,
  viewHasZoom,
  viewHref,
  viewSurface,
  withProject,
} from './route';

describe('parseShellRoute', () => {
  it('has exactly four views, THREADS fourth', () => {
    expect(VIEWS).toEqual(['map', 'dashboards', 'chart', 'threads']);
  });

  it('treats / as the map', () => {
    expect(parseShellRoute('/').view).toBe('map');
  });

  it('reads the department out of /map/:department', () => {
    const route = parseShellRoute('/map/sales');
    expect(route).toMatchObject({ view: 'map', department: 'sales', agent: null, isDrillIn: true });
  });

  it('reads an open drawer out of /map/:department/:agent', () => {
    const route = parseShellRoute('/map/sales/account-enrichment');
    expect(route).toMatchObject({ department: 'sales', agent: 'account-enrichment' });
  });

  it('reads /dashboards/:id and /chart/:department and /threads/:id', () => {
    expect(parseShellRoute('/dashboards/pipeline')).toMatchObject({ view: 'dashboards', panel: 'pipeline' });
    expect(parseShellRoute('/chart/marketing')).toMatchObject({ view: 'chart', department: 'marketing' });
    expect(parseShellRoute('/threads/3f9a')).toMatchObject({ view: 'threads', thread: '3f9a' });
  });

  it('falls back to the map for an unknown path', () => {
    expect(parseShellRoute('/nonsense').view).toBe('map');
    expect(parseShellRoute('/nonsense').isDrillIn).toBe(false);
  });

  it('builds tab hrefs', () => {
    expect(viewHref('threads')).toBe('/threads');
  });
});

/**
 * `Plan §23.5` — *"the shell cannot hold six tabs"*. The rule that made this slice a
 * replacement rather than an addition, made into something that can go red.
 *
 * A comment is not a mechanism: the last two times a rule in this repo named no enforcer
 * it was violated (`workspace` confinement, the duplicate barrel export). The next agent
 * to want a tab — BOARD in M17, CALENDAR in M18 — meets this test, not a paragraph, and
 * §23.5's answer for both of them is the top-right cluster.
 */
describe('the segmented control stays at four tabs (Plan §23.5)', () => {
  it('refuses a fifth view', () => {
    expect(VIEWS.length).toBeLessThanOrEqual(MAX_SEGMENTED_TABS);
  });

  it('keeps the label strip inside the width §23.5 measured', () => {
    // §23.5's argument is width, not count: four wide-tracked 11px caps at +0.25em come
    // to ~400px and `TopBar` reflows below `sm` to fit exactly that. Counting characters
    // is the cheap proxy — MAP·DASHBOARDS·CHART·SESSIONS was 27 and THREADS made it 26,
    // so M16 spent nothing. A five-tab bar fails the case above; a four-tab bar with a
    // label nobody measured fails this one.
    const glyphs = VIEWS.reduce((n, v) => n + VIEW_LABELS[v].length, 0);
    expect(glyphs).toBeLessThanOrEqual(27);
  });

  it('gives every view a label, so a tab can never render blank', () => {
    for (const view of VIEWS) expect(VIEW_LABELS[view]).toMatch(/^[A-Z]+$/);
  });
});

/**
 * M16 — THREADS replaced SESSIONS in the tab bar (`Plan §23.5`, `Plan §23.8`), and §3.1's
 * two session paths survive underneath it rather than being redirected or removed.
 */
describe('/sessions after the M16 tab change', () => {
  it('selects THREADS instead of falling through to the map', () => {
    // Without the alias, `/sessions/abc` — the path every already-delivered push
    // notification deep-links into (§3.6) — would parse to `map`, and the shell would
    // light a tab you are not on.
    expect(parseShellRoute('/p/agentos/sessions/abc123')).toMatchObject({
      view: 'threads',
      session: 'abc123',
      isDrillIn: true,
    });
    expect(parseShellRoute('/p/agentos/sessions')).toMatchObject({
      view: 'threads',
      session: null,
      isDrillIn: false,
    });
  });

  it('never lets a session id arrive as a thread id, or the reverse', () => {
    // The two namespaces are the reason `/sessions/:id` is not rewritten to
    // `/threads/:id`: a relay session id is not an `ops.thread` uuid
    // (`contracts/thread-model.md` §5.1, §9.1 open). One field each, so a URL cannot
    // acquire two readings.
    expect(parseShellRoute('/p/agentos/sessions/abc123').thread).toBeNull();
    expect(parseShellRoute('/p/agentos/threads/3f9a').session).toBeNull();
  });

  it('sends both id namespaces up to the thread list', () => {
    expect(breadcrumbFor(parseShellRoute('/p/agentos/sessions/abc123'))).toEqual({
      label: 'ALL THREADS',
      href: '/p/agentos/threads',
    });
    expect(breadcrumbFor(parseShellRoute('/p/agentos/threads/3f9a'))).toEqual({
      label: 'ALL THREADS',
      href: '/p/agentos/threads',
    });
  });

  it('drops the session when the project changes, exactly as it always did', () => {
    // `switchProjectHref` keeps view + department and nothing else. A session id is not
    // portable across projects and neither is a thread id.
    expect(switchProjectHref(parseShellRoute('/p/agentos/sessions/abc123'), 'client-x')).toBe(
      '/p/client-x/threads',
    );
  });
});

describe('the project segment (M15 · Plan §9)', () => {
  it('reads /p/:project off the front of every view path', () => {
    expect(parseShellRoute('/p/agentos/map')).toMatchObject({ project: 'agentos', view: 'map' });
    expect(parseShellRoute('/p/agentos/map/sales/account-enrichment')).toMatchObject({
      project: 'agentos',
      view: 'map',
      department: 'sales',
      agent: 'account-enrichment',
    });
    expect(parseShellRoute('/p/client-x/chart/marketing')).toMatchObject({
      project: 'client-x',
      view: 'chart',
      department: 'marketing',
    });
    expect(parseShellRoute('/p/agentos/dashboards/pipeline')).toMatchObject({
      project: 'agentos',
      panel: 'pipeline',
    });
    expect(parseShellRoute('/p/agentos/sessions/abc123')).toMatchObject({
      project: 'agentos',
      session: 'abc123',
    });
  });

  it('reports null — never a default — when the URL does not name a project', () => {
    // The whole axis rests on this: a missing segment is a question the resolver asks the
    // coordinator, not a value any pure function is allowed to invent.
    expect(parseShellRoute('/map/sales').project).toBeNull();
    expect(parseShellRoute('/').project).toBeNull();
    expect(projectPrefix(null)).toBe('');
    expect(withProject('/map/sales', null)).toBe('/map/sales');
  });

  it('refuses the reserved slugs, so /p/all and /p/api are not projects', () => {
    // `RESERVED_PROJECT_SLUGS` in packages/contracts. `/p/all/...` is the deliberate
    // cross-project namespace; reading it as a project called "all" would make the one
    // URL that means "every project" mean "one project named all".
    expect(splitProject('/p/all/map')).toEqual({ project: null, rest: ['p', 'all', 'map'] });
    expect(splitProject('/p/api/map').project).toBeNull();
    expect(splitProject('/p/p/map').project).toBeNull();
    // Not a slug at all.
    expect(splitProject('/p/Not_A_Slug/map').project).toBeNull();
  });

  it('keeps every generated href inside the project', () => {
    const route = parseShellRoute('/p/agentos/map/sales/account-enrichment');
    expect(viewHref('chart', route.project)).toBe('/p/agentos/chart');
    expect(breadcrumbFor(route)).toEqual({ label: 'ALL JOBS', href: '/p/agentos/map/sales' });
    expect(breadcrumbFor(parseShellRoute('/p/agentos/map/sales'))).toEqual({
      label: 'ALL DEPARTMENTS',
      href: '/p/agentos/map',
    });
    expect(breadcrumbFor(parseShellRoute('/p/agentos/dashboards/pipeline'))).toEqual({
      label: 'ALL DASHBOARDS',
      href: '/p/agentos/dashboards',
    });
  });

  it('is round-trippable: parse ∘ build is the identity on the project', () => {
    for (const path of ['/p/agentos/map', '/p/client-x/chart/sales', '/p/a1/dashboards/x']) {
      const route = parseShellRoute(path);
      expect(parseShellRoute(viewHref(route.view, route.project)).project).toBe(route.project);
    }
  });
});

describe('switchProjectHref — what survives a project change', () => {
  it('keeps the view and the department', () => {
    // `project-scoping.md` invariant 6: the shape is shared, the roster is not. Every
    // project has the same departments, so a department transfers.
    expect(switchProjectHref(parseShellRoute('/p/a/map/sales'), 'b')).toBe('/p/b/map/sales');
    expect(switchProjectHref(parseShellRoute('/p/a/chart/marketing'), 'b')).toBe('/p/b/chart/marketing');
  });

  it('drops the agent, because the same slug in two projects is a different agent', () => {
    // ADR-014 §2: `agent_ref` is `{project}/{department}/{slug}`. Carrying the leaf across
    // either 404s or — worse — lands on a same-named agent with a different history and
    // a different capability ceiling, which is the bug class with no error message.
    expect(switchProjectHref(parseShellRoute('/p/a/map/sales/account-enrichment'), 'b')).toBe('/p/b/map/sales');
  });

  it('drops the panel, the thread and the session', () => {
    expect(switchProjectHref(parseShellRoute('/p/a/dashboards/pipeline'), 'b')).toBe('/p/b/dashboards');
    expect(switchProjectHref(parseShellRoute('/p/a/threads/3f9a'), 'b')).toBe('/p/b/threads');
    // The session path lands on THREADS in the destination: the tab survives a project
    // switch even though the leaf cannot.
    expect(switchProjectHref(parseShellRoute('/p/a/sessions/xyz'), 'b')).toBe('/p/b/threads');
  });

  it('works from an unscoped URL, which is how the first switch ever happens', () => {
    expect(switchProjectHref(parseShellRoute('/map/sales'), 'b')).toBe('/p/b/map/sales');
  });
});

describe('projectTrail', () => {
  it('is project › department › leaf, with the leaf whatever the view calls it', () => {
    expect(projectTrail(parseShellRoute('/p/agentos/map/sales/account-enrichment'))).toEqual({
      project: 'agentos',
      department: 'sales',
      leaf: 'account-enrichment',
    });
    expect(projectTrail(parseShellRoute('/p/agentos/dashboards/pipeline'))).toEqual({
      project: 'agentos',
      department: null,
      leaf: 'pipeline',
    });
  });

  it('never substitutes a project it was not given', () => {
    expect(projectTrail(parseShellRoute('/map/sales')).project).toBeNull();
  });
});

describe('searchPlaceholder', () => {
  it('is "Search jobs" on MAP and CHART, "Search panels" on DASHBOARDS (§2.0)', () => {
    expect(searchPlaceholder('map')).toBe('Search jobs');
    expect(searchPlaceholder('chart')).toBe('Search jobs');
    expect(searchPlaceholder('dashboards')).toBe('Search panels');
  });

  it('follows the same grammar on our fourth tab', () => {
    expect(searchPlaceholder('threads')).toBe('Search threads');
  });
});

describe('breadcrumbFor', () => {
  it('shows nothing at the top of a view', () => {
    expect(breadcrumbFor(parseShellRoute('/map'))).toBeNull();
  });

  it('says ALL DEPARTMENTS in a department drill-in', () => {
    expect(breadcrumbFor(parseShellRoute('/map/sales'))).toEqual({ label: 'ALL DEPARTMENTS', href: '/map' });
  });

  it('says ALL DASHBOARDS inside a dashboard (§2.5.1)', () => {
    expect(breadcrumbFor(parseShellRoute('/dashboards/pipeline'))).toEqual({
      label: 'ALL DASHBOARDS',
      href: '/dashboards',
    });
  });

  it('steps back to the department from an open drawer', () => {
    expect(breadcrumbFor(parseShellRoute('/map/sales/account-enrichment'))).toEqual({
      label: 'ALL JOBS',
      href: '/map/sales',
    });
  });
});

describe('per-view capabilities', () => {
  it('gives zoom to the canvas views only', () => {
    expect(viewHasZoom('map')).toBe(true);
    expect(viewHasZoom('chart')).toBe(true);
    expect(viewHasZoom('dashboards')).toBe(false);
    expect(viewHasZoom('threads')).toBe(false);
  });

  it('gives the live counter to the canvas views only', () => {
    expect(viewHasLiveCounter('map')).toBe(true);
    expect(viewHasLiveCounter('threads')).toBe(false);
  });
});

describe('viewSurface — the §2.0 offset contract', () => {
  it('lets the two full-bleed canvases paint under the transparent bar', () => {
    expect(viewSurface('map')).toBe('canvas');
    expect(viewSurface('dashboards')).toBe('canvas');
  });

  it('reserves the chrome band for views that lay out in document flow', () => {
    // The bug this replaced: CHART printed its department tabs on the same row as the
    // search pill, because nothing reserved the band the floating bar occupies.
    expect(viewSurface('chart')).toBe('flow');
    expect(viewSurface('threads')).toBe('flow');
  });

  it('defaults every view to flow, so a new view is safe on the day it is added', () => {
    const flow = VIEWS.filter((view) => viewSurface(view) === 'flow');
    const canvas = VIEWS.filter((view) => viewSurface(view) === 'canvas');
    // Exceptions are listed; membership is not. If this ever inverts, a view added
    // tomorrow starts underneath the bar and nobody finds out until a screenshot.
    expect(canvas.length).toBeLessThan(flow.length + canvas.length);
    expect(flow.length).toBeGreaterThan(0);
  });
});
