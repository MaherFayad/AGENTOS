/**
 * `thread_id` through the observability plane (M16, `Plan §12`, ADR-023).
 *
 * ## What these tests are, and what they are not
 *
 * **Structural, every one of them.** Zero runs have executed in this product, no span has
 * ever been shipped to a Langfuse, and `ops.agent_runs.thread_id` has never held a value:
 * the table is empty. The chain is complete in *source* — `RunInit.threadId` → span scope
 * and trace metadata → `RunRecord.threadId` → the ledger INSERT (REQ-OBS-38) — and no link
 * of it has been observed carrying anything. So nothing below observes a thread id in a
 * real trace or a real row. What they pin is the *shape*: which parameter carries a thread,
 * which attribute a span emits, which refusal a malformed id gets, and — the two that
 * matter most — which things are deliberately **absent**.
 *
 * The absences are the point, because an absence is what gets quietly filled in:
 *
 *   1. `agnetos.thread.id` is **optional** on `SpanScope`, and a run with no thread emits
 *      no thread attribute at all. The coupling that keeps that honest is mechanical: the
 *      day a migration makes `ops.agent_runs.thread_id` NOT NULL, the last test in this
 *      file requires the type to lose its `?`.
 *   2. **The redactor cannot defend `ops.message.body`.** That is demonstrated here rather
 *      than asserted in prose, because it is the reason the rule has to be structural: a
 *      body is free text a person typed, it has no keys to deny, and the value rules only
 *      catch values with a shape a regex knows.
 */

import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { handleMetricsRequest } from '../../routes/metrics.ts';
import { GROUP_BY } from '../../db/queries.ts';
import { projectIdForSlug } from '../../lib/project.ts';
import { createInstrumentation } from '../instrument.ts';
import { redact, refreshEnvSecrets } from '../redact.ts';
import { messageSpanAttributes, type ThreadMessage } from '@agnetos/contracts';
import type { DbClient, RunAttribution, RunRecord, ToolCallRecord } from '../types.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(HERE, '..', '..', 'db', 'migrations');
const LANGFUSE_SRC = join(HERE, '..', 'langfuse.ts');

const PROJECT = { id: projectIdForSlug('agentos'), slug: 'agentos' };
const P = `/api/p/${PROJECT.slug}`;
const THREAD = '3f2a1c40-9d6b-4a21-8f0e-77c9b1d25e83';

type Call = { sql: string; params: readonly unknown[] };

function fakeDb(responder: (call: Call) => Record<string, unknown>[]): DbClient & { calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    async query(sql: string, params: readonly unknown[] = []) {
      calls.push({ sql, params });
      return { rows: responder({ sql, params }) as never[] };
    },
  };
}

const req = (url: string, db: DbClient) =>
  handleMetricsRequest('GET', url, db, { project: PROJECT, timezone: 'Asia/Riyadh' });

/* -------------------------------------------------------------------------- *
 * 1. The metrics plane answers for a thread — as a filter, not a second model
 * -------------------------------------------------------------------------- */

test('a thread narrows the same query that answers for an agent, bound, never interpolated', async () => {
  const db = fakeDb(() => [{ value: 3, runs: 3, unpriced: 0 }]);
  const res = await req(`${P}/metrics/query?metric=runs&range=7d&thread=${THREAD}&compare=false`, db);

  assert.equal(res.status, 200);
  // The project keeps $1 — the thread is an *additional* predicate and displaces nothing.
  assert.equal(db.calls[0].params[0], PROJECT.id, 'the project is still $1');
  assert.equal(db.calls[0].params[7], THREAD, 'the thread rides in $8');
  assert.match(
    db.calls[0].sql,
    /\$8::text IS NULL OR thread_id::text = \$8/,
    'compared as text so a malformed id is a no-match rather than a 500 from a uuid cast',
  );
  assert.equal(
    db.calls[0].sql.includes(THREAD),
    false,
    'the id never appears in the SQL text — a thread id is a bind parameter like every other value',
  );
});

test('a thread filter is a no-op slot when nobody asked for one', async () => {
  const db = fakeDb(() => [{ value: 1, runs: 1, unpriced: 0 }]);
  await req(`${P}/metrics/query?metric=runs&range=7d&compare=false`, db);
  assert.equal(db.calls[0].params[7], null, 'an absent thread filter binds null, not an empty string');
});

