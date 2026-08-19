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
import { DEFAULT_LOCALE, translate } from '@/i18n';
import type { WorkProductListResponse } from '@agnetos/contracts';
import { ApiCallError, fetchWorkProducts } from '../data/client';
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
    return { kind: 'failed', message: translate(DEFAULT_LOCALE, 'work.unreadable') };
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
        // The runner's own sentence, or nothing. `work.failed` is the catalogued half and
        // the component always renders it; appending an English fallback here would put
        // untranslatable copy on an Arabic screen for a fault that already has a sentence.
        setState({
          kind: 'failed',
          message:
            error instanceof ApiCallError ? [error.message, error.hint].filter(Boolean).join(' ') : '',
        });
      });
    return () => controller.abort();
  }, [project, enabled, review]);

  return state;
}
