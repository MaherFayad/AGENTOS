/**
 * The URLs every Command Center dials.
 *
 * This suite exists because of a specific failure, and it is the dashboards half of the one
 * `map/data/socket.test.ts` records: M15 moved the metrics routes under `/api/p/:project`
 * and this module kept five string literals pointing at the old ones. Nothing failed
 * loudly — every request took a **400 `project_scope_missing`**, which the provider
 * classified as "cannot reach the runner", so every widget on every dashboard went
 * `unavailable` under a sentence blaming the tailnet.
 *
 * So the assertions are on **the value that reaches the boundary**, not on the intent above
 * it: the exact path string, that it tracks the contract rather than a copy, and the
 * negative — that it is never one of the paths the runner answers 400 on. The pre-M15
 * spellings are written out by hand below so each regression has a name.
 *
 * The routing cases moved here from `__tests__/runs.test.mjs`, which runs under `node:test`
 * and cannot resolve `@agnetos/contracts`' extensionless barrel. That constraint is why the
 * literals were typed by hand in the first place, so removing it is part of the repair
 * rather than a test-harness preference. `runs.test.mjs` keeps `normalizeRuns`.
 */

import { DEPARTMENT_SLUGS, LEGACY_UNSCOPED_PATHS, PROJECT_ROUTE_PREFIX, RUNNER_ROUTES } from '@agnetos/contracts';
import { describe, expect, it } from 'vitest';
import { NO_PROJECT, planLangfuse, toRunnerRange, urlsOf, type Plan } from './endpoints';

const P = 'agentos';
/**
 * The real enum, not a hand-typed copy. This was a literal list of ADR-001's seven — it had
 * already missed ADR-041's `product` without any test noticing, because every assertion below
 * is relative to `DEPARTMENTS.length`. A list that can silently disagree with the contract it
 * stands for is the drift this suite exists to catch, so it now reads the contract.
 */
const DEPARTMENTS: readonly string[] = DEPARTMENT_SLUGS;

/** The scoped forms of the paths `runner-engineer`'s contract lists as refused. */
const REFUSED = new Set(LEGACY_UNSCOPED_PATHS.map((r) => r.path));

/**
 * `LEGACY_UNSCOPED_METRICS_PATHS` lives in `apps/runner/src/routes/metrics.ts` and is not
 * exported from `packages/contracts`, so the web app cannot import it. Mirrored here — the
 * only copy in this suite, named so it is greppable, and the subject of a `decision-request`
 * asking `observability-engineer` to lift the table into the contracts package.
 */
const REFUSED_METRICS = [
  '/api/metrics/query',
  '/api/metrics/sql',
  '/api/metrics/runs',
  '/api/metrics/activity',
];

/** Every URL a plan would fetch. `unsupported` plans fetch nothing, which is the point. */
const urls = (plan: Plan): string[] => urlsOf(plan);

/** The six shapes a panel can produce, each built with a project. */
const PLANS: Record<string, Plan> = {
  scalar: planLangfuse({ metric: 'runs', range: '7d' }, { project: P }),
  'scalar+filter': planLangfuse(
    { metric: 'cost', range: '28d', filter: { department: 'design' }, compare: 'previous-period' },
    { project: P },
  ),
  series: planLangfuse({ metric: 'runs', shape: 'series', range: '14d' }, { project: P }),
  'cost-by-agent': planLangfuse(
    { metric: 'cost', shape: 'list', groupBy: 'agent', range: '28d' },
    { project: P },
  ),
  'by-department': planLangfuse(
    { metric: 'runs', shape: 'list', groupBy: 'department', range: '7d' },
    { project: P, departments: DEPARTMENTS },
  ),
  'runs-list': planLangfuse({ metric: 'runs', shape: 'list', limit: 10, range: '7d' }, { project: P }),
  activity: planLangfuse({ metric: 'runs', shape: 'list', limit: 12 }, { project: P, intent: 'activity' }),
};

