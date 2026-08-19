/**
 * **No response from `POST /api/schedule` claims a fire this build cannot cause.**
 *
 * That sentence is the assertion, and it is deliberately not "the new fields are present".
 *
 * ## The defect
 *
 * `fidelity-qa-reviewer` failed M18 on it. The route committed `schedule:` into frontmatter —
 * real, still real — and then returned `ok: true` with `nextRunAt` computed from the cron
 * expression and `ofeliaSynced: false`. Every field was individually true. The drawer rendered
 * *"Saved. Next run 2026-08-20T06:00:00Z."*, so a person scheduled an agent, was told when it
 * would next run, and nothing anywhere would ever act on it. The cron sidecar left the stack at
 * `e4e0bff` (ADR-024); no executor replaced it.
 *
 * BOARD rule 9 in its exact house shape — **a declared value read as an observed one** — and
 * worse than an error, because it succeeded silently. The gap was disclosed in
 * `infra/compose.yaml`, `specs/infrastructure.md` and `infra/BACKUP.md`: three files nobody
 * clicking the button opens.
 *
 * ## Why the assertion is shaped this way
 *
 * The response's **exact key set** is asserted, not the presence of the honest fields. Adding
 * `nextRunAt` *back*, beside `firedBy` and `nextMatchAt`, is the way this defect returns — a
 * consumer keeps its old branch, the new fields go unread, and a "the honest fields exist"
 * test stays green through all of it. An exact set cannot be satisfied by addition.
 *
 * The second half is the name rule: no key of this response may name a time **and** imply an
 * execution. It is applied to the keys of the object the code actually built, so it is a
 * statement about behaviour rather than about a declaration in `packages/contracts`.
 *
 * ## What this test cannot see, stated so the blindness is known
 *
 * It reads one route's response. It does **not** prove no executor exists — that claim lives in
 * `FIRED_BY` in `lib/schedule.ts`, and the mechanism protecting it is the compiler: widening
 * `ScheduleFiredBy` breaks the exhaustive switch behind `executionNote`, so the sentence cannot
 * fall behind the mechanism. It also says nothing about `apps/web`'s copy, which is
 * `drawer-engineer`'s; what it does is make the false sentence unspellable from this payload.
 */
import { mkdtemp, mkdir, readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ScheduleResponse } from '@agnetos/contracts';
import { setSchedule } from '../schedule.ts';
import { nextRunAt } from '../cron.ts';
import type { RunnerConfig } from '../config.ts';

const exec = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..', '..', '..');

const SLUG = 'back-office/fixture-agent';

const SKILL = `---
name: Fixture Agent
description: A fixture with just enough frontmatter to be loadable.
department: back-office
tier: assisted
phase: 1-observe
status: draft
wired_into: [gmail]
---

Body.
`;

/** A real git checkout with one agent in it — the schedule path writes and commits for real. */
async function fixture(): Promise<RunnerConfig> {
  const repoRoot = await mkdtemp(join(tmpdir(), 'agnetos-schedule-'));
  const agentsDir = join(repoRoot, 'agents');
  await mkdir(join(agentsDir, SLUG), { recursive: true });
  await writeFile(join(agentsDir, SLUG, 'SKILL.md'), SKILL, 'utf8');

  const git = (args: string[]) => exec('git', args, { cwd: repoRoot, windowsHide: true });
  await git(['init', '--quiet']);
  await git(['add', '--', 'agents']);
  await git([
    '-c',
    'user.name=fixture',
    '-c',
    'user.email=fixture@agnetos.local',
    'commit',
    '--quiet',
    '-m',
    'fixture',
  ]);

  return { repoRoot, agentsDir } as RunnerConfig;
}

/**
 * The keys the contract declares, and the whole of them.
 *
 * Kept as a literal rather than derived from the type: a set derived from `ScheduleResponse`
 * would agree with whatever the contract says at the moment it is read, including a
 * re-introduced `nextRunAt`. Two declarations agreeing is the pin this repo has already found
 * satisfiable by a lie; this list is a decision, and changing it is meant to be a diff someone
 * has to justify.
 */
const DECLARED_KEYS = ['agent', 'commitSha', 'cron', 'executionNote', 'firedBy', 'nextMatchAt', 'ok'];

/**
 * **A key that names a time and implies an execution.**
 *
 * `nextRunAt`, `nextFireAt`, `willRunAt`, `scheduledFor`, `runsAt` — and `ofeliaSynced`, which
 * is the other half of the same lie: a field named for a component that no longer exists,
 * whose `false` a reader was invited to hope would become `true`.
 *
 * `nextMatchAt` must pass, and that is the line the regex is drawn along: *match* is a claim
 * about the expression, *run* and *fire* are claims about the system. `firedBy` must pass too —
 * it names no time and its whole job is to say `'nobody'`.
 */
