/**
 * Run instrumentation (§3.2 step 5 → §3.5).
 *
 * One run = one Langfuse trace. One tool call = one span inside it, so a LAST RUNS row
 * in the drawer can deep-link straight to the thing that happened (§2.3).
 *
 * The runner's whole integration is four calls:
 *
 *   const trace = obs.startRun({ agent, department, inputs, trigger });
 *   const span  = trace.tool('exa.search', input);  span.ok(result);
 *   trace.usage({ model, inputTokens, outputTokens, costUsd });
 *   await trace.finish({ status: 'ok', artifacts, summary });
 *
 * Everything that goes in is redacted before it reaches the sink or the ledger —
 * see redact.ts. The redaction happens at the boundary of this module, once, so
 * there is no code path where a raw payload and a trace payload diverge.
 */

import { composeActivity } from './activity.ts';
import { buildOtlpPayload, newSpanId, newTraceId, type OtelSpan, type SpanScope } from './langfuse.ts';
import { priceRun } from './pricing.ts';
import { redact, type RedactionHit } from './redact.ts';
import type {
  RunInit,
  RunOutcome,
  RunRecord,
  RunTrace,
  ToolCallRecord,
  ToolSpan,
  TraceSink,
  Usage,
} from './types.ts';

/** What instrumentation needs from storage. Implemented by db/ledger.ts. */
export type RunLedger = {
  recordRun(run: RunRecord, toolCalls: ToolCallRecord[]): Promise<void>;
};

export type InstrumentationDeps = {
  sink: TraceSink;
  ledger: RunLedger;
  /** Injectable clock, so tests assert on durations instead of racing them. */
  now?: () => Date;
  newTraceId?: () => string;
  newSpanId?: () => string;
  /** Called when shipping a trace fails. Defaults to a one-line console warning. */
  onSinkError?: (error: unknown, runId: string) => void;
};

export type Instrumentation = {
  startRun(init: RunInit): RunTrace;
};

