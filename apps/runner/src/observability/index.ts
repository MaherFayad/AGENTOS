/**
 * The observability module's public surface (spec §3.5).
 *
 * `runner-engineer` imports from here and nowhere else. Everything not re-exported
 * below is private and may change without a message.
 *
 * Wiring, in full:
 *
 *   import { createObservability } from './observability/index.ts';
 *   const obs = await createObservability();          // reads env, applies migrations
 *
 *   const trace = obs.startRun({ agent, department, inputs, trigger: 'manual' });
 *   sse.send('start', { runId: trace.runId, agent, traceUrl: trace.traceUrl });
 *   …
 *   const record = await trace.finish({ status: 'ok', artifacts });
 *   sse.send('done', { status: record.status, costUsd: record.costUsd,
 *                      durationMs: record.durationMs, traceUrl: record.traceUrl });
 */

export { createInstrumentation, type Instrumentation, type RunLedger } from './instrument.ts';
export { redact, redactString, refreshEnvSecrets, type RedactionHit } from './redact.ts';
export { KEY_DENYLIST, VALUE_RULES } from './redaction-rules.ts';
export { assertLocalSink, createLangfuseSink, createNullSink, sinkFromEnv } from './langfuse.ts';
export { isPriced, priceRun, PRICE_TABLE_VERSION } from './pricing.ts';
export { composeActivity, formatCost, formatDuration, renderActivityRow } from './activity.ts';
export { countLive, deriveStatus, THRESHOLDS, type AgentStatus, type DerivedStatus } from './status.ts';
export type {
  DbClient,
  RunInit,
  RunOutcome,
  RunRecord,
  RunStatus,
  RunTrace,
  RunTrigger,
  ToolCallRecord,
  ToolSpan,
  TraceSink,
  Usage,
} from './types.ts';

import { createInstrumentation, type Instrumentation } from './instrument.ts';
import { sinkFromEnv } from './langfuse.ts';
import { connect, migrate, type PoolHandle } from '../db/client.ts';
import { createLedger } from '../db/ledger.ts';

export type Observability = Instrumentation & {
  db: PoolHandle;
  close(): Promise<void>;
};

/**
 * Build the whole thing from the environment. Applies pending migrations on the way
 * up, so a fresh compose stack records its first run correctly rather than dropping it.
 */
export async function createObservability(
  env: Record<string, string | undefined> = process.env,
  /**
   * Called when an idle pooled client dies. Without a listener the Pool rethrows and the
   * runner process exits — see `db/client.ts`. `runner-engineer`'s ledger supervisor
   * passes its reconnect handler here.
   */
  onError?: (error: unknown) => void,
): Promise<Observability> {
  // Infra's compose names the business database `APP_DATABASE_URL` (Langfuse has
  // its own `DATABASE_URL` on a different database). Accept either; never the
  // Langfuse-internal URL — that would put our ledger in their schema.
  const db = await connect(env.DATABASE_URL ?? env.APP_DATABASE_URL, { onError });
  await migrate(db);
  const instrumentation = createInstrumentation({ sink: sinkFromEnv(env), ledger: createLedger(db) });
  return {
    startRun: instrumentation.startRun,
    db,
    close: () => db.end(),
  };
}
