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
import {
  appendMessage,
  createThread,
  markMessagesDelivered,
  setThreadState,
} from '../threads.ts';
import { recordWorkProduct } from '../workProducts.ts';
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

/**
 * A column the database will refuse a row without: `NOT NULL` and nothing to fall back on.
 *
 * `serial` types and `GENERATED` columns carry an implicit default, so they are NOT NULL and
 * must **not** be named by a writer — `app.agent_outputs.id` is `bigserial PRIMARY KEY`, and
 * a checker that demanded it would fail a correct insert. A checker that cries wolf gets its
 * assertion loosened within a week, which is worse than not having it.
 */
function isRequired(definition: string): boolean {
  /**
   * **String literals are stripped first, and that is not tidiness.**
   *
   * Found by `thread-model-engineer` while writing `0008_threads.sql`. `ops.thread.delivery` is
   * `text NOT NULL CHECK (delivery IN ('direct','dispatch','fan-out','default','session'))` —
   * a mandatory column whose enum happens to contain the value `'default'`. The `\bdefault\b`
   * test below matched *inside the string literal*, this function answered `false`, and the
   * column silently dropped out of the `required` set. Every insert then stopped being checked
   * for it.
   *
   * The failure is in the **permissive** direction, which is the expensive one: it does not
   * make a correct writer red, it makes a broken writer green — the precise shape of the M15
   * defect this whole file was built to catch, arriving through the checker instead of through
   * the writer. Any enum containing `default`, `generated` or `serial` had the same hole.
   */
  const d = definition.toLowerCase().replace(/'[^']*'/g, "''");
  if (/\bdefault\b/.test(d) || /\bgenerated\b/.test(d) || /\b(big|small)?serial\b/.test(d)) return false;
  // `PRIMARY KEY` inline implies NOT NULL and is the reason `run_id` is required.
  return /\bnot\s+null\b/.test(d) || /\bprimary\s+key\b/.test(d);
}

/** A unique constraint or unique index — what `ON CONFLICT` has to infer. */
type UniqueTarget = {
  /** Sorted column names, so a target is comparable regardless of the order written. */
  columns: string[];
  /** Partial indexes only match when the statement supplies the same predicate. */
  partial: boolean;
  /** For the message: `PRIMARY KEY`, `UNIQUE`, or the index's name. */
  origin: string;
};

type Table = {
  columns: Set<string>;
  /** NOT NULL, no default — the insert must name every one of these. */
  required: Set<string>;
  uniques: Map<string, UniqueTarget>;
};

type Schema = { tables: Map<string, Table>; functions: Set<string> };

const key = (columns: string[]): string => [...columns].sort().join(',');

