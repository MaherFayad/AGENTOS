import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CostTicker } from './CostTicker';
import { PROJECTS_FIXTURE, renderShell, stubFetch } from './test-harness';

vi.mock('next/navigation', async () => (await import('./test-mocks')).navigationMock());
vi.mock('./ui', async () => (await import('./test-mocks')).uiMock());

afterEach(() => vi.unstubAllGlobals());

/**
 * The three ledger bodies below are **captured, not invented** — copied verbatim from the
 * running stack at 2026-08-16T19:31–19:35 while executing the standing acceptance case
 * ("stop Postgres; confirm no surface shows a plausible zero"). If the runner's shape
 * drifts, these stop matching reality and the suite should be re-captured rather than
 * edited to agree with the code.
 */
const CONNECTED = {
  state: 'connected',
  since: '2026-08-16T19:33:37.701Z',
  attempts: 0,
  lastError: null,
  nextRetryAt: null,
  hint: 'The run ledger is connected. Every number on this screen came from it.',
};

const UNREACHABLE = {
  state: 'unreachable',
  since: '2026-08-16T19:31:00.735Z',
  attempts: 5,
  lastError: 'getaddrinfo ENOTFOUND postgres',
  nextRetryAt: '2026-08-16T19:32:29.684Z',
  hint:
    'The run ledger is not answering (5 failed attempts, reconnecting in 30s). This is not "no runs yet" — ' +
    'the number you are looking for is unknown, not zero. Runs still work and will be recorded once the database is back.',
};

const ABSENT = {
  state: 'absent',
  since: '2026-08-16T19:34:46.590Z',
  attempts: 0,
  lastError: null,
  nextRetryAt: null,
  hint:
    'This runner has no run ledger configured (no DATABASE_URL), so there is no history to read. That is normal on ' +
    'the dev profile. Start the stack with --profile obs if you expected runs here. Runs still work; they are just not recorded.',
};

/**
 * The ticker under the state this app is actually in after M15: a project-scoped URL, and
 * a runner that answers the project-scoped spend route.
 *
 * Scope is a second axis, not a sixth reading. Every assertion below is about *what the
 * number is*; the block at the bottom is about *what it is a number about*, and the two
 * fail independently on purpose — a correctly-drawn figure about the wrong project would
 * pass every test in this file before M15.
 */
function ticker(json: unknown): void {
  stubFetch({
    '/api/p/agentos/cost/today': { json },
    '/api/projects': { json: PROJECTS_FIXTURE },
  });
  renderShell(<CostTicker />);
}

/** The pill, and the one word that says which of the five readings it is. */
function pill(): HTMLElement {
  return document.querySelector('[data-cost-state]') as HTMLElement;
}

describe('CostTicker (§2.0, §3.5)', () => {
  it('renders the real figure from /api/cost/today', async () => {
    ticker({ usd: 12.4, runs: 3, unpricedRuns: 0, ledger: CONNECTED });
    await waitFor(() => expect(screen.getByText('$12.40 today')).toBeTruthy());
    expect(pill().dataset.costState).toBe('amount');
  });

  it('draws a zero only when the ledger confirms there is nothing to draw', async () => {
    // The live body at 19:34: connected, zero real runs today, so `usd` is null and the
    // spend is genuinely nothing. This is the one case where `$0.00` is a reading.
    ticker({ usd: null, runs: 0, unpricedRuns: 0, ledger: CONNECTED });
    await waitFor(() => expect(screen.getByText('$0.00 today')).toBeTruthy());
    expect(pill().dataset.costState).toBe('zero');
    expect(screen.getByText(/nothing has been spent/i)).toBeTruthy();
    expect(screen.getByText(/reading rather than a guess/i)).toBeTruthy();
  });

  it('says the spend is UNKNOWN during a ledger outage, and never that nothing was traced', async () => {
    // The FAIL this suite exists for: 200 with `usd: null` while Postgres is stopped.
    ticker({ usd: null, runs: null, unpricedRuns: null, ledger: UNREACHABLE });
    await waitFor(() => expect(screen.getByText('spend unknown')).toBeTruthy());
    expect(pill().dataset.costState).toBe('outage');
    // The runner's own sentence, verbatim, in both the title and the sr-only text.
    expect(pill().getAttribute('title')).toBe(UNREACHABLE.hint);
    expect(screen.getByText(UNREACHABLE.hint)).toBeTruthy();
    // The three things the old copy did, none of which may come back.
    expect(screen.queryByText(/\$0\.00/)).toBeNull();
    expect(screen.queryByText(/fills in the first time/i)).toBeNull();
    expect(screen.queryByText(/doesn't answer today's spend/i)).toBeNull();
  });

  it('treats a missing ledger as a configuration, not an outage', async () => {
    // `--profile dev` with no DATABASE_URL. Captured from a runner started that way.
    ticker({ usd: null, runs: null, unpricedRuns: null, ledger: ABSENT });
    await waitFor(() => expect(screen.getByText('no ledger')).toBeTruthy());
    expect(pill().dataset.costState).toBe('noLedger');
    expect(screen.getByText(ABSENT.hint)).toBeTruthy();
    expect(screen.queryByText(/not answering|outage|unknown, not zero/i)).toBeNull();
  });

  it('will not call unpriced runs a zero', async () => {
    // Runs happened; none has a price yet. Neither a number nor a zero is available.
    ticker({ usd: null, runs: 4, unpricedRuns: 4, ledger: CONNECTED });
    await waitFor(() => expect(screen.getByText('not priced')).toBeTruthy());
    expect(pill().dataset.costState).toBe('unpriced');
    expect(screen.queryByText(/\$0\.00/)).toBeNull();
    expect(screen.getByText(/This is not zero/i)).toBeTruthy();
  });

  it('falls back to our own outage sentence if the runner sends no hint', async () => {
    ticker({ usd: null, runs: null, unpricedRuns: null, ledger: { state: 'unreachable' } });
    await waitFor(() => expect(screen.getByText('spend unknown')).toBeTruthy());
    expect(screen.getByText(/unknown — not zero/i)).toBeTruthy();
  });

  it('does not invent a number when the endpoint is not built', async () => {
    stubFetch({}); // 404 — the route does not exist
    renderShell(<CostTicker />);
    await waitFor(() => expect(screen.getByText('no cost data')).toBeTruthy());
    expect(pill().dataset.costState).toBe('unavailable');
    expect(screen.getByText(/doesn't answer today's spend for this project yet/i)).toBeTruthy();
    expect(screen.queryByText(/\$0\.00/)).toBeNull();
  });

  it('rejects a payload that is not the agreed shape, and says so as a bug here', async () => {
    ticker({ total: '12.40' });
    await waitFor(() => expect(screen.getByText('no cost data')).toBeTruthy());
    // Not the not-built sentence: a route that answers exists.
    expect(screen.getByText(/a bug here, not a fact about your spend/i)).toBeTruthy();
    expect(screen.queryByText(/fills in the first time/i)).toBeNull();
  });

  it('refuses to guess when `usd` is null and there is no ledger state to read', async () => {
    // An older runner, or a proxy that dropped the field: a real zero and an outage are
    // indistinguishable in this body, so neither may be rendered.
    ticker({ usd: null, runs: 0, unpricedRuns: 0 });
    await waitFor(() => expect(screen.getByText('no cost data')).toBeTruthy());
    expect(screen.queryByText(/\$0\.00/)).toBeNull();
    expect(screen.getByText(/a real zero and a ledger outage look identical/i)).toBeTruthy();
  });

  it('reports a network failure as a network failure', async () => {
    stubFetch({ '/api/p/agentos/cost/today': 'network-error' });
    renderShell(<CostTicker />);
    await waitFor(() => expect(screen.getByText('no cost data')).toBeTruthy());
    expect(screen.getByText(/off the tailnet/i)).toBeTruthy();
  });
});

