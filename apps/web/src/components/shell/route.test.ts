import { describe, expect, it } from 'vitest';
import {
  breadcrumbFor,
  parseShellRoute,
  projectPrefix,
  projectTrail,
  searchPlaceholder,
  splitProject,
  switchProjectHref,
  VIEWS,
  viewHasLiveCounter,
  viewHasZoom,
  viewHref,
  viewSurface,
  withProject,
} from './route';

describe('parseShellRoute', () => {
  it('has exactly four views, SESSIONS fourth', () => {
    expect(VIEWS).toEqual(['map', 'dashboards', 'chart', 'sessions']);
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

  it('reads /dashboards/:id and /chart/:department and /sessions/:id', () => {
    expect(parseShellRoute('/dashboards/pipeline')).toMatchObject({ view: 'dashboards', panel: 'pipeline' });
    expect(parseShellRoute('/chart/marketing')).toMatchObject({ view: 'chart', department: 'marketing' });
    expect(parseShellRoute('/sessions/abc123')).toMatchObject({ view: 'sessions', session: 'abc123' });
  });

  it('falls back to the map for an unknown path', () => {
    expect(parseShellRoute('/nonsense').view).toBe('map');
    expect(parseShellRoute('/nonsense').isDrillIn).toBe(false);
  });

  it('builds tab hrefs', () => {
    expect(viewHref('sessions')).toBe('/sessions');
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

  it('drops the panel and the session', () => {
    expect(switchProjectHref(parseShellRoute('/p/a/dashboards/pipeline'), 'b')).toBe('/p/b/dashboards');
    expect(switchProjectHref(parseShellRoute('/p/a/sessions/xyz'), 'b')).toBe('/p/b/sessions');
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
    expect(searchPlaceholder('sessions')).toBe('Search sessions');
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
    expect(viewHasZoom('sessions')).toBe(false);
  });

  it('gives the live counter to the canvas views only', () => {
    expect(viewHasLiveCounter('map')).toBe(true);
    expect(viewHasLiveCounter('sessions')).toBe(false);
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
    expect(viewSurface('sessions')).toBe('flow');
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
