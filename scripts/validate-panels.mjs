#!/usr/bin/env node
/**
 * validate-panels.mjs
 *
 * `panels/*.json` is the DASHBOARDS view (§2.4–2.5). Dashboards are data, not code, which
 * means a panel file is **user-editable input to a renderer and to the runner's query
 * layer**. Two failure modes follow from that, and this script exists for both:
 *
 * 1. A malformed panel must fail in CI, not in the browser at 1am. Unknown widget types
 *    render a placeholder rather than crashing (contract rule 1) — that is a runtime
 *    safety net, not a licence to ship one.
 * 2. **A panel file must never carry SQL.** `sql` queries reference a named, registered,
 *    parameterized query owned by the runner. A panel that can carry a query string is an
 *    injection surface with a text editor in front of it. Everything under "SQL safety"
 *    below is that rule, enforced.
 *
 * It also parity-checks its own enum copies against `packages/contracts/src/panels.ts`, so
 * the TypeScript, this script and `comms/contracts/panel-schema.md` cannot drift apart
 * quietly — the usual way a schema rots.
 *
 * Dependency-free Node ESM, same shape as check-spec-coverage.mjs.
 *
 * Usage: node scripts/validate-panels.mjs [--json]
 */

import { readFile, readdir } from 'node:fs/promises';
import { join, dirname, resolve, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PANELS_DIR = join(ROOT, 'panels');
const CONTRACT_TS = join(ROOT, 'packages', 'contracts', 'src', 'panels.ts');

/* -------------------------------------------------------------------- enums
 * Mirrors of packages/contracts/src/panels.ts. checkContractParity() proves they match.
 */

/** §2.5.5. Closed — ADR-028. */
const CANONICAL_WIDGET_TYPES = [
  'bar-list',
  'source-bar-list',
  'area-chart',
  'cost-table',
  'data-table',
  'progress-table',
  'activity-feed',
];

/** ADR-028's whole allowance: three names, ever. Not a budget of slots. */
const EXTENSION_WIDGET_TYPES = ['thread-feed', 'board', 'calendar'];

/**
 * The extensions with a schema and a renderer — `thread-feed` (M16) and `calendar` (M18,
 * once `ops.schedule` existed). The rest are named and reserved.
 */
const BUILT_EXTENSION_WIDGET_TYPES = ['thread-feed', 'calendar'];

/** ADR-028's cap. A fourth extension is a reversal of that ADR, not an application of it. */
const EXTENSION_CAP = 3;

export const ENUMS = {
  SCHEMA_VERSION: 1,
  CANONICAL_WIDGET_TYPES,
  EXTENSION_WIDGET_TYPES,
  BUILT_EXTENSION_WIDGET_TYPES,
  EXTENSION_CAP,
  /** What a panel may declare: the seven plus the extensions that are actually built. */
  WIDGET_TYPES: [...CANONICAL_WIDGET_TYPES, ...BUILT_EXTENSION_WIDGET_TYPES],
  /** Named, unbuilt — refused with a sentence rather than with "not one of". */
  RESERVED_WIDGET_TYPES: EXTENSION_WIDGET_TYPES.filter((t) => !BUILT_EXTENSION_WIDGET_TYPES.includes(t)),
  QUERY_SOURCES: ['langfuse', 'sql', 'static'],
  LANGFUSE_METRICS: ['runs', 'cost', 'latency_p50', 'error_rate'],
  LANGFUSE_GROUPINGS: ['agent', 'department', 'model', 'day'],
  QUERY_SHAPES: ['scalar', 'series', 'list'],
  COMPARISONS: ['previous-period'],
  FORMATS: ['currency', 'number', 'percent', 'duration', 'relative-time'],
  TONES: ['coral', 'lavender', 'teal', 'copper', 'amber', 'grey'],
  SIGNAL_TONES: ['warn', 'ok', 'wait'],
  CHIP_TONES: ['ok', 'alert', 'neutral'],
  PROGRESS_STATUSES: ['on-track', 'at-risk'],
  COLUMN_TYPES: ['text', 'chip', 'number'],
  FILTER_TYPES: ['segmented', 'range'],
  /**
   * ADR-001 + ADR-041 department slugs — a panel may only claim real departments.
   *
   * A mirror of `packages/contracts/src/departments.ts`, and `validate:frontmatter` fails on
   * any disagreement with it (ADR-041). It is a literal rather than an import because this
   * module's `ENUMS` is consumed as a static object by `validate-panels.test.mjs`; the gate
   * is what makes the literal safe.
   */
  DEPARTMENTS: [
    'product',
    'design',
    'frontend',
    'backend',
    'ai',
    'intelligence',
  ],
};

/**
 * A currency symbol, code or money word — refused in a `calendar`'s copy.
 *
 * Not a general rule: a `cost-table` prints money it read from the ledger. It is the
 * calendar's rule because a week grid is the one surface that multiplies a per-run figure
 * by every cell on screen before anyone checks it, and no completed run exists to derive
 * that figure from (`comms/contracts/scheduling.md` §6). The word "cost" is deliberately
 * legal: the honest sentence has to be able to say there is no cost projection.
 */
const MONEY_PATTERN = /[$€£¥₹﷼]|\b(usd|sar|eur|gbp|dollars?|cents?|riyals?)\b/i;

const ID = /^[a-z][a-z0-9-]{2,63}$/;
const SQL_NAME = /^[a-z][a-z0-9_]{2,63}$/;
/** Column and param keys are identifiers, not names — `at` and `id` are legal. */
const KEY = /^[a-z][a-z0-9_]{0,63}$/;
const RANGE = /^\d{1,3}[hdw]$/;
const RANGE_BINDING = '$range';

/* --------------------------------------------------------------- SQL safety
 * Deny-list, applied to every string in the file — including titles, captions and build
 * prompts, because "it's only a caption" is how the first injection always arrives.
 */

const SQL_PATTERNS = [
  { re: /\bselect\b[\s\S]{0,240}?\bfrom\b/i, why: 'SELECT … FROM' },
  { re: /\binsert\s+into\b/i, why: 'INSERT INTO' },
  { re: /\bupdate\b[\s\S]{0,80}?\bset\b/i, why: 'UPDATE … SET' },
  { re: /\bdelete\s+from\b/i, why: 'DELETE FROM' },
  { re: /\bdrop\s+(table|database|schema|view|index)\b/i, why: 'DROP' },
  { re: /\balter\s+(table|role|user)\b/i, why: 'ALTER' },
  { re: /\btruncate\s+table\b/i, why: 'TRUNCATE' },
  { re: /\bcreate\s+(table|view|function|role)\b/i, why: 'CREATE' },
  { re: /\bunion\s+(all\s+)?select\b/i, why: 'UNION SELECT' },
  { re: /\bgrant\s+\w+\s+on\b/i, why: 'GRANT' },
  { re: /\binformation_schema\b/i, why: 'information_schema' },
  { re: /\bpg_(catalog|sleep|read_file|ls_dir)\b/i, why: 'pg_* internals' },
  { re: /;\s*(--|\/\*)/, why: 'statement terminator followed by a comment' },
  { re: /\bcopy\b[\s\S]{0,40}?\bfrom\s+program\b/i, why: 'COPY FROM PROGRAM' },
];

/** Keys that would smuggle a statement past the `name`-only rule. */
const FORBIDDEN_QUERY_KEYS = ['sql', 'rawsql', 'statement', 'text', 'query', 'body', 'where'];

/** Walks every string in a parsed panel and reports SQL-shaped content. */
export function scanForSql(value, path = '$') {
  const issues = [];
  const walk = (node, at) => {
    if (typeof node === 'string') {
      for (const { re, why } of SQL_PATTERNS) {
        if (re.test(node)) {
          issues.push({
            level: 'error',
            message: `${at}: contains SQL (${why}). Panel files carry a registered query *name*, never SQL.`,
          });
          break;
        }
      }
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, `${at}[${i}]`));
      return;
    }
    if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) walk(v, `${at}.${k}`);
    }
  };
  walk(value, path);
  return issues;
}

