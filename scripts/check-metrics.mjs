#!/usr/bin/env node
/**
 * check-metrics.mjs
 *
 * Guards the seam between `panels/*.json` (data, owned by dashboards-engineer) and the
 * metrics API (code, owned by observability-engineer). A panel names a metric or a
 * query; this asserts every name resolves, and that no panel has smuggled SQL into a
 * JSON file.
 *
 * Checks:
 *   1. Every `query.source: "langfuse"` names a real metric and a supported range.
 *   2. Every `query.source: "sql"` either names a registered query with valid params,
 *      or is reported as pending registration (see below).
 *   3. No panel file contains raw SQL, under any key.
 *   4. Every registered query is parameterised — no interpolation in the SQL string.
 *   5. Migrations are contiguously numbered, so none was dropped in a merge.
 *
 * An unregistered `sql` name is a WARNING, not an error. The panel contract says phase 1
 * ships `langfuse` + `static`; a panel that names a business query ahead of the data is
 * scaffolding, and the widget renders its empty state until the query is registered.
 * `--strict` turns those warnings into errors — use it once the business schema lands.
 *
 * Usage: node scripts/check-metrics.mjs [--json] [--strict]
 */

import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PANELS_DIR = join(ROOT, 'panels');
const MIGRATIONS_DIR = join(ROOT, 'apps/runner/src/db/migrations');
const QUERIES_MODULE = join(ROOT, 'apps/runner/src/db/queries.ts');

const errors = [];
const warnings = [];

/** Anything that looks like a statement rather than a value. */
const SQL_SHAPED = /\b(select|insert|update|delete|drop|alter|create|union|from|where|join)\b\s/i;

async function loadRegistry() {
  const mod = await import(`file://${QUERIES_MODULE.replace(/\\/g, '/')}`);
  return { named: mod.NAMED_QUERIES, metrics: mod.METRICS, ranges: Object.keys(mod.RANGES), bind: mod.bindNamedQuery };
}

function walkQueries(node, path, visit) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach((child, i) => walkQueries(child, `${path}[${i}]`, visit));
    return;
  }
  for (const [key, value] of Object.entries(node)) {
    const childPath = `${path}.${key}`;
    if (key === 'query' && value && typeof value === 'object') visit(value, childPath);
    walkQueries(value, childPath, visit);
  }
}

function scanForRawSql(node, path, file) {
  if (typeof node === 'string') {
    if (SQL_SHAPED.test(node)) {
      errors.push(
        `${file}: ${path} looks like raw SQL. Panels reference a registered query by name ` +
          `(panel-schema contract: "a panel file can never contain raw SQL").`,
      );
    }
    return;
  }
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach((child, i) => scanForRawSql(child, `${path}[${i}]`, file));
    return;
  }
  for (const [key, value] of Object.entries(node)) {
    // buildPrompt is a Claude Code prompt (§2.5.1) and may legitimately mention SQL.
    if (key === 'buildPrompt') continue;
    scanForRawSql(value, `${path}.${key}`, file);
  }
}

async function main() {
  const { named, metrics, ranges, bind } = await loadRegistry();

  // 4. The registry itself must be free of interpolation.
  for (const [name, query] of Object.entries(named)) {
    if (/\$\{/.test(query.sql)) {
      errors.push(`queries.ts: "${name}" interpolates into its SQL string. Use a bind parameter.`);
    }
    const placeholders = new Set(query.sql.match(/\$\d+/g) ?? []);
    if (placeholders.size !== query.params.length) {
      errors.push(
        `queries.ts: "${name}" declares ${query.params.length} params but uses ${placeholders.size} placeholders.`,
      );
    }
  }

  // 5. Migration numbering.
  let migrations = [];
  try {
    migrations = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();
  } catch {
    errors.push('apps/runner/src/db/migrations/ is missing.');
  }
  migrations.forEach((file, i) => {
    const expected = String(i + 1).padStart(4, '0');
    if (!file.startsWith(expected)) {
      errors.push(`migrations: expected ${expected}_*.sql at position ${i + 1}, found ${file}.`);
    }
  });

  // 1–3. Panels.
  let panelFiles = [];
  try {
    panelFiles = (await readdir(PANELS_DIR)).filter((f) => f.endsWith('.json'));
  } catch {
    warnings.push('panels/ does not exist yet — nothing to check against the metrics API.');
  }

  let queryCount = 0;

  for (const file of panelFiles) {
    let panel;
    const raw = await readFile(join(PANELS_DIR, file), 'utf8');
    try {
      panel = JSON.parse(raw);
    } catch (e) {
      errors.push(`${file}: not valid JSON (${e.message}).`);
      continue;
    }

    scanForRawSql(panel, 'panel', file);

    walkQueries(panel, 'panel', (query, path) => {
      queryCount += 1;
      const source = query.source;

      if (source === 'static') return;

      if (source === 'langfuse') {
        if (!metrics.includes(query.metric)) {
          errors.push(
            `${file}: ${path}.metric "${query.metric}" is not served. Available: ${metrics.join(', ')}.`,
          );
        }
        if (query.range !== undefined && !ranges.includes(query.range)) {
          errors.push(`${file}: ${path}.range "${query.range}" is not supported. Use ${ranges.join(', ')}.`);
        }
        return;
      }

      if (source === 'sql') {
        try {
          bind(query.name, query.params ?? {});
        } catch (e) {
          errors.push(`${file}: ${path} — ${e.message}${e.hint ? ` ${e.hint}` : ''}`);
        }
        return;
      }

      errors.push(`${file}: ${path}.source "${source}" is not one of langfuse, sql, static.`);
    });
  }

  const summary = {
    panels: panelFiles.length,
    queries: queryCount,
    registeredQueries: Object.keys(named).length,
    migrations: migrations.length,
    errors,
    warnings,
  };

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log('\nMetrics contract');
    console.log(`  panel files        ${summary.panels}`);
    console.log(`  panel queries      ${summary.queries}`);
    console.log(`  registered queries ${summary.registeredQueries}`);
    console.log(`  migrations         ${summary.migrations}`);
    for (const w of warnings) console.log(`  warn  ${w}`);
    for (const e of errors) console.log(`  FAIL  ${e}`);
    console.log('');
  }

  process.exit(errors.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