async function readSchema(): Promise<Schema> {
  const tables = new Map<string, Table>();
  const functions = new Set<string>();
  const tableOf = (name: string): Table => {
    const existing = tables.get(name);
    if (existing) return existing;
    const fresh: Table = { columns: new Set(), required: new Set(), uniques: new Map() };
    tables.set(name, fresh);
    return fresh;
  };
  const addUnique = (table: Table, id: string, target: UniqueTarget): void => {
    table.uniques.set(id, target);
  };

  const files = (await readdir(MIGRATIONS)).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = stripComments(await readFile(join(MIGRATIONS, file), 'utf8'));

    // CREATE TABLE [IF NOT EXISTS] schema.table ( … )
    for (const match of sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_]+\.[a-z_]+)\s*\(/gi)) {
      const open = match.index! + match[0].length - 1;
      const table = tableOf(match[1].toLowerCase());
      for (const part of topLevelParts(balanced(sql, open))) {
        const definition = part.trim();
        const name = definition.split(/\s+/)[0]?.toLowerCase();
        if (!name) continue;
        if (NOT_A_COLUMN.has(name)) {
          // Table-level `PRIMARY KEY (a, b)` / `UNIQUE (a, b)` — both are things
          // `ON CONFLICT` can infer, and `PRIMARY KEY (run_id, seq)` is one the writer uses.
          const constraint = definition.match(/^(primary\s+key|unique)\s*\(([^)]*)\)/i);
          if (constraint) {
            const columns = IDENTIFIERS(constraint[2]);
            addUnique(table, `constraint:${key(columns)}`, {
              columns,
              partial: false,
              origin: constraint[1].toUpperCase(),
            });
          }
          continue;
        }
        if (!/^[a-z_][a-z0-9_]*$/.test(name)) continue;
        table.columns.add(name);
        if (isRequired(definition)) table.required.add(name);
        if (/\bprimary\s+key\b/i.test(definition)) {
          addUnique(table, `constraint:${name}`, { columns: [name], partial: false, origin: 'PRIMARY KEY' });
        }
        /**
         * **A column-level `UNIQUE`, which this parser could not see until 0010.**
         *
         * `ops.work_product.run_id` is `text NOT NULL UNIQUE` — a perfectly ordinary declaration
         * that Postgres backs with a unique constraint `ON CONFLICT (run_id)` infers. The parser
         * only knew inline `PRIMARY KEY` and table-level `UNIQUE (…)`, so it reported *"no unique
         * index or constraint to infer"* against a schema that has one.
         *
         * That direction matters: this failure **cries wolf** rather than passing a broken
         * writer, and a checker that cries wolf gets its assertion loosened within a week —
         * which is how a gate stops catching the real thing. Found by 0010's own writer going
         * red on a statement Postgres would have planned happily.
         *
         * String literals are stripped first for the same reason `isRequired` strips them: a
         * `CHECK (kind IN ('unique', …))` on the column line would otherwise declare a
         * constraint that does not exist, and *that* direction is the permissive one.
         */
        const withoutLiterals = definition.replace(/'[^']*'/g, "''");
        if (/\bunique\b/i.test(withoutLiterals) && !/\bprimary\s+key\b/i.test(withoutLiterals)) {
          addUnique(table, `constraint:unique:${name}`, { columns: [name], partial: false, origin: 'UNIQUE' });
        }
      }
    }

    // ALTER TABLE schema.table … ADD COLUMN [IF NOT EXISTS] name — one statement at a time,
    // so a column is attributed to the table its own statement names.
    for (const match of sql.matchAll(/ALTER\s+TABLE\s+([a-z_]+\.[a-z_]+)([\s\S]*?);/gi)) {
      const table = tableOf(match[1].toLowerCase());
      const body = match[2];
      for (const add of body.matchAll(
        /ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_][a-z0-9_]*)([\s\S]*?)(?=,\s*(?:ADD|ALTER|DROP)\b|$)/gi,
      )) {
        const name = add[1].toLowerCase();
        table.columns.add(name);
        if (isRequired(add[2])) table.required.add(name);
      }
      // `ALTER COLUMN x SET NOT NULL` is how 0005 made the project axis mandatory, and it is
      // the exact statement whose writer half was missing. A column reached this way has no
      // default by construction — a default would have made the backfill unnecessary.
      for (const set of body.matchAll(/ALTER\s+COLUMN\s+([a-z_][a-z0-9_]*)\s+SET\s+NOT\s+NULL/gi)) {
        table.required.add(set[1].toLowerCase());
      }
    }

    // Unique indexes, in file order, with drops applied — 0005 drops 0002's
    // `agent_outputs_identity_idx` and re-creates it with `project_id` in front, and a
    // parser that kept both would believe in a target Postgres no longer has.
    for (const drop of sql.matchAll(/DROP\s+INDEX\s+(?:IF\s+EXISTS\s+)?(?:[a-z_]+\.)?([a-z_][a-z0-9_]*)/gi)) {
      const name = drop[1].toLowerCase();
      for (const table of tables.values()) table.uniques.delete(`index:${name}`);
    }
    for (const match of sql.matchAll(
      /CREATE\s+UNIQUE\s+INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?([a-z_][a-z0-9_]*)\s+ON\s+([a-z_]+\.[a-z_]+)\s*\(([^)]*)\)([^;]*);/gi,
    )) {
      const table = tableOf(match[2].toLowerCase());
      const columns = IDENTIFIERS(match[3]);
      addUnique(table, `index:${match[1].toLowerCase()}`, {
        columns,
        partial: /\bWHERE\b/i.test(match[4] ?? ''),
        origin: match[1].toLowerCase(),
      });
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
      /**
       * One plausible row back, rather than none.
       *
       * `appendMessage` and `setThreadState` treat an empty `RETURNING` as a real refusal —
       * *"no such thread in this scope"*, *"the thread moved underneath you"* — and throw. A
       * recorder that always answered `{rows: []}` would make every harvest of those two
       * statements a thrown error, and the file would then be checking the statements it
       * happened to reach before the first throw. The shape is deliberately generic: nothing
       * downstream reads these values except to decide it got *something*.
       */
      return { rows: [{ id: 'probe', seq: 1, state: 'open' }] as unknown as never[] };
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
      // The column `0008` §3 left for this writer. It is supplied here because `startRun`
      // now opens a thread for every run — a probe that omitted it would be testing a
      // caller that no longer exists.
      threadId: '00000000-0000-4000-8000-00000000dead',
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

  /**
   * The thread plane (ADR-023, migration `0008_threads.sql`).
   *
   * Extended here rather than in a parallel file, on the reviewer's instruction and for the
   * reason that makes it right: a second agreement test would have a second parser, and the
   * two would agree about the schema until they did not. One parser, falsified once, applied
   * to every writer this repo has.
   *
   * `ops.thread` and `ops.message` between them carry **thirteen** NOT NULL columns with no
   * default, four of which (`delivery`, `thread_kind`, `seq`, `author`) exist only because of a
   * decision written in the last day. If any of them stops being named, the first thread a
   * person ever creates is refused by Postgres — which is the M15 failure mode with the words
   * "run" and "thread" swapped.
   */
  label = 'createThread — ops.thread';
  await createThread(db, {
    projectId: projectIdForSlug('agentos'),
    subject: { via: 'address', address: { form: 'direct', department: 'sales', slug: 'probe' } },
    createdBy: 'human:owner',
  });

  label = 'appendMessage — ops.message';
  await appendMessage(db, {
    threadId: '00000000-0000-4000-8000-000000000000',
    kind: 'human',
    interrupt: 'note',
    author: 'human:owner',
    body: 'probe',
  });

  label = 'appendMessage (question) — ops.message with the mandatory expiry';
  await appendMessage(db, {
    threadId: '00000000-0000-4000-8000-000000000000',
    kind: 'question',
    author: 'agent:sales/probe',
    body: 'probe?',
    payload: { options: ['a', 'b'] },
    expiresAt: now,
  });

  label = 'markMessagesDelivered — the mailbox drain';
  await markMessagesDelivered(db, ['00000000-0000-4000-8000-000000000001']);

  label = 'setThreadState — the transition writer';
  await setThreadState(db, '00000000-0000-4000-8000-000000000000', 'open', 'running');

  /**
   * `ops.work_product` (M17, ADR-026, `0010_work_products.sql`).
   *
   * Thirteen NOT NULL columns with no default, on a table describing something that has never
   * happened — no run has ever touched a repository, and no project has one to touch. So the
   * *only* instrument that can catch a writer/schema disagreement here is this one, and it has
   * to be pointed at the writer in the same commit as the migration. The alternative is that
   * the first repo-touching run ever performed fails at the INSERT, after the model was paid
   * for, which is M15 in a new table.
   *
   * `pushState`/`pushCheckedAt` are supplied as a **pair**, because the schema pins them with
   * an equality CHECK: a state with no observation time is a declared value, which is the
   * defect this whole entity is shaped around.
   */
  label = 'recordWorkProduct — ops.work_product';
  await recordWorkProduct(db, {
    runId: 'run_probe',
    projectId: projectIdForSlug('agentos'),
    threadId: '00000000-0000-4000-8000-00000000dead',
    repoPath: '/repo',
    worktreePath: '/worktrees/agentos/run_probe',
    branch: 'agnetos/run/run_probe',
    baseSha: '0'.repeat(40),
    headSha: '1'.repeat(40),
    commits: 1,
    filesChanged: 2,
    insertions: 3,
    deletions: 4,
    pushState: 'local',
    pushCheckedAt: now,
  });

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
    runs.columns.size >= 25,
    `only ${runs.columns.size} columns parsed for ops.agent_runs — a parser that finds almost ` +
      'nothing makes every assertion below pass, which is the failure this control exists for',
  );

  // Positive controls, one from CREATE TABLE (0001) and one from ADD COLUMN (0005).
  assert.equal(runs.columns.has('run_id'), true, 'a CREATE TABLE column');
  assert.equal(runs.columns.has('project_id'), true, 'an ALTER TABLE … ADD COLUMN column');

  // Negative control 1: the parser is a set, not a wildcard.
  assert.equal(runs.columns.has('column_that_does_not_exist'), false);

  // Negative control 2, and the sharp one. `0006_ops_device.sql` carries
  // `--     ALTER TABLE ops.device ADD COLUMN identity_id …` as a note about a *future*
  // migration. A parser that believed comments would invent a column, and would then pass a
  // writer that used it — a permissive lie, which is the direction that costs money.
  const device = tables.get('ops.device');
  assert.ok(device, 'ops.device is in the schema');
  assert.equal(device.columns.has('public_key'), true, 'a column that is really there');
  assert.equal(
    device.columns.has('identity_id'),
    false,
    'ops.device.identity_id exists only inside a comment in 0006 — it must not reach the schema',
  );

  assert.equal(functions.has('ops.prune'), true, 'CREATE OR REPLACE FUNCTION is read too');
  assert.equal(functions.has('ops.function_that_does_not_exist'), false);

  // 0008's two tables, so a parser that silently stopped reading at 0007 cannot make the
  // thread assertions below vacuous.
  assert.ok(tables.get('ops.thread'), 'ops.thread is in the schema (0008)');
  assert.ok(tables.get('ops.message'), 'ops.message is in the schema (0008)');
  // …and 0010's, for the same reason one migration further on.
  assert.ok(tables.get('ops.work_product'), 'ops.work_product is in the schema (0010)');
});

