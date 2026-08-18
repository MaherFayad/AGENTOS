/**
 * `POST /api/run/:runId/input` is **never built** (ADR-023, `Plan §12` · §19).
 *
 * ## Why an absence gets a test
 *
 * BOARD, M16: *"M16 should leave behind a test asserting it is absent rather than a comment
 * saying it should be — the `cascade-ceiling.test.ts` precedent: assert the boundary, not the
 * intent."*
 *
 * The route does not exist today, so this file goes green on the day it is written. That is
 * the point and not a weakness: it is the only kind of test that can protect a decision *not*
 * to build something. Part One's M12 specified that endpoint; a future reader who finds
 * "steering" on a board and does not find the ADR will add it, and it will look like progress.
 * What they will hit instead is this assertion, naming the decision and the file that explains
 * it.
 *
 * ## What replaces it
 *
 * `POST /api/thread/:id/message` — one pipe, three interrupt levels, and the same pipe carries
 * the agent's questions back. Specified in `comms/contracts/thread-model.md` §4 by
 * `thread-model-engineer`; transcribed into `comms/contracts/api-contracts.md` and implemented
 * by `runner-engineer`, whose file that is.
 *
 * ## What this deliberately does not forbid
 *
 * `POST /api/sessions/:id/input` (spec §3.1, `api-contracts.md`). That is
 * `sessions-relay-engineer`'s end-to-end-encrypted session steering and it is unaffected —
 * ADR-023 supersedes the *run* input endpoint, not the session one. A scanner that caught both
 * would be a scanner someone disables.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..', '..', '..');

/**
 * The needle is assembled rather than written, so this file does not match itself and the
 * scan does not need an exception for the one place the string is allowed to appear.
 */
const RUN = 'run';
const INPUT = 'input';

/** `/api/run/:runId/input`, `/api/run/${id}/input`, `run/:id/input` — anything of that shape. */
const FORBIDDEN = new RegExp(`/api/${RUN}/[^\\s'"\`)]*/${INPUT}\\b`);

/**
 * **The one way the route may legally be written: on a line that says it is not built.**
 *
 * A blanket ban has a defect that shows up immediately — it forbids the documents whose *job*
 * is to forbid the route. `thread-model.md` §1 lists what ADR-023 deletes, and a checker that
 * cannot tell a prohibition from a specification forces the prohibition to go unwritten, which
 * is worse than the thing it was guarding.
 *
 * An exclusion list by filename would rot: it grows, nobody prunes it, and eventually the file
 * that matters is on it. A **semantic** marker cannot rot in that direction — the only way to
 * satisfy it is to write, on the same line, that the route is superseded or never built, which
 * is exactly the sentence a reader who greps for this route needs to find.
 */
const PERMITTED_ON_A_LINE_THAT_SAYS_SO = /never built|supersede/i;

const SCAN_ROOTS = [
  join(ROOT, 'comms', 'contracts'),
  join(ROOT, 'packages', 'contracts', 'src'),
  join(ROOT, 'apps', 'runner', 'src'),
  join(ROOT, 'apps', 'web', 'src'),
];

const EXTENSIONS = ['.ts', '.tsx', '.md'];

async function* walk(dir: string): AsyncGenerator<string> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      yield* walk(full);
    } else if (EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
      yield full;
    }
  }
}

test('no contract, route or client mentions the superseded run-input endpoint', async () => {
  const offenders: string[] = [];
  let scanned = 0;

  for (const root of SCAN_ROOTS) {
    // A scan over a directory that does not exist finds nothing and reads as success — the
    // vacuity failure this repo has now found in three separate checkers.
    const info = await stat(root).catch(() => null);
    assert.ok(info?.isDirectory(), `${relative(ROOT, root)} is not a directory — the scan would be vacuous`);

    for await (const file of walk(root)) {
      if (file.endsWith(`__tests__${sep}superseded-run-${INPUT}.test.ts`)) continue;
      scanned += 1;
      const text = await readFile(file, 'utf8');
      for (const [index, line] of text.split(/\r?\n/).entries()) {
        if (!FORBIDDEN.test(line)) continue;
        if (PERMITTED_ON_A_LINE_THAT_SAYS_SO.test(line)) continue;
        offenders.push(`${relative(ROOT, file)}:${index + 1}: ${line.trim()}`);
      }
    }
  }

  assert.ok(scanned > 100, `only ${scanned} files scanned — the walker is broken and this test would pass by having nothing to read`);

  assert.deepEqual(
    offenders,
    [],
    'ADR-023 supersedes POST /api/' +
      `${RUN}/:runId/${INPUT}; it is never built. Steering is POST /api/thread/:id/message ` +
      '(comms/contracts/thread-model.md §4). If this route is genuinely needed, that is a ' +
      'decision-request to runner-engineer and an amendment to ADR-023 — not an addition here.' +
      `\n\n${offenders.join('\n')}`,
  );
});

