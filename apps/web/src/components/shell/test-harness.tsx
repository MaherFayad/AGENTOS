import { render, type RenderResult } from '@testing-library/react';
import type { ReactNode } from 'react';
import { vi } from 'vitest';
import { I18nProvider, type Locale } from '@/i18n';
import { pathnameRef, routerMock } from './test-mocks';
import { ShellProvider } from './ShellContext';

/**
 * Shared setup for the shell's DOM tests. Not app code — imported only by `*.test.tsx`.
 *
 * The shell reads two endpoints on mount, so every component test has to say what those
 * endpoints did. That is deliberate: "what does this look like when the runner is down"
 * is a first-class case here, not an afterthought.
 *
 * IMPORT THIS FROM TESTS, NEVER FROM A `vi.mock` FACTORY. This module imports
 * `./ShellContext`, which imports `next/navigation` — a module the tests mock. A factory
 * that awaits this file deadlocks the worker at import time. The factories live in
 * `./test-mocks`, which is a leaf for exactly that reason; the full mechanism is written
 * up there.
 */

/** Re-exported so tests keep one import site. Defined in the leaf — see the note above. */
export { pathnameRef, routerMock };

/**
 * Declare that the Fullscreen API exists, and return the undo.
 *
 * jsdom implements none of it, so `document.fullscreenEnabled` is `undefined` and
 * `FullscreenToggle` correctly renders nothing — a control that cannot work is worse
 * than an absent one (§2.0). Every real browser we target reports `true`, so a suite
 * asserting the §2.0 chrome has to say which of the two worlds it is testing.
 */
export function stubFullscreenSupport(enabled = true): () => void {
  const original = Object.getOwnPropertyDescriptor(Document.prototype, 'fullscreenEnabled');
  Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: enabled });
  return () => {
    // `Reflect.deleteProperty` rather than `delete`, and rather than a cast that silences it.
    //
    // `fullscreenEnabled` is `readonly` on `Document`, so `delete` is TS2704 — the compiler
    // is right about the *type* and beside the point about the *object*. The line above
    // installs an **own** property on the `document` instance, shadowing the prototype
    // accessor; removing that own property is the only undo there is, and `Reflect` says so
    // without pretending the property is optional.
    //
    // Asked the question this error is worth asking (`design-system-guardian`'s finding, via
    // the new `tsconfig.test.json`): does the undo leave a shape the real code cannot
    // produce? **No.** It restores plain jsdom, where `fullscreenEnabled` is `undefined` and
    // `FullscreenToggle` renders nothing — which is a state this suite deliberately tests.
    // Nothing asserts against an impossible document.
    Reflect.deleteProperty(document, 'fullscreenEnabled');
    if (original) Object.defineProperty(Document.prototype, 'fullscreenEnabled', original);
  };
}

export type StubbedRoute = { status?: number; json?: unknown } | 'network-error';

/** Stub `fetch` per path prefix. Unlisted paths 404 — i.e. "that endpoint isn't built". */
export function stubFetch(routes: Record<string, StubbedRoute>): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: unknown) => {
      const url = String(input);
      const key = Object.keys(routes).find((route) => url.startsWith(route));
      const stub = key === undefined ? { status: 404 } : routes[key];
      if (stub === 'network-error') throw new TypeError('Failed to fetch');
      const status = stub.status ?? 200;
      return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => stub.json ?? {},
      } as Response;
    }),
  );
}

/** A graph payload shaped like contracts/graph-layout.md, trimmed to what search needs. */
export const GRAPH_FIXTURE = {
  version: 'sha256:test',
  departments: [
    { id: 'sales', label: 'SALES', liveCount: 4, totalCount: 22, sublabels: ['lead sourcing', 'enrichment'] },
    { id: 'marketing', label: 'MARKETING', liveCount: 1, totalCount: 9 },
  ],
  nodes: [
    {
      id: 'sales/account-enrichment',
      label: 'Account Enrichment',
      department: 'sales',
      description: 'Appends firmographics to a raw account row.',
      status: 'live',
    },
    { id: 'marketing/content-calendar', label: 'Content Calendar', department: 'marketing', status: 'draft' },
  ],
};

/**
 * `GET /api/projects` as `packages/contracts` defines it, with the one project this repo
 * actually has (`Plan §24`: AgentOS becomes `project: AgentOS` in place).
 *
 * `scopeEnforced: true` here is a *fixture*, not a claim about the running system — the
 * real runner reports `false` or `null` today. Tests that care about the honest case say
 * so explicitly rather than relying on this default, because a fixture that quietly
 * asserts an isolation guarantee is the same shape of lie the switcher exists to avoid.
 */
export const PROJECTS_FIXTURE = {
  projects: [
    {
      id: 'a1b2c3d4-0000-0000-0000-000000000000',
      slug: 'agentos',
      name: 'AgentOS',
      status: 'active',
      libraryPath: '/repo',
      libraryRemote: null,
      hostAffinity: [],
      hostAffinityEnforced: false,
      budgetMonthlyUsd: null,
      budgetEnforced: false,
      defaultAccountId: null,
    },
  ],
  mounted: 'agentos',
  scopeEnforced: true,
};

/**
 * The default pathname is project-scoped, because after M15 every real URL is
 * (`Plan §9`). A test that wants the pre-project shape asks for it by name — and several
 * do, since "a link that does not say which project" is now a first-class case.
 */
export const DEFAULT_PATHNAME = '/p/agentos/map';

/**
 * `I18nProvider` is mounted here rather than per test because `app/layout.tsx`
 * mounts it around the whole shell: a harness that omits it renders a tree the
 * app cannot produce. It defaults to English, so every existing assertion on
 * English copy keeps its meaning; pass a locale to render the same component in
 * Arabic. `useI18n` throws outside a provider by design, which is why this shows
 * up as twelve loud failures rather than as English leaking into an Arabic page.
 */
export function renderShell(
  ui: ReactNode,
  options: { pathname?: string; locale?: Locale } = {},
): RenderResult {
  pathnameRef.current = options.pathname ?? DEFAULT_PATHNAME;
  return render(
    <I18nProvider locale={options.locale}>
      <ShellProvider>{ui}</ShellProvider>
    </I18nProvider>,
  );
}
