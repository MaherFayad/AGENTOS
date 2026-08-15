import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConnectionStatus } from './ConnectionStatus';
import { renderShell, stubFetch } from './test-harness';

vi.mock('next/navigation', async () => (await import('./test-harness')).navigationMock());
vi.mock('./ui', async () => (await import('./test-harness')).uiMock());

afterEach(() => vi.unstubAllGlobals());

describe('ConnectionStatus (§2.0 bottom-right)', () => {
  it('shows the tailnet state and the runner queue depth', async () => {
    stubFetch({ '/api/status': { json: { tailscale: 'online', queueDepth: 2 } } });
    renderShell(<ConnectionStatus />);
    await waitFor(() => expect(screen.getByText('ONLINE')).toBeTruthy());
    expect(screen.getByText('2 QUEUED')).toBeTruthy();
  });

  it('says so in a sentence when the endpoint is not built yet', async () => {
    stubFetch({});
    renderShell(<ConnectionStatus />);
    await waitFor(() => expect(screen.getByText('NO READING')).toBeTruthy());
    expect(screen.getByText(/status endpoint isn't up yet/i)).toBeTruthy();
  });

  it('never claims online when the fetch fails', async () => {
    stubFetch({ '/api/status': 'network-error' });
    renderShell(<ConnectionStatus />);
    await waitFor(() => expect(screen.queryByText('ONLINE')).toBeNull());
    expect(screen.getByText(/off the tailnet/i)).toBeTruthy();
  });
});
