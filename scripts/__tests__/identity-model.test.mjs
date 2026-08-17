/**
 * identity-model.test.mjs — the three tables stay three (ADR-016, `Plan §11`).
 *
 * ## What kind of test this is
 *
 * **Structural, not empirical.** Every assertion below reads migration *text* and source
 * *text*. None of it talks to Postgres, and none of it observes a request being allowed or
 * denied, because there is one identity, one device, one billing account and **zero runs**
 * (`contracts/project-scoping.md` §6). Saying so here is the point: a test file that lets a
 * reader believe it proved something empirical is the same defect as a dashboard showing a
 * confident zero. What this file proves is that the *schema and the code* cannot quietly
 * drift out of the shape ADR-016 fixed. That is worth having and it is not the same thing.
 *
 * ## Why it exists at all
 *
 * Three rules in ADR-016 would otherwise live only in prose, and this repo has already paid
 * for the difference between a comment and a mechanism: `workspace` confinement was a
 * docstring until a test proved a run could escape it and overwrite `.env`.
 *
 *   1. **Scopes live on the device, not the identity.** (§2, §3)
 *   2. **Scopes enforcement is deferred** — and the deferral is a gate, not a promise. (§5)
 *   3. **A dump of the Operations volume is not a dump of the credentials.** (§6)
 *
 * ## What this instrument CANNOT see — read this before trusting a green
 *
 * This file went green while blind once already, so the blind spots get written down rather
 * than rediscovered. `code()` below is a character scanner, not a regex, because the previous
 * regex could not tell a `/*` in code from the same two characters inside `--` prose and
 * silently deleted up to 17,336 of the 35,435 characters it was pointed at — 49% of the
 * corpus — while three assertions over that corpus stayed green. What remains unseen:
 *
 *   1. **No Postgres.** Every assertion reads text. A migration that is syntactically valid
 *      and semantically wrong passes. Nothing here has ever met a live database.
 *   2. **Dollar-quoted bodies are scanned as SQL, not held as literals.** `DO $$ … $$` in this
 *      repo is procedural DDL, and its `ALTER TABLE`s must be visible, so comments inside it
 *      are stripped. If someone ever stores prose in a `$$`-quoted *value*, its `--` and `/*`
 *      will be eaten and this comment is the only warning.
 *   3. **The FK assertions bite on shape, not existence.** `identity_id` and `ops.device` are
 *      checked *if present*. Neither test can tell "correctly not built yet" from "deleted".
 *   4. **`code()` throws on an unterminated block comment or dollar-quote** rather than
 *      consuming to EOF. That is deliberate: the failure this file is named for is an
 *      instrument whose input silently became empty. It is now loud instead.
 *   5. **Assertions match statement text, not parse trees.** A column introduced by a mechanism
 *      other than the `CREATE TABLE` body — a later `ALTER TABLE … ADD COLUMN scopes` — is not
 *      seen by `hasColumn`. That gap is real and unclosed.
 *
 * Run: node --test scripts/__tests__/*.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const MIGRATIONS = join(ROOT, 'apps', 'runner', 'src', 'db', 'migrations');

/** Every migration, in filename order — the order `client.ts` applies them in. */
async function migrations() {
  const names = (await readdir(MIGRATIONS)).filter((n) => n.endsWith('.sql')).sort();
  return Promise.all(
    names.map(async (name) => ({ name, sql: await readFile(join(MIGRATIONS, name), 'utf8') })),
  );
}

/**
 * Strip SQL comments before matching.
 *
 * This is the whole reason the checks below are not fooled by their own documentation: every
 * migration in this repo carries long `--` prose, and 0006 quotes the `ops.device` DDL it
 * deliberately does **not** create. A checker that reads a commented-out sketch as a table is
 * a checker that passes when the work was never done.
 *
 * **This was a regex and the regex was the wrong instrument.** Two passes ran in sequence —
 * block comments, then line comments — so a `/*` sequence appearing inside `--` prose was
 * still an opening pair when the block pass ran, and the lazy quantifier swallowed everything
 * up to the next closer anywhere in the corpus. Measured: 17,336 of 35,435 visible characters
 * deleted by planting one ordinary closer, with `INSERT INTO ops.identity` going 1 -> 0 and
 * two assertions over the same corpus still passing. A regex cannot hold the state that tells
 * code from prose, so the third special case was not written and the instrument changed
 * instead. This is one left-to-right pass that knows which construct it is inside — the same
 * defect family as a checker matching a keyword inside a string literal, and this scanner is
 * immune to that one by construction too.
 *
 * Order of precedence at each character, which IS the fix: a comment introducer inside a
 * string is text; a string quote inside a comment is text; the first construct to open wins.
 *
 * @throws if a block comment or dollar-quote is never closed — see blind spot 4 above.
 *         Consuming to EOF is how this file went blind, so it refuses to do that quietly.
 */
