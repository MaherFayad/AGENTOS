/* =============================================================================
 * ops-device.test.mjs — the shape of `ops.device`, asserted from the migration
 *
 * `Plan §11` splits one concept into three tables, and the whole value of the
 * split is lost the moment a column drifts back across a boundary. The columns
 * that must NOT exist here are as load-bearing as the ones that must, and an
 * absence is exactly what no reviewer notices — so it is asserted instead.
 *
 * ## Why this is a source test and not a database test
 *
 * There is a database test too (`apps/runner/src/db/__tests__/sql-executes.ts`
 * applies every migration against a real Postgres) and it is the stronger of
 * the two — but it **skips entirely without `DATABASE_URL`**, which is the
 * state of every laptop and of this session. A property that is only checked
 * when Docker happens to be up is a property nobody is checking.
 *
 * So the split is deliberate and it is stated on each assertion below:
 *
 *   STRUCTURAL (this file) — the migration text says what it says. Always runs.
 *   EMPIRICAL  (Postgres)  — Postgres accepts it and the CHECKs actually fire.
 *                            Runs only where a database exists. Not run in M15:
 *                            see `comms/handoffs/M15-sessions-relay-engineer-ops-device.md`.
 *
 * Owner: `sessions-relay-engineer` (interim owner of `ops.device` during M15).
 * Successor: `identity-access-engineer`. ADR-016.
 * ========================================================================== */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const MIGRATION = join(ROOT, 'apps', 'runner', 'src', 'db', 'migrations', '0006_ops_device.sql');

const sql = readFileSync(MIGRATION, 'utf8');

/** Strip `--` comments so a word in prose is never mistaken for a word in SQL. */
function code(text) {
  return text
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n');
}

/** The body of `CREATE TABLE … ops.device ( … )`, paren-matched rather than regexed. */
function tableBody(text) {
  const start = text.search(/CREATE TABLE[^;]*?ops\.device\s*\(/i);
  assert.notEqual(start, -1, 'no CREATE TABLE ops.device in the migration');
  const open = text.indexOf('(', start);
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')') {
      depth--;
      if (depth === 0) return text.slice(open + 1, i);
    }
  }
  throw new Error('unbalanced parentheses in CREATE TABLE ops.device');
}

/** Column names declared at the top level of the table body. */
function columns(body) {
  const out = [];
  let depth = 0;
  let current = '';
  const parts = [];
  for (const ch of body) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else current += ch;
  }
  parts.push(current);

  for (const part of parts) {
    const first = part.trim().split(/\s+/)[0];
    if (!first) continue;
    if (/^(CONSTRAINT|CHECK|UNIQUE|PRIMARY|FOREIGN|EXCLUDE|LIKE)$/i.test(first)) continue;
    out.push(first.toLowerCase());
  }
  return out;
}

const BODY = tableBody(code(sql));
const COLUMNS = columns(BODY);

/* -------------------------------------------------------- the column set */

/**
 * STRUCTURAL. The exact column set, in the same spirit as `SESSION_ENVELOPE_KEYS`
 * in `sessions/relay/envelope.ts`: a fixed list, so adding a key is a decision
 * someone has to defend rather than a diff someone has to notice.
 */
test('ops.device has exactly the columns Plan §11 names, and no others', () => {
  const EXPECTED = [
    'id',
    'public_key',
    'key_use',
    'name',
    'platform',
    'scopes',
    'registered_at',
    'last_seen_at',
    'revoked_at',
    'revoked_reason',
  ];
  assert.deepEqual(
    [...COLUMNS].sort(),
    [...EXPECTED].sort(),
    'the device table changed shape. Adding a column here is an ADR-016 amendment, not a ' +
      'migration detail — every column must answer "from what, with what powers".',
  );
});

/**
 * STRUCTURAL, and this is the test the table exists for.
 *
 * Each forbidden name is a specific way the three tables collapse back into one:
 *   identity_id  — legal LATER, but only with no UNIQUE, and only from the owner
 *                  of ops.identity. Today ops.identity does not exist, so the
 *                  column could only be a pointer at nothing.
 *   account_id   — a device does not pay. ops.agent_runs does (0005).
 *   project_id   — a device is cross-project, like ops.billing_account.
 *   email / password / owner / user_id — "who is asking", i.e. the other table.
 */
