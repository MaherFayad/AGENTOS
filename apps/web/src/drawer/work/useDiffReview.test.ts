/**
 * REQ-DRW-DIFF-REFUSAL — the two refusals are told apart by code, never by message text.
 *
 * `work_product_moved` (409) is *the tree changed under you, load it again*.
 * `work_product_unavailable` (410) is *the tree is gone and there is nothing left to read*.
 * They are opposite instructions to a reviewer, and the only thing that distinguishes them
 * reliably is `ApiErrorBody.error.code`, which the contract put there for exactly this.
 *
 * A substring on the message would be a claim you did not narrow — the failure family that
 * has cost this repo a session more than once — and it would break the moment the runner
 * rewords a sentence, which is a thing sentences are for.
 *
 * ## What this suite cannot see
 *
 * It does not exercise `useDiffReview` itself: no fetch is mocked, no component is rendered,
 * and nothing here proves the hook calls this function on the paths it should. The hook's
 * paging behaviour is covered by `diff-model.test.ts` at the level below it and by
 * `DiffScreen.test.tsx` at the level above.
 *
 * Owner: drawer-engineer · Consumes: comms/contracts/api-contracts.md (error codes)
 */

import { describe, expect, it } from 'vitest';
import { API_ERROR_STATUS } from '@agnetos/contracts';
import { ApiCallError } from '../data/client';
import { refusalOf } from './useDiffReview';

describe('the codes this screen renders as refusals exist in the contract', () => {
  it('names two codes the runner can actually send', () => {
    // Reading the contract's own table rather than trusting two string literals. A code
    // renamed upstream fails here instead of quietly never matching at run time — which is
    // the shape of a refusal that silently becomes a generic failure.
    expect(API_ERROR_STATUS.work_product_moved).toBe(409);
    expect(API_ERROR_STATUS.work_product_unavailable).toBe(410);
  });
});

describe('by code, not by message', () => {
  it('maps a moved tree to the reload sentence', () => {
    const error = new ApiCallError('anything at all', undefined, 'work_product_moved');
    expect(refusalOf(error)).toEqual({ kind: 'refused', refusal: 'moved' });
  });

  it('maps a removed tree to the gone sentence', () => {
    const error = new ApiCallError('anything at all', undefined, 'work_product_unavailable');
    expect(refusalOf(error)).toEqual({ kind: 'refused', refusal: 'unavailable' });
  });

  it('is not fooled by a message that mentions the other one', () => {
    // The exact confusion a substring check would produce: a 410 whose sentence explains
    // that the tree *moved and then was removed* would be rendered as "load it again",
    // sending a reviewer round a loop that cannot end.
    const error = new ApiCallError(
      'The worktree moved and was then removed.',
      undefined,
      'work_product_unavailable',
    );
    expect(refusalOf(error)).toEqual({ kind: 'refused', refusal: 'unavailable' });
  });

  it('does not invent a refusal for an error that carried no code', () => {
    // A proxy 502 is not a removed worktree. Collapsing them would put a confident
    // explanation on a fault nobody diagnosed.
    const result = refusalOf(new ApiCallError('The runner answered 502.'));
    expect(result.kind).toBe('failed');
    expect(result.kind === 'failed' && result.message).toBe('The runner answered 502.');
  });

  it('keeps the runner’s hint, which is the half written for a human on a phone', () => {
    const result = refusalOf(new ApiCallError('Something failed.', 'Try again in a minute.'));
    expect(result.kind === 'failed' && result.message).toBe('Something failed. Try again in a minute.');
  });

  it('says nothing at all about a throw that was not an API error', () => {
    expect(refusalOf(new TypeError('boom'))).toEqual({ kind: 'failed', message: '' });
  });
});