function code(sql) {
  let out = '';
  let i = 0;

  while (i < sql.length) {
    // Line comment: runs to end of line. Checked FIRST, which is what makes a `/*` written
    // inside `--` prose stay prose.
    if (sql.startsWith('--', i)) {
      while (i < sql.length && sql[i] !== '\n') i++;
      continue;
    }

    // Block comment. Postgres nests these; the old lazy regex did not, so a corpus with two
    // real block comments had a second reading available. Newlines are preserved so that
    // line-oriented assertions below keep their line numbers.
    if (sql.startsWith('/*', i)) {
      const opened = i;
      let depth = 0;
      let newlines = '';
      while (i < sql.length) {
        if (sql.startsWith('/*', i)) { depth++; i += 2; continue; }
        if (sql.startsWith('*/', i)) { depth--; i += 2; if (depth === 0) break; continue; }
        if (sql[i] === '\n') newlines += '\n';
        i++;
      }
      if (depth !== 0) {
        throw new Error(
          `Unterminated block comment opened at offset ${opened}. Refusing to consume the rest ` +
            `of the corpus: an instrument whose input silently became empty is the exact defect ` +
            `this file exists to not repeat.`,
        );
      }
      out += ` ${newlines}`;
      continue;
    }

    // Single-quoted literal, kept verbatim. A `--` in here is data, not a comment: truncating
    // at it is how a sibling checker dropped a mandatory column out of its set.
    if (sql[i] === "'") {
      out += sql[i++];
      while (i < sql.length) {
        if (sql.startsWith("''", i)) { out += "''"; i += 2; continue; }
        const c = sql[i++];
        out += c;
        if (c === "'") break;
      }
      continue;
    }

    // Dollar-quoted body. Recursed into, NOT held opaque — see blind spot 2. `DO $$ … $$` is
    // where 0005 and 0008 keep their ALTER TABLEs, and holding it opaque hid 1,261 characters
    // of real DDL from every assertion below.
    const tag = /^\$[A-Za-z_]*\$/.exec(sql.slice(i));
    if (tag) {
      const open = tag[0];
      const end = sql.indexOf(open, i + open.length);
      if (end === -1) {
        throw new Error(`Unterminated dollar-quote ${open} opened at offset ${i}.`);
      }
      out += open + code(sql.slice(i + open.length, end)) + open;
      i = end + open.length;
      continue;
    }

    out += sql[i++];
  }

  return out;
}

/**
 * The full text of the first `INSERT INTO <table> … ;` statement, comments stripped, or `''`.
 *
 * Written because the PDPL assertion below used to read the FIRST `VALUES (…)` in the joined
 * 98k-character corpus, which is `0005:211`'s *project* seed — it had never once looked at
 * `ops.identity`. Falsified: an email planted in the identity seed left all nine tests green.
 * A gate must be anchored to the thing it names.
 */
function insertStatement(sql, table) {
  const src = code(sql);
  const m = new RegExp(`INSERT\\s+INTO\\s+${table.replace('.', '\\.')}\\b`, 'i').exec(src);
  if (!m) return '';
  const end = src.indexOf(';', m.index);
  return src.slice(m.index, end === -1 ? src.length : end + 1);
}

/** The body of `CREATE TABLE [IF NOT EXISTS] <name> ( … )`, or null. Comments stripped. */
function createTable(sql, name) {
  const src = code(sql);
  const head = new RegExp(
    `CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${name.replace('.', '\\.')}\\s*\\(`,
    'i',
  ).exec(src);
  if (!head) return null;
  let depth = 1;
  let i = head.index + head[0].length;
  const start = i;
  for (; i < src.length && depth > 0; i++) {
    if (src[i] === '(') depth++;
    else if (src[i] === ')') depth--;
  }
  return src.slice(start, i - 1);
}

/** Does a `CREATE TABLE` body declare a column with this exact name? */
function hasColumn(body, column) {
  return new RegExp(`(^|[,(\\s])${column}\\s+[a-z]`, 'im').test(body);
}

