import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchRunTransport } from './transport';

describe('fetchRunTransport — reconnect is GET /api/run/:runId/stream', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs /api/run to start, then GETs the stream with Last-Event-ID to re-attach', async () => {
    const calls: Array<{ url: string; method: string; lastEventId?: string | null; lastEventQuery?: string | null }> =
      [];

    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.close();
      },
    });

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
        return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
      }),
    );

    const signal = new AbortController().signal;
    await fetchRunTransport(
      { agent: 'sales/account-enrichment', inputs: { account_url: 'https://example.com' } },
      { signal, onFrame: () => undefined },
    );
    expect(calls[0]).toMatchObject({ url: '/api/run', method: 'POST', lastEventId: null });

    await fetchRunTransport(
      { agent: 'sales/account-enrichment', inputs: {} },
      { signal, runId: 'run_1', lastEventId: '4', onFrame: () => undefined },
    );
    expect(calls[1]?.method).toBe('GET');
    expect(calls[1]?.url).toContain('/api/run/run_1/stream');
    expect(calls[1]?.lastEventId).toBe('4');
    expect(calls[1]?.lastEventQuery).toBe('4');
  });
});
