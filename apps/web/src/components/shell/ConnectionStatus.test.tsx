import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConnectionStatus } from './ConnectionStatus';
import { renderShell, stubFetch } from './test-harness';

vi.mock('next/navigation', async () => (await import('./test-mocks')).navigationMock());
vi.mock('./ui', async () => (await import('./test-mocks')).uiMock());

afterEach(() => vi.unstubAllGlobals());

describe('ConnectionStatus (§2.0 bottom-right)', () => {
  it('shows the tailnet state and the runner queue depth', async () => {
    stubFetch({ '/api/status': { json: { tailscale: 'online', queueDepth: 2 } } });
    renderShell(<ConnectionStatus />);
    await waitFor(() => expect(screen.getByText('ONLINE')).toBeTruthy());
    // "QUEUED" is its own span so it can be dropped below 420px (the pill would otherwise
    // clip on a phone); the reading is still one string to a reader.
    expect(screen.getByText((_, el) => el?.textContent === '2 QUEUED')).toBeTruthy();
  });

  it('says so in a sentence when the endpoint is not built yet', async () => {
    stubFetch({});
    renderShell(<ConnectionStatus />);
    await waitFor(() => expect(screen.getByText('NO READING')).toBeTruthy());
    expect(screen.getByText(/status endpoint isn't up yet/i)).toBeTruthy();
  });

  it('explains UNKNOWN with the runner\'s own hint rather than leaving it to be read as "broken"', async () => {
    // Captured from the live stack at 2026-08-16T19:32. `tailscale` used to be
    // `TAILSCALE_IP || TS_HOSTNAME ? 'online' : 'unknown'` — it said ONLINE on a host with
    // no Tailscale at all. It is now observed, and UNKNOWN is the honest answer from
    // inside a container. The label alone would still read as a fault, so the sentence
    // carries the distinction.
    const hint =
      'A tailnet address is configured in .env, but this process cannot see one on any of its own interfaces — ' +
      'which is the normal answer from inside a container when Tailscale runs on the host. It is not a claim ' +
      'that the tailnet is down; the runner simply cannot tell from here.';
    stubFetch({ '/api/status': { json: { tailscale: 'unknown', tailscaleHint: hint, queueDepth: 0 } } });
    renderShell(<ConnectionStatus />);
    await waitFor(() => expect(screen.getByText('UNKNOWN')).toBeTruthy());
    expect(screen.getByText(new RegExp('cannot see one on any of its own interfaces'))).toBeTruthy();
    expect(screen.queryByText('ONLINE')).toBeNull();
  });

  it('distinguishes a status body it cannot read from a status route that is missing', async () => {
    stubFetch({ '/api/status': { json: { runnerConfigured: true } } });
    renderShell(<ConnectionStatus />);
    await waitFor(() => expect(screen.getByText('NO READING')).toBeTruthy());
    expect(screen.getByText(/version mismatch here, not a connection problem/i)).toBeTruthy();
    expect(screen.queryByText(/status endpoint isn't up yet/i)).toBeNull();
  });

  it('never claims online when the fetch fails', async () => {
    stubFetch({ '/api/status': 'network-error' });
    renderShell(<ConnectionStatus />);
    await waitFor(() => expect(screen.queryByText('ONLINE')).toBeNull());
    expect(screen.getByText(/off the tailnet/i)).toBeTruthy();
  });
});