/* ========================================================================== *
 * 1. ops.identity exists, once, and is shaped the way ADR-016 fixed it
 * ========================================================================== */

test('ops.identity exists and is created in exactly one migration', async () => {
  const all = await migrations();
  const creators = all.filter((m) => createTable(m.sql, 'ops.identity'));
  assert.equal(
    creators.length,
    1,
    `ops.identity is created in ${creators.length} migrations (${creators.map((c) => c.name).join(', ') || 'none'}). ` +
      `It is the foreign-key target the whole of Plan §11 hangs off; two definitions is two shapes.`,
  );
  // Deliberately not asserted against a literal filename. This test was written as
  // `0006_identity.sql` and renamed to `0007` within the hour after a number collision with
  // `0006_ops_device.sql`; a hardcoded name turned a correct rename into a red gate. What
  // matters is that exactly one migration creates the table, not which one.
  assert.match(creators[0].name, /^\d+_identity\.sql$/, `${creators[0].name} should be <NNNN>_identity.sql`);
});

test('ops.identity carries no scopes column — the split is structural, not editorial', async () => {
  const all = await migrations();
  const body = all.map((m) => createTable(m.sql, 'ops.identity')).find(Boolean);
  assert.ok(body, 'ops.identity is not created by any migration');
  assert.ok(
    !hasColumn(body, 'scopes'),
    'ops.identity declares a `scopes` column. Scopes live on the DEVICE (Plan §11, ADR-016 §3): ' +
      'the phone that answers approvals at 23:00 gets read·run·approve and not admin. ' +
      'With scopes on the identity, revoking a phone means editing *you*, and the three-table ' +
      'split has bought nothing.',
  );
});

test('ops.identity carries no project_id — account and project are two axes, never one', async () => {
  const all = await migrations();
  const body = all.map((m) => createTable(m.sql, 'ops.identity')).find(Boolean);
  assert.ok(
    !hasColumn(body, 'project_id'),
    'ops.identity declares a `project_id`. One you, across every project (Plan §11). ' +
      'A project axis here would also drag the table into 0005 §5\'s RLS set, where it does ' +
      'not belong: it holds no client data.',
  );
});

test('exactly one identity is seeded, and it holds no personal data (PDPL, Part VII.4)', async () => {
  const all = await migrations();
  const sql = all.map((m) => m.sql).join('\n');
  const inserts = code(sql).match(/INSERT\s+INTO\s+ops\.identity\b/gi) ?? [];
  assert.equal(
    inserts.length,
    1,
    `The migrations perform ${inserts.length} inserts into ops.identity. Part One §8 stands: ` +
      `design for more than one, build one.`,
  );

  // Anchored to the ops.identity INSERT by name, not to whichever `VALUES (` comes first in
  // the corpus. The previous form matched 0005's project seed and would have passed an email.
  const seed = insertStatement(sql, 'ops.identity');
  assert.ok(seed, 'No INSERT INTO ops.identity statement found to inspect.');
  assert.ok(
    !seed.includes('@'),
    `The seeded identity carries an address:\n  ${seed.trim()}\nAn email here makes this row ` +
      `personal data at rest in a table with no project scope. The row is a label — 'owner' / 'Owner'.`,
  );

  // Designing for N is the other half, and it is equally checkable: a constraint pinning the
  // row count would make the second identity a migration instead of an INSERT. Scoped to the
  // migration that creates ops.identity — over the joined corpus this fired on any table's
  // `count(*) = 1`, which is a different claim than the message makes.
  const identityMigration = all.find((m) => createTable(m.sql, 'ops.identity'));
  assert.ok(
    !/count\s*\(\s*\*\s*\)\s*\)?\s*=\s*1/i.test(code(identityMigration.sql)),
    'A CHECK pins ops.identity to one row. That is the un-design: Part One §8 says build one, ' +
      'not forbid two.',
  );
});

/* ========================================================================== *
 * 2. Scopes live on ops.device and nowhere else
 * ========================================================================== */

test('no table other than ops.device declares a scopes column', async () => {
  const offenders = [];
  for (const { name, sql } of await migrations()) {
    const src = code(sql);
    const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_]+\.[a-z_]+)/gi;
    for (const m of src.matchAll(re)) {
      const table = m[1].toLowerCase();
      if (table === 'ops.device') continue;
      const body = createTable(sql, table);
      if (body && hasColumn(body, 'scopes')) offenders.push(`${name}: ${table}`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `scopes declared outside ops.device (${offenders.join(', ')}). ADR-016 §3: the device is the ` +
      `only place a power is attached, which is what makes losing a phone a revocation rather ` +
      `than an incident.`,
  );
});

