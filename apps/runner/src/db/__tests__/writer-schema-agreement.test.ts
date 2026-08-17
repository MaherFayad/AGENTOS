/**
 * **The writer and the schema, made to meet — without a Postgres.**
 *
 * ## The risk this closes, and the exact half of it that it closes
 *
 * `fidelity-qa-reviewer`'s M15 verdict put it sharpest: *the ledger writer changed last
 * night, so the writer and the schema have never met.* Made mechanical there too — of the
 * runner's tests, the **three skipped are exactly** the three that would catch a
 * writer/schema mismatch, and all three skip on `DATABASE_URL is not set`. On a machine
 * with no Docker, the instrument that would find this class of bug is the instrument that
 * does not run, and the failure it would find is silent: `recordRun` inserts 31 columns
 * into `ops.agent_runs`, and **one column name that no migration creates means the first
 * real run is never recorded** — leaving every dashboard empty in exactly the way an honest
 * empty ledger is empty (Part VII.3, BOARD rule 9).
 *
 * The migrations are text in this repo. The writer's SQL is text this process can produce.
 * So *"does every column the writer names exist in the schema"* is answerable **with no
 * database at all**, and it is the single highest-value question of the three, because it is
 * the one whose failure mode is invisible rather than loud.
 *
 * ## What this is NOT, stated up front so nobody quotes it as more than it is
 *
 * This is **not** `sql-executes.test.ts` and does not replace it, and the three skipped
 * tests stay skipped and stay owed. Asking Postgres to parse and plan a statement checks
 * things no text comparison can:
 *
 *   - **types** — the `make_interval(hours => $4::float8)` regression was a legal column
 *     list meeting an `int`-only overload;
 *   - **`ON CONFLICT` index inference** — `writeOutput`'s
 *     `ON CONFLICT (project_id, kind, entity_key) WHERE entity_key IS NOT NULL` has to match
 *     a *partial* unique index by predicate. This file checks those three columns exist. It
 *     cannot check that the index does;
 *   - **`NOT NULL` / `CHECK`** — a legal insert that every row violates;
 *   - **functions that were never defined** — the `app.safe_num` / `app.safe_ts` class,
 *     thirty queries calling two functions no migration created.
 *
 * So this is a **lower bound on agreement, not a proof of it.** It runs everywhere, which
 * is the entire argument for it: a laptop with no Docker now catches the column class in
 * milliseconds instead of catching nothing.
 *
 * ## Why the negative controls are here
 *
 * A schema parser that quietly matched nothing would make every assertion below pass, and a
 * gate reporting a number it cannot observe is the defect this repo has spent two days
 * finding in three different checkers. So the parser is falsified inside the test: a name
 * that does not exist must be absent, a name that exists **only inside a `--` comment** must
 * be absent (0006 carries a commented-out `ALTER TABLE ops.device ADD COLUMN identity_id` —
 * a real trap, already in the tree), and the harvest must produce a statement count and a
 * column count large enough that an empty harvest cannot read as success.
 */
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createLedger, writeOutput } from '../ledger.ts';
import { pruneRetention } from '../prune.ts';
import type { DbClient } from '../../observability/types.ts';
import { projectIdForSlug } from '../../lib/project.ts';

const MIGRATIONS = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

/* -------------------------------------------------------------------------- *
 * The schema, read out of the migrations
 * -------------------------------------------------------------------------- */

/**
 * Strip `--` line comments before anything else.
 *
 * Not tidiness — correctness, and in the permissive direction, which is the dangerous one.
 * `0006_ops_device.sql` contains `--     ALTER TABLE ops.device ADD COLUMN identity_id …`
 * as a note about a future migration. A parser that read it would believe in a column
 * Postgres has never heard of, and would then *pass* a writer that used it.
 */
function stripComments(sql: string): string {
  return sql.replace(/--[^\n]*/g, '');
}

/** The body of the parenthesised group that starts at `open`, matched by depth. */
function balanced(text: string, open: number): string {
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === '(') depth += 1;
    else if (text[i] === ')') {
      depth -= 1;
      if (depth === 0) return text.slice(open + 1, i);
    }
  }
  throw new Error(`unbalanced parentheses at offset ${open}`);
}

