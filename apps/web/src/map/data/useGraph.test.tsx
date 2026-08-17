/**
 * What the map actually opens — the assertion that was missing.
 *
 * `delta.test.ts` proved the delta maths and passed throughout the milestone in which the
 * socket stopped connecting, because it tested the code *below* the boundary. These tests
 * sit at the boundary: they stub `fetch` and `WebSocket` and assert the URL strings handed
 * to them, so "the project axis reaches the wire" is a thing a test can fail on.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { LEGACY_UNSCOPED_PATHS } from '@agnetos/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GRAPH_FIXTURE } from '../__fixtures__/graph';
import { useGraph } from './useGraph';

const REFUSED = new Set<string>(LEGACY_UNSCOPED_PATHS.map((r) => r.path));

/** Every URL `fetch` was handed, in order. */
function fetchSpy(responder: (url: string) => { status: number; body: unknown }): {
  spy: ReturnType<typeof vi.fn>;
  urls: string[];
} {
  const urls: string[] = [];
  const spy = vi.fn(async (input: unknown) => {
    const url = String(input);
    urls.push(url);
    const { status, body } = responder(url);
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    } as unknown as Response;
  });
  vi.stubGlobal('fetch', spy);
  return { spy, urls };
}

/** Every URL a `WebSocket` was constructed with, in order. */
function socketSpy(): string[] {
  const urls: string[] = [];
  class FakeSocket {
    constructor(url: string) {
      urls.push(url);
    }
    addEventListener(): void {}
    close(): void {}
  }
  vi.stubGlobal('WebSocket', FakeSocket);
  return urls;
}

afterEach(() => vi.unstubAllGlobals());

describe('useGraph — the project reaches the wire', () => {
  it('fetches the project-scoped graph route and opens the project-scoped socket', async () => {
    const { urls } = fetchSpy(() => ({ status: 200, body: GRAPH_FIXTURE }));
    const sockets = socketSpy();

    const { result } = renderHook(() => useGraph('agentos'));
    await waitFor(() => expect(result.current.resource.state).toBe('ready'));

    expect(urls).toEqual(['/api/p/agentos/graph']);
    expect(sockets).toEqual([`ws://${window.location.host}/ws/p/agentos/graph`]);
  });

  it('never asks for a path the contract lists as answering 400 project_scope_missing', async () => {
    // 503 on the scoped route so the ADR-003 artifact fallback runs too — both hops are
    // covered by this assertion, which is where the swallowed 400 used to live.
    const { urls } = fetchSpy(() => ({ status: 503, body: {} }));
    socketSpy();

    const { result } = renderHook(() => useGraph('agentos'));
    await waitFor(() => expect(result.current.resource.state).toBe('unavailable'));

    expect(urls).toEqual(['/api/p/agentos/graph', '/graph.json']);
    for (const url of urls) expect(REFUSED.has(url)).toBe(false);
    expect(urls).not.toContain('/api/graph');
  });

  it('with no project in the URL, asks for nothing at all and waits', async () => {
    const { spy, urls } = fetchSpy(() => ({ status: 200, body: GRAPH_FIXTURE }));
    const sockets = socketSpy();

    const { result } = renderHook(() => useGraph(null));
    // Give the effect a turn; if it were going to ask, it would have asked by now.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(spy).not.toHaveBeenCalled();
    expect(urls).toEqual([]);
    expect(sockets).toEqual([]);
    // Not an error state: nothing failed, because nothing was asked.
    expect(result.current.resource.state).toBe('loading');
  });

  it('a provided payload still skips the network entirely', async () => {
    const { spy } = fetchSpy(() => ({ status: 200, body: GRAPH_FIXTURE }));
    const sockets = socketSpy();

    const { result } = renderHook(() => useGraph('agentos', GRAPH_FIXTURE));
    await waitFor(() => expect(result.current.resource.state).toBe('ready'));

    expect(spy).not.toHaveBeenCalled();
    expect(sockets).toEqual([]);
  });
});
