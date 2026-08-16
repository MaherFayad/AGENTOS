import { render, type RenderResult } from '@testing-library/react';
import type { ReactNode } from 'react';
import { vi } from 'vitest';
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
    delete (document as Partial<Document>).fullscreenEnabled;
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

export function renderShell(ui: ReactNode, options: { pathname?: string } = {}): RenderResult {
  pathnameRef.current = options.pathname ?? '/map';
  return render(<ShellProvider>{ui}</ShellProvider>);
}