/** Split on commas that are not inside parentheses — `numeric(12,6)` is one column, not two. */
function topLevelParts(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < body.length; i += 1) {
    if (body[i] === '(') depth += 1;
    else if (body[i] === ')') depth -= 1;
    else if (body[i] === ',' && depth === 0) {
      parts.push(body.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(body.slice(start));
  return parts;
}

/** Table-level constraints look like columns until you read the first word. */
const NOT_A_COLUMN = new Set([
  'primary', 'unique', 'foreign', 'check', 'constraint', 'exclude', 'like', 'partition',
]);

type Schema = { tables: Map<string, Set<string>>; functions: Set<string> };

async function readSchema(): Promise<Schema> {
  const tables = new Map<string, Set<string>>();
  const functions = new Set<string>();
  const columnsOf = (table: string): Set<string> => {
    const existing = tables.get(table);
    if (existing) return existing;
    const fresh = new Set<string>();
    tables.set(table, fresh);
    return fresh;
  };

  const files = (await readdir(MIGRATIONS)).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = stripComments(await readFile(join(MIGRATIONS, file), 'utf8'));

    // CREATE TABLE [IF NOT EXISTS] schema.table ( … )
    for (const match of sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_]+\.[a-z_]+)\s*\(/gi)) {
      const open = match.index! + match[0].length - 1;
      const columns = columnsOf(match[1].toLowerCase());
      for (const part of topLevelParts(balanced(sql, open))) {
        const name = part.trim().split(/\s+/)[0]?.toLowerCase();
        if (!name || NOT_A_COLUMN.has(name) || !/^[a-z_][a-z0-9_]*$/.test(name)) continue;
        columns.add(name);
      }
    }

    // ALTER TABLE schema.table … ADD COLUMN [IF NOT EXISTS] name — one statement at a time,
    // so a column is attributed to the table its own statement names.
    for (const match of sql.matchAll(/ALTER\s+TABLE\s+([a-z_]+\.[a-z_]+)([\s\S]*?);/gi)) {
      const columns = columnsOf(match[1].toLowerCase());
      for (const add of match[2].matchAll(/ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_][a-z0-9_]*)/gi)) {
        columns.add(add[1].toLowerCase());
      }
    }

    for (const fn of sql.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([a-z_]+\.[a-z_]+)\s*\(/gi)) {
      functions.add(fn[1].toLowerCase());
    }
  }

  return { tables, functions };
}

/* -------------------------------------------------------------------------- *
 * The writer, harvested out of the real call paths
 * -------------------------------------------------------------------------- */

type Statement = { label: string; sql: string };

/**
 * The same trick `sql-executes.test.ts` uses, and for the same reason: exporting the SQL as
 * constants would test the constants. A recording `DbClient` gets the string that would
 * actually have reached Postgres.
 */
async function harvestWrites(): Promise<Statement[]> {
  const statements: Statement[] = [];
  let label = 'unlabelled';
  const db: DbClient = {
    async query(sql: string) {
      statements.push({ label, sql });
      return { rows: [] as never[] };
    },
  };

  const now = new Date().toISOString();
  label = 'recordRun — ops.agent_runs + ops.agent_run_tools';
  await createLedger(db).recordRun(
    {
      runId: 'run_probe', traceId: null, traceUrl: null,
      agent: 'sales/probe', agentName: 'Probe', department: 'sales', model: 'claude-opus-4',
      trigger: 'manual', sessionId: null, dryRun: false, status: 'ok',
      startedAt: now, endedAt: now, durationMs: 1,
      inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0,
      costUsd: 0, costSource: 'sdk', toolCallCount: 1, errorCount: 0, redactionCount: 0,
      activityEvent: 'Probe', activityDetail: 'probe', error: null,
      // `recordRun` refuses a row it cannot attribute, so without these the statement is
      // never built and this file would silently stop checking the insert.
      projectId: projectIdForSlug('agentos'), agentRef: 'agentos/sales/probe',
      sourceRef: 'project:agents/sales/probe/SKILL.md@sha256:probe',
      accountId: null, accountSource: 'unattributed',
    } as never,
    [
      {
        runId: 'run_probe', spanId: 'span_1', seq: 1, name: 'Read', status: 'ok',
        startedAt: now, durationMs: 1, error: null,
      } as never,
    ],
  );

  label = 'writeOutput — app.agent_outputs upsert';
  await writeOutput(db, {
    projectId: projectIdForSlug('agentos'),
    runId: 'run_probe', agent: 'sales/probe', department: 'sales',
    kind: 'deal', entityKey: 'probe', payload: { value: 1 },
  });

  label = 'pruneRetention — ops.prune()';
  await pruneRetention(db);

  return statements;
}

const IDENTIFIERS = (list: string): string[] =>
  list
    .split(',')
    .map((raw) => raw.trim().replace(/^"|"$/g, '').toLowerCase())
    .filter((name) => /^[a-z_][a-z0-9_]*$/.test(name));

/* -------------------------------------------------------------------------- *
 * The parser, falsified before it is trusted
 * -------------------------------------------------------------------------- */

test('the migration parser reads real columns and refuses commented-out ones', async () => {
  const { tables, functions } = await readSchema();

  const runs = tables.get('ops.agent_runs');
  assert.ok(runs, 'ops.agent_runs was not found at all — the parser is broken, not the schema');
  assert.ok(
    runs.size >= 25,
    `only ${runs.size} columns parsed for ops.agent_runs — a parser that finds almost nothing ` +
      'makes every assertion below pass, which is the failure this control exists for',
  );

  // Positive controls, one from CREATE TABLE (0001) and one from ADD COLUMN (0005).
  assert.equal(runs.has('run_id'), true, 'a CREATE TABLE column');
  assert.equal(runs.has('project_id'), true, 'an ALTER TABLE … ADD COLUMN column');

  // Negative control 1: the parser is a set, not a wildcard.
  assert.equal(runs.has('column_that_does_not_exist'), false);

  // Negative control 2, and the sharp one. `0006_ops_device.sql` carries
  // `--     ALTER TABLE ops.device ADD COLUMN identity_id …` as a note about a *future*
  // migration. A parser that believed comments would invent a column, and would then pass a
  // writer that used it — a permissive lie, which is the direction that costs money.
  const device = tables.get('ops.device');
  assert.ok(device, 'ops.device is in the schema');
  assert.equal(device.has('public_key'), true, 'a column that is really there');
  assert.equal(
    device.has('identity_id'),
    false,
    'ops.device.identity_id exists only inside a comment in 0006 — it must not reach the schema',
  );

  assert.equal(functions.has('ops.prune'), true, 'CREATE OR REPLACE FUNCTION is read too');
  assert.equal(functions.has('ops.function_that_does_not_exist'), false);
});

