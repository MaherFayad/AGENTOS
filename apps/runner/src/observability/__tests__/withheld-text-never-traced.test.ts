/**
 * PDPL gate — an error string is a door, and this is the mechanism that shuts it
 * (Part VII.4, `contracts/thread-model.md` §7.1–§7.2, §9.3).
 *
 * Owner: `observability-engineer`. Sibling of `message-body-never-traced.test.ts`, which is
 * `rtl-arabic-pdpl-specialist`'s and stays exactly as written — **its last test is still
 * true**, and that is deliberate. That test drives a body into an error string on a run that
 * was never told the body existed; nothing here changes that case, because nothing can infer
 * it. What this file gates is the case where the run *was* told, by either of the two routes
 * that tell it.
 *
 * ## The three states, kept apart on purpose
 *
 * | The run learned the body… | Error string carrying it |
 * |---|---|
 * | via a denylisted key in any payload (`{ body }`, `body: …` in prose) | **scrubbed** — automatic, no call site |
 * | via `trace.withhold(body)` | **scrubbed** |
 * | never | **leaks** — asserted in the sibling file, still open, still stated |
 *
 * Writing the third row as a passing assertion rather than a TODO is the point. An erasure
 * or redaction surface that looks complete is worse than one that names its own limit.
 *
 * **Structural, not empirical.** Zero runs have executed; no span has ever been shipped to a
 * Langfuse. What is observed here is the payload this process builds at the boundary where
 * redaction is required to run.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createInstrumentation } from '../instrument.ts';
import { redact, refreshEnvSecrets } from '../redact.ts';
import { createWithheld, MAX_LITERALS, MAX_WITHHELD_CHARS, MIN_LITERAL, WINDOW } from '../withhold.ts';
import type { RunRecord, ToolCallRecord } from '../types.ts';

/** The sibling gate's body, character for character, so the two files cannot drift apart. */
const BODY = 'Chase Fatima Al-Harbi about the Olaya lease — she wants to move in March.';

const FRAGMENTS = ['Fatima', 'Al-Harbi', 'Olaya', 'lease', 'move in March'];

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const THREAD = '3f2a1c40-9d6b-4a21-8f0e-77c9b1d25e83';

function harness() {
  const sent: unknown[] = [];
  const runs: RunRecord[] = [];
  const tools: ToolCallRecord[] = [];
  let tick = 0;
  const obs = createInstrumentation({
    sink: {
      async send(payload) {
        sent.push(payload);
      },
      urlFor: (id) => `http://langfuse.tailnet:3000/project/local/traces/${id}`,
    },
    ledger: {
      async recordRun(run, calls) {
        runs.push(run);
        tools.push(...calls);
      },
    },
    now: () => new Date(1_770_000_000_000 + tick++ * 1000),
  });
  return { obs, sent, runs, tools };
}

const begin = (obs: ReturnType<typeof harness>['obs'], inputs?: Record<string, unknown>) =>
  obs.startRun({
    projectId: PROJECT_ID,
    agentRef: 'agnetos/operations/follow-up-coordinator',
    sourceRef: 'project:agents/operations/follow-up-coordinator/SKILL.md@sha256:abc',
    agent: 'operations/follow-up-coordinator',
    department: 'operations',
    trigger: 'manual',
    threadId: THREAD,
    inputs,
  });

function assertNoFragment(serialised: string, where: string): void {
  for (const fragment of FRAGMENTS) {
    assert.equal(
      serialised.includes(fragment),
      false,
      `"${fragment}" of a withheld literal reached ${where}. The run's withheld register is ` +
        'the only pass that survives interpolation — if this is red, either the register was ' +
        'not threaded into that redact() call or a string reached the sink without one.',
    );
  }
}

/* -------------------------------------------------------------------------- *
 * 1. The door that had no lock: an error string
 * -------------------------------------------------------------------------- */

