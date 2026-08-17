/**
 * **Every self- and cross-reference in `0008` carries the project, or it is not a reference this
 * migration is allowed to make.**
 *
 * ## The defect this exists because of
 *
 * `fidelity-qa-reviewer` FAILed the M16 foundation slice on one item:
 *
 * ```sql
 * FOREIGN KEY (in_reply_to) REFERENCES ops.message(id) ON DELETE RESTRICT;
 * ```
 *
 * — the single reference in the whole migration that was not project-pinned, **nine lines under
 * a comment claiming "a message cannot be attributed to another client's thread."** A
 * single-column FK accepts any message id in the table, including one in another project, and
 * `in_reply_to` is reachable end to end from a caller-supplied `inReplyTo` on the route.
 * `message_answer_replies` then makes the column mandatory on every answer, so the unchecked
 * path was the only path an answer could take.
 *
 * It is `thread-model.md` §4.1's family one level down. §8b grades a mechanism by asking whether
 * the role this stack connects as bypasses it; this FK passes that test and fails a different
 * one — **it was simply narrower than the claim written above it.** A comment asserting an
 * invariant the constraint beneath it does not enforce is a declared value read as an observed
 * one, in SQL.
 *
 * ## Why the gate is structural rather than an executed INSERT
 *
 * The honest test is to plant a cross-project reply and watch Postgres refuse it. That test
 * exists in spirit in `sql-executes.test.ts` and **it cannot run here**: no migration in this
 * repo has ever been applied to a Postgres, `DATABASE_URL` is unset, and that suite skips. A
 * gate that skips is a gate that protects nothing — three tests already skip in `test:runner`
 * for exactly this reason and they are the reason `thread-model.md` §8 exists.
 *
 * So this reads the SQL text, which is what is actually present on this stack. **It asserts a
 * rule rather than a line**: the reviewer found one unpinned FK, and a test for that one line
 * would not have caught it before it was written, nor catch the next one. Enumerating every FK
 * and requiring the project column on both sides catches the whole class.
 *
 * ## What this instrument cannot see
 *
 * 1. **It does not execute anything.** It proves the migration *says* the right thing, not that
 *    Postgres accepts it. `sql-executes.test.ts` is where that lives, and it is skipped.
 * 2. **It is a regex over SQL**, so a reference written in a shape it does not recognise —
 *    a trigger, a deferred `ALTER` in a later migration, an FK spelled across more lines than
 *    the matcher spans — is invisible. The count assertion below is the guard against that:
 *    if the matcher stops finding the FKs it found today, the suite fails rather than passing
 *    with nothing to check.
 * 3. **It says nothing about the writer.** `appendMessage`'s thread-scoped predicate on
 *    `in_reply_to` is asserted separately, at the bottom.
 *
 * ## Falsified — and the falsification itself failed first, which is worth recording
 *
 * Four defects planted, each observed red on its own assertion and green on restore: the
 * single-column FK restored, `MATCH FULL` added, `UNIQUE (id, project_id)` deleted, and the
 * writer's predicate short-circuited to `TRUE`.
 *
 * **Two of the four plants initially did not land, and both read as the gate holding.** The
 * substitutions matched `\n` against a file with CRLF endings, changed nothing, and the suite
 * went green — which I very nearly recorded as "falsified". *A plant that does not apply is
 * indistinguishable from a gate that catches it*, which is BRIEF's *a test that has never been
 * red proves nothing* with one more turn on it: **the falsification step needs its own
 * falsification.** Every plant here was re-run with an assertion that the file actually changed
 * before the red was believed.
 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATION = join(HERE, '..', 'migrations', '0008_threads.sql');
const WRITER = join(HERE, '..', 'threads.ts');

/**
 * `FOREIGN KEY (a, b) REFERENCES ops.x (c, d)` — across newlines, because every FK in this file
 * is written on two lines and a matcher that stopped at one would find none of them.
 */