const PROMISES_A_FIRE = /(run|fire|exec|trigger|sync|sched)/i;
const NAMES_A_TIME = /(^next|at$|_at$|when|time|date|for$)/i;

test('the schedule response carries exactly the declared keys — and nothing that promises a fire', async () => {
  const config = await fixture();
  const response = await setSchedule(config, { agent: SLUG, cron: '0 6 * * 1' });

  const promising = Object.keys(response).filter(
    (key) => PROMISES_A_FIRE.test(key) && NAMES_A_TIME.test(key),
  );
  assert.deepEqual(
    promising,
    [],
    `${promising.join(', ')} names a time and implies an execution. This build has no executor: ` +
      'the cron sidecar was removed at e4e0bff (ADR-024) and routes/schedules.ts records fires ' +
      'without starting runs. Report the match (nextMatchAt) and who will act on it (firedBy).',
  );

  assert.deepEqual(
    Object.keys(response).sort(),
    DECLARED_KEYS,
    'POST /api/schedule returned a key set the contract does not declare. If a field was added, ' +
      'check it does not promise an execution: nothing in this build fires a schedule ' +
      '(comms/contracts/api-contracts.md, POST /api/schedule).',
  );
});

test('the committed schedule is real, and the response says plainly that nothing will fire it', async () => {
  const config = await fixture();
  const response: ScheduleResponse = await setSchedule(config, { agent: SLUG, cron: '0 6 * * 1' });

  // The half that was never a lie: frontmatter is written and committed (REQ-RUN-16).
  const source = await readFile(join(config.agentsDir, SLUG, 'SKILL.md'), 'utf8');
  assert.match(source, /^schedule: "0 6 \* \* 1"$/m, 'the cron belongs in the file, not in a table');
  const { stdout: subject } = await exec('git', ['log', '-1', '--format=%s'], {
    cwd: config.repoRoot,
    windowsHide: true,
  });
  assert.match(subject.trim(), /^chore\(agents\): schedule .* at "0 6 \* \* 1"$/);
  assert.match(response.commitSha, /^[0-9a-f]{40}$/);

  // The half that was: who acts on it, and what the timestamp actually means.
  assert.equal(response.firedBy, 'nobody');
  assert.equal(
    response.nextMatchAt,
    nextRunAt('0 6 * * 1'),
    'nextMatchAt is arithmetic on the expression — the same function behind the map clock badge',
  );

  // The sentence a person reads has to contain the negation, not merely omit the promise.
  assert.match(response.executionNote, /nothing in this build fires schedules/i);
  assert.doesNotMatch(
    response.executionNote,
    /next run/i,
    'the exact sentence the drawer used to render, and the reason this file exists',
  );
});

test('unscheduling says the same true thing, without inviting the same inference', async () => {
  const config = await fixture();
  const response = await setSchedule(config, { agent: SLUG, cron: '0 6 * * 1' });
  assert.notEqual(response.nextMatchAt, null);

  const removed = await setSchedule(config, { agent: SLUG, cron: null });
  assert.deepEqual(Object.keys(removed).sort(), DECLARED_KEYS);
  assert.equal(removed.cron, null);
  assert.equal(removed.nextMatchAt, null);
  assert.equal(removed.firedBy, 'nobody');
  // "It stopped running" would be false in the other direction — it never ran.
  assert.match(removed.executionNote, /nothing in this build fires schedules/i);

  const source = await readFile(join(config.agentsDir, SLUG, 'SKILL.md'), 'utf8');
  assert.doesNotMatch(source, /^schedule:/m);
});

test('the name rule would catch the field it was written for — falsified against both shapes', () => {
  const caught = (key: string) => PROMISES_A_FIRE.test(key) && NAMES_A_TIME.test(key);

  // The two fields this response used to carry, and the shapes a re-introduction takes.
  assert.equal(caught('nextRunAt'), true);
  assert.equal(caught('nextFireAt'), true);
  assert.equal(caught('willRunAt'), true);
  assert.equal(caught('scheduledFor'), true);
  assert.equal(caught('nextExecutionTime'), true);
  assert.equal(caught('syncedAt'), true, 'the ofeliaSynced shape, re-timestamped');

  // …and the honest fields survive it, which is the half that makes the rule usable rather
  // than a ban on the letter "r".
  for (const key of DECLARED_KEYS) {
    assert.equal(caught(key), false, `${key} is a declared key and must not trip the name rule`);
  }
});