/**
 * **`ops.work_product`'s two representable absences, asserted in the schema** (M17, ADR-026).
 *
 * Both are nullable columns, and a nullable column is exactly what a parser reports when it has
 * stopped reading — so they are asserted next to a positive control from the same table. The
 * point of each is that a **NULL is a distinct answer**, not a missing one:
 *
 *   `push_state`      NULL ⇒ *nothing has ever looked*, which is not *nothing to push*.
 *   `worktree_removed_at` NULL ⇒ the tree is there, so *the diff is gone* is not *no changes*.
 */
test('the work product schema keeps its two absences representable', async () => {
  const { tables } = await readSchema();
  const wp = tables.get('ops.work_product')!;

  for (const column of ['run_id', 'project_id', 'thread_id', 'repo_path', 'worktree_path', 'branch', 'base_sha', 'head_sha', 'commits', 'files_changed', 'insertions', 'deletions']) {
    assert.equal(wp.required.has(column), true, `ops.work_product.${column} is NOT NULL with no default`);
  }
  assert.equal(wp.required.has('created_at'), false, 'NOT NULL DEFAULT now()');
  assert.equal(
    wp.required.has('push_state'),
    false,
    'nullable on purpose: NULL means nothing has ever looked, and a default of none would tell ' +
      'someone their work is safe when nothing examined it',
  );
  assert.equal(wp.required.has('push_checked_at'), false, 'moves with push_state, pinned by a CHECK');
  assert.equal(wp.required.has('worktree_removed_at'), false, 'NULL means the tree is still there');
  for (const outcome of ['pr_url', 'pr_state', 'ci_state', 'tests_run', 'tests_passed']) {
    assert.equal(wp.required.has(outcome), false, `${outcome} is recorded, not produced — NULL means nobody looked`);
  }

  // **No diff column, and that is the mechanism rather than a rule.** A diff is a body; a body
  // in a column is a body in a backup and one interpolation away from a span or a prompt.
  for (const column of [...wp.columns]) {
    assert.equal(
      /diff|patch|contents?$/.test(column),
      false,
      `ops.work_product.${column} looks like it holds file content. The diff is read from the ` +
        'worktree on demand and is deliberately not storable (work-product.md §6).',
    );
  }
});

