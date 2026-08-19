/**
 * REQ-DRW-REVIEW — the verdict is a message in the run's own thread, it names the tree it
 * read, and it is not a merge.
 *
 * `contracts/work-product.md` §8. Three properties, each of which was a wave-0 question:
 *
 *  1. It is **not** `POST /api/p/:project/approvals/:runId`. That verb resumes a run paused
 *     at its plan gate and answers a finished run with `run_not_pending_approval` (409).
 *  2. `headSha` is required. *"Approved" with no tree state names nothing* — the tree can
 *     move afterwards, and a verdict that cannot say what it looked at is a claim with no
 *     observation behind it. So the control refuses rather than sends.
 *  3. The verdict is an **object** in `payload`, never composed into the body first.
 *
 * ## What this suite cannot see
 *
 * - It never posts. That the runner accepts this body is `thread-refusals.test.ts`'s and the
 *   route's; here the shape is checked against the contract's own words and nothing more.
 * - It cannot prove no push verb exists anywhere. `diff-never-leaves.test.ts` scans the
 *   runner for that, and it is the gate that matters — this file only proves this module
 *   does not offer one, which a reader can also see by looking.
 *
 * Owner: drawer-engineer · Consumes: comms/contracts/work-product.md §8
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_BODY_KEY, OUTCOME_KEY, planReview, REFUSAL_KEY } from './review';
import { en } from '@/i18n';

const BASE = {
  runId: 'run-1',
  headSha: 'bbbbbbb',
  threadId: 'thread-1',
  body: 'Looks right.',
} as const;

describe('what the button writes', () => {
  it('is a note carrying the verdict as an object', () => {
    const plan = planReview({ ...BASE, verdict: 'approved' });
    expect(plan).toEqual({
      ok: true,
      threadId: 'thread-1',
      message: {
        body: 'Looks right.',
        interrupt: 'note',
        payload: { review: 'approved', runId: 'run-1', headSha: 'bbbbbbb' },
      },
    });
  });

  it('never flattens the verdict into the body', () => {
    const plan = planReview({ ...BASE, verdict: 'changes_requested' });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    // `redact()` walks object keys and a string has none. The body is prose a human typed
    // and nothing reads structure back out of it.
    expect(plan.message.body).toBe('Looks right.');
    expect(plan.message.body).not.toContain('changes_requested');
    expect(plan.message.body).not.toContain('bbbbbbb');
    expect(typeof plan.message.payload).toBe('object');
  });

  it('is a note and cannot be a steer or a halt', () => {
    const plan = planReview({ ...BASE, verdict: 'approved' });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.message.interrupt).toBe('note');
    // @ts-expect-error `ReviewMessage.interrupt` is the literal 'note'. The run is finished,
    // so there is nothing to halt, and this build refuses every steer by type. This
    // directive becomes an *unused directive* — itself an error — the moment the field
    // widens, so lifting the restriction cannot happen without this file being read. Live
    // under `npm run typecheck:tests`, and falsified by deleting this comment:
    // `error TS2322: Type '"halt"' is not assignable to type '"note"'`.
    const widened: typeof plan.message.interrupt = 'halt';
    expect(widened).toBe('halt');
  });
});

describe('the three refusals', () => {
  it('refuses a verdict with no thread to record it in', () => {
    expect(planReview({ ...BASE, threadId: null, verdict: 'approved' })).toEqual({
      ok: false,
      refusal: 'no_thread',
    });
  });

  it('refuses a verdict that cannot name the tree it read', () => {
    expect(planReview({ ...BASE, headSha: null, verdict: 'approved' })).toEqual({
      ok: false,
      refusal: 'no_tree',
    });
  });

  it('refuses an empty body — the route requires one and a silent 400 is not an answer', () => {
    expect(planReview({ ...BASE, body: '   ', verdict: 'approved' })).toEqual({
      ok: false,
      refusal: 'no_body',
    });
  });

  it('gives every refusal a sentence a human can read', () => {
    for (const key of Object.values(REFUSAL_KEY)) {
      expect(en[key].length).toBeGreaterThan(30);
    }
  });

  it('trims the body it does send', () => {
    const plan = planReview({ ...BASE, body: '  needs a test  ', verdict: 'changes_requested' });
    expect(plan.ok && plan.message.body).toBe('needs a test');
  });
});

describe('the sentences beside it', () => {
  it('confirms against the tree it named, so the confirmation is checkable', () => {
    expect(en[OUTCOME_KEY.approved]).toContain('{sha}');
  });

  it('has a default body per verdict, because the route will not take an empty one', () => {
    expect(en[DEFAULT_BODY_KEY.approved]).not.toBe(en[DEFAULT_BODY_KEY.changes_requested]);
  });

  it('says out loud that it is not a merge', () => {
    // Rendered on the screen beside the buttons. M17 records push state and performs
    // nothing — a push is data egress and ADR-038 is `proposed`.
    expect(en['work.review.notMerge']).toMatch(/merge/i);
  });
});

describe('this module offers no verb that could become a push', () => {
  it('names no push, pull-request or merge action', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/drawer/work/review.ts'), 'utf8');
    // Comments explain at length why there is no push here, so they are stripped before the
    // scan — a checker that reads its own documentation as a violation is a checker nobody
    // keeps. The guard below makes sure stripping did not eat the file.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code.length).toBeGreaterThan(400);
    expect(code).toContain('planReview');
    for (const verb of ['git push', 'gh pr', 'createPullRequest', 'merge(']) {
      expect(code).not.toContain(verb);
    }
  });
});
