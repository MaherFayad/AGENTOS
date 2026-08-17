/**
 * PDPL gate — a message body must not reach an emitted span (Part VII.4,
 * `contracts/thread-model.md` §7.1, §7.2, §9.3).
 *
 * Owner: `rtl-arabic-pdpl-specialist`. The rule set in `redaction-rules.ts` is co-owned; the
 * file is `observability-engineer`'s.
 *
 * ## Why this file exists rather than a fourth paragraph
 *
 * The flattening finding has now been written down four times — the approvals `summary`, the
 * plan span, the redactor, and `ops.message`. Prose that has been found four times is prose
 * that does not work. §7.1 states the rule: *the body is stored verbatim and never
 * instrumented*. That sentence had **no enforcer**. A comment is not a mechanism, and this
 * repo has paid for that distinction twice (`workspace` confinement was a docstring and a run
 * overwrote `.env`).
 *
 * ## What was true before this file, measured rather than asserted
 *
 * Driving a whole `ThreadMessage` through the ordinary instrumentation entry points —
 *
 *     trace.event('mailbox-read', message);
 *     trace.tool('mailbox.drain', message).ok(message);
 *
 * — put the body verbatim into the OTLP payload in **three** places
 * (`langfuse.observation.output` twice, `langfuse.observation.input` once), with zero
 * redaction hits and nothing red anywhere in the tree. `messageSpanAttributes` was the
 * sanctioned path and the *only* thing making it the sanctioned path was that the one call
 * site in `runService.ts` happened to use it.
 *
 * ## What this gate is, and precisely what it is not
 *
 * It is a **backstop**, and calling it the defence would repeat the defect it exists for.
 *
 *   - It CAN see: a message-shaped object handed to any instrumentation entry point, at any
 *     depth, under a `body`-family key.
 *   - It CANNOT see: a body composed into prose under some other key. `{ frame: '[note from
 *     human:maher: chase Fatima…]' }` has no `body:` separator, so no key rule finds it, and
 *     that case is asserted below as a **known, open leak** rather than left to be
 *     rediscovered a fifth time. Flattening still beats key-based redaction; that is why the
 *     primary rule is structural and why `RunTrace.event(detail?: unknown)` accepting a whole
 *     message at all is filed as a decision-request to `observability-engineer`.
 *
 * **Structural, not empirical.** Zero runs have executed and no span has ever been shipped to
 * a Langfuse. What is observed here is the payload this process builds, at the boundary where
 * redaction is required to run (rule 7: *redacted at instrumentation*), not a trace anyone has
 * seen in a viewer.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createInstrumentation } from '../instrument.ts';
import { redact, refreshEnvSecrets } from '../redact.ts';
import { KEY_DENYLIST, normaliseKey } from '../redaction-rules.ts';
import { messageSpanAttributes, type ThreadMessage } from '@agnetos/contracts';
import type { RunRecord, ToolCallRecord } from '../types.ts';

/**
 * A body a person would actually type, in this product's actual market. It carries no
 * denylisted key, no email, no phone, no IBAN and no national id — every value rule in the
 * list looks straight past it. That is the point: the redactor's `hits` for this string is
 * `[]`, demonstrated in `threads-observability.test.ts`, and the only defence left is that
 * the string never gets handed to the tracer in the first place.
 */
const BODY = 'Chase Fatima Al-Harbi about the Olaya lease — she wants to move in March.';

/** Substrings whose presence anywhere in a payload means the body leaked. */
const FRAGMENTS = ['Fatima', 'Al-Harbi', 'Olaya', 'lease', 'move in March'];

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const THREAD = '3f2a1c40-9d6b-4a21-8f0e-77c9b1d25e83';

const message = (over: Partial<ThreadMessage> = {}): ThreadMessage => ({
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  threadId: THREAD,
  projectId: PROJECT_ID,
  seq: 1,
  kind: 'human',
  interrupt: 'note',
  author: 'human:maher',
  body: BODY,
  payload: null,
  inReplyTo: null,
  expiresAt: null,
  deliveredAt: null,
  createdAt: '2026-08-17T06:41:00.000Z',
  ...over,
});

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
    inputs: inputs as never,
  });

