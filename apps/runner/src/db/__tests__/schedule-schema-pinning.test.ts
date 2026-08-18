/**
 * **`0011_scheduling.sql` and `packages/contracts/src/scheduling.ts`, made to meet — without a
 * Postgres, and without a writer.**
 *
 * M18's foundation slice lands a schema and a vocabulary and **no writer at all**: there is no
 * clock in this repo, nothing computes an occurrence, and no row either table describes has ever
 * existed. That makes the usual instrument unavailable — `writer-schema-agreement.test.ts` asks
 * *"does every column the writer names exist"*, and here there is no writer to ask about.
 *
 * The question that is still answerable, and is the one M15 got wrong, is the reverse:
 * **does every constraint the schema imposes have a named, satisfiable other side?** BRIEF:
 * *a `NOT NULL` nobody can satisfy and one that holds look identical in a schema dump.* 0005
 * added four the ledger writer never named, and the first paid run would have failed to record
 * *after* the model was paid for. So the mandatory set is written down in
 * `SCHEDULE_REQUIRED_COLUMNS`, where the author of the eventual writer will meet it, and this
 * file asserts the two agree **in both directions** — a column added to the migration without a
 * DEFAULT and not added to the array fails, and an array entry with no such column fails.
 *
 * ## What this instrument cannot see, written down rather than discovered later
 *
 * 1. **It executes nothing.** It proves the migration *says* the right thing. `0005`–`0008` have
 *    never met a live Postgres either; `sql-executes.test.ts` is where execution lives and it
 *    skips on an unset `DATABASE_URL`. A gate that skips protects nothing, which is why this one
 *    reads text.
 * 2. **It is a parser over SQL**, so a column written in a shape it does not recognise is
 *    invisible — and *invisible reads as compliant*, which is the permissive direction. Every
 *    assertion below therefore carries a floor on what the parser found, and the negative
 *    controls at the bottom plant a violation and require the parser to see it.
 * 3. **It says nothing about behaviour.** That the fire row is written before the run is
 *    asserted here only as a CHECK existing in the text. The CHECK is the mechanism; this is
 *    the assertion that the mechanism is present.
 *
 * ## Falsified 2026-08-18 — and each plant was confirmed to have *applied* before its red was
 * believed, because a substitution that silently matched nothing is indistinguishable from a
 * gate that caught it (M16's finding, one turn further on).
 */
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  MISSED_RUN_POLICIES,
  OVERLAP_POLICIES,
  SCHEDULE_BUDGET_ENFORCEMENT,
  SCHEDULE_DELIVERIES,
  SCHEDULE_FIRE_REQUIRED_COLUMNS,
  SCHEDULE_FIRE_STATES,
  SCHEDULE_LIBRARY_MATERIALIZATION,
  SCHEDULE_REQUIRED_COLUMNS,
  SCHEDULE_SOURCES,
  SCHEDULE_THREAD_KINDS,
  TRIGGER_KINDS,
  agentFrontmatterSchema,
  assertScheduleAddressable,
  scheduleCost,
  scheduleFiresAreExact,
} from '@agnetos/contracts';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(HERE, '..', 'migrations');
const MIGRATION = join(MIGRATIONS, '0011_scheduling.sql');

/* -------------------------------------------------------------------------- *
 * The parser, and the two things it must strip before it reads anything
 * -------------------------------------------------------------------------- */

/**
 * `--` line comments go first. Not tidiness — correctness in the permissive direction.
 * `0011` documents the columns it deliberately does *not* create (`ops.task`, `ops.question`,
 * host concurrency) in prose, and a parser that read those would believe in columns Postgres has
 * never heard of.
 */
const stripLineComments = (sql: string): string => sql.replace(/--[^\n\r]*/g, '');

/**
 * String literals go second, and **only** for the DEFAULT test.
 *
 * This is a live trap in this exact file, not a hypothetical: `delivery` is `NOT NULL` and its
 * inline CHECK is `IN ('direct', 'dispatch', 'default')`. A mandatory-column test that looks for
 * the word DEFAULT in the column's text reads that as *optional* and silently stops checking it.
 * `writer-schema-agreement.test.ts` had exactly this bug against `ops.thread.delivery` and was
 * hardened for it; `ops.schedule.delivery` is the second live case and it is why the enum is
 * written inline here rather than moved to a table constraint.
 */
