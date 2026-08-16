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
import type { RunRecord, ToolCallRecord } from '../types.ts';

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
  const trace = obs.startRun({ agent: 'sales/a', department: 'sales', trigger: 'api' });
  trace.usage({ model: 'claude-opus-5', inputTokens: 1_000_000, outputTokens: 100_000 });
  const record = await trace.finish({ status: 'ok' });

  // 1M input @ $5/MTok + 100k output @ $25/MTok = $5.00 + $2.50
  assert.equal(record.costUsd, 7.5);
  assert.equal(record.costSource, 'derived');
});

test('an SDK-reported cost beats our arithmetic', async () => {
  refreshEnvSecrets({});
  const { obs } = harness();
  const trace = obs.startRun({ agent: 'sales/a', department: 'sales', trigger: 'api' });
  trace.usage({ model: 'claude-opus-5', inputTokens: 1_000_000, outputTokens: 100_000, costUsd: 6.9 });
  const record = await trace.finish({ status: 'ok' });
  assert.equal(record.costUsd, 6.9);
  assert.equal(record.costSource, 'sdk');
});

test('an unknown model yields no cost rather than a plausible one', async () => {
  refreshEnvSecrets({});
  const { obs } = harness();
  const trace = obs.startRun({ agent: 'sales/a', department: 'sales', trigger: 'api' });
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
  const trace = obs.startRun({ agent: 'sales/a', department: 'sales', trigger: 'api' });
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

  const trace = obs.startRun({ agent: 'sales/a', department: 'sales', trigger: 'manual' });
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
      attributes: { 'langfuse.trace.name': 'run:sales/a', 'agnetos.count': 3, 'agnetos.ok': true },
    },
  ]) as Record<string, unknown>;

  const span = spansOf(payload)[0];
  assert.equal(span.traceId, traceId);
  const attrs = span.attributes as { key: string; value: Record<string, unknown> }[];
  assert.deepEqual(attrs.find((a) => a.key === 'agnetos.count')?.value, { intValue: '3' });
  assert.deepEqual(attrs.find((a) => a.key === 'agnetos.ok')?.value, { boolValue: true });
  assert.deepEqual(span.status, { code: 1 });
});
