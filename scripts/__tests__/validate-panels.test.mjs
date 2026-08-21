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
  department: ['ai'],
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

/* ------------------------------------------------------- ADR-028: the cap */

test('seven canonical types, and at most three extensions, ever', () => {
  assert.equal(ENUMS.CANONICAL_WIDGET_TYPES.length, 7);
  assert.equal(ENUMS.EXTENSION_CAP, 3);
  assert.ok(ENUMS.EXTENSION_WIDGET_TYPES.length <= ENUMS.EXTENSION_CAP);
  // The three names are the whole allowance. A fourth need does not spend a spare.
  assert.deepEqual(ENUMS.EXTENSION_WIDGET_TYPES, ['thread-feed', 'board', 'calendar']);
  // Only the built ones are usable in a panel; the rest are named and refused. Two of the
  // three are spent — `thread-feed` (M16) and `calendar` (M18) — and `board` waits on
  // ADR-029's drag primitive, which is unwritten.
  assert.deepEqual(ENUMS.BUILT_EXTENSION_WIDGET_TYPES, ['thread-feed', 'calendar']);
  assert.deepEqual(ENUMS.WIDGET_TYPES.length, 9);
  assert.deepEqual(ENUMS.RESERVED_WIDGET_TYPES, ['board']);
});

test('a fourth widget type fails the parity gate — the enforcer, falsified', () => {
  // Plant the defect: panels.ts declares a fourth extension. This is what an implementer
  // adding `gantt` would actually write, and it must be red before anything renders it.
  const planted = `
export const PANEL_SCHEMA_VERSION = 1;
export const CANONICAL_WIDGET_TYPES = ${JSON.stringify(ENUMS.CANONICAL_WIDGET_TYPES).replace(/"/g, "'")} as const;
export const EXTENSION_WIDGET_TYPES = ['thread-feed', 'board', 'calendar', 'gantt'] as const;
export const BUILT_EXTENSION_WIDGET_TYPES = ['thread-feed'] as const;
`;
  const found = errors(checkContractParity(planted));
  assert.ok(found.some((m) => m.includes('ADR-028 caps')), found.join('\n'));
  assert.ok(found.some((m) => m.includes('"gantt" is not one of')), found.join('\n'));
});

test('a renamed extension fails even at three — the cap is a list of names', () => {
  const planted = `
export const PANEL_SCHEMA_VERSION = 1;
export const CANONICAL_WIDGET_TYPES = ${JSON.stringify(ENUMS.CANONICAL_WIDGET_TYPES).replace(/"/g, "'")} as const;
export const EXTENSION_WIDGET_TYPES = ['thread-feed', 'board', 'kanban'] as const;
export const BUILT_EXTENSION_WIDGET_TYPES = ['thread-feed'] as const;
`;
  const found = errors(checkContractParity(planted));
  assert.ok(found.some((m) => m.includes('"kanban" is not one of')), found.join('\n'));
});

