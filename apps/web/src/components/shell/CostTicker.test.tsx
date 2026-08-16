import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CostTicker } from './CostTicker';
import { renderShell, stubFetch } from './test-harness';

vi.mock('next/navigation', async () => (await import('./test-mocks')).navigationMock());
vi.mock('./ui', async () => (await import('./test-mocks')).uiMock());

afterEach(() => vi.unstubAllGlobals());

describe('CostTicker (§2.0, §3.5)', () => {
  it('renders the real figure from /api/cost/today', async () => {
    stubFetch({ '/api/cost/today': { json: { usd: 12.4 } } });
    renderShell(<CostTicker />);
    await waitFor(() => expect(screen.getByText('$12.40 today')).toBeTruthy());
  });

  it('shows a real zero as a zero', async () => {
    stubFetch({ '/api/cost/today': { json: { usd: 0 } } });
    renderShell(<CostTicker />);
    await waitFor(() => expect(screen.getByText('$0.00 today')).toBeTruthy());
  });

  it('does not invent a number when Langfuse has not reported', async () => {
    stubFetch({});
    renderShell(<CostTicker />);
    await waitFor(() => expect(screen.getByText('no cost data')).toBeTruthy());
    expect(screen.getByText(/Langfuse isn't reporting spend yet/i)).toBeTruthy();
    expect(screen.queryByText(/\$0\.00/)).toBeNull();
  });

  it('rejects a payload that is not the agreed shape', async () => {
    stubFetch({ '/api/cost/today': { json: { total: '12.40' } } });
    renderShell(<CostTicker />);
    await waitFor(() => expect(screen.getByText('no cost data')).toBeTruthy());
  });
});
