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
import { PROJECT_ROUTE_PREFIX, type LedgerHealth } from '@agnetos/contracts';
import type { DbClient } from '../observability/types.ts';
import { handleMetricsRequest, LEGACY_UNSCOPED_METRICS_PATHS, type MetricsProject } from './metrics.ts';
import { handleOpsPruneRequest } from './ops-prune.ts';

const DEFAULT_TIMEZONE = process.env.CC_TIMEZONE ?? 'Asia/Riyadh';

export interface MetricsMount {
  /** The live ledger handle, or `null`. Called per request — never captured. */
  db: () => DbClient | null;
  health: () => LedgerHealth;
  /** Lets a connection-class query failure re-enter the supervisor's retry loop. */
  reportQueryError?: (error: unknown) => void;
  /**
   * Turn the `:project` path segment into a project this coordinator serves, or throw one
   * of `lib/project.ts`'s three distinct refusals (`project_scope_missing`,
   * `project_not_found`, `project_not_mounted`).
   *
   * A resolver rather than an id, and per request rather than captured, for the reason the
   * `db` getter exists: a value read once at registration is a value that goes stale
   * without anyone noticing. The day this coordinator mounts a second library, a captured
   * id would serve project A's numbers on project B's URL — the failure this whole axis is
   * built to prevent, arriving through a closure.
   */
  resolveProject: (slug: unknown) => MetricsProject;
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

/** The `project` sibling, the same shape the handler attaches to a 200. */
function projectEcho(project: MetricsProject): Record<string, unknown> {
  return { slug: project.slug, id: project.id, state: 'mounted' };
}

/**
 * `lib/project.ts` throws three distinct refusals and they keep their three distinct
 * codes and statuses here.
 *
 * Flattening them into one "project problem" would undo the work: `project_not_found` sends
 * a reader looking for a typo, `project_not_mounted` sends them to another machine, and
 * `project_scope_missing` sends them to fix a URL. And none of them is a `200` with an
 * empty payload, which is the answer that would look exactly like a project that has
 * genuinely never run anything.
 */
function sendResolveError(reply: FastifyReply, err: unknown, health: LedgerHealth): FastifyReply {
  const e = err as { code?: string; message?: string; hint?: string; status?: number };
  const code = e?.code ?? 'project_scope_missing';
  const status =
    code === 'project_not_mounted' ? 503 : code === 'project_scope_missing' ? 400 : 404;
  return reply.code(status).send({
    error: {
      code,
      message: e?.message ?? 'This request did not say which project it is about.',
      hint: e?.hint,
    },
    ledger: health,
  });
}

export function registerMetricsRoutes(app: FastifyInstance, mount: MetricsMount): void {
  const unavailable = (
    reply: FastifyReply,
    health: LedgerHealth,
    project?: MetricsProject,
  ): FastifyReply =>
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
      // The project rides on the failure too. "We could not read project X" is a different
      // sentence from "we could not read", and with N projects it is the only one a reader
      // can act on.
      ...(project ? { project: projectEcho(project) } : {}),
    });

  const dispatch = async (request: FastifyRequest, reply: FastifyReply) => {
    const db = mount.db();
    const health = mount.health();

    // The project is resolved **before** the ledger is consulted, and that order is the
    // point. "You asked for a project we do not serve" and "we cannot read the ledger" are
    // different answers; resolving second would let an outage mask a wrong project name,
    // and the wrong project name is the one that comes back as somebody else's numbers
    // once the outage clears.
    let project: MetricsProject;
    try {
      project = mount.resolveProject((request.params as { project?: unknown }).project);
    } catch (err) {
      return sendResolveError(reply, err, health);
    }

    if (!db) {
      if (pathnameOf(request.url).endsWith('/cost/today')) {
        return reply.code(200).send({ ...unknownCostBody(health), project: projectEcho(project) });
      }
      return unavailable(reply, health, project);
    }

    try {
      const result = await handleMetricsRequest(request.method, request.url, db, { project });
      // `handleMetricsRequest` swallows query failures into its own 503. Re-read health
      // after the call so a connection that died mid-request is reported as dead, not as
      // the "connected" it was when the request arrived.
      return reply.code(result.status).send(withLedger(result.body, mount.health()));
    } catch (err) {
      mount.reportQueryError?.(err);
      return unavailable(reply, mount.health(), project);
    }
  };

  /**
   * The pre-project paths. A named 400, not a redirect and not a default.
   *
   * `/api/cost/today` gets the same treatment as the rest even though the ticker is chrome
   * and must not error out: a missing project segment is a **client** fault with a one-line
   * fix, not an unknown value, and answering it with a plausible `usd: null` would hide the
   * migration from the only people who can finish it.
   */
  const scopeMissing = async (request: FastifyRequest, reply: FastifyReply) => {
    const path = pathnameOf(request.url);
    return reply.code(400).send({
      error: {
        code: 'project_scope_missing',
        message: 'This metrics request did not say which project it is about.',
        hint:
          `Use ${path.replace('/api/', `${PROJECT_ROUTE_PREFIX}/`)}. There is deliberately no default ` +
          'project — a default is how one client\'s numbers get served under another client\'s name (ADR-015 Q1/Q2).',
      },
      ledger: mount.health(),
    });
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

  const P = PROJECT_ROUTE_PREFIX;
  app.get(`${P}/cost/today`, dispatch);
  app.get(`${P}/metrics/live`, dispatch);
  app.get(`${P}/metrics/status`, dispatch);
  app.get(`${P}/metrics/query`, dispatch);
  app.get(`${P}/metrics/activity`, dispatch);
  app.get(`${P}/metrics/accounts`, dispatch);
  app.get(`${P}/metrics/runs`, dispatch);
  app.get(`${P}/metrics/sql`, dispatch);
  app.get(`${P}/metrics/sql/:name`, dispatch);
  app.get(`${P}/runs/:runId/tools`, dispatch);

  for (const legacy of LEGACY_UNSCOPED_METRICS_PATHS) app.get(legacy, scopeMissing);

  /**
   * `POST /api/ops/prune` stays **coordinator-scoped**, and that is a decision rather than
   * an omission. Retention runs for the whole database on one nightly ofelia tick;
   * `ops.prune` and `ops.rollup_runs` both carry `SET agnetos.project_id = '*'` in their
   * definitions so the cross-project scope is written where the query is, not in a runbook.
   * Per-project retention windows would be a different feature and would need an ADR
   * amending ADR-008.
   */
  app.post('/api/ops/prune', prune);
}
