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

// ---------------------------------------------------------------------------------------
// The broadcast age gate. `_all/` reached 2,740 lines across 29 broadcasts — eighteen times
// the whole BRIEF cap — read by every agent on every dispatch. The line-total control is an
// aggregate and cannot express the thing that produced that: one broadcast outliving its
// event. These lock the per-file control in BOTH directions, because a gate that has only
// ever been green is a claim.
// ---------------------------------------------------------------------------------------

const BCAST = (created) => `---
from: commandcenter-orchestrator
to: all
type: fyi
re: '-'
status: open
created: ${created}
---

## Context

Fixture.
`;

/** As `runWith`, but the message lands in `_all/` and both errors and warnings come back. */
async function runBroadcast(filename, contents) {
  const dir = await mkdtemp(join(tmpdir(), 'cc-comms-'));
  try {
    await cp(join(ROOT, 'comms'), join(dir, 'comms'), { recursive: true });
    await cp(join(ROOT, 'scripts'), join(dir, 'scripts'), { recursive: true });
    const box = join(dir, 'comms', 'inbox', '_all');
    await mkdir(box, { recursive: true });
    await writeFile(join(box, filename), contents, 'utf8');
    const r = spawnSync(process.execPath, [join(dir, 'scripts', 'check-comms.mjs'), '--json'], {
      encoding: 'utf8',
    });
    const j = JSON.parse(r.stdout);
    const mine = (xs) => xs.filter((e) => e.includes(filename));
    return { errors: mine(j.errors), warnings: mine(j.warnings), status: r.status };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Days ago as the frontmatter would spell it — relative, so these never expire. */
const daysAgo = (n) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 16);

const BNAME = '20260101-1200-commandcenter-orchestrator-fixture.md';

test('a broadcast past the hard limit FAILs and the message names the git mv', async () => {
  const { errors, warnings, status } = await runBroadcast(BNAME, BCAST(daysAgo(48)));
  assert.equal(errors.length, 1, `expected one error, got ${JSON.stringify(errors)}`);
  assert.match(errors[0], /48 days old/);
  assert.match(errors[0], /git mv .* comms\/inbox\/_archive\/_all\//);
  assert.deepEqual(warnings, [], 'a hard failure must not also warn — one finding, one voice');
  assert.equal(status, 1);
});

test('a broadcast past the soft limit warns and does NOT fail the build', async () => {
  // The gap between the two limits is the design: 7 days says "check its content landed",
  // 21 says "nobody is going to". Neither punishes the send.
  const { errors, warnings } = await runBroadcast(BNAME, BCAST(daysAgo(9)));
  assert.deepEqual(errors, []);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /9 days old/);
});

test('a fresh broadcast is silent — the gate must not punish the send', async () => {
  const { errors, warnings } = await runBroadcast(BNAME, BCAST(daysAgo(1)));
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
});

test('an unparseable `created:` is reported, not silently skipped', async () => {
  // A file the checker cannot read is the one place a hoard would learn to hide, so the
  // blind spot announces itself rather than counting as age 0 and passing.
  const { errors, warnings } = await runBroadcast(BNAME, BCAST('banana'));
  assert.deepEqual(errors, []);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /unparseable/);
});

test('the real comms/ tree passes', () => {
  const r = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8', cwd: ROOT });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});