test('ops.device carries no column that answers "who is asking" or "who paid"', () => {
  const FORBIDDEN = [
    'identity_id',
    'account_id',
    'billing_account_id',
    'credential_id',
    'project_id',
    'email',
    'password',
    'password_hash',
    'owner',
    'owner_name',
    'user_id',
    'session_key',
    'private_key',
    'secret',
    'token',
  ];
  const found = FORBIDDEN.filter((c) => COLUMNS.includes(c));
  assert.deepEqual(
    found,
    [],
    `ops.device grew ${found.join(', ')}. Identity, device and billing account are three ` +
      'orthogonal tables (Plan §11); a column that answers another table\'s question is the ' +
      'conflation §11 exists to undo.',
  );
});

/**
 * STRUCTURAL. `identity_id` is the one forbidden name that becomes legal later,
 * so the condition is recorded where it will be read: the handover migration
 * must not put a UNIQUE on it. "One you, N devices" *is* that absent UNIQUE.
 */
test('the identity edge is documented as the successor\'s migration, with no UNIQUE', () => {
  assert.match(sql, /ops\.identity/, 'the identity seam must be named, not silently omitted');
  assert.match(
    sql,
    /NO UNIQUE|no UNIQUE/,
    'the successor migration sketch must say the identity_id has no UNIQUE — a UNIQUE there ' +
      'collapses device back into identity',
  );
});

/* ------------------------------------------------------------ the scopes */

/**
 * STRUCTURAL. Default-deny. A permissive default is how an unenforced column
 * becomes a dangerous one on the day enforcement lands.
 */
test('scopes default to the empty set, not to a useful set', () => {
  assert.match(
    BODY,
    /scopes\s+text\[\]\s+NOT NULL\s+DEFAULT\s+'\{\}'/i,
    'scopes must default to {} — a device that registers without an explicit grant holds ' +
      'no powers rather than all of them',
  );
});

/** STRUCTURAL. The vocabulary is closed, so a typo is a rejected write. */
test('scopes are constrained to a closed vocabulary', () => {
  assert.match(code(sql), /scopes_are_known/, 'the scope vocabulary CHECK is missing');
  assert.match(code(sql), /'read','run','approve','admin'/, 'the scope vocabulary changed');
});

/**
 * STRUCTURAL. The M15 ruling, pinned: scopes are defined and populated, and
 * enforced by nothing. The function is a constant `false` on purpose — it is the
 * one place that changes when enforcement lands, and it exists so a status route
 * cannot claim an enforcement that does not exist.
 */
test('scope enforcement reports false, from the database rather than from a comment', () => {
  assert.match(code(sql), /FUNCTION ops\.device_scopes_enforced\(\)/);
  assert.match(
    code(sql).replace(/\s+/g, ' '),
    /SELECT false/i,
    'ops.device_scopes_enforced() must return a constant false while nothing reads scopes',
  );
});

/* -------------------------------------------------------- key discipline */

/**
 * STRUCTURAL, and it is the E2E one.
 *
 * A server-known public key per device is what a "re-wrap this session key for
 * the new phone" feature would reach for, and that feature puts the coordinator
 * inside the key exchange. `key_use` has exactly one legal value, so widening it
 * is a migration — a reviewable act — rather than a habit.
 */
test('the device public key is an identification key and cannot silently become a content key', () => {
  assert.match(
    BODY,
    /key_use\s+text\s+NOT NULL\s+DEFAULT\s+'identify'\s+CHECK\s*\(\s*key_use\s*=\s*'identify'\s*\)/i,
    "key_use must be pinned to 'identify'. Session keys are derived in the browser and are " +
      'non-extractable (ADR-005 consequence 2); no content is ever encrypted to a key the ' +
      'server holds.',
  );
});

/** STRUCTURAL. The id is the key's fingerprint, checked rather than conventional. */
test('a device id is derived from its public key and pinned by a CHECK', () => {
  assert.match(code(sql), /FUNCTION ops\.device_id_for\(public_key text\)/);
  assert.match(BODY, /CHECK\s*\(\s*id\s*=\s*ops\.device_id_for\(public_key\)\s*\)/i);
});

/* ---------------------------------------------------------- revocation */

/**
 * STRUCTURAL. Losing a phone is a revocation, not an incident — which is only
 * true if a revoked device is powerless in the database rather than in a
 * caller's memory. "Revoked but still powerful" is not a representable state.
 */