test('withheld text is scrubbed from a tool error and from the run outcome error', async () => {
  refreshEnvSecrets({});
  const { obs, sent, runs, tools } = harness();

  const trace = begin(obs);
  trace.withhold(BODY);

  // The realistic sentence, from the sibling gate's own note: a halt reason with no reason
  // in it is useless in a trace, so an author interpolates the body. Both string doors.
  trace.tool('mailbox.peek').error(`halted: ${BODY}`);
  await trace.finish({ status: 'error', error: `halted by human:maher — ${BODY}` });

  assertNoFragment(JSON.stringify(sent), 'the emitted OTLP payload');
  assertNoFragment(JSON.stringify(runs), 'the ledger record (ops.agent_runs)');
  assertNoFragment(JSON.stringify(tools), 'the tool-call rows (ops.agent_run_tools)');

  // Redacted, not dropped, and not the whole string: the operator still learns that a halt
  // happened and that text was removed. A pass that replaced the entire error message would
  // trade a leak for an outage in the only field that explains a failed run.
  const serialised = JSON.stringify(sent);
  assert.match(serialised, /halted: \[REDACTED:withheld\]/, 'the prefix survives the scrub');
  assert.match(serialised, /halted by human:maher — \[REDACTED:withheld\]/);

  assert.ok(
    runs[0].redactionCount >= 2,
    'both error strings are counted. Before this change `redact(error, …)` discarded its ' +
      'hits at both call sites, so a tool error that redacted an IBAN reported zero ' +
      'redactions — a redaction nobody counted is a redaction nobody can audit.',
  );
});

test('truncation does not defeat it — §9.3 refuses truncation by name', async () => {
  refreshEnvSecrets({});
  const { obs, sent } = harness();

  const trace = begin(obs);
  trace.withhold(BODY);
  // "just the first 40 characters", which the ruling refuses explicitly: forty characters of
  // a sentence a person typed is forty characters of a sentence a person typed.
  trace.tool('mailbox.peek').error(`halted: ${BODY.slice(0, 40)}`);
  // …and a window from the middle, which is what a "context snippet" looks like.
  trace.event('note', { reason: BODY.slice(20, 60) });
  await trace.finish({ status: 'error', error: 'done' });

  assertNoFragment(JSON.stringify(sent), 'a truncated body');
});

test('the register survives every container the tracer has', async () => {
  refreshEnvSecrets({});
  const { obs, sent } = harness();

  const trace = begin(obs);
  trace.withhold(BODY);
  trace.event('composed', { frame: `[note from human:maher: ${BODY}]` });
  trace.tool('write', { path: `/w/${BODY}.md` }).ok({ wrote: BODY });
  trace.tool('crash').error(String(new Error(BODY)));
  await trace.finish({
    status: 'error',
    error: BODY,
    artifacts: [{ path: `out/${BODY}.md`, kind: 'note' }],
    summary: { event: 'Thread halted', detail: BODY },
  });

  assertNoFragment(JSON.stringify(sent), 'a span attribute');
});

test('an allowlisted key is exempt from the value rules and NOT from the register', async () => {
  refreshEnvSecrets({});
  const { obs, sent } = harness();

  // `model` is on KEY_ALLOWLIST so its string skips the value pass. An include-list is a
  // decision to be blind to everything it names; this asserts the register is not part of
  // that decision, because "the leak was in a field we had allowlisted" is the bill for it.
  const trace = begin(obs);
  trace.withhold(BODY);
  trace.tool('probe', { model: BODY, status: `ok: ${BODY}` }).ok({ tool: BODY });
  await trace.finish({ status: 'ok' });

  assertNoFragment(JSON.stringify(sent), 'an allowlisted key');
});

/* -------------------------------------------------------------------------- *
 * 2. The half that needs no call site at all
 * -------------------------------------------------------------------------- */

test('a body seen once under a denylisted key is scrubbed from a later error string', async () => {
  refreshEnvSecrets({});
  const { obs, sent } = harness();

  // Nobody called `withhold` here. The run traced a whole message — the exact call the
  // sibling gate was written for — and the key pass caught the body. This asserts the run
  // also *remembered* it, so the error message composed from the same text a second later
  // is caught by characters after the key that would have caught it is gone.
  const trace = begin(obs, { message: { author: 'human:maher', body: BODY } });
  trace.tool('mailbox.peek').error(`halted: ${BODY}`);
  await trace.finish({ status: 'error', error: `could not parse: ${BODY}` });

  assertNoFragment(JSON.stringify(sent), 'a later error string');
});

test('a flattened `body:` value is registered too, and the register outlives the sentence', () => {
  refreshEnvSecrets({});
  const withheld = createWithheld();

  // The key-in-string pass catches this one because the composition kept the separator.
  const first = redact({ line: `mailbox drained · body: ${BODY}` }, 'probe', withheld);
  assertNoFragment(JSON.stringify(first.value), 'a flattened key: value string');
  assert.equal(withheld.size(), 1, 'the value it removed was registered as it went');

  // The next payload has no separator left at all — the frame `mailbox.ts` composes for the
  // agent to read. In the sibling gate this exact string is asserted as a known leak, and it
  // is still a leak on a fresh register; it is not a leak on one that has seen the body.
  const second = redact({ frame: `[note from human:maher: ${BODY}]` }, 'probe', withheld);
  assertNoFragment(JSON.stringify(second.value), 'a composed frame after registration');
});