/**
 * The second parser, falsified before it is trusted — `required` and `uniques`.
 *
 * Both are new, both fail *permissively* when they are wrong, and each has one specific way
 * of being vacuous: a `required` set that came out empty passes every insert, and a
 * `uniques` map that matched loosely would pass an `ON CONFLICT` naming a target Postgres
 * cannot infer.
 */
test('the parser knows which columns are mandatory and which conflict targets are declared', async () => {
  const { tables } = await readSchema();

  const runs = tables.get('ops.agent_runs')!;
  // The four that 0005 made mandatory with `ALTER COLUMN … SET NOT NULL` after a backfill —
  // exactly the four the writer did not name until 2026-08-17. A parser that missed them
  // would report green over the defect this whole file exists for.
  for (const column of ['project_id', 'agent_ref', 'source_ref', 'account_source']) {
    assert.equal(runs.required.has(column), true, `${column} is NOT NULL with no default`);
  }
  assert.equal(runs.required.has('run_id'), true, 'PRIMARY KEY implies NOT NULL');
  assert.equal(runs.required.has('dry_run'), false, 'NOT NULL DEFAULT false — the database fills it');
  assert.equal(runs.required.has('created_at'), false, 'NOT NULL DEFAULT now()');
  assert.equal(runs.required.has('cost_usd'), false, 'nullable on purpose: unknown is not zero');

  const outputs = tables.get('app.agent_outputs')!;
  assert.equal(
    outputs.required.has('id'),
    false,
    'bigserial carries an implicit default — demanding it would fail a correct insert, and a ' +
      'checker that cries wolf gets its assertion loosened within a week',
  );
  assert.equal(outputs.required.has('payload'), true);
  assert.equal(outputs.required.has('entity_key'), false, 'nullable: an output need not have a key');

  // The partial unique index, twice written: 0002 creates it on `(kind, entity_key)`; 0005
  // drops it and re-creates it on `(project_id, kind, entity_key)`. The DROP has to be
  // applied, or the parser believes in the *old* target — which is the 42P10 this repo
  // already shipped once.
  const identity = [...outputs.uniques.values()].filter((u) => u.origin === 'agent_outputs_identity_idx');
  assert.equal(identity.length, 1, 'one index of that name survives, not two');
  assert.deepEqual([...identity[0]!.columns].sort(), ['entity_key', 'kind', 'project_id']);
  assert.equal(identity[0]!.partial, true, 'it is partial — `WHERE entity_key IS NOT NULL`');

  const targets = new Set([...outputs.uniques.values()].map((u) => key(u.columns)));
  assert.equal(targets.has(key(['kind', 'entity_key'])), false, "0002's target was dropped by 0005");
  assert.equal(targets.has(key(['kind', 'invented'])), false, 'and the map is not a wildcard');

  /**
   * The inline-`UNIQUE` control, positive and negative, on live text.
   *
   * `ops.work_product.run_id` is `text NOT NULL UNIQUE` and `recordWorkProduct` conflicts on it;
   * `ops.work_product.branch` is not unique and must not read as though it were, or the parser
   * would accept an `ON CONFLICT` Postgres refuses with 42P10.
   */
  const wp = tables.get('ops.work_product')!;
  const wpTargets = new Set([...wp.uniques.values()].map((u) => key(u.columns)));
  assert.equal(wpTargets.has(key(['run_id'])), true, 'a column-level UNIQUE is an inferable target');
  assert.equal(wpTargets.has(key(['branch'])), false, 'and an ordinary column is not');

  const tools = tables.get('ops.agent_run_tools')!;
  assert.equal(
    new Set([...tools.uniques.values()].map((u) => key(u.columns))).has(key(['run_id', 'seq'])),
    true,
    'a table-level PRIMARY KEY (run_id, seq) is an inferable target too',
  );

  /**
   * **The `'default'`-inside-an-enum trap, asserted against the live text that contains it.**
   *
   * `ops.thread.delivery` is `text NOT NULL CHECK (delivery IN (…,'default',…))`. Until
   * `isRequired` stripped string literals, `\bdefault\b` matched inside the literal, the column
   * dropped out of `required`, and `createThread` stopped being checked for it. That is a
   * permissive failure — a broken writer reads green — which is the exact disease this file
   * exists to cure, arriving through the checker rather than the writer.
   *
   * Kept as a live case rather than a synthetic one: the migration deliberately leaves that
   * CHECK on the column line and says so, so this assertion is falsifiable by reverting one
   * `.replace()` and watching it go red.
   */
  const thread = tables.get('ops.thread')!;
  assert.equal(
    thread.required.has('delivery'),
    true,
    "NOT NULL with an enum containing 'default' — required, despite the word appearing in a string literal",
  );
  assert.equal(thread.required.has('id'), true, 'PRIMARY KEY with no default');
  assert.equal(thread.required.has('created_at'), false, 'NOT NULL DEFAULT now()');
  assert.equal(thread.required.has('due_at'), false, 'nullable: only a task has a due date');
  assert.equal(thread.required.has('account_id'), false, 'nullable: a preference, not the payer');

  const message = tables.get('ops.message')!;
  for (const column of ['thread_id', 'project_id', 'thread_kind', 'seq', 'kind', 'author', 'body']) {
    assert.equal(message.required.has(column), true, `ops.message.${column} is NOT NULL`);
  }
  assert.equal(message.required.has('interrupt'), false, 'null on anything a person did not send');
  assert.equal(message.required.has('expires_at'), false, 'null except on a question — a CHECK, not a NOT NULL');
  assert.equal(message.required.has('delivered_at'), false, 'null means still in the mailbox');

  /**
   * **`ops.agent_runs.thread_id` is mandatory as of `0009_run_thread_required.sql`, and this
   * assertion is the forcing function that has now fired.**
   *
   * It read `false` while 0008 shipped the column nullable, with the reason: a `NOT NULL` its
   * only writer cannot satisfy is exactly how M15's first paid run would have gone unrecorded.
   * The forcing function was that the day `ALTER COLUMN thread_id SET NOT NULL` landed, this
   * line would go red **and so would the main assertion below**, which demands every mandatory
   * column be named by the insert — so the flip could not be made without the writer moving in
   * the same commit, with no database, in milliseconds.
   *
   * That is what happened: `recordRun` names the column, so the assertion below finds it
   * already named and stays green. **The direction of this line is now the guard**: were 0009
   * reverted while the writer kept naming the column, this goes red rather than the schema
   * quietly widening under a writer nobody re-read.
   */
  assert.equal(
    runs.required.has('thread_id'),
    true,
    'NOT NULL as of 0009. If this is red, either the migration was reverted or the parser stopped ' +
      'reading `ALTER COLUMN … SET NOT NULL` — and the second one is the permissive failure.',
  );
  assert.equal(runs.columns.has('thread_id'), true, 'and the column exists (0008 §3)');
});