/** Every fragment, against the whole serialised payload — not just the attribute we expected. */
function assertNoFragment(serialised: string, where: string): void {
  for (const fragment of FRAGMENTS) {
    assert.equal(
      serialised.includes(fragment),
      false,
      `"${fragment}" of a message body reached ${where}. ` +
        'A body is free text a human typed; §7.1 forbids it leaving the process as ' +
        'observability data at any granularity, including truncated. Project the message ' +
        'through messageSpanAttributes() — a type with no body field — and pass that.',
    );
  }
}

/* -------------------------------------------------------------------------- *
 * 1. The gate — every entry point that accepts caller data
 * -------------------------------------------------------------------------- */

test('a message OBJECT handed to any instrumentation entry point never reaches a span', async () => {
  refreshEnvSecrets({});
  const { obs, sent, runs, tools } = harness();

  // Every door in `RunTrace` that takes caller-supplied data, in one run. Each of these is a
  // call a future author writes in good faith — "the trace would be more useful with the
  // message on it" — and each one shipped the body verbatim before this gate existed.
  const trace = begin(obs, { message: message() });
  trace.event('mailbox-read', message());
  const span = trace.tool('mailbox.drain', message());
  span.ok({ drained: [message()] });
  trace.tool('mailbox.peek', { nested: { deep: { m: message() } } }).ok({ seen: 1 });
  await trace.finish({ status: 'ok' });

  assert.equal(sent.length, 1, 'one run, one OTLP payload');
  assertNoFragment(JSON.stringify(sent), 'the emitted OTLP payload');
  assertNoFragment(JSON.stringify(runs), 'the ledger record (ops.agent_runs, Postgres)');
  assertNoFragment(JSON.stringify(tools), 'the tool-call rows (ops.tool_calls, Postgres)');
});

test('the leak is redacted, not dropped — the trace still says a body was there', async () => {
  refreshEnvSecrets({});
  const { obs, sent, runs } = harness();

  const trace = begin(obs);
  trace.event('mailbox-read', message());
  await trace.finish({ status: 'ok' });

  const serialised = JSON.stringify(sent);
  assert.match(
    serialised,
    /\[REDACTED:body\]/,
    'the key stays visible and the value goes. Which field was redacted is operationally ' +
      'useful and is not itself client data — a silently dropped key would look like a ' +
      'message that had no body, which is a different claim.',
  );
  assert.ok(
    runs[0].redactionCount > 0,
    'the run counts what it redacted; a redaction nobody counted is a redaction nobody can audit',
  );
});

/* -------------------------------------------------------------------------- *
 * 2. The sanctioned path must keep working, or the rule gets routed around
 * -------------------------------------------------------------------------- */

test('the sanctioned projection still emits, and bodyChars survives the new rule', async () => {
  refreshEnvSecrets({});
  const { obs, sent } = harness();

  const trace = begin(obs);
  trace.event('mailbox-read', messageSpanAttributes(message({ payload: { option_a: 'renew' } })));
  await trace.finish({ status: 'ok' });

  const serialised = JSON.stringify(sent);
  assertNoFragment(serialised, 'the sanctioned projection');

  // `bodyChars` normalises to `bodychars`, which is not on the denylist, and the object-key
  // pass is an exact match. A rule blunt enough to eat this would delete the distinction
  // between "the human sent something and the agent read nothing" and "the human sent
  // nothing" — and a rule that breaks the sanctioned path is a rule people work around.
  assert.match(serialised, /"bodyChars\\":73/, 'the length survives; a length is not content');
  assert.equal(
    serialised.includes('[REDACTED:body]'),
    false,
    'nothing was redacted on the sanctioned path — there was nothing there to redact',
  );
});

test('a body-shaped value is caught at depth, inside an array, and as a bare string value', () => {
  refreshEnvSecrets({});

  const deep = redact({ mailbox: { messages: [{ author: 'human:maher', body: BODY }] } }, 'probe');
  assertNoFragment(JSON.stringify(deep.value), 'a nested array element');
  assert.equal(deep.hits.length, 1);
  assert.equal(deep.hits[0].label, 'body');

  // The key-in-string pass, added after flattening was found the third time. A composed
  // `key: value` sentence is still caught *when the key survives the composition*.
  const flattened = redact('mailbox drained · body: ' + BODY, 'probe');
  assertNoFragment(String(flattened.value), 'a flattened key: value string');
});

