/**
 * The project scope on the **read** path (`Plan §10`, ADR-015, migration 0005 §5).
 *
 * Ownership line, ruled by `commandcenter-orchestrator`: `runner-engineer` owns
 * `ops.project` and the write path; this module and everything downstream of it is
 * `observability-engineer`'s. It consumes the table; it never alters it.
 *
 * ## Two mechanisms, deliberately redundant, because each one alone is a claim
 *
 * 1. **A bind parameter in every statement.** Every ops query carries `project_id = $1`.
 *    This is what makes a read *correct today*, on the stack as it ships — where the
 *    compose Postgres user is a superuser and therefore **bypasses row-level security
 *    entirely**, which migration 0005 §6 states plainly and reports on `GET /api/status`
 *    as `projects.scopeEnforcement`. Relying on RLS alone right now would be trusting a
 *    policy that is not in force.
 *
 * 2. **`agnetos.project_id`, set transaction-locally, so the RLS policy can fire.** This
 *    is what makes a *forgotten* predicate fail instead of silently returning another
 *    project's rows, the moment `infra-compose-engineer` lands the non-superuser role
 *    (`project-scoping.md` invariant 8: *isolation is proved by a failing query, not by a
 *    filter*). Without it, the day that role lands is the day every metrics read starts
 *    answering 500.
 *
 * A filter is the easiest place in the system to manufacture a confident zero. One
 * mechanism would be a filter. Two is a filter plus the thing that catches the filter
 * being missing.
 *
 * ## Why the setting is transaction-local and the transaction is READ ONLY
 *
 * `set_config(..., is_local => true)` dies with the transaction, so a pooled connection
 * cannot hand a stale project scope to the next borrower — which would be *precisely* the
 * "one client's rows served under another client's name" failure, arriving through the
 * connection pool instead of through a URL. Session-level (`false`) would leak exactly
 * that way, and it would leak silently.
 *
 * `BEGIN READ ONLY` is the second half: the whole metrics surface is `GET`-only by
 * contract, so a registered "query" that tries to write fails in Postgres rather than in a
 * code review. `POST /api/ops/prune` deliberately does not come through here — it is
 * coordinator-wide by design and its function carries `SET agnetos.project_id = '*'`.
 */

import type { DbClient } from '../observability/types.ts';

/**
 * The deliberate cross-project scope. Greppable on purpose: `ops.prune` and
 * `ops.rollup_runs` carry it in their function definitions and nothing else may use it.
 */
export const CROSS_PROJECT_SCOPE = '*';

/** A pool that can lend one connection for the length of a transaction. */
export type SessionCapable = DbClient & {
  session<T>(fn: (client: DbClient) => Promise<T>): Promise<T>;
};

function isSessionCapable(db: DbClient): db is SessionCapable {
  return typeof (db as Partial<SessionCapable>).session === 'function';
}

/** `md5(...)::uuid` shape. Mirrors `ops.project_id_for` and `projectIdForSlug`. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A read that is not about a project is a bug in *this* process, not a bad request, so it
 * throws rather than returning an empty result. An empty result is the one answer that
 * would be indistinguishable from an honest empty project.
 */
export function assertProjectId(projectId: unknown): asserts projectId is string {
  if (typeof projectId !== 'string' || !UUID_RE.test(projectId)) {
    throw Object.assign(
      new Error(
        'A project-scoped read reached the database with no project id. This is a wiring ' +
          'fault in the runner, not a bad request: returning zero rows here would be ' +
          'indistinguishable from a project that has genuinely never run anything.',
      ),
      { code: 'project_scope_unset' },
    );
  }
}

/**
 * Run `fn` with the project scope in force.
 *
 * On a pool, this checks out one connection, opens a READ ONLY transaction, sets
 * `agnetos.project_id` for that transaction only, and hands the borrowed client to `fn` —
 * so every statement `fn` issues is on the same connection with the same scope.
 *
 * On a `DbClient` with no `session` (a test fake, or any single-connection handle) the
 * setting is skipped and `fn` gets the client unchanged. That is stated rather than hidden:
 * the GUC is a property of a *connection*, and setting it through a pool wrapper that
 * round-robins connections would set it on one connection and read from another — a
 * mechanism that looks like enforcement and is not. The read stays correct on that path
 * because the predicate is in the SQL, which is mechanism (1) above.
 */
export async function readInProject<T>(
  db: DbClient,
  projectId: string,
  fn: (scoped: DbClient) => Promise<T>,
): Promise<T> {
  assertProjectId(projectId);

  if (!isSessionCapable(db)) return fn(db);

  return db.session(async (client) => {
    await client.query('BEGIN READ ONLY');
    try {
      await client.query('SELECT set_config($1, $2, true)', ['agnetos.project_id', projectId]);
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // The transaction is already gone — the original error is the one that matters.
      }
      throw error;
    }
  });
}

/**
 * Postgres SQLSTATE `42501` is `insufficient_privilege`, which is what
 * `ops.project_visible()` raises when a query reaches a project-scoped table with no scope
 * set (migration 0005 §5).
 *
 * This must never be folded into `metrics_unavailable`. "The database is down" and "we
 * asked the database for rows without saying whose rows" are different faults with
 * different fixes, and the second one is the isolation guarantee doing its job — reporting
 * it as an outage would train everyone to ignore the one alarm that means a project axis
 * was forgotten.
 */
export function isScopeViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { code?: unknown }).code;
  if (code === 'project_scope_unset') return true;
  if (code !== '42501') return false;
  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' ? /project_scope_missing/.test(message) : true;
}
