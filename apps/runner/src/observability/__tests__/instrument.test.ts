/**
 * Instrumentation shape: one trace per run, one span per tool call, honest cost.
 * Together with metrics.test.ts this covers the "where does this number come from"
 * table's Langfuse column.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createInstrumentation } from '../instrument.ts';
import { composeActivity, formatDuration, renderActivityRow } from '../activity.ts';
import { priceRun } from '../pricing.ts';
import { assertLocalSink, buildOtlpPayload, newTraceId, toUnixNano } from '../langfuse.ts';
import { refreshEnvSecrets } from '../redact.ts';
import type { RunAttribution, RunRecord, ToolCallRecord } from '../types.ts';

/**
 * Every `startRun` below spreads this, because there is no longer a way not to: the three
 * ids are required on `RunInit`. Written out once so the tests read about what they test.
 */
const ATTRIBUTION: RunAttribution = {
  projectId: '11111111-1111-4111-8111-111111111111',
  agentRef: 'agnetos/sales/account-enrichment',
  sourceRef: 'project:agents/sales/account-enrichment/SKILL.md@sha256:abc',
};

function harness() {
  const sent: Record<string, unknown>[] = [];
  const runs: RunRecord[] = [];
  const tools: ToolCallRecord[] = [];
  let tick = 0;
  const obs = createInstrumentation({
    sink: {
      async send(payload) {
        sent.push(payload as Record<string, unknown>);
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

function spansOf(payload: Record<string, unknown>): Record<string, unknown>[] {
  const resourceSpans = payload.resourceSpans as Record<string, unknown>[];
  const scopeSpans = resourceSpans[0].scopeSpans as Record<string, unknown>[];
  return scopeSpans[0].spans as Record<string, unknown>[];
}

test('a run produces one trace, with a span per tool call under a single root', async () => {
  refreshEnvSecrets({});
  const { obs, sent, runs, tools } = harness();

  const trace = obs.startRun({
    ...ATTRIBUTION,
    agent: 'sales/account-enrichment',
    department: 'sales',
    agentName: 'Account Enrichment',
    trigger: 'manual',
  });

  // The trace URL must be usable before the run ends — the SSE `start` event carries
  // it, so the drawer can offer the link while output is still streaming. This fixture
  // supplies a real `urlFor`; with the null sink (Langfuse unconfigured) it is `null`,
  // never a plausible link to a trace that was not sent — see `createNullSink`.
  assert.ok(trace.traceUrl, 'a configured sink yields a link');
  assert.match(trace.traceUrl, /\/traces\/[0-9a-f]{32}$/);
  assert.equal(trace.traceUrl.includes(trace.traceId), true);

  trace.tool('exa.search', { q: 'acme' }).ok({ hits: 3 });
  trace.tool('firecrawl.scrape', { url: 'https://acme.sa' }).error('timeout');
  trace.usage({ model: 'claude-opus-5', inputTokens: 1_000_000, outputTokens: 100_000 });

  const record = await trace.finish({ status: 'ok', artifacts: [{ path: '/out/acme.md', kind: 'md' }] });

  const spans = spansOf(sent[0]);
  const root = spans[0];
  assert.equal(root.name, 'run:sales/account-enrichment');
  assert.equal(root.parentSpanId, undefined, 'the run span is the root of its own trace');
  assert.equal(spans.every((s) => s.traceId === trace.traceId), true, 'one trace per run');

  const toolSpans = spans.filter((s) => String(s.name).startsWith('tool:'));
  assert.equal(toolSpans.length, 2);
  assert.equal(toolSpans.every((s) => s.parentSpanId === root.spanId), true);

  assert.equal(record.toolCallCount, 2);
  assert.equal(record.errorCount, 1);
  assert.equal(tools.length, 2);
  assert.equal(tools[1].status, 'error');
  assert.equal(runs.length, 1);
});

test('cost is derived from published rates and says so', async () => {
  refreshEnvSecrets({});
  const { obs } = harness();
  const trace = obs.startRun({ ...ATTRIBUTION, agent: 'sales/a', agentRef: 'agnetos/sales/a', department: 'sales', trigger: 'api' });
  trace.usage({ model: 'claude-opus-5', inputTokens: 1_000_000, outputTokens: 100_000 });
  const record = await trace.finish({ status: 'ok' });

  // 1M input @ $5/MTok + 100k output @ $25/MTok = $5.00 + $2.50
  assert.equal(record.costUsd, 7.5);
  assert.equal(record.costSource, 'derived');
});

test('an SDK-reported cost beats our arithmetic', async () => {
  refreshEnvSecrets({});
  const { obs } = harness();
  const trace = obs.startRun({ ...ATTRIBUTION, agent: 'sales/a', agentRef: 'agnetos/sales/a', department: 'sales', trigger: 'api' });
  trace.usage({ model: 'claude-opus-5', inputTokens: 1_000_000, outputTokens: 100_000, costUsd: 6.9 });
  const record = await trace.finish({ status: 'ok' });
  assert.equal(record.costUsd, 6.9);
  assert.equal(record.costSource, 'sdk');
});

test('an unknown model yields no cost rather than a plausible one', async () => {
  refreshEnvSecrets({});
  const { obs } = harness();
  const trace = obs.startRun({ ...ATTRIBUTION, agent: 'sales/a', agentRef: 'agnetos/sales/a', department: 'sales', trigger: 'api' });
  trace.usage({ model: 'some-model-we-do-not-price', inputTokens: 5_000, outputTokens: 900 });
  const record = await trace.finish({ status: 'ok' });
  assert.equal(record.costUsd, null, 'standing rule 9: never invent a number');
  assert.equal(record.costSource, 'unpriced');
});

test('Sonnet 5 introductory pricing applies only until it expires', () => {
  const tokens = { inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
  assert.equal(priceRun(undefined, 'claude-sonnet-5', tokens, new Date('2026-08-15')).costUsd, 2);
  assert.equal(priceRun(undefined, 'claude-sonnet-5', tokens, new Date('2026-09-15')).costUsd, 3);
});

test('a run cannot be finished twice', async () => {
  refreshEnvSecrets({});
  const { obs, runs } = harness();
  const trace = obs.startRun({ ...ATTRIBUTION, agent: 'sales/a', agentRef: 'agnetos/sales/a', department: 'sales', trigger: 'api' });
  await trace.finish({ status: 'ok' });
  await assert.rejects(() => trace.finish({ status: 'ok' }), /already finished/);
  assert.equal(runs.length, 1, 'a double finish must not double-count a run');
});

test('a Langfuse outage does not fail the run or lose the ledger row', async () => {
  refreshEnvSecrets({});
  const runs: RunRecord[] = [];
  const warnings: string[] = [];
  const obs = createInstrumentation({
    sink: {
      async send() {
        throw new Error('connection refused');
      },
      urlFor: (id) => `http://langfuse.tailnet:3000/project/local/traces/${id}`,
    },
    ledger: {
      async recordRun(run) {
        runs.push(run);
      },
    },
    onSinkError: (_e, runId) => warnings.push(runId),
  });

  const trace = obs.startRun({ ...ATTRIBUTION, agent: 'sales/a', agentRef: 'agnetos/sales/a', department: 'sales', trigger: 'manual' });
  const record = await trace.finish({ status: 'ok' });

  assert.equal(runs.length, 1, 'the number the dashboards read is still written');
  assert.deepEqual(warnings, [record.runId]);
});

test('the activity feed reads like a sentence, not a log line', () => {
  const line = composeActivity({
    agentName: 'Follow-Up Coordinator',
    status: 'ok',
    trigger: 'schedule',
    toolCallCount: 4,
    durationMs: 42_000,
    costUsd: 0.04,
    summary: { event: 'Meeting transcript processed', detail: '4 action items assigned, recap drafted' },
  });

  assert.equal(
    renderActivityRow('09:41', line, 'Follow-Up Coordinator'),
    '09:41 Meeting transcript processed · 4 action items assigned, recap drafted — Follow-Up Coordinator',
    'this is the spec §2.5 example, verbatim',
  );
});

test('the fallback sentence is plain but never a log line', () => {
  const ok = composeActivity({
    agentName: 'Account Enrichment',
    status: 'ok',
    trigger: 'manual',
    toolCallCount: 3,
    durationMs: 42_000,
    costUsd: 0.04,
    artifacts: [{ path: '/out/acme.md', kind: 'md' }],
  });
  assert.equal(
    renderActivityRow('09:41', ok, 'Account Enrichment'),
    '09:41 Run finished · acme.md written · 3 tool calls, 42s, $0.04 — Account Enrichment',
  );

  const failed = composeActivity({
    agentName: 'Account Enrichment',
    status: 'error',
    trigger: 'manual',
    toolCallCount: 1,
    durationMs: 130_000,
    costUsd: null,
  });
  assert.equal(failed.event, 'Run failed');
  assert.equal(failed.detail, 'stopped after 1 tool call, 2m 10s');

  const waiting = composeActivity({
    agentName: 'Contract Reviewer',
    status: 'awaiting-approval',
    trigger: 'manual',
    toolCallCount: 0,
    durationMs: 900,
    costUsd: null,
  });
  assert.equal(waiting.event, 'Waiting on your approval');
});

test('durations format the way LAST RUNS shows them', () => {
  assert.equal(formatDuration(310), '310ms');
  assert.equal(formatDuration(42_000), '42s');
  assert.equal(formatDuration(130_000), '2m 10s');
  assert.equal(formatDuration(3_720_000), '1h 2m');
  assert.equal(formatDuration(null), null);
});

test('a trace sink outside our box is refused at construction', () => {
  assert.throws(() => assertLocalSink('https://us.cloud.langfuse.com'), /traces stay on our box/);
  assert.doesNotThrow(() => assertLocalSink('http://langfuse.tailnet:3000'));
});

test('the OTLP payload is well formed', () => {
  const traceId = newTraceId();
  assert.match(traceId, /^[0-9a-f]{32}$/);
  const at = new Date(1_770_000_000_000);
  assert.equal(toUnixNano(at), '1770000000000000000');

  const payload = buildOtlpPayload([
    {
      traceId,
      spanId: 'aaaaaaaaaaaaaaaa',
      name: 'run:sales/a',
      startTime: at,
      endTime: at,
      attributes: {
        'langfuse.trace.name': 'run:sales/a',
        'agnetos.count': 3,
        'agnetos.ok': true,
        'agnetos.run.id': 'r1',
        'agnetos.project.id': ATTRIBUTION.projectId,
        'agnetos.agent.ref': ATTRIBUTION.agentRef,
      },
    },
  ]) as Record<string, unknown>;

  const span = spansOf(payload)[0];
  assert.equal(span.traceId, traceId);
  const attrs = span.attributes as { key: string; value: Record<string, unknown> }[];
  assert.deepEqual(attrs.find((a) => a.key === 'agnetos.count')?.value, { intValue: '3' });
  assert.deepEqual(attrs.find((a) => a.key === 'agnetos.ok')?.value, { boolValue: true });
  assert.deepEqual(span.status, { code: 1 });
});

// ---------------------------------------------------------------------------------
// The project axis on the trace plane (PDPL rule 4 · rule 7 · `Plan §22` sign-off).
//
// Structural, and labelled structural: zero runs have ever executed, so no span has ever
// been shipped to a real Langfuse with or without these attributes. What these tests
// prove is that the runner *emits* them and that a span without them cannot be written.
// They do not prove that Langfuse indexes them, because nothing has ever been indexed.
// ---------------------------------------------------------------------------------

function attrOf(span: Record<string, unknown>, key: string): string | undefined {
  const attrs = span.attributes as { key: string; value: Record<string, string> }[];
  return attrs.find((a) => a.key === key)?.value.stringValue;
}

test('every span a run emits names its project — not only the root', async () => {
  refreshEnvSecrets({});
  const { obs, sent } = harness();

  const trace = obs.startRun({
    ...ATTRIBUTION,
    agent: 'sales/account-enrichment',
    department: 'sales',
    trigger: 'manual',
  });
  trace.tool('exa.search', { q: 'acme' }).ok({ hits: 3 });
  trace.tool('firecrawl.scrape', { url: 'https://acme.sa' }).error('timeout');
  trace.event('plan', { note: 'drafted' });
  trace.usage({ model: 'claude-opus-5', inputTokens: 10, outputTokens: 10 });
  await trace.finish({ status: 'ok' });

  const spans = spansOf(sent[0]);
  // root + 2 tools + 1 event + 1 generation. Named so a future span type that forgets
  // the scope fails the count as well as the attribute.
  assert.equal(spans.length, 5);
  for (const span of spans) {
    assert.equal(
      attrOf(span, 'agnetos.project.id'),
      ATTRIBUTION.projectId,
      `span ${String(span.name)} must carry its project`,
    );
    assert.equal(attrOf(span, 'agnetos.agent.ref'), ATTRIBUTION.agentRef);
  }
});

test('a span that cannot name its project does not compile', () => {
  // The point of the whole change: this is a *type* error, caught by
  // `npx tsc --noEmit -p apps/runner/tsconfig.json`, not a runtime check anybody can
  // forget to run. `@ts-expect-error` fails the typecheck if the error ever stops
  // happening, so deleting `SpanScope` from `OtelSpan` breaks this test rather than
  // quietly re-opening the hole.
  const unscoped = () =>
    buildOtlpPayload([
      {
        traceId: newTraceId(),
        spanId: 'aaaaaaaaaaaaaaaa',
        name: 'run:sales/a',
        startTime: new Date(0),
        endTime: new Date(0),
        // @ts-expect-error — attributes without `SpanScope` is not a valid span
        attributes: { 'langfuse.trace.name': 'run:sales/a' },
      },
    ]);
  assert.equal(typeof unscoped, 'function');
});

test('the trace carries a project handle at trace level, which is what erasure selects on', async () => {
  refreshEnvSecrets({});
  const { obs, sent } = harness();
  const trace = obs.startRun({ ...ATTRIBUTION, agent: 'sales/a', department: 'sales', trigger: 'api' });
  await trace.finish({ status: 'ok' });

  const root = spansOf(sent[0])[0];
  // Span-level `agnetos.project.id` survives an observation export; trace-level
  // `langfuse.trace.metadata.project` is what a *trace list* filters on. Erasure needs
  // the second one, so both are asserted rather than one standing in for the other.
  assert.equal(attrOf(root, 'langfuse.trace.metadata.project'), ATTRIBUTION.projectId);
  assert.equal(attrOf(root, 'langfuse.trace.metadata.agent_ref'), ATTRIBUTION.agentRef);
  assert.equal(attrOf(root, 'langfuse.trace.metadata.source_ref'), ATTRIBUTION.sourceRef);
});

test("two projects' traces are separable by attribute, which they were not before", async () => {
  refreshEnvSecrets({});
  const { obs, sent } = harness();
  const b = { ...ATTRIBUTION, projectId: '22222222-2222-4222-8222-222222222222', agentRef: 'client-b/sales/a' };

  const one = obs.startRun({ ...ATTRIBUTION, agent: 'sales/a', department: 'sales', trigger: 'api' });
  one.tool('exa.search').ok();
  await one.finish({ status: 'ok' });

  const two = obs.startRun({ ...b, agent: 'sales/a', department: 'sales', trigger: 'api' });
  two.tool('exa.search').ok();
  await two.finish({ status: 'ok' });

  const all = sent.flatMap((payload) => spansOf(payload));
  assert.equal(all.length, 4);
  const projectA = all.filter((s) => attrOf(s, 'agnetos.project.id') === ATTRIBUTION.projectId);
  const projectB = all.filter((s) => attrOf(s, 'agnetos.project.id') === b.projectId);
  assert.equal(projectA.length, 2);
  assert.equal(projectB.length, 2);
  assert.equal(projectA.length + projectB.length, all.length, 'no span is unattributable');
});

test('the activity line is redacted before it reaches the ledger or the feed', async () => {
  refreshEnvSecrets({});
  const { obs, runs } = harness();

  // Case 1 — the agent's own sentence. `summary` is free prose an agent chose, and it
  // is the same class of payload `runner-engineer` removed from the cross-project
  // approvals queue last night: a structured input flattened into words.
  const summarised = obs.startRun({ ...ATTRIBUTION, agent: 'sales/a', department: 'sales', trigger: 'manual' });
  const withSummary = await summarised.finish({
    status: 'ok',
    summary: { event: 'Proposal drafted', detail: 'client_name: Fatima Al-Harbi · sent for review' },
  });
  assert.equal(withSummary.activityDetail?.includes('Fatima Al-Harbi'), false);
  assert.equal(withSummary.activityEvent, 'Proposal drafted', 'the sentence survives; the payload does not');
  assert.ok(withSummary.activityDetail?.includes('sent for review'), 'redaction is surgical, not a blanket');
  assert.ok(withSummary.redactionCount >= 1, 'the activity hits are counted, not silently dropped');

  // Case 2 — no summary, so the fallback sentence is built from the artefact *filename*,
  // which the agent also chose. `<contact>-proposal.md` puts a person's address into
  // `ops.agent_runs.activity_detail` and onto the §2.5 feed, the most-read widget on the
  // dashboard. This is the half that is derived rather than received, which is why it
  // was the half with no redaction pass on it.
  const bare = obs.startRun({ ...ATTRIBUTION, agent: 'sales/a', department: 'sales', trigger: 'manual' });
  const withArtifact = await bare.finish({
    status: 'ok',
    artifacts: [{ path: '/out/fatima.alharbi@acme.sa-proposal.md', kind: 'md' }],
  });
  assert.equal(withArtifact.activityDetail?.includes('fatima.alharbi@acme.sa'), false);
  assert.ok(withArtifact.activityDetail?.includes('written'), 'the row still says a file was written');
  assert.equal(JSON.stringify(runs).includes('fatima.alharbi@acme.sa'), false, 'nor into the ledger row');
});
