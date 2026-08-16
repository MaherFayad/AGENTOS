import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from './AppShell';
import { GRAPH_FIXTURE, PROJECTS_FIXTURE, pathnameRef, stubFetch, stubFullscreenSupport } from './test-harness';

vi.mock('next/navigation', async () => (await import('./test-mocks')).navigationMock());
vi.mock('./ui', async () => (await import('./test-mocks')).uiMock());
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

/** Undo for `stubFullscreenSupport` — jsdom has no Fullscreen API; see the harness. */
let restoreFullscreen: () => void = () => undefined;

beforeEach(() => {
  restoreFullscreen = stubFullscreenSupport();
  stubFetch({
    // Project-scoped first: after M15 the shell asks for `/api/p/:project/…` and only
    // falls back to the coordinator-wide route when that one 404s. Keys are matched by
    // prefix, so the scoped entries must come before their unscoped namesakes.
    '/api/p/agentos/graph': { json: GRAPH_FIXTURE },
    '/api/p/agentos/cost/today': { json: { usd: 12.4 } },
    '/api/projects': { json: PROJECTS_FIXTURE },
    '/api/graph': { json: GRAPH_FIXTURE },
    '/api/status': { json: { tailscale: 'online', queueDepth: 0 } },
    '/api/cost/today': { json: { usd: 12.4 } },
  });
});
afterEach(() => {
  restoreFullscreen();
  vi.unstubAllGlobals();
});

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
    renderShellAt('/p/agentos/map');
    expect(screen.getByRole('button', { name: /fullscreen/i })).toBeTruthy();
    // M15's addition to the left cluster (`Plan §23.10`). Named by its scope, not by a
    // decorative label, because "which project is this" is what the control answers.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^project: AgentOS/i })).toBeTruthy(),
    );
    expect(screen.getByRole('combobox')).toBeTruthy();
    expect(screen.getAllByRole('tab')).toHaveLength(4);
    expect(screen.getByRole('button', { name: /new claude session/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /keyboard shortcuts/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /zoom level/i })).toBeTruthy();
    await waitFor(() => expect(screen.getByText('$12.40 today')).toBeTruthy());
    expect(screen.getByText('ONLINE')).toBeTruthy();
  });

  it('keeps the tab group in the centre column, independent of the side clusters', () => {
    const { container } = renderShellAt('/p/agentos/map');
    const header = container.querySelector('header');
    // The centre column is `auto`; the sides are equal `1fr`. This is what lets the
    // fourth tab and the cost ticker land without moving the tabs (§2.0).
    expect(header?.className).toContain('grid-cols-[1fr_auto_1fr]');
    // `closest`, not `parentElement`: ViewTabs wraps the control in a `display: contents`
    // div (a handle for its scroll-into-view effect) which has no box of its own, so the
    // centring column is its ancestor rather than the tablist's direct parent.
    const column = header?.querySelector('[role="tablist"]')?.closest('.justify-self-center');
    expect(column).toBeTruthy();
    expect(column?.className).toContain('col-start-2');
  });

  it('reserves the safe-area insets on all four edges (§3.6)', () => {
    const { container } = renderShellAt('/p/agentos/map');
    const chrome = container.innerHTML;
    expect(chrome).toContain('env(safe-area-inset-top)');
    expect(chrome).toContain('env(safe-area-inset-bottom)');
    expect(chrome).toContain('env(safe-area-inset-left)');
    expect(chrome).toContain('env(safe-area-inset-right)');
  });

  it('renders the view underneath the chrome and offers a skip link past it', () => {
    renderShellAt('/p/agentos/map');
    expect(screen.getByTestId('canvas')).toBeTruthy();
    expect(screen.getByRole('link', { name: /skip to the view/i }).getAttribute('href')).toBe('#view-canvas');
  });

  it('shows the breadcrumb strip only in a drill-in', async () => {
    const { unmount } = renderShellAt('/p/agentos/map');
    expect(screen.queryByRole('link', { name: /all departments/i })).toBeNull();
    unmount();

    renderShellAt('/p/agentos/map/sales');
    await waitFor(() => expect(screen.getByRole('link', { name: /all departments/i })).toBeTruthy());
  });

  it('prints the project trail in the drill-in, project first (`Plan §23.10`)', async () => {
    renderShellAt('/p/agentos/map/sales/account-enrichment');
    const trail = await waitFor(() => screen.getByRole('navigation', { name: /where you are/i }));
    // Order matters more than markup here: the head crumb is the project, and it is the
    // project the *URL* names — never the coordinator's mounted default.
    expect(trail.textContent).toContain('agentos');
    expect(trail.textContent).toContain('sales');
    expect(trail.textContent).toContain('account-enrichment');
    expect(trail.textContent?.indexOf('agentos')).toBeLessThan(trail.textContent?.indexOf('sales') ?? -1);
    // The back link survives beside it: the trail says where you are, the link gets you
    // out, and a phone needs the second one to stay one tap away.
    expect(screen.getByRole('link', { name: /all jobs/i }).getAttribute('href')).toBe('/p/agentos/map/sales');
  });

  it('marks the project as unconfirmed when the runner cannot list projects', async () => {
    stubFetch({ '/api/graph': { json: GRAPH_FIXTURE } }); // `/api/projects` 404s
    renderShellAt('/p/agentos/map/sales');
    // The URL still names a project, so the name is shown — but nothing has confirmed it
    // exists, and the control says so rather than implying the runner agreed.
    const trigger = await waitFor(() => screen.getByRole('button', { name: /^project: agentos/i }));
    expect(trigger.dataset.projectConfirmed).toBe('false');
    expect(trigger.getAttribute('aria-label')).toMatch(/not confirmed by the runner/i);
  });
});
