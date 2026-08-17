/**
 * **What a refusal says, and what it leaves behind.**
 *
 * Three gates, one per finding in `fidelity-qa-reviewer`'s FAIL on the M16 thread slice
 * (`comms/inbox/_archive/fidelity-qa-reviewer/20260817-2312-runner-engineer-review-request-m16-thread-route-and-mailbox.md`).
 * Each one was a paragraph in that verdict; each is a test here instead, because a finding
 * written into a gate keeps working and a finding written into prose is read once.
 *
 *   1. `PostThreadMessageResponse.threadState`'s doc comment claimed a `halt` moves the thread
 *      to `waiting`. The service returns the pre-append state and is right. **The composer's
 *      author has only the comment**, so the drift was not cosmetic — it was a specification.
 *   2. `POST /thread` wrote the thread row *before* validating the interrupt, so a `steer` —
 *      refused always in this build — created a permanent orphan in a table with no delete
 *      verb in any plane (`thread-model.md` §7.3).
 *   3. `assertRunnable` threw `address_unresolved` for an address that resolved.
 *
 * ## What is real here and what is faked
 *
 * No Postgres and no model, which is this repo's actual state (`DATABASE_URL` unset,
 * `RUNNER_ANTHROPIC_API_KEY` unset, `thread-model.md` §8). The thread store is a recording
 * client, so what is asserted is **the statements the service issued** — for gate 2 that is
 * exactly the right instrument, because the question is whether a row was written, and a
 * recorded `INSERT` is the row's only observable today.
 *
 * ## Falsification
 *
 * All three were planted, watched red, and reverted — recorded in the status file with the
 * failure text. Gate 1 additionally carries its falsification *in the file*, against the
 * sentence that was actually there, in the shape `contract-arguments-from-inert-mechanisms.ts`
 * established: a scanner nobody has seen fail is a scanner nobody should believe.
 */
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { API_ERROR_STATUS, THREAD_STATES } from '@agnetos/contracts';
import { loadConfig } from '../config.ts';
import { mountedProject } from '../project.ts';
import {
  assertRunnable,
  createThreadFromLine,
  postThreadMessage,
  resolveAddress,
} from '../threadService.ts';
import type { MountedProject } from '../project.ts';
import type { DbClient } from '../../observability/types.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..', '..', '..');
const CONTRACT = join(ROOT, 'packages', 'contracts', 'src', 'api.ts');

const THREAD = '00000000-0000-4000-8000-0000000000aa';
const PROJECT = '00000000-0000-4000-8000-0000000000b1';

type Call = { sql: string; params: readonly unknown[] };

/**
 * A recording thread store.
 *
 * `state` is the state the SELECT reports, so one fake serves every case: the halt gate needs
 * a `running` thread and the create gate needs a thread that must never be selected at all.
 */
function recorder(state: string): { db: DbClient; calls: Call[] } {
  const calls: Call[] = [];
  const db: DbClient = {
    async query(sql: string, params: readonly unknown[] = []) {
      calls.push({ sql, params });
      if (/SELECT[\s\S]*FROM ops\.thread/i.test(sql)) {
        return {
          rows: [
            {
              id: THREAD,
              project_id: params[1] ?? PROJECT,
              kind: 'agent',
              delivery: 'direct',
              addressed_to: 'sales/probe',
              state,
              parent_thread_id: null,
              created_by: 'human:unattributed',
              due_at: null,
              account_id: null,
              created_at: '2026-08-18T00:00:00.000Z',
            },
          ] as never[],
        };
      }
      if (/INSERT INTO ops\.message/i.test(sql)) return { rows: [{ id: 'm1', seq: 1 }] as never[] };
      return { rows: [] as never[] };
    },
  };
  return { db, calls };
}

const threadInserts = (calls: Call[]): Call[] => calls.filter((c) => /INSERT INTO ops\.thread/i.test(c.sql));
const messageInserts = (calls: Call[]): Call[] => calls.filter((c) => /INSERT INTO ops\.message/i.test(c.sql));

/* -------------------------------------------------------------------------- *
 * 1. The contract and the service, read together
 * -------------------------------------------------------------------------- */

/**
 * Pull the doc comment that sits immediately above a field, from the interface that declares
 * it. Deliberately *not* a regex over the whole file: the thing a consumer reads is the
 * comment attached to the field, and a scan that matched anywhere would go green on a
 * correction written three interfaces away.
 */
