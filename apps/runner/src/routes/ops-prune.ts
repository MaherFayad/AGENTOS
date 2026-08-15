/**
 * `POST /api/ops/prune` — ofelia's nightly retention hook (ADR-008, §3.5).
 *
 * Not a metrics read. Not called from `POST /api/run`. The SQL comment on
 * `ops.prune` says "never on the request path"; that means user-facing routes
 * must not side-effect a prune. This endpoint exists so ofelia can fire the
 * same job-run shape it uses for scheduled agents.
 */

import type { DbClient } from '../observability/types.ts';
import { pruneRetention } from '../db/prune.ts';

export type OpsPruneResponse = { status: number; body: unknown };

function fail(status: number, code: string, message: string, hint?: string): OpsPruneResponse {
  return { status, body: { error: { code, message, ...(hint ? { hint } : {}) } } };
}

export async function handleOpsPruneRequest(
  method: string,
  url: string,
  db: DbClient,
): Promise<OpsPruneResponse> {
  const path = new URL(url, 'http://runner.internal').pathname.replace(/\/+$/, '') || '/';
  if (path !== '/api/ops/prune') {
    return fail(404, 'not_found', 'Unknown ops route.');
  }
  if (method !== 'POST') {
    return fail(405, 'method_not_allowed', 'Prune is POST-only.', 'ofelia must POST /api/ops/prune.');
  }

  try {
    const result = await pruneRetention(db);
    return {
      status: 200,
      body: {
        ok: true,
        spansDeleted: result.spansDeleted,
        runsDeleted: result.runsDeleted,
        asOf: new Date().toISOString(),
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fail(
      500,
      'internal',
      'Retention prune failed.',
      `Check Postgres and ops.prune(): ${message}`,
    );
  }
}
