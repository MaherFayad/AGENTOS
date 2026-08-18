/**
 * The write path (§3.5). The runner writes; the panels read.
 *
 * Two things get written here and nothing else:
 *   - `recordRun`    — the ops ledger row + its tool spans, at the end of every run.
 *   - `writeOutput`  — a structured business row, when an agent produces one.
 *
 * `writeOutput` is exposed to agents through the runner, never directly: an agent
 * cannot name a table, cannot supply SQL, and cannot write outside `app.agent_outputs`.
 * Its payload goes through the same redaction layer as a trace on the way in, so an
 * agent that scrapes a client's contact page cannot durably persist the PII it found.
 */

import { redact } from '../observability/redact.ts';
import type { DbClient, RunRecord, ToolCallRecord } from '../observability/types.ts';
import type { RunLedger } from '../observability/instrument.ts';

/**
 * A run that cannot say which project it belongs to, which agent it *is* under the cascade,
 * and which file it executed, is **not written**.
 *
 * Migration 0005 made `project_id`, `agent_ref`, `source_ref` and `account_source` NOT NULL
 * on `ops.agent_runs` and did not update this writer — so until this existed, the first run
 * against a migrated database would have failed on a Postgres NOT NULL violation naming a
 * column, with no hint of which layer of the runner forgot to pass it. The migration and its
 * only writer are one change; this is the half that was missing.
 *
 * Refusing rather than defaulting is the same decision as `assertProjectId` on the read
 * path (`db/scope.ts`), for the same reason: a default here would attribute one project's
 * run to another, permanently, in the table every cost and liveness number is read from.
 * `agent_ref` could plausibly be rebuilt as `${project}/${agent}`; `source_ref` could not.
 * Reconstructing one and not the other would produce a row that looks complete and is half
 * invented — which is worse than a row that never existed, because it is quotable.
 */
function assertAttributed(run: RunRecord): asserts run is RunRecord & {
  projectId: string;
  agentRef: string;
  sourceRef: string;
  threadId: string;
} {
  // `threadId` joins the three as of `0009_run_thread_required.sql`: the column is NOT NULL,
  // so a record without one is a row Postgres refuses — and it refuses it *after* the model
  // was paid for, naming a column and no layer. The same refusal, one process earlier, says
  // which runner path forgot. It is a type error too; this is the runtime half, for the same
  // reason the other three have one: `tsc` cannot see a value that arrives from a boundary.
  const missing = (['projectId', 'agentRef', 'sourceRef', 'threadId'] as const).filter((key) => !run[key]);
  if (missing.length === 0) return;
  throw Object.assign(
    new Error(
      `Run ${run.runId} reached the ledger with no ${missing.join(', ')}. This is a wiring ` +
        'fault in the runner, not a bad request: the run happened, and recording it under a ' +
        'guessed project or a reconstructed source would put an invented row in the table ' +
        'every cost and liveness figure is read from. Pass them on RunInit at startRun().',
    ),
    { code: 'run_unattributed' },
  );
}

