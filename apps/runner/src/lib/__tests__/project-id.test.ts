/**
 * One identifier, one definition — asserted against the migration's own text.
 *
 * `ops.project.id` is computed in two places: `ops.project_id_for(text)` in
 * `0005_project_axis.sql`, and `projectIdForSlug` in `lib/project.ts`. It has to be two
 * places, because the runner must serve MAP, CHART and the drawer with **no Postgres at
 * all** (`--profile dev`) and therefore cannot ask the database what id it mounts.
 *
 * Two implementations of one identifier is how a foreign key silently stops matching. The
 * failure would not look like a bug: rows would insert, queries would return nothing, and
 * every surface would render an honest-looking empty state for a project whose data was
 * sitting right there under a different uuid. That is the exact `unknown`-read-as-`zero`
 * disease this repo keeps finding, arriving through a hash function.
 *
 * So this suite does not restate the formula in prose and trust it. It **reads the
 * migration file** and asserts the expression, the slug regex and the reserved list are
 * character-for-character what the TypeScript implements. Editing either side alone fails
 * here, in milliseconds, with no database.
 *
 * ## What it does not prove, stated plainly
 *
 * That Postgres's `md5(text)::uuid` and Node's `createHash('md5')` agree at runtime. They
 * do — both are RFC 1321 over the same bytes, and the uuid cast is a pure re-slicing of the
 * same 32 hex digits — but *proving* it needs a live database, and that is
 * `sql-executes.test.ts`'s job whenever one is up. This file proves the two sides are
 * computing the same thing; that file proves the thing computes.
 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isProjectSlug, PROJECT_SLUG_RE, RESERVED_PROJECT_SLUGS } from '@agnetos/contracts';
import { projectIdForSlug } from '../project.ts';

const MIGRATION = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'db',
  'migrations',
  '0005_project_axis.sql',
);

const readMigration = (): Promise<string> => readFile(MIGRATION, 'utf8');

test('the TypeScript id and the SQL id are computed from the same expression', async () => {
  const sql = await readMigration();

  // The literal the function body must contain. If someone salts it, changes the prefix,
  // or swaps md5 for something else, this line fails and the TypeScript below is wrong in
  // a way no other test would notice.
  assert.ok(
    sql.includes("SELECT md5('agnetos.project:' || slug)::uuid"),
    'ops.project_id_for must be md5 over the `agnetos.project:` prefix — change it and change project.ts in the same commit',
  );

  // …and the TypeScript computes that expression, spelled out here rather than imported,
  // so that a change to `projectIdForSlug` cannot make this assertion agree with itself.
  const { createHash } = await import('node:crypto');
  const hex = createHash('md5').update('agnetos.project:agentos').digest('hex');
  const asUuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;

  assert.equal(projectIdForSlug('agentos'), asUuid);
  assert.match(projectIdForSlug('agentos'), /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);

  // Different slugs are different projects, and the id is stable across calls — the two
  // properties every foreign key in migration 0005 rests on.
  assert.notEqual(projectIdForSlug('agentos'), projectIdForSlug('client-x'));
  assert.equal(projectIdForSlug('client-x'), projectIdForSlug('client-x'));
});

test('the seeded row and the mounted default name the same project', async () => {
  const sql = await readMigration();
  assert.ok(
    sql.includes("VALUES (ops.project_id_for('agentos'), 'agentos', 'AgentOS'"),
    'migration 0005 seeds `agentos`; `config.projectSlug` defaults to the same slug (Plan §24: nothing moves on disk)',
  );
  // Backfill of pre-project rows targets that same project. A backfill pointing anywhere
  // else would orphan every existing ledger row behind a foreign key (ADR-015 Q3).
  assert.ok(sql.includes("SET project_id = ops.project_id_for('agentos')"));
});

test('the slug rules in TypeScript mirror the CHECK constraints in SQL', async () => {
  const sql = await readMigration();

  assert.ok(
    sql.includes("CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')"),
    'slug_is_a_slug must match PROJECT_SLUG_RE',
  );
  assert.equal(
    PROJECT_SLUG_RE.source,
    '^[a-z0-9]+(?:-[a-z0-9]+)*$',
    'same language as the SQL regex — the non-capturing group is a JS nicety, not a difference',
  );

  assert.ok(
    sql.includes("CHECK (slug NOT IN ('all','p','api'))"),
    'slug_is_not_reserved must match RESERVED_PROJECT_SLUGS',
  );
  assert.deepEqual([...RESERVED_PROJECT_SLUGS].sort(), ['all', 'api', 'p']);

  // The reserved names are reserved for a reason a reader can check: each one would make a
  // URL ambiguous. `p` is the project namespace, `all` is the deliberate cross-project one.
  for (const reserved of RESERVED_PROJECT_SLUGS) {
    assert.equal(isProjectSlug(reserved), false, `"${reserved}" would make /api/p/… ambiguous`);
  }
  assert.equal(isProjectSlug('AgentOS'), false, 'slugs are lowercase');
  assert.equal(isProjectSlug('client_x'), false, 'kebab, not snake');
  assert.equal(isProjectSlug('client-x'), true);
});

/**
 * `library_remote` is `null` because the database will not hold anything else, not because
 * the code happens not to set it.
 *
 * A git remote sends a project's library to a third party, which is the same class of event
 * as a `deliver:` target leaving the tailnet — an open egress question on the BOARD under
 * `rtl-arabic-pdpl-specialist` (Part VII.4). The CHECK is what makes `toProjectSummary`'s
 * hardcoded `null` a statement of fact rather than a placeholder somebody will helpfully
 * fill in. Dropping a constraint is a reviewable act; ignoring a comment is not.
 */
test('the egress question is held open by a constraint, not by a comment', async () => {
  const sql = await readMigration();
  assert.ok(sql.includes('CONSTRAINT library_remote_needs_egress_adr CHECK (library_remote IS NULL)'));
});

/**
 * Nothing project-shaped may assume seven departments (BOARD, M15 scope note).
 *
 * `Plan §10` says seven business departments in one sentence and an eighth, `engineering`,
 * in the next. The eighth is out of M15 — but the cheap half, not baking the count into the
 * schema, is bought now. This asserts it stayed bought.
 */
test('migration 0005 bakes in no department count', async () => {
  // Comments stripped first. The file *says* "there is no `CHECK (department IN (...))`"
  // in its own header, and a test that matched its own documentation would be the purest
  // form of the mistake this repo keeps auditing for.
  const statements = (await readMigration())
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n');

  assert.equal(
    /CHECK\s*\([^)]*\bdepartment\b[^)]*\bIN\b/i.test(statements),
    false,
    'no department enum in a project-shaped table — the seven-vs-eight question is still open',
  );
  assert.equal(
    /\bdepartment\b[^\n]*\b7\b/.test(statements),
    false,
    'and no literal 7 anywhere near a department',
  );
});