/* ========================================================================== *
 * 3. The seam to ops.device
 *
 * `ops.device` is `sessions-relay-engineer`'s (0006, on loan during M15). These assert the
 * clauses `identity.md` §4 asks of it — and note carefully what the FK check does NOT do.
 * ========================================================================== */

test('ops.device carries the scopes, and revocation there is not a delete', async () => {
  const all = await migrations();
  const found = all.find((m) => createTable(m.sql, 'ops.device'));
  if (!found) return; // Not built. Silent rather than red: it is not this agent's table.

  const body = createTable(found.sql, 'ops.device');

  assert.ok(
    hasColumn(body, 'scopes'),
    `${found.name}: ops.device has no \`scopes\` column. It is the only table that may have one, ` +
      `and the split buys nothing if it does not.`,
  );
  for (const column of ['revoked_at', 'revoked_reason']) {
    assert.ok(
      hasColumn(body, column),
      `${found.name}: ops.device has no \`${column}\`. Revocation is a first-class path, not a ` +
        `delete — the revoked row IS the audit trail, and it is the record you want on the one ` +
        `day it matters.`,
    );
  }

  const deletes = all.flatMap(({ name, sql }) =>
    (code(sql).match(/DELETE\s+FROM\s+ops\.(device|identity)\b/gi) ?? []).map((d) => `${name}: ${d}`),
  );
  assert.deepEqual(
    deletes,
    [],
    `A migration deletes from ops.device or ops.identity (${deletes.join(', ')}). Revocation is a ` +
      `timestamp and a reason; deleting the row destroys the only evidence the revocation happened.`,
  );
});

test('ops.device.identity_id, IF present, is NOT NULL, RESTRICT, and not UNIQUE', async () => {
  // **This asserts correctness when the column exists. It does not assert that it exists.**
  //
  // That distinction is the whole design of this test. `ops.device` ships today with no
  // foreign key to `ops.identity`, and that was right: `ops.identity` did not exist when
  // 0006 was written, and an `identity_id` with no FK is a pointer at nothing — a comment
  // shaped like a mechanism. The column arrives in `sessions-relay-engineer`'s own migration
  // after the written handover (ADR-016 §9), not by this agent reaching into their file.
  //
  // A test that goes red for work another agent has correctly not done yet is a test that
  // gets deleted, and then it protects nothing. So this one waits, and bites on the shape.
  const all = await migrations();
  const withColumn = all.filter(({ sql }) => /\bidentity_id\b/.test(code(sql)));
  if (withColumn.length === 0) return;

  for (const { name, sql } of withColumn) {
    const src = code(sql);
    const decl = /identity_id[^,;)]*/i.exec(src)?.[0] ?? '';

    assert.match(
      decl,
      /NOT\s+NULL/i,
      `${name}: identity_id is nullable. A device with no owner is how a revoked device keeps ` +
        `working — there is nobody to revoke it from.`,
    );
    assert.match(
      decl,
      /REFERENCES\s+ops\.identity\s*\(\s*id\s*\)/i,
      `${name}: identity_id does not reference ops.identity(id). An un-referenced id is a ` +
        `pointer at nothing.`,
    );
    assert.match(
      decl,
      /ON\s+DELETE\s+RESTRICT/i,
      `${name}: identity_id must be ON DELETE RESTRICT, like every other foreign key in this ` +
        `schema. A cascade would make deleting an identity delete the audit trail of every ` +
        `device it ever revoked.`,
    );
    assert.ok(
      !/UNIQUE/i.test(decl) &&
        !new RegExp(`UNIQUE\\s*\\(\\s*identity_id\\s*\\)`, 'i').test(src) &&
        !/CREATE\s+UNIQUE\s+INDEX[^;]*\(\s*identity_id\s*\)/i.test(src),
      `${name}: identity_id is UNIQUE. **"One you, N devices" is exactly the statement ` +
        `"identity_id is not unique"** — sessions-relay-engineer's sentence, and the sharpest ` +
        `one written about this seam. A UNIQUE here collapses the two tables back into one and ` +
        `re-creates the conflation Plan §11 exists to undo.`,
    );
  }
});

