/**
 * A migration that adds a NOT NULL column and its only writer are **one change**.
 *
 * ## The defect this file was written for
 *
 * Migration 0005 added `project_id`, `agent_ref`, `source_ref` and `account_source` to
 * `ops.agent_runs`, backfilled them, and set every one `NOT NULL`. `db/ledger.ts` —
 * the single writer of that table — inserted none of them. Nothing anywhere failed:
 *
 *   - `tsc` cannot see a column list inside a template literal.
 *   - `sql-executes.test.ts` uses `PREPARE`, which *plans* a statement. Planning resolves
 *     column names and index inference; it does not evaluate a NOT NULL constraint. The
 *     probe would have passed.
 *   - The migrations have never been applied to a real Postgres, and zero runs have ever
 *     executed, so nothing had the chance to notice.
 *
 * The first run of step 0.3 — the very first real run this project ever performs — would
 * have raised a NOT NULL violation *after* the model had been paid for, and the ledger
 * would have been empty in exactly the way an honest empty ledger is empty.
 *
 * ## Why the assertion is on the migration text and not on a database
 *
 * The property is "the writer knows about every column the schema requires", and that is
 * answerable from the two files, with no Postgres, in milliseconds. The next migration to
 * add a required column to this table fails here rather than in production — which is the
 * whole point, because there is no production yet to fail in.
 */
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLedger, writeOutput } from '../ledger.ts';
import { projectIdForSlug } from '../../lib/project.ts';
import type { DbClient, RunRecord } from '../../observability/types.ts';

const DB_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Captures what a writer would have sent, without sending it. */
function recorder(): { db: DbClient; statements: { sql: string; params: readonly unknown[] }[] } {
  const statements: { sql: string; params: readonly unknown[] }[] = [];
  return {
    statements,
    db: {
      async query(sql: string, params: readonly unknown[] = []) {
        statements.push({ sql, params });
        return { rows: [{ id: 1 }] as never[] };
      },
    },
  };
}

const PROJECT_ID = projectIdForSlug('agentos');

function record(overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    runId: 'run_probe',
    traceId: 'trace_probe',
    traceUrl: null,
    agent: 'sales/probe',
    agentName: 'Probe',
    department: 'sales',
    model: 'claude-opus-4',
    trigger: 'manual',
    sessionId: null,
    // `RunRecord.threadId` (M16). `null` is the honest fixture value and not a
    // placeholder: nothing writes `ops.agent_runs.thread_id` yet — the column is nullable
    // on purpose (`0008_threads.sql` §3) and naming it in the INSERT is `runner-engineer`'s
    // line, filed as REQ-OBS-38.
    threadId: null,
    dryRun: false,
    status: 'ok',
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    durationMs: 1,
    inputTokens: 1,
    outputTokens: 1,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    costUsd: 0,
    costSource: 'sdk',
    toolCallCount: 0,
    errorCount: 0,
    redactionCount: 0,
    activityEvent: 'Probe',
    activityDetail: null,
    error: null,
    projectId: PROJECT_ID,
    agentRef: 'agentos/sales/probe',
    sourceRef: 'project:agents/sales/probe/SKILL.md@sha256:probe',
    accountId: null,
    accountSource: 'unattributed',
    ...overrides,
  };
}

/** Every `.sql` under `migrations/`, concatenated in filename order — the order they apply. */
async function allMigrations(): Promise<string> {
  const dir = join(DB_DIR, 'migrations');
  const names = (await readdir(dir)).filter((n) => n.endsWith('.sql')).sort();
  const parts: string[] = [];
  for (const name of names) parts.push(await readFile(join(dir, name), 'utf8'));
  return parts.join('\n');
}

/** Strip `--` comments so a column named only in prose is not mistaken for a column. */
function withoutComments(sql: string): string {
  return sql
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n');
}

