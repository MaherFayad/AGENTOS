import { render, type RenderResult } from '@testing-library/react';
import type { ReactNode } from 'react';
import { vi } from 'vitest';
import { DURATION, EASE, withReducedMotion } from '../primitives/motion';
import { ShellProvider } from './ShellContext';

/**
 * Shared setup for the shell's DOM tests. Not app code — imported only by `*.test.tsx`.
 *
 * The shell reads two endpoints on mount, so every component test has to say what those
 * endpoints did. That is deliberate: "what does this look like when the runner is down"
 * is a first-class case here, not an afterthought.
 */

export const routerMock = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
};

export const pathnameRef = { current: '/map' };

/** The `next/navigation` mock every shell test uses. */
export function navigationMock(): Record<string, unknown> {
  return {
    usePathname: () => pathnameRef.current,
    useRouter: () => routerMock,
    useSearchParams: () => new URLSearchParams(),
  };
}

/**
 * A minimal stand-in for the design system, so shell tests assert shell behaviour and
 * not the guardian's markup. The prop names mirror `components/primitives/**` exactly —
 * if they drift, `tsc` fails on the real import in `ui.ts` and this mock is the next
 * thing to fix.
 *
 * The motion values are re-exported from the real module rather than retyped: §1.6
 * numbers live in exactly one file, tests included.
 */
export function uiMock(): Record<string, unknown> {
  return {
    Pill: ({ children, ...rest }: { children: ReactNode }) => <button {...rest}>{children}</button>,
    Eyebrow: ({ children }: { children: ReactNode }) => <span>{children}</span>,
    GlassPanel: ({ children, className }: { children: ReactNode; className?: string }) => (
      <div className={className}>{children}</div>
    ),
    SegmentedControl: ({
      options,
      value,
      onChange,
      label,
    }: {
      options: Array<{ value: string; label: string }>;
      value: string;
      onChange: (next: string) => void;
      label: string;
    }) => (
      <div role="tablist" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            role="tab"
            aria-selected={option.value === value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    ),
    DURATION,
    EASE,
    withReducedMotion,
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