/* ========================================================================== *
 * 4. A dump of the Operations volume is not a dump of the credentials
 * ========================================================================== */

test('no migration stores secret material in Postgres', async () => {
  // `secret_ref` is the *name* of a secret — an env var, a file on a mounted volume —
  // resolved at dispatch (0005 §2). That design is what makes "the key is outside Postgres"
  // (Plan §11) structurally true instead of a claim about an encryption routine nobody has
  // written: there is no ciphertext column to decrypt and no key to lose. This test is the
  // mechanism that keeps it true, and ADR-016 §6 is why it is written before any store path.
  const BANNED = [
    /\b(access|refresh|bearer|session|auth)_token\b/i,
    /\bapi_?key\b/i,
    /\bprivate_key\b/i,
    /\bpassword\b/i,
    /\bciphertext\b/i,
    /\bsecret_value\b/i,
    /\bencrypted_[a-z_]+\b/i,
  ];

  const offenders = [];
  for (const { name, sql } of await migrations()) {
    const src = code(sql);
    for (const m of src.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_]+\.[a-z_]+)/gi)) {
      const body = createTable(sql, m[1]);
      if (!body) continue;
      for (const line of body.split(/\r?\n/)) {
        for (const pattern of BANNED) {
          if (pattern.test(line)) offenders.push(`${name} · ${m[1]} · ${line.trim()}`);
        }
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `A column stores secret material rather than a reference to one:\n  ${offenders.join('\n  ')}\n` +
      `Store a \`secret_ref\` — the NAME of an env var or a file on a mounted volume — resolved ` +
      `at dispatch. A dump of the Operations volume must not be a dump of the credentials ` +
      `(Plan §11, ADR-016 §6). "Store the refresh path, not just the token" means the path is a ` +
      `ref too.`,
  );
});

/* ========================================================================== *
 * 5. The deferral is a gate
 * ========================================================================== */

