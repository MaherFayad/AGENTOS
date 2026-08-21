import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { parseGraph, parsePanels } from './useSearchIndex';
import { parseShellRoute, splitProject } from './route';
import payloads from './__fixtures__/api-payloads.json';

/**
 * Search is the map's non-visual path — the only way a keyboard or screen-reader user
 * reaches an agent on a canvas galaxy (fidelity-check §5, `a11y.mapCanvas`). A result that
 * navigates nowhere is not a cosmetic defect; it is the accessibility path being broken.
 *
 * ## Why this file asserts against a route tree read off disk
 *
 * On 2026-08-21 the index resolved **12 of 66 indexable things**. Two independent bugs,
 * both invisible to every gate in the repo:
 *
 *  - `parsePanels` read `entry.title`. The runner sends `{id, panel:{title}}`
 *    (`apps/runner/src/lib/panels.ts`), so `title` was `undefined` on all six and every
 *    panel was dropped. `parsePanels` then returned `[]`, `usePanelIndex` reported
 *    **`ready`**, no message was set, and every piece of honest-empty machinery in the
 *    shell stayed silent. *A checker that cannot distinguish "nothing matched" from
 *    "nothing was indexed" is blind in the way that matters.*
 *  - `parseGraph` dropped the `kind` the graph explicitly sends and `.pop()`ed every node
 *    id, so 41 `leaf` and 7 `anchor` nodes built hrefs to agents that do not exist — 48 of
 *    60 landing on the not-found drawer, which has zero focusable elements.
 *
 * A test that compared this module's output against a hand-written list of expected hrefs
 * would be two declarations agreeing, and this repo's standing finding is that such a pin
 * **is satisfiable by a lie**. So the ground truth here is behavioural on both sides:
 *
 *  - the *routes* come from `readRouteTree()`, which walks `app/(views)/` for real
 *    `page.tsx` files. Rename a route directory and this goes red without anyone
 *    remembering to update a constant;
 *  - the *payload* comes from `__fixtures__/api-payloads.json`, captured verbatim from the
 *    live runner (the file carries its own `_observed` stamp), not typed out from the
 *    contract's prose.
 *
 * The single assertion the audit asked for — **every href the index builds must match a
 * route the app defines** — catches both of the bugs above and the next one.
 */

/**
 * Located by walking up from the working directory rather than from `import.meta.url`:
 * under Vitest's jsdom environment `import.meta.url` is not a `file:` URL, so
 * `fileURLToPath` throws at import time and the whole suite is collected as **zero tests**
 * — a green run that asserted nothing. Found while writing this file, which is the joke.
 */
function findAppDir(): string {
  let dir = resolve(process.cwd());
  for (let i = 0; i < 6; i++) {
    const candidate = join(dir, 'apps', 'web', 'src', 'app');
    if (existsSync(candidate)) return candidate;
    const local = join(dir, 'src', 'app');
    if (existsSync(local)) return local;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`could not locate the app router tree from ${process.cwd()}`);
}

const APP = findAppDir();

/**
 * The route patterns this app actually serves, as segment arrays with `[param]` kept.
 *
 * Walks `app/` for `page.tsx`, dropping route-group segments (`(views)`) exactly as the
 * App Router does. The catch-all `[...legacy]` is excluded on purpose: it matches
 * *everything*, so leaving it in would make every href "valid" and this whole file inert —
 * the include-list failure mode in reverse.
 */
function readRouteTree(): string[][] {
  const out: string[][] = [];
  const walk = (dir: string, segments: string[]): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (entry === 'page.tsx') {
        out.push(segments);
        continue;
      }
      if (!statSync(full).isDirectory()) continue;
      if (entry.startsWith('[...')) continue; // the catch-all matches everything
      const isGroup = entry.startsWith('(') && entry.endsWith(')');
      walk(full, isGroup ? segments : [...segments, entry]);
    }
  };
  walk(APP, []);
  return out;
}

const ROUTE_TREE = readRouteTree();

/** Does this app define a page at this pathname? Dynamic segments match any one segment. */
function routeExists(pathname: string): boolean {
  const segments = pathname.split('/').filter(Boolean);
  return ROUTE_TREE.some(
    (pattern) =>
      pattern.length === segments.length &&
      pattern.every((patternSeg, i) => patternSeg.startsWith('[') || patternSeg === segments[i]),
  );
}

const PROJECT = 'agentos';
const graph = parseGraph(payloads.graph, PROJECT);
const panels = parsePanels(payloads.panels, PROJECT);

/** Node ids the drawer can actually open — jobs only. Leaves resolve to their parent. */
const JOB_IDS = new Set(
  payloads.graph.nodes.filter((node) => node.kind === 'job').map((node) => node.id),
);
const DEPARTMENT_IDS = new Set(payloads.graph.departments.map((d) => d.id));
const PANEL_IDS = new Set(payloads.panels.panels.map((entry) => entry.id));

describe('the route tree this file measures against is real', () => {
  /**
   * The emptiness guard. If `readRouteTree` ever returns nothing — a moved `app/`
   * directory, a build that renames `page.tsx` — every assertion below would pass
   * vacuously and this suite would report green while checking nothing. That is the
   * failure mode of half the findings in `comms/BRIEF.md`, so it gets its own test.
   */
  it('found the app router pages, and the ones search depends on', () => {
    expect(ROUTE_TREE.length).toBeGreaterThan(8);
    expect(routeExists('/p/agentos/map')).toBe(true);
    expect(routeExists('/p/agentos/map/sales')).toBe(true);
    expect(routeExists('/p/agentos/map/sales/account-enrichment')).toBe(true);
    expect(routeExists('/p/agentos/dashboards/mission-control')).toBe(true);
    // And it must be able to say no, or it is not a predicate.
    expect(routeExists('/p/agentos/map/sales/account-enrichment/deeper')).toBe(false);
    expect(routeExists('/approvals/abc')).toBe(false);
  });
});