const FOREIGN_KEY =
  /FOREIGN KEY\s*\(([^)]*)\)\s*REFERENCES\s+(ops\.[a-z_]+)\s*\(([^)]*)\)/gis;

/**
 * Tables whose rows belong to a project, and therefore may only be referenced *with* the
 * project. `ops.project` itself is excluded because `project_id → ops.project(id)` is the axis's
 * own definition, and `ops.billing_account` because ADR-015 Q20 puts accounts beside projects
 * rather than inside them — pinning that FK to a project would be wrong, not stricter.
 */
const PROJECT_SCOPED = new Set(['ops.thread', 'ops.message']);

const columns = (list: string): string[] =>
  list.split(',').map((c) => c.trim().toLowerCase()).filter(Boolean);

test('every FK into a project-scoped table names project_id on both sides', async () => {
  const sql = await readFile(MIGRATION, 'utf8');
  assert.ok(sql.length > 5_000, 'the migration did not load — this test would pass by having nothing to read');

  const found: string[] = [];
  const offenders: string[] = [];

  for (const match of sql.matchAll(FOREIGN_KEY)) {
    const [, referencing, table, referenced] = match;
    const target = table!.toLowerCase();
    found.push(`${target}(${columns(referenced!).join(',')})`);
    if (!PROJECT_SCOPED.has(target)) continue;

    const from = columns(referencing!);
    const to = columns(referenced!);
    if (from.includes('project_id') && to.includes('project_id')) continue;

    offenders.push(`FOREIGN KEY (${from.join(', ')}) REFERENCES ${target} (${to.join(', ')})`);
  }

  // The matcher going blind is the failure mode this class of test dies of. Six FKs are in the
  // file today; if the count drops, the regex has rotted or a constraint was deleted, and either
  // way the green above meant nothing.
  assert.ok(
    found.length >= 6,
    `only ${found.length} foreign keys matched in 0008 — there were 6. The matcher is blind, or a ` +
      `constraint was removed.\n\nmatched: ${found.join(' · ')}`,
  );

  assert.deepEqual(
    offenders,
    [],
    'A foreign key into a project-scoped table that does not name `project_id` on both sides ' +
      'accepts rows that cross projects — which is the one thing this migration exists to make ' +
      'impossible. `fidelity-qa-reviewer` found exactly this on `in_reply_to`: a single-column ' +
      'self-reference sitting under a comment that claimed the opposite. Add `project_id` to ' +
      'both column lists, and add the `UNIQUE (id, project_id)` the composite FK needs as its ' +
      `target.\n\n${offenders.join('\n')}`,
  );
});

test('the composite FK targets exist, so the migration can actually apply', async () => {
  const sql = await readFile(MIGRATION, 'utf8');

  // A composite FK needs a unique constraint covering exactly the referenced columns. Without
  // it the ALTER fails at apply time — and on a stack where no migration has ever been applied,
  // "fails at apply time" is a failure **nothing observes**. That is why this is asserted here
  // and not left to Postgres.
  assert.match(sql, /UNIQUE \(id, project_id\)[\s\S]*?UNIQUE \(id, project_id, kind\)/, 'ops.thread must carry both composite unique keys');
  assert.match(sql, /UNIQUE \(thread_id, seq\),\s*(--[^\n]*\n\s*)*UNIQUE \(id, project_id\)/, 'ops.message must carry UNIQUE (id, project_id) as the reply FK target');

  // And the pinned constraint is present under its own name, so a database holding the old
  // single-column version is corrected rather than skipped by an `IF NOT EXISTS` guard.
  assert.match(sql, /DROP CONSTRAINT message_reply_fk/, 'the unpinned constraint must be dropped by name');
  assert.match(sql, /ADD CONSTRAINT message_reply_project_fk/);
});

