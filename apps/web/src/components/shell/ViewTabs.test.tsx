import { fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ViewTabs } from './ViewTabs';
import { renderShell, routerMock, stubFetch } from './test-harness';

vi.mock('next/navigation', async () => (await import('./test-mocks')).navigationMock());
vi.mock('./ui', async () => (await import('./test-mocks')).uiMock());

beforeEach(() => stubFetch({}));
afterEach(() => {
  vi.unstubAllGlobals();
  routerMock.push.mockClear();
});

describe('ViewTabs (§2.0 segmented control)', () => {
  it('renders four tabs, SESSIONS last', () => {
    renderShell(<ViewTabs />);
    expect(screen.getAllByRole('tab').map((tab: HTMLElement) => tab.textContent)).toEqual([
      'MAP',
      'DASHBOARDS',
      'CHART',
      'SESSIONS',
    ]);
  });

  it('marks the tab matching the URL as active', () => {
    renderShell(<ViewTabs />, { pathname: '/chart/marketing' });
    expect(screen.getByRole('tab', { name: 'CHART' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'MAP' }).getAttribute('aria-selected')).toBe('false');
  });

  it('navigates on click rather than holding its own state', () => {
    renderShell(<ViewTabs />);
    fireEvent.click(screen.getByRole('tab', { name: 'SESSIONS' }));
    // M15: the project travels with the tab. Changing view must not change project — a
    // tab that dropped the segment would land on the legacy resolver and be redirected
    // back, which looks like a bug and is one.
    expect(routerMock.push).toHaveBeenCalledWith('/p/agentos/sessions');
  });

  // On a 375px phone the four labels overflow and TopBar scrolls them. Landing on
  // /sessions from a push notification must not leave the selected tab off-screen.
  it('scrolls the selected tab into view — the fourth tab overflows on a phone', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    try {
      renderShell(<ViewTabs />, { pathname: '/sessions/abc' });
      expect(scrollIntoView).toHaveBeenCalled();
      expect(scrollIntoView.mock.instances[0]).toBe(screen.getByRole('tab', { name: 'SESSIONS' }));
      expect(scrollIntoView.mock.calls[0][0]).toMatchObject({ inline: 'nearest', block: 'nearest' });
    } finally {
      delete (Element.prototype as Partial<Element>).scrollIntoView;
    }
  });
});