const stripStringLiterals = (sql: string): string => sql.replace(/'(?:[^']|'')*'/g, "''");

/** The body of `CREATE TABLE … ( … )`, balanced, so nested CHECK parens do not end it early. */
function tableBody(sql: string, table: string): string {
  const head = new RegExp(`CREATE TABLE(?:\\s+IF NOT EXISTS)?\\s+${table}\\s*\\(`, 'i');
  const at = sql.search(head);
  assert.notEqual(at, -1, `${table} was not found in the migration — the parser is blind.`);
  const open = sql.indexOf('(', at);
  let depth = 0;
  for (let i = open; i < sql.length; i += 1) {
    if (sql[i] === '(') depth += 1;
    else if (sql[i] === ')') {
      depth -= 1;
      if (depth === 0) return sql.slice(open + 1, i);
    }
  }
  throw new assert.AssertionError({ message: `${table}'s definition never closes.` });
}

/** Top-level entries of a table body: one per column or per table-level constraint. */
function entries(body: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < body.length; i += 1) {
    if (body[i] === '(') depth += 1;
    else if (body[i] === ')') depth -= 1;
    else if (body[i] === ',' && depth === 0) {
      out.push(body.slice(start, i));
      start = i + 1;
    }
  }
  out.push(body.slice(start));
  return out.map((e) => e.trim()).filter(Boolean);
}

const NOT_A_COLUMN = /^(CONSTRAINT|UNIQUE|PRIMARY|FOREIGN|CHECK|EXCLUDE)\b/i;

interface Column {
  name: string;
  text: string;
}

function columnsOf(sql: string, table: string): Column[] {
  return entries(tableBody(sql, table))
    .filter((e) => !NOT_A_COLUMN.test(e))
    .map((e) => ({ name: /^"?([a-z_]+)"?/i.exec(e)![1]!.toLowerCase(), text: e }));
}

/**
 * A column a writer must supply: `NOT NULL` (or `PRIMARY KEY`, which implies it) and no
 * `DEFAULT` — judged on text with string literals removed, per the trap above.
 */
function requiredColumns(sql: string, table: string): string[] {
  return columnsOf(sql, table)
    .filter((c) => {
      const bare = stripStringLiterals(c.text);
      const mandatory = /\bNOT\s+NULL\b/i.test(bare) || /\bPRIMARY\s+KEY\b/i.test(bare);
      return mandatory && !/\bDEFAULT\b/i.test(bare);
    })
    .map((c) => c.name);
}

/** The literals inside a named CHECK, which is how a vocabulary is spelled in this schema. */
function checkLiterals(sql: string, constraint: string): string[] {
  const re = new RegExp(`CONSTRAINT\\s+${constraint}\\s+CHECK\\s*\\(`, 'i');
  const at = sql.search(re);
  assert.notEqual(at, -1, `CONSTRAINT ${constraint} is not in the migration.`);
  const open = sql.indexOf('(', at);
  let depth = 0;
  for (let i = open; i < sql.length; i += 1) {
    if (sql[i] === '(') depth += 1;
    else if (sql[i] === ')') {
      depth -= 1;
      if (depth === 0) {
        return [...sql.slice(open, i).matchAll(/'([^']*)'/g)].map((m) => m[1]!);
      }
    }
  }
  throw new assert.AssertionError({ message: `${constraint} never closes.` });
}

const load = async (): Promise<string> => stripLineComments(await readFile(MIGRATION, 'utf8'));

/* -------------------------------------------------------------------------- *
 * 1. The mandatory set, graded from both sides
 * -------------------------------------------------------------------------- */

test('every NOT NULL column with no DEFAULT is named in the writer contract, and vice versa', async () => {
  const sql = await load();

  for (const [table, declared] of [
    ['ops.schedule', SCHEDULE_REQUIRED_COLUMNS],
    ['ops.schedule_fire', SCHEDULE_FIRE_REQUIRED_COLUMNS],
  ] as const) {
    const inSchema = requiredColumns(sql, table).sort();
    const inCode = [...declared].sort();

    // The parser going blind is how this class of test dies: an empty harvest satisfies a
    // subset check in both directions and reads as agreement.
    assert.ok(
      inSchema.length >= 6,
      `${table}: only ${inSchema.length} mandatory columns parsed. The parser is blind, or the ` +
        'schema stopped requiring anything — either way the comparison below means nothing.',
    );

    assert.deepEqual(
      inSchema,
      inCode,
      `${table}: the schema's mandatory columns and the writer contract disagree.\n` +
        `  schema:   ${inSchema.join(', ')}\n` +
        `  contract: ${inCode.join(', ')}\n` +
        'A NOT NULL nobody can satisfy and one that holds look identical in a schema dump ' +
        '(0005 added four the ledger writer never named).',
    );
  }
});

