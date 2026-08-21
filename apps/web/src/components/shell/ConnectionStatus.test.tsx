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

  /**
   * The most important fact about this system, in the chrome, in words, on every screen.
   *
   * Observed on the live stack 2026-08-21T15:35Z: `GET /api/status` answers
   * `{tailscale:"unknown", queueDepth:0, runnerConfigured:false}`, and this pill rendered
   * `UNKNOWN . 0 QUEUED`. That is **pixel-identical to a healthy idle runner** - a tailnet
   * the container cannot see, and an empty queue, are both unremarkable. Meanwhile the one
   * thing a reader most needs to know - *this box cannot execute a single agent* - was
   * consumed in exactly one place, three navigation levels deep inside a drawer
   * (`useRunnerAvailability`), and rendered there as a `title` tooltip.
   *
   * `NOT CONFIGURED` beats `UNKNOWN . 0 QUEUED`. The queue count goes away with it: a depth
   * of zero on a runner that cannot start anything is not a reading, it is arithmetic on an
   * absence, and standing rule 9 says `unknown` is not `zero`.
   */
  it('says NOT CONFIGURED rather than showing a queue depth the runner cannot act on', async () => {
    stubFetch({
      '/api/status': {
        json: {
          tailscale: 'unknown',
          tailscaleHint: 'This process has no tailnet interface and none is configured.',
          queueDepth: 0,
          runnerConfigured: false,
        },
      },
    });
    renderShell(<ConnectionStatus />);
    await waitFor(() => expect(screen.getByText('NOT CONFIGURED')).toBeTruthy());
    // The two labels this replaces, both of which read as a working system.
    expect(screen.queryByText('UNKNOWN')).toBeNull();
    expect(screen.queryByText((_, el) => el?.textContent === '0 QUEUED')).toBeNull();
    // And the reason, in a sentence, not only in a tooltip.
    expect(screen.getByText(/no agent can be started/i)).toBeTruthy();
  });

  it('still reports the tailnet reading in the sentence, because both facts matter', async () => {
    stubFetch({
      '/api/status': {
        json: {
          tailscale: 'online',
          tailscaleHint: 'Tailnet address 100.64.0.1 observed on this interface.',
          queueDepth: 0,
          runnerConfigured: false,
        },
      },
    });
    renderShell(<ConnectionStatus />);
    // An online tailnet does not make an unconfigured runner able to run anything, so the
    // label reports the blocking fact and the sentence carries both.
    await waitFor(() => expect(screen.getByText('NOT CONFIGURED')).toBeTruthy());
    expect(screen.queryByText('ONLINE')).toBeNull();
    expect(screen.getByText(/100\.64\.0\.1/)).toBeTruthy();
  });

  it('leaves a configured runner exactly as it was', async () => {
    // The label must not appear on a healthy stack, or it becomes wallpaper.
    stubFetch({
      '/api/status': { json: { tailscale: 'online', queueDepth: 2, runnerConfigured: true } },
    });
    renderShell(<ConnectionStatus />);
    await waitFor(() => expect(screen.getByText('ONLINE')).toBeTruthy());
    expect(screen.getByText((_, el) => el?.textContent === '2 QUEUED')).toBeTruthy();
    expect(screen.queryByText('NOT CONFIGURED')).toBeNull();
  });

  it('does not invent NOT CONFIGURED from a runner that never reported the field', async () => {
    // A status body without `runnerConfigured` is a runner that did not say, and "did not
    // say" is not "said no" - the house defect is a declared value read as an observed one.
    stubFetch({ '/api/status': { json: { tailscale: 'online', queueDepth: 1 } } });
    renderShell(<ConnectionStatus />);
    await waitFor(() => expect(screen.getByText('ONLINE')).toBeTruthy());
    expect(screen.queryByText('NOT CONFIGURED')).toBeNull();
  });

  it('stays monochrome - rule 1, and this pill is chrome', async () => {
    // A red or amber dot here is the single easiest fidelity break in the shell. The state
    // must be legible from the words, which is also the accessible outcome.
    stubFetch({
      '/api/status': { json: { tailscale: 'unknown', queueDepth: 0, runnerConfigured: false } },
    });
    const { container } = renderShell(<ConnectionStatus />);
    await waitFor(() => expect(screen.getByText('NOT CONFIGURED')).toBeTruthy());
    const classes = [...container.querySelectorAll('*')]
      .map((el) => el.getAttribute('class') ?? '')
      .join(' ');
    expect(classes).not.toMatch(/\b(bg|text|border)-(red|amber|orange|yellow|green|copper)\b/);
  });

  it('never claims online when the fetch fails', async () => {
    stubFetch({ '/api/status': 'network-error' });
    renderShell(<ConnectionStatus />);
    await waitFor(() => expect(screen.queryByText('ONLINE')).toBeNull());
    expect(screen.getByText(/off the tailnet/i)).toBeTruthy();
  });
});
