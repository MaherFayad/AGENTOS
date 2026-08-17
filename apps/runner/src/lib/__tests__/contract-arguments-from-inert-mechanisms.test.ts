/**
 * **A contract may not argue from a mechanism that does not run on the only stack that exists.**
 *
 * ## The defect this exists because of
 *
 * `comms/contracts/thread-model.md` §4.1 gave two reasons for spelling the route
 * `POST /api/p/:project/thread/:id/message`. The conclusion was right and remains right. The
 * *second reason* said that deriving the project from the thread row was impossible because an
 * unscoped read of `ops.thread` **raises** `project_scope_missing` under `0005`'s row-level
 * security.
 *
 * On this stack that read would have succeeded. Compose's Postgres user is a superuser, a
 * superuser bypasses RLS unconditionally, and `GET /api/status` reports exactly that as
 * `projects.scopeEnforcement: "bypassed"`. Two artifacts in the repo already knew —
 * `db/migrations/0008_threads.sql:453` says the hole exists and names the status field, and
 * `db/thread-reads.ts:23` scopes its predicate *because* the policy is inert, not in addition to
 * it. The contract was the one artifact of the three that read as though a policy enforced
 * something.
 *
 * That is the house defect — **a declared value read as an observed one** — in the place it does
 * the most damage. A checker's wrong answer is a number someone can re-derive. A contract is what
 * the next six agents read *instead of* the code, and ten M16 slices are held on this document
 * precisely so they read one shape.
 *
 * ## What is and is not in scope, and why the line is where it is
 *
 * The test is **not** "has the migration run" — nothing in `0005`–`0008` has ever met a live
 * Postgres, and `thread-model.md` §8 states that for every mechanism at once. The needle here is
 * narrower and role-shaped: **is this mechanism bypassed by the role we connect as?**
 *
 *   - `NOT NULL`, `CHECK`, `UNIQUE`, `FOREIGN KEY` — enforced for every role including a
 *     superuser. A conclusion may rest on them. Deliberately not flagged; a scanner that caught
 *     `message_never_holds_session_content` would be a scanner someone disables.
 *   - `ENABLE`/`FORCE ROW LEVEL SECURITY`, `CREATE POLICY`, `ops.project_visible()`,
 *     `project_scope_missing` — bypassed by a superuser. `FORCE` binds the table *owner*, which
 *     is not the same thing. These may be cited; they may not be argued from.
 *
 * ## Scope, and what this instrument cannot see
 *
 * It reads **one file**: `comms/contracts/thread-model.md`, owned by `thread-model-engineer`.
 * Widening it to `comms/contracts/` would turn other agents' files red from this one's diff,
 * which is a decision for those owners — offered to them by message, not taken here.
 *
 * Three further blind spots, written down because the instrument that goes blind silently is the
 * one this repo keeps finding:
 *
 *   1. It matches **words**, so it cannot tell a hedge that is true from one that is merely
 *      present. Writing "inert" beside a live mechanism passes.
 *   2. The window is **one line**. A hedge two lines below a claim does not count, on purpose: a
 *      reader who greps `RLS` is handed one line and must be able to believe it. If a reflow
 *      turns this red, move the marker onto the line — do not widen the window.
 *   3. It says nothing about the *code*. That RLS is inert is asserted here as documentation
 *      hygiene; the empirical claim is `infra-compose-engineer`'s non-superuser role, and until
 *      that lands `thread-model.md` §8 is where the honest answer lives.
 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..', '..', '..');
const CONTRACT = join(ROOT, 'comms', 'contracts', 'thread-model.md');

/**
 * The mechanisms a superuser bypasses. Every alternative is a *name* rather than a concept, so a
 * future author who invents a new policy name is not caught — which is why `CREATE POLICY` and
 * `ops.project_visible` are here alongside the two policy names that exist.
 */
const INERT_MECHANISM =
  /\bRLS\b|row[- ]level[- ]security|CREATE POLICY|project_visible|project_scope_missing|thread_project_scope|message_project_scope/i;

