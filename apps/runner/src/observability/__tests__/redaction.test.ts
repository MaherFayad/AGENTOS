/**
 * The PDPL test (Part VII.4).
 *
 * This is the thing standing between us and a compliance problem, so it is written to
 * be hostile: it drives a real run through the real instrumentation module with a fake
 * Langfuse transport, then asserts that not one PII literal survives anywhere in the
 * bytes that would have gone over the wire — or in the row that would have gone into
 * Postgres.
 *
 * It asserts on ABSENCE of the secret, not presence of a placeholder. A future
 * refactor that renames placeholders keeps passing; one that drops a rule fails.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createInstrumentation } from '../instrument.ts';
import { redact, redactString, refreshEnvSecrets } from '../redact.ts';
import { VALUE_RULES } from '../redaction-rules.ts';
import type { RunRecord, ToolCallRecord } from '../types.ts';

/** Every value below must be impossible to find in a trace or a ledger row. */
const PII = {
  email: 'fatima.alharbi@almosafer.com',
  saudiId: '1098234571',
  iqama: '2345678901',
  iban: 'SA0380000000608010167519',
  card: '4539578763621486', // passes Luhn
  phoneIntl: '+966 50 123 4567',
  phoneLocal: '0501234567',
  ip: '100.64.12.9',
  anthropicKey: 'sk-ant-api03-ZZZaaaBBBcccDDDeeeFFFggg',
  langfuseKey: 'sk-lf-11111111-2222-3333-4444-555555555555',
  awsKey: 'AKIAIOSFODNN7EXAMPLE',
  jwt: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk',
  bearer: 'Bearer abcdefghijklmnopqrstuvwxyz123456',
  rotatedKey: 'totally-new-key-format-9f8e7d6c5b4a3210',
};

function fakeDeps() {
  const sent: unknown[] = [];
  const stored: { runs: RunRecord[]; tools: ToolCallRecord[] } = { runs: [], tools: [] };
  let tick = 0;
  return {
    sent,
    stored,
    deps: {
      sink: {
        async send(payload: unknown) {
          sent.push(payload);
        },
        urlFor: (traceId: string) => `http://langfuse.tailnet:3000/project/local/traces/${traceId}`,
      },
      ledger: {
        async recordRun(run: RunRecord, tools: ToolCallRecord[]) {
          stored.runs.push(run);
          stored.tools.push(...tools);
        },
      },
      now: () => new Date(1_770_000_000_000 + tick++ * 1000),
    },
  };
}

test('no PII reaches the Langfuse client or the ledger', async () => {
  process.env.ANTHROPIC_API_KEY = PII.anthropicKey;
  process.env.SLACK_BOT_TOKEN = PII.rotatedKey;
  refreshEnvSecrets();

  const { sent, stored, deps } = fakeDeps();
  const obs = createInstrumentation(deps);

  const trace = obs.startRun({
    agent: 'sales/account-enrichment',
    department: 'sales',
    agentName: 'Account Enrichment',
    trigger: 'manual',
    model: 'claude-opus-5',
    inputs: {
      account_url: 'https://example.sa',
      // Free text is the realistic leak: an operator pastes a lead's details in.
      notes: `Primary contact ${PII.email}, mobile ${PII.phoneIntl} / ${PII.phoneLocal}. ` +
        `National ID ${PII.saudiId}, iqama ${PII.iqama}. Settlement IBAN ${PII.iban}, ` +
        `card on file ${PII.card}. Seen from ${PII.ip}.`,
      // Structured leaks — caught by the key denylist whatever the value looks like.
      client_name: 'Fatima Al-Harbi',
      passport_number: 'A01234567',
      credentials: { api_key: PII.langfuseKey, authorization: PII.bearer },
    },
  });

  const span = trace.tool('exa.search', {
    query: `contact ${PII.email}`,
    headers: { authorization: PII.bearer },
    aws: PII.awsKey,
  });
  span.ok({ results: [{ snippet: `reach us on ${PII.phoneIntl}`, session: PII.jwt }] });

  const failing = trace.tool('firecrawl.scrape', { url: 'https://example.sa/team' });
  failing.error(`403 from upstream while authenticating with ${PII.anthropicKey}`);

  trace.event('artifact', { path: '/scratch/out.md', preview: `owner ${PII.email}` });
  trace.usage({ model: 'claude-opus-5', inputTokens: 1200, outputTokens: 800 });

  await trace.finish({
    status: 'error',
    error: `run aborted; token ${PII.rotatedKey} rejected for ${PII.email}`,
  });

  assert.equal(sent.length, 1, 'exactly one OTLP payload should be shipped per run');

  const wire = JSON.stringify(sent[0]);
  const ledger = JSON.stringify(stored);

  for (const [name, secret] of Object.entries(PII)) {
    assert.ok(!wire.includes(secret), `${name} leaked into the Langfuse payload`);
    assert.ok(!ledger.includes(secret), `${name} leaked into the ledger row`);
  }

  // The rotated key has no recognisable shape — only the literal-env scrub catches it.
  // If that mechanism is ever removed, this line is the one that fails.
  assert.ok(!wire.includes('totally-new-key-format'), 'literal env-secret scrub is not running');

  // Redaction must be visible, not silent: the run row records how much was removed,
  // so `agent-auditor` can spot an agent that is routinely handling client PII.
  assert.ok(stored.runs[0].redactionCount > 10, 'redaction hits should be counted on the run row');
});

