import type { ReactNode } from 'react';
import { vi } from 'vitest';
import { DURATION, EASE, withReducedMotion } from '../primitives/motion';

/**
 * The `vi.mock` factories for the shell's DOM tests — and **nothing else**.
 *
 * WHY THIS FILE EXISTS, i.e. do not merge it back into `test-harness.tsx`.
 *
 * A `vi.mock` factory runs *inside* module resolution of the module it replaces. So
 * everything the factory imports is pulled in while `next/navigation` is still
 * unresolved. `test-harness.tsx` imports `./ShellContext`, and `ShellContext` imports
 * `usePathname` from `next/navigation` — the very module being mocked. That closes a
 * cycle with no exit:
 *
 *   ViewTabs.test → ./ViewTabs → next/navigation (mocked) → factory
 *     → await import('./test-harness') → ./ShellContext → next/navigation (mocked)
 *     → awaits the same factory, which is still awaiting test-harness.
 *
 * Neither promise settles. The worker hangs at import time, before a single test is
 * collected, which is why no `testTimeout` catches it — `testTimeout` covers tests, not
 * module resolution. `fidelity-qa-reviewer` reproduced the mechanism with a 4-file
 * minimal case and quarantined all 8 shell suites; see
 * `comms/handoffs/M0-fidelity-qa-reviewer-test-runner.md`.
 *
 * The rule this file encodes: **a mock factory's import graph must be acyclic.** So this
 * module is a leaf. Its only imports are `react` types, `vitest`, and
 * `../primitives/motion` (which imports `react` and nothing else). It must never import
 * `./ShellContext`, `./ui`, or any shell component — adding one re-creates the deadlock,
 * and the symptom is a hang rather than a failure, so it will not look like this file's
 * fault.
 *
 * `test-harness.tsx` re-exports `routerMock` / `pathnameRef` from here, so the tests
 * themselves keep importing one module. Only the factory's graph had to change.
 */

export const routerMock = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
};

/** Mutable pathname the `usePathname` mock reads. `renderShell` sets it per test. */
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
 * numbers live in exactly one file, tests included. `../primitives/motion` is safe to
 * import here because it is a leaf; `./ui` (which re-exports it) is not, because `./ui`
 * is itself mocked by this factory.
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