/* -------------------------------------------------------------------------- *
 * 3. The ratchet, and the leak this gate cannot close
 * -------------------------------------------------------------------------- */

test('the body-family keys stay on the denylist', () => {
  // A ratchet, not a restatement. `KEY_DENYLIST` is co-owned and the reasoning for `body`
  // is unlike every other entry on it (it names free text rather than a value with a known
  // shape), so it is exactly the entry a later reader deletes as over-broad after seeing an
  // HTTP tool output come back as `[REDACTED:body]`. Deleting it is allowed; deleting it
  // silently is not — this fails and names the ruling.
  const deny = new Set(KEY_DENYLIST.map(normaliseKey));
  for (const key of ['body', 'messagebody', 'emailbody', 'bodytext', 'messagetext']) {
    assert.equal(
      deny.has(key),
      true,
      `"${key}" left KEY_DENYLIST. It is the backstop for thread-model.md §7.1 — a message ` +
        'body must never leave the process as observability data. Removing it is a ' +
        'decision-request to rtl-arabic-pdpl-specialist and observability-engineer, and it ' +
        'needs the structural defence (RunTrace refusing a message-shaped argument) landed first.',
    );
  }

  // The other half of the co-ownership, pinned in the same place: `name` must stay OFF.
  // Over-redaction is the safe direction on a value and the unsafe direction on a whole
  // trace — a denylisted `name` would redact every agent, tool and department on every span
  // and teach everyone to distrust the redactor.
  assert.equal(deny.has('name'), false, 'a denylisted `name` redacts the trace into uselessness');
  assert.equal(deny.has('bodychars'), false, 'a length is not content');
});

test('a body flattened under a non-body key still leaks, and that is stated rather than hidden', () => {
  refreshEnvSecrets({});

  // `mailbox.ts` composes exactly this frame for the agent to read — legitimately, since the
  // agent must see the interrupt. Handed to the tracer under any key that is not on the
  // denylist, it survives whole: the composition destroyed the `body:` separator that the
  // key-in-string pass needs, which is the flattening finding for the fifth time.
  const frame = `[note from human:maher: ${BODY}]`;
  const { value, hits } = redact({ frame }, 'probe');

  assert.equal(
    (value as { frame: string }).frame,
    frame,
    'ASSERTED AS A KNOWN GAP, not as desired behaviour. If this ever starts passing because a ' +
      'rule got broader, delete this test and say so in the handoff — do not weaken the ' +
      'assertion to keep it green.',
  );
  assert.deepEqual(hits, [], 'zero hits: prose has no keys, and the redactor is not a fallback here');

  // Which is why the primary rule is structural and the residual risk is a type signature:
  // `RunTrace.event(name, detail?: unknown)` accepts a whole ThreadMessage today. Narrowing
  // it so a message-shaped argument stops compiling is `observability-engineer`'s file and is
  // filed as a decision-request. Until it lands, this line is the honest state of the defence.
});

test('an error STRING carrying a body leaks in full — found by this gate, not reasoned about', async () => {
  refreshEnvSecrets({});
  const { obs, sent } = harness();

  // Found by falsification rather than by argument: the first draft of the gate above put
  // `span.error()` and `finish({ error })` in with the object cases and went red on a tree
  // where the object cases were already green. The two string doors are the ones that stay
  // open, and the difference is exactly §7.2 — an error message is prose, prose has no keys,
  // and `redactString` only finds a key that survived the composition.
  //
  // This is the realistic call: an author writes `span.error(\`halted: ${'${message.body}'}\`)`
  // because a halt reason with no reason in it is useless in a trace. It is also the exact
  // shape §7.1 forbids, at the granularity ("just the reason") the ruling refuses.
  const trace = begin(obs);
  trace.tool('mailbox.peek').error(`halted: ${BODY}`);
  await trace.finish({ status: 'error', error: `halted by human:maher — ${BODY}` });

  const serialised = JSON.stringify(sent);
  assert.equal(
    serialised.includes('Fatima Al-Harbi'),
    true,
    'KNOWN GAP, asserted so it cannot be rediscovered a sixth time. No key rule can close ' +
      'this and no value rule should try — a name-shaped regex would redact every agent ' +
      'display name in the product. It closes when RunTrace stops accepting free text that ' +
      'came from a message, which is a type change in observability/types.ts.',
  );
});
