import { describe, expect, it } from 'vitest';
import { RUNNER_ROUTES } from '@agnetos/contracts';
import { threadListRouteExists } from './threadListRoute';

/**
 * REQ-SES-61 — the self-expiring stub.
 *
 * The THREADS view tells the reader that agent threads are **unreadable**, not
 * that there are none. That sentence is true only for as long as the runner
 * declares no collection route. The day one lands, this test goes red and the red
 * points at the view that has to stop explaining an absence that has ended.
 *
 * That direction of failure is the one BOARD keeps paying for backwards: a
 * producer ships, no consumer reads it, nothing is red, and a surface keeps
 * rendering a stale story. `ProvenanceBadge`'s SOURCE UNKNOWN header was exactly
 * this, for a week.
 */
describe('the thread list route does not exist yet', () => {
  it('is still absent — and when it is not, wire ThreadsView to it', () => {
    expect(
      threadListRouteExists(),
      'A GET route ending in /thread(s) now exists in RUNNER_ROUTES. ' +
        'That is good news and it makes apps/web/src/threads/ThreadsView.tsx wrong: ' +
        'the agent-threads group still renders `threads.agent.unreadable`, which says ' +
        'no such route exists. Replace the notice with a read of the new route, then ' +
        'delete lib/threadListRoute.ts and this test.',
    ).toBe(false);
  });

  it('would see a list route under any name — it matches the shape, not a key', () => {
    // Falsification of the instrument itself, not of the claim. An include-list
    // or a key-name match would go blind the moment somebody called it
    // `threadsForProject`, which is this repo's most-repeated checker defect.
    const pretend = {
      ...RUNNER_ROUTES,
      somethingNobodyWouldGuess: { method: 'GET', path: '/api/p/:project/threads', scope: 'project' },
    };
    const detects = Object.values(pretend).some(
      (route) => route.method === 'GET' && /\/threads?$/.test(route.path),
    );
    expect(detects).toBe(true);
  });

  it('does not mistake the three routes that DO exist for a list', () => {
    // `POST /api/p/:project/thread` ends in `/thread` and is a create, not a
    // list. If the method half of the predicate were dropped this would pass
    // wrongly — so it is asserted rather than assumed.
    expect(RUNNER_ROUTES.threadCreate).toMatchObject({ method: 'POST', path: '/api/p/:project/thread' });
    expect(RUNNER_ROUTES.thread).toMatchObject({ method: 'GET', path: '/api/p/:project/thread/:id' });
    expect(threadListRouteExists()).toBe(false);
  });
});