describe("CostTicker — whose spend is this? (M15, `Plan §23.10`)", () => {
  it('asks only the project-scoped route, and says nothing extra when it answers', async () => {
    ticker({ usd: 12.4, runs: 3, unpricedRuns: 0, ledger: CONNECTED });
    await waitFor(() => expect(screen.getByText('$12.40 today')).toBeTruthy());
    expect(pill().dataset.costScope).toBe('project');
    const urls = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.map(
      (call) => call[0] as string,
    );
    expect(urls).toContain('/api/p/agentos/cost/today');
    // `LEGACY_COST_TICKER_PATH` is mounted and answers 400 by design: "It is not a
    // fallback and must not be used as one." So it is never called — not on success, and
    // (below) not on failure either.
    expect(urls).not.toContain('/api/cost/today');
  });

  it('never reads the pre-project route, even when the scoped one is missing', async () => {
    // The tempting bug: the scoped route 404s, a real number is available one path over,
    // and the pill shows it. That number is about every project this runner serves.
    stubFetch({
      '/api/projects': { json: PROJECTS_FIXTURE },
      '/api/cost/today': { json: { usd: 99.99, runs: 3, ledger: CONNECTED } },
    });
    renderShell(<CostTicker />);
    await waitFor(() => expect(screen.getByText('no cost data')).toBeTruthy());
    expect(screen.queryByText(/99\.99/)).toBeNull();
    const urls = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.map(
      (call) => call[0] as string,
    );
    expect(urls).not.toContain('/api/cost/today');
  });

  it('asks nothing at all when the URL names no project, and says why', async () => {
    stubFetch({ '/api/cost/today': { json: { usd: 12.4, runs: 1, ledger: CONNECTED } } });
    renderShell(<CostTicker />, { pathname: '/map' });
    await waitFor(() => expect(pill().dataset.costScope).toBe('unscoped'));
    expect(screen.getByText(/does not name a project/i)).toBeTruthy();
    expect(screen.queryByText(/\$12\.40/)).toBeNull();
    // Not one request: there is no endpoint for "spend, unscoped" any more.
    const urls = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.map(
      (call) => call[0] as string,
    );
    expect(urls.some((url) => url.includes('cost/today'))).toBe(false);
  });

  it('does not draw a project zero from a project it never asked about', async () => {
    // The sixth question, stated as the assertion it reduces to: no path through this
    // component produces `$0.00` unless the ledger, for *this project*, said so.
    stubFetch({ '/api/cost/today': { json: { usd: null, runs: 0, ledger: CONNECTED } } });
    renderShell(<CostTicker />, { pathname: '/map' });
    await waitFor(() => expect(pill().dataset.costScope).toBe('unscoped'));
    expect(screen.queryByText(/\$0\.00/)).toBeNull();
  });
});
