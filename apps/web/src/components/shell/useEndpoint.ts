'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A polled read of one runner/observability endpoint, with an *honest* failure state.
 *
 * Standing rule 9: numbers must be real. So there are exactly three states and none of
 * them is "0 while we figure it out". `unavailable` carries a sentence written for a
 * person looking at a phone on a bad connection — it is rendered verbatim.
 */
export type Resource<T> =
  | { state: 'loading' }
  | { state: 'ready'; data: T }
  | { state: 'unavailable'; message: string };

export interface EndpointOptions<T> {
  /** Poll interval in ms. Polling pauses while the tab is hidden. */
  intervalMs: number;
  /**
   * Narrow the JSON to `T`, or return `null` to mean "the shape isn't what we agreed"
   * — which is reported as unavailable, never rendered as a number.
   */
  parse: (json: unknown) => T | null;
  /** Shown when the endpoint 404s — i.e. it exists in the contract but isn't built yet. */
  notBuiltMessage: string;
  /** Shown when the fetch itself fails — off tailnet, runner down, DNS. */
  offlineMessage: string;
}

/**
 * `GET` a JSON endpoint on an interval.
 *
 * Deliberately not SWR/react-query: two endpoints, no cache sharing, no mutations. A
 * dependency for this would be 40kB to save 40 lines.
 */
export function useEndpoint<T>(url: string, options: EndpointOptions<T>): Resource<T> {
  const { intervalMs, parse, notBuiltMessage, offlineMessage } = options;
  const [resource, setResource] = useState<Resource<T>>({ state: 'loading' });

  // Keep the latest callbacks without making them poll triggers.
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const read = useCallback(
    async (signal: AbortSignal) => {
      try {
        const response = await fetch(url, { signal, headers: { accept: 'application/json' } });
        if (response.status === 404 || response.status === 501) {
          setResource({ state: 'unavailable', message: optionsRef.current.notBuiltMessage });
          return;
        }
        if (!response.ok) {
          setResource({ state: 'unavailable', message: optionsRef.current.offlineMessage });
          return;
        }
        const parsed = optionsRef.current.parse(await response.json());
        setResource(
          parsed === null
            ? { state: 'unavailable', message: optionsRef.current.notBuiltMessage }
            : { state: 'ready', data: parsed },
        );
      } catch (error) {
        if (signal.aborted || (error instanceof Error && error.name === 'AbortError')) return;
        setResource({ state: 'unavailable', message: optionsRef.current.offlineMessage });
      }
    },
    [url],
  );

  useEffect(() => {
    const controller = new AbortController();
    void read(controller.signal);

    const tick = (): void => {
      if (typeof document !== 'undefined' && document.hidden) return;
      void read(controller.signal);
    };
    const timer = setInterval(tick, intervalMs);

    // A phone that wakes up should not show a stale reading for a whole interval.
    const wake = (): void => tick();
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('online', wake);

    return () => {
      controller.abort();
      clearInterval(timer);
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('online', wake);
    };
    // Only the url and the cadence re-arm the poller. The callbacks are read through
    // `optionsRef`, so an inline `parse` in the caller cannot restart the interval every
    // render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [read, intervalMs]);

  return resource;
}
