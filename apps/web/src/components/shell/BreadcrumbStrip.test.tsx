import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BreadcrumbStrip } from './BreadcrumbStrip';
import { on, resetBusForTests } from '../../lib/shell-bus';
import { GRAPH_FIXTURE, renderShell, stubFetch } from './test-harness';

vi.mock('next/navigation', async () => (await import('./test-harness')).navigationMock());
vi.mock('./ui', async () => (await import('./test-harness')).uiMock());
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
    stubFetch({ '/api/graph': { json: GRAPH_FIXTURE } });
    renderShell(<BreadcrumbStrip />, { pathname: '/map/sales' });
    await waitFor(() => expect(screen.getByText('4')).toBeTruthy());
    expect(screen.getByText('22')).toBeTruthy();
  });

  it('says nothing has run yet instead of showing 0 OF 0', async () => {
    stubFetch({});
    renderShell(<BreadcrumbStrip />, { pathname: '/map/sales' });
    await waitFor(() => expect(screen.getByText('NO LIVE COUNT YET')).toBeTruthy());
  });

  it('YOUR TREE is a toggle that tells the canvas to filter', async () => {
    const filter = vi.fn();
    on('shell:yourTree', filter);
    stubFetch({ '/api/graph': { json: GRAPH_FIXTURE } });
    renderShell(<BreadcrumbStrip />, { pathname: '/map/sales' });

    const toggle = screen.getByRole('button', { name: /your tree/i });
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(toggle);
    expect(filter).toHaveBeenCalledWith({ enabled: true });
    await waitFor(() => expect(toggle.getAttribute('aria-pressed')).toBe('true'));
  });

  it('says ALL DASHBOARDS inside a dashboard', () => {
    stubFetch({});
    renderShell(<BreadcrumbStrip />, { pathname: '/dashboards/pipeline' });
    expect(screen.getByRole('link', { name: /all dashboards/i })).toBeTruthy();
    // …and the map's live counter has no business on a dashboard.
    expect(screen.queryByRole('button', { name: /your tree/i })).toBeNull();
  });
});
