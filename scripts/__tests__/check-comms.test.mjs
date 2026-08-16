/**
 * check-comms.mjs — the `## Answer` rule.
 *
 * This test exists because the rule was wrong in both directions at once and nobody
 * noticed until it turned `npm run verify` red for four correctly-answered messages.
 * A gate that is wrong about the thing it gates teaches people to skip the gate, so the
 * gate's own logic gets a test.
 *
 * Owner: design-system-guardian (fixed here 2026-08-16; the script has no BOARD owner)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = join(ROOT, 'scripts', 'check-comms.mjs');

const FM = (status) => `---
from: design-system-guardian
to: fidelity-qa-reviewer
type: question
re: '-'
status: ${status}
created: 2026-08-16T21:40
---

## Context

Body.
`;

/**
 * Run check-comms against a throwaway copy of comms/ with one extra message dropped in.
 * Copying the real tree keeps the roster, contracts and ADR checks satisfied so the only
 * thing that can move the exit code is the message under test.
 */
async function runWith(filename, contents) {
  const dir = await mkdtemp(join(tmpdir(), 'cc-comms-'));
  try {
    await cp(join(ROOT, 'comms'), join(dir, 'comms'), { recursive: true });
    await cp(join(ROOT, 'scripts'), join(dir, 'scripts'), { recursive: true });
    const box = join(dir, 'comms', 'inbox', 'fidelity-qa-reviewer');
    await mkdir(box, { recursive: true });
    await writeFile(join(box, filename), contents, 'utf8');
    const r = spawnSync(process.execPath, [join(dir, 'scripts', 'check-comms.mjs'), '--json'], {
      encoding: 'utf8',
    });
    return JSON.parse(r.stdout).errors.filter((e) => e.includes(filename));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const NAME = '20260816-2140-design-system-guardian-fixture.md';

test('an attributed "## Answer — who, when" heading is accepted', async () => {
  // The regression. This exact shape failed the old `/^##\s+Answer\s*$/m` and took four
  // correctly-answered messages plus `npm run verify` down with it.
  const errs = await runWith(
    NAME,
    FM('answered') + '\n## Answer — design-system-guardian, 2026-08-16T21:22\n\nThe answer.\n',
  );
  assert.deepEqual(errs, []);
});

test('a bare "## Answer" heading with a real body is still accepted', async () => {
  const errs = await runWith(NAME, FM('answered') + '\n## Answer\n\nThe answer.\n');
  assert.deepEqual(errs, []);
});

test('answered with an EMPTY "## Answer" is caught — the template-copy case', async () => {
  // The one the old rule could not see: comms/templates/message.md ends with a bare
  // `## Answer` and nothing under it. Copy, flip status, write nothing, pass.
  const errs = await runWith(NAME, FM('answered') + '\n## Answer\n');
  assert.equal(errs.length, 1);
  assert.match(errs[0], /present but empty/);
});

test('a horizontal rule under the heading does not count as an answer', async () => {
  const errs = await runWith(NAME, FM('closed') + '\n## Answer\n\n---\n');
  assert.equal(errs.length, 1);
  assert.match(errs[0], /present but empty/);
});

test('answered with no heading at all is caught, and the message says how to fix it', async () => {
  const errs = await runWith(NAME, FM('answered'));
  assert.equal(errs.length, 1);
  assert.match(errs[0], /no "## Answer" heading/);
  assert.match(errs[0], /set status: open/);
});

test('an open message needs no answer', async () => {
  const errs = await runWith(NAME, FM('open'));
  assert.deepEqual(errs, []);
});

test('the real comms/ tree passes', () => {
  const r = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8', cwd: ROOT });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});