test('every value rule redacts a representative sample', () => {
  refreshEnvSecrets({});
  const samples: Record<string, string> = {
    anthropic_key: PII.anthropicKey,
    langfuse_key: PII.langfuseKey,
    generic_secret_key: 'api_live_abcdefghijklmnop',
    aws_access_key: PII.awsKey,
    bearer_token: PII.bearer,
    jwt: PII.jwt,
    private_key_block: '-----BEGIN RSA PRIVATE KEY-----\nMIIhush\n-----END RSA PRIVATE KEY-----',
    email: PII.email,
    iban: PII.iban,
    payment_card: PII.card,
    saudi_id: PII.saudiId,
    phone_intl: PII.phoneIntl,
    phone_saudi_local: PII.phoneLocal,
    ipv4: PII.ip,
  };

  // Every rule in the list must have a sample here. Adding a rule without a sample
  // fails this assertion, which is the cheapest way to keep the two in step.
  for (const rule of VALUE_RULES) {
    assert.ok(samples[rule.id], `rule "${rule.id}" has no sample in the redaction test`);
    const out = redactString(samples[rule.id], 'sample', []);
    assert.ok(!out.includes(samples[rule.id]), `rule "${rule.id}" did not redact its own sample`);
  }
});

test('an order number that is not a card survives; a PAN does not', () => {
  refreshEnvSecrets({});
  // 16 digits, fails Luhn — a real order reference, and redacting it would make
  // operations distrust the redactor.
  const order = '1234567812345678';
  assert.equal(redactString(`order ${order}`, 'p', []), `order ${order}`);
  assert.ok(!redactString(`pan ${PII.card}`, 'p', []).includes(PII.card));
});

test('agent, tool and department names are never mangled', () => {
  refreshEnvSecrets({});
  const { value } = redact({
    agent: 'sales/account-enrichment',
    department: 'back-office',
    model: 'claude-opus-5',
    tool: 'exa.search',
    status: 'live',
  });
  assert.deepEqual(value, {
    agent: 'sales/account-enrichment',
    department: 'back-office',
    model: 'claude-opus-5',
    tool: 'exa.search',
    status: 'live',
  });
});

test('redaction does not mutate the caller’s object', () => {
  refreshEnvSecrets({});
  const input = { notes: `mail ${PII.email}` };
  redact(input);
  assert.equal(input.notes, `mail ${PII.email}`, 'the run must still see its real inputs');
});

test('deep and wide payloads are bounded rather than trusted', () => {
  refreshEnvSecrets({});
  const deep: Record<string, unknown> = {};
  let cursor = deep;
  for (let i = 0; i < 40; i++) {
    const next: Record<string, unknown> = {};
    cursor.child = next;
    cursor = next;
  }
  const { value, hits } = redact({ deep, wide: Array.from({ length: 500 }, (_, i) => i) });
  assert.ok(hits.some((h) => h.rule === 'max_depth'));
  assert.ok(hits.some((h) => h.rule === 'max_array'));
  assert.ok(JSON.stringify(value).length < 20_000);
});
