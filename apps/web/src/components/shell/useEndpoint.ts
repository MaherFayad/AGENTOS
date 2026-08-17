'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A polled read of one runner/observability endpoint, with an *honest* failure state.
 *
 * Standing rule 9: numbers must be real. So there are exactly three states and none of
 * them is "0 while we figure it out". `unavailable` carries a sentence written for a
 * person looking at a phone on a bad connection — it is rendered verbatim.
 *
 * **Four reasons produce `unavailable`, and this hook keeps them apart.** It used to
 * collapse two of them: a `null` from `parse` was reported with `notBuiltMessage`, so
 * "this endpoint does not exist yet" and "it answered with something I do not understand"
 * said the same sentence. That is how the cost ticker came to explain a database outage as
 * *"this fills in the first time an agent run is traced"* — a fluent, confident, false
 * story (`fidelity-qa-reviewer` FAIL, 2026-08-16T22:30). A wrong number invites doubt; a
 * wrong explanation closes the question, which is worse.
 *
 * | cause | message |
 * |---|---|
 * | 404 / 501 — the route is not built | `notBuiltMessage` |
 * | 2xx, but `parse` refused the body | `malformedMessage` |
 * | any other non-2xx | `offlineMessage` |
 * | the fetch threw — DNS, off tailnet | `offlineMessage` |
 *
 * `malformedMessage` is **required**, not optional-with-a-fallback: a default would have
 * fallen back to `notBuiltMessage` and quietly reinstated exactly the conflation this
 * split exists to remove. The type system now makes every consumer answer the question.
 *
 * A fifth case — *the endpoint answered correctly and the honest answer is "unknown"* —
 * is deliberately **not** here. It is not a failure of the read, so it belongs in `T`:
 * see `CostTicker`'s `CostReading`, where a ledger outage is a value with its own
 * sentence rather than an absence.
 */
export type Resource<T> =
  | { state: 'loading' }
  | { state: 'ready'; data: T }
  | { state: 'unavailable'; message: string };

export interface EndpointOptions<T> {
  /** Poll interval in ms. Polling pauses while the tab is hidden. */
  intervalMs: number;
  /**
   * Shown when the caller passes `url: null` — *there is nothing to ask for*, as opposed
   * to something being wrong with asking.
   *
   * M15 created this case: every data route is now `/api/p/:project/…`, so a URL that
   * does not name a project has no endpoint at all. The shell must not paper over that by
   * calling the pre-project spelling. `packages/contracts` mounts those still, answering
   * **400 `project_scope_missing`**, and says why in as many words:
   *
   * > *"It is not a fallback and must not be used as one … answering it with a plausible
   * > `usd: null` would hide the migration from the only people who can finish it."*
   *
   * So the shell does not call them, and this sentence is what it says instead.
   */
  noTargetMessage?: string;
  /**
   * Narrow the JSON to `T`, or return `null` to mean "the shape isn't what we agreed"
   * — which is reported as unavailable, never rendered as a number.
   *
   * `null` means **only** that. If the endpoint answered a legitimate "I do not know",
   * model it in `T`; returning `null` for it puts a real answer into a failure bucket.
   */
  parse: (json: unknown) => T | null;
  /** Shown when the endpoint 404s — i.e. it exists in the contract but isn't built yet. */
  notBuiltMessage: string;
  /**
   * Shown when the endpoint answered but `parse` refused the body. This is a bug in one
   * of the two of us — a contract drift — and the sentence should say so rather than
   * describe the world. Never `notBuiltMessage`: a route that answers exists.
   */
  malformedMessage: string;
  /** Shown when the fetch itself fails — off tailnet, runner down, DNS. */
  offlineMessage: string;
}

/**
 * `GET` a JSON endpoint on an interval.
 *
 * Deliberately not SWR/react-query: two endpoints, no cache sharing, no mutations. A
 * dependency for this would be 40kB to save 40 lines.
 */
export function useEndpoint<T>(url: string | null, options: EndpointOptions<T>): Resource<T> {
  const { intervalMs } = options;
  const [resource, setResource] = useState<Resource<T>>({ state: 'loading' });

  // Keep the latest callbacks without making them poll triggers.
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const read = useCallback(
    async (signal: AbortSignal) => {
      if (url === null) {
        setResource({
          state: 'unavailable',
          message: optionsRef.current.noTargetMessage ?? optionsRef.current.notBuiltMessage,
        });
        return;
      }
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
            ? // The route answered. It is not "not built"; it is not what we agreed.
              { state: 'unavailable', message: optionsRef.current.malformedMessage }
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

    /**
     * Drop the previous target's answer **before** asking about the new one.
     *
     * Without this, switching project leaves the last project's `ready` data on screen for
     * a whole round trip while the breadcrumb, the switcher and `data-cost-scope` already
     * say the new one — one client's number rendered under another client's name, which is
     * the exact failure the whole project axis exists to prevent (`project-scoping.md`
     * §5.1 Q2), arriving through a React state variable instead of through a URL.
     *
     * It is unreachable today because the coordinator mounts one project and refuses every
     * other with `project_not_mounted`. It becomes reachable the day a second library is
     * mounted, and by then nobody would be looking at this hook. `loading` is the honest
     * state for "we have not been told yet", and every consumer already renders it.
     */
    setResource({ state: 'loading' });
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
