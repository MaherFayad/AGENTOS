'use client';

/**
 * The diff review screen's reads and its one write.
 *
 * Three behaviours here are the contract's, not this hook's convenience:
 *
 * - **The cursor is opaque and travels back verbatim** (§4.3). It is never split, compared or
 *   constructed. `nextCursor` in, `cursor=` out.
 * - **A page from a different tree is refused, again, on this side.** The server refuses it
 *   with `work_product_moved` (409); `appendPage` refuses it too. This is the process holding
 *   the pages a human is about to approve as one change, and a mixture of two trees is a diff
 *   that never existed as a whole.
 * - **The two refusals are told apart by code, not by message text.** `work_product_moved` is
 *   *load it again*; `work_product_unavailable` is *the tree is gone*. Deciding that from a
 *   substring is a claim you did not narrow, which is the family of defect this repo keeps
 *   paying for.
 *
 * The write is `POST …/thread/:threadId/message` with the verdict as an **object** in
 * `payload` (§8). It is not a merge, and there is no verb here that could become one.
 *
 * Owner: drawer-engineer · Consumes: comms/contracts/work-product.md §4.3, §8
 */

import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_LOCALE, translate } from '@/i18n';
import type { WorkProductSummary } from '@agnetos/contracts';
import { ApiCallError, fetchWorkProductDiff, postThreadMessage } from '../data/client';
import { appendPage, firstPage } from './diff-model';
import type { DiffViewState } from './DiffScreen';
import { DEFAULT_BODY_KEY, OUTCOME_KEY, planReview, REFUSAL_KEY, type Verdict } from './review';

/** The two refusal codes this screen renders as their own sentences (`api-contracts.md`). */
const MOVED = 'work_product_moved';
const UNAVAILABLE = 'work_product_unavailable';

/**
 * An error → the state the screen should be in.
 *
 * **By code, never by message text.** `work_product_moved` (409) means *load it again*;
 * `work_product_unavailable` (410) means *the tree is gone*. Reading either out of a
 * sentence would be a substring claim — the failure family this repo keeps paying for —
 * and the runner puts the code on the body precisely so nobody has to.
 *
 * An error with no code is a failure, not a refusal. A proxy 502 and a removed worktree are
 * not the same news and must not collapse into one sentence.
 *
 * Exported for its own test; nothing else imports it.
 */
export function refusalOf(error: unknown): DiffViewState {
  if (error instanceof ApiCallError) {
    if (error.code === MOVED) return { kind: 'refused', refusal: 'moved' };
    if (error.code === UNAVAILABLE) return { kind: 'refused', refusal: 'unavailable' };
    return { kind: 'failed', message: [error.message, error.hint].filter(Boolean).join(' ') };
  }
  return { kind: 'failed', message: '' };
}

export interface DiffReview {
  state: DiffViewState;
  loadingMore: boolean;
  loadMore: () => void;
  note: string;
  setNote: (note: string) => void;
  submit: (verdict: Verdict) => void;
  result: string | null;
  /** A sentence when the verdict cannot be sent, `null` when it can. */
  refusal: string | null;
  busy: boolean;
}

export function useDiffReview(
  project: string | null,
  summary: WorkProductSummary | null,
): DiffReview {
  const [state, setState] = useState<DiffViewState>({ kind: 'loading' });
  const [loadingMore, setLoadingMore] = useState(false);
  const [note, setNote] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const runId = summary?.runId ?? null;

  useEffect(() => {
    setNote('');
    setResult(null);
    if (!runId) {
      setState({ kind: 'loading' });
      return;
    }
    const controller = new AbortController();
    setState({ kind: 'loading' });
    fetchWorkProductDiff(project, runId, {}, controller.signal)
      .then((page) => setState({ kind: 'ready', diff: firstPage(page) }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState(refusalOf(error));
      });
    return () => controller.abort();
  }, [project, runId]);

  const loadMore = useCallback(() => {
    if (state.kind !== 'ready' || !state.diff.nextCursor || !runId) return;
    const cursor = state.diff.nextCursor;
    const held = state.diff;
    setLoadingMore(true);
    fetchWorkProductDiff(project, runId, { cursor })
      .then((page) => {
        const merged = appendPage(held, page);
        // The server said this cursor was fine and the page still came from another tree.
        // Nothing is merged; the reader is told, and the pages already read stay unmixed.
        setState(merged.ok ? { kind: 'ready', diff: merged.state } : { kind: 'refused', refusal: 'moved' });
      })
      .catch((error: unknown) => setState(refusalOf(error)))
      .finally(() => setLoadingMore(false));
  }, [project, runId, state]);

  // The tree the verdict names is the tree this page was read from — never the summary's
  // `headSha`, which was read at roster time and may be older than what is on screen.
  const headSha = state.kind === 'ready' ? state.diff.headSha : null;
  const plan = summary
    ? planReview({
        runId: summary.runId,
        headSha,
        threadId: summary.threadId,
        verdict: 'approved',
        body: translate(DEFAULT_LOCALE, DEFAULT_BODY_KEY.approved),
      })
    : ({ ok: false, refusal: 'no_thread' } as const);
  const refusal = plan.ok ? null : translate(DEFAULT_LOCALE, REFUSAL_KEY[plan.refusal]);

  const submit = useCallback(
    (verdict: Verdict) => {
      if (!summary) return;
      const sending = planReview({
        runId: summary.runId,
        headSha,
        threadId: summary.threadId,
        verdict,
        body: note.trim() || translate(DEFAULT_LOCALE, DEFAULT_BODY_KEY[verdict]),
      });
      if (!sending.ok) {
        setResult(translate(DEFAULT_LOCALE, REFUSAL_KEY[sending.refusal]));
        return;
      }
      setBusy(true);
      postThreadMessage(project, sending.threadId, sending.message)
        .then(() =>
          setResult(
            translate(DEFAULT_LOCALE, OUTCOME_KEY[verdict], { sha: sending.message.payload.headSha }),
          ),
        )
        .catch((error: unknown) =>
          setResult(
            translate(DEFAULT_LOCALE, 'work.review.failed', {
              message: error instanceof ApiCallError ? error.message : '',
            }),
          ),
        )
        .finally(() => setBusy(false));
    },
    [project, summary, headSha, note],
  );

  return { state, loadingMore, loadMore, note, setNote, submit, result, refusal, busy };
}