describe('every href the index builds resolves to a route the app defines', () => {
  it('indexed something at all — an empty index must not pass vacuously', () => {
    // The `parsePanels` bug produced exactly this state and nothing anywhere went red.
    expect(graph).not.toBeNull();
    expect(panels).not.toBeNull();
    expect(graph!.items.length).toBe(
      payloads.graph.nodes.length + payloads.graph.departments.length,
    );
    expect(panels!.length).toBe(payloads.panels.panels.length);
  });

  it('builds no href that the app router would not serve', () => {
    for (const item of [...graph!.items, ...panels!]) {
      expect(routeExists(item.href), `${item.kind} "${item.id}" → ${item.href}`).toBe(true);
    }
  });

  it('keeps every href inside the project it was built for', () => {
    for (const item of [...graph!.items, ...panels!]) {
      expect(splitProject(item.href).project, `${item.id} → ${item.href}`).toBe(PROJECT);
    }
  });

  /**
   * The half a route-shape check alone cannot see. `/map/sales/growth-signal-scorer` is a
   * perfectly well-formed route — it is served by `map/[department]/[agent]/page.tsx` — and
   * it still opens a drawer reading *"This agent could not be loaded."* So the target has
   * to be checked against the payload, not only against the tree.
   */
  it('lands on something the payload actually contains', () => {
    for (const item of graph!.items) {
      const route = parseShellRoute(item.href);
      expect(route.view, `${item.id}`).toBe('map');
      expect(DEPARTMENT_IDS.has(route.department!), `${item.id} → ${item.href}`).toBe(true);
      if (route.agent !== null) {
        expect(
          JOB_IDS.has(`${route.department}/${route.agent}`),
          `${item.kind} "${item.id}" → ${item.href} is not a job the drawer can open`,
        ).toBe(true);
      }
    }
    for (const item of panels!) {
      const route = parseShellRoute(item.href);
      expect(route.view).toBe('dashboards');
      expect(PANEL_IDS.has(route.panel!), `${item.id} → ${item.href}`).toBe(true);
    }
  });
});

describe('parseGraph reads the kind the graph sends', () => {
  const hrefOf = (id: string): string => graph!.items.find((i) => i.id === id)!.href;

  it('sends an anchor to its department, not to a non-existent agent', () => {
    // `sales/_anchor` used to build `/map/sales/_anchor`.
    expect(hrefOf('sales/_anchor')).toBe('/p/agentos/map/sales');
  });

  it('sends a leaf to its parent job — the same answer the canvas already gives', () => {
    // `MapView.onActivate` → `jobSlug()` resolves a leaf to `department/job` and the drawer
    // opens correctly. The right answer existed in the codebase; search did not ask for it.
    expect(hrefOf('back-office/invoice-chaser/ageing-builder')).toBe(
      '/p/agentos/map/back-office/invoice-chaser',
    );
  });

  it('leaves a job alone', () => {
    expect(hrefOf('back-office/invoice-chaser')).toBe('/p/agentos/map/back-office/invoice-chaser');
  });

  it('keeps leaves in the index — searching a sub-skill name is useful', () => {
    // Only the href was ever wrong. Dropping leaves would lose 41 searchable names.
    const leaf = graph!.items.find((i) => i.id === 'back-office/invoice-chaser/ageing-builder');
    expect(leaf?.label).toBe('ageing-builder');
  });
});

describe('parsePanels reads the envelope the runner actually sends', () => {
  it('indexes all six panels from {id, panel:{title}}', () => {
    expect(panels!.map((p) => p.id).sort()).toEqual(
      payloads.panels.panels.map((p) => p.id).sort(),
    );
    expect(panels!.find((p) => p.id === 'client-delivery')?.label).toBe(
      'Client Delivery · Engagements',
    );
  });
});

describe('nothing-matched and nothing-was-indexed are different answers', () => {
  /**
   * The shape that let the panel bug run silently. `parsePanels` returned `[]` for a
   * payload of six real panels, `useEndpoint` read that as a successful parse, and
   * `usePanelIndex` reported `ready` with `message: null`. Every honest-empty sentence in
   * the shell was correct and none of them fired, because nothing had detected an absence.
   *
   * A parse that is handed entries and produces none has not found an empty list; it has
   * failed to understand the list. That is `malformedMessage`'s case, and it now says so.
   */
  it('an empty list is genuinely empty', () => {
    expect(parsePanels({ panels: [] }, PROJECT)).toEqual([]);
    expect(parseGraph({ nodes: [], departments: [] }, PROJECT)?.items).toEqual([]);
  });

  it('refuses a payload whose every entry it failed to read', () => {
    // Six entries in, zero out — precisely the live bug's signature.
    expect(parsePanels({ panels: [{ id: 'a' }, { id: 'b' }] }, PROJECT)).toBeNull();
    expect(parseGraph({ nodes: [{ id: 'x' }], departments: [] }, PROJECT)).toBeNull();
  });

  it('still tolerates one bad entry among good ones', () => {
    // Dropping a single malformed row must not take the whole carousel or map down.
    const mixed = parsePanels(
      { panels: [{ id: 'good', panel: { title: 'Good' } }, { id: 'bad' }] },
      PROJECT,
    );
    expect(mixed?.map((p) => p.id)).toEqual(['good']);
  });

  it('still refuses a payload that is not a list at all', () => {
    expect(parsePanels({ nope: true }, PROJECT)).toBeNull();
    expect(parseGraph({ departments: [] }, PROJECT)).toBeNull();
  });
});