/**
 * **The dead sync path stays dead.**
 *
 * `syncOfelia` targeted a container deleted at `e4e0bff`; its first step was an `access()` on a
 * generator script that no longer exists, so it degraded to `{ synced: false, reason }` and the
 * route logged a `warn` nobody reads. That was the correct stopgap when `infra-compose-engineer`
 * removed the sidecar and filed the runner half to me; it is now deleted, along with
 * `ofeliaSyncUrl`, `OFELIA_SYNC_URL` and the `ofelia_sync_failed` (502) code.
 *
 * Identifiers, not prose. The history is discussed in several headers in past tense and a
 * scanner that could not tell a tombstone from a mechanism would force the tombstones to go
 * unwritten — the same trap `superseded-run-input.test.ts` documents. An identifier can only
 * appear if something references it, and a line that says it is gone is permitted so this file
 * and the two doc comments explaining the removal are not offenders.
 */
const OFELIA = 'ofelia';
const DEAD_IDENTIFIERS = new RegExp(
  `(sync${OFELIA}|${OFELIA}Synced|${OFELIA}SyncUrl|OFELIA_SYNC_URL|OFELIA_HUP_COMMAND|${OFELIA}_sync_failed)`,
  'i',
);
const PERMITTED_ON_A_LINE_THAT_SAYS_SO = /deleted|removed|no longer|used to|never|replac/i;

const SCAN_ROOTS = [join(ROOT, 'apps', 'runner', 'src'), join(ROOT, 'packages', 'contracts', 'src')];

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
    } else if (entry.name.endsWith('.ts')) {
      yield full;
    }
  }
}

test('no runner or contract source references the removed cron-sidecar sync', async () => {
  const offenders: string[] = [];
  let scanned = 0;

  for (const root of SCAN_ROOTS) {
    // A scan over a directory that does not exist finds nothing and reads as success.
    const info = await stat(root).catch(() => null);
    assert.ok(info?.isDirectory(), `${relative(ROOT, root)} is not a directory — the scan would be vacuous`);

    for await (const file of walk(root)) {
      if (file.endsWith('schedule-claims-no-fire.test.ts')) continue;
      scanned += 1;
      const text = await readFile(file, 'utf8');
      for (const [index, line] of text.split(/\r?\n/).entries()) {
        if (!DEAD_IDENTIFIERS.test(line)) continue;
        if (PERMITTED_ON_A_LINE_THAT_SAYS_SO.test(line)) continue;
        offenders.push(`${relative(ROOT, file)}:${index + 1}: ${line.trim()}`);
      }
    }
  }

  assert.ok(
    scanned > 50,
    `only ${scanned} files scanned — the walker is broken and this test would pass by having nothing to read`,
  );
  assert.ok(
    (await stat(join(ROOT, 'apps', 'runner', 'src', 'lib', 'schedule.ts')).catch(() => null))?.isFile(),
    'lib/schedule.ts is not where the scan expects it — the corpus no longer contains the file this rule is about',
  );

  assert.deepEqual(
    offenders,
    [],
    'The cron sidecar was removed from infra/compose.yaml at e4e0bff (ADR-024) and the runner half ' +
      'with it. Re-introducing a sync means re-introducing a scheduler; that is an ADR amending ' +
      'ADR-024 and a change to ScheduleFiredBy, not an import.\n\n' +
      offenders.join('\n'),
  );
});

test('the identifier scan would catch a re-introduction — falsified in place', () => {
  const offends = (line: string) =>
    DEAD_IDENTIFIERS.test(line) && !PERMITTED_ON_A_LINE_THAT_SAYS_SO.test(line);

  assert.equal(offends(`import { sync${OFELIA} } from './${OFELIA}';`), true);
  assert.equal(offends(`    ${OFELIA}Synced: sync.synced,`), true);
  assert.equal(offends(`  ${OFELIA}SyncUrl: process.env.OFELIA_SYNC_URL ?? null,`), true);
  assert.equal(offends(`  | '${OFELIA}_sync_failed'`), true);

  // A tombstone is not an offender, and the marker alone does not excuse an unrelated line.
  assert.equal(offends(` * \`${OFELIA}_sync_failed\` (502) is deleted, not retired.`), false);
  assert.equal(offends('const synced = await pushToRemote();'), false, 'unrelated "sync" is not the needle');
  assert.equal(DEAD_IDENTIFIERS.test('// this feature was deleted'), false, 'the marker alone is not a needle');
});