export function createInstrumentation(deps: InstrumentationDeps): Instrumentation {
  const now = deps.now ?? (() => new Date());
  const makeTraceId = deps.newTraceId ?? newTraceId;
  const makeSpanId = deps.newSpanId ?? newSpanId;
  const onSinkError =
    deps.onSinkError ??
    ((error: unknown, runId: string) => {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[observability] trace for run ${runId} not shipped: ${message}`);
    });

  function startRun(init: RunInit): RunTrace {
    const traceId = makeTraceId();
    const rootSpanId = makeSpanId();
    const runId = traceId.slice(0, 16);
    const startedAt = now();
    const traceUrl = deps.sink.urlFor(traceId);

    // Every span this run emits carries these three, because `OtelSpan.attributes` is
    // typed to require them (`SpanScope`). Computed once, spread everywhere — a span
    // that forgets is a type error at the site that added it, not a gap discovered
    // during a deletion request. See `SpanScope` for why it is a type and not a habit.
    //
    // `agnetos.thread.id` rides along and is deliberately **not** required (see
    // `SpanScope`): `attributes()` drops `undefined`, so a run with no thread emits no
    // thread attribute rather than an empty one. One run is still one trace — a thread
    // spanning four runs is four traces correlated by this id, which is the assumption
    // ADR-023 was built to leave intact.
    const scope: SpanScope = {
      'agnetos.run.id': runId,
      'agnetos.project.id': init.projectId,
      'agnetos.agent.ref': init.agentRef,
      'agnetos.thread.id': init.threadId,
    };

    const hits: RedactionHit[] = [];
    const redactedInputs = init.inputs ? redact(init.inputs, 'inputs') : null;
    if (redactedInputs) hits.push(...redactedInputs.hits);

    const spans: OtelSpan[] = [];
    const toolCalls: ToolCallRecord[] = [];
    const totals = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
    let sdkCostUsd: number | undefined;
    let model: string | null = init.model ?? null;
    let errorCount = 0;
    let finished = false;

    function tool(name: string, input?: unknown): ToolSpan {
      const spanId = makeSpanId();
      const spanStart = now();
      const seq = toolCalls.length;
      const redactedInput = input === undefined ? undefined : redact(input, `tool.${name}.input`);
      if (redactedInput) hits.push(...redactedInput.hits);
      let settled = false;

      const settle = (status: 'ok' | 'error', payload: unknown, error?: string) => {
        if (settled) return;
        settled = true;
        const spanEnd = now();
        const durationMs = spanEnd.getTime() - spanStart.getTime();
        const redactedOutput = payload === undefined ? undefined : redact(payload, `tool.${name}.output`);
        if (redactedOutput) hits.push(...redactedOutput.hits);
        const redactedError = error ? (redact(error, `tool.${name}.error`).value as string) : null;
        if (status === 'error') errorCount += 1;

        spans.push({
          traceId,
          spanId,
          parentSpanId: rootSpanId,
          name: `tool:${name}`,
          startTime: spanStart,
          endTime: spanEnd,
          error: redactedError ?? undefined,
          attributes: {
            'langfuse.observation.type': 'span',
            'langfuse.observation.input': redactedInput ? json(redactedInput.value) : undefined,
            'langfuse.observation.output': redactedOutput ? json(redactedOutput.value) : undefined,
            'agnetos.tool.name': name,
            'agnetos.tool.status': status,
            ...scope,
          },
        });

        toolCalls.push({
          runId,
          spanId,
          seq,
          name,
          status,
          startedAt: spanStart.toISOString(),
          durationMs,
          error: redactedError,
        });
      };

      return {
        ok: (output?: unknown) => settle('ok', output),
        error: (message: string) => settle('error', undefined, message),
      };
    }

    function usage(u: Usage): void {
      if (u.model) model = u.model;
      totals.inputTokens += u.inputTokens ?? 0;
      totals.outputTokens += u.outputTokens ?? 0;
      totals.cacheReadTokens += u.cacheReadTokens ?? 0;
      totals.cacheWriteTokens += u.cacheWriteTokens ?? 0;
      if (typeof u.costUsd === 'number') sdkCostUsd = (sdkCostUsd ?? 0) + u.costUsd;

      const at = now();
      spans.push({
        traceId,
        spanId: makeSpanId(),
        parentSpanId: rootSpanId,
        name: `generation:${u.model ?? model ?? 'unknown'}`,
        startTime: at,
        endTime: at,
        attributes: {
          'langfuse.observation.type': 'generation',
          'langfuse.observation.model.name': u.model ?? model ?? undefined,
          'langfuse.observation.usage_details': json({
            input: u.inputTokens ?? 0,
            output: u.outputTokens ?? 0,
            cache_read_input_tokens: u.cacheReadTokens ?? 0,
            cache_creation_input_tokens: u.cacheWriteTokens ?? 0,
          }),
          'langfuse.observation.cost_details':
            typeof u.costUsd === 'number' ? json({ total: u.costUsd }) : undefined,
          ...scope,
        },
      });
    }

    function event(name: string, detail?: unknown): void {
      const at = now();
      const redactedDetail = detail === undefined ? undefined : redact(detail, `event.${name}`);
      if (redactedDetail) hits.push(...redactedDetail.hits);
      spans.push({
        traceId,
        spanId: makeSpanId(),
        parentSpanId: rootSpanId,
        name: `event:${name}`,
        startTime: at,
        endTime: at,
        attributes: {
          'langfuse.observation.type': 'event',
          'langfuse.observation.output': redactedDetail ? json(redactedDetail.value) : undefined,
          ...scope,
        },
      });
    }

    async function finish(outcome: RunOutcome): Promise<RunRecord> {
      if (finished) throw new Error(`Run ${runId} was already finished.`);
      finished = true;

      const endedAt = now();
      const durationMs = endedAt.getTime() - startedAt.getTime();
      const { costUsd, costSource } = priceRun(sdkCostUsd, model, totals, startedAt);
      const redactedError = outcome.error ? (redact(outcome.error, 'error').value as string) : null;
      const agentName = init.agentName ?? humaniseSlug(init.agent);

      // The activity line is composed from two things a person or an agent wrote:
      // `outcome.summary` (free prose the agent chose) and an artefact *filename* (which
      // the agent also chose, and which is exactly where a name or an email ends up:
      // `ACME-fatima.alharbi@acme.sa-proposal.md`). It was going into `ops.agent_runs`
      // and onto the §2.5 feed unredacted — every other payload in this module passes
      // through `redact` and this one did not, because it is *derived* rather than
      // *received* and so did not look like an input.
      //
      // Compose first, redact after: the redactor has to see the finished sentence,
      // since the leak can straddle the join between the summary and the facts clause.
      // Still at instrumentation, still before the sink and before Postgres — rule 3 is
      // about *where* the pass runs, not about how early in this function it sits.
      const composed = composeActivity({
        agentName,
        status: outcome.status,
        trigger: init.trigger,
        toolCallCount: toolCalls.length,
        durationMs,
        costUsd,
        artifacts: outcome.artifacts,
        summary: outcome.summary,
      });
      const redactedActivity = redact(composed, 'activity');
      if (redactedActivity) hits.push(...redactedActivity.hits);
      const activity = redactedActivity.value as typeof composed;

      const record: RunRecord = {
        runId,
        traceId,
        traceUrl,
        agent: init.agent,
        agentName,
        department: init.department,
        model,
        trigger: init.trigger,
        sessionId: init.sessionId ?? null,
        // Carried onto the record because the ledger writer cannot name a column the
        // record does not hold. It is not yet in `ledger.ts`'s INSERT — that file is
        // `runner-engineer`'s and they are writing the thread-creating route in this same
        // milestone. REQ-OBS-38, declared-and-unbuilt.
        threadId: init.threadId ?? null,
        dryRun: Boolean(init.dryRun),
        status: outcome.status,
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        durationMs,
        inputTokens: totals.inputTokens,
        outputTokens: totals.outputTokens,
        cacheReadTokens: totals.cacheReadTokens,
        cacheWriteTokens: totals.cacheWriteTokens,
        costUsd,
        costSource,
        toolCallCount: toolCalls.length,
        errorCount,
        redactionCount: hits.length,
        activityEvent: activity.event,
        activityDetail: activity.detail,
        error: redactedError,
        // Carried, never derived. `agent_ref` could be reconstructed as
        // `${project}/${agent}` and `source_ref` could not — so neither is, because a
        // provenance field that is right half the time is worse than one that refuses.
        // No `?? null` on the first three any more: they are required on `RunInit`, so a
        // fallback here would be unreachable code that reads like a supported case.
        projectId: init.projectId,
        agentRef: init.agentRef,
        sourceRef: init.sourceRef,
        accountId: init.accountId ?? null,
        accountSource: init.accountSource ?? 'unattributed',
      };

      spans.unshift({
        traceId,
        spanId: rootSpanId,
        name: `run:${init.agent}`,
        startTime: startedAt,
        endTime: endedAt,
        error: redactedError ?? undefined,
        attributes: {
          'langfuse.trace.name': `run:${init.agent}`,
          'langfuse.observation.type': 'span',
          'langfuse.session.id': init.sessionId,
          'langfuse.observation.input': redactedInputs ? json(redactedInputs.value) : undefined,
          'langfuse.observation.model.name': model ?? undefined,
          'langfuse.observation.cost_details': costUsd === null ? undefined : json({ total: costUsd }),
          // Trace-*level* metadata, set on the root because that is the documented
          // mapping. `agnetos.project.id` below is on every span and is what an
          // exported observation carries; these two are what the Langfuse UI and its
          // API can filter a *trace list* on, which is the operation a deletion request
          // actually needs. Both are ids, so neither can carry client content.
          //
          // Never verified against a running Langfuse: zero runs have executed, so no
          // trace has ever been shipped with or without this attribute (Part VII.3 —
          // this is structural, and saying so is the point).
          'langfuse.trace.metadata.project': init.projectId,
          'langfuse.trace.metadata.agent_ref': init.agentRef,
          'langfuse.trace.metadata.source_ref': init.sourceRef,
          // Trace-level, and that is the point of putting it here as well as on every
          // span. "Show me this thread's four runs" is a *trace list* filter, and a trace
          // list filters on metadata; per-span attributes answer a different question.
          // Absent when the run has no thread — `attributes()` drops undefined, so a
          // threadless run carries no empty key for a filter to match on by accident.
          'langfuse.trace.metadata.thread': init.threadId,
          'langfuse.trace.metadata.agent': init.agent,
          'langfuse.trace.metadata.department': init.department,
          'langfuse.trace.metadata.trigger': init.trigger,
          'langfuse.trace.metadata.status': outcome.status,
          'langfuse.trace.metadata.dry_run': Boolean(init.dryRun),
          'langfuse.trace.metadata.cost_source': costSource,
          'langfuse.trace.metadata.redactions': hits.length,
          ...scope,
        },
      });

      // Ledger first: it is what every rendered number reads. A trace we failed to
      // ship costs us a drill-down; a run we failed to record costs us the truth.
      await deps.ledger.recordRun(record, toolCalls);

      try {
        await deps.sink.send(buildOtlpPayload(spans));
      } catch (error) {
        onSinkError(error, runId);
      }

      return record;
    }

    return { runId, traceId, traceUrl, tool, usage, event, finish };
  }

  return { startRun };
}

function json(value: unknown): string {
  try {
    return JSON.stringify(value) ?? 'null';
  } catch {
    return '"[unserialisable]"';
  }
}

/** `sales/account-enrichment` → `Account Enrichment`, for feeds when no display name is given. */
function humaniseSlug(agent: string): string {
  const leaf = agent.split('/').pop() ?? agent;
  return leaf
    .split('-')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}