describe('every metrics URL a panel can build', () => {
  it('names the project, on every plan shape, with no exceptions', () => {
    for (const [name, plan] of Object.entries(PLANS)) {
      const built = urls(plan);
      expect(built.length, `${name} should fetch something`).toBeGreaterThan(0);
      for (const url of built) {
        expect(url.startsWith(`${PROJECT_ROUTE_PREFIX.replace(':project', P)}/`), `${name}: ${url}`).toBe(
          true,
        );
      }
    }
  });

  it('is never a path the runner answers 400 project_scope_missing on', () => {
    for (const [name, plan] of Object.entries(PLANS)) {
      for (const url of urls(plan)) {
        const path = url.split('?')[0];
        expect(REFUSED.has(path), `${name}: ${path} is a refused unscoped path`).toBe(false);
        for (const legacy of REFUSED_METRICS) {
          expect(path === legacy || path.startsWith(`${legacy}/`), `${name}: ${path}`).toBe(false);
          expect(url.startsWith(legacy), `${name}: ${url}`).toBe(false);
        }
      }
    }
  });

  it('tracks the contract rather than a copy of it', () => {
    // The prefix is the contract's, filled by the contract's own helper — not a template
    // string typed in `endpoints.ts`. If `PROJECT_ROUTE_PREFIX` moves, this moves with it.
    expect(PLANS.scalar).toMatchObject({
      url: `${PROJECT_ROUTE_PREFIX.replace(':project', P)}/metrics/query?metric=runs&range=7d`,
    });
    // The panels list is the one dashboards route that IS in `RUNNER_ROUTES`; `/api/panels`
    // is in `LEGACY_UNSCOPED_PATHS`, which is what `DashboardsView` must never send.
    expect(RUNNER_ROUTES.panels.path.replace(':project', P)).toBe('/api/p/agentos/panels');
    expect(REFUSED.has('/api/panels')).toBe(true);
  });

  it('spells out the five literals this module used to hold, so each has a name', () => {
    const all = Object.values(PLANS).flatMap(urls);
    expect(all.some((u) => u.startsWith('/api/metrics/query'))).toBe(false);
    expect(all.some((u) => u.startsWith('/api/metrics/sql/runs_per_day'))).toBe(false);
    expect(all.some((u) => u.startsWith('/api/metrics/sql/cost_by_agent'))).toBe(false);
    expect(all.some((u) => u.startsWith('/api/metrics/runs'))).toBe(false);
    expect(all.some((u) => u.startsWith('/api/metrics/activity'))).toBe(false);
  });
});

describe('no project', () => {
  it('builds no URL at all, rather than falling back to the unscoped one', () => {
    for (const project of [null, undefined]) {
      const plan = planLangfuse({ metric: 'runs', range: '7d' }, { project, departments: DEPARTMENTS });
      expect(plan.kind).toBe('unsupported');
      expect(urls(plan)).toEqual([]);
    }
  });

  it('says the address names no project — not that the runner is down', () => {
    const plan = planLangfuse({ metric: 'runs', range: '7d' }, { project: null });
    expect(plan).toMatchObject({ kind: 'unsupported', message: NO_PROJECT });
    expect(NO_PROJECT).not.toMatch(/tailnet|offline|unreachable/i);
  });

  it('treats a segment that is not a project slug as no project, rather than throwing', () => {
    // `all` and `api` are reserved (`RESERVED_PROJECT_SLUGS`); the third is not kebab-case.
    for (const bad of ['all', 'api', 'Not A Slug']) {
      const plan = planLangfuse({ metric: 'runs', range: '7d' }, { project: bad });
      expect(plan, bad).toMatchObject({ kind: 'unsupported', message: NO_PROJECT });
    }
  });

  it('refuses before the window check, so a project fault is never reported as a range fault', () => {
    const plan = planLangfuse({ metric: 'runs', range: 'nonsense' }, { project: null });
    expect(plan).toMatchObject({ message: NO_PROJECT });
  });
});

describe('the routing table still routes', () => {
  it('sends an activity-feed list to activity and a data-table list to runs', () => {
    expect(urls(PLANS.activity)[0]).toContain('/metrics/activity?limit=12');
    expect(urls(PLANS['runs-list'])[0]).toContain('/metrics/runs?limit=10');
  });

  it('asks Postgres for one count per department plus the ungrouped total', () => {
    const built = urls(PLANS['by-department']);
    expect(built).toHaveLength(DEPARTMENTS.length + 1);
    expect(built.filter((u) => u.includes('department=')).length).toBe(DEPARTMENTS.length);
  });

  it('maps weeks onto the runner`s day windows and refuses anything outside the table', () => {
    expect(toRunnerRange('4w')).toMatchObject({ token: '28d', days: 28 });
    expect(toRunnerRange('3d')).toBeNull();
  });

  it('withholds a shape no route answers, with a sentence rather than an approximation', () => {
    const byModel = planLangfuse(
      { metric: 'cost', shape: 'list', groupBy: 'model', range: '28d' },
      { project: P },
    );
    expect(byModel.kind).toBe('unsupported');
    expect(urls(byModel)).toEqual([]);
  });
});