test('every NOT NULL column the migrations put on ops.agent_runs is in the INSERT', async () => {
  const sql = withoutComments(await allMigrations());

  // Two shapes produce a required column: `CREATE TABLE … col type NOT NULL` and
  // `ALTER COLUMN col SET NOT NULL`. A column carrying a DEFAULT is excluded — the database
  // supplies it, and `created_at DEFAULT now()` is not something a writer should be
  // restating. **The four project-axis columns are named explicitly below anyway**, so the
  // day somebody "fixes" this test by giving `project_id` a default, the named assertions
  // still fail: an ambient default project is the precise mechanism ADR-015 Q2 refuses.
  const required = new Set<string>();

  const create = sql.match(/CREATE TABLE IF NOT EXISTS ops\.agent_runs\s*\(([\s\S]*?)\n\);/);
  assert.ok(create, 'ops.agent_runs is created somewhere in the migrations');
  for (const line of create[1]!.split('\n')) {
    if (/\bDEFAULT\b/i.test(line)) continue;
    const match = line.match(/^\s*([a-z_]+)\s+[a-z].*NOT NULL/i);
    if (match) required.add(match[1]!);
  }
  for (const match of sql.matchAll(
    /ALTER TABLE ops\.agent_runs([\s\S]*?);/g,
  )) {
    for (const col of match[1]!.matchAll(/ALTER COLUMN\s+([a-z_]+)\s+SET NOT NULL/gi)) {
      required.add(col[1]!);
    }
  }

  assert.ok(required.size >= 5, `found ${required.size} required columns — the parse is not working`);
  // Named explicitly so the parse itself cannot quietly stop finding the four that matter.
  for (const column of ['project_id', 'agent_ref', 'source_ref', 'account_source']) {
    assert.ok(required.has(column), `${column} is NOT NULL in the migrations`);
  }

  const rec = recorder();
  await createLedger(rec.db).recordRun(record(), []);
  const insert = rec.statements[0]?.sql ?? '';
  assert.match(insert, /INSERT INTO ops\.agent_runs/);

  const columns = insert
    .slice(insert.indexOf('(') + 1, insert.indexOf(')'))
    .split(',')
    .map((c) => c.trim());

  const absent = [...required].filter((column) => !columns.includes(column));
  assert.deepEqual(
    absent,
    [],
    `ops.agent_runs requires ${absent.join(', ')} and the ledger INSERT does not supply ` +
      'them. The first real run would fail a NOT NULL constraint after the model was paid for.',
  );

  // The placeholder count has to match the column count, or the insert fails at runtime in
  // a way no type checker can see.
  const values = insert.slice(insert.indexOf('VALUES'));
  const highest = Math.max(...[...values.matchAll(/\$(\d+)/g)].map((m) => Number(m[1])));
  assert.equal(highest, columns.length, 'one placeholder per column');
  assert.equal(rec.statements[0]?.params.length, columns.length, 'and one parameter per placeholder');
});

test('a run the runner could not attribute is refused, not written under a guess', async () => {
  for (const missing of ['projectId', 'agentRef', 'sourceRef'] as const) {
    const rec = recorder();
    await assert.rejects(
      () => createLedger(rec.db).recordRun(record({ [missing]: null }), []),
      (err: { code?: string; message?: string }) => {
        assert.equal(err.code, 'run_unattributed');
        assert.match(err.message ?? '', new RegExp(missing));
        return true;
      },
      `${missing} missing must refuse`,
    );
    assert.deepEqual(rec.statements, [], 'and nothing may be written — a half-attributed row is worse than none');
  }
});

test('agent_ref and agent cannot drift into disagreeing about which agent ran', async () => {
  const rec = recorder();
  await assert.rejects(
    () => createLedger(rec.db).recordRun(record({ agentRef: 'agentos/sales/somebody-else' }), []),
    (err: { code?: string }) => err.code === 'agent_ref_mismatch',
  );
  assert.deepEqual(rec.statements, []);

  // The same rule the database carries as `CHECK (agent_ref LIKE '%/' || agent)`. Asserted
  // against the migration text so the two cannot be relaxed independently.
  assert.match(await allMigrations(), /CHECK \(agent_ref LIKE '%\/' \|\| agent\)/);
});

test('a business row is upserted within its project, never across projects', async () => {
  const rec = recorder();
  await writeOutput(rec.db, {
    projectId: PROJECT_ID,
    runId: 'run_probe',
    agent: 'sales/probe',
    department: 'sales',
    kind: 'deal',
    entityKey: 'ACME-1',
    payload: { value: 1 },
  });

  const sql = rec.statements[0]?.sql ?? '';
  // The conflict target has to match the partial unique index migration 0005 created. Two
  // clients with a deal keyed `ACME-1` collided through the old `(kind, entity_key)` index —
  // one client's row overwritten by another's, which is a *write*, not a bad read.
  assert.match(sql, /ON CONFLICT \(project_id, kind, entity_key\) WHERE entity_key IS NOT NULL/);
  assert.match(
    await allMigrations(),
    /CREATE UNIQUE INDEX IF NOT EXISTS agent_outputs_identity_idx\s*\n\s*ON app\.agent_outputs \(project_id, kind, entity_key\)/,
    'and the index it targets is the one the migration builds',
  );
  assert.equal(rec.statements[0]?.params[0], PROJECT_ID, 'the project is the first parameter, not an afterthought');
});