test('the four policy questions with no safe answer carry no DEFAULT', async () => {
  const sql = await load();
  const required = new Set(requiredColumns(sql, 'ops.schedule'));
  for (const column of ['missed_run_policy', 'overlap_policy', 'tz', 'follow_me']) {
    assert.ok(
      required.has(column),
      `ops.schedule.${column} has a DEFAULT or is nullable. Plan §14 details 3, 4 and 6 make ` +
        'these mandatory with no default: a default lets a writer that never considered the ' +
        'question look exactly like one that did, and skip vs catch_up_all fail in opposite ' +
        'directions.',
    );
  }
});

/* -------------------------------------------------------------------------- *
 * 2. The vocabularies — migration and module, one source each
 * -------------------------------------------------------------------------- */

test('every vocabulary in the migration matches the one in @agnetos/contracts', async () => {
  const sql = await load();
  const pairs: ReadonlyArray<readonly [string, readonly string[]]> = [
    ['schedule_source_known', SCHEDULE_SOURCES],
    ['schedule_trigger_kind_known', TRIGGER_KINDS],
    ['schedule_kind_known', SCHEDULE_THREAD_KINDS],
    ['schedule_delivery_known', SCHEDULE_DELIVERIES],
    ['schedule_missed_run_policy_known', MISSED_RUN_POLICIES],
    ['schedule_overlap_policy_known', OVERLAP_POLICIES],
    ['schedule_fire_state_known', SCHEDULE_FIRE_STATES],
  ];

  assert.equal(pairs.length, 7, 'seven vocabularies were pinned; the list changed.');

  for (const [constraint, declared] of pairs) {
    assert.deepEqual(
      checkLiterals(sql, constraint).sort(),
      [...declared].sort(),
      `${constraint} and its TypeScript vocabulary disagree.`,
    );
  }
});

test('a schedule cannot target @@ fan-out or a session — the CHECK is narrower than the grammar', async () => {
  const sql = await load();
  const delivery = checkLiterals(sql, 'schedule_delivery_known');
  assert.ok(delivery.length >= 3, 'the delivery CHECK parsed empty.');
  for (const refused of ['fan-out', 'session']) {
    assert.ok(
      !delivery.includes(refused),
      `ops.schedule.delivery accepts '${refused}'. @@ dispatch is refused until a cap proves a ` +
        'refusal, and that refusal is interactive — a stored fan-out schedule fires unattended ' +
        'with nobody to read it (ADR-024 ruling 5).',
    );
  }

  // And the same refusal before the database is reached, with a code and a sentence.
  assert.throws(
    () => assertScheduleAddressable({ form: 'fan-out', department: 'sales' }),
    (error: unknown) =>
      (error as { code?: string }).code === 'schedule_address_not_schedulable' &&
      /@@sales/.test((error as Error).message),
  );
  assert.doesNotThrow(() => assertScheduleAddressable({ form: 'dispatch', department: 'sales' }));
  assert.doesNotThrow(() =>
    assertScheduleAddressable({ form: 'direct', department: 'sales', slug: 'digest' }),
  );
  assert.doesNotThrow(() => assertScheduleAddressable({ form: 'default' }));
});

/* -------------------------------------------------------------------------- *
 * 3. The two details Plan §14 calls the most common scheduler bugs
 * -------------------------------------------------------------------------- */

test('the idempotency key is (schedule_id, occurrence_time) and it is a UNIQUE constraint', async () => {
  const sql = await load();
  const match = /CONSTRAINT\s+schedule_fire_idempotent\s+UNIQUE\s*\(([^)]*)\)/i.exec(sql);
  assert.ok(
    match,
    'schedule_fire_idempotent is missing. Plan §14 detail 2 calls a double-fire on restart ' +
      '"the single most common scheduler bug in existence."',
  );
  assert.deepEqual(
    match![1]!.split(',').map((c) => c.trim().toLowerCase()),
    ['schedule_id', 'occurrence_time'],
  );
});

