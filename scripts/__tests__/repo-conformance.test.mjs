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
    if (/^(node_modules|\.next|\.next-build|\.git|dist|build|coverage|\.volumes)$/.test(e.name)) continue;
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

test('every ADR carries a status and names the agent accountable for it', async () => {
  // The shape asserted here is the one `comms/templates/adr.md` produces: a
  // Status, and a named agent. The template writes that agent as **Author:**;
  // four ADRs (001-003, 007) use a bullet header with **Owner:** instead. Both
  // answer the question the invariant is actually about — "who is accountable
  // for this decision" — so both are accepted rather than one being retrofitted
  // onto five other agents' decision records.
  //
  // This test used to also require a "## Deliberately not" section. That is the
  // HANDOFF invariant (comms/templates/handoff.md, CLAUDE.md "Definition of
  // done"), not the ADR one — the ADR template closes with Consequences and
  // Contract edits. It was asserting a section the template never produced, so
  // the five template-conformant ADRs failed for following the template.
  //
  // `README.md` is excluded for the same reason: it is the directory's own
  // documentation — the numbering rule and the AGENTOS-V2-PLAN concordance
  // (ADR-013, amendment 2026-08-17) — not a decision, and it has no Status
  // because it decides nothing. The invariant is about ADRs; assert it on ADRs.
  const files = (await walk('comms/decisions'))
    .filter((f) => f.endsWith('.md'))
    .filter((f) => !/(^|[\\/])readme\.md$/i.test(f));
  assert.ok(files.length >= 3, 'the three blocking M0 decisions must be filed');
  for (const f of files) {
    const text = await readFile(join(ROOT, f), 'utf8');
    assert.match(text, /\*\*Status:\*\*\s*(accepted|proposed|superseded|rejected)/, `${f}: no Status line`);
    assert.match(text, /\*\*(?:Owner|Author):\*\*/, `${f}: names no accountable agent`);
  }
});

test('no hex colour outside the token file', async () => {
  // Standing rule 8 / §1.3. tokens.css is the single source; everything else uses var().
  const TOKENS = 'apps/web/src/styles/tokens.css';
  // The token file's own regression guard is the one file that has to be able to
  // write a hex, because pinning `--bg: #111114` IS how rule 8 gets enforced.
  // `scripts/check-tokens.mjs` (owner: design-system-guardian, the authority on
  // this rule) exempts exactly these; the list is duplicated rather than shared
  // only because that checker exports nothing. Keep the two in step.
  const SOURCE_OF_TRUTH = new Set([
    TOKENS,
    'apps/web/src/styles/tokens.test.ts',
    'apps/web/src/components/primitives/motion.ts',
    'apps/web/src/components/primitives/motion.test.ts',
    'apps/web/src/components/primitives/theme.ts',
    'apps/web/src/components/primitives/theme.test.ts',
  ]);
  const files = (await walk('apps/web/src')).filter((f) => /\.(css|tsx?|jsx?)$/.test(f));
  const offenders = [];
  for (const f of files) {
    if (SOURCE_OF_TRUTH.has(f)) continue;
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

/**
 * A value assigned to a secret-shaped env var that is demonstrably *not* key material:
 * a shell/compose variable reference, or an obvious placeholder. Documentation has to be
 * able to show the wiring (`export ANTHROPIC_API_KEY="${RUNNER_ANTHROPIC_API_KEY}"`) without
 * tripping the scanner, or agents learn to route around the guard — which is how a real
 * leak eventually gets waved through.
 *
 * Deliberately narrow: anything that is not one of these shapes is still treated as a leak.
 */
const NOT_KEY_MATERIAL = /^(["'`]?)(\$\{[A-Za-z_][A-Za-z0-9_]*\}|\$[A-Za-z_][A-Za-z0-9_]*|<[^>]*>|x{3,}|\.{3}|""|''|changeme|your[-_]?key[-_]?here)\1$/i;

test('no secret material is committed or referenced in comms/', async () => {
  const files = [...(await walk('comms')), ...(await walk('panels'))].filter((f) => /\.(md|json)$/.test(f));
  // These two are key material on sight, wherever they appear.
  const LITERAL_SECRET = /(sk-ant-[A-Za-z0-9-]{8,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/;
  // This one depends on what is on the right-hand side.
  const ASSIGNMENT = /(?:ANTHROPIC_API_KEY|[A-Z_]*(?:SECRET|PASSWORD|TOKEN|AUTHKEY)[A-Z_]*)\s*=\s*(\S+)/g;

  for (const f of files) {
    const text = await readFile(join(ROOT, f), 'utf8');
    assert.doesNotMatch(text, LITERAL_SECRET, `${f}: contains what looks like a real secret`);

    for (const [match, value] of text.matchAll(ASSIGNMENT)) {
      // These assignments are quoted inside markdown prose, so the `\S+` capture drags in
      // trailing code-fence backticks and sentence punctuation. Strip those before judging
      // the value, or every documented example reads as a leak.
      const assigned = value.replace(/[`,;.)\]}]+$/, '');
      // `TS_AUTHKEY=` with nothing after it is an unset variable, not a leak. This is the
      // shape .env.example uses for every secret the human still has to supply.
      if (assigned === '') continue;
      assert.ok(
        NOT_KEY_MATERIAL.test(assigned),
        `${f}: "${match.trim()}" assigns something that is not a variable reference or a ` +
          `placeholder. Document the wiring as \${VAR_NAME}, never a literal value.`,
      );
    }
  }
});

test('.env is never committed', async () => {
  // The invariant is "not tracked by git", NOT "absent from disk". Every developer who
  // runs the stack has a local .env; asserting it does not exist would make the working
  // configuration illegal and would be routed around within a day. Ask git instead.
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const run = promisify(execFile);

  let tracked;
  try {
    await run('git', ['ls-files', '--error-unmatch', '.env'], { cwd: ROOT });
    tracked = true; // exit 0 means git knows this path
  } catch {
    tracked = false; // non-zero means untracked, which is what we want
  }
  assert.equal(tracked, false, 'a real .env must never be committed');

  const gitignore = (await exists('.gitignore')) ? await readFile(join(ROOT, '.gitignore'), 'utf8') : '';
  assert.match(gitignore, /^\.env$/m, '.gitignore must list .env so it cannot be added by accident');
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