test('a reserved type is refused with its own sentence, not as a typo', () => {
  for (const type of ENUMS.RESERVED_WIDGET_TYPES) {
    const panel = base();
    panel.widgets[0].type = type;
    const found = errors(validatePanel(panel, { fileName: 'sample-center.json' }));
    assert.ok(found.some((m) => m.includes('reserved by ADR-028')), `${type}: ${found.join('\n')}`);
  }
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

/* ------------------------------------------------ thread-feed (ADR-028) */

const threadFeed = (over = {}) => {
  const panel = base();
  panel.widgets.push({
    id: 'threads',
    type: 'thread-feed',
    title: 'Runs, by thread',
    query: { source: 'langfuse', metric: 'runs', shape: 'list', limit: 24 },
    emptyState: 'No runs yet, so no thread has anything to show.',
    unthreadedState: '{value} runs in this window belong to no thread.',
    ...over,
  });
  return errors(validatePanel(panel, { fileName: 'sample-center.json' }));
};

test('a thread-feed is valid with both of its sentences', () => {
  assert.deepEqual(threadFeed(), []);
});

test('a thread-feed must carry both emptinesses, separately', () => {
  // "nothing happened" and "things happened, none of them threaded" are different claims,
  // and only the second is true today. One sentence for both would let the widget tell a
  // reader their thread is quiet when the truth is that nothing writes thread_id.
  assert.ok(threadFeed({ emptyState: undefined }).some((m) => m.includes('emptyState is required')));
  assert.ok(threadFeed({ unthreadedState: undefined }).some((m) => m.includes('unthreadedState')));
});

test('unthreadedState must show the count it claims, and invent no other number', () => {
  assert.ok(
    threadFeed({ unthreadedState: 'Some runs belong to no thread.' }).some((m) => m.includes('{value}')),
    'a sentence that cannot print the count was accepted',
  );
  assert.ok(
    threadFeed({ unthreadedState: '{value} of 40 runs belong to no thread.' }).some((m) =>
      m.includes('standing rule 9'),
    ),
    'a hardcoded figure beside the observed one was accepted',
  );
});

/* --------------------------------------------------- calendar (ADR-028) */

const calendar = (over = {}) => {
  const panel = base();
  panel.widgets.push({
    id: 'schedule-week',
    type: 'calendar',
    title: 'The week ahead',
    query: { source: 'sql', name: 'schedule_week' },
    emptyState: 'No schedules yet — the coordinator writes ops.schedule when an agent is put on a clock.',
    unplaceableState: 'Schedules with no occurrence computed for this week: {value}.',
    projectionState: 'Occurrences on this grid: {value}. Nothing is projected beside them, because no run has completed.',
    ...over,
  });
  return errors(validatePanel(panel, { fileName: 'sample-center.json' }));
};

test('a calendar is valid with its three sentences and a registered query name', () => {
  assert.deepEqual(calendar(), []);
});

test('a calendar reads ops.schedule, so its source must be sql', () => {
  // A run ledger cannot answer what has not run. Accepting `langfuse` here would print a
  // future off the past plane, which is the wrong table wearing the right number.
  assert.ok(
    calendar({ query: { source: 'langfuse', metric: 'runs', range: '7d' } }).some((m) =>
      m.includes('must be "sql" on a calendar'),
    ),
  );
  assert.ok(
    calendar({ query: { source: 'static', value: 3, note: 'a literal standing in for a week of schedules' } }).some(
      (m) => m.includes('must be "sql" on a calendar'),
    ),
  );
});

test('a calendar carries three separate claims, and none of them is optional', () => {
  // "no schedules exist", "schedules exist that nobody can place on a day", and "here is
  // what the grid totals" are three different facts. The second is the true one today,
  // because nothing computes an occurrence (scheduling.md §6).
  assert.ok(calendar({ emptyState: undefined }).some((m) => m.includes('emptyState is required')));
  assert.ok(calendar({ unplaceableState: undefined }).some((m) => m.includes('unplaceableState')));
  assert.ok(calendar({ projectionState: undefined }).some((m) => m.includes('projectionState')));
});

test('a calendar sentence must print the count it claims, and invent no other number', () => {
  assert.ok(calendar({ unplaceableState: 'Some schedules could not be placed.' }).some((m) => m.includes('{value}')));
  assert.ok(
    calendar({ projectionState: '{value} of 40 occurrences this week.' }).some((m) => m.includes('standing rule 9')),
  );
});

test('no money figure reaches a calendar, in any of its three sentences', () => {
  // `Plan §14` asks for the grid "annotated with projected cost" and there is no cost: zero
  // runs have completed, so there is nothing to average, and a calendar multiplies a guessed
  // figure by every cell on screen. `CalendarProjection.estimatedUsd` is typed `null` so the
  // number cannot compile; this is the same refusal where the copy lives.
  for (const [key, sentence] of [
    ['projectionState', 'Occurrences: {value}, about $4 each.'],
    ['unplaceableState', 'Unplaceable: {value}. Roughly two dollars a run.'],
    ['emptyState', 'No schedules yet — projected spend is USD zero.'],
  ]) {
    assert.ok(
      calendar({ [key]: sentence }).some((m) => m.includes('names money')),
      `${key}: a money figure was accepted`,
    );
  }
});

test('a calendar refuses a tone — colour is data ink, and this grid has no value to ink', () => {
  // BOARD rule 1 at the data layer. `Plan §14` asks for a grid coloured by department;
  // seven departments against seven hues is where that rule dies first (scheduling.md §10).
  // The renderer would silently ignore a tone, which is worse than refusing it.
  assert.ok(calendar({ tone: 'coral' }).some((m) => m.includes('tone is not accepted on a calendar')));
});

test('a calendar refuses a limit — a hidden lane is an undercount that looks like data', () => {
  assert.ok(calendar({ limit: 5 }).some((m) => m.includes('limit is not accepted on a calendar')));
});

test('the built-extension count is read out of panels.ts, not mirrored here', () => {
  // Falsified with a hand-edited count that still satisfies `0 | 1 | 2 | 3`: the type alone
  // cannot see a number that disagrees with the array it is supposed to be counting.
  const planted = `
export const PANEL_SCHEMA_VERSION = 1;
export const CANONICAL_WIDGET_TYPES = ${JSON.stringify(ENUMS.CANONICAL_WIDGET_TYPES).replace(/"/g, "'")} as const;
export const EXTENSION_WIDGET_TYPES = ['thread-feed', 'board', 'calendar'] as const;
export const BUILT_EXTENSION_WIDGET_TYPES = ['thread-feed', 'calendar'] as const;
export const WIDGET_TYPE_EXTENSIONS_BUILT: 0 | 1 | 2 | 3 = 1;
`;
  const found = errors(checkContractParity(planted));
  assert.ok(
    found.some((m) => m.includes('WIDGET_TYPE_EXTENSIONS_BUILT is "1"')),
    found.join('\n'),
  );
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

/* ------------------------------------------------- §2.5.7 the footer CTA */

const withCta = (cta) => {
  const panel = base();
  panel.footer = { lead: 'This is the actual product.', detail: 'Your delivery ops.', cta };
  return errors(validatePanel(panel, { fileName: 'sample-center.json' }));
};

test('a CTA with an in-app href is accepted', () => {
  assert.deepEqual(withCta({ label: 'Get this deployed →', href: '/approvals' }), []);
});

test('a CTA with no href must say why it is not a link', () => {
  // Otherwise "omit the href" becomes a silent way to ship a button that does nothing —
  // and the reader is left to guess whether it is broken or simply not built yet.
  assert.ok(withCta({ label: 'Get this deployed →' }).some((m) => m.includes('add a "note"')));
  assert.deepEqual(withCta({ label: 'Get this deployed →', note: 'not built yet' }), []);
});

test('a CTA href may not carry a project segment', () => {
  // Panels are mounted per project (project-scoping.md §5.1 Q8), so a slug in a panel file
  // is a second copy of the mount. The renderer prefixes the project the reader is in.
  assert.ok(
    withCta({ label: 'Go', href: '/p/agentos/approvals' }).some((m) => m.includes('/p/:project')),
  );
});

test('a CTA href may not leave the app', () => {
  assert.ok(withCta({ label: 'Go', href: 'https://example.com' }).some((m) => m.includes('in-app path')));
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

/**
 * ADR-042 deleted four of ADR-004's six Command Centers — `pipeline`, `content-studio`,
 * `finance` and `client-delivery` were each scoped to a department that no longer exists.
 * Two ship today, and `progress-table` therefore has no panel exercising its renderer.
 *
 * The coverage claim is kept but **inverted**: rather than asserting every type is used —
 * which is now false and would have to be deleted — the unexercised set is pinned to an
 * explicit list. A *newly* unexercised type still turns this red, and the list shrinks to
 * empty as the replacement dashboards land. A renderer no panel drives is a renderer no
 * runtime gate has ever executed, which is the hazard this assertion exists to name; the
 * pin keeps that hazard visible instead of retiring it.
 */
const UNEXERCISED_WIDGET_TYPES = ['progress-table'];

test('every shipped panel is valid, and only the named widget types go unexercised', async () => {
  const files = (await readdir(join(ROOT, 'panels'))).filter((f) => f.endsWith('.json'));
  assert.ok(files.length >= 2, 'the panels directory did not load — this gate cannot see what it checks');

  const seen = new Set();
  for (const file of files) {
    const panel = JSON.parse(await readFile(join(ROOT, 'panels', file), 'utf8'));
    assert.deepEqual(errors(validatePanel(panel, { fileName: file })), [], `${file} is invalid`);
    for (const w of panel.widgets) seen.add(w.type);
  }
  const unexercised = [...ENUMS.WIDGET_TYPES].filter((t) => !seen.has(t)).sort();
  assert.deepEqual(
    unexercised,
    [...UNEXERCISED_WIDGET_TYPES].sort(),
    'a widget type gained or lost panel coverage — update UNEXERCISED_WIDGET_TYPES with the panel, not to match the code',
  );
});

test('no shipped panel fakes a business number with a static value', async () => {
  const files = (await readdir(join(ROOT, 'panels'))).filter((f) => f.endsWith('.json'));
  for (const file of files) {
    const raw = await readFile(join(ROOT, 'panels', file), 'utf8');
    assert.ok(!raw.includes('"source": "static"'), `${file} ships a static value — check it is genuinely constant`);
  }
});
