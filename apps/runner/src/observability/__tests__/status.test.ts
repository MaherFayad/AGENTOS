/**
 * The credibility test (Part VII.3, standing rule 9).
 *
 * "N OF 22 LIVE" is the claim the whole map rests on. These assertions exist to make
 * sure the counter can only ever be earned — no frontmatter shortcut, no optimistic
 * default, no counting of runs that never succeeded.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { countLive, deriveStatus, THRESHOLDS, type AgentEvidence } from '../status.ts';

function evidence(over: Partial<AgentEvidence> = {}): AgentEvidence {
  return {
    agent: 'sales/account-enrichment',
    department: 'sales',
    totalRuns: 0,
    successfulRuns: 0,
    recentRuns: 0,
    recentErrors: 0,
    lastRunAt: null,
    lastSuccessAt: null,
    ...over,
  };
}

test('an agent that has never run is draft, whatever its frontmatter claims', () => {
  const derived = deriveStatus(evidence());
  assert.equal(derived.status, 'draft');
  assert.equal(derived.reason, 'Never run.');
  // There is no input to deriveStatus that carries a declared status. That is the
  // design: a hand-edited `status: live` has no path into this function at all.
});

test('the LIVE counter counts only agents with a real successful run', () => {
  const statuses = [
    // Declared live in frontmatter, never actually run — the exact failure mode
    // Part VII.3 warns about.
    deriveStatus(evidence({ agent: 'sales/aspirational' })),
    // Has run, but never successfully.
    deriveStatus(evidence({ agent: 'sales/broken', totalRuns: 2, recentRuns: 2, recentErrors: 2 })),
    // Earned it.
    deriveStatus(
      evidence({ agent: 'sales/account-enrichment', totalRuns: 9, successfulRuns: 9, recentRuns: 9 }),
    ),
    deriveStatus(
      evidence({ agent: 'deals/pipeline-hygiene', department: 'deals', totalRuns: 3, successfulRuns: 2, recentRuns: 3 }),
    ),
  ];

  const counts = countLive(statuses);

  assert.equal(counts.live, 2);
  assert.deepEqual(counts.liveAgents.sort(), ['deals/pipeline-hygiene', 'sales/account-enrichment']);
  assert.deepEqual(counts.byDepartment, { sales: 1, deals: 1 });
  assert.ok(!counts.liveAgents.includes('sales/aspirational'));
  assert.ok(!counts.liveAgents.includes('sales/broken'));
});

test('a sustained error rate flips a live agent to failing', () => {
  const healthy = deriveStatus(
    evidence({ totalRuns: 20, successfulRuns: 18, recentRuns: 20, recentErrors: 2 }),
  );
  assert.equal(healthy.status, 'live');
  assert.equal(healthy.errorRate, 0.1);

  const failing = deriveStatus(
    evidence({ totalRuns: 20, successfulRuns: 12, recentRuns: 20, recentErrors: 8 }),
  );
  assert.equal(failing.status, 'failing');
  assert.equal(failing.errorRate, 0.4);
  assert.match(failing.reason, /8 of the last 20 runs failed/);
});

test('a failing agent is excluded from the LIVE count', () => {
  const counts = countLive([
    deriveStatus(evidence({ totalRuns: 20, successfulRuns: 12, recentRuns: 20, recentErrors: 8 })),
  ]);
  assert.equal(counts.live, 0);
  assert.equal(counts.failing, 1);
});

test('two failures out of two is not enough evidence to raise an amber halo', () => {
  const derived = deriveStatus(
    evidence({ totalRuns: 2, successfulRuns: 0, recentRuns: 2, recentErrors: 2 }),
  );
  assert.equal(derived.status, 'draft', 'below the minimum sample we do not accuse an agent');
  assert.equal(derived.errorRate, null);
  assert.equal(THRESHOLDS.minRunsForErrorRate, 3);
});

test('an agent broken from its very first runs still wears the halo once there is a sample', () => {
  const derived = deriveStatus(
    evidence({ totalRuns: 4, successfulRuns: 0, recentRuns: 4, recentErrors: 4 }),
  );
  assert.equal(derived.status, 'failing');
  assert.equal(countLive([derived]).live, 0, 'and it is still not live');
});

test('the failing threshold is exactly at the boundary, not just past it', () => {
  const atThreshold = deriveStatus(
    evidence({ totalRuns: 4, successfulRuns: 3, recentRuns: 4, recentErrors: 1 }),
  );
  assert.equal(atThreshold.errorRate, THRESHOLDS.failingErrorRate);
  assert.equal(atThreshold.status, 'failing');
});
