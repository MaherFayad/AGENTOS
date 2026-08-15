/**
 * Truncation guard — a capped /api/runs list must not become a plausible KPI.
 * Run: node --test apps/web/src/dashboards/__tests__/runs.test.mjs
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { aggregate, coversWindow, normalizeRuns } from '../lib/runs.ts';

const now = Date.parse('2026-08-15T12:00:00Z');

function run(i, daysAgo) {
  return {
    runId: `r${i}`,
    agent: 'operations/audit',
    status: 'ok',
    startedAt: new Date(now - daysAgo * 86_400_000).toISOString(),
    durationMs: 400,
    costUsd: 0.02,
    traceUrl: null,
  };
}

test('normalizeRuns drops a row without an id, agent or time', () => {
  const rows = normalizeRuns([{ runId: 'x' }, run(1, 0)]);
  assert.equal(rows.length, 1);
});

test('coversWindow is true when the list is shorter than the cap', () => {
  assert.equal(coversWindow([run(1, 0)], 200, now - 7 * 86_400_000), true);
});

test('coversWindow is false when the cap is hit and the oldest row is inside the window', () => {
  const runs = Array.from({ length: 5 }, (_, i) => run(i, 1));
  assert.equal(coversWindow(runs, 5, now - 7 * 86_400_000), false);
});

test('aggregate refuses a truncated window rather than undercounting', () => {
  const runs = Array.from({ length: 5 }, (_, i) => run(i, 1));
  const result = aggregate(runs, { source: 'langfuse', metric: 'runs', range: '7d' }, {
    requestedLimit: 5,
    now,
  });
  assert.equal(result.status, 'unavailable');
});

test('aggregate returns a real zero when the window is fully covered and empty', () => {
  const result = aggregate([], { source: 'langfuse', metric: 'runs', range: '7d' }, {
    requestedLimit: 200,
    now,
  });
  assert.equal(result.status, 'ok');
  assert.equal(result.data, 0);
});