test('LAST RUNS and the activity feed both accept a thread and both carry one back', async () => {
  const runs = fakeDb(() => [
    {
      run_id: 'r1',
      agent: 'sales/account-enrichment',
      agent_name: 'Account Enrichment',
      status: 'ok',
      started_at: '2026-08-17T06:41:00.000Z',
      duration_ms: 1000,
      cost_usd: null,
      cost_source: 'unpriced',
      trace_url: null,
      thread_id: THREAD,
    },
  ]);
  const runsRes = await req(`${P}/metrics/runs?thread=${THREAD}`, runs);
  const row = (runsRes.body as { runs: Record<string, unknown>[] }).runs[0];
  assert.equal(row.threadId, THREAD, 'a LAST RUNS row says which thread it belongs to');
  assert.equal(runs.calls[0].params[5], THREAD, 'the thread rides in $6 on lastRuns');
  assert.match(runs.calls[0].sql, /SELECT[\s\S]*thread_id/, 'the column is selected, not derived');

  const feed = fakeDb(() => [
    {
      run_id: 'r1',
      agent: 'operations/follow-up-coordinator',
      agent_name: 'Follow-Up Coordinator',
      department: 'operations',
      status: 'ok',
      started_at: '2026-08-17T06:41:00.000Z',
      activity_event: 'Meeting transcript processed',
      activity_detail: '4 action items assigned, recap drafted',
      trace_url: null,
      thread_id: THREAD,
    },
  ]);
  const feedRes = await req(`${P}/metrics/activity?thread=${THREAD}`, feed);
  const item = (feedRes.body as { items: Record<string, unknown>[] }).items[0];
  assert.equal(item.threadId, THREAD);
  assert.equal(item.event, 'Meeting transcript processed', 'the feed is still a human sentence');
  assert.equal(feed.calls[0].params[2], THREAD, 'the thread rides in $3 on activityFeed');
});

test('a run that belongs to no thread reports null, and null is not an empty string', async () => {
  const db = fakeDb(() => [
    {
      run_id: 'r1',
      agent: 'sales/a',
      agent_name: 'A',
      status: 'ok',
      started_at: '2026-08-17T06:41:00.000Z',
      duration_ms: 1,
      cost_usd: null,
      cost_source: 'unpriced',
      trace_url: null,
      // The column is nullable by design (`0008` §3) and NULL means "this run belongs to
      // no thread". Distinct from the state of the table today, which is *empty* — there
      // are no rows at all, threaded or otherwise.
      thread_id: null,
    },
  ]);
  const res = await req(`${P}/metrics/runs`, db);
  const row = (res.body as { runs: Record<string, unknown>[] }).runs[0];
  assert.equal(row.threadId, null);
  assert.notEqual(row.threadId, '', 'an empty string would match a filter; an absent thread must not');
});

test('a malformed thread id is refused before the database, not answered with an empty list', async () => {
  const db = fakeDb(() => []);
  for (const path of ['/metrics/query?metric=runs&thread=recent', '/metrics/runs?thread=42', '/metrics/activity?thread=%27%20OR%201%3D1']) {
    const res = await req(`${P}${path}`, db);
    assert.equal(res.status, 400, path);
    const error = (res.body as { error: { code: string; hint: string } }).error;
    assert.equal(error.code, 'bad_thread', path);
    assert.match(error.hint, /ops\.thread\.id/);
  }
  assert.equal(
    db.calls.length,
    0,
    'a rejected thread must not reach the database — a text comparison would answer zero runs, ' +
      'which is the same body as a thread that genuinely has none',
  );
});

test('there is no thread rollup and no thread grouping, and both absences are deliberate', async () => {
  const db = fakeDb(() => []);
  const res = await req(`${P}/metrics/threads`, db);
  assert.equal(res.status, 404, 'a thread rollup would be a second way to compute cost and runs');
  assert.equal(db.calls.length, 0);

  // A `groupBy: thread` would render a bar-list of uuids: a thread has no title by
  // decision (`contracts/thread-model.md` §9.6). Pinned so adding one is a deliberate act.
  assert.deepEqual(Object.keys(GROUP_BY), ['agent', 'department']);
});

/* -------------------------------------------------------------------------- *
 * 2. The span scope — optional on purpose, and coupled to the ledger
 * -------------------------------------------------------------------------- */

