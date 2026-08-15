import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRUNE_CRON, readSchedule, renderConfig, renderJob, renderPruneJob } from '../sync-ofelia.mjs';

test('readSchedule pulls a 5-field cron out of SKILL.md frontmatter', () => {
  const source = `---
name: X
schedule: "0 6 * * 1"
---
body
`;
  assert.equal(readSchedule(source), '0 6 * * 1');
  assert.equal(readSchedule('---\nname: X\n---\n'), null);
});

test('renderJob emits the documented ofelia job-run shape, posting to POST /api/run', () => {
  const ini = renderJob({ agent: 'sales/account-enrichment', cron: '0 6 * * 1' });
  assert.equal(ini.includes('[job-run "sales/account-enrichment"]'), true);
  assert.equal(ini.includes('schedule = 0 6 * * 1'), true);
  assert.equal(ini.includes('network  = agnetos_cc'), true);
  assert.equal(ini.includes('POST http://runner:8787/api/run'), true);
  assert.equal(ini.includes('sales/account-enrichment'), true);
});

test('renderPruneJob emits ADR-008 nightly POST /api/ops/prune', () => {
  const ini = renderPruneJob();
  assert.equal(ini.includes('[job-run "ops/prune"]'), true);
  assert.equal(ini.includes(`schedule = ${PRUNE_CRON}`), true);
  assert.equal(ini.includes('POST http://runner:8787/api/ops/prune'), true);
  assert.equal(ini.includes('/api/run'), false, 'prune must not hit the agent run path');
});

test('an empty library still writes the system prune job, with no agent jobs', () => {
  const ini = renderConfig([]);
  assert.equal(ini.includes('GENERATED FILE'), true);
  assert.equal(ini.includes('No scheduled agents'), true);
  assert.equal(ini.includes('[job-run "ops/prune"]'), true, 'ADR-008 prune is always emitted');
  // Example agent job stays commented (lines start with `;`).
  assert.equal(/^\[job-run "sales\//m.test(ini), false, 'the example agent job stays commented');
});
