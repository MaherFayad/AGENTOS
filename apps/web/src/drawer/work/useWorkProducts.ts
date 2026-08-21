'use client';

/**
 * The roster's read. **One route for N runs** (§7), asked once per open and once per filter
 * change, never once per row.
 *
 * `reviewQueue` is read back off the response rather than assumed from the request: what
 * narrowed the list is the server's statement about what it did. Reading the local flag
 * instead would describe an intention, and this repo has paid for that distinction enough
 * times to spell it out in a hook.
 *
 * Owner: drawer-engineer
 */

import { useEffect, useState } from 'react';
import type { WorkProductListResponse } from '@agnetos/contracts';
import { fetchWorkProducts } from '../data/client';
import { failureOf } from '../data/failure';
import type { WorkProductsState } from './WorkProducts';

/**
 * The response, or a sentence about why it could not be read.
 *
 * **A body this build cannot read is its own state, not an empty list and not a network
 * fault.** An unreadable payload rendered as *"no work products"* is a plausible zero, which
 * rule 9 exists to refuse; rendered as *"could not reach the runner"* it sends a reader to
 * spend an hour on a network that is working. It is also the difference between a shape
 * mismatch and a white screen: `response.workProducts.length` on an absent array throws out
 * of a render, and this drawer has taken a whole app down that way once already.
 *
 * The same shape the shell already uses for its three polled endpoints
 * (`shell.status.malformed` and its two siblings), for the same reason.
 */
export function readList(response: WorkProductListResponse): WorkProductsState {
  if (!Array.isArray(response?.workProducts)) {
    return { kind: 'failed', failure: { kind: 'unreadable', detail: null } };
  }
  return {
    kind: 'ready',
    rows: response.workProducts,
    // Not `?? review`: a response that does not say whether it narrowed the list has not
    // told us it did, and defaulting to the request would answer with the intention again.
    reviewQueue: response.reviewQueue === true,
  };
}

/** `Plan §13` says the roster is read in two seconds on a phone. Twenty is already a scroll. */
export const ROSTER_LIMIT = 20;

export function useWorkProducts(
  project: string | null,
  options: { enabled: boolean; review: boolean },
): WorkProductsState {
  const { enabled, review } = options;
  const [state, setState] = useState<WorkProductsState>({ kind: 'loading' });

  useEffect(() => {
    if (!enabled) {
      setState({ kind: 'loading' });
      return;
    }
    const controller = new AbortController();
    setState({ kind: 'loading' });
    fetchWorkProducts(project, { limit: ROSTER_LIMIT, review }, controller.signal)
      .then((response) => setState(readList(response)))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        // `failureOf` picks which of the four this is; the lead-in is catalogued and the
        // detail is the runner's own words. Nothing English is composed here, so an Arabic
        // screen shows an Arabic sentence for a fault that has one.
        setState({ kind: 'failed', failure: failureOf(error) });
      });
    return () => controller.abort();
  }, [project, enabled, review]);

  return state;
}
