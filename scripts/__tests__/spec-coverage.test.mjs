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

1. A flag numbered directly under the part, the way Part VII numbers its honest flags.

## 1.1 A section

Prose.

1. First numbered thing.
2. Second numbered thing.

## 1.2 Another section

Prose.

\`\`\`
1. A numbered line inside a fence is not a section.
\`\`\`
`;

/**
 * The plan, in miniature. Part Two is cited as \`Plan §12\` / \`Plan §23.8\` (ADR-013 rule 2) and
 * numbers itself \`## 12.\` / \`### 23.8\`, which is what makes those two shapes the whole index.
 */
const PLAN = `# AgentOS v2

## 12. Threads

Prose.

### 23.8 New surfaces

Prose.
`;

const BOARD = `# BOARD

## Spec coverage

| Spec section | Claimed by |
|---|---|
| PART I · §1.1 · §1.2 | \`test-owner\` |

## After
`;

const area = (impl, testCell, section) => `# area

## Owner

\`test-owner\`

## Spec sections covered

PART I · §1.1 · §1.2

## Coverage

| id | § | Requirement | Implemented in | Test |
|---|---|---|---|---|
| REQ-X-01 | ${section} | A thing that exists | ${impl} | ${testCell} |

## Deliberately not done

Nothing.
`;

/**
 * A synthetic ROOT rather than a copy of the real tree: the real Implemented column points
 * into `apps/**`, and copying that to compare two table cells would make the fixture the
 * slowest test in the repo. `check-spec-coverage.mjs` imports only node builtins, so one
 * file is the whole dependency.
 */
async function run(impl, testCell, { section = '§1.1', plan = true } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'cc-coverage-'));
  try {
    await mkdir(join(dir, 'scripts'), { recursive: true });
    await mkdir(join(dir, 'comms', 'specs'), { recursive: true });
    await mkdir(join(dir, 'nested', '__tests__'), { recursive: true });
    await cp(SCRIPT, join(dir, 'scripts', 'check-spec-coverage.mjs'));
    await writeFile(join(dir, 'skilltree-clone-spec.md'), SPEC, 'utf8');
    if (plan) await writeFile(join(dir, 'AGENTOS-V2-PLAN.md'), PLAN, 'utf8');
    await writeFile(join(dir, 'comms', 'BOARD.md'), BOARD, 'utf8');
    await writeFile(join(dir, 'comms', 'specs', 'area.md'), area(impl, testCell, section), 'utf8');
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

/**
 * The Spec § column (ADR-034).
 *
 * Two defects, one column. The gate accepted a cell only if it *started with* `§` or `PART`, so
 * `` `Plan §12` `` — the form ADR-013 rule 2 requires for Part Two work — FAILed on its opening
 * backtick, and `§99.9` passed on its opening `§`. The first is the worse of the two: a gate that
 * refuses the correct citation makes agents cite something that passes instead, and
 * `runner-engineer` reported taking that branch knowingly. **The distortion is invisible in the
 * output**, which is why the fix has to be tested in both directions rather than by reading it.
 */
const TEST_OK = '`nested/__tests__/real.test.ts`';

test('a bare `Plan §n` citation passes — the regression this whole section exists for', async () => {
  for (const section of ['`Plan §12`', 'Plan §12', '`Plan §23.8`']) {
    const r = await run(IMPL, TEST_OK, { section });
    assert.deepEqual(r.errors, [], `expected no FAIL for ${section}`);
    assert.equal(r.exit, 0);
  }
});

test('the spec-of-record forms are untouched by the widening', async () => {
  for (const section of ['§1.1', 'PART I', '§1.1 · PART I']) {
    const r = await run(IMPL, TEST_OK, { section });
    assert.deepEqual(r.errors, [], `expected no FAIL for ${section}`);
  }
});

test('a citation pointing nowhere FAILs — on BOTH documents', async () => {
  // Fixing the prefix without fixing the resolution ships a gate that accepts `Plan §99.9`.
  for (const [section, doc] of [
    ['§99.9', 'skilltree-clone-spec.md'],
    ['PART IX', 'skilltree-clone-spec.md'],
    ['`Plan §99`', 'AGENTOS-V2-PLAN.md'],
    ['`Plan §99.9`', 'AGENTOS-V2-PLAN.md'],
  ]) {
    const r = await run(IMPL, TEST_OK, { section });
    assert.equal(r.errors.length, 1, `expected a FAIL for ${section}`);
    assert.match(r.errors[0], new RegExp(`which ${doc.replace(/\./g, '\\.')} does not have`));
    assert.equal(r.exit, 1);
  }
});

test('the third level resolves against the ordered list, not against a heading', async () => {
  // §2.5's seven widget types and Part VII's four flags are numbered items, not headings, and
  // 44 real rows cite them. Resolving to heading depth only would FAIL all 44 correct cells.
  for (const ok of ['§1.1.2', 'PART I.1']) {
    const r = await run(IMPL, TEST_OK, { section: ok });
    assert.deepEqual(r.errors, [], `expected no FAIL for ${ok}`);
  }
  // ...and the depth is real, not decorative: §1.1 numbers two items.
  const bad = await run(IMPL, TEST_OK, { section: '§1.1.9' });
  assert.equal(bad.errors.length, 1);
});

test('a supporting citation is an addition, never the whole citation', async () => {
  // `BOARD rule 9` and `thread-model §4.2` are real cross-references this gate cannot resolve.
  // Accepted beside a primary citation; alone, the row cites no section and FAILs.
  const beside = await run(IMPL, TEST_OK, { section: 'PART I · BOARD rule 9 · thread-model §4.2' });
  assert.deepEqual(beside.errors, []);
  assert.equal(beside.citesUnresolvable, 2); // counted and reported, never silently absorbed

  for (const alone of ['BOARD rule 9', 'thread-model §4.2']) {
    const r = await run(IMPL, TEST_OK, { section: alone });
    assert.equal(r.errors.length, 1, `expected a FAIL for ${alone}`);
    assert.match(r.errors[0], /cites no spec or plan section/);
  }
});

test('a missing plan is reported, not graded as a pass', async () => {
  // A checker whose input silently became empty, reporting the empty result as a pass, is the
  // defect BOARD records against identity-model.test.mjs. `Plan §n` degrades to unchecked here
  // — and says so.
  const r = await run(IMPL, TEST_OK, { section: '`Plan §12`', plan: false });
  assert.deepEqual(r.errors, []);
  assert.equal(r.citesResolved, 0);
  assert.equal(r.citesUnresolvable, 1);
  assert.ok(r.warnings.some((w) => /AGENTOS-V2-PLAN\.md is missing/.test(w)));
});
