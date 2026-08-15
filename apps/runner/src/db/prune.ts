/**
 * Retention prune (ADR-008). Called only from the nightly ofelia job via
 * `POST /api/ops/prune` — never from metrics reads or run finish.
 */

import type { DbClient } from '../observability/types.ts';

export type PruneResult = {
  spansDeleted: number;
  runsDeleted: number;
};

/**
 * Runs `ops.prune()` with ADR-008 defaults (90d spans / 400d ledger).
 * The SQL function rolls up `ops.agent_run_daily` before deleting.
 */
export async function pruneRetention(db: DbClient): Promise<PruneResult> {
  const { rows } = await db.query<{ spans_deleted: string | number; runs_deleted: string | number }>(
    'SELECT spans_deleted, runs_deleted FROM ops.prune()',
  );
  const row = rows[0];
  return {
    spansDeleted: Number(row?.spans_deleted ?? 0),
    runsDeleted: Number(row?.runs_deleted ?? 0),
  };
}
