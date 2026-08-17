/**
 * The addressing grammar, its refusals, and the SQL it has to keep agreeing with.
 *
 * ADR-023 / `comms/contracts/thread-model.md`, `AGENTOS-V2-PLAN.md` Plan §12.
 *
 * ## Why the grammar gets a test suite of its own
 *
 * `Plan §12`, quoted because paraphrase loses it:
 *
 *   > "`#sales` and `@@sales` must be different characters and must **look** different, because
 *   > one costs one run and the other costs six. A UI that makes broadcast easy to trigger
 *   > accidentally will cost real money on the first day."
 *
 * Everything below is downstream of that sentence. A parser that resolves an ambiguous
 * `@account-enrichment` by picking the first match, a preview that prints a plausible dollar
 * figure, a `steer` that gets quietly queued as a note — each is a small convenience, and each
 * one either spends money the human did not authorise or tells them something happened that
 * did not.
 *
 * ## The half this cannot prove, said before anyone quotes it
 *
 * Every assertion here is structural. **No thread has ever been created, no message has ever
 * been delivered and no run has ever executed** — `RUNNER_ANTHROPIC_API_KEY` is unset. This
 * suite proves the grammar parses, the refusals refuse, the preview refuses to invent a
 * number, and the TypeScript agrees with the SQL. It proves nothing about whether a `steer`
 * reaches a running agent, because nothing has ever run.
 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ADDRESS_SEGMENT_RE,
  addressCost,
  assertFanOutDispatchable,
  assertThreadTransition,
  canonicalAddressedTo,
  DEFAULT_RECIPIENT,
  DELIVERY_KIND,
  FAN_OUT_DISPATCH,
  formatThreadAddress,
  INTERRUPT_LEVELS,
  MESSAGE_KINDS,
  messageCarriesInterrupt,
  messageRequiresExpiry,
  messageSpanAttributes,
  parseThreadAddress,
  THREAD_DELIVERIES,
  THREAD_KINDS,
  THREAD_STATES,
  threadKindFor,
  threadTransitionAllowed,
  type ResolvedThreadAddress,
  type ThreadMessage,
} from '@agnetos/contracts';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATION = join(HERE, '..', '..', 'db', 'migrations', '0008_threads.sql');
const readMigration = (): Promise<string> => readFile(MIGRATION, 'utf8');

/* -------------------------------------------------------------------------- *
 * 1. The four forms
 * -------------------------------------------------------------------------- */

test('every form in Plan §12 parses to the address it names', () => {
  const cases: Array<[string, ReturnType<typeof parseThreadAddress>]> = [
    [
      '@sales/account-enrichment enrich ACME',
      { ok: true, address: { form: 'direct', department: 'sales', slug: 'account-enrichment' }, body: 'enrich ACME' },
    ],
    [
      '@account-enrichment enrich ACME',
      { ok: true, address: { form: 'direct', department: null, slug: 'account-enrichment' }, body: 'enrich ACME' },
    ],
    ['#sales who owns ACME?', { ok: true, address: { form: 'dispatch', department: 'sales' }, body: 'who owns ACME?' }],
    ['@@sales review this', { ok: true, address: { form: 'fan-out', department: 'sales' }, body: 'review this' }],
    ['what happened overnight?', { ok: true, address: { form: 'default' }, body: 'what happened overnight?' }],
  ];

  for (const [input, expected] of cases) {
    assert.deepEqual(parseThreadAddress(input), expected, input);
  }
});

test('# and @@ are different characters and produce different rows', () => {
  const dispatch = parseThreadAddress('#sales x');
  const fanOut = parseThreadAddress('@@sales x');
  assert.ok(dispatch.ok && fanOut.ok);

  // Same department, same kind — and the plan's whole point is that they are not the same
  // thing. If `delivery` were ever dropped from `ops.thread`, these two rows would become
  // byte-identical and the schema would have lost the difference between one run and six.
  assert.equal(threadKindFor(dispatch.address), threadKindFor(fanOut.address));
  assert.notEqual(dispatch.address.form, fanOut.address.form);
  assert.notEqual(formatThreadAddress(dispatch.address), formatThreadAddress(fanOut.address));
  assert.equal(DELIVERY_KIND[dispatch.address.form], 'department');
  assert.equal(DELIVERY_KIND[fanOut.address.form], 'department');
});