test('registration order inside one payload does not decide the outcome', () => {
  refreshEnvSecrets({});

  // `Object.entries` order is the payload author's, not ours. Both orders must scrub, or the
  // defence works on the example it was written against — which is how the key-in-string
  // pass was found to be needed in the first place.
  for (const payload of [
    { body: BODY, note: `halted: ${BODY}` },
    { note: `halted: ${BODY}`, body: BODY },
  ]) {
    const { value } = redact(payload, 'probe', createWithheld());
    assertNoFragment(JSON.stringify(value), `payload with keys ${Object.keys(payload).join(',')}`);
  }
});

/* -------------------------------------------------------------------------- *
 * 3. What it must NOT do — the register is bounded and blunt in one direction only
 * -------------------------------------------------------------------------- */

test('a run that was never told stays a leak, and one run never scrubs another', async () => {
  refreshEnvSecrets({});
  const { obs, sent } = harness();

  const told = begin(obs);
  told.withhold(BODY);
  await told.finish({ status: 'ok' });

  const untold = begin(obs);
  untold.tool('mailbox.peek').error(`halted: ${BODY}`);
  await untold.finish({ status: 'error', error: 'halted' });

  assert.equal(
    JSON.stringify(sent[1]).includes('Fatima Al-Harbi'),
    true,
    'ASSERTED AS THE KNOWN LIMIT, not as desired behaviour, and it is two claims in one. ' +
      '(1) The register is per-run: a global one would scrub run B because of run A, which ' +
      'is unbounded over-redaction nobody can reason about. (2) It is a register, not a ' +
      'classifier — it cannot look at a sentence and decide. This closes only when the call ' +
      'site that reads a body calls withhold(); see the message to runner-engineer. If this ' +
      'ever starts failing because something got broader, say so in the handoff — do not ' +
      'weaken the assertion to keep it green.',
  );
});

test('short literals are not registered, and ordinary prose survives', () => {
  refreshEnvSecrets({});
  const withheld = createWithheld();

  withheld.add('ok');
  withheld.add('the');
  assert.equal(withheld.size(), 0, `under ${MIN_LITERAL} characters a literal is not registered`);

  // A register that took short strings would scrub every trace in the product into confetti,
  // and a redactor nobody can read is one people route around.
  withheld.add(BODY);
  const { out, count } = withheld.scrub('run finished ok, 3 tools, the plan was written');
  assert.equal(out, 'run finished ok, 3 tools, the plan was written');
  assert.equal(count, 0);

  // A fragment shorter than the window is the stated blind spot, asserted so it is a known
  // limit rather than a surprise.
  const short = withheld.scrub(`halted: ${BODY.slice(0, WINDOW - 1)}`);
  assert.equal(short.count, 0, `below ${WINDOW} characters a partial match is not made`);
});

/* -------------------------------------------------------------------------- *
 * 4. Exhaustion — the bound must not be a way to lose protection
 *
 * This block replaces a test that asserted `size() <= 32` and called that a bound. It was
 * true and it graded the wrong half: `rtl-arabic-pdpl-specialist` found on 2026-08-18 that
 * the eviction behind it was a **fail-open**, so the 33rd registered body silently
 * un-protected the 1st on the one register whose job is stopping a body reaching a trace.
 * A test that measures the resource and not the protection is how a leak passes a gate.
 * -------------------------------------------------------------------------- */

test('THE gate: registering past the cap never un-protects the first body', () => {
  const withheld = createWithheld();

  // The 33-message thread from the finding, made worse: MAX_LITERALS + 50 later messages,
  // each an ordinary body. The first one is the one a long conversation forgets, and it is
  // the one most likely to name a third party (tier 3, ADR-036).
  assert.equal(withheld.add(BODY), true, 'the first body registers');
  for (let i = 0; i < MAX_LITERALS + 50; i += 1) {
    withheld.add(`later message number ${i} in an ordinary thread`);
  }

  assert.equal(
    withheld.scrub(`halted: ${BODY}`).out,
    'halted: [REDACTED:withheld]',
    'THE assertion this whole block exists for. Under the old shape (`literals.shift()` at ' +
      'the cap) this is red: the first body comes back verbatim because a later one evicted ' +
      'it. Protection is monotonic — if this is red, exhaustion is reducing protection again ' +
      'and the direction of the failure is toward leaking. Do not raise the cap to make it ' +
      'green; the cap is not the property.',
  );
  assertNoFragment(JSON.stringify(withheld.scrub(`halted: ${BODY}`)), 'a full register');
});

