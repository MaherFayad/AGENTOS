/**
 * One defect, four doors — the pattern audit.
 *
 * In a single session this system reported: a 0-of-20 brain at 45%, `runs: 0` during a
 * database outage, a trace link to a Langfuse project that was never created, and
 * `tailscale: "online"` on a host with no Tailscale installed. Each was well-formed,
 * confident, and indistinguishable from the truth. Each was the same mistake:
 *
 *   **a configured value reported as an observed one.**
 *
 * These tests pin the two fixed here plus the fifth instance found while auditing
 * `/api/status` — `budget.spentUsd`, which returned `0` whether nothing had been spent or
 * the spend file could not be read. That one sits inside the billing control.
 */
import { mkdtemp, chmod, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isTailnetIPv4, isTailnetIPv6, readTailnet } from '../tailscale.ts';
import { SpendLedger } from '../billing.ts';
import { createNullSink, sinkFromEnv } from '../../observability/langfuse.ts';
import type { RunnerConfig } from '../config.ts';

// --- tailscale: a setting is not a connection -------------------------------

test('the tailnet range is recognised, and its neighbours are not', () => {
  assert.equal(isTailnetIPv4('100.64.0.1'), true);
  assert.equal(isTailnetIPv4('100.101.102.103'), true);
  assert.equal(isTailnetIPv4('100.127.255.255'), true);
  assert.equal(isTailnetIPv4('100.63.255.255'), false, 'just below the CGNAT range');
  assert.equal(isTailnetIPv4('100.128.0.0'), false, 'just above it');
  assert.equal(isTailnetIPv4('192.168.100.83'), false, 'the house wifi is not the tailnet');
  assert.equal(isTailnetIPv4('10.0.0.1'), false);
  assert.equal(isTailnetIPv6('fd7a:115c:a1e0::1'), true);
  assert.equal(isTailnetIPv6('fe80::1'), false, 'link-local is not the tailnet');
});

test('TAILSCALE_IP being set does not make the runner online', () => {
  const previousIp = process.env.TAILSCALE_IP;
  const previousHost = process.env.TS_HOSTNAME;
  process.env.TAILSCALE_IP = '100.101.102.103';
  process.env.TS_HOSTNAME = 'box.tail1234.ts.net';
  try {
    // The exact situation on the machine that reported ONLINE: env vars present, no
    // Tailscale installed, no interface in the range.
    const reading = readTailnet(() => ({
      eth0: [{ address: '172.19.0.2', family: 'IPv4', internal: false } as never],
      lo: [{ address: '127.0.0.1', family: 'IPv4', internal: true } as never],
    }));
    assert.equal(reading.state, 'unknown', 'a value in .env is intent, not evidence');
    assert.equal(reading.address, null);
    assert.match(reading.hint, /cannot see one on any of its own interfaces/);
    // `unknown` must not be read as an outage: the container legitimately cannot observe a
    // tailnet that is up on the host, so the hint says so in as many words.
    assert.match(reading.hint, /not a claim that the tailnet is down/);
  } finally {
    if (previousIp === undefined) delete process.env.TAILSCALE_IP;
    else process.env.TAILSCALE_IP = previousIp;
    if (previousHost === undefined) delete process.env.TS_HOSTNAME;
    else process.env.TS_HOSTNAME = previousHost;
  }
});

test('an actual tailnet interface is online, and says which address it observed', () => {
  const reading = readTailnet(() => ({
    tailscale0: [{ address: '100.101.102.103', family: 'IPv4', internal: false } as never],
  }));
  assert.equal(reading.state, 'online');
  assert.equal(reading.address, '100.101.102.103');
  assert.match(reading.hint, /100\.101\.102\.103/, 'the evidence is reported, so it is checkable');
});

test('with nothing configured and nothing observed, the hint says Tailscale is not up', () => {
  const previousIp = process.env.TAILSCALE_IP;
  const previousHost = process.env.TS_HOSTNAME;
  delete process.env.TAILSCALE_IP;
  delete process.env.TS_HOSTNAME;
  try {
    const reading = readTailnet(() => ({}));
    assert.equal(reading.state, 'unknown');
    assert.match(reading.hint, /Tailscale is not up yet/);
  } finally {
    if (previousIp !== undefined) process.env.TAILSCALE_IP = previousIp;
    if (previousHost !== undefined) process.env.TS_HOSTNAME = previousHost;
  }
});

// --- the null sink: no trace means no link ----------------------------------

test('the null sink has no trace URL, because there is no trace', () => {
  const sink = createNullSink();
  assert.equal(sink.urlFor('deadbeefdeadbeefdeadbeefdeadbeef'), null);
});