test('in_reply_to stays nullable, and MATCH FULL is never used', async () => {
  const sql = await readFile(MIGRATION, 'utf8');

  // The trap in this fix, and it is one keyword wide. `project_id` is NOT NULL, so under
  // `MATCH FULL` a row with a NULL `in_reply_to` fails the constraint — which would reject
  // **every message that is not a reply**. That is M15's ledger defect (a NOT NULL nobody can
  // satisfy) reached by a different route, and the default MATCH SIMPLE is what avoids it.
  //
  // Scanned line by line with SQL comments skipped, because the migration *explains* this trap
  // in prose and a whole-file match flagged that explanation — the same self-match that made
  // `superseded-run-input.test.ts` assemble its needle. A gate that forbids naming the thing it
  // guards against forces the warning to go unwritten, which is worse than the trap.
  const matchFull = sql
    .split(/\r?\n/)
    .map((line, i) => [i + 1, line] as const)
    .filter(([, line]) => !line.trim().startsWith('--') && /MATCH\s+FULL/i.test(line))
    .map(([n, line]) => `0008_threads.sql:${n}: ${line.trim()}`);

  assert.deepEqual(
    matchFull,
    [],
    'MATCH FULL on a composite FK whose other column is NOT NULL rejects every row where the ' +
      'nullable column is null — here, every message that is not a reply. Leave it at the ' +
      `default MATCH SIMPLE.\n\n${matchFull.join('\n')}`,
  );

  // And the column itself must not have acquired a NOT NULL. A first message replies to nothing.
  assert.match(sql, /^\s*in_reply_to\s+uuid,\s*$/m, 'in_reply_to must stay a bare nullable uuid');
});

test('the writer does not trust a caller-supplied inReplyTo', async () => {
  const writer = await readFile(WRITER, 'utf8');

  // The schema pins the project; the writer pins the thread, which is tighter and is the half
  // that gives the caller a sentence instead of a raw 23503. Asserted structurally because the
  // statement cannot be executed here.
  assert.match(
    writer,
    /\$8::uuid IS NULL OR EXISTS \(\s*SELECT 1 FROM ops\.message r\s*WHERE r\.id = \$8::uuid AND r\.thread_id = t\.id\)/,
    'appendMessage must constrain a caller-supplied inReplyTo to this thread, inside the INSERT ' +
      'statement rather than in a read-then-write before it',
  );

  // Zero rows now has three causes and the error path has to be able to name which.
  assert.match(writer, /inReplyTo: string \| null/, 'explainAppendFailure must receive the reply target to explain it');
});

test('falsified — the matcher fires on the constraint as it was written', () => {
  // A test that has never been red proves nothing. This is the removed line verbatim.
  const wasThere = `
    ALTER TABLE ops.message
      ADD CONSTRAINT message_reply_fk
      FOREIGN KEY (in_reply_to) REFERENCES ops.message(id) ON DELETE RESTRICT;`;

  const matches = [...wasThere.matchAll(FOREIGN_KEY)];
  assert.equal(matches.length, 1, 'the matcher must see the constraint that was actually there');
  const [, referencing, table, referenced] = matches[0]!;
  assert.equal(table!.toLowerCase(), 'ops.message');
  assert.equal(columns(referencing!).includes('project_id'), false, 'and must judge it unpinned');
  assert.equal(columns(referenced!).includes('project_id'), false);

  // The replacement passes, and the two FKs that were already correct are not disturbed.
  const isFixed = 'FOREIGN KEY (in_reply_to, project_id)\n      REFERENCES ops.message (id, project_id) ON DELETE RESTRICT;';
  const [fixed] = [...isFixed.matchAll(FOREIGN_KEY)];
  assert.equal(columns(fixed![1]!).includes('project_id'), true);
  assert.equal(columns(fixed![3]!).includes('project_id'), true);

  // And an FK to a table that is not project-scoped is deliberately left alone — a gate that
  // demanded `project_id` on `account_id → ops.billing_account(id)` would be wrong, not
  // stricter, and would be turned off by the first person it blocked (ADR-015 Q20).
  assert.equal(PROJECT_SCOPED.has('ops.billing_account'), false);
  assert.equal(PROJECT_SCOPED.has('ops.project'), false);
});