test('formatting is the inverse of parsing, for every form a person can type', () => {
  for (const typed of ['@sales/account-enrichment', '@account-enrichment', '#sales', '@@sales']) {
    const parsed = parseThreadAddress(typed);
    assert.ok(parsed.ok, typed);
    assert.equal(formatThreadAddress(parsed.address), typed);
  }
  // The bare address is what a person types by typing nothing. A *label* for it is copy, and
  // copy belongs in the RTL catalogue, not in a contract module.
  assert.equal(formatThreadAddress({ form: 'default' }), '');
});

/* -------------------------------------------------------------------------- *
 * 2. The refusals — every one, by code
 * -------------------------------------------------------------------------- */

test('every refusal has its own code, and none of them is silence', () => {
  const cases: Array<[string, string]> = [
    ['&sales hello', 'unknown_sigil'],
    ['!sales hello', 'unknown_sigil'],
    ['@', 'empty_address'],
    ['# hello', 'empty_address'],
    ['@@ hello', 'empty_address'],
    ['@Sales/Account', 'malformed_address'],
    ['@sales/', 'malformed_address'],
    ['@a/b/c', 'malformed_address'],
    ['@sales//x', 'malformed_address'],
    ['#sales/account-enrichment', 'dispatch_needs_department'],
    ['@@sales/account-enrichment', 'fanout_needs_department'],
  ];

  for (const [input, code] of cases) {
    const parsed = parseThreadAddress(input);
    assert.equal(parsed.ok, false, `${input} must be refused`);
    if (parsed.ok) continue;
    assert.equal(parsed.refusal.code, code, input);
    assert.ok(parsed.refusal.hint.length > 0, `${input} refused with no hint`);
    // `api-contracts.md`: a hint is written to the person, usually on a phone, mid-task.
    assert.ok(!/undefined|\[object|Error:/.test(parsed.refusal.hint), input);
  }
});

test('a look-alike sigil is refused rather than swallowed as body text', () => {
  // The dangerous version of this is not a crash. `&sales hello` treated as a bare message is
  // delivered to the Chief of Staff while the human believes it went to Sales — a wrong
  // recipient with no error, which is the bug class Plan §21.9 names.
  const parsed = parseThreadAddress('&sales hello');
  assert.equal(parsed.ok, false);
});

test('an agent slug with no department is parsed, never guessed', () => {
  const parsed = parseThreadAddress('@account-enrichment go');
  assert.ok(parsed.ok);
  assert.equal(parsed.address.form, 'direct');
  assert.equal(parsed.address.form === 'direct' && parsed.address.department, null);
  // Resolution against a project's roster is what turns `null` into a department, and it is
  // allowed to refuse with `address_ambiguous`. The parser does not get to pick, because
  // picking here runs an agent the human did not mean, silently.
});

test('the grammar validates shape and never consults the department list', () => {
  // `Plan §10` says seven departments in one sentence and an eighth in the next, and BOARD
  // forbids baking `7` into anything project-shaped. A department that does not exist is a
  // *resolution* refusal, in a project, not a grammar error.
  const parsed = parseThreadAddress('#engineering ship it');
  assert.ok(parsed.ok, 'a department the taxonomy has not adopted yet still parses');
  const invented = parseThreadAddress('#not-a-real-department hello');
  assert.ok(invented.ok);
});

/* -------------------------------------------------------------------------- *
 * 3. Cost — the count is real, the money is not
 * -------------------------------------------------------------------------- */

test('a fan-out preview prints a real count and refuses to invent a price', () => {
  const preview = addressCost({ form: 'fan-out', department: 'sales' }, 4);
  assert.equal(preview.runs, 4, 'the resolved member count is knowable exactly');
  assert.equal(preview.runsAreExact, true);
  // `Plan §23.8` asks the composer to say `@@sales · 4 runs · ~$0.40`. There are no completed
  // runs to average, so the `$0.40` has no source. BOARD rule 9 in the one direction it never
  // permits — and a cost preview is precisely where a plausible number gets believed.
  assert.equal(preview.estimatedUsd, null);
  assert.equal(preview.estimateBasis, 'no-completed-runs');
});

test('`#sales says 1 run` is a lower bound, and the type says so', () => {
  const dispatch = addressCost({ form: 'dispatch', department: 'sales' }, 0);
  assert.equal(dispatch.runs, 1);
  // The lead answers *or delegates*, and a delegation is a second run. Printing a flat "1 run"
  // beside a mechanism that routinely costs two is a plausible number one decimal place up.
  assert.equal(dispatch.runsAreExact, false);

  assert.equal(addressCost({ form: 'direct', department: 'sales', slug: 'x' }, 0).runsAreExact, true);
  assert.equal(addressCost({ form: 'default' }, 0).runsAreExact, false);
});

test('a fan-out cost cannot be obtained without naming a count', () => {
  // The defect this replaced: `memberCount` defaulted to `0`, so a caller that forgot the
  // argument got `{ runs: 0, runsAreExact: true }` — an *exact zero* manufactured out of an
  // omission, on the one figure `Plan §23.8` requires to be real. Raised by
  // `design-system-guardian` while building `AddressBadge`; fixed in the signature rather than
  // in the badge, because a default is available to every caller and a badge protects one.
  //
  // Never invoked — the assertion is that it does not *compile*. A missing argument is not a
  // runtime error in JavaScript; it would quietly produce `runs: undefined`, which is why this
  // has to be caught by `tsc` and not by `assert.throws`.
  // @ts-expect-error — the count is required. If this line ever compiles, the default is back and `addressCost(@@sales)` can claim "exactly 0 runs" again.
  const withoutACount = () => addressCost({ form: 'fan-out', department: 'sales' });
  assert.equal(typeof withoutACount, 'function', 'declared to be type-checked, deliberately not called');

  // A *measured* zero is still legal and still exact — a department that resolved and has no
  // members. The two states are now distinguishable at the call site, which was the point.
  const empty = addressCost({ form: 'fan-out', department: 'sales' }, 0);
  assert.equal(empty.runs, 0);
  assert.equal(empty.runsAreExact, true);
});

test('fan-out dispatch is refused, and the refusal names the cap that has never fired', () => {
  assert.equal(FAN_OUT_DISPATCH.allowed, false);
  assert.equal(FAN_OUT_DISPATCH.enforcementProven, false, 'zero runs have executed; nothing has ever been refused');
  assert.throws(
    () => assertFanOutDispatchable(6),
    (error: unknown) => {
      const e = error as Error & { code?: string; hint?: string };
      assert.equal(e.code, 'fanout_dispatch_refused');
      assert.match(e.message, /6 runs/, 'the count the human would have spent is in the message');
      assert.match(String(e.hint), /RUNNER_ANTHROPIC_API_KEY/, 'and what would unblock it');
      return true;
    },
  );
});

/* -------------------------------------------------------------------------- *
 * 4. Messages, interrupts, and the PII projection
 * -------------------------------------------------------------------------- */

test('interrupt levels and expiry are equalities, not conventions', () => {
  assert.deepEqual([...INTERRUPT_LEVELS], ['note', 'steer', 'halt']);
  assert.equal(messageCarriesInterrupt('human'), true);
  assert.equal(messageCarriesInterrupt('answer'), true);
  assert.equal(messageCarriesInterrupt('agent'), false);
  assert.equal(messageCarriesInterrupt('question'), false);
  assert.equal(messageCarriesInterrupt('system'), false);

  // `expires_at` stays mandatory on a question (Plan §12). A run blocked forever on a question
  // nobody saw looks idle, holds a slot, and delivers nothing.
  assert.deepEqual(MESSAGE_KINDS.filter(messageRequiresExpiry), ['question']);
});

test('a message body cannot reach a span — there is no field to put it in', () => {
  const body = 'Fatima Al-Harbi, 12 King Fahd Road, Riyadh — salary 45000 SAR';
  const message: ThreadMessage = {
    id: 'm1',
    threadId: 't1',
    projectId: 'p1',
    seq: 1,
    kind: 'human',
    interrupt: 'note',
    author: 'human:owner',
    body,
    payload: { client_name: 'Fatima Al-Harbi', salary: 45000 },
    inReplyTo: null,
    expiresAt: null,
    deliveredAt: null,
    createdAt: '2026-08-17T00:00:00.000Z',
  };

  const attributes = messageSpanAttributes(message);

  // The whole serialised object, scanned. Not "the body field is absent" — every value, so
  // that a future field carrying the body under another name fails here too.
  const serialised = JSON.stringify(attributes);
  assert.equal(serialised.includes('Fatima'), false, 'no fragment of the body reaches a span');
  assert.equal(serialised.includes('King Fahd'), false);
  assert.equal(serialised.includes('45000'), false, 'nor of the payload');
  assert.equal(attributes.bodyChars, body.length, 'a length is not content, and it is the honest signal');
  assert.equal(attributes.payloadKeys, 2);

  // The control: the scan above would pass on an empty object too.
  assert.equal(attributes.messageId, 'm1');
  assert.equal(attributes.kind, 'human');
});

/* -------------------------------------------------------------------------- *
 * 5. The state machine
 * -------------------------------------------------------------------------- */

test('closed is the only terminal state, and failed is not one', () => {
  assert.deepEqual([...THREAD_STATES], ['open', 'running', 'waiting', 'closed', 'failed']);

  // Plan §12: continuing a thread starts a new run seeded with the thread's history. A
  // terminal `failed` would force every retry to be a new thread and throw away the history
  // that made the retry worth doing.
  assert.equal(threadTransitionAllowed('failed', 'open'), true);
  assert.equal(threadTransitionAllowed('waiting', 'failed'), true, 'the question-expiry path');
  assert.equal(threadTransitionAllowed('closed', 'open'), false);
  assert.equal(threadTransitionAllowed('closed', 'running'), false);

  assert.throws(() => assertThreadTransition('closed', 'open'), (error: unknown) => {
    const e = error as Error & { code?: string };
    assert.equal(e.code, 'thread_transition_refused');
    assert.match(e.message, /closed is terminal/);
    return true;
  });
});

/* -------------------------------------------------------------------------- *
 * 6. The TypeScript and the SQL, asserted against each other
 * -------------------------------------------------------------------------- */

/**
 * The `project-id.test.ts` pattern, applied to an enum instead of a hash.
 *
 * Two implementations of one rule is how a constraint silently stops meaning what a validator
 * thinks it means. Here the failure would be quiet in the worst way: a value the TypeScript
 * happily produces and Postgres rejects only at insert time — i.e. after the run, on the
 * first real use, in a table nothing had written to before.
 */
test('every enum in threads.ts is the enum in 0008_threads.sql', async () => {
  const sql = await readMigration();

  const inList = (constraint: string, column: string): string[] => {
    const match = new RegExp(`${constraint}[\\s\\S]{0,120}?${column} IN \\(([^)]*)\\)`).exec(sql);
    assert.ok(match, `${constraint} not found in the migration`);
    return match[1].split(',').map((v) => v.trim().replace(/^'|'$/g, ''));
  };

  assert.deepEqual(inList('thread_kind_known', 'kind'), [...THREAD_KINDS]);
  assert.deepEqual(inList('thread_delivery_known', 'delivery'), [...THREAD_DELIVERIES]);
  assert.deepEqual(inList('thread_state_known', 'state'), [...THREAD_STATES]);
  assert.deepEqual(inList('message_kind_known', 'kind'), [...MESSAGE_KINDS]);
  assert.deepEqual(inList('message_interrupt_known', 'interrupt'), [...INTERRUPT_LEVELS]);

  // Every (delivery, kind) pair DELIVERY_KIND declares appears in the CHECK that pins them.
  for (const [delivery, kind] of Object.entries(DELIVERY_KIND)) {
    assert.ok(
      sql.includes(`delivery = '${delivery}'`) && sql.includes(`kind = '${kind}'`),
      `thread_delivery_matches_kind is missing ${delivery} → ${kind}`,
    );
  }

  // The address segment shape. SQL regexes have no non-capturing group, so `(?:` normalises to
  // `(` — the one difference, written out rather than left for a reader to wonder about.
  const segment = ADDRESS_SEGMENT_RE.source.replace(/\(\?:/g, '(');
  assert.ok(
    sql.includes(`addressed_to ~ '${segment}'`),
    `thread_addressed_to_shape must use ${segment} for a department, verbatim`,
  );

  // The bare address's canonical target.
  assert.ok(sql.includes(`addressed_to = '${DEFAULT_RECIPIENT}'`), 'the project default recipient');
  assert.equal(canonicalAddressedTo({ form: 'default' }), DEFAULT_RECIPIENT);

  const direct: ResolvedThreadAddress = { form: 'direct', department: 'sales', slug: 'account-enrichment' };
  assert.equal(canonicalAddressedTo(direct), 'sales/account-enrichment', 'project-relative: the project is its own column');
  assert.equal(canonicalAddressedTo({ form: 'fan-out', department: 'sales' }), 'sales');
});

test('the mandatory-expiry and no-session-content rules are CHECK constraints, not comments', async () => {
  const sql = await readMigration();

  // A comment is not a mechanism. Each of these is asserted as text in the migration because
  // the alternative — trusting the prose above it — is what `identity-model.test.mjs` exists
  // to refuse one table over.
  assert.match(sql, /CONSTRAINT message_question_expires[\s\S]{0,80}kind = 'question'\) = \(expires_at IS NOT NULL\)/);
  assert.match(sql, /CONSTRAINT message_never_holds_session_content[\s\S]{0,40}thread_kind <> 'session'/);
  assert.match(sql, /CONSTRAINT message_interrupt_matches_kind/);
  assert.match(sql, /CONSTRAINT message_answer_replies/);
  assert.match(sql, /CONSTRAINT thread_parent_is_not_self/);

  // Both new tables are behind the project predicate that *raises* rather than returning zero
  // rows (`project-scoping.md` invariant 8).
  for (const table of ['ops.thread', 'ops.message']) {
    assert.ok(sql.includes(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`), `${table} forces RLS`);
  }
  assert.match(sql, /CREATE POLICY thread_project_scope[\s\S]{0,160}ops\.project_visible\(project_id\)/);
  assert.match(sql, /CREATE POLICY message_project_scope[\s\S]{0,160}ops\.project_visible\(project_id\)/);
});

/**
 * M11 is **absorbed, not built** (`Plan §19`). Asserted rather than commented, because the
 * temptation is specifically to create these two tables while building the thing that replaces
 * them, and a comment saying "do not" is read after the file is written.
 */
test('no migration creates ops.task or ops.question', async () => {
  const { readdir } = await import('node:fs/promises');
  const dir = join(HERE, '..', '..', 'db', 'migrations');
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql'));
  assert.ok(files.length >= 8, `only ${files.length} migrations found — the scan is not seeing the directory`);

  for (const file of files) {
    const sql = (await readFile(join(dir, file), 'utf8')).replace(/--[^\n]*/g, '');
    for (const table of ['ops.task', 'ops.question']) {
      assert.equal(
        new RegExp(`CREATE\\s+TABLE\\s+(IF\\s+NOT\\s+EXISTS\\s+)?${table.replace('.', '\\.')}\\b`, 'i').test(sql),
        false,
        `${file} creates ${table}. A task is a thread with a due date; a question is a message kind (Plan §19).`,
      );
    }
  }
});

/**
 * **No migration may contain the two characters that close a C-style block comment.**
 *
 * Not a style rule — a live trap, found by walking into it. `0005` line 448 carries
 * `/api/all/` + star inside a `--` comment, which is an *opening* pair. Several checkers strip
 * block comments across the **joined** text of every migration and do so **before** stripping
 * line comments, so the first closing pair anywhere after it deletes every intervening file
 * from that checker's view. Writing the department/agent separator in the ordinary way put one
 * in `0008`, and `scripts/__tests__/identity-model.test.mjs` went red about
 * `INSERT INTO ops.identity` — a table `0008` does not touch. The first written explanation of
 * the bug re-armed it, because the explanation contained the pair.
 *
 * It failed loudly here. It does not always: a swallowed `CREATE TABLE` body makes a
 * *"this column must not exist"* assertion pass for the wrong reason, which is the permissive
 * direction. Postgres has no use for block comments in these files, so forbidding the pair
 * costs nothing and removes the class.
 *
 * Owner of the underlying fix: `identity-access-engineer` (`identity-model.test.mjs`). This
 * assertion is the cheap guard, not the fix.
 */
test('no migration contains a block-comment token that could blind a corpus-wide checker', async () => {
  const { readdir } = await import('node:fs/promises');
  const dir = join(HERE, '..', '..', 'db', 'migrations');
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql'));

  // Assembled, so this file does not contain the sequence it forbids — the mistake that made
  // the first fix fail.
  const CLOSE = '*' + '/';
  const offenders: string[] = [];

  for (const file of files) {
    for (const [index, line] of (await readFile(join(dir, file), 'utf8')).split(/\r?\n/).entries()) {
      if (line.includes(CLOSE)) offenders.push(`${file}:${index + 1}`);
    }
  }

  assert.deepEqual(
    offenders,
    [],
    'A migration contains a block-comment closing pair. Somewhere earlier in the corpus there ' +
      'is an opening one inside prose, and a checker that strips block comments across the ' +
      'joined text will silently delete everything between them. Write the character class ' +
      `form instead.\n\n${offenders.join('\n')}`,
  );

  // Falsification: the scan is a substring test over real lines, and it does find things.
  assert.ok(files.some((f) => f.startsWith('0008')), 'the directory being scanned is the real one');
});

/* -------------------------------------------------------------------------- *
 * 9. thread-model.md §9.5 is a *self-expiring* OPEN, not an indefinite one
 * -------------------------------------------------------------------------- */

/**
 * **Does a fan-out parent thread hold its own transcript?** — `thread-model.md` §9.5, owned by
 * `thread-model-engineer`, deferred rather than guessed.
 *
 * Reviewed 2026-08-18 with the composer about to be built, because "deferred" is a claim that
 * decays and this is the moment it would have started costing something. **It still holds, and
 * the reason is mechanical rather than a preference:** `assertFanOutDispatchable` returns
 * `never`, so no code path in this repo can create a fan-out parent thread or a single child. A
 * question about what rows a parent holds cannot be answered wrongly by a caller that cannot
 * make a parent, and cannot be answered *rightly* by designing a mirror against a renderer that
 * does not exist — that produces a plausible spec, which is this board's most-repeated defect
 * wearing a schema.
 *
 * The composer specifically does **not** depend on it. It parses, previews the count, and hits
 * the refusal; §6.1 ships grammar, parser, composer and preview, and holds only the spending.
 * Both shapes still fit `0008` unchanged, so nothing in §5 is waiting either.
 *
 * What makes this a decision rather than a deferral is that it **expires by itself**, below.
 */
test('§9.5 may stay OPEN only while fan-out cannot dispatch', async () => {
  // @ts-expect-error — `FAN_OUT_DISPATCH.allowed` is typed `false`, so this assignment does not
  // compile today and the suppression is load-bearing. The day fan-out is allowed to spend, the
  // assignment starts compiling, this suppression becomes unused, and `tsc` fails *here* — in
  // the same diff that flips the flag, pointing at the question that diff has to answer:
  // **thread-model.md §9.5, does the parent hold its own transcript.** That is the forcing
  // function; the paragraph above is only the reasoning.
  const fanOutWouldDispatch: true = FAN_OUT_DISPATCH.allowed;
  assert.equal(
    fanOutWouldDispatch,
    false,
    'fan-out dispatch is refused in M16 (thread-model.md §6.1), which is what licenses §9.5 to stay open',
  );

  // And the refusal is a `never`, not a flag someone reads: there is no reachable path that
  // creates a fan-out parent, so no consumer can have guessed an answer to §9.5 by now.
  assert.throws(
    () => assertFanOutDispatchable(4),
    (error: unknown) => (error as { code?: string }).code === 'fanout_dispatch_refused',
    'if this stops throwing, §9.5 is on the critical path and must be answered before the parent is written',
  );

  // The linkage is greppable from the contract too, so the flag and the question find each
  // other from either end rather than only from this file.
  const contract = await readFile(join(HERE, '..', '..', '..', '..', '..', 'comms', 'contracts', 'thread-model.md'), 'utf8');
  const section = contract.split('### 9.5')[1]?.split('### 9.6')[0] ?? '';
  assert.ok(section.length > 200, '§9.5 was not found in thread-model.md — this assertion would pass vacuously');
  assert.match(
    section,
    /FAN_OUT_DISPATCH/,
    '§9.5 must name FAN_OUT_DISPATCH as the condition that ends its deferral. An OPEN question ' +
      'with no expiry condition is an indefinite one, and the next reader cannot tell the ' +
      'difference between deferred and forgotten.',
  );
});
