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
 *   6. Every served query carries a **project predicate** and reserves `$1` for it.
 *
 * Check 6 is M15's, and it is the cheapest available version of `project-scoping.md`
 * invariant 8. Forty registered queries is more than anyone re-reads, and a missing
 * `WHERE project_id = …` does not throw — it widens an answer. `bindNamedQuery` refuses
 * such a query at runtime; this refuses it at build time, which is the half that gets
 * noticed before a dashboard is looked at.
 *
 * An unregistered `sql` name is a WARNING, not an error. The panel contract says phase 1
 * ships `langfuse` + `static`; a panel that names a business query ahead of the data is
 * scaffolding, and the widget renders its empty state until the query is registered.
 * `--strict` turns those warnings into errors — use it once the business schema lands.
 *
 * Every run prints a provenance banner (`scripts/lib/provenance.mjs`, tokens contract §8b).
 * The reason is not bookkeeping: two agents read 0 and 31 out of `check-tokens` hours apart
 * and spent real time suspecting the tooling, because a count with no identity is a
 * sentence rather than evidence. **A stale FAIL gets investigated; a stale PASS gets
 * cited** — so the banner prints on green runs too, which is when it matters.
 *
 * Usage: node scripts/check-metrics.mjs [--json] [--strict]
 */

import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { provenance } from './lib/provenance.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PANELS_DIR = join(ROOT, 'panels');
const MIGRATIONS_DIR = join(ROOT, 'apps/runner/src/db/migrations');
const QUERIES_MODULE = join(ROOT, 'apps/runner/src/db/queries.ts');
const REGISTRY_MODULE = join(ROOT, 'apps/runner/src/db/registry.ts');

const errors = [];
const warnings = [];

/** A statement, not a sentence that happens to contain "from" or "create". */
const SQL_SHAPED =
  /\b(select\s+\S[\s\S]*\sfrom\s|insert\s+into\s|update\s+\w+\s+set\s|delete\s+from\s|drop\s+(table|schema|index)\s|alter\s+table\s|create\s+(table|index|schema)\s|union\s+select\s)/i;

/** Human copy. May mention SQL in English; it is not a query. */
const PROSE_KEYS = new Set(['buildPrompt', 'emptyState', 'detail', 'caption', 'lead', 'title', 'pending', 'subtitle']);

async function loadRegistry() {
  const queries = await import(`file://${QUERIES_MODULE.replace(/\\/g, '/')}`);
  const registry = await import(`file://${REGISTRY_MODULE.replace(/\\/g, '/')}`);
  return {
    named: registry.NAMED_QUERIES,
    metrics: queries.METRICS,
    ranges: Object.keys(queries.RANGES),
    bind: registry.bindNamedQuery,
    projectSlot: registry.PROJECT_ID_SLOT,
  };
}

/**
 * A real project id, used only to prove a panel's parameters bind. It is a checker
 * fixture, never a value that reaches a database — `bindNamedQuery` needs *a* project
 * because a query without one is the thing this file is checking for.
 */
const PROBE_PROJECT_ID = '00000000-0000-0000-0000-000000000000';

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
    // buildPrompt / emptyState / detail are human sentences (§2.5) and may mention SQL.
    if (PROSE_KEYS.has(key)) continue;
    scanForRawSql(value, `${path}.${key}`, file);
  }
}

async function main() {
  const { named, metrics, ranges, bind, projectSlot } = await loadRegistry();

  // 4. The registry itself must be free of interpolation.
  // 6. …and every served query must be about exactly one project.
  for (const [name, query] of Object.entries(named)) {
    if (!query.sql) continue; // pending entries have no SQL on purpose
    if (/\$\{/.test(query.sql)) {
      errors.push(`registry.ts: "${name}" interpolates into its SQL string. Use a bind parameter.`);
    }
    const placeholders = new Set(query.sql.match(/\$\d+/g) ?? []);
    const expected = (query.fixed?.length ?? 0) + query.params.length;
    if (placeholders.size !== expected) {
      errors.push(
        `registry.ts: "${name}" declares ${expected} binds (${query.fixed?.length ?? 0} fixed + ${query.params.length} params) but uses ${placeholders.size} placeholders.`,
      );
    }

    // The predicate, and the slot it binds to. Both, because either alone can be true
    // while the query is still wrong: a predicate reading some other `$n` would filter by
    // whatever `days` happened to be, and a reserved slot with no predicate would bind a
    // project id that nothing uses.
    if (!/\bproject_id\s*=\s*\$1::uuid/.test(query.sql)) {
      errors.push(
        `registry.ts: "${name}" has no project predicate. Every served query reads a project-scoped ` +
          `table and must carry \`project_id = $1::uuid\` (project-scoping.md invariant 8) — a query ` +
          `without one does not fail, it widens the answer.`,
      );
    }
    if (query.fixed?.[0] !== projectSlot) {
      errors.push(
        `registry.ts: "${name}" does not reserve $1 for the project id. Start \`fixed\` with PROJECT_ID_SLOT.`,
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
        if (query.range !== undefined && query.range !== '$range' && !ranges.includes(query.range)) {
          errors.push(`${file}: ${path}.range "${query.range}" is not supported. Use ${ranges.join(', ')}.`);
        }
        return;
      }

      if (source === 'sql') {
        try {
          bind(query.name, PROBE_PROJECT_ID, query.params ?? {});
        } catch (e) {
          errors.push(`${file}: ${path} — ${e.message}${e.hint ? ` ${e.hint}` : ''}`);
        }
        return;
      }

      errors.push(`${file}: ${path}.source "${source}" is not one of langfuse, sql, static.`);
    });
  }

  // What this result is a result ABOUT (tokens contract §8b).
  //
  // Repo-wide rather than scoped, unlike `check-tokens`. This checker reads **two** trees
  // that can each invalidate its answer — `panels/` and `apps/runner/src/db/` — and
  // `provenance()` takes one pathspec. Reporting dirtiness for only one of them would be
  // worse than reporting it for all of them: a clean-looking banner beside a result that a
  // change in the other tree had already invalidated is exactly the stale PASS this line
  // exists to prevent. Over-reporting is noise; under-reporting is a lie.
  const prov = provenance(ROOT);

  const summary = {
    provenance: prov,
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
    console.log(`  scanned at         ${prov.line}`);
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
