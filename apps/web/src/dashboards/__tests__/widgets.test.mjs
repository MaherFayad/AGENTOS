/**
 * Geometry, rows, bind, prompt — the widget boundary.
 * Avoids importing modules that pull `@agnetos/contracts` as a value (Node ESM
 * cannot resolve that package's extensionless barrel).
 *
 * Run: node --test apps/web/src/dashboards/__tests__/widgets.test.mjs
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { areaPath, barWidths, linePath, progressWidth, sparklinePath } from '../lib/geometry.ts';
import { groupByThread, toBarRows, toScalar, toSeries, toActivityRows, unthreadedCount } from '../lib/rows.ts';
import { bindRange } from '../data/bind.ts';
import { normalizePanelPayload } from '../data/normalize.ts';
import { buildPromptFor, PROMPT_RESERVED_TYPES, PROMPT_WIDGET_TYPES } from '../lib/prompt.ts';
import {
  CANONICAL_WIDGET_TYPES,
  EXTENSION_WIDGET_TYPES,
  isPhaseOneResolvable,
  isReservedWidgetType,
  isWidgetType,
  neighbours,
  RESERVED_WIDGET_TYPES,
  WIDGET_TYPES,
  WIDGET_TYPE_EXTENSION_BUDGET,
  WIDGET_TYPE_EXTENSIONS_USED,
} from '../../../../../packages/contracts/src/panels.ts';

test('seven canonical types plus at most three extensions, and the guard knows each', () => {
  assert.equal(CANONICAL_WIDGET_TYPES.length, 7);
  assert.ok(WIDGET_TYPE_EXTENSIONS_USED <= WIDGET_TYPE_EXTENSION_BUDGET);
  assert.equal(WIDGET_TYPE_EXTENSIONS_USED, EXTENSION_WIDGET_TYPES.length);
  for (const t of WIDGET_TYPES) assert.equal(isWidgetType(t), true);
  assert.equal(isWidgetType('pie-chart'), false);
});

test('a reserved type is never renderable — that is what keeps the never fallthrough honest', () => {
  // `board` and `calendar` are named by ADR-028 and absent from `WidgetType`, so they reach
  // `WidgetView` through `isWidgetType` returning false and land on the placeholder. An arm
  // for them would spend the compiler's exhaustiveness guarantee on something nothing can
  // draw.
  assert.deepEqual(RESERVED_WIDGET_TYPES, ['board', 'calendar']);
  for (const t of RESERVED_WIDGET_TYPES) {
    assert.equal(isReservedWidgetType(t), true);
    assert.equal(isWidgetType(t), false);
  }
  assert.equal(isReservedWidgetType('thread-feed'), false);
});

test('the build prompt names the real vocabulary, not a stale copy of it', () => {
  // The prompt rebuilds a panel. A vocabulary list that drifts from the enum tells the next
  // session to write a file the validator will reject — which is why the mirror is pinned.
  assert.equal(PROMPT_WIDGET_TYPES, WIDGET_TYPES.join(', '));
  assert.equal(PROMPT_RESERVED_TYPES, RESERVED_WIDGET_TYPES.join(', '));
  const text = buildPromptFor(envelope(1, 'mission-control').panel);
  for (const t of WIDGET_TYPES) assert.ok(text.includes(t), `prompt does not name ${t}`);
});

test('barWidths scale against the max, never the total, and keep a visible floor', () => {
  const w = barWidths([100, 50, 0]);
  assert.equal(w[0], 100);
  assert.equal(w[1], 50);
  assert.equal(w[2], 0);
});

test('progressWidth clamps', () => {
  assert.equal(progressWidth(0.4), 40);
  assert.equal(progressWidth(2), 100);
  assert.equal(progressWidth(-1), 0);
  assert.equal(progressWidth('nope'), 0);
});

test('linePath and areaPath never emit NaN', () => {
  assert.equal(linePath([], 40, 16), '');
  assert.ok(!areaPath([1, 2, 3], 40, 16).includes('NaN'));
  assert.ok(!sparklinePath([1, 3, 2]).includes('NaN'));
});

test('toBarRows drops malformed rows rather than rendering undefined', () => {
  const rows = toBarRows([{ label: 'A', value: 1 }, { label: 'nope' }, null, { name: 'B', count: 2 }]);
  assert.deepEqual(rows.map((r) => r.label), ['A', 'B']);
});

test('toScalar never invents a zero for missing data', () => {
  assert.equal(toScalar(null), null);
  assert.equal(toScalar('nope'), null);
  assert.equal(toScalar(0), 0);
  assert.equal(toScalar({ value: 12 }), 12);
});

test('toSeries sorts by time', () => {
  const s = toSeries([
    { t: '2026-08-02', v: 2 },
    { t: '2026-08-01', v: 1 },
  ]);
  assert.deepEqual(s.map((p) => p.t), ['2026-08-01', '2026-08-02']);
});

test('sql queries are not phase-1 resolvable', () => {
  assert.equal(isPhaseOneResolvable({ source: 'sql', name: 'pipeline_value' }), false);
  assert.equal(isPhaseOneResolvable({ source: 'langfuse', metric: 'runs' }), true);
  assert.equal(isPhaseOneResolvable({ source: 'static', value: 1, note: 'the runner monthly cap from compose' }), true);
});

test('bindRange substitutes $range and leaves a literal window alone', () => {
  const bound = bindRange({ source: 'langfuse', metric: 'runs', range: '$range' }, '14d');
  assert.equal(bound.range, '14d');
  const kept = bindRange({ source: 'langfuse', metric: 'runs', range: '7d' }, '14d');
  assert.equal(kept.range, '7d');
});

test('normalizePanelPayload accepts runner envelopes and sorts by order', () => {
  const panels = normalizePanelPayload({
    panels: [envelope(2, 'pipeline'), envelope(1, 'mission-control')],
  });
  assert.deepEqual(panels.map((p) => p.id), ['mission-control', 'pipeline']);
});

test('toActivityRows drops a row with no timestamp rather than stamping now', () => {
  const rows = toActivityRows([{ event: 'Ran', attribution: 'Ops' }]);
  assert.equal(rows.length, 0);
});

test('toActivityRows carries threadId through instead of eating it', () => {
  // The field exists on every activity item the runner serves. A normaliser that dropped it
  // would leave `thread-feed` grouping on nothing, permanently, with no gate red — a
  // producer whose consumer never received it.
  const [row] = toActivityRows([
    { at: '2026-08-18T09:41:00Z', event: 'Ran', agent: 'ops', threadId: 't-1' },
  ]);
  assert.equal(row.threadId, 't-1');
  const [none] = toActivityRows([{ at: '2026-08-18T09:41:00Z', event: 'Ran', agent: 'ops', threadId: null }]);
  assert.equal(none.threadId, undefined);
});

test('groupByThread drops unthreaded rows rather than inventing a thread of one', () => {
  // Every row is unthreaded today (thread-model.md §5.3). Bucketing them under a synthetic
  // id would draw a screen full of threads over a database with none.
  const rows = toActivityRows([
    { at: '2026-08-18T09:00:00Z', event: 'A', agent: 'ops', threadId: 't-1' },
    { at: '2026-08-18T10:00:00Z', event: 'B', agent: 'ops', threadId: 't-1' },
    { at: '2026-08-18T11:00:00Z', event: 'C', agent: 'ops' },
    { at: '2026-08-18T10:30:00Z', event: 'D', agent: 'ops', threadId: 't-2' },
  ]);
  const groups = groupByThread(rows);
  assert.deepEqual(groups.map((g) => g.threadId), ['t-2', 't-1']); // newest thread first
  assert.deepEqual(groups[1].rows.map((r) => r.event), ['B', 'A']); // newest row first
  assert.equal(unthreadedCount(rows), 1);
  assert.equal(groups.reduce((n, g) => n + g.rows.length, 0), 3);
});

test('groupByThread over a fully unthreaded feed reports nothing, not an empty thread', () => {
  const rows = toActivityRows([{ at: '2026-08-18T09:00:00Z', event: 'A', agent: 'ops' }]);
  assert.deepEqual(groupByThread(rows), []);
  assert.equal(unthreadedCount(rows), 1);
});

test('neighbours wrap so the rail ring has no dead end', () => {
  const ring = [
    { order: 1, id: 'a' },
    { order: 2, id: 'b' },
    { order: 3, id: 'c' },
  ];
  assert.equal(neighbours(ring, ring[0]).prev.id, 'c');
  assert.equal(neighbours(ring, ring[0]).next.id, 'b');
  assert.equal(neighbours(ring, ring[2]).next.id, 'a');
});

test('buildPromptFor names the file and forbids a new component', () => {
  const panel = envelope(1, 'mission-control').panel;
  const text = buildPromptFor(panel);
  assert.match(text, /panels\/mission-control\.json/);
  assert.match(text, /Do not add a React component/);
});

function envelope(order, id) {
  return {
    id,
    panel: {
      schemaVersion: 1,
      id,
      title: id,
      caption: 'one line about it',
      railTitle: id.toUpperCase(),
      provider: 'langfuse',
      department: ['operations'],
      order,
      buildPrompt: 'rebuild this panel from the contract',
      kpis: [{ label: 'Runs', format: 'number', query: { source: 'langfuse', metric: 'runs' } }],
      signals: [{ tone: 'wait', lead: 'nothing yet' }],
      widgets: [
        {
          id: 'feed',
          type: 'activity-feed',
          title: 'Feed',
          query: { source: 'langfuse', metric: 'runs', shape: 'list' },
        },
      ],
    },
  };
}