/**
 * **M11 stays absorbed — the three tables that are never created** (M17 hazard 4, BOARD's
 * amendments table, `Plan §13`/§19).
 *
 * Extending *this* file rather than writing a fourth paragraph about it, on the frame's own
 * instruction: `M17 extends that test with the three refused table names rather than writing a
 * fourth paragraph`. The reasoning is identical to the route above — an absence needs a gate,
 * because a future reader who finds "three finished runs awaiting review" on a board and does
 * not find this decision will add `ops.review`, and it will look like progress.
 *
 * §13 is exactly where it gets proposed: a review queue looks precisely like a task list. It is
 * **a query, not a table** — `work_product WHERE push_state = 'local' OR pr_state = 'open'`,
 * served by a partial index in `0010_work_products.sql`.
 *
 * Scoped to the migrations, deliberately. A blanket source scan would catch prose that
 * *forbids* these tables (this file, the migration headers, the contract), and a checker that
 * cannot tell a prohibition from a specification forces the prohibition to go unwritten. A
 * `CREATE TABLE` is unambiguous.
 */
test('ops.task, ops.question and ops.review are never created by any migration', async () => {
  const migrations = join(ROOT, 'apps', 'runner', 'src', 'db', 'migrations');
  const files = (await readdir(migrations)).filter((f) => f.endsWith('.sql')).sort();
  assert.ok(files.length >= 10, `only ${files.length} migrations read — the scan would be vacuous`);

  const offenders: string[] = [];
  let sawATable = false;
  for (const file of files) {
    const sql = (await readFile(join(migrations, file), 'utf8')).replace(/--[^\n]*/g, '');
    for (const match of sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_]+\.[a-z_]+)/gi)) {
      sawATable = true;
      const table = (match[1] as string).toLowerCase();
      if (['ops.task', 'ops.question', 'ops.review'].includes(table)) offenders.push(`${file}: ${table}`);
    }
  }

  // The vacuity control: a scan that matched no `CREATE TABLE` at all would report success
  // over a schema full of them.
  assert.equal(sawATable, true, 'no CREATE TABLE was matched — the scanner is broken');
  assert.deepEqual(
    offenders,
    [],
    'A task IS a thread with a due date; a question IS a message kind; the review queue IS a ' +
      'query over ops.work_product. M11\'s parallel entity model is absorbed, not built ' +
      '(BOARD amendments, ADR-023, ADR-026). Creating one of these is an ADR, not a migration.\n\n' +
      offenders.join('\n'),
  );
});

test('the scanner would catch it — falsified against a planted line', () => {
  // A test that has never been red proves nothing. The regex is exercised here against the
  // exact string it exists to forbid, and against the session route it must not touch.
  assert.equal(FORBIDDEN.test(`await fetch('/api/${RUN}/abc123/${INPUT}', { method: 'POST' })`), true);
  assert.equal(FORBIDDEN.test(`| \`POST /api/${RUN}/:runId/${INPUT}\` | steer the run |`), true);
  assert.equal(FORBIDDEN.test(`| \`POST /api/sessions/:id/${INPUT}\` | steer the session |`), false);
  assert.equal(FORBIDDEN.test('POST /api/thread/:id/message'), false);

  // And the marker: a specification is caught, a prohibition is not, and the marker alone does
  // not excuse an unrelated line.
  const spec = `| \`POST /api/${RUN}/:runId/${INPUT}\` | steer the run |`;
  const prohibition = `\`POST /api/${RUN}/:runId/${INPUT}\` — never built (ADR-023).`;
  assert.equal(FORBIDDEN.test(spec) && !PERMITTED_ON_A_LINE_THAT_SAYS_SO.test(spec), true, 'a spec is an offender');
  assert.equal(PERMITTED_ON_A_LINE_THAT_SAYS_SO.test(prohibition), true, 'a prohibition is not');
  assert.equal(FORBIDDEN.test('this line is never built and names no route'), false);
});

test('the table scanner would catch a planted CREATE TABLE — falsified in place', () => {
  // Same discipline as above, on the pattern this time rather than on the corpus: the M11
  // scan is worthless if its regex cannot see the statement it forbids.
  const CREATE = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_]+\.[a-z_]+)/gi;
  const found = (sql: string): string[] => [...sql.matchAll(CREATE)].map((m) => (m[1] as string).toLowerCase());

  assert.deepEqual(found('CREATE TABLE IF NOT EXISTS ops.review (\n  id uuid\n);'), ['ops.review']);
  assert.deepEqual(found('CREATE TABLE ops.task (id uuid);'), ['ops.task']);
  assert.deepEqual(found('CREATE INDEX ops_task_idx ON ops.thread (due_at);'), [], 'an index is not a table');
  // And the comment case, which is how the real scan reads the migrations: 0008's header
  // discusses `ops.task` at length, and a scanner that read prose would fail on the file whose
  // job is to forbid it.
  const commented = '-- CREATE TABLE ops.task — never.\n'.replace(/--[^\n]*/g, '');
  assert.deepEqual(found(commented), []);
});