async function fieldDoc(interfaceName: string, field: string): Promise<string> {
  const source = await readFile(CONTRACT, 'utf8');
  const start = source.indexOf(`export interface ${interfaceName} {`);
  assert.notEqual(start, -1, `${interfaceName} is not in api.ts — this scan would find nothing and pass`);
  const block = source.slice(start, source.indexOf('\n}', start));

  const lines = block.split(/\r?\n/);
  const at = lines.findIndex((l) => new RegExp(`^\\s*${field}\\??:`).test(l));
  assert.notEqual(at, -1, `${interfaceName}.${field} is not in that interface`);

  const comment: string[] = [];
  for (let i = at - 1; i >= 0; i -= 1) {
    const line = lines[i]!.trim();
    if (line === '' || line.startsWith('}')) break;
    if (!line.startsWith('*') && !line.startsWith('/**')) break;
    comment.unshift(line.replace(/^\/\*\*|^\*\/|^\*/, '').trim());
    if (line.startsWith('/**')) break;
  }
  return comment.join(' ').trim();
}

const STATE_WORD = new RegExp(`\\b(${THREAD_STATES.join('|')})\\b`, 'g');

/**
 * **THE GATE ITEM 1 ASKED FOR.** The doc and the service are read in the same test and
 * compared, so they cannot drift apart quietly again.
 *
 * The scenario is the one the wrong sentence made a claim about: a `halt` on a `running`
 * thread. The service is *observed*, not described — the value comes out of a real call to
 * `postThreadMessage` — and then the comment is held to it: any thread state the comment
 * names must be the state the call actually returns.
 *
 * ## What this instrument cannot see
 *
 * It matches **words**, so a comment that names the right state and then lies about it in
 * other vocabulary passes. And it is narrow on purpose: legitimate prose about some *other*
 * state in this one field's comment will turn it red, and the fix is to move that prose
 * rather than to widen the window — the reader who greps `threadState` is handed this comment
 * and nothing else, which is the whole reason the defect mattered.
 */
test('a halt does not move the thread here, and the contract may not say otherwise', async () => {
  const { db, calls } = recorder('running');
  const project = { id: PROJECT, slug: 'acme' } as MountedProject;

  const response = await postThreadMessage(db, project, THREAD, {
    body: 'stop — the client changed the brief',
    interrupt: 'halt',
  });

  // Observed, from the service, on the exact scenario the comment describes.
  assert.equal(
    response.threadState,
    'running',
    'the response reports the state as at the append. The run moves the thread when its ' +
      'drain reads the halt — this route does not, and must not claim to.',
  );
  assert.equal(response.disposition, 'delivered-to-run');
  assert.equal(messageInserts(calls).length, 1, 'the halt was appended — the call really happened');

  const doc = await fieldDoc('PostThreadMessageResponse', 'threadState');
  assert.ok(
    doc.length > 60,
    `only ${doc.length} characters of doc comment were read for threadState. The extractor is ` +
      'broken and this assertion would pass by having nothing to check.',
  );

  const named = [...doc.matchAll(STATE_WORD)].map((m) => m[1]!);
  assert.ok(named.length > 0, 'the comment names no thread state at all — the scan has rotted or the field was renamed');
  assert.deepEqual(
    [...new Set(named)].filter((s) => s !== response.threadState),
    [],
    'PostThreadMessageResponse.threadState\'s doc comment names a thread state that is NOT the ' +
      `one the service returns (${response.threadState}) for a halt on a running thread. The ` +
      'composer\'s author has only this comment, so a wrong sentence here is a wrong ' +
      'specification, not a stale note — a composer that trusted it would render "stopping" ' +
      `off a value that says "${response.threadState}".\n\nnamed: ${[...new Set(named)].join(', ')}\n\n${doc}`,
  );
});

test('the doc scanner would have caught the sentence that was actually there', async () => {
  // A test that has never been red proves nothing. This is `api.ts:616` verbatim, as it stood
  // before 2026-08-18, and the sentence that replaced it.
  const wrong = "The thread's state after the append — `halt` on a running thread moves it to `waiting`.";
  const right =
    "The thread's state as at the append — read before the message was written. A `halt` does " +
    "not move it here; the run's next drain does, so this says `running` until it stops.";

  const statesIn = (text: string): string[] => [...new Set([...text.matchAll(STATE_WORD)].map((m) => m[1]!))];

  assert.deepEqual(statesIn(wrong).filter((s) => s !== 'running'), ['waiting'], 'the old sentence is caught');
  assert.deepEqual(statesIn(right).filter((s) => s !== 'running'), [], 'the corrected one passes');

  // And the extractor points at a real field rather than at nothing — the vacuity check, run
  // against a *different* field so a broken `threadState` lookup cannot make both halves green.
  const disposition = await fieldDoc('PostThreadMessageResponse', 'disposition');
  assert.match(disposition, /delivered-to-run/, 'the extractor reads the comment attached to the field it was asked for');
});