test('nothing reads a scopes value — enforcement stays deferred until an ADR names its point', async () => {
  // M15 ruled: **a scope with no enforcement point is a comment.** The column is defined and
  // populated; enforcement is not built. The failure this guards against is the next reader
  // assuming the column is enforced and building on that assumption — a confident value
  // nobody can check, which is this repo's most-repeated defect in every other costume.
  //
  // Property-shaped uses only. The English verb is not the subject: `config.ts` legitimately
  // says "BOARD scopes M15 to two real layers", and a checker that cannot tell those apart
  // gets disabled within a week.
  const USES = [
    /\.scopes\b/, // device.scopes
    /\bscopes\s*:/, // { scopes: … } — a type or a literal
    /["'`]scopes["'`]/, // row['scopes'], SQL string, allowlist entry
  ];

  const ALLOWED = new Set([
    // Nothing yet. When enforcement lands, the ADR that names the single denial point adds
    // that one file here — and the diff on this line is the visible record that a comment
    // became a mechanism.
  ]);

  const roots = ['apps/web/src', 'apps/runner/src', 'packages'];
  const hits = [];

  async function walk(dir) {
    let entries;
    try {
      entries = await readdir(join(ROOT, dir), { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const rel = join(dir, e.name).replace(/\\/g, '/');
      if (/^(node_modules|\.next|\.next-build|dist|build|coverage)$/.test(e.name)) continue;
      if (e.isDirectory()) {
        await walk(rel);
        continue;
      }
      if (!/\.(ts|tsx|mjs|js)$/.test(e.name)) continue;
      if (ALLOWED.has(rel)) continue;
      const text = await readFile(join(ROOT, rel), 'utf8');
      text.split(/\r?\n/).forEach((line, i) => {
        if (USES.some((p) => p.test(line))) hits.push(`${rel}:${i + 1}  ${line.trim()}`);
      });
    }
  }

  for (const root of roots) await walk(root);

  assert.deepEqual(
    hits,
    [],
    `Something reads a scopes value:\n  ${hits.join('\n  ')}\n\n` +
      `Scopes enforcement is DEFERRED (ADR-016 §5, BOARD constraint #5's transport half is ` +
      `unamended: v2 gains accounts, v2 does not gain a public surface). Enforcement requires ` +
      `an ADR that names, in one sentence, the single point where a request is denied. If you ` +
      `cannot name that point in one sentence it is not ready — and until it is, do not build ` +
      `anything that is only safe because auth exists, because it does not.`,
  );
});

/* ========================================================================== *
 * 6. The instrument checks itself
 *
 * This file reported 9/9 green while it could not see 49% of its own input, and separately
 * while an email sat in the row its PDPL assertion claims to guard. Both were found by
 * someone else. A test that has never been red proves nothing, so the falsification lives
 * here as fixtures rather than in a report nobody re-runs: these plant the exact defects and
 * require the instrument to notice.
 *
 * Fixtures are in-memory. Planting in the real migrations to prove a gate works leaves a
 * window where the tree is wrong, and this repo runs five agents at once.
 *
 * The comment sequences are built by concatenation on purpose. The first written explanation
 * of the original bug re-armed it, because the explanation contained the pair.
 * ========================================================================== */

const OPEN = '/' + '*';
const CLOSE = '*' + '/';

test('code() does not treat a comment introducer inside `--` prose as an opener', () => {
  // The original defect, minimised. `0005:448` documents the `/api/all/` routes with a star,
  // inside `--` prose; the next ordinary closer anywhere later then deleted everything between.
  const sql = [
    `-- scoped by the ${OPEN} routes and nothing else.`,
    `CREATE TABLE ops.identity (id uuid PRIMARY KEY);`,
    `-- an ordinary separator ${CLOSE}`,
    `INSERT INTO ops.identity (slug) VALUES ('owner');`,
  ].join('\n');

  const src = code(sql);
  assert.match(src, /CREATE TABLE ops\.identity/, 'the DDL between the two sequences was eaten');
  assert.match(src, /INSERT INTO ops\.identity/, 'the seed after the closer was eaten');
  assert.doesNotMatch(src, /nothing else/, 'the prose itself survived — it is a comment');
});

test('code() keeps a `--` that is inside a string literal', () => {
  // The sibling defect one repo over: a checker matched a keyword inside a string literal and
  // dropped a mandatory column. Truncating at a `--` in data is the same error mirrored.
  const src = code(`INSERT INTO ops.identity (slug) VALUES ('a--b'), ('c');`);
  assert.match(src, /'a--b'/, 'a literal containing a comment introducer was truncated');
  assert.match(src, /'c'/, 'the rest of the statement was lost with it');
});

test('code() strips comments inside a dollar-quoted body, and keeps its DDL', () => {
  const src = code(
    `DO $$ BEGIN\n  -- prose that must not be visible\n  ALTER TABLE ops.device ADD COLUMN identity_id uuid;\nEND $$;`,
  );
  assert.match(src, /ALTER TABLE ops\.device/, 'DDL inside DO $$ … $$ was held opaque');
  assert.doesNotMatch(src, /must not be visible/, 'prose inside DO $$ … $$ leaked into the corpus');
});

test('code() handles nested block comments — Postgres does, the old lazy regex did not', () => {
  const src = code(`A ${OPEN} outer ${OPEN} inner ${CLOSE} still outer ${CLOSE} B`);
  assert.match(src, /A\s+\s*B/, `nesting mis-parsed; got: ${JSON.stringify(src)}`);
  assert.doesNotMatch(src, /outer|inner/, 'comment text survived');
});

test('code() refuses to consume the corpus when a block comment never closes', () => {
  // Blind spot 4. Eating to EOF is precisely how this file went blind; it is now loud.
  assert.throws(
    () => code(`CREATE TABLE ops.identity (id uuid); ${OPEN} never closed`),
    /Unterminated block comment/,
    'an unterminated block comment was swallowed silently instead of throwing',
  );
});

test('the PDPL seed assertion is anchored to ops.identity, not to the first VALUES in the corpus', () => {
  // Falsification of the assertion that five citations rest on. Before the fix this planted
  // email left all nine tests green, because the regex matched an unrelated project seed in
  // an earlier migration.
  const corpus = [
    `INSERT INTO ops.project (slug) VALUES (ops.project_id_for('agentos'), 'agentos');`,
    `INSERT INTO ops.identity (slug, display_name) VALUES ('owner', 'maher@example.com');`,
  ].join('\n');

  const seed = insertStatement(corpus, 'ops.identity');
  assert.ok(seed.includes('@'), `the planted address was not seen. Statement read: ${seed}`);
  assert.doesNotMatch(seed, /ops\.project\b/, 'the project seed was picked up instead');

  const clean = insertStatement(
    `INSERT INTO ops.identity (slug, display_name) VALUES ('owner', 'Owner');`,
    'ops.identity',
  );
  assert.ok(!clean.includes('@'), 'a clean seed was reported as carrying an address');
});