test('the fire row is recorded before the run, and the schema is what says so', async () => {
  const sql = await load();
  assert.match(
    sql,
    /CONSTRAINT\s+schedule_fire_recorded_before_run\s+CHECK\s*\(\s*started_at IS NULL OR recorded_at <= started_at\s*\)/i,
    'schedule_fire_recorded_before_run is missing or was weakened. Fire-then-record makes ' +
      '"never fired" invisible (Plan §14 detail 1), and a comment saying "record first" is not ' +
      'a mechanism.',
  );

  // A pending row must not carry a start, or the state and the timestamps disagree about
  // whether anything ran.
  assert.match(sql, /CONSTRAINT\s+schedule_fire_pending_has_not_started\b/i);
  // A skipped fire that names no reason is the visible-but-silent failure one level down, and
  // it is the shape the budget refusal would land in.
  assert.match(sql, /CONSTRAINT\s+schedule_fire_skip_names_a_reason\b/i);
});

/* -------------------------------------------------------------------------- *
 * 4. Project pinning — the rule, over every migration, not over one file
 * -------------------------------------------------------------------------- */

/**
 * `threads-schema-pinning.test.ts` asserts this rule and reads **`0008` only**, so it is blind to
 * every migration written after it — an include-list is a decision to be blind to everything
 * unnamed (BRIEF). This runs the same rule over the whole directory, so a future migration cannot
 * quietly add the defect that FAILed M16's first review.
 */
test('every FK into a project-scoped table names project_id on both sides, in every migration', async () => {
  const scoped = new Set(['ops.thread', 'ops.message', 'ops.schedule', 'ops.schedule_fire']);
  const files = (await readdir(MIGRATIONS)).filter((f) => f.endsWith('.sql')).sort();
  assert.ok(files.length >= 9, `only ${files.length} migrations were read — the glob is blind.`);

  const found: string[] = [];
  const offenders: string[] = [];

  for (const file of files) {
    const sql = stripLineComments(await readFile(join(MIGRATIONS, file), 'utf8'));
    for (const m of sql.matchAll(
      /FOREIGN KEY\s*\(([^)]*)\)\s*REFERENCES\s+(ops\.[a-z_]+)\s*\(([^)]*)\)/gis,
    )) {
      const target = m[2]!.toLowerCase();
      const from = m[1]!.split(',').map((c) => c.trim().toLowerCase());
      const to = m[3]!.split(',').map((c) => c.trim().toLowerCase());
      found.push(`${file}:${target}`);
      if (!scoped.has(target)) continue;
      if (from.includes('project_id') && to.includes('project_id')) continue;
      offenders.push(`${file}: FOREIGN KEY (${from.join(', ')}) REFERENCES ${target}`);
    }
  }

  assert.ok(found.length >= 10, `only ${found.length} FKs matched across ${files.length} files — the matcher is blind.`);
  assert.deepEqual(
    offenders,
    [],
    'A single-column FK into a project-scoped table accepts a row in another project. This is ' +
      'the one item M16 FAILed on (`in_reply_to`), nine lines under a comment claiming the ' +
      'opposite.',
  );
});

/* -------------------------------------------------------------------------- *
 * 5. The money, and the two refusals that have never refused anything
 * -------------------------------------------------------------------------- */

test('the projection prints a count and no money, and says why', () => {
  const cost = scheduleCost({ form: 'dispatch', department: 'sales' }, 22, true);

  assert.equal(cost.fires, 22);
  assert.equal(cost.estimatedUsd, null);
  assert.equal(cost.estimateBasis, 'no-completed-runs');
  // `#department` reaches a lead who may delegate, and a delegation is a second run.
  assert.equal(cost.runsPerFireAreExact, false);
  assert.equal(scheduleCost({ form: 'direct', department: 's', slug: 'd' }, 1, true).runsPerFireAreExact, true);

  // Four of six triggers fire on the world or on a person. A calendar printing a confident
  // count under a Gmail filter is a plausible zero one decimal place up.
  assert.deepEqual(
    TRIGGER_KINDS.filter(scheduleFiresAreExact),
    ['cron', 'interval'],
  );

  // The type is the mechanism; the sweep above is the belt. `estimatedUsd` is typed `null`, so
  // the assignment that violates it stops the file compiling — and the runner's tests ARE
  // typechecked (`apps/runner/tsconfig.json` includes `src/**/*.ts`), unlike the web suite,
  // which is what made six `@ts-expect-error` gates decorative until M16.
  //
  // **The directive sits on the offending property, not above the declaration.** M16 shipped
  // one aimed at `const _priced: TurnCost = {`, where the *declaration* is; the assignment that
  // violates the type is a line lower, so it would have reported TS2578 *unused directive*
  // rather than guarding anything. Inert and misaimed, on the one surface where a plausible
  // number gets believed.
  const priced: ScheduleCostProjectionShape = {
    ...cost,
    // @ts-expect-error — there is no slot for money in a projection, by construction.
    estimatedUsd: 0.42,
  };
  assert.equal(typeof priced.fires, 'number');
});

