/**
 * Approve — what the button writes, as a value rather than as a fetch.
 *
 * `comms/contracts/work-product.md` §8 rules the shape, and the three refusals inside it are
 * the reason this is a module and not four lines inside a click handler.
 *
 * ## It is a message in the run's own thread, and not a merge
 *
 * `POST /api/p/:project/thread/:threadId/message` — M16's existing route, with
 * `payload: { review, runId, headSha }` and `interrupt: 'note'`.
 *
 *   - **Not `POST /api/p/:project/approvals/:runId`.** That verb resumes or aborts a run
 *     *paused at its plan gate*; a work-product review is a **finished** run, and reusing it
 *     lands on `run_not_pending_approval` (409). This was `drawer-engineer`'s wave-0 question
 *     and the contract answered it in exactly these terms.
 *   - **Not a new column and not a new entity.** There is no `ops.review` and there will not
 *     be one (§5.2) — the review queue is a query, and a verdict is the same kind of thing as
 *     `push_state: local`: a message in a thread.
 *   - **Nothing here pushes, opens a pull request or merges.** M17 records push state and
 *     performs nothing, because a push is data egress and ADR-038 is still `proposed`. There
 *     is deliberately no verb in this module that could grow into one.
 *
 * ## `headSha` is required, and that is the point of `canReview`
 *
 * *"Approved" with no tree state names nothing* — the tree can move afterwards, and a verdict
 * that cannot say what it looked at is a claim with no observation behind it. So the control
 * is refused, with the reason, rather than sent against an unnamed tree. Same for a run whose
 * thread we do not know: there is no address, so there is nothing to record against.
 *
 * ## The verdict is an object; the body is prose
 *
 * `payload` is `{ review, runId, headSha }` and it is **never composed into the body first**.
 * `redact()` walks object keys and a string has none, so flattening structured content into a
 * sentence before storage is how four of five denylisted keys leaked during M15. It also
 * matters here for a duller reason: the body is a human sentence in a human's language, and
 * anything reading the verdict back must read the field, not parse the prose.
 *
 * Owner: drawer-engineer · Consumes: comms/contracts/work-product.md §8
 */

import type { StringKey } from '@/i18n';

export type Verdict = 'approved' | 'changes_requested';

/** Exactly the request body `POST …/thread/:id/message` takes for a verdict. */
export interface ReviewMessage {
  body: string;
  /**
   * A verdict is a note. Not a `steer` — this build refuses those and cannot express one —
   * and not a `halt`, because the run is already finished and there is nothing to stop.
   */
  interrupt: 'note';
  payload: { review: Verdict; runId: string; headSha: string };
}

export type ReviewRefusal =
  /** No thread id, so there is no address. */
  | 'no_thread'
  /** No `headSha`, so the verdict could not name what it looked at. */
  | 'no_tree'
  /** The reader typed nothing and no fallback sentence was supplied. */
  | 'no_body';

export const REFUSAL_KEY = {
  no_thread: 'work.review.noThread',
  no_tree: 'work.review.noTree',
  // A body the reader can see is always available from the catalogue, so this one is a
  // programming error rather than a state a person can reach. It still gets a sentence:
  // an unreachable branch that renders nothing is how a dead control looks from outside.
  no_body: 'work.review.noThread',
} as const satisfies Record<ReviewRefusal, StringKey>;

export interface ReviewInput {
  runId: string;
  /** The tree this verdict looked at. `null` refuses. */
  headSha: string | null;
  /** The thread the run is a turn of. `null` refuses. */
  threadId: string | null;
  verdict: Verdict;
  /**
   * What the reader typed, or the catalogue's default sentence for this verdict. Prose, in
   * the reader's language; it carries no structure and nothing parses it back.
   */
  body: string;
}

export type ReviewPlan =
  | { ok: true; threadId: string; message: ReviewMessage }
  | { ok: false; refusal: ReviewRefusal };

/**
 * The whole decision, as a value: may this verdict be sent, and if so, exactly what.
 *
 * A pure function so the refusals are testable without a DOM and without a network — and so
 * that the button's disabled state and the request body cannot disagree, which is the shape
 * of every "the control was enabled and the call 400'd" bug.
 */
export function planReview(input: ReviewInput): ReviewPlan {
  if (!input.threadId) return { ok: false, refusal: 'no_thread' };
  if (!input.headSha) return { ok: false, refusal: 'no_tree' };
  const body = input.body.trim();
  if (!body) return { ok: false, refusal: 'no_body' };
  return {
    ok: true,
    threadId: input.threadId,
    message: {
      body,
      interrupt: 'note',
      payload: { review: input.verdict, runId: input.runId, headSha: input.headSha },
    },
  };
}

/** Which sentence confirms a sent verdict. Two keys, because a verdict name inflects. */
export const OUTCOME_KEY = {
  approved: 'work.review.approved',
  changes_requested: 'work.review.requested',
} as const satisfies Record<Verdict, StringKey>;

/** The default body per verdict, when the reader typed nothing. */
export const DEFAULT_BODY_KEY = {
  approved: 'work.review.body.approved',
  changes_requested: 'work.review.body.changes',
} as const satisfies Record<Verdict, StringKey>;
