/* =============================================================================
 * threads/lib/threadListRoute.ts — the route that would list threads, and does not exist
 *
 * `Plan §23.8` asks THREADS for a *"thread list grouped by project and kind"*. The
 * runner serves three thread routes and none of them is a list:
 *
 *   POST /api/p/:project/thread            create one from a typed line
 *   GET  /api/p/:project/thread/:id        read one, with its turns
 *   POST /api/p/:project/thread/:id/message  append a turn
 *
 * `api-contracts.md` and `packages/contracts/src/api.ts` are `runner-engineer`'s,
 * and a contract has exactly one owner, so this slice does not add a route to
 * them. What it does instead is refuse to fake one.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THERE IS NO FETCH BEHIND THIS
 *
 * The tempting shape is to call `/api/p/:project/threads` anyway and let
 * `useEndpoint`'s `notBuiltMessage` explain the 404. It was rejected twice over:
 *
 *   1. `check-page-errors.mjs` excuses our own `/api/` **5xx** and says why —
 *      *"a 404 is a wrong URL and stays fatal"*. A consumer of a route that was
 *      never declared is a wrong URL, and dressing it as a backend gap would put a
 *      permanent excuse in a gate whose whole value is that it has none.
 *   2. An honest sentence does not need a round trip to produce. The list is not
 *      *empty*, it is *unreadable*, and those are different claims (BOARD rule 9,
 *      and `unknown` is not `zero`).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THIS IS A SELF-EXPIRING STUB, AND THAT IS THE MECHANISM
 *
 * `threadListRouteExists()` reads `RUNNER_ROUTES` at runtime rather than trusting
 * this comment. `threadListRoute.test.ts` asserts it is still `false` **and says,
 * in the failure message, what to do when it goes true** — so the day
 * `runner-engineer` lands the list route, this repo's own suite turns red and the
 * red points at the view that has to be wired. That is the same instrument as
 * `FAN_OUT_DISPATCH.allowed` and `STEER_DELIVERY.supported`: a claim about the
 * world, pinned by something that fails when the world moves.
 *
 * Without it this file is the other half of BOARD's standing finding — a producer
 * without a consumer — running backwards: a route lands, nothing reads it, nothing
 * is red, and the THREADS list keeps explaining an absence that ended weeks ago.
 * ========================================================================== */

import { RUNNER_ROUTES } from '@agnetos/contracts';

/**
 * Does the runner declare a route that reads *many* threads?
 *
 * Deliberately a shape test rather than a name test. A list route could arrive as
 * `threads`, `threadList` or `threadsForProject`; what it cannot avoid being is a
 * `GET` whose path ends at the collection rather than at one thread's id. Matching
 * on a key name would go blind the moment someone picked a different word, which
 * is this repo's most-repeated checker defect (an include-list is a decision to be
 * blind to everything unnamed).
 */
export function threadListRouteExists(): boolean {
  return Object.values(RUNNER_ROUTES).some(
    (route) => route.method === 'GET' && /\/threads?$/.test(route.path),
  );
}

/**
 * Why the agent-thread half of the list cannot be shown, in the caller's terms.
 *
 * Two reasons, and they are printed together on purpose, because fixing either one
 * alone leaves the list empty and the next reader would then be told a new story:
 * the route does not exist, **and** the table it would read has never met a running
 * Postgres (`0008_threads.sql`, zero runs executed). Naming one would be the defect
 * `useEndpoint` documents at length — a fluent, confident, incomplete explanation
 * that closes the question.
 *
 * The catalogue holds the sentence; this names the key, so the copy stays
 * translatable and this module stays node-loadable.
 */
export const AGENT_THREADS_UNREADABLE_KEY = 'threads.agent.unreadable' as const;
