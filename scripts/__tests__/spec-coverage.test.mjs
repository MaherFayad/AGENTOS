/**
 * check-spec-coverage.mjs — the Test column is resolved, and prose is left as prose.
 *
 * This test exists because the gate's founding rule — *a requirement pointing at a file that
 * does not exist is a lie in a document, which is worse than a gap, because a gap is visible*
 * — was enforced on **half the table** for the whole life of the gate. `r.impl` was resolved;
 * `r.test` was only ever compared against a pending marker. `fidelity-qa-reviewer` falsified
 * it during M15 acceptance by pointing REQ-DRW-01's Test cell at a file that does not exist:
 * **exit 0, no FAIL, no warn.**
 *
 * The fix is not "resolve everything in the Test cell". That column carries forms the
 * Implemented column does not — `manual — see Test plan`, shell commands, URL routes, a bare
 * `—` — and a gate that FAILs on prose is a gate people route around. So the shape rule is
 * what is pinned here, in both directions: the path claims must go red, and the prose must
 * stay green.
 *
 * Owner: commandcenter-orchestrator (the coverage gate is ADR-013's; the script has no
 * BOARD owner and this is the record's machinery, not a feature).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = join(ROOT, 'scripts', 'check-spec-coverage.mjs');

const SPEC = `# PART I — Foundations

## 1.1 A section

Prose.
`;

const BOARD = `# BOARD

## Spec coverage

| Spec section | Claimed by |
|---|---|
| PART I · §1.1 | \`test-owner\` |

## After
`;

const area = (impl, testCell) => `# area

## Owner

\`test-owner\`

## Spec sections covered

PART I · §1.1

## Coverage

| id | § | Requirement | Implemented in | Test |
|---|---|---|---|---|
| REQ-X-01 | §1.1 | A thing that exists | ${impl} | ${testCell} |

## Deliberately not done

Nothing.
`;

/**
 * A synthetic ROOT rather than a copy of the real tree: the real Implemented column points
 * into `apps/**`, and copying that to compare two table cells would make the fixture the
 * slowest test in the repo. `check-spec-coverage.mjs` imports only node builtins, so one
 * file is the whole dependency.
 */
async function run(impl, testCell) {
  const dir = await mkdtemp(join(tmpdir(), 'cc-coverage-'));
  try {
    await mkdir(join(dir, 'scripts'), { recursive: true });
    await mkdir(join(dir, 'comms', 'specs'), { recursive: true });
    await mkdir(join(dir, 'nested', '__tests__'), { recursive: true });
    await cp(SCRIPT, join(dir, 'scripts', 'check-spec-coverage.mjs'));
    await writeFile(join(dir, 'skilltree-clone-spec.md'), SPEC, 'utf8');
    await writeFile(join(dir, 'comms', 'BOARD.md'), BOARD, 'utf8');
    await writeFile(join(dir, 'comms', 'specs', 'area.md'), area(impl, testCell), 'utf8');
    // Two real targets: one at the root (the extension arm) and one under a directory whose
    // name contains the underscores that a careless punctuation strip eats.
    await writeFile(join(dir, 'real-impl.ts'), '', 'utf8');
    await writeFile(join(dir, 'nested', '__tests__', 'real.test.ts'), '', 'utf8');
    const r = spawnSync(process.execPath, [join(dir, 'scripts', 'check-spec-coverage.mjs'), '--json'], {
      encoding: 'utf8',
    });
    return { ...JSON.parse(r.stdout), exit: r.status };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const IMPL = '`real-impl.ts`';

test('a Test-column path that resolves is green', async () => {
  const r = await run(IMPL, '`nested/__tests__/real.test.ts`');
  assert.deepEqual(r.errors, []);
  assert.equal(r.exit, 0);
});

test('a Test-column path that does not exist is a FAIL — the regression', async () => {
  // The exact falsification the reviewer ran: exit 0, no FAIL, no warn.
  const r = await run(IMPL, '`nested/__tests__/gone.test.ts`');
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0], /cites test "nested\/__tests__\/gone\.test\.ts" which does not exist/);
  assert.equal(r.exit, 1);
});

test('the Test column is resolved even when the requirement is declared-but-unbuilt', async () => {
  // A row with no implementation can still name a test file that is not there.
  const r = await run('—', '`nested/__tests__/gone.test.ts`');
  assert.equal(r.errors.length, 1);
  assert.equal(r.pending, 1);
});

test('prose in the Test column stays prose', async () => {
  for (const cell of [
    'manual — see Test plan',
    'negative fixture run',
    'review — `fidelity-qa-reviewer`',
    'manual — open `/p/:project/map`', // a URL route is not a file
    '`npm run typecheck`',
    '`--json` report, 6 of 12 cells filled',
  ]) {
    const r = await run(IMPL, cell);
    assert.deepEqual(r.errors, [], `expected no FAIL for ${cell}`);
  }
});

test('a command in the Test column still resolves the script it names', async () => {
  const ok = await run(IMPL, '`node nested/__tests__/real.test.ts`');
  assert.deepEqual(ok.errors, []);
  const bad = await run(IMPL, '`node nested/__tests__/gone.test.ts`');
  assert.equal(bad.errors.length, 1);
});

test('a near-miss pending marker warns instead of passing silently', async () => {
  // `— (owed)` did not match the both-ends-anchored PENDING, so it was graded as a real
  // verification claim and emitted nothing at all.
  const near = await run(IMPL, '— (owed)');
  assert.deepEqual(near.errors, []);
  assert.equal(near.warnings.length, 1);
  assert.match(near.warnings[0], /has no verification/);

  // ...but a pending marker that goes on to name real evidence is not "no verification".
  const cited = await run(IMPL, '— *(pinned by `nested/__tests__/real.test.ts`)*');
  assert.deepEqual(cited.warnings, []);
});

test('the Implemented column keeps its extension arm — a bare root filename is still checked', async () => {
  const r = await run('`nosuchroot.json`', '`nested/__tests__/real.test.ts`');
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0], /claims "nosuchroot\.json" which does not exist/);
});