/* ------------------------------------------------------------------ helpers */

const err = (out, message) => out.push({ level: 'error', message });
const warn = (out, message) => out.push({ level: 'warn', message });

const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

function requireString(out, obj, key, at, { pattern, max } = {}) {
  const v = obj?.[key];
  if (typeof v !== 'string' || v.trim() === '') {
    err(out, `${at}.${key} is required and must be a non-empty string`);
    return null;
  }
  if (pattern && !pattern.test(v)) err(out, `${at}.${key} "${v}" does not match ${pattern}`);
  if (max && v.length > max) err(out, `${at}.${key} is longer than ${max} characters`);
  return v;
}

function requireEnum(out, obj, key, values, at, { optional = false } = {}) {
  const v = obj?.[key];
  if (v === undefined) {
    if (!optional) err(out, `${at}.${key} is required (one of ${values.join(' | ')})`);
    return null;
  }
  if (!values.includes(v)) err(out, `${at}.${key} "${v}" is not one of ${values.join(' | ')}`);
  return v;
}

function checkRange(out, range, at) {
  if (range === undefined) return;
  if (range === RANGE_BINDING) return;
  if (typeof range !== 'string' || !RANGE.test(range))
    err(out, `${at}.range "${range}" must match ${RANGE} or be the binding token "${RANGE_BINDING}"`);
}

/* ------------------------------------------------------------------ queries */

