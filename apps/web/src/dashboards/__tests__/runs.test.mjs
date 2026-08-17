/**
 * `normalizeRuns` — the ledger payload guard, under `node:test`.
 *
 * **The routing table that used to live here moved to `../data/endpoints.test.ts` (Vitest),
 * and the move is part of a repair rather than a preference.** `endpoints.ts` now builds
 * its URLs from `PROJECT_ROUTE_PREFIX` and `projectPath` in `@agnetos/contracts`, so it can
 * no longer be loaded by Node's own runner — Node ESM cannot resolve that package's
 * extensionless barrel. That constraint is exactly why the five metrics paths were typed
 * into `endpoints.ts` as string literals in the first place, and the literals are what let
 * M15 move every metrics route with nothing going red. Keeping the harness and keeping the
 * literals was not an option; the harness lost.
 *
 * What stays here is what has no contract import: the defensive parse of a runs payload.
 * Resolution (the zero-vs-null grammar and the two guards) is in `data/resolve.test.ts`.
 *
 * Run: node --test apps/web/src/dashboards/__tests__/runs.test.mjs
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeRuns } from '../lib/runs.ts';

test('normalizeRuns drops a row without an id, agent or time', () => {
  const rows = normalizeRuns({
    runs: [{ runId: 'x' }, { runId: 'r1', agent: 'operations/audit', startedAt: '2026-08-15T12:00:00Z' }],
  });
  assert.equal(rows.length, 1);
});

test('normalizeRuns returns nothing for a payload it does not understand', () => {
  // An empty list here means "this shape carried no rows I can trust", and the caller
  // renders an empty state. It must never become a row with invented fields.
  assert.deepEqual(normalizeRuns(null), []);
  assert.deepEqual(normalizeRuns({ runs: 'not an array' }), []);
  assert.deepEqual(normalizeRuns({}), []);
});