const ATTRIBUTION: RunAttribution = {
  projectId: '11111111-1111-4111-8111-111111111111',
  agentRef: 'agnetos/sales/account-enrichment',
  sourceRef: 'project:agents/sales/account-enrichment/SKILL.md@sha256:abc',
  // Required as of `0009_run_thread_required.sql`. Edited by `runner-engineer` with that
  // migration, which is the event the last test in this file was written to trigger on.
  threadId: THREAD,
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

const attrValue = (span: Record<string, unknown>, key: string): unknown => {
  const attrs = span.attributes as { key: string; value: Record<string, unknown> }[];
  const found = attrs.find((a) => a.key === key);
  return found ? Object.values(found.value)[0] : undefined;
};

const attrKeys = (span: Record<string, unknown>): string[] =>
  (span.attributes as { key: string }[]).map((a) => a.key);

test('every span of a threaded run names its thread, and the trace names it once more', async () => {
  refreshEnvSecrets({});
  const { obs, sent, runs } = harness();

  const trace = obs.startRun({
    ...ATTRIBUTION,
    agent: 'sales/account-enrichment',
    department: 'sales',
    trigger: 'manual',
    threadId: THREAD,
  });
  trace.tool('exa.search', { q: 'acme' }).ok({ hits: 1 });
  trace.usage({ model: 'claude-opus-5', inputTokens: 10, outputTokens: 2 });
  trace.event('plan', { steps: 2 });
  await trace.finish({ status: 'ok' });

  const spans = spansOf(sent[0]);
  assert.ok(spans.length >= 4, 'root + tool + generation + event');
  for (const span of spans) {
    assert.equal(
      attrValue(span, 'agnetos.thread.id'),
      THREAD,
      `span "${span.name}" lost the thread — the scope is spread, not re-typed per span`,
    );
    // The correlation key is added; the project axis is not disturbed by it.
    assert.equal(attrValue(span, 'agnetos.project.id'), ATTRIBUTION.projectId);
  }

  // Trace-*level* metadata as well as the per-span attribute, because "show me this
  // thread's four runs" is a trace-list filter and a trace list filters on metadata.
  assert.equal(attrValue(spans[0], 'langfuse.trace.metadata.thread'), THREAD);

  // One run, one trace. A thread spanning four runs is four traces (ADR-023, invariant 1);
  // nothing here merges them, and the id is what correlates them.
  const traceIds = new Set(spans.map((s) => s.traceId));
  assert.equal(traceIds.size, 1);
  assert.equal(runs[0].threadId, THREAD, 'the ledger record carries it — see REQ-OBS-38 for the writer');
});

/**
 * **Replaces *"a run with no thread emits no thread attribute at all"*, and the replacement
 * is the same assertion one layer up.**
 *
 * That test asserted the shape of an absence: a run with no thread emitted no thread key,
 * rather than an empty one a filter could match by accident. It was the right test while
 * `ops.agent_runs.thread_id` was nullable, because *"this run has no thread"* was then a
 * legal row. `0009_run_thread_required.sql` deletes that row, so the behaviour it described
 * is no longer reachable — and a test whose premise cannot be constructed is not a passing
 * test, it is a vacuous one.
 *
 * So the absence moves from runtime to the compiler, which is strictly stronger: there is no
 * emit path to check, because there is no call that omits a thread. Runner tests are inside
 * `tsc --noEmit` (the runner's have always been — `apps/web`'s were the excluded suite), so
 * `@ts-expect-error` here is a live gate: delete the `?`-removal from `RunInit.threadId` and
 * this file fails to compile on an *unused* expectation.
 */
test('a run cannot be started without a thread — the absence is a compile error now', async () => {
  refreshEnvSecrets({});
  const { obs, sent, runs } = harness();

  const withoutThread = {
    projectId: ATTRIBUTION.projectId,
    agentRef: ATTRIBUTION.agentRef,
    sourceRef: ATTRIBUTION.sourceRef,
    agent: 'sales/account-enrichment',
    department: 'sales',
    trigger: 'manual',
  } as const;
  // @ts-expect-error `RunInit.threadId` is required as of 0009: a run that cannot name its
  // thread is a row `ops.agent_runs` refuses, and it would refuse it after the model was
  // paid for. If this line ever compiles, the type and the migration have come apart.
  void (() => obs.startRun(withoutThread));

  // And the positive half, so this is not only a type assertion: the id that is supplied
  // reaches both planes, and the record carries a string rather than a nullable.
  const trace = obs.startRun({ ...ATTRIBUTION, agent: 'sales/account-enrichment', department: 'sales', trigger: 'manual' });
  trace.tool('exa.search').ok();
  await trace.finish({ status: 'ok' });

  for (const span of spansOf(sent[0])) {
    assert.equal(attrValue(span, 'agnetos.thread.id'), THREAD, `span "${span.name}" lost the thread`);
    assert.equal(attrKeys(span).includes('agnetos.thread.id'), true);
  }
  assert.equal(runs[0].threadId, THREAD, 'the record carries the id, and the type is no longer nullable');
});

test("the span scope's required set tracks the ledger's NOT NULL set", async () => {
  // The whole judgement in one executable form. `agnetos.thread.id` is optional on
  // `SpanScope` because `ops.agent_runs.thread_id` is nullable, and it is nullable because
  // its writer does not name it yet (`0008_threads.sql` §3 — a NOT NULL nobody can satisfy
  // and one that holds are identical in a schema dump). The day that changes, this test
  // requires the type to change with it, with no database and no run.
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();
  let ledgerThreadIsMandatory = false;
  for (const file of files) {
    const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
    // Line comments stripped first: 0008's own prose discusses `SET NOT NULL` at length,
    // and a checker that reads a paragraph as a schema change is a checker that cried wolf.
    const code = sql.replace(/^\s*--.*$/gm, '');
    if (/ALTER\s+COLUMN\s+thread_id\s+SET\s+NOT\s+NULL/i.test(code)) ledgerThreadIsMandatory = true;
    if (/ADD\s+COLUMN[^;]*\bthread_id\s+uuid\s+NOT\s+NULL/i.test(code)) ledgerThreadIsMandatory = true;
  }

  const source = await readFile(LANGFUSE_SRC, 'utf8');
  const optionalInScope = /'agnetos\.thread\.id'\?\s*:/.test(source);
  const requiredInScope = /'agnetos\.thread\.id'\s*:/.test(source) && !optionalInScope;

  assert.equal(
    optionalInScope || requiredInScope,
    true,
    'SpanScope no longer declares agnetos.thread.id at all — a thread would stop reaching traces silently',
  );

  if (ledgerThreadIsMandatory) {
    assert.equal(
      requiredInScope,
      true,
      'ops.agent_runs.thread_id is now NOT NULL, so every run has a thread and a span that ' +
        'cannot name it must stop compiling. Remove the `?` from `agnetos.thread.id` in ' +
        'observability/langfuse.ts.',
    );
  } else {
    assert.equal(
      optionalInScope,
      true,
      'ops.agent_runs.thread_id is still nullable and nothing writes it, so requiring it on ' +
        'SpanScope would force every call site to invent one — a fabricated correlation key ' +
        'on every trace in the product.',
    );
  }
});

test('the ledger writer names thread_id, so the read plane is reading something real', async () => {
  // The seam this whole slice depends on, asserted from my side. `recordRun` is
  // `runner-engineer`'s writer and landed the column during this milestone; until it did,
  // every `threadId` the metrics plane returns was `null` no matter what `RunInit` carried,
  // which is a read plane that looks wired and answers nothing.
  //
  // Asserted on the statement rather than on a database, for the reason
  // `ledger-project-axis.test.ts` gives: `tsc` cannot see a column list inside a template
  // literal, and `PREPARE` plans without evaluating a value. This is the check that can run
  // with no Postgres, which matters because the three tests that need one skip on
  // `DATABASE_URL`.
  const statements: { sql: string; params: readonly unknown[] }[] = [];
  const db: DbClient = {
    async query(sql: string, params: readonly unknown[] = []) {
      statements.push({ sql, params });
      return { rows: [] as never[] };
    },
  };

  const record = {
    runId: 'run_probe',
    traceId: 'trace_probe',
    traceUrl: null,
    agent: 'sales/probe',
    agentName: 'Probe',
    department: 'sales',
    model: null,
    trigger: 'manual',
    sessionId: null,
    threadId: THREAD,
    dryRun: false,
    status: 'ok',
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    durationMs: 1,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    costUsd: null,
    costSource: 'unpriced',
    toolCallCount: 0,
    errorCount: 0,
    redactionCount: 0,
    activityEvent: 'Probe',
    activityDetail: null,
    error: null,
    projectId: projectIdForSlug('agentos'),
    agentRef: 'agentos/sales/probe',
    sourceRef: 'project:agents/sales/probe/SKILL.md@sha256:probe',
    accountId: null,
    accountSource: 'unattributed',
  } satisfies RunRecord;

  const { createLedger } = await import('../../db/ledger.ts');
  await createLedger(db).recordRun(record, []);

  const insert = statements[0];
  assert.match(insert.sql, /INSERT INTO ops\.agent_runs/);
  assert.match(insert.sql, /\bthread_id\b/, 'the INSERT must name the column, not merely have one');
  assert.equal(
    insert.params.includes(THREAD),
    true,
    'the record\'s threadId must reach the bind array — a named column bound to nothing is the ' +
      'same silent gap as an unnamed one',
  );

  /**
   * **The null case was legal under `0008` §3 and is refused under `0009`.**
   *
   * It used to assert that a run with no thread still records — correct while the column was
   * nullable. `0009_run_thread_required.sql` makes it NOT NULL, so the same call now produces
   * a row Postgres rejects with `23502`, **after the model has been paid for**. `recordRun`
   * refuses it one process earlier and names the layer that forgot, which is the whole of
   * M15's lesson expressed as a branch.
   *
   * Asserted through a cast, because the type already forbids it: this is the runtime half of
   * a boundary the compiler covers, and the value it guards against arrives from a database
   * read or a JSON body where `tsc` has nothing to check.
   */
  statements.length = 0;
  await assert.rejects(
    () => createLedger(db).recordRun({ ...record, threadId: null } as unknown as typeof record, []),
    (err: { code?: string; message?: string }) => {
      assert.equal(err.code, 'run_unattributed');
      assert.match(String(err.message), /threadId/);
      return true;
    },
  );
  assert.equal(statements.length, 0, 'and nothing reached the database — the refusal is before the INSERT');
});

/* -------------------------------------------------------------------------- *
 * 3. `ops.message` — what a trace may carry from a body, and why it is structural
 * -------------------------------------------------------------------------- */

const message = (over: Partial<ThreadMessage> = {}): ThreadMessage => ({
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  threadId: THREAD,
  projectId: PROJECT.id,
  seq: 1,
  kind: 'human',
  interrupt: 'note',
  author: 'human:maher',
  body: 'Chase Fatima Al-Harbi about the Olaya lease — she wants to move in March.',
  payload: null,
  inReplyTo: null,
  expiresAt: null,
  deliveredAt: null,
  createdAt: '2026-08-17T06:41:00.000Z',
  ...over,
});

test('the redactor cannot defend a message body, and that is why the rule is structural', () => {
  refreshEnvSecrets({});
  // A body a person would actually type. No denylisted keys — there are no keys at all —
  // and no value with a shape a regex knows: not an email, not a phone, not an IBAN, not a
  // national id. The name and the location survive the full redaction pass untouched.
  const body = message().body;
  const { value, hits } = redact(body, 'probe');

  assert.equal(value, body, 'redact() returned the body verbatim');
  assert.deepEqual(hits, [], 'nothing fired: free text has no keys to deny');
  assert.match(String(value), /Fatima Al-Harbi/, 'the subject is still named');

  // Contrast, so the demonstration is not read as "the redactor is broken". The same
  // content as an OBJECT is caught by the key pass — which is exactly the finding that has
  // now appeared four times: flattening defeats key-based redaction, and a message body is
  // already flat by construction.
  const structured = redact({ client_name: 'Fatima Al-Harbi' }, 'probe');
  assert.equal((structured.value as Record<string, string>).client_name, '[REDACTED:clientname]');
  assert.equal(structured.hits.length, 1);
});

test('the message projection has no field a body could arrive in', () => {
  const m = message({ payload: { option_a: 'renew', client_name: 'Fatima Al-Harbi' } });
  const projected = messageSpanAttributes(m);
  const serialised = JSON.stringify(projected);

  // Not "the body was redacted" — there is nowhere for it to be. The type has no `body`
  // field, so the omission is enforced by the compiler rather than by this assertion; the
  // assertion is here to catch a future field that reintroduces content by another name.
  assert.equal('body' in projected, false);
  assert.equal('payload' in projected, false);
  for (const fragment of ['Fatima', 'Al-Harbi', 'Olaya', 'renew', 'lease']) {
    assert.equal(
      serialised.includes(fragment),
      false,
      `"${fragment}" reached the span projection — a message body must never become a span attribute`,
    );
  }

  // What it may carry: ids, a kind, a level, and two counts. `bodyChars` is a length, and
  // a length is not content — it exists so "the human sent something and the agent read
  // nothing" and "the human sent nothing" are different rows on a trace.
  assert.deepEqual(Object.keys(projected).sort(), [
    'bodyChars',
    'hasPayload',
    'interrupt',
    'kind',
    'messageId',
    'payloadKeys',
    'threadId',
  ]);
  assert.equal(projected.bodyChars, m.body.length);
  assert.equal(projected.payloadKeys, 2, 'how many keys, never which ones and never their values');
});
