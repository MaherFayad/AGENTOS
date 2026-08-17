import { LEGACY_UNSCOPED_PATHS, RUNNER_ROUTES } from '@agnetos/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchRunTransport, TransportError } from './transport';

const REFUSED = new Set(LEGACY_UNSCOPED_PATHS.map((route) => route.path));

/** A fresh, immediately-closed SSE body per call — one shared instance is disturbed. */
const body = (): ReadableStream<Uint8Array> =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      controller.close();
    },
  });

interface Call {
  url: string;
  method: string;
  lastEventId?: string | null;
  lastEventQuery?: string | null;
}

function capture(): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const headers = new Headers(init?.headers);
      calls.push({
        url,
        method: init?.method ?? 'GET',
        lastEventId: headers.get('Last-Event-ID'),
        lastEventQuery: new URL(url, 'http://drawer.test').searchParams.get('lastEventId'),
      });
      return new Response(body(), { status: 200, headers: { 'content-type': 'text/event-stream' } });
    }),
  );
  return calls;
}

describe('fetchRunTransport — start and re-attach are both project-scoped', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs the scoped run route, then GETs the scoped stream with Last-Event-ID', async () => {
    const calls = capture();
    const signal = new AbortController().signal;

    await fetchRunTransport(
      { agent: 'sales/account-enrichment', inputs: { account_url: 'https://example.com' } },
      { project: 'agentos', signal, onFrame: () => undefined },
    );
    expect(calls[0]).toMatchObject({ url: '/api/p/agentos/run', method: 'POST', lastEventId: null });

    await fetchRunTransport(
      { agent: 'sales/account-enrichment', inputs: {} },
      { project: 'agentos', signal, runId: 'run_1', lastEventId: '4', onFrame: () => undefined },
    );
    expect(calls[1]?.method).toBe('GET');
    expect(calls[1]?.url).toContain('/api/p/agentos/run/run_1/stream');
    expect(calls[1]?.lastEventId).toBe('4');
    expect(calls[1]?.lastEventQuery).toBe('4');
  });

  /**
   * Asserted against the route table rather than against the strings above, and asserted
   * as a negative: `/api/run` and `/api/run/:runId/stream` are still mounted and answer
   * `400 project_scope_missing`, so a URL that is one of them is the exact defect this
   * migration repaired.
   */
  it('builds from RUNNER_ROUTES and is never one of the refused paths', async () => {
    const calls = capture();
    const signal = new AbortController().signal;

    await fetchRunTransport(
      { agent: 'sales/account-enrichment', inputs: {} },
      { project: 'agentos', signal, onFrame: () => undefined },
    );
    expect(calls[0]?.url).toBe(RUNNER_ROUTES.run.path.replace(':project', 'agentos'));
    expect(REFUSED.has(calls[0]!.url)).toBe(false);
    expect(calls[0]?.url).not.toBe('/api/run');
    expect(REFUSED.has('/api/run')).toBe(true);

    await fetchRunTransport(
      { agent: 'sales/account-enrichment', inputs: {} },
      { project: 'agentos', signal, runId: 'run_1', onFrame: () => undefined },
    );
    expect(calls[1]?.url).toBe(
      RUNNER_ROUTES.runStream.path.replace(':project', 'agentos').replace(':runId', 'run_1'),
    );
    expect(REFUSED.has('/api/run/:runId/stream')).toBe(true);
  });
});

/**
 * The most expensive branch in this file. A run that cannot name its project must not be
 * POSTed to the unscoped path — that would be a refused request the console then reports
 * as the runner rejecting the *run*, and it is the reason this defect survived a day.
 */
describe('no project ⇒ no run is started at all', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws before fetch, and never calls fetch', async () => {
    const calls = capture();
    const signal = new AbortController().signal;

    await expect(
      fetchRunTransport(
        { agent: 'sales/account-enrichment', inputs: {} },
        { project: null, signal, onFrame: () => undefined },
      ),
    ).rejects.toThrow(/does not name a project/);
    expect(calls).toEqual([]);
  });

  /**
   * Non-retryable on purpose: three retries of an address that names no project produce
   * the same address three times, behind a "reconnecting…" spinner, for a fault that is
   * entirely ours and has a one-line fix.
   */
  it('is not retryable, so the console does not spin on a client-side fault', async () => {
    const signal = new AbortController().signal;
    const error = await fetchRunTransport(
      { agent: 'sales/account-enrichment', inputs: {} },
      { project: null, signal, onFrame: () => undefined },
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(TransportError);
    expect((error as TransportError).retryable).toBe(false);
  });

  it('refuses a segment that is not a project slug the same way', async () => {
    const calls = capture();
    const signal = new AbortController().signal;
    await expect(
      fetchRunTransport(
        { agent: 'sales/account-enrichment', inputs: {} },
        { project: 'Not A Slug', signal, onFrame: () => undefined },
      ),
    ).rejects.toThrow();
    expect(calls).toEqual([]);
  });
});