test('a revoked device cannot keep its scopes, and revocation keeps the row', () => {
  assert.match(code(sql), /revoked_devices_hold_no_scopes/);
  assert.match(code(sql), /revocation_is_dated_and_explained/);
  assert.doesNotMatch(
    code(sql),
    /DELETE\s+FROM\s+ops\.device/i,
    'revocation is a first-class path, not a delete — the row and its reason are the audit trail',
  );
});

/* -------------------------------------------------------- honest emptiness */

/**
 * STRUCTURAL. 0005 seeds `ops.project` because that mount genuinely exists. No
 * device has ever registered, so a seeded device row would be a plausible fake
 * (CLAUDE.md rule 9). An empty table here is a real zero, not an unknown.
 */
test('no device row is seeded', () => {
  assert.doesNotMatch(
    code(sql),
    /INSERT\s+INTO\s+ops\.device/i,
    'seeding a device would invent hardware that has never registered',
  );
});

/**
 * STRUCTURAL. `last_seen_at IS NULL` means never connected. The CHECK is what
 * stops a backfill or a clock skew turning "never" into a plausible date.
 */
test('never-seen is representable and is not an epoch', () => {
  assert.match(BODY, /last_seen_at\s+timestamptz\s*,/i, 'last_seen_at must be nullable');
  assert.match(code(sql), /last_seen_after_registration/);
  assert.match(BODY, /registered_at\s+timestamptz\s+NOT NULL/i);
});

/**
 * STRUCTURAL. No RLS on this table, on purpose — a device is cross-project like
 * `ops.billing_account`. This asserts the choice is explicit rather than
 * forgotten: 0005 made project isolation a failing query, and a table that
 * quietly opted out without saying so would look like the same oversight.
 */
test('ops.device is deliberately not project-scoped, and says so', () => {
  assert.doesNotMatch(code(sql), /ALTER TABLE ops\.device ENABLE ROW LEVEL SECURITY/i);
  assert.match(
    sql,
    /No `project_id`, and therefore no row-level security/,
    'the absence of RLS must be argued in the migration, not discovered by a reader',
  );
});

/* ===========================================================================
 * EMPIRICAL — the same claims, asked of Postgres instead of of the file
 *
 * Everything above reads the migration. That proves the CHECKs are *written*;
 * it cannot prove they *fire*. A constraint that Postgres silently accepts and
 * never enforces is the exact failure this repo has already paid for once
 * (`workspace` confinement was a docstring until a test proved a run could
 * escape it), so the claims are asked twice.
 *
 * This half applies the migration inside a transaction, tries a write that must
 * fail for every CHECK, and ROLLS BACK — so it verifies the schema without
 * creating it. The runner applies 0006 for real on its next boot.
 *
 * It skips without `DATABASE_URL`, and the skip is honest rather than silent:
 * a suite that fails for the absence of infrastructure gets commented out
 * within a week (the reasoning is `sql-executes.test.ts`'s and is adopted here).
 *
 *   docker compose -f infra/compose.yaml --env-file .env up -d postgres
 *   DATABASE_URL="postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@127.0.0.1:5433/$APP_DB" \
 *     node --test scripts/__tests__/ops-device.test.mjs
 * ======================================================================== */

const DATABASE_URL = process.env.DATABASE_URL;
const SKIP_REASON =
  'DATABASE_URL is not set, so only the STRUCTURAL half above ran. Start the data plane ' +
  '(`docker compose -f infra/compose.yaml --env-file .env up -d postgres`) and export ' +
  'DATABASE_URL to make Postgres judge these CHECKs instead of the file.';

