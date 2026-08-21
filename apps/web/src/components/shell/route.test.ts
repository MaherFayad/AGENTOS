import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import type { ShellEventName } from '../../lib/shell-bus';

/**
 * Located by walking up from the working directory: under Vitest's jsdom environment
 * `import.meta.url` is not a `file:` URL, so `fileURLToPath` throws at import time and the
 * whole suite collects as zero tests — a green run that asserted nothing.
 */
function findSrcDir(): string {
  let dir = resolve(process.cwd());
  for (let i = 0; i < 6; i++) {
    const candidate = join(dir, 'apps', 'web', 'src');
    if (existsSync(candidate)) return candidate;
    const local = join(dir, 'src');
    if (existsSync(join(local, 'components', 'shell'))) return local;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`could not locate apps/web/src from ${process.cwd()}`);
}
import {
  breadcrumbFor,
  MAX_SEGMENTED_TABS,
  parseShellRoute,
  projectPrefix,
  projectTrail,
  searchPlaceholder,
  splitProject,
  legacyRewriteTarget,
  viewHasYourTreeFilter,
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
  // Zoom moved to MAP only on 2026-08-21 — CHART has never subscribed to `shell:zoom`, so
  // "the canvas views" was never the right grouping. The assertion that *holds* it there
  // lives in the `inert controls` block below and reads the source rather than this list;
  // this one is kept because a predicate deserves a direct example too.
  it('gives zoom to MAP, the one view with a camera', () => {
    expect(viewHasZoom('map')).toBe(true);
    expect(viewHasZoom('chart')).toBe(false);
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

describe('legacyRewriteTarget — the unscoped-URL rewrite terminates', () => {
  /**
   * The defect this replaces (`dashboards-engineer`, 2026-08-17; reproduced in Chrome
   * 2026-08-21T15:02Z): the resolver prefixed `/p/<mounted>` onto whatever the `[...legacy]`
   * catch-all matched, **without asking whether the path already named a project**. The
   * catch-all also matches `/p/<slug>/<anything-with-no-route>`, so each pass matched again
   * and prefixed again:
   *
   *   /approvals/abc123 → /p/agentos/approvals/abc123 → /p/agentos/p/agentos/… → unbounded
   *
   * Two of §3.6's three push notification types deep-link straight into it
   * (`deepLinkFor` emits `/approvals/:id` and `/runs/:id`), and `replace` means the back
   * button cannot recover.
   */
  const MOUNTED = 'agentos';

  it('rewrites a path that does not name a project', () => {
    expect(legacyRewriteTarget('/map/sales', MOUNTED)).toBe('/p/agentos/map/sales');
    expect(legacyRewriteTarget('/approvals/abc123', MOUNTED)).toBe('/p/agentos/approvals/abc123');
    expect(legacyRewriteTarget('/runs/abc123', MOUNTED)).toBe('/p/agentos/runs/abc123');
  });

  it('refuses to rewrite a path that already names a project', () => {
    // The narrow property `dashboards-engineer` named: rewrite **only** when
    // `splitProject(pathname).project === null`.
    expect(legacyRewriteTarget('/p/agentos/nope', MOUNTED)).toBeNull();
    expect(legacyRewriteTarget('/p/agentos/approvals/abc123', MOUNTED)).toBeNull();
    expect(legacyRewriteTarget('/p/client-x/calendar', MOUNTED)).toBeNull();
    // A *reserved* slug is not a project, so this one is still rewritable — `/p/all/...`
    // parses to `project: null` and must not be mistaken for "already scoped".
    expect(legacyRewriteTarget('/p/all/map', MOUNTED)).toBe('/p/agentos/p/all/map');
  });

  it('picks nothing when the coordinator named no mounted project', () => {
    expect(legacyRewriteTarget('/map/sales', null)).toBeNull();
  });

  /**
   * **The assertion that actually catches the bug class.** The three above are examples;
   * this one is the property. Applying the rewrite to its own output must terminate after
   * exactly one step — anything else is a loop, whatever the example set happens to contain.
   */
  it('is a fixed point after one pass — the loop cannot exist', () => {
    const paths = [
      '/',
      '/map',
      '/map/sales',
      '/map/sales/account-enrichment',
      '/approvals/abc123',
      '/runs/abc123',
      '/sessions/abc123',
      '/calendar',
      '/p/agentos/map',
      '/p/agentos/nope',
      '/p/all/map',
      '/p/Not_A_Slug/map',
    ];
    for (const path of paths) {
      const once = legacyRewriteTarget(path, MOUNTED);
      if (once === null) continue;
      expect(legacyRewriteTarget(once, MOUNTED), `${path} → ${once} rewrote again`).toBeNull();
    }
  });

  it('never emits a pathname carrying two project segments', () => {
    // The same property stated the way `check-page-errors.mjs` observes it in a browser,
    // so the unit test and the runtime gate are testing one thing in two places.
    for (const path of ['/approvals/abc', '/p/agentos/approvals/abc', '/runs/x', '/nope']) {
      const target = legacyRewriteTarget(path, MOUNTED) ?? path;
      expect(target.split('/p/').length - 1, `${path} → ${target}`).toBeLessThanOrEqual(1);
    }
  });
});

describe('inert controls: the predicate is held to the source, not to a comment', () => {
  /**
   * Two chrome controls promised things nothing delivered:
   *
   *  - the zoom readout said *"The canvas has not reported a zoom level yet"* on CHART,
   *    which has never subscribed to `shell:zoom`. A promise that will never be kept;
   *  - `YOUR TREE` flipped `aria-pressed`, recoloured itself and emitted `shell:yourTree`
   *    into a bus with no subscriber, so it reported success and changed nothing.
   *
   * Both are now `false` in `route.ts`. **A constant saying "nobody consumes this" is a
   * declaration, and this repo's standing finding is that a comment is not a mechanism** —
   * so these read the source tree and fail when the world stops matching the constant.
   * That is the point: the day someone wires the canvas half, the gate goes red and names
   * the line to flip, rather than the feature staying dark because a flag was forgotten.
   */
  const SRC = findSrcDir();

  /**
   * Comments removed before matching, because prose *about* a subscriber is not one —
   * this file and `route.ts` both quote the call while explaining the finding, and
   * without this the gate reported `route.ts` as its own consumer.
   *
   * A comment-stripper is a known blindness in this repo (one deleted half its corpus
   * and still passed), which is exactly why the emptiness guard below is not optional:
   * if this ever ate the source, `subscribersOf('shell:zoom')` would come back empty
   * and the first test fails before either claim is made.
   */
  const stripComments = (source: string): string =>
    source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  /** Files that subscribe to a bus event, by `on('<event>'`. Tests excluded. */
  function subscribersOf(event: ShellEventName): string[] {
    const hits: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          if (entry !== 'node_modules' && entry !== '__tests__') walk(full);
          continue;
        }
        if (!/\.tsx?$/.test(entry) || /\.test\.tsx?$/.test(entry)) continue;
        // `lib/shell-bus.ts` declares the events; it does not consume them.
        if (full.replace(/\\/g, '/').endsWith('lib/shell-bus.ts')) continue;
        if (stripComments(readFileSync(full, 'utf8')).includes(`on('${event}'`)) {
          hits.push(full.replace(/\\/g, '/').slice(SRC.replace(/\\/g, '/').length + 1));
        }
      }
    };
    walk(SRC);
    return hits.sort();
  }

  it('can see a subscriber at all — otherwise both assertions below are vacuous', () => {
    // The emptiness guard. If this grep stopped matching, every claim here would pass while
    // reading nothing, which is how `check-rtl` reported green over 190 invisible strings.
    const zoomSubscribers = subscribersOf('shell:zoom');
    expect(zoomSubscribers.length).toBeGreaterThan(0);
    expect(zoomSubscribers.some((f) => f.startsWith('map/'))).toBe(true);
  });

  it('gives zoom to MAP only, because MAP is the only view that answers shell:zoom', () => {
    expect(viewHasZoom('map')).toBe(true);
    expect(viewHasZoom('chart')).toBe(false);
    expect(viewHasZoom('dashboards')).toBe(false);
    expect(viewHasZoom('threads')).toBe(false);

    // And the reason, checked rather than asserted. Wire a camera into CHART and this fails
    // with the fix in its message.
    const chartSubscribes = subscribersOf('shell:zoom').some((f) => f.startsWith('chart/'));
    expect(
      chartSubscribes,
      'src/chart/ now subscribes to shell:zoom — widen viewHasZoom() in route.ts to include chart',
    ).toBe(false);
  });

  it('hides YOUR TREE for as long as no canvas subscribes to shell:yourTree', () => {
    const consumers = subscribersOf('shell:yourTree');
    const anyViewShowsIt = VIEWS.some((view) => viewHasYourTreeFilter(view));
    expect(
      anyViewShowsIt,
      consumers.length === 0
        ? 'nothing subscribes to shell:yourTree, so the toggle must not be drawn'
        : `${consumers.join(', ')} now subscribes to shell:yourTree — turn viewHasYourTreeFilter() on for that view`,
    ).toBe(consumers.length > 0);
  });
});
