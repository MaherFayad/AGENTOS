/**
 * Fastify mount for the metrics API (§3.5) and the ADR-008 prune hook.
 *
 * `handleMetricsRequest` stays framework-agnostic so tests don't need Fastify.
 *
 * **The db is a getter, not a value.** It used to be `services.obs?.db ?? null`, read once
 * at registration — so even after the runner reconnected to Postgres, these routes kept
 * serving the `null` they were born with. Reading through `ledger.current()` on every
 * request is what makes `createLedgerConnection`'s reconnect visible to a caller.
 *
 * Missing Postgres is not a boot failure. But it is also not an empty result:
 *
 *   - **connected + no rows** → `200 {runs: [], ledger:{state:"connected"}}` and
 *     `{usd:null, runs:0}`. There genuinely were no runs. The honest empty state.
 *   - **unreachable / absent** → `200 {usd:null, runs:null, ledger:{state:"unreachable"}}`
 *     on the ticker and `503 metrics_unavailable` elsewhere. We do not know how many runs
 *     there were, so the count is `null`.
 *
 * A count we do not have is `null`, never `0` — that one rule is what stops a broken
 * ledger from impersonating the honest empty state (BOARD rule 9, Part VII.3). `ledger` is
 * attached to **every** response from these routes, success and failure alike, so no
 * consumer has to infer reachability from the shape of a payload.
 *
 * `POST /api/ops/prune` is ofelia-only (nightly). Never called from metrics GETs
 * or from `POST /api/run`.
 *
 * `GET /api/runs` is deliberately unmounted — runner-engineer serves it.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { LedgerHealth } from '@agnetos/contracts';
import type { DbClient } from '../observability/types.ts';
import { handleMetricsRequest } from './metrics.ts';
import { handleOpsPruneRequest } from './ops-prune.ts';

const DEFAULT_TIMEZONE = process.env.CC_TIMEZONE ?? 'Asia/Riyadh';

export interface MetricsMount {
  /** The live ledger handle, or `null`. Called per request — never captured. */
  db: () => DbClient | null;
  health: () => LedgerHealth;
  /** Lets a connection-class query failure re-enter the supervisor's retry loop. */
  reportQueryError?: (error: unknown) => void;
}

/**
 * The ticker's body when the ledger cannot be read. Shape-compatible with the healthy
 * body so `CostTicker` still renders, but every count is `null` rather than `0`: the
 * difference between "nothing was spent" and "we cannot say what was spent".
 */
function unknownCostBody(health: LedgerHealth): Record<string, unknown> {
  return {
    usd: null,
    runs: null,
    unpricedRuns: null,
    ledger: health,
    timezone: DEFAULT_TIMEZONE,
    asOf: new Date().toISOString(),
  };
}

function pathnameOf(url: string): string {
  return url.split('?')[0]?.replace(/\/+$/, '') || '/';
}

/** Attach `ledger` to any object body without disturbing what the handler produced. */
function withLedger(body: unknown, health: LedgerHealth): unknown {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return body;
  return { ...(body as Record<string, unknown>), ledger: health };
}

export function registerMetricsRoutes(app: FastifyInstance, mount: MetricsMount): void {
  const unavailable = (reply: FastifyReply, health: LedgerHealth): FastifyReply =>
    reply.code(503).send({
      error: {
        code: 'metrics_unavailable',
        message:
          health.state === 'absent'
            ? 'This runner has no run ledger configured.'
            : 'The run ledger is not answering.',
        hint: health.hint,
      },
      // Deliberately a sibling of `error`, not inside it: a consumer that only knows how
      // to render `{error:{code,message,hint}}` is unaffected, and one that wants to tell
      // "down" from "not configured" has a typed field instead of a string match.
      ledger: health,
    });

  const dispatch = async (request: FastifyRequest, reply: FastifyReply) => {
    const db = mount.db();
    const health = mount.health();

    if (!db) {
      if (pathnameOf(request.url) === '/api/cost/today') {
        return reply.code(200).send(unknownCostBody(health));
      }
      return unavailable(reply, health);
    }

    try {
      const result = await handleMetricsRequest(request.method, request.url, db);
      // `handleMetricsRequest` swallows query failures into its own 503. Re-read health
      // after the call so a connection that died mid-request is reported as dead, not as
      // the "connected" it was when the request arrived.
      return reply.code(result.status).send(withLedger(result.body, mount.health()));
    } catch (err) {
      mount.reportQueryError?.(err);
      return unavailable(reply, mount.health());
    }
  };

  const prune = async (request: FastifyRequest, reply: FastifyReply) => {
    const db = mount.db();
    if (!db) {
      const health = mount.health();
      return reply.code(503).send({
        error: {
          code: 'metrics_unavailable',
          message:
            health.state === 'absent'
              ? 'This runner has no run ledger configured, so there is nothing to prune.'
              : 'The run ledger is not answering.',
          hint: 'Retention prune needs Postgres. ofelia will retry on the next nightly tick.',
        },
        ledger: health,
      });
    }
    const result = await handleOpsPruneRequest(request.method, request.url, db);
    return reply.code(result.status).send(result.body);
  };

  app.get('/api/cost/today', dispatch);
  app.get('/api/metrics/live', dispatch);
  app.get('/api/metrics/status', dispatch);
  app.get('/api/metrics/query', dispatch);
  app.get('/api/metrics/activity', dispatch);
  app.get('/api/metrics/runs', dispatch);
  app.get('/api/metrics/sql', dispatch);
  app.get('/api/metrics/sql/:name', dispatch);
  app.get('/api/runs/:runId/tools', dispatch);
  app.post('/api/ops/prune', prune);
}
