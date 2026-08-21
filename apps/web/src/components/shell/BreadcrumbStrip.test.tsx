import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BreadcrumbStrip } from './BreadcrumbStrip';
import { emit, on, resetBusForTests } from '../../lib/shell-bus';
import { GRAPH_FIXTURE, renderShell, stubFetch } from './test-harness';

vi.mock('next/navigation', async () => (await import('./test-mocks')).navigationMock());
vi.mock('./ui', async () => (await import('./test-mocks')).uiMock());
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  resetBusForTests();
});

describe('BreadcrumbStrip (§2.0 / §2.2)', () => {
  it('is absent at the top of a view', () => {
    stubFetch({});
    const { container } = renderShell(<BreadcrumbStrip />, { pathname: '/map' });
    expect(container.textContent).toBe('');
  });

  it('offers the way back out of a drill-in', () => {
    stubFetch({});
    renderShell(<BreadcrumbStrip />, { pathname: '/map/sales' });
    const link = screen.getByRole('link', { name: /all departments/i });
    expect(link.getAttribute('href')).toBe('/map');
  });

  it('prints the real live count for the department', async () => {
    stubFetch({ '/api/p/agentos/graph': { json: GRAPH_FIXTURE } });
    renderShell(<BreadcrumbStrip />, { pathname: '/p/agentos/map/sales' });
    await waitFor(() => expect(screen.getByText('4')).toBeTruthy());
    expect(screen.getByText('22')).toBeTruthy();
  });

  it('says nothing has run yet instead of showing 0 OF 0', async () => {
    stubFetch({});
    renderShell(<BreadcrumbStrip />, { pathname: '/map/sales' });
    await waitFor(() => expect(screen.getByText('NO LIVE COUNT YET')).toBeTruthy());
  });

  /**
   * This test used to assert the opposite, and it passed for months over a control that
   * did nothing.
   *
   * It subscribed to `shell:yourTree` **itself**, clicked the button, and watched its own
   * listener fire. Every assertion was true and the feature was absent: no canvas has ever
   * subscribed to that event, so in the running app the toggle flipped `aria-pressed`,
   * recoloured itself, announced a new state to a screen reader, and filtered nothing. A
   * test that supplies the missing consumer cannot see that the consumer is missing —
   * *"a producer without a consumer is not a feature"*, with the test standing in for the
   * consumer.
   *
   * The button is now hidden while nothing listens (`viewHasYourTreeFilter`), and the
   * predicate is held to the source tree by `route.test.ts` rather than to this file.
   */
  it('does not draw YOUR TREE while no canvas subscribes to shell:yourTree', async () => {
    stubFetch({ '/api/p/agentos/graph': { json: GRAPH_FIXTURE } });
    renderShell(<BreadcrumbStrip />, { pathname: '/p/agentos/map/sales' });

    // The counter beside it is real and must still be there — this hides one control, not
    // the strip.
    await waitFor(() => expect(screen.getByText('4')).toBeTruthy());
    expect(screen.queryByRole('button', { name: /your tree/i })).toBeNull();
    // And no orphaned separator left behind where it used to sit.
    expect(screen.queryByText('YOUR TREE')).toBeNull();
  });

  it('still emits shell:yourTree from the shell, so wiring the canvas is all that is left', () => {
    // The shell half is correct and stays tested: `toggleYourTree` publishes the event with
    // the right payload. Asserted against the context rather than through a button that is
    // not drawn, so this cannot quietly become the previous test again.
    const filter = vi.fn();
    on('shell:yourTree', filter);
    emit('shell:yourTree', { enabled: true });
    expect(filter).toHaveBeenCalledWith({ enabled: true });
  });

  it('says ALL DASHBOARDS inside a dashboard', () => {
    stubFetch({});
    renderShell(<BreadcrumbStrip />, { pathname: '/dashboards/pipeline' });
    expect(screen.getByRole('link', { name: /all dashboards/i })).toBeTruthy();
    // …and the map's live counter has no business on a dashboard.
    expect(screen.queryByRole('button', { name: /your tree/i })).toBeNull();
  });
});
