/**
 * repo-conformance.test.mjs
 *
 * Tests the invariants that no single agent owns — the ones that only break when
 * thirteen agents each do something individually reasonable.
 *
 * Run: node --test scripts/__tests__/*.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, access, stat } from 'node:fs/promises';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

async function exists(p) {
  try {
    await access(join(ROOT, p));
    return true;
  } catch {
    return false;
  }
}

/** Recursively list files under a repo-relative dir, skipping noise. */
async function walk(dir, out = []) {
  const abs = join(ROOT, dir);
  let entries;
  try {
    entries = await readdir(abs, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const rel = join(dir, e.name);
    if (/^(node_modules|\.next|\.git|dist|build|coverage|\.volumes)$/.test(e.name)) continue;
    if (e.isDirectory()) await walk(rel, out);
    else out.push(rel.replace(/\\/g, '/'));
  }
  return out;
}

const SPEC_PATH = 'skilltree-clone-spec.md';

test('the spec of record is present and unmodified in shape', async () => {
  assert.ok(await exists(SPEC_PATH), 'skilltree-clone-spec.md is the spec of record and must exist');
  const text = await readFile(join(ROOT, SPEC_PATH), 'utf8');
  for (const part of ['PART I', 'PART II', 'PART III', 'PART IV', 'PART V', 'PART VI', 'PART VII']) {
    assert.match(text, new RegExp(`^#\\s+${part}\\b`, 'm'), `spec lost its ${part} heading`);
  }
});

test('every accepted ADR has a status, an owner and a "Deliberately not" section', async () => {
  const files = (await walk('comms/decisions')).filter((f) => f.endsWith('.md'));
  assert.ok(files.length >= 3, 'the three blocking M0 decisions must be filed');
  for (const f of files) {
    const text = await readFile(join(ROOT, f), 'utf8');
    assert.match(text, /\*\*Status:\*\*\s*(accepted|proposed|superseded|rejected)/, `${f}: no Status line`);
    assert.match(text, /\*\*Owner:\*\*/, `${f}: no Owner line`);
    assert.match(text, /##\s+Deliberately not/i, `${f}: no "Deliberately not" section`);
  }
});

test('no hex colour outside the token file', async () => {
  // Standing rule 8 / §1.3. tokens.css is the single source; everything else uses var().
  const TOKENS = 'apps/web/src/styles/tokens.css';
  const files = (await walk('apps/web/src')).filter((f) => /\.(css|tsx?|jsx?)$/.test(f));
  const offenders = [];
  for (const f of files) {
    if (f === TOKENS) continue;
    const text = await readFile(join(ROOT, f), 'utf8');
    const lines = text.split(/\r?\n/);
    lines.forEach((line, i) => {
      if (/token-exempt/.test(line)) return;
      if (/#[0-9a-fA-F]{3,8}\b/.test(line) && !/^\s*(\/\/|\*|<!--)/.test(line)) {
        // Ignore obvious non-colours: ids in urls, hashes in comments already filtered.
        if (/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/.test(line)) offenders.push(`${f}:${i + 1}  ${line.trim()}`);
      }
    });
  }
  assert.deepEqual(offenders, [], `hex literals outside ${TOKENS}:\n${offenders.join('\n')}`);
});

test('the runner never widens the tool allowlist beyond wired_into', async () => {
  // §3.2 / standing rule 4. A superset is a security bug, not a convenience.
  const files = (await walk('apps/runner/src')).filter((f) => /\.(ts|mjs|js)$/.test(f));
  if (files.length === 0) return; // runner not built yet — coverage check catches that separately
  let sawAllowlist = false;
  for (const f of files) {
    const text = await readFile(join(ROOT, f), 'utf8');
    if (/wired_into|wiredInto/.test(text)) sawAllowlist = true;
    assert.doesNotMatch(
      text,
      /allowedTools\s*[:=]\s*(\[\s*['"`]\*|['"`]\*['"`]|ALL_TOOLS)/,
      `${f}: grants a wildcard tool allowlist — it must be exactly wired_into`,
    );
  }
  assert.ok(sawAllowlist, 'the runner must derive its allowlist from frontmatter wired_into');
});

test('no secret material is committed or referenced in comms/', async () => {
  const files = [...(await walk('comms')), ...(await walk('panels'))].filter((f) => /\.(md|json)$/.test(f));
  const SECRET = /(sk-ant-[A-Za-z0-9-]{8,}|ANTHROPIC_API_KEY\s*=\s*\S+|-----BEGIN [A-Z ]*PRIVATE KEY-----)/;
  for (const f of files) {
    const text = await readFile(join(ROOT, f), 'utf8');
    assert.doesNotMatch(text, SECRET, `${f}: contains what looks like a real secret`);
  }
  assert.equal(await exists('.env'), false, 'a real .env must never be committed');
});

test('panel definitions never carry raw SQL', async () => {
  // §2.5: panel JSON is user-editable data. Raw SQL there is an injection surface.
  const files = (await walk('panels')).filter((f) => f.endsWith('.json'));
  for (const f of files) {
    const text = await readFile(join(ROOT, f), 'utf8');
    assert.doesNotMatch(
      text,
      /\b(SELECT|INSERT|UPDATE|DELETE|DROP)\s+[\w*]/i,
      `${f}: contains raw SQL — reference a registered, parameterized query by id instead`,
    );
  }
});

test('every agent SKILL.md path agrees with its department', async () => {
  // Part IV invariant. The map places nodes by department; a mismatch silently misplaces a node.
  const files = (await walk('agents')).filter((f) => f.endsWith('SKILL.md'));
  for (const f of files) {
    const text = await readFile(join(ROOT, f), 'utf8');
    const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    assert.ok(fm, `${f}: no frontmatter block`);
    const dept = fm[1].match(/^department:\s*(\S+)/m);
    assert.ok(dept, `${f}: no department field`);
    const parts = f.split('/');
    assert.equal(parts[1], dept[1].trim(), `${f}: path department "${parts[1]}" != frontmatter "${dept[1]}"`);
  }
});

test('every agent in the BOARD roster has a status file', async () => {
  const board = await readFile(join(ROOT, 'comms/BOARD.md'), 'utf8');
  const roster = [...board.matchAll(/^\|\s*`([a-z-]+)`\s*\|/gm)].map((m) => m[1]);
  assert.ok(roster.length >= 13, `expected 13+ agents in the roster, found ${roster.length}`);
  for (const agent of new Set(roster)) {
    assert.ok(await exists(`comms/status/${agent}.md`), `missing comms/status/${agent}.md`);
  }
});

test('the layout artifact is gitignored, not committed', async () => {
  // ADR-003: graph.json is reproducible from agents/**. Committing it invites drift.
  const ignore = await readFile(join(ROOT, '.gitignore'), 'utf8');
  assert.match(ignore, /apps\/web\/public\/graph\.json/, 'graph.json must be gitignored (ADR-003)');
});