/* -------------------------------------------------------------------------- *
 * 2. A refused create writes nothing
 * -------------------------------------------------------------------------- */

async function library(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'agnetos-thread-refusals-'));
  await mkdir(join(root, 'agents', 'sales', 'probe'), { recursive: true });
  await mkdir(join(root, 'company', 'sources'), { recursive: true });
  await mkdir(join(root, 'panels'), { recursive: true });
  await writeFile(
    join(root, 'agents', 'sales', 'probe', 'SKILL.md'),
    ['---', 'name: Probe', 'description: A probe agent.', 'department: sales', 'wired_into: []', 'status: draft', '---', 'Body.', ''].join('\n'),
    'utf8',
  );
  await writeFile(join(root, 'company', 'COMPANY.md'), '## Identity\n\nA real sentence.\n', 'utf8');
  return root;
}

async function create(
  request: { line: string; interrupt?: 'note' | 'steer' | 'halt' },
): Promise<{ calls: Call[]; error: { code?: string; message?: string; hint?: string } | null }> {
  const root = await library();
  const saved = { root: process.env.AGNETOS_REPO_ROOT, global: process.env.AGNETOS_GLOBAL_LIBRARY };
  process.env.AGNETOS_REPO_ROOT = root;
  delete process.env.AGNETOS_GLOBAL_LIBRARY;

  try {
    const { db, calls } = recorder('open');
    const config = loadConfig();
    try {
      await createThreadFromLine(db, config, mountedProject(config), request);
      return { calls, error: null };
    } catch (err) {
      return { calls, error: err as { code?: string } };
    }
  } finally {
    if (saved.root === undefined) delete process.env.AGNETOS_REPO_ROOT;
    else process.env.AGNETOS_REPO_ROOT = saved.root;
    if (saved.global !== undefined) process.env.AGNETOS_GLOBAL_LIBRARY = saved.global;
  }
}

/**
 * **THE GATE ITEM 2 ASKED FOR**, asserted on the boundary rather than on the intent: not
 * "validation ran first" but **no `INSERT INTO ops.thread` was issued**.
 *
 * The distinction is the one `cascade-ceiling.test.ts` is built on — assert on the artifact
 * the boundary produces, never on the boundary's opinion of itself. A test that only checked
 * the error code passed for the entire life of this defect.
 */
test('a refused steer creates no thread — nothing is written before the refusal', async () => {
  const { calls, error } = await create({ line: '@sales/probe do the thing', interrupt: 'steer' });

  assert.equal(error?.code, 'interrupt_not_deliverable', 'the steer is still refused');
  assert.equal(API_ERROR_STATUS.interrupt_not_deliverable, 409);
  assert.deepEqual(
    threadInserts(calls),
    [],
    'A refused create wrote a thread row. `ops.thread` has no delete verb in any plane ' +
      '(thread-model.md §7.3), so that row is permanent — and this is the path that is ' +
      'ALWAYS taken, because every steer is refused in this build. Validate before you ' +
      'write: unbounded growth on the one path guaranteed to be exercised.',
  );
  assert.deepEqual(messageInserts(calls), [], 'and no turn either');
  assert.deepEqual(calls, [], 'no statement of any kind reached the store');
});

test('a steer with no body is refused too — the check does not depend on there being a turn', async () => {
  // The variant the old placement could never have refused: the check lived inside
  // `if (parsed.body.length > 0)`. A rule that runs on some requests is not the rule
  // "a refused request writes nothing".
  const { calls, error } = await create({ line: '@sales/probe', interrupt: 'steer' });
  assert.equal(error?.code, 'interrupt_not_deliverable');
  assert.deepEqual(threadInserts(calls), []);
});

test('the control: an accepted create writes exactly one thread and one turn', async () => {
  // Without this, "no row was written" would pass just as happily against a route that
  // writes nothing at all, or against a fixture whose address never resolves.
  const { calls, error } = await create({ line: '@sales/probe do the thing', interrupt: 'note' });

  assert.equal(error, null);
  assert.equal(threadInserts(calls).length, 1, 'the happy path still writes its row');
  assert.equal(messageInserts(calls).length, 1, 'and its first turn');
});

test('a refusal that happens before the interrupt check also writes nothing', async () => {
  // The ordering claim in full: resolution refuses ahead of the write as well, so the
  // property is "no refusal on this route leaves a row", not "one of them does not".
  const unresolved = await create({ line: '@sales/nobody hello', interrupt: 'note' });
  assert.equal(unresolved.error?.code, 'address_unresolved');
  assert.deepEqual(unresolved.calls, []);

  const malformed = await create({ line: '@Sales/Probe hello', interrupt: 'note' });
  assert.equal(malformed.error?.code, 'address_malformed');
  assert.deepEqual(malformed.calls, []);
});

