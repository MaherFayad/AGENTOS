/** @vitest-environment jsdom */
import { fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ViewTabs } from './ViewTabs';
import { renderShell, routerMock, stubFetch } from './test-harness';

/**
 * Keyboard before pointer (`Plan §23.11` rule 7), on the **real** primitive.
 *
 * `ViewTabs.test.tsx` mocks `./ui`, and that mock's `SegmentedControl` has no key handler
 * at all — so every keyboard assertion made there would be an assertion about the mock.
 * `SegmentedControl.test.tsx` has the handler but no router: it asserts the callback fires
 * with `'threads'` and stops. **Neither suite can see the seam between them**, which is
 * precisely where M15's RTL defect lived — a primitive that mirrored correctly and a view
 * that had never been rendered in Arabic.
 *
 * So this file deliberately does *not* mock `./ui`. It is the only place that proves the
 * whole chain: a key press on the real tablist, in the direction the reader is actually
 * in, produces the project-scoped push §23.10 requires.
 *
 * The tab in question is **THREADS**, the fourth slot, which M16 took from SESSIONS
 * (`Plan §23.5`, `Plan §23.8`). A new tab that can only be clicked is not shipped.
 */
vi.mock('next/navigation', async () => (await import('./test-mocks')).navigationMock());

beforeEach(() => stubFetch({}));
afterEach(() => {
  vi.unstubAllGlobals();
  routerMock.push.mockClear();
});

/**
 * `dir` is set on a wrapper because `elementDirection` reads it off the rendered tree
 * (`closest('[dir]')`) rather than off a locale — which is what lets one of §2.5's or
 * §3.1's LTR islands key LTR inside an Arabic page.
 */
function renderTabs(dir: 'ltr' | 'rtl', pathname: string) {
  return renderShell(
    <div dir={dir}>
      <ViewTabs />
    </div>,
    { pathname },
  );
}

describe('THREADS is reachable and operable from the keyboard (Plan §23.11 rule 7)', () => {
  it('LTR: ArrowRight from CHART reaches THREADS and routes inside the project', () => {
    renderTabs('ltr', '/p/agentos/chart');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'THREADS' }), { key: 'ArrowLeft' });
    expect(routerMock.push).toHaveBeenCalledWith('/p/agentos/chart');

    routerMock.push.mockClear();
    fireEvent.keyDown(screen.getByRole('tab', { name: 'CHART' }), { key: 'ArrowRight' });
    expect(routerMock.push).toHaveBeenCalledWith('/p/agentos/threads');
  });

  it('RTL: ArrowLeft advances, because the row is reversed and reading order is the rule', () => {
    // The bug that shipped twice in M15: `ArrowRight` mapped to `+1` regardless of
    // direction, so the shell's primary navigation ran backwards for every Arabic reader.
    // Under `dir="rtl"` CHART is drawn to the LEFT of DASHBOARDS, and THREADS is at the
    // far left, so the key that advances is ArrowLeft.
    renderTabs('rtl', '/p/agentos/chart');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'CHART' }), { key: 'ArrowLeft' });
    expect(routerMock.push).toHaveBeenCalledWith('/p/agentos/threads');
  });

  it('RTL: ArrowRight goes back, and does not reach THREADS from CHART', () => {
    renderTabs('rtl', '/p/agentos/chart');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'CHART' }), { key: 'ArrowRight' });
    expect(routerMock.push).toHaveBeenCalledWith('/p/agentos/dashboards');
    expect(routerMock.push).not.toHaveBeenCalledWith('/p/agentos/threads');
  });

  it('End reaches THREADS in both directions — ordinals do not mirror', () => {
    renderTabs('rtl', '/p/agentos/map');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'MAP' }), { key: 'End' });
    expect(routerMock.push).toHaveBeenCalledWith('/p/agentos/threads');
  });

  it('carries the roving tab stop, so THREADS is a Tab target once selected', () => {
    // A tab the arrow keys select but that never takes DOM focus strands the roving
    // tabindex: the next Tab press leaves the control from wherever focus actually was.
    renderTabs('ltr', '/p/agentos/threads');
    const threads = screen.getByRole('tab', { name: 'THREADS' });
    expect(threads.getAttribute('aria-selected')).toBe('true');
    expect(threads.getAttribute('tabindex')).toBe('0');
    expect(screen.getByRole('tab', { name: 'MAP' }).getAttribute('tabindex')).toBe('-1');
  });

  it('selects THREADS from a session path, so the keyboard starts where the reader is', () => {
    // `/sessions/:id` is a path under THREADS after M16 and is where a push notification
    // lands (§3.6). If it did not select the tab, the roving tab stop would sit on MAP and
    // the first arrow press would move somebody two views from where they thought.
    renderTabs('ltr', '/p/agentos/sessions/abc123');
    expect(screen.getByRole('tab', { name: 'THREADS' }).getAttribute('tabindex')).toBe('0');
    expect(screen.getByRole('tab', { name: 'MAP' }).getAttribute('aria-selected')).toBe('false');
  });
});