test('an unconfigured Langfuse yields no link, not a link to a project that does not exist', () => {
  const sink = sinkFromEnv({ LANGFUSE_HOST: 'http://langfuse:3000' }); // no keys
  assert.equal(sink.urlFor('deadbeefdeadbeefdeadbeefdeadbeef'), null);

  const configured = sinkFromEnv({
    LANGFUSE_HOST: 'http://langfuse:3000',
    LANGFUSE_PUBLIC_KEY: 'pk-lf-test',
    LANGFUSE_SECRET_KEY: 'sk-lf-test',
    LANGFUSE_PROJECT_ID: 'command-center',
  });
  const url = configured.urlFor('deadbeefdeadbeefdeadbeefdeadbeef');
  assert.ok(url && url.includes('/project/command-center/traces/'));
  assert.notEqual(url, sink.urlFor('deadbeefdeadbeefdeadbeefdeadbeef'));
});

test('the trace LINK uses the browser-facing origin, not the compose-internal send host', () => {
  // `langfuse:3000` resolves inside the compose network and nowhere else. A link built
  // from the send host is correct for the container and dead for the person holding the
  // phone — the trace landed, the link just goes nowhere. Infra ships both values.
  const sink = sinkFromEnv({
    LANGFUSE_HOST: 'http://langfuse:3000',
    LANGFUSE_PUBLIC_URL: 'http://127.0.0.1:3001',
    LANGFUSE_PUBLIC_KEY: 'pk-lf-test',
    LANGFUSE_SECRET_KEY: 'sk-lf-test',
    LANGFUSE_PROJECT_ID: 'command-center',
  });
  assert.equal(
    sink.urlFor('deadbeefdeadbeefdeadbeefdeadbeef'),
    'http://127.0.0.1:3001/project/command-center/traces/deadbeefdeadbeefdeadbeefdeadbeef',
  );

  // An empty `${LANGFUSE_PUBLIC_URL:-}` from compose must not produce a relative URL.
  const blank = sinkFromEnv({
    LANGFUSE_HOST: 'http://langfuse:3000',
    LANGFUSE_PUBLIC_URL: '   ',
    LANGFUSE_PUBLIC_KEY: 'pk-lf-test',
    LANGFUSE_SECRET_KEY: 'sk-lf-test',
    LANGFUSE_PROJECT_ID: 'command-center',
  });
  assert.equal(
    blank.urlFor('abc'),
    'http://langfuse:3000/project/command-center/traces/abc',
    'unset falls back to the send host — unchanged behaviour, never a broken relative link',
  );
});

// --- budget: an unwritable ledger is not a zero balance ---------------------

function configWithArtifacts(root: string): RunnerConfig {
  return { artifactsRoot: join(root, 'artifacts'), monthlyCapUsd: 50 } as RunnerConfig;
}

test('budget.persisted is null before any run — durability is untested, not proven', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agnetos-spend-'));
  const budget = await new SpendLedger(configWithArtifacts(root)).status();
  assert.equal(budget.spentUsd, 0);
  assert.equal(
    budget.persisted,
    null,
    'a fresh runner has not written spend.json, and must not claim it has',
  );
});

test('a successful persist reports true and the figure survives a new process', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agnetos-spend-ok-'));
  const config = configWithArtifacts(root);

  const first = new SpendLedger(config);
  await first.record(1.25);
  const afterWrite = await first.status();
  assert.equal(afterWrite.persisted, true);
  assert.equal(afterWrite.spentUsd, 1.25);

  // A second ledger over the same file is the restart: the cap is only hard if this holds.
  const second = await new SpendLedger(config).status();
  assert.equal(second.spentUsd, 1.25, 'the cap must survive a restart or it is not a cap');
  assert.equal(second.remainingUsd, 48.75);
});

test('an unwritable spend file reports persisted:false and warns exactly once', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agnetos-spend-ro-'));
  // Make `mkdir`/`writeFile` fail by putting a *file* where the directory must go.
  await writeFile(join(root, 'spend.json'), 'not a directory', 'utf8');
  const config = { artifactsRoot: join(root, 'spend.json', 'artifacts'), monthlyCapUsd: 50 } as RunnerConfig;

  const warnings: string[] = [];
  const ledger = new SpendLedger(config);
  ledger.onPersistFailure = (m) => warnings.push(m);

  await ledger.record(2);
  await ledger.record(3);

  const budget = await ledger.status();
  assert.equal(budget.persisted, false, 'the cap is soft and the payload says so');
  assert.equal(budget.spentUsd, 5, 'the in-memory figure still guards this process');
  assert.equal(warnings.length, 1, 'warned once, not once per run');
  assert.match(warnings[0]!, /not a hard cap/);
});

test('a failed write never fails the run that already succeeded', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agnetos-spend-safe-'));
  await writeFile(join(root, 'spend.json'), 'not a directory', 'utf8');
  const config = { artifactsRoot: join(root, 'spend.json', 'x'), monthlyCapUsd: null } as RunnerConfig;
  await assert.doesNotReject(() => new SpendLedger(config).record(1));
  void chmod; // referenced so the import stays honest about what this file may need
});