/**
 * The vocabulary this repo already uses for "declared, not observed" — §8's *structural*,
 * `0008:453`'s *inert*, `identity.md`'s *declared, not enforced*, `GET /api/status`'s *bypassed*.
 *
 * A gate narrower than the vocabulary its authors must use will silently edit them (BOARD: the
 * coverage gate rejected `Plan §n` and two agents rewrote their citations to pass). So this
 * accepts all four spellings rather than mandating one.
 */
const MARKED_AS_NOT_ENFORCED_HERE = /\binert\b|\bbypass|not enforced|\bdeclared\b|\bstructural\b|\bdormant\b|\bfuture work\b/i;

test('thread-model.md never argues from a mechanism a superuser bypasses', async () => {
  const text = await readFile(CONTRACT, 'utf8');

  // A scan over a file that failed to load finds nothing and reads as success — the vacuity
  // failure this repo has now found in three separate checkers.
  const lines = text.split(/\r?\n/);
  assert.ok(
    lines.length > 300,
    `only ${lines.length} lines read from thread-model.md — the path is wrong and this test would pass by having nothing to read`,
  );

  const offenders: string[] = [];
  let mentions = 0;

  for (const [index, line] of lines.entries()) {
    if (!INERT_MECHANISM.test(line)) continue;
    mentions += 1;
    if (MARKED_AS_NOT_ENFORCED_HERE.test(line)) continue;
    offenders.push(`thread-model.md:${index + 1}: ${line.trim()}`);
  }

  assert.ok(
    mentions > 0,
    'the needle matched nothing in thread-model.md. Either the contract stopped mentioning RLS ' +
      'entirely — in which case delete this assertion in the same diff — or INERT_MECHANISM has ' +
      'rotted and the scan is blind.',
  );

  assert.deepEqual(
    offenders,
    [],
    'Row-level security is INERT on this stack: compose\'s Postgres user is a superuser, a ' +
      'superuser bypasses RLS unconditionally (FORCE binds the table owner, not a superuser), and ' +
      'GET /api/status reports projects.scopeEnforcement: "bypassed". A contract argument resting ' +
      'on a mechanism that does not run on the only stack that exists is a declared value read as ' +
      'an observed one — thread-model.md §8b. Cite the policy if you like, but say on the same ' +
      'line that it is inert / bypassed / declared / structural, or rest the conclusion on ' +
      'something that runs (§4.1 reason 2 is the worked example).' +
      `\n\n${offenders.join('\n')}`,
  );
});

test('the scanner would catch it — falsified against the sentence that was actually there', () => {
  // A test that has never been red proves nothing. This is §4.1's removed second reason,
  // verbatim, and the paragraph that replaced it.
  const removed =
    'Deriving the project *from the thread row* would require reading `ops.thread` with no ' +
    'project in scope — which, by migration 0005 §5, **raises** `project_scope_missing` by design.';
  const replacement =
    'An unscoped read of `ops.thread` **raises** — `project_scope_missing`, **inert**, by ' +
    'migration 0005 §5; dead on the only stack that exists.';

  assert.equal(INERT_MECHANISM.test(removed), true, 'the removed sentence must be detected');
  assert.equal(
    MARKED_AS_NOT_ENFORCED_HERE.test(removed),
    false,
    'the removed sentence carried no marker — that was the whole defect',
  );
  assert.equal(INERT_MECHANISM.test(replacement) && MARKED_AS_NOT_ENFORCED_HERE.test(replacement), true);

  // And the boundary: constraints a superuser does NOT bypass are deliberately untouched, so
  // this gate can never be the reason someone weakens a real defence.
  assert.equal(INERT_MECHANISM.test("`message_never_holds_session_content` CHECK (thread_kind <> 'session')"), false);
  assert.equal(INERT_MECHANISM.test('composite FK to `ops.thread (id, project_id, kind)`'), false);
  assert.equal(INERT_MECHANISM.test('`project_id` is `NOT NULL` from the migration that creates it'), false);

  // `project_id` alone is not the needle — only the policy machinery is. Otherwise every mention
  // of the axis would demand a hedge and the gate would be turned off within a week.
  assert.equal(INERT_MECHANISM.test('every read function takes a `projectId` and puts it in the `WHERE`'), false);
});
