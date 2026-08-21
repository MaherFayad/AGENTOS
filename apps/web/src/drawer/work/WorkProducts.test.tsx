/**
 * REQ-DRW-WORK-EMPTY — the empty state is the state a human will actually see, and it says
 * why it is empty.
 *
 * Two preconditions are missing, not one (`work-product.md` §0): **no agent run has ever
 * executed**, and **no project has a checked-out repository** a run could work in. So this
 * list will be empty on every deployment that exists today, and rule 9 puts the whole weight
 * of the section on that sentence: an honest empty state beats a plausible fake one, and here
 * the plausible fake is a row.
 *
 * The other half is the one that is easy to get wrong: *nothing to review* and *nothing has
 * ever run* are different sentences, and the flag that chooses between them comes off the
 * **response**, not off the request. Reading the local filter would describe an intention
 * rather than an observation — the house defect, in its filter costume.
 *
 * ## What this suite cannot see
 *
 * - It never fetches. That the roster reads one route for N runs is visible in
 *   `useWorkProducts.ts` and asserted nowhere: no test here counts requests.
 * - Default locale only.
 *
 * Owner: drawer-engineer · Consumes: comms/contracts/work-product.md §0, §4.1, §5.2
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { WorkProductSummary } from '@agnetos/contracts';
import { en } from '@/i18n';
import { WorkProducts, type WorkProductsState } from './WorkProducts';
import { readList } from './useWorkProducts';

const ROW: WorkProductSummary = {
  runId: 'run-1',
  agent: 'sales/account-enrichment',
  threadId: 'thread-1',
  branch: 'agnetos/run/run-1',
  baseSha: 'aaaaaaa',
  headSha: 'bbbbbbb',
  commits: 3,
  filesChanged: 4,
  insertions: 40,
  deletions: 7,
  pushState: null,
  pushCheckedAt: null,
  prUrl: null,
  prState: null,
  ciState: null,
  testsRun: null,
  testsPassed: null,
  diffAvailable: true,
  createdAt: '2026-08-19T11:56:00.000Z',
};

function draw(state: WorkProductsState, review = false) {
  const onReviewFilter = vi.fn();
  const onOpenDiff = vi.fn();
  const { container } = render(
    <WorkProducts
      state={state}
      review={review}
      onReviewFilter={onReviewFilter}
      onOpenDiff={onOpenDiff}
      threadHref={() => '/p/agentos/threads/thread-1'}
      now={Date.parse('2026-08-19T12:00:00.000Z')}
    />,
  );
  return { onReviewFilter, onOpenDiff, container };
}

describe('the empty state', () => {
  it('says why it is empty, and does not invent a row', () => {
    const { container } = draw({ kind: 'ready', rows: [], reviewQueue: false });
    expect(container.textContent).toContain(en['work.empty']);
    expect(container.querySelectorAll('[data-testid^="work-product-"]')).toHaveLength(0);
  });

  it('says something different when the review queue is what came back empty', () => {
    const { container } = draw({ kind: 'ready', rows: [], reviewQueue: true }, true);
    expect(container.textContent).toContain(en['work.emptyReview']);
    // Not the "nothing has ever run" sentence — the list was narrowed, and saying otherwise
    // would blame the build for a filter.
    expect(container.textContent).not.toContain(en['work.empty']);
  });

  it('reads the narrowing off the response, not off the request', () => {
    // The request asked for the review queue; the response says it was not narrowed. The
    // response wins, because it is the observation. A component reading its own prop here
    // would describe what it intended rather than what happened.
    const { container } = draw({ kind: 'ready', rows: [], reviewQueue: false }, true);
    expect(container.textContent).toContain(en['work.empty']);
    expect(container.textContent).not.toContain(en['work.emptyReview']);
  });

  it('is empty rather than wrong when the runner could not be reached', () => {
    const { container } = draw({ kind: 'failed', failure: { kind: 'unreachable', detail: null } });
    expect(container.textContent).toContain(en['drawer.failure.unreachable']);
  });

  /**
   * The branch that actually ships. `GET /api/p/:project/work-products` is fronted by
   * `requireThreadStore`, so on a stack with no Postgres it answers **503
   * `thread_store_unavailable`** with its own sentence — and this section opened every
   * failure with "could not reach the runner", then printed that sentence underneath it.
   */
  it('does not blame the network for a runner that answered and refused', () => {
    const { container } = draw({
      kind: 'failed',
      failure: { kind: 'refused', detail: 'This runner has no thread store.' },
    });
    expect(container.textContent).toContain(en['drawer.failure.refused']);
    expect(container.textContent).toContain('This runner has no thread store.');
    expect(container.textContent).not.toContain(en['drawer.failure.unreachable']);
  });

  it('says it is looking rather than showing nothing while it looks', () => {
    const { container } = draw({ kind: 'loading' });
    expect(container.textContent).toContain(en['work.loading']);
  });
});

describe('the filters', () => {
  it('offers both lists in every state, including the empty one', () => {
    draw({ kind: 'ready', rows: [], reviewQueue: false });
    expect(screen.getByRole('button', { name: en['work.filter.all'] }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: en['work.filter.review'] }).getAttribute('aria-pressed')).toBe('false');
  });

  it('asks for the review queue when the reader picks it', () => {
    const { onReviewFilter } = draw({ kind: 'ready', rows: [], reviewQueue: false });
    screen.getByRole('button', { name: en['work.filter.review'] }).click();
    expect(onReviewFilter).toHaveBeenCalledWith(true);
  });
});

describe('the rows', () => {
  it('renders one line per work product and discloses the scope it is showing', () => {
    const { container } = draw({ kind: 'ready', rows: [ROW], reviewQueue: false });
    expect(container.querySelectorAll('[data-testid="work-product-run-1"]')).toHaveLength(1);
    // The route carries no per-agent filter, so the section says what it is showing rather
    // than filtering client-side and silently dropping rows.
    expect(container.textContent).toContain(en['work.scopeNote']);
  });

  it('makes no blocked claim for a row nothing told us the thread state of', () => {
    const { container } = draw({ kind: 'ready', rows: [ROW], reviewQueue: false });
    expect(container.textContent).not.toContain(en['work.blocked']);
  });
});

describe('a body this build cannot read is its own state', () => {
  it('is not an empty list — that would be a plausible zero', () => {
    // The shape a stale or mis-routed runner sends. Rendering it as "no work products" is
    // rule 9's exact prohibition, and `response.workProducts.length` on an absent array
    // throws out of the render, which is how this drawer took a whole app down once.
    const state = readList({} as never);
    expect(state.kind).toBe('failed');
    expect(state.kind === 'failed' && state.failure).toEqual({ kind: 'unreadable', detail: null });
  });

  it('is not a network fault either — those send a reader somewhere else', () => {
    const state = readList({ workProducts: 'nope', reviewQueue: false } as never);
    expect(state.kind === 'failed' && state.failure.kind).not.toBe('unreachable');
  });

  it('reads a well-formed empty list as an empty list', () => {
    expect(readList({ workProducts: [], reviewQueue: false })).toEqual({
      kind: 'ready',
      rows: [],
      reviewQueue: false,
    });
  });

  it('does not take a missing reviewQueue flag as a narrowing', () => {
    // A response that does not say it narrowed the list has not said it did. Defaulting to
    // the caller's request here would answer with the intention a second time.
    const state = readList({ workProducts: [] } as never);
    expect(state.kind === 'ready' && state.reviewQueue).toBe(false);
  });
});