/* -------------------------------------------------------------------------- *
 * 3. The code names the condition that happened
 * -------------------------------------------------------------------------- */

async function withLibrary<T>(fn: (config: ReturnType<typeof loadConfig>, project: MountedProject) => Promise<T>): Promise<T> {
  const root = await library();
  const saved = { root: process.env.AGNETOS_REPO_ROOT, global: process.env.AGNETOS_GLOBAL_LIBRARY };
  process.env.AGNETOS_REPO_ROOT = root;
  delete process.env.AGNETOS_GLOBAL_LIBRARY;
  try {
    const config = loadConfig();
    return await fn(config, mountedProject(config));
  } finally {
    if (saved.root === undefined) delete process.env.AGNETOS_REPO_ROOT;
    else process.env.AGNETOS_REPO_ROOT = saved.root;
    if (saved.global !== undefined) process.env.AGNETOS_GLOBAL_LIBRARY = saved.global;
  }
}

const codeOf = (fn: () => unknown): string | undefined => {
  try {
    fn();
    return undefined;
  } catch (err) {
    return (err as { code?: string }).code;
  }
};

/**
 * **THE GATE ITEM 3 ASKED FOR**, and it is a *discriminator* test rather than a code test:
 * the two facts must be reachable by two different codes from the same client's point of view.
 *
 * "You typed a department this project does not have" and "dispatch is not built yet" have
 * different owners and different fixes. While both threw `address_unresolved`, a client
 * branching on `code` could not tell them apart, and only the hints differed — a client
 * cannot branch on prose.
 */
test('an address that resolved is refused as not-addressable, never as unresolved', async () => {
  const dispatch = codeOf(() =>
    assertRunnable({ kind: 'department', delivery: 'dispatch', addressedTo: 'sales' }, 2),
  );
  const bare = codeOf(() =>
    assertRunnable({ kind: 'project', delivery: 'default', addressedTo: 'chief-of-staff' }, 0),
  );

  for (const [label, code] of [['#department', dispatch], ['the bare address', bare]] as const) {
    assert.equal(
      code,
      'thread_not_addressable',
      `${label} resolved — resolveAddress found it and counted its members, which is how ` +
        'memberCount reached the call. Refusing it with `address_unresolved` names a ' +
        'condition that did not happen and sends the next debugger to the parser.',
    );
  }

  // The other side, from both directions: the genuinely-absent department still gets the
  // parser-shaped code, and the two carry different statuses, so the discriminator survives
  // a client that only looks at HTTP.
  const absent = await withLibrary(async (config, project) => {
    try {
      await resolveAddress(config, project, { form: 'dispatch', department: 'not-a-department' });
      return undefined;
    } catch (err) {
      return (err as { code?: string }).code;
    }
  });
  assert.equal(absent, 'address_unresolved', 'a department this project does not have is still unresolved');
  assert.notEqual(absent, dispatch, 'two facts, two codes — this is the whole finding');
  assert.equal(API_ERROR_STATUS.thread_not_addressable, 409);
  assert.equal(API_ERROR_STATUS.address_unresolved, 422);

  // And the boundary: the refusals that were already right are untouched. `@@` still throws
  // its own code and `@department/agent` still throws nothing at all — a gate that turned
  // every address into one refusal would satisfy the assertions above and destroy the route.
  assert.equal(
    codeOf(() => assertRunnable({ kind: 'department', delivery: 'fan-out', addressedTo: 'sales' }, 4)),
    'fanout_dispatch_refused',
  );
  assert.equal(
    codeOf(() => assertRunnable({ kind: 'agent', delivery: 'direct', addressedTo: 'sales/probe' }, 0)),
    undefined,
    'the one form that runs is still allowed to run',
  );
});

test('the hint still names what would unblock each refusal', async () => {
  // The code changed; the sentence a human reads on a phone must not have been lost with it.
  const hint = (fn: () => unknown): string => {
    try {
      fn();
      return '';
    } catch (err) {
      return String((err as { hint?: string }).hint ?? '');
    }
  };

  assert.match(hint(() => assertRunnable({ kind: 'department', delivery: 'dispatch', addressedTo: 'sales' }, 2)), /lead/i);
  assert.match(hint(() => assertRunnable({ kind: 'project', delivery: 'default', addressedTo: 'chief-of-staff' }, 0)), /M22/);
});
