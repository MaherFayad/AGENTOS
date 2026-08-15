import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from './AppShell';
import { GRAPH_FIXTURE, pathnameRef, stubFetch } from './test-harness';

vi.mock('next/navigation', async () => (await import('./test-harness')).navigationMock());
vi.mock('./ui', async () => (await import('./test-harness')).uiMock());
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

beforeEach(() =>
  stubFetch({
    '/api/graph': { json: GRAPH_FIXTURE },
    '/api/status': { json: { tailscale: 'online', queueDepth: 0 } },
    '/api/cost/today': { json: { usd: 12.4 } },
  }),
);
afterEach(() => vi.unstubAllGlobals());

const renderShellAt = (pathname: string) => {
  pathnameRef.current = pathname;
  return render(
    <AppShell>
      <div data-testid="canvas">canvas</div>
    </AppShell>,
  );
};

describe('AppShell (§2.0 as a whole)', () => {
  it('puts every control from §2.0 on screen at once', async () => {
    renderShellAt('/map');
    expect(screen.getByRole('button', { name: /fullscreen/i })).toBeTruthy();
    expect(screen.getByRole('combobox')).toBeTruthy();
    expect(screen.getAllByRole('tab')).toHaveLength(4);
    expect(screen.getByRole('button', { name: /new claude session/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /keyboard shortcuts/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /zoom level/i })).toBeTruthy();
    await waitFor(() => expect(screen.getByText('$12.40 today')).toBeTruthy());
    expect(screen.getByText('ONLINE')).toBeTruthy();
  });

  it('keeps the tab group in the centre column, independent of the side clusters', () => {
    const { container } = renderShellAt('/map');
    const header = container.querySelector('header');
    // The centre column is `auto`; the sides are equal `1fr`. This is what lets the
    // fourth tab and the cost ticker land without moving the tabs (§2.0).
    expect(header?.className).toContain('grid-cols-[1fr_auto_1fr]');
    expect(header?.querySelector('[role="tablist"]')?.parentElement?.className).toContain('justify-self-center');
  });

  it('reserves the safe-area insets on all four edges (§3.6)', () => {
    const { container } = renderShellAt('/map');
    const chrome = container.innerHTML;
    expect(chrome).toContain('env(safe-area-inset-top)');
    expect(chrome).toContain('env(safe-area-inset-bottom)');
    expect(chrome).toContain('env(safe-area-inset-left)');
    expect(chrome).toContain('env(safe-area-inset-right)');
  });

  it('renders the view underneath the chrome and offers a skip link past it', () => {
    renderShellAt('/map');
    expect(screen.getByTestId('canvas')).toBeTruthy();
    expect(screen.getByRole('link', { name: /skip to the view/i }).getAttribute('href')).toBe('#view-canvas');
  });

  it('shows the breadcrumb strip only in a drill-in', async () => {
    const { unmount } = renderShellAt('/map');
    expect(screen.queryByRole('link', { name: /all departments/i })).toBeNull();
    unmount();

    renderShellAt('/map/sales');
    await waitFor(() => expect(screen.getByRole('link', { name: /all departments/i })).toBeTruthy());
  });
});
