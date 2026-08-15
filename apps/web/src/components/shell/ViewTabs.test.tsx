import { fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ViewTabs } from './ViewTabs';
import { renderShell, routerMock, stubFetch } from './test-harness';

vi.mock('next/navigation', async () => (await import('./test-harness')).navigationMock());
vi.mock('./ui', async () => (await import('./test-harness')).uiMock());

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
    expect(routerMock.push).toHaveBeenCalledWith('/sessions');
  });
});