test('EMPIRICAL: every CHECK on ops.device actually fires', { skip: !DATABASE_URL && SKIP_REASON }, async (t) => {
  const { createRequire } = await import('node:module');
  const require = createRequire(join(ROOT, 'apps', 'runner', 'package.json'));
  const { Client } = require('pg');

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  /** A write that must be refused, and the constraint that must refuse it. */
  const refuses = async (label, statement, constraint) => {
    await client.query('SAVEPOINT probe');
    let accepted = false;
    let message = '';
    try {
      await client.query(statement);
      accepted = true;
    } catch (error) {
      message = String(error.message);
    }
    await client.query('ROLLBACK TO SAVEPOINT probe');
    assert.equal(accepted, false, `${label}: the write was ACCEPTED — ${constraint} does not fire`);
    assert.match(message, new RegExp(constraint), `${label}: refused, but by the wrong constraint`);
  };

  const KEY = 'ed25519:AAAA_probe_key';

  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query(sql); // idempotent: every statement is IF NOT EXISTS / OR REPLACE

    await client.query(
      `INSERT INTO ops.device (id, public_key, name, platform, scopes)
       VALUES (ops.device_id_for($1), $1, 'probe phone', 'ios', ARRAY['read','run','approve'])`,
      [KEY],
    );

    const enforced = await client.query('SELECT ops.device_scopes_enforced() AS e');
    assert.equal(enforced.rows[0].e, false, 'scope enforcement must report false while nothing reads scopes');

    const row = await client.query('SELECT last_seen_at, registered_at FROM ops.device');
    assert.equal(row.rows[0].last_seen_at, null, 'never-seen must be NULL, never an epoch');
    assert.ok(row.rows[0].registered_at, 'registered_at is the honest timestamp a UI renders instead');

    await refuses(
      'two rows for one key',
      `INSERT INTO ops.device (id, public_key, name, platform)
       VALUES (ops.device_id_for('${KEY}'), '${KEY}', 'clone', 'web')`,
      'device_pkey',
    );
    await refuses(
      'an id that is not its key fingerprint',
      `INSERT INTO ops.device (id, public_key, name, platform)
       VALUES (gen_random_uuid(), 'ed25519:other', 'liar', 'web')`,
      'device_id_is_derived_from_its_key',
    );
    await refuses(
      'a scope outside the vocabulary',
      `INSERT INTO ops.device (id, public_key, name, platform, scopes)
       VALUES (ops.device_id_for('k2'), 'k2', 'd', 'web', ARRAY['root'])`,
      'scopes_are_known',
    );
    await refuses(
      'a device key repurposed to wrap session keys — the E2E one',
      `INSERT INTO ops.device (id, public_key, name, platform, key_use)
       VALUES (ops.device_id_for('k3'), 'k3', 'd', 'web', 'wrap-session-key')`,
      'key_use',
    );
    await refuses(
      'an unknown platform',
      `INSERT INTO ops.device (id, public_key, name, platform)
       VALUES (ops.device_id_for('k4'), 'k4', 'd', 'fridge')`,
      'platform',
    );
    await refuses(
      'a revocation with no reason',
      `UPDATE ops.device SET revoked_at = now(), scopes = '{}'`,
      'revocation_is_dated_and_explained',
    );
    await refuses(
      'a revoked device that keeps its powers — the sharp one',
      `UPDATE ops.device SET revoked_at = now(), revoked_reason = 'lost on a train'`,
      'revoked_devices_hold_no_scopes',
    );
    await refuses(
      'a last_seen before registration',
      `UPDATE ops.device SET last_seen_at = registered_at - interval '1 day'`,
      'last_seen_after_registration',
    );

    // Revocation keeps the row and its reason. That record is the audit trail.
    await client.query(
      `UPDATE ops.device SET revoked_at = now(), revoked_reason = 'lost on a train', scopes = '{}'`,
    );
    const after = await client.query(
      'SELECT count(*)::int AS n, max(revoked_reason) AS why FROM ops.device',
    );
    assert.equal(after.rows[0].n, 1, 'revocation is not a delete');
    assert.equal(after.rows[0].why, 'lost on a train');

    // No RLS here, by design (§3 of the migration): an unscoped read must NOT raise,
    // unlike every project-scoped table in 0005. Asserting it keeps the difference deliberate.
    await client.query(`SET LOCAL agnetos.project_id = ''`);
    await client.query('SELECT count(*) FROM ops.device');

    t.diagnostic('9 CHECKs refused a write; revocation kept the row; no RLS on this table');
  } finally {
    await client.query('ROLLBACK').catch(() => {});
    // The probe verified the schema without creating it.
    const live = await client.query(`SELECT to_regclass('ops.device') IS NOT NULL AS exists`);
    assert.equal(
      live.rows[0].exists,
      false,
      'the probe must not leave ops.device behind — the runner applies 0006 on its next boot',
    );
    await client.end();
  }
});