/**
 * **The other side of `0008` §3's judgement: the writer.**
 *
 * `0008` asked for a constraint to be graded *from both sides* — a `NOT NULL` nobody can
 * satisfy and one that holds are identical in a schema dump. The schema side was checked
 * above the day the column landed. This is the writer side, and it can only be asserted now
 * that a writer exists: `recordRun` names `thread_id`, so the day
 * `ALTER COLUMN thread_id SET NOT NULL` lands, the mandatory-column assertion in the main
 * test finds it already named and stays green — which is what makes that migration a
 * one-line change rather than a defect.
 *
 * Falsifiable in the direction that matters: delete `thread_id` from `recordRun`'s column
 * list and this goes red **with no database**, naming it. That is the check `0008` could not
 * write, because at the time there was nothing to check.
 */
test('recordRun names ops.agent_runs.thread_id, so the NOT NULL that follows is satisfiable', async () => {
  const statements = await harvestWrites();
  const insert = statements.find((s) => /INSERT\s+INTO\s+ops\.agent_runs/i.test(s.sql));
  assert.ok(insert, 'the ledger insert is in the harvest — otherwise this test checks nothing');

  const columns = IDENTIFIERS(insert.sql.match(/INSERT\s+INTO\s+ops\.agent_runs\s*\(([^)]*)\)/i)![1]);
  assert.equal(
    columns.includes('thread_id'),
    true,
    'recordRun must name thread_id. A run that cannot say which conversation it belongs to is ' +
      'a row `observability-engineer`\'s 34 metrics endpoints can only render as "no thread", ' +
      'and it is the column ADR-023 exists to add.',
  );

  // The placeholder count has to move with the column list. A 32-column insert with 31
  // placeholders is a runtime error on the first real run and invisible to `tsc`, because
  // the whole statement is one template literal.
  const values = insert.sql.match(/VALUES\s*\(([\s\S]*?)\)\s*ON\s+CONFLICT/i);
  assert.ok(values, 'the VALUES list is readable');
  const placeholders = new Set(values[1].match(/\$\d+/g) ?? []);
  assert.equal(
    placeholders.size,
    columns.length,
    `ops.agent_runs is written with ${columns.length} columns and ${placeholders.size} distinct ` +
      'placeholders. Postgres refuses the mismatch at execution time, which on this repo means ' +
      'the first paid run — not a test run, because the three tests that would execute it skip ' +
      'on DATABASE_URL.',
  );
});