type ScheduleCostProjectionShape = ReturnType<typeof scheduleCost>;

test('the budget refusal is declared, unexercised, and typed so that arming it is a diff', () => {
  assert.equal(SCHEDULE_BUDGET_ENFORCEMENT.enforced, false);
  assert.equal(SCHEDULE_BUDGET_ENFORCEMENT.everRefused, false);
  assert.equal(SCHEDULE_BUDGET_ENFORCEMENT.cap, 'ops.project.budget_monthly');

  // Arming the cap is a reviewable type-level act, not a config edit at 2am — the
  // `FAN_OUT_DISPATCH.allowed` precedent. Directive on the offending property, per above.
  const armed: typeof SCHEDULE_BUDGET_ENFORCEMENT = {
    ...SCHEDULE_BUDGET_ENFORCEMENT,
    // @ts-expect-error — `enforced` is typed `false`, and nothing has ever refused a fire.
    enforced: true,
  };
  assert.equal(armed.cap, 'ops.project.budget_monthly');
});

test('no source: library row is writable, because frontmatter carries a cron and nothing else', () => {
  const keys = new Set(Object.keys(agentFrontmatterSchema.shape));
  assert.ok(keys.has('schedule'), 'frontmatter lost `schedule:` — this assertion lost its subject.');
  assert.ok(keys.size >= 10, `only ${keys.size} frontmatter keys were read — the shape is blind.`);

  const present = SCHEDULE_LIBRARY_MATERIALIZATION.missingFromFrontmatter.filter(
    (k) => keys.has(k) || keys.has(k.replace(/_(.)/g, (_, c: string) => c.toUpperCase())),
  );
  assert.deepEqual(
    present,
    [],
    'frontmatter now carries scheduling intent, so a source: library row may finally be ' +
      'materializable. Revisit SCHEDULE_LIBRARY_MATERIALIZATION.possibleToday and ADR-024, and ' +
      'do not let four invented policy values ship as an author\'s choices.',
  );
  assert.equal(SCHEDULE_LIBRARY_MATERIALIZATION.possibleToday, false);
});

/* -------------------------------------------------------------------------- *
 * 6. Negative controls — proving the parser is not blind
 * -------------------------------------------------------------------------- */

test('the parser sees a planted violation rather than passing on an empty harvest', async () => {
  const sql = await load();

  // A column that does not exist must be absent — a parser matching everything would pass every
  // assertion above.
  assert.ok(!requiredColumns(sql, 'ops.schedule').includes('budget_monthly'));

  // A name that appears **only inside a `--` comment** must be invisible. `0011` names
  // `ops.question` and `ops.task` in prose as tables it deliberately does not create; a parser
  // that read comments would believe in both.
  const raw = await readFile(MIGRATION, 'utf8');
  assert.match(raw, /ops\.question/, 'the comment trap is gone — this control lost its subject.');
  assert.doesNotMatch(await load(), /ops\.question/, 'comments are not being stripped.');

  // The DEFAULT trap, live: `delivery` is NOT NULL and its CHECK contains the literal
  // 'default'. Without literal-stripping it reads as optional and stops being checked.
  const delivery = columnsOf(sql, 'ops.schedule').find((c) => c.name === 'delivery')!;
  assert.match(delivery.text, /'default'/, 'the DEFAULT trap is gone — this control is vacuous.');
  assert.ok(requiredColumns(sql, 'ops.schedule').includes('delivery'));

  // And the trap fires without the strip, which is what makes the strip load-bearing rather
  // than decorative.
  assert.ok(/\bDEFAULT\b/i.test(delivery.text), 'the unstripped column text no longer contains DEFAULT.');
});