export function validateQuery(query, at, out) {
  if (!isObject(query)) {
    err(out, `${at} is required and must be a query object`);
    return null;
  }

  for (const key of Object.keys(query)) {
    if (FORBIDDEN_QUERY_KEYS.includes(key.toLowerCase()))
      err(out, `${at}.${key} is forbidden — a query declares a registered name, not a statement`);
  }

  const source = requireEnum(out, query, 'source', ENUMS.QUERY_SOURCES, at);

  if (source === 'langfuse') {
    requireEnum(out, query, 'metric', ENUMS.LANGFUSE_METRICS, at);
    requireEnum(out, query, 'shape', ENUMS.QUERY_SHAPES, at, { optional: true });
    requireEnum(out, query, 'groupBy', ENUMS.LANGFUSE_GROUPINGS, at, { optional: true });
    requireEnum(out, query, 'compare', ENUMS.COMPARISONS, at, { optional: true });
    checkRange(out, query.range, at);
    if (query.shape === 'list' && !query.groupBy && query.metric !== 'runs')
      err(out, `${at}: a list-shaped ${query.metric} query needs a groupBy`);
    if (query.limit !== undefined && (!Number.isInteger(query.limit) || query.limit < 1 || query.limit > 200))
      err(out, `${at}.limit must be an integer 1..200`);
    if (query.filter !== undefined) {
      if (!isObject(query.filter)) err(out, `${at}.filter must be an object`);
      else
        for (const [k, v] of Object.entries(query.filter)) {
          if (!['agent', 'department', 'status'].includes(k))
            err(out, `${at}.filter.${k} is not a filterable field (agent | department | status)`);
          if (typeof v !== 'string') err(out, `${at}.filter.${k} must be a string`);
          if (k === 'department' && !ENUMS.DEPARTMENTS.includes(v))
            err(out, `${at}.filter.department "${v}" is not an ADR-001 department slug`);
        }
    }
  }

  if (source === 'sql') {
    requireString(out, query, 'name', at, { pattern: SQL_NAME });
    requireEnum(out, query, 'shape', ENUMS.QUERY_SHAPES, at, { optional: true });
    checkRange(out, query.range, at);
    if (query.params !== undefined) {
      if (!isObject(query.params)) err(out, `${at}.params must be an object of scalars`);
      else
        for (const [k, v] of Object.entries(query.params)) {
          if (!KEY.test(k)) err(out, `${at}.params key "${k}" must be snake_case`);
          const t = typeof v;
          if (t !== 'string' && t !== 'number' && t !== 'boolean')
            err(out, `${at}.params.${k} must be a string, number or boolean — no nested payloads`);
          if (t === 'string' && /['"`;\\]/.test(v))
            err(out, `${at}.params.${k} contains a quote, semicolon or backslash`);
          if (t === 'string' && v.length > 120)
            err(out, `${at}.params.${k} is longer than 120 characters`);
        }
    }
  }

  if (source === 'static') {
    if (query.value === undefined) err(out, `${at}.value is required for a static query`);
    const note = requireString(out, query, 'note', at);
    if (note && note.trim().split(/\s+/).length < 4)
      err(
        out,
        `${at}.note must be a sentence saying where the value came from (standing rule 9: an unsourced literal is indistinguishable from a fabricated one)`,
      );
  }

  return source;
}

/* ------------------------------------------------------------------ widgets */

function validateWidget(widget, at, out, seenIds) {
  if (!isObject(widget)) {
    err(out, `${at} must be an object`);
    return;
  }
  const id = requireString(out, widget, 'id', at, { pattern: ID });
  if (id) {
    if (seenIds.has(id)) err(out, `${at}.id "${id}" is duplicated within the panel`);
    seenIds.add(id);
  }
  requireString(out, widget, 'title', at, { max: 80 });

  // A reserved type is a different mistake from a typo and gets a different sentence: the
  // name is real and ADR-028 reserved it, but nothing can render it and no schema exists
  // to check this widget against. "gauge" is wrong; "board" is early.
  if (ENUMS.RESERVED_WIDGET_TYPES.includes(widget.type)) {
    err(
      out,
      `${at}.type "${widget.type}" is reserved by ADR-028 and has no schema yet — it is named so nobody invents a fourth type, not so a panel can use it. It renders as the unsupported placeholder.`,
    );
    return;
  }

  const type = requireEnum(out, widget, 'type', ENUMS.WIDGET_TYPES, at);

  if (widget.span !== undefined && widget.span !== 1 && widget.span !== 2)
    err(out, `${at}.span must be 1 or 2 (the grid is two columns, §2.5.5)`);

  const source = validateQuery(widget.query, `${at}.query`, out);

  // Anything that cannot resolve in phase 1 must say, in one honest line, what will fill it.
  if (source === 'sql' && !widget.emptyState)
    err(
      out,
      `${at}.emptyState is required for a sql-backed widget — it does not resolve in phase 1, so it must name the agent that will fill it rather than render a blank card`,
    );
  if (widget.emptyState !== undefined && typeof widget.emptyState !== 'string')
    err(out, `${at}.emptyState must be a string`);

  if (widget.format !== undefined) requireEnum(out, widget, 'format', ENUMS.FORMATS, at, { optional: true });

  switch (type) {
    case 'bar-list':
    case 'source-bar-list':
      requireEnum(out, widget, 'tone', ENUMS.TONES, at, { optional: true });
      if (type === 'source-bar-list' && widget.tone && widget.tone !== 'grey')
        warn(out, `${at}.tone: the source bar list is grey bars + values by definition (§2.5.5.2)`);
      break;
    case 'area-chart':
      requireEnum(out, widget, 'tone', ['coral', 'lavender'], at, { optional: true });
      if (widget.annotations !== undefined) {
        if (!Array.isArray(widget.annotations)) err(out, `${at}.annotations must be an array`);
        else
          widget.annotations.forEach((a, i) => {
            requireString(out, a, 't', `${at}.annotations[${i}]`);
            requireString(out, a, 'label', `${at}.annotations[${i}]`);
          });
      }
      break;
    case 'cost-table':
      if (widget.showTotal !== undefined && typeof widget.showTotal !== 'boolean')
        err(out, `${at}.showTotal must be a boolean`);
      break;
    case 'data-table': {
      const cols = widget.columns;
      if (!Array.isArray(cols) || cols.length === 0) {
        err(out, `${at}.columns is required and must be a non-empty array`);
        break;
      }
      const keys = new Set();
      cols.forEach((c, i) => {
        const cAt = `${at}.columns[${i}]`;
        const key = requireString(out, c, 'key', cAt, { pattern: KEY });
        if (key) {
          if (keys.has(key)) err(out, `${cAt}.key "${key}" is duplicated`);
          keys.add(key);
        }
        requireString(out, c, 'label', cAt);
        requireEnum(out, c, 'type', ENUMS.COLUMN_TYPES, cAt);
        requireEnum(out, c, 'format', ENUMS.FORMATS, cAt, { optional: true });
      });
      if (widget.rowAction !== undefined && !['peek', 'none'].includes(widget.rowAction))
        err(out, `${at}.rowAction must be "peek" or "none"`);
      break;
    }
    case 'activity-feed':
      if (widget.limit !== undefined && (!Number.isInteger(widget.limit) || widget.limit < 1 || widget.limit > 50))
        err(out, `${at}.limit must be an integer 1..50`);
      break;
    case 'thread-feed': {
      if (widget.limit !== undefined && (!Number.isInteger(widget.limit) || widget.limit < 1 || widget.limit > 50))
        err(out, `${at}.limit must be an integer 1..50`);

      // Two emptinesses, two sentences. `ops.agent_runs.thread_id` is nullable and no
      // writer sets it (thread-model.md §5.3), so this widget renders one of these today
      // and the reader deserves to know which: nothing happened, or things happened and
      // none of them belongs to a thread. Collapsing them would let "your thread is quiet"
      // stand for "threads are not wired yet".
      if (!widget.emptyState)
        err(
          out,
          `${at}.emptyState is required on a thread-feed — nothing writes ops.agent_runs.thread_id yet, so this is the sentence it actually renders`,
        );
      const unthreaded = requireString(out, widget, 'unthreadedState', at);
      if (unthreaded) {
        if (!unthreaded.includes('{value}'))
          err(
            out,
            `${at}.unthreadedState must carry {value} — it reports the number of events that arrived carrying no thread, and a sentence that cannot show that count is claiming something it did not count`,
          );
        if (/\d/.test(unthreaded.split('{value}').join('')))
          err(
            out,
            `${at}.unthreadedState contains a digit outside {value} — the only number in it is the one observed in the payload (standing rule 9)`,
          );
      }
      break;
    }
    case 'calendar': {
      // A schedule is a thing that has not run. `langfuse` is an aggregate over the
      // agent-run ledger (§3.5) and `static` is a literal — either would be a future
      // printed off the wrong table. `ops.schedule` is reached by a registered query name
      // owned by the runner, and a panel never carries SQL.
      if (source !== undefined && source !== 'sql')
        err(
          out,
          `${at}.query.source must be "sql" on a calendar — the grid reads ops.schedule, and a run ledger cannot answer what has not run yet (contracts/scheduling.md §3)`,
        );

      if (widget.limit !== undefined)
        err(
          out,
          `${at}.limit is not accepted on a calendar — every lane the source returns is drawn, because a truncation rule would hide schedules and "which ones matter" is a policy invented for a table that has never held a row. Narrow it with query.params instead.`,
        );

      // BOARD rule 1, at the data layer. `Plan §14` asks for a grid coloured by department;
      // ADR-028's `CALENDAR_INK` rules that it does not get one, and a `tone` here is how
      // that arrives anyway — silently ignored by the renderer, which is worse than refused.
      if (widget.tone !== undefined)
        err(
          out,
          `${at}.tone is not accepted on a calendar — chrome is monochrome and colour is data ink (§1.3), seven departments against seven hues is where that dies first (scheduling.md §10), and the only value here that would earn ink is a fire outcome, which has never been recorded`,
        );

      if (!widget.emptyState)
        err(
          out,
          `${at}.emptyState is required on a calendar — ops.schedule has never held a row and no source:'library' row is even writable (ADR-024), so this is the sentence it actually renders`,
        );

      // Three sentences, three different claims, and the second is the true one today:
      // nothing computes an occurrence (scheduling.md §6), so a schedule can exist and
      // still be unplaceable on a week. Collapsing them would let "you have nothing
      // scheduled" stand for "nobody has worked out when your schedules fire".
      for (const key of ['unplaceableState', 'projectionState']) {
        const sentence = requireString(out, widget, key, at);
        if (!sentence) continue;
        if (!sentence.includes('{value}'))
          err(
            out,
            `${at}.${key} must carry {value} — it reports a count observed in the payload, and a sentence that cannot show that count is claiming something it did not count`,
          );
        if (/\d/.test(sentence.split('{value}').join('')))
          err(
            out,
            `${at}.${key} contains a digit outside {value} — the only number in it is the one observed in the payload (standing rule 9)`,
          );
      }

      // `Plan §14` wants the grid "annotated with projected cost". There is no cost:
      // `CalendarProjection.estimatedUsd` is typed `null` so a money figure cannot compile,
      // and this is that refusal one layer out, where the copy lives. A calendar multiplies
      // a guessed per-run figure by every cell on screen, and zero runs have completed.
      for (const key of ['emptyState', 'unplaceableState', 'projectionState']) {
        const sentence = widget[key];
        if (typeof sentence !== 'string') continue;
        const money = sentence.match(MONEY_PATTERN);
        if (money)
          err(
            out,
            `${at}.${key} names money ("${money[0]}") — a calendar prints occurrence counts, which are real, and no cost, which has no source: zero runs have completed so there is nothing to average (contracts/scheduling.md §6). CalendarProjection.estimatedUsd is typed null for the same reason.`,
          );
      }
      break;
    }
    default:
      break;
  }
}

/* -------------------------------------------------------------------- panel */

export function validatePanel(panel, { fileName = '<inline>' } = {}) {
  const out = [];
  const at = '$';

  if (!isObject(panel)) {
    err(out, `${fileName}: top level must be an object`);
    return out;
  }

  if (panel.schemaVersion !== ENUMS.SCHEMA_VERSION)
    err(out, `${at}.schemaVersion must be ${ENUMS.SCHEMA_VERSION} (got ${JSON.stringify(panel.schemaVersion)})`);

  const id = requireString(out, panel, 'id', at, { pattern: ID });
  if (id && fileName !== '<inline>' && basename(fileName, '.json') !== id)
    err(out, `${fileName}: file name must match id "${id}" — the carousel and the route both key on it`);

  requireString(out, panel, 'title', at, { max: 60 });
  requireString(out, panel, 'caption', at, { max: 120 });
  const rail = requireString(out, panel, 'railTitle', at, { max: 24 });
  if (rail && rail !== rail.toUpperCase())
    err(out, `${at}.railTitle "${rail}" must be uppercase — it renders as a wide-tracked caps rail (§2.5.6)`);
  requireString(out, panel, 'provider', at, { pattern: ID });
  requireString(out, panel, 'buildPrompt', at);

  if (!Array.isArray(panel.department) || panel.department.length === 0)
    err(out, `${at}.department must be a non-empty array of ADR-001 department slugs`);
  else
    panel.department.forEach((d, i) => {
      if (!ENUMS.DEPARTMENTS.includes(d))
        err(out, `${at}.department[${i}] "${d}" is not one of the ${ENUMS.DEPARTMENTS.length} departments (ADR-001, ADR-041)`);
    });

  if (!Number.isInteger(panel.order) || panel.order < 1)
    err(out, `${at}.order must be a positive integer — it is the carousel position (§2.4)`);

  if (panel.filters !== undefined) {
    const f = panel.filters;
    if (!isObject(f)) err(out, `${at}.filters must be an object`);
    else {
      const type = requireEnum(out, f, 'type', ENUMS.FILTER_TYPES, `${at}.filters`);
      if (!Array.isArray(f.options) || f.options.length < 2)
        err(out, `${at}.filters.options must list at least two options`);
      else if (f.default !== undefined && !f.options.includes(f.default))
        err(out, `${at}.filters.default "${f.default}" is not in options`);
      if (type === 'range' && Array.isArray(f.options))
        f.options.forEach((o, i) => {
          if (!RANGE.test(o)) err(out, `${at}.filters.options[${i}] "${o}" is not a range like 7d / 28d`);
        });
    }
  }

  // KPI row: 5–6 tiles (§2.5.3).
  if (!Array.isArray(panel.kpis)) err(out, `${at}.kpis must be an array`);
  else {
    if (panel.kpis.length < 5 || panel.kpis.length > 6)
      err(out, `${at}.kpis has ${panel.kpis.length} tiles — §2.5.3 specifies 5–6`);
    panel.kpis.forEach((k, i) => {
      const kAt = `${at}.kpis[${i}]`;
      if (!isObject(k)) return err(out, `${kAt} must be an object`);
      requireString(out, k, 'label', kAt, { max: 32 });
      requireEnum(out, k, 'format', ENUMS.FORMATS, kAt);
      validateQuery(k.query, `${kAt}.query`, out);
      if (k.delta !== undefined) {
        if (!isObject(k.delta)) err(out, `${kAt}.delta must be an object`);
        else {
          validateQuery(k.delta.query, `${kAt}.delta.query`, out);
          requireEnum(out, k.delta, 'goodDirection', ['up', 'down'], `${kAt}.delta`);
        }
      }
      if (k.sparkline !== undefined) {
        if (!isObject(k.sparkline)) err(out, `${kAt}.sparkline must be an object`);
        else {
          validateQuery(k.sparkline.query, `${kAt}.sparkline.query`, out);
          requireEnum(out, k.sparkline, 'tone', ENUMS.TONES, `${kAt}.sparkline`, { optional: true });
        }
      }
    });
  }

  // Signals strip: 2–4 sentences (§2.5.4).
  if (!Array.isArray(panel.signals)) err(out, `${at}.signals must be an array`);
  else {
    if (panel.signals.length < 2 || panel.signals.length > 4)
      err(out, `${at}.signals has ${panel.signals.length} — §2.5.4 specifies 2–4`);
    panel.signals.forEach((s, i) => {
      const sAt = `${at}.signals[${i}]`;
      if (!isObject(s)) return err(out, `${sAt} must be an object`);
      requireEnum(out, s, 'tone', ENUMS.SIGNAL_TONES, sAt);
      const lead = requireString(out, s, 'lead', sAt, { max: 90 });
      requireEnum(out, s, 'format', ENUMS.FORMATS, sAt, { optional: true });

      // The anti-fabrication rule. A number in a signal must come from a query.
      if (lead && /\d/.test(lead) && !s.query)
        err(
          out,
          `${sAt}.lead contains a number but the signal has no query — hardcoded figures in a signal are exactly the "plausible fake" standing rule 9 forbids. Use {value} plus a query.`,
        );
      if (s.detail !== undefined && typeof s.detail === 'string' && /\d/.test(s.detail) && !s.query)
        err(out, `${sAt}.detail contains a number but the signal has no query (standing rule 9)`);

      if (s.hideWhenZero !== undefined) {
        if (typeof s.hideWhenZero !== 'boolean') err(out, `${sAt}.hideWhenZero must be a boolean`);
        if (!s.query) err(out, `${sAt}.hideWhenZero has no query to be zero`);
      }

      if (s.query !== undefined) {
        validateQuery(s.query, `${sAt}.query`, out);
        if (!lead || !lead.includes('{value}'))
          warn(out, `${sAt}.lead has a query but no {value} placeholder — the query result is not shown anywhere`);
        if (!s.pending)
          err(
            out,
            `${sAt}.pending is required when a signal has a query — it is what the strip says before the data exists`,
          );
      }
    });
  }

  // Widgets.
  if (!Array.isArray(panel.widgets) || panel.widgets.length === 0)
    err(out, `${at}.widgets must be a non-empty array`);
  else {
    const seen = new Set();
    panel.widgets.forEach((w, i) => validateWidget(w, `${at}.widgets[${i}]`, out, seen));
  }

  if (panel.footer !== undefined) {
    const f = panel.footer;
    if (!isObject(f)) err(out, `${at}.footer must be an object`);
    else {
      requireString(out, f, 'lead', `${at}.footer`);
      requireString(out, f, 'detail', `${at}.footer`);
      if (f.cta !== undefined) {
        requireString(out, f.cta, 'label', `${at}.footer.cta`);
        // `href` is optional, and its absence is a state rather than an omission: a CTA
        // whose destination is not built yet renders as text and must say why. Requiring
        // `note` in that case is what stops "omit the href" becoming a silent way to ship
        // a button that does nothing.
        const { href, note } = f.cta;
        if (href === undefined) {
          if (typeof note !== 'string' || note.trim() === '')
            err(
              out,
              `${at}.footer.cta has no href, so it renders as text — add a "note" saying why it is not a link yet`,
            );
        } else if (typeof href !== 'string' || href.trim() === '') {
          err(out, `${at}.footer.cta.href must be a non-empty string when present`);
        } else if (!href.startsWith('/')) {
          err(out, `${at}.footer.cta.href must be an in-app path — no external links in the app chrome`);
        } else if (href.startsWith('/p/')) {
          // Panels are mounted per project (project-scoping.md §5.1 Q8). A slug inside a
          // panel file is a second copy of the mount, and the renderer already prefixes
          // the project the reader is in.
          err(
            out,
            `${at}.footer.cta.href must not carry a /p/:project segment — the renderer adds the current project`,
          );
        }
      }
    }
  }

  // `$range` is a binding to the range pills. Without pills there is nothing to bind to,
  // and the query would ship a literal "$range" to the runner.
  if (usesRangeBinding(panel) && panel.filters?.type !== 'range')
    err(
      out,
      `${at}: a query binds "${RANGE_BINDING}" but the panel has no range pills — add filters: { type: "range", options: ["7d","14d","28d"] } or use a literal window`,
    );

  out.push(...scanForSql(panel, at));
  return out;
}

function usesRangeBinding(node) {
  if (typeof node === 'string') return node === RANGE_BINDING;
  if (Array.isArray(node)) return node.some(usesRangeBinding);
  if (isObject(node)) return Object.values(node).some(usesRangeBinding);
  return false;
}

/* ------------------------------------------------------------ parity check */

function parseTsArray(source, name) {
  const m = source.match(new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\] as const;`));
  if (!m) return null;
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
}

export function checkContractParity(tsSource) {
  const out = [];
  const version = tsSource.match(/export const PANEL_SCHEMA_VERSION = (\d+);/);
  if (!version) err(out, 'packages/contracts/src/panels.ts: PANEL_SCHEMA_VERSION not found');
  else if (Number(version[1]) !== ENUMS.SCHEMA_VERSION)
    err(out, `schema version drift: panels.ts says ${version[1]}, validate-panels.mjs says ${ENUMS.SCHEMA_VERSION}`);

  const pairs = [
    ['CANONICAL_WIDGET_TYPES', ENUMS.CANONICAL_WIDGET_TYPES],
    ['EXTENSION_WIDGET_TYPES', ENUMS.EXTENSION_WIDGET_TYPES],
    ['BUILT_EXTENSION_WIDGET_TYPES', ENUMS.BUILT_EXTENSION_WIDGET_TYPES],
    ['QUERY_SOURCES', ENUMS.QUERY_SOURCES],
    ['LANGFUSE_METRICS', ENUMS.LANGFUSE_METRICS],
    ['LANGFUSE_GROUPINGS', ENUMS.LANGFUSE_GROUPINGS],
    ['QUERY_SHAPES', ENUMS.QUERY_SHAPES],
    ['COMPARISONS', ENUMS.COMPARISONS],
    ['FORMATS', ENUMS.FORMATS],
    ['TONES', ENUMS.TONES],
    ['SIGNAL_TONES', ENUMS.SIGNAL_TONES],
    ['CHIP_TONES', ENUMS.CHIP_TONES],
    ['PROGRESS_STATUSES', ENUMS.PROGRESS_STATUSES],
    ['COLUMN_TYPES', ENUMS.COLUMN_TYPES],
    ['FILTER_TYPES', ENUMS.FILTER_TYPES],
  ];
  for (const [name, mine] of pairs) {
    const theirs = parseTsArray(tsSource, name);
    if (!theirs) {
      err(out, `packages/contracts/src/panels.ts: ${name} not found`);
      continue;
    }
    if (theirs.join('|') !== mine.join('|'))
      err(out, `${name} drift — panels.ts [${theirs.join(', ')}] vs validator [${mine.join(', ')}]`);
  }
  /* ---------------------------------------------------------------- ADR-028
   * The cap, enforced. It grades the *TypeScript source*, not this file's mirror, so
   * editing one copy to satisfy the other does not get a fourth type through: widening
   * panels.ts trips the cap here, and widening only this file trips the drift check above.
   * `WIDGET_TYPE_EXTENSIONS_USED: 0 | 1 | 2 | 3` in panels.ts is the second, independent
   * enforcer — it stops compiling, with no script involved.
   */
  if (ENUMS.CANONICAL_WIDGET_TYPES.length !== 7)
    err(out, `there are exactly seven canonical widget types (§2.5.5); found ${ENUMS.CANONICAL_WIDGET_TYPES.length}`);

  const extensions = parseTsArray(tsSource, 'EXTENSION_WIDGET_TYPES') ?? [];
  if (extensions.length > ENUMS.EXTENSION_CAP)
    err(
      out,
      `ADR-028 caps the panel vocabulary at ${ENUMS.EXTENSION_CAP} new widget types, ever — ` +
        `packages/contracts/src/panels.ts declares ${extensions.length} (${extensions.join(', ')}). ` +
        `A fourth type is a reversal of ADR-028, not an application of it: supersede the ADR, then widen both lists. ` +
        `Everything else composes from the seven (Plan §23.7).`,
    );
  for (const name of extensions)
    if (!ENUMS.EXTENSION_WIDGET_TYPES.includes(name))
      err(
        out,
        `widget type "${name}" is not one of ADR-028's three reserved extensions (${ENUMS.EXTENSION_WIDGET_TYPES.join(', ')}) — the cap is a closed list of names, not three spare slots`,
      );

  const built = parseTsArray(tsSource, 'BUILT_EXTENSION_WIDGET_TYPES') ?? [];
  for (const name of built)
    if (!extensions.includes(name))
      err(out, `"${name}" is built but was never reserved by ADR-028 — it cannot be rendered into existence`);

  // `WIDGET_TYPE_EXTENSIONS_BUILT` is the compiler's copy of "how many of the three can
  // actually be drawn" — 1 in M16, 2 in M18. It is typed `0 | 1 | 2 | 3`, so a fourth stops
  // `tsc`; this reads the number out of the source and compares it with the array, so a
  // hand-edited count that satisfies the type is red here. Two enforcers, one fact.
  const builtCount = tsSource.match(/export const WIDGET_TYPE_EXTENSIONS_BUILT: [^=]+= ([^;]+);/);
  if (!builtCount)
    err(out, 'packages/contracts/src/panels.ts: WIDGET_TYPE_EXTENSIONS_BUILT not found — the built-extension count is one of ADR-028\'s two enforcers');
  else if (builtCount[1].trim() !== 'BUILT_EXTENSION_WIDGET_TYPES.length')
    err(
      out,
      `WIDGET_TYPE_EXTENSIONS_BUILT is "${builtCount[1].trim()}" — it must be BUILT_EXTENSION_WIDGET_TYPES.length, or the count and the list can disagree while both compile`,
    );

  return out;
}

/* --------------------------------------------------------------------- main */

async function main() {
  const issues = [];
  let files = [];
  try {
    files = (await readdir(PANELS_DIR)).filter((f) => !f.startsWith('.'));
  } catch {
    issues.push({ level: 'error', message: 'panels/ does not exist — the DASHBOARDS view has no data (§2.5)' });
  }

  const nonJson = files.filter((f) => !f.endsWith('.json'));
  for (const f of nonJson)
    issues.push({ level: 'error', message: `panels/${f}: only .json panel definitions live here` });

  const jsonFiles = files.filter((f) => f.endsWith('.json')).sort();
  if (files.length && jsonFiles.length === 0)
    issues.push({ level: 'error', message: 'panels/ contains no panel definitions' });

  try {
    const ts = await readFile(CONTRACT_TS, 'utf8');
    issues.push(...checkContractParity(ts));
  } catch {
    issues.push({
      level: 'error',
      message: 'packages/contracts/src/panels.ts is missing — the panel types are half of this contract (ADR-002)',
    });
  }

  const ids = new Map();
  const orders = new Map();
  const typesSeen = new Set();

  for (const file of jsonFiles) {
    const raw = await readFile(join(PANELS_DIR, file), 'utf8');
    let panel;
    try {
      panel = JSON.parse(raw);
    } catch (e) {
      issues.push({ level: 'error', message: `panels/${file}: invalid JSON — ${e.message}` });
      continue;
    }
    for (const issue of validatePanel(panel, { fileName: file }))
      issues.push({ ...issue, message: `panels/${file} ${issue.message}` });

    if (typeof panel.id === 'string') {
      if (ids.has(panel.id))
        issues.push({ level: 'error', message: `duplicate panel id "${panel.id}" in ${file} and ${ids.get(panel.id)}` });
      ids.set(panel.id, file);
    }
    if (Number.isInteger(panel.order)) {
      if (orders.has(panel.order))
        issues.push({
          level: 'error',
          message: `duplicate carousel order ${panel.order} in ${file} and ${orders.get(panel.order)} — the ring would be ambiguous`,
        });
      orders.set(panel.order, file);
    }
    for (const w of Array.isArray(panel.widgets) ? panel.widgets : []) typesSeen.add(w?.type);
  }

  // The ring must be 1..N with no gaps: rails wrap by order, so a hole is a dead end.
  const orderList = [...orders.keys()].sort((a, b) => a - b);
  orderList.forEach((o, i) => {
    if (o !== i + 1)
      issues.push({
        level: 'error',
        message: `carousel order is not contiguous: expected ${i + 1}, found ${o} (${orders.get(o)})`,
      });
  });

  for (const t of ENUMS.WIDGET_TYPES)
    if (!typesSeen.has(t))
      issues.push({
        level: 'warn',
        message: `widget type "${t}" is used by no panel — the renderer for it ships unexercised by real data`,
      });

  const errors = issues.filter((i) => i.level === 'error');
  const warnings = issues.filter((i) => i.level === 'warn');

  if (process.argv.includes('--json')) {
    console.log(
      JSON.stringify(
        {
          panels: jsonFiles.length,
          widgetTypesUsed: [...typesSeen].filter(Boolean).sort(),
          errors: errors.map((e) => e.message),
          warnings: warnings.map((w) => w.message),
        },
        null,
        2,
      ),
    );
  } else {
    console.log('\nPanel validation');
    console.log(`  panels            ${jsonFiles.length}`);
    console.log(`  widget types used ${[...typesSeen].filter(Boolean).length} of ${ENUMS.WIDGET_TYPES.length}`);
    for (const w of warnings) console.log(`  warn  ${w.message}`);
    for (const e of errors) console.log(`  FAIL  ${e.message}`);
    if (!errors.length) console.log('  ok    no raw SQL, no unknown widget types, no fabricated signal numbers');
    console.log('');
  }

  process.exit(errors.length ? 1 : 0);
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main().catch((e) => {
    console.error(e);
    process.exit(2);
  });
}
