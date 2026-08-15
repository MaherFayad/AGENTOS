/**
 * Tests for scripts/validate-panels.mjs.
 *
 * The interesting cases are the ones that keep a panel file from becoming an attack
 * surface or a lie: SQL smuggled into data, and numbers with no source behind them.
 *
 * Run: node --test scripts/__tests__/*.test.mjs
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validatePanel, validateQuery, scanForSql, checkContractParity, ENUMS } from '../validate-panels.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

const errors = (issues) => issues.filter((i) => i.level === 'error').map((i) => i.message);

/** A minimal panel that passes, cloned and broken per test. */
const base = () => ({
  schemaVersion: 1,
  id: 'sample-center',
  title: 'Sample · Center',
  caption: 'One line about it',
  railTitle: 'SAMPLE',
  provider: 'langfuse',
  department: ['operations'],
  order: 1,
  buildPrompt: 'a sample command center used only by the validator tests',
  kpis: Array.from({ length: 5 }, (_, i) => ({
    label: `Metric ${i + 1}`,
    format: 'number',
    query: { source: 'langfuse', metric: 'runs', range: '7d' },
  })),
  signals: [
    { tone: 'wait', lead: 'Nothing here yet', detail: 'an honest empty sentence' },
    { tone: 'ok', lead: 'Another statement without figures', detail: 'still no figures' },
  ],
  widgets: [
    {
      id: 'feed',
      type: 'activity-feed',
      title: 'Runs',
      query: { source: 'langfuse', metric: 'runs', shape: 'list', limit: 5 },
    },
  ],
});

test('the baseline fixture is valid', () => {
  assert.deepEqual(errors(validatePanel(base(), { fileName: 'sample-center.json' })), []);
});

test('there are exactly seven widget types', () => {
  assert.equal(ENUMS.WIDGET_TYPES.length, 7);
});

/* ------------------------------------------------------------ SQL safety */

test('rejects SELECT … FROM anywhere in a panel, including prose fields', () => {
  const panel = base();
  panel.buildPrompt = 'rebuild it with select stage, sum(value) from deals group by stage';
  const found = errors(validatePanel(panel, { fileName: 'sample-center.json' }));
  assert.ok(found.some((m) => m.includes('contains SQL')), found.join('\n'));
});

test('rejects mutating statements', () => {
  for (const payload of [
    'drop table deals',
    'delete from invoices',
    'insert into runs values (1)',
    "update deals set stage='won'",
    'union all select password from users',
    'grant all on schema public',
  ]) {
    const issues = scanForSql({ emptyState: payload });
    assert.ok(issues.length === 1, `${payload} was not caught`);
  }
});

test('rejects a query key that could carry a statement', () => {
  const out = [];
  validateQuery({ source: 'sql', name: 'pipeline_by_stage', sql: 'select 1' }, '$.q', out);
  assert.ok(errors(out).some((m) => m.includes('$.q.sql is forbidden')), errors(out).join('\n'));
});

test('rejects sql params carrying quotes or semicolons', () => {
  const out = [];
  validateQuery({ source: 'sql', name: 'deals_open_list', params: { owner: "x'; drop table deals--" } }, '$.q', out);
  assert.ok(errors(out).some((m) => m.includes('quote, semicolon or backslash')), errors(out).join('\n'));
});

test('rejects nested payloads in sql params', () => {
  const out = [];
  validateQuery({ source: 'sql', name: 'deals_open_list', params: { filters: { stage: 'won' } } }, '$.q', out);
  assert.ok(errors(out).some((m) => m.includes('no nested payloads')), errors(out).join('\n'));
});

test('a registered query name must look like an identifier', () => {
  const out = [];
  validateQuery({ source: 'sql', name: 'SELECT *' }, '$.q', out);
  assert.ok(errors(out).length > 0);
});

/* ------------------------------------------------- numbers must be real */

test('rejects a hardcoded figure in a signal with no query', () => {
  const panel = base();
  panel.signals[0] = { tone: 'warn', lead: '$44,500 stalled across 2 deals', detail: 'oldest untouched 33d.' };
  const found = errors(validatePanel(panel, { fileName: 'sample-center.json' }));
  assert.ok(found.some((m) => m.includes('standing rule 9')), found.join('\n'));
});

test('a signal with a query must carry the sentence shown before data exists', () => {
  const panel = base();
  panel.signals[0] = {
    tone: 'warn',
    lead: '{value} runs failed',
    query: { source: 'langfuse', metric: 'runs', filter: { status: 'error' }, range: '7d' },
  };
  const found = errors(validatePanel(panel, { fileName: 'sample-center.json' }));
  assert.ok(found.some((m) => m.includes('.pending is required')), found.join('\n'));
});

