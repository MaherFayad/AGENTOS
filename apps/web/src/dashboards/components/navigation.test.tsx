/**
 * REQ-DSH-39 — the URLs these two views push, and the one they no longer render.
 *
 * This closes a verification that `comms/specs/dashboards.md` carried as **owed**: entering
 * a card from the carousel and stepping the prev/next rail were asserted by *reading* the
 * two files. Reading is what M15 already got past once, in `map/data/socket.ts` and in
 * `dashboards/data/endpoints.ts` — both held a correct-looking literal that had quietly
 * stopped pointing at anything. So the assertion is on the argument `router.push` actually
 * receives.
 *
 * Pattern borrowed from `map/MapView.test.tsx`: a hoisted `push` spy shared across the
 * mock, because a spy the test cannot reach is a spy that asserts nothing.
 */

import { fireEvent, render } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Panel } from '@agnetos/contracts';
import { Carousel } from './Carousel';
import { DashboardDetail } from './DashboardDetail';

const nav = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/p/acme/dashboards',
}));

/** A panel with the minimum a carousel card and a detail shell need. */
function panel(id: string, order: number, extra: Partial<Panel> = {}): Panel {
  return {
    schemaVersion: 1,
    id,
    title: `${id} title`,
    caption: `${id} caption`,
    railTitle: id.toUpperCase(),
    provider: 'ops',
    department: ['operations'],
    order,
    buildPrompt: `rebuild ${id}`,
    kpis: [],
    signals: [],
    widgets: [
      { id: `${id}-w`, type: 'bar-list', title: 'W', span: 1, query: { source: 'static', value: [] } },
    ],
    ...extra,
  } as Panel;
}

const PANELS = [panel('alpha', 1), panel('beta', 2), panel('gamma', 3)];

beforeEach(() => {
  nav.push.mockReset();
});

describe('<Carousel> — entering a card', () => {
  it('opens the dashboard inside the project the URL already named', () => {
    const { getByRole } = render(<Carousel panels={PANELS} />);
    fireEvent.keyDown(getByRole('listbox'), { key: 'Enter' });

    expect(nav.push).toHaveBeenCalledTimes(1);
    const pushed = nav.push.mock.calls[0][0] as string;
    expect(pushed).toBe('/p/acme/dashboards/alpha');
  });

  it('never pushes the pre-M15 shape, which would leave the project behind', () => {
    const { getByRole } = render(<Carousel panels={PANELS} />);
    fireEvent.keyDown(getByRole('listbox'), { key: 'Enter' });

    const pushed = nav.push.mock.calls[0][0] as string;
    // The literal this view used to emit, spelled out so the regression has a name. It is
    // not merely a 404: an unscoped view path is re-prefixed by the legacy resolver.
    expect(pushed).not.toBe('/dashboards/alpha');
    expect(pushed.startsWith('/p/acme/')).toBe(true);
  });
});

describe('<DashboardDetail> — the prev/next rail', () => {
  it('steps to the neighbouring dashboard without leaving the project', () => {
    const { getByLabelText } = render(<DashboardDetail panel={PANELS[1]} panels={PANELS} />);

    fireEvent.click(getByLabelText(/^Previous:/));
    fireEvent.click(getByLabelText(/^Next:/));

    const pushed = nav.push.mock.calls.map((c) => c[0] as string);
    expect(pushed).toEqual(['/p/acme/dashboards/alpha', '/p/acme/dashboards/gamma']);
    for (const url of pushed) expect(url.startsWith('/p/acme/dashboards/')).toBe(true);
  });
});

describe('§2.5.7 footer CTA', () => {
  const footered = panel('mission', 1, {
    footer: {
      lead: 'This is the actual product.',
      detail: 'Your delivery ops, running like this.',
      cta: { label: 'Get this deployed →', note: 'The approvals queue is not built yet.' },
    },
  });

  it('renders a CTA with no href as text and prints the reason, not a dead link', () => {
    const markup = renderToStaticMarkup(<DashboardDetail panel={footered} panels={[footered]} />);
    expect(markup).toContain('data-testid="dash-footer-cta-pending"');
    expect(markup).toContain('Get this deployed');
    expect(markup).toContain('The approvals queue is not built yet.');
    // The whole point: no anchor, so nothing can be clicked into the resolver loop.
    expect(markup).not.toContain('href="/approvals"');
    expect(markup).not.toContain('href="/p/acme/approvals"');
  });

  it('prefixes the project when a CTA does have an href', () => {
    const linked = panel('mission2', 1, {
      footer: {
        lead: 'This is the actual product.',
        detail: 'Your delivery ops, running like this.',
        cta: { label: 'Get this deployed →', href: '/approvals' },
      },
    });
    const markup = renderToStaticMarkup(<DashboardDetail panel={linked} panels={[linked]} />);
    // An approvals queue is project-scoped; a link that dropped the segment would offer one
    // client's queue under another client's name.
    expect(markup).toContain('href="/p/acme/approvals"');
    expect(markup).not.toContain('href="/approvals"');
  });

  it('does not paint the reason in the disabled token', () => {
    const markup = renderToStaticMarkup(<DashboardDetail panel={footered} panels={[footered]} />);
    const block = markup.slice(markup.indexOf('dash-footer-cta-pending'));
    expect(block.slice(0, 400)).not.toContain('text-ink-3');
  });
});