test('size() only ever grows — nothing evicts, nothing expires', () => {
  const withheld = createWithheld();
  let previous = 0;
  for (let i = 0; i < MAX_LITERALS + 50; i += 1) {
    withheld.add(`message body number ${i}, padded past the floor`);
    const size = withheld.size();
    assert.ok(size >= previous, `size() fell from ${previous} to ${size} at literal ${i}`);
    previous = size;
  }
  assert.equal(withheld.size(), MAX_LITERALS, 'it fills to the ceiling and stops there');
});

test('exhaustion refuses the newest literal, loudly — add() returns false and refused() counts', () => {
  const withheld = createWithheld();
  for (let i = 0; i < MAX_LITERALS; i += 1) {
    assert.equal(withheld.add(`message body number ${i}, padded past the floor`), true);
  }
  assert.equal(withheld.refused(), 0, 'nothing was refused on the way to the ceiling');

  assert.equal(
    withheld.add(BODY),
    false,
    'A full register cannot withhold this body and says so. The residual is real — this body ' +
      'is unprotected — but it is the NEWEST, whose call site is still on the stack, and the ' +
      'caller is told. The old shape returned void and quietly dropped an older one instead.',
  );
  assert.equal(withheld.refused(), 1);

  // …and the refusal did not cost anything already held.
  const held = 'message body number 0, padded past the floor';
  assert.equal(withheld.scrub(`halted: ${held}`).count, 1, 'an earlier literal is untouched');
});

test('the character budget bites independently of the count, and also refuses', () => {
  const withheld = createWithheld();
  const huge = 'ب'.repeat(MAX_WITHHELD_CHARS / 8 - 1); // with its 1-char prefix: 8 fill it exactly

  for (let i = 0; i < 8; i += 1) {
    // Distinct strings, so `includes` cannot short-circuit them into one entry.
    assert.equal(withheld.add(`${i}${huge}`), true, `literal ${i} fits the budget`);
  }
  assert.equal(withheld.size(), 8);
  assert.equal(
    withheld.add(`8${huge}`),
    false,
    'MAX_LITERALS is nowhere near reached — 8 of 512 — so this is the character budget, ' +
      'which is the bound a count could never see. Eight bodies of 128k characters is the ' +
      'shape that made a count of 32 the wrong instrument.',
  );
  assert.equal(withheld.refused(), 1);
});

test('a refusal is reported on the trace, and an ordinary run carries no such key', async () => {
  refreshEnvSecrets({});
  const { obs, sent } = harness();

  const quiet = begin(obs);
  quiet.withhold(BODY);
  await quiet.finish({ status: 'ok' });
  assert.equal(
    JSON.stringify(sent[0]).includes('withheld_refused'),
    false,
    'absent when zero, so the key\'s presence is itself the signal and no ordinary trace ' +
      'shape changes',
  );

  const full = begin(obs);
  for (let i = 0; i < MAX_LITERALS; i += 1) {
    full.withhold(`message body number ${i}, padded past the floor`);
  }
  assert.equal(full.withhold(BODY), false, 'the run is told at the call site');
  await full.finish({ status: 'ok' });

  assert.match(
    JSON.stringify(sent[1]),
    // The OTLP encoding, not the JS object: `attributes()` emits `{key, value:{intValue}}`,
    // and asserting the object shape would pass against a payload that never shipped the key.
    /"key":"langfuse\.trace\.metadata\.withheld_refused","value":\{"intValue":"1"\}/,
    'A silent fail-open was the whole finding. The count is on the root span — a number, ' +
      'never a string, so the report cannot itself carry a body.',
  );
});

test('the same literal twice is one entry, and re-adding a held literal still answers true', () => {
  const withheld = createWithheld();
  assert.equal(withheld.add(BODY), true);
  assert.equal(withheld.add(BODY), true, 'already registered ⇒ the run CAN withhold it');
  assert.equal(withheld.size(), 1);
  assert.equal(withheld.refused(), 0, 'a duplicate is not an exhaustion');
});

test('a bare redact() is unchanged — no register, no new behaviour', () => {
  refreshEnvSecrets({});
  // Every caller outside instrument.ts passes no register, and must see exactly what it saw
  // before this file existed. `db/ledger.ts` redacts an agent's output payload this way.
  const { value, hits } = redact({ frame: `[note from human:maher: ${BODY}]` }, 'probe');
  assert.equal((value as { frame: string }).frame, `[note from human:maher: ${BODY}]`);
  assert.deepEqual(hits, [], 'prose has no keys and there is no register to fall back on');
});
