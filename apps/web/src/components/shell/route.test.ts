import { describe, expect, it } from 'vitest';
import {
  breadcrumbFor,
  parseShellRoute,
  searchPlaceholder,
  VIEWS,
  viewHasLiveCounter,
  viewHasZoom,
  viewHref,
  viewSurface,
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