/* -------------------------------------------------------------------------- *
 * The assertion the file is for
 * -------------------------------------------------------------------------- */

test('every column the ledger writer names exists, every mandatory one is named, and every conflict target is declared', async () => {
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
    const written = IDENTIFIERS(insert[2]);
    for (const column of written) {
      checked += 1;
      if (!known.columns.has(column)) {
        problems.push(`${label}: ${table}.${column} is written but no migration creates it`);
      }
    }

    /**
     * The mirror of the check above, and the one that would have caught the original defect
     * **by itself**: every `NOT NULL` column with no default must be *named*.
     *
     * The columns-exist check only sees names the writer supplies. The defect
     * `rtl-arabic-pdpl-specialist` found was the opposite shape — 0005 made `project_id`,
     * `agent_ref`, `source_ref` and `account_source` mandatory and `recordRun` named none of
     * them, so every name it did use was valid and the first real run would still have died
     * on a NOT NULL violation. A column list can be wrong by omission, and until now nothing
     * without a database could see that.
     */
    const omitted = [...known.required].filter((column) => !written.includes(column));
    checked += known.required.size;
    for (const column of omitted) {
      problems.push(
        `${label}: ${table}.${column} is NOT NULL with no default and the insert does not name it`,
      );
    }

    // The upsert's conflict target. Two questions, and the second one is new.
    const conflict = sql.match(/ON\s+CONFLICT\s*\(([^)]*)\)\s*(WHERE\s+[\s\S]*?)?\s*DO\s+(?:NOTHING|UPDATE)/i);
    if (conflict) {
      const columns = IDENTIFIERS(conflict[1]);
      for (const column of columns) {
        checked += 1;
        if (!known.columns.has(column)) {
          problems.push(`${label}: ON CONFLICT names ${table}.${column}, which does not exist`);
        }
      }

      /**
       * **Is there anything for Postgres to infer?** This is the half the sign-off recorded
       * as unobtainable without a database — *"it cannot tell whether the partial unique
       * index `ON CONFLICT` infers exists"* — and most of it turns out to be text. The
       * migrations declare their unique indexes and constraints; the statement declares its
       * target; a target with no matching declaration is `42P10` at plan time, which is how
       * this repo already broke `writeOutput` once, when 0005 dropped the index 0002 created.
       *
       * Still a lower bound, and the residue is named rather than implied: this reads the
       * migrations as *files*, so it cannot see an index created by hand on a live database,
       * and it compares column **sets**, so an expression index or a different operator class
       * would satisfy it here and not in Postgres. `sql-executes.test.ts` is where inference
       * is answered exactly. What this removes is the case where nobody declared one at all.
       */
      const supplied = Boolean(conflict[2]);
      const match = [...known.uniques.values()].find((u) => key(u.columns) === key(columns));
      checked += 1;
      if (!match) {
        const declared = [...known.uniques.values()].map((u) => `${u.origin}(${u.columns.join(', ')})`);
        problems.push(
          `${label}: ON CONFLICT (${columns.join(', ')}) on ${table} has no unique index or ` +
            `constraint to infer — the migrations declare ${declared.join(' · ') || 'none'}`,
        );
      } else if (match.partial && !supplied) {
        problems.push(
          `${label}: ${match.origin} is a PARTIAL unique index, so the statement must repeat its ` +
            'WHERE predicate or Postgres will not infer it (42P10)',
        );
      } else if (!match.partial && supplied) {
        problems.push(
          `${label}: the statement supplies an index predicate but ${match.origin} is not partial`,
        );
      }
    }

    for (const set of sql.matchAll(/(?:DO\s+UPDATE\s+SET|,)\s*([a-z_][a-z0-9_]*)\s*=\s*EXCLUDED\./gi)) {
      checked += 1;
      const column = set[1].toLowerCase();
      if (!known.columns.has(column)) {
        problems.push(`${label}: DO UPDATE SET names ${table}.${column}, which does not exist`);
      }
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