/* -------------------------------------------------------------------------- *
 * The assertion the file is for
 * -------------------------------------------------------------------------- */

test('every column the ledger writer names exists in a migration', async () => {
  const { tables } = await readSchema();
  const statements = await harvestWrites();

  assert.ok(
    statements.length >= 4,
    `harvested only ${statements.length} write statements — the harvester is broken and this ` +
      'test would pass by having nothing to check',
  );

  const problems: string[] = [];
  let checked = 0;

  for (const { label, sql } of statements) {
    const insert = sql.match(/INSERT\s+INTO\s+([a-z_]+\.[a-z_]+)\s*\(([^)]*)\)/i);
    if (!insert) continue;
    const table = insert[1].toLowerCase();
    const known = tables.get(table);
    if (!known) {
      problems.push(`${label}: writes to ${table}, which no migration creates`);
      continue;
    }
    for (const column of IDENTIFIERS(insert[2])) {
      checked += 1;
      if (!known.has(column)) problems.push(`${label}: ${table}.${column} is written but no migration creates it`);
    }

    // The upsert's conflict target and its update list. Not proof the partial unique index
    // exists — that needs a plan, and `sql-executes.test.ts` is where that lives — but a
    // conflict target naming a column that does not exist fails before the index is even
    // considered, and that is checkable here.
    const conflict = sql.match(/ON\s+CONFLICT\s*\(([^)]*)\)/i);
    for (const column of conflict ? IDENTIFIERS(conflict[1]) : []) {
      checked += 1;
      if (!known.has(column)) problems.push(`${label}: ON CONFLICT names ${table}.${column}, which does not exist`);
    }
    for (const set of sql.matchAll(/(?:DO\s+UPDATE\s+SET|,)\s*([a-z_][a-z0-9_]*)\s*=\s*EXCLUDED\./gi)) {
      checked += 1;
      const column = set[1].toLowerCase();
      if (!known.has(column)) problems.push(`${label}: DO UPDATE SET names ${table}.${column}, which does not exist`);
    }
  }

  assert.ok(
    checked >= 40,
    `only ${checked} column references checked — recordRun alone writes 31, so the extractor ` +
      'is not seeing the statements it thinks it is',
  );
  assert.deepEqual(
    problems,
    [],
    `the writer and the schema disagree:\n\n${problems.join('\n')}\n\n` +
      'A column the writer names and the schema lacks means the very first real run is never ' +
      'recorded, and the ledger stays empty in exactly the way an honest empty ledger is empty.',
  );
});

/**
 * `pruneRetention` and the migrations, the same question one level up: the nightly ofelia
 * job calls `ops.prune()`, and a function that no migration defines is the `app.safe_num`
 * bug — thirty queries calling two functions that were never created, invisible to the type
 * checker and to `docker compose config`.
 *
 * Deliberately narrow: only the functions the **write** path names. Sweeping every
 * `schema.name(` out of `queries.ts` and `registry.ts` is a wider net over a much bigger
 * corpus, and a checker that cries wolf gets its assertion loosened within a week. That
 * sweep belongs in `sql-executes.test.ts`, where Postgres answers it exactly and for free.
 *
 * `INSERT INTO ops.agent_runs (` is textually a schema-qualified name followed by a paren,
 * so the table set is subtracted — which is only possible because the same parser produced
 * it. This was a real false positive on the first run of this file, not a hypothetical.
 */
test('every function the write path calls is defined by a migration', async () => {
  const { functions, tables } = await readSchema();
  const statements = await harvestWrites();

  const called = new Set<string>();
  for (const { sql } of statements) {
    for (const match of sql.matchAll(/\b(ops|app)\.([a-z_][a-z0-9_]*)\s*\(/gi)) {
      const name = `${match[1].toLowerCase()}.${match[2].toLowerCase()}`;
      if (!tables.has(name)) called.add(name);
    }
  }

  assert.ok(called.size > 0, 'no schema-qualified call was found — the extractor is broken');
  assert.equal(called.has('ops.prune'), true, 'the prune is in the harvest, so this is not vacuous');

  const missing = [...called].filter((name) => !functions.has(name));
  assert.deepEqual(
    missing,
    [],
    `the write path calls ${missing.join(', ')}, which no migration defines`,
  );
});
