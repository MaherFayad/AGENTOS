/**
 * Fastify mount for the metrics API (§3.5) and the ADR-008 prune hook.
 *
 * `handleMetricsRequest` stays framework-agnostic so tests don't need Fastify.
 * `registerApi` calls this with the ledger from `createObservability`, or `null`
 * when `--profile dev` has no Postgres.
 *
 * Missing Postgres is not a boot failure. `GET /api/cost/today` still answers
 * `{ usd: null }` so CostTicker renders `no cost data` rather than 404-ing.
 * Other metrics routes answer `metrics_unavailable`.
 *
 * `POST /api/ops/prune` is ofelia-only (nightly). Never called from metrics GETs
 * or from `POST /api/run`.
 *
 * `GET /api/runs` is deliberately unmounted — runner-engineer serves it.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { PoolHandle } from '../db/client.ts';
import { handleMetricsRequest } from './metrics.ts';
import { handleOpsPruneRequest } from './ops-prune.ts';

const DEFAULT_TIMEZONE = process.env.CC_TIMEZONE ?? 'Asia/Riyadh';

function emptyCostBody(): Record<string, unknown> {
  return {
    usd: null,
    runs: 0,
    unpricedRuns: 0,
    timezone: DEFAULT_TIMEZONE,
    asOf: new Date().toISOString(),
  };
}

function pathnameOf(url: string): string {
  return url.split('?')[0]?.replace(/\/+$/, '') || '/';
}

export function registerMetricsRoutes(app: FastifyInstance, db: PoolHandle | null): void {
  const dispatch = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!db) {
      if (pathnameOf(request.url) === '/api/cost/today') {
        return reply.code(200).send(emptyCostBody());
      }
      return reply.code(503).send({
        error: {
          code: 'metrics_unavailable',
          message: 'The metrics database is not answering.',
          hint: 'The metrics database is not answering. Runs still work; numbers will fill in once it is back.',
        },
      });
    }
    const result = await handleMetricsRequest(request.method, request.url, db);
    return reply.code(result.status).send(result.body);
  };

  const prune = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!db) {
      return reply.code(503).send({
        error: {
          code: 'metrics_unavailable',
          message: 'The metrics database is not answering.',
          hint: 'Retention prune needs Postgres. ofelia will retry on the next nightly tick.',
        },
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