export function createLedger(db: DbClient): RunLedger {
  return {
    async recordRun(run: RunRecord, toolCalls: ToolCallRecord[]): Promise<void> {
      assertAttributed(run);

      // `agent_ref LIKE '%/' || agent` is a CHECK on the table (migration 0005 §4a). Mirrored
      // here so the two columns are caught disagreeing in this process, where the message can
      // name both, rather than as a constraint violation after the run has already finished.
      if (!run.agentRef.endsWith(`/${run.agent}`)) {
        throw Object.assign(
          new Error(
            `Run ${run.runId} has agent_ref "${run.agentRef}" and agent "${run.agent}", which ` +
              'disagree about which agent this row belongs to.',
          ),
          { code: 'agent_ref_mismatch' },
        );
      }

      await db.query(
        `INSERT INTO ops.agent_runs (
           run_id, trace_id, trace_url, agent, agent_name, department, model,
           trigger, session_id, dry_run, status, started_at, ended_at, duration_ms,
           input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
           cost_usd, cost_source, tool_call_count, error_count, redaction_count,
           activity_event, activity_detail, error,
           project_id, agent_ref, source_ref, account_id, account_source,
           thread_id
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
           $15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,
           $27,$28,$29,$30,$31,$32
         )
         ON CONFLICT (run_id) DO NOTHING`,
        [
          run.runId, run.traceId, run.traceUrl, run.agent, run.agentName, run.department, run.model,
          run.trigger, run.sessionId, run.dryRun, run.status, run.startedAt, run.endedAt, run.durationMs,
          run.inputTokens, run.outputTokens, run.cacheReadTokens, run.cacheWriteTokens,
          run.costUsd, run.costSource, run.toolCallCount, run.errorCount, run.redactionCount,
          run.activityEvent, run.activityDetail, run.error,
          run.projectId, run.agentRef, run.sourceRef, run.accountId, run.accountSource,
          /**
           * **`thread_id` — the column `0008` left for this writer, now `NOT NULL`**
           * (ADR-023, `Plan §12`, `0009_run_thread_required.sql`).
           *
           * `0008` §3 shipped it nullable and said why in full: a `NOT NULL` its only writer
           * cannot satisfy is indistinguishable in a schema dump from one that holds — the
           * M15 defect, in the same table, six weeks later. `0009` is the other side of that
           * grading, and this line is why it was allowed to land: the writer names the
           * column, `startRun` opens or continues a thread before the trace exists, and
           * `RunRecord.threadId` is `string` rather than `string | null`, so there is no
           * `?? null` left for an unthreaded run to arrive through.
           *
           * The `assertAttributed` refusal above covers it, and the ordering matters: a
           * missing thread here is a wiring fault that names itself in one sentence, rather
           * than a Postgres `23502` arriving after the run has already been paid for.
           */
          run.threadId,
        ],
      );

      for (const call of toolCalls) {
        await db.query(
          `INSERT INTO ops.agent_run_tools (run_id, span_id, seq, name, status, started_at, duration_ms, error)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (run_id, seq) DO NOTHING`,
          [call.runId, call.spanId, call.seq, call.name, call.status, call.startedAt, call.durationMs, call.error],
        );
      }
    },
  };
}

export type AgentOutput = {
  runId: string | null;
  /**
   * `ops.project.id`. **Required**, and required for the sharpest reason in the schema: two
   * clients with a deal keyed `ACME-1` used to collide through a unique index on
   * `(kind, entity_key)` — one client's business row silently overwritten by another's.
   * Migration 0005 widened the index to `(project_id, kind, entity_key)`; this is the
   * parameter that makes the upsert target it.
   */
  projectId: string;
  agent: string;
  department: string;
  /** Logical row type: 'deal', 'engagement', 'spend_line', … */
  kind: string;
  /** Business identity. Supply it and a re-run updates rather than duplicates. */
  entityKey?: string | null;
  occurredAt?: string;
  payload: Record<string, unknown>;
};

const KIND_PATTERN = /^[a-z][a-z0-9_]{1,48}$/;

/**
 * Write one structured business row. Returns the row id.
 *
 * `kind` is constrained to a slug because it is the handle panels filter on — a kind
 * with a space in it is a typo that would quietly produce an empty widget.
 */
export async function writeOutput(db: DbClient, output: AgentOutput): Promise<number> {
  if (!KIND_PATTERN.test(output.kind)) {
    throw Object.assign(new Error(`Invalid output kind "${output.kind}".`), {
      code: 'bad_kind',
      hint: 'Use lowercase letters, digits and underscores, e.g. "spend_line".',
    });
  }

  const { value: payload } = redact(output.payload, `output.${output.kind}`);

  const { rows } = await db.query<{ id: number }>(
    `INSERT INTO app.agent_outputs (project_id, run_id, agent, department, kind, entity_key, occurred_at, payload)
     VALUES ($1,$2,$3,$4,$5,$6, coalesce($7::timestamptz, now()), $8::jsonb)
     ON CONFLICT (project_id, kind, entity_key) WHERE entity_key IS NOT NULL
     DO UPDATE SET payload = EXCLUDED.payload,
                   run_id = EXCLUDED.run_id,
                   occurred_at = EXCLUDED.occurred_at
     RETURNING id`,
    [
      output.projectId,
      output.runId,
      output.agent,
      output.department,
      output.kind,
      output.entityKey ?? null,
      output.occurredAt ?? null,
      JSON.stringify(payload),
    ],
  );

  return rows[0]?.id ?? 0;
}