test('a static value must say where it came from', () => {
  const out = [];
  validateQuery({ source: 'static', value: 42 }, '$.q', out);
  assert.ok(errors(out).some((m) => m.includes('note is required')), errors(out).join('\n'));

  const thin = [];
  validateQuery({ source: 'static', value: 42, note: 'target' }, '$.q', thin);
  assert.ok(errors(thin).some((m) => m.includes('standing rule 9')), errors(thin).join('\n'));

  const good = [];
  validateQuery(
    { source: 'static', value: 42, note: 'the runner monthly cap set in infra/compose env' },
    '$.q',
    good,
  );
  assert.deepEqual(errors(good), []);
});

test('a sql-backed widget must declare an honest empty state', () => {
  const panel = base();
  panel.widgets.push({
    id: 'stages',
    type: 'bar-list',
    title: 'Pipeline by stage',
    query: { source: 'sql', name: 'pipeline_by_stage' },
  });
  const found = errors(validatePanel(panel, { fileName: 'sample-center.json' }));
  assert.ok(found.some((m) => m.includes('emptyState is required')), found.join('\n'));
});

/* ------------------------------------------------------------- structure */

test('rejects an eighth widget type', () => {
  const panel = base();
  panel.widgets[0].type = 'gauge';
  const found = errors(validatePanel(panel, { fileName: 'sample-center.json' }));
  assert.ok(found.some((m) => m.includes('is not one of')), found.join('\n'));
});

test('rejects a span other than 1 or 2', () => {
  const panel = base();
  panel.widgets[0].span = 3;
  assert.ok(errors(validatePanel(panel, { fileName: 'sample-center.json' })).some((m) => m.includes('span must be')));
});

test('enforces the 5–6 KPI row and the 2–4 signal strip', () => {
  const few = base();
  few.kpis = few.kpis.slice(0, 3);
  assert.ok(errors(validatePanel(few, { fileName: 'sample-center.json' })).some((m) => m.includes('§2.5.3')));

  const many = base();
  many.signals = [...many.signals, ...many.signals, ...many.signals];
  assert.ok(errors(validatePanel(many, { fileName: 'sample-center.json' })).some((m) => m.includes('§2.5.4')));
});

test('the file name must match the id', () => {
  assert.ok(
    errors(validatePanel(base(), { fileName: 'something-else.json' })).some((m) => m.includes('must match id')),
  );
});

test('the rail label must be uppercase', () => {
  const panel = base();
  panel.railTitle = 'Sample';
  assert.ok(errors(validatePanel(panel, { fileName: 'sample-center.json' })).some((m) => m.includes('uppercase')));
});

test('a panel may only claim ADR-001 departments', () => {
  const panel = base();
  panel.department = ['growth'];
  assert.ok(errors(validatePanel(panel, { fileName: 'sample-center.json' })).some((m) => m.includes('ADR-001')));
});

test('$range without range pills is rejected', () => {
  const panel = base();
  panel.kpis[0].query.range = '$range';
  assert.ok(errors(validatePanel(panel, { fileName: 'sample-center.json' })).some((m) => m.includes('$range')));

  panel.filters = { type: 'range', options: ['7d', '28d'], default: '7d' };
  assert.deepEqual(errors(validatePanel(panel, { fileName: 'sample-center.json' })), []);
});

test('a data table must declare its columns', () => {
  const panel = base();
  panel.widgets[0] = {
    id: 'deals',
    type: 'data-table',
    title: 'Deals',
    query: { source: 'langfuse', metric: 'runs', shape: 'list' },
  };
  assert.ok(errors(validatePanel(panel, { fileName: 'sample-center.json' })).some((m) => m.includes('columns')));
});

/* ---------------------------------------------------------- the real files */

test('the enum copies match packages/contracts/src/panels.ts', async () => {
  const ts = await readFile(join(ROOT, 'packages', 'contracts', 'src', 'panels.ts'), 'utf8');
  assert.deepEqual(errors(checkContractParity(ts)), []);
});

test('every shipped panel is valid and every widget type is exercised', async () => {
  const files = (await readdir(join(ROOT, 'panels'))).filter((f) => f.endsWith('.json'));
  assert.ok(files.length >= 6, 'ADR-004 ships six Command Centers');

  const seen = new Set();
  for (const file of files) {
    const panel = JSON.parse(await readFile(join(ROOT, 'panels', file), 'utf8'));
    assert.deepEqual(errors(validatePanel(panel, { fileName: file })), [], `${file} is invalid`);
    for (const w of panel.widgets) seen.add(w.type);
  }
  assert.deepEqual([...seen].sort(), [...ENUMS.WIDGET_TYPES].sort());
});

test('no shipped panel fakes a business number with a static value', async () => {
  const files = (await readdir(join(ROOT, 'panels'))).filter((f) => f.endsWith('.json'));
  for (const file of files) {
    const raw = await readFile(join(ROOT, 'panels', file), 'utf8');
    assert.ok(!raw.includes('"source": "static"'), `${file} ships a static value — check it is genuinely constant`);
  }
});
