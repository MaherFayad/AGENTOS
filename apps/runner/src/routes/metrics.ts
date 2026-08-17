/**
 * The metrics API (§3.5). Everything the product renders as a number comes from here.
 *
 * Framework-agnostic on purpose: `handleMetricsRequest` takes a URL and returns
 * `{status, body}`, so `runner-engineer` mounts it in one line whatever HTTP library
 * the runner settles on, and the tests exercise the real handler rather than a mock of
 * one. Errors use the uniform envelope from `contracts/api-contracts.md`:
 * `{error: {code, message, hint?}}` — `hint` is written for a human on a phone.
 *
 * Routes owned here — **every one of them names its project** (`Plan §10`, ADR-015 Q1):
 *   GET /api/p/:project/cost/today          shell cost ticker (§2.0 / §3.5)
 *   GET /api/p/:project/metrics/runs        durable LAST RUNS from the ledger
 *   GET /api/p/:project/runs/:runId/tools   span detail behind a LAST RUNS row
 *   GET /api/p/:project/metrics/live        LIVE numerator + per-department (§2.0, §2.2)
 *   GET /api/p/:project/metrics/status      derived node status, amber halo (§3.4)
 *   GET /api/p/:project/metrics/query       KPI tiles + `query.source: "langfuse"` (§2.5)
 *   GET /api/p/:project/metrics/activity    activity feed (§2.5)
 *   GET /api/p/:project/metrics/accounts    the per-account cost split (`Plan §11`)
 *   GET /api/p/:project/metrics/sql         the named-query registry
 *   GET /api/p/:project/metrics/sql/:name   `query.source: "sql"` business queries
 *
 * `GET /api/runs` is **not** here. `runner-engineer` owns that route (in-memory live
 * view). Stealing it would give LAST RUNS two owners, which is how a drawer starts
 * lying. The durable history lives at `/api/p/:project/metrics/runs`.
 *
 * ## Five ways to have no number, kept apart on purpose
 *
 * A project filter is the easiest place in this system to manufacture a confident zero.
 * Collapsing any two rows below is the bug, not the tidy-up:
 *
 * | state | answer |
 * |---|---|
 * | this project has no runs | `200` · `runs: 0`, `value: null`, `project.state: "mounted"`, `ledger.state: "connected"` |
 * | the ledger is unreachable or absent | ticker `200` with every count `null`; `503 metrics_unavailable` elsewhere; `ledger.state` says which |
 * | the request named no project | `400 project_scope_missing`, with the scoped path in the hint |
 * | the project is not one this coordinator serves | `404 project_not_found` / `503 project_not_mounted`, raised by `resolveProject` before this module runs |
 * | a query reached a scoped table with no scope set | `500 project_scope_unset` — **never** `metrics_unavailable` |
 *
 * The last one is ours rather than the caller's, and it is why it gets its own code: "the
 * database is down" and "we forgot to say whose rows we wanted" have different fixes, and
 * folding the second into the first would train everyone to ignore the single alarm that
 * means a project axis was dropped somewhere.
 *
 * ## Threads are a filter, not a route (`Plan §12`, ADR-023)
 *
 * `?thread=<uuid>` narrows `/metrics/query`, `/metrics/runs` and `/metrics/activity`, and
 * `threadId` rides on every run and activity row. **There is no `/metrics/threads`.** A
 * thread is a set of runs and a run is still a run: one run, one trace, four traces to a
 * four-run thread. Adding a thread rollup would be a second way to compute `cost` and
 * `runs`, and two ways to compute one number is how a dashboard and a drawer start
 * disagreeing about the same client's spend. Everything a thread surface needs is answered
 * by the endpoints above with one more query parameter.
 *
 * **And the state to read those numbers through: `thread_id` has never held a value.** The
 * chain is complete in source — `db/ledger.ts`'s INSERT names the column and binds it
 * (REQ-OBS-38) — but **zero runs have executed**, so `ops.agent_runs` is empty, every
 * `threadId` below is `null`, and every `?thread=` answers zero runs. The filter, the query,
 * the column and the bind all exist and agree; none of it has been observed. Completed is
 * not validated.
 */

import {
  activityFeed,
  agentEvidence,
  billingAccountCount,
  costByAccount,
  costToday,
  costTodayByAccount,
  isMetric,
  isRange,
  lastRuns,
  metric,
  runExistsInProject,
  runToolCalls,
  RANGES,
  UNATTRIBUTED_ACCOUNT,
  type MetricName,
  type Range,
} from '../db/queries.ts';
import { bindNamedQuery, NAMED_QUERIES } from '../db/registry.ts';
import { isScopeViolation, readInProject } from '../db/scope.ts';
import { countLive, deriveStatus, THRESHOLDS, type AgentEvidence } from '../observability/status.ts';
import type { DbClient } from '../observability/types.ts';

/**
 * The project a metrics request is about, already resolved.
 *
 * `id` is `ops.project.id` (a uuid, never a slug) because that is what the ledger's
 * foreign keys hold; `slug` is what a human typed and what every payload echoes back.
 * Resolution — does this coordinator mount it, is it archived — happens in
 * `lib/project.ts`, which is `runner-engineer`'s, and its three distinct refusals are the
 * reason this module never has to guess.
 */
export type MetricsProject = { id: string; slug: string };

export type MetricsOptions = {
  /** Day boundary for the cost ticker. "Today" means the human's today. */
  timezone?: string;
  /**
   * The project the `/api/p/:project` segment resolved to.
   *
   * Absent is **not** a default, it is a wiring fault in this process, and it is reported
   * as `500 project_scope_unset` rather than answered with the only project we happen to
   * mount. An ambient default is precisely the mechanism by which one client's numbers get
   * served under another client's name (`project-scoping.md` §5.1 Q2), and "there is only
   * one project today" is the argument that stops being true silently.
   */
  project?: MetricsProject;
};

export type MetricsResponse = { status: number; body: unknown };

const DEFAULT_TIMEZONE = process.env.CC_TIMEZONE ?? 'Asia/Riyadh';

function fail(status: number, code: string, message: string, hint?: string): MetricsResponse {
  return { status, body: { error: { code, message, ...(hint ? { hint } : {}) } } };
}

/**
 * `/api/p/<slug>/rest` → `{slug, rest: '/api/rest'}`. `null` when the path names no
 * project, which is a refusal rather than a fallback.
 */
export function splitProjectPath(path: string): { slug: string; rest: string } | null {
  const match = path.match(/^\/api\/p\/([^/]+)(\/.*)?$/);
  if (!match) return null;
  return { slug: decodeURIComponent(match[1]), rest: `/api${match[2] ?? ''}` };
}

/**
 * The `project` sibling every metrics body carries, next to `ledger`.
 *
 * Same argument as `ledger`, one axis over: a consumer must be able to tell **which**
 * project a zero belongs to without re-parsing the URL it happened to send. A zero that
 * cannot name its project is a zero nobody can check, and with N projects it is a zero
 * that could belong to any of them.
 */
function withProjectEcho(body: unknown, project: MetricsProject): unknown {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return body;
  return {
    ...(body as Record<string, unknown>),
    project: { slug: project.slug, id: project.id, state: 'mounted' as const },
  };
}

/**
 * An account filter is either a uuid or the literal `unattributed`. Anything else is
 * refused here rather than bound, so the SQL never has to survive a cast it cannot do.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isAccountFilter(value: string): boolean {
  return value === UNATTRIBUTED_ACCOUNT || UUID_RE.test(value);
}

/**
 * `?thread=` — `ops.thread.id`, a uuid and nothing else (`Plan §12`, ADR-023).
 *
 * There is deliberately **no `unthreaded` bucket** here, and the asymmetry with `account`
 * is the point rather than an oversight. `unattributed` is a *value the ledger stores*
 * (`account_source`), so asking for it is asking for rows that say something. "No thread"
 * is a NULL, it is every row in the table today, and a bucket for it would be a filter
 * whose answer is "everything" dressed up as a category. It is added the day someone has
 * a question it answers.
 */
function isThreadFilter(value: string): boolean {
  return UUID_RE.test(value);
}

/**
 * Read and validate `?thread=`. Returns the id, `null` for "no filter", or a refusal.
 *
 * Refused **before** the database, like `bad_account`: a malformed id that reached the SQL
 * would be compared as text and quietly answer zero runs, which is the same shape as a
 * thread that genuinely has none — and those two must not print the same empty list.
 */
function readThreadFilter(q: URLSearchParams): { id: string | null } | MetricsResponse {
  const raw = q.get('thread');
  if (raw === null) return { id: null };
  if (!isThreadFilter(raw)) {
    return fail(
      400,
      'bad_thread',
      `"${raw}" is not a thread id.`,
      'A thread is identified by the uuid in ops.thread.id — the same id the THREADS view and ' +
        'the composer address. Omit ?thread= for every run in this project.',
    );
  }
  return { id: raw };
}

const isRefusal = (v: { id: string | null } | MetricsResponse): v is MetricsResponse =>
  'status' in v;

function clampLimit(raw: string | null, fallback: number, max: number): number {
  const n = raw === null ? fallback : Number(raw);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(Math.floor(n), max);
}

/** ISO timestamp → the relative string LAST RUNS shows ("14m ago"). */
export function relativeTime(iso: string, now = Date.now()): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const seconds = Math.max(0, Math.round((now - then) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.round(days / 30)}mo ago`;
}

/**
 * Main entry point. `url` may be absolute or path-and-query, and **must** carry
 * `/api/p/:project`.
 */
export async function handleMetricsRequest(
  method: string,
  url: string,
  db: DbClient,
  options: MetricsOptions = {},
): Promise<MetricsResponse> {
  if (method !== 'GET') {
    return fail(405, 'method_not_allowed', 'The metrics API is read-only.', 'Use GET.');
  }

  const parsed = new URL(url, 'http://runner.internal');
  const rawPath = parsed.pathname.replace(/\/+$/, '') || '/';
  const q = parsed.searchParams;
  const timezone = options.timezone ?? DEFAULT_TIMEZONE;

  const segment = splitProjectPath(rawPath);
  if (!segment) {
    // Not a 404 and not a redirect to "the" project. A stale client gets a sentence
    // telling it what to change; it never gets rows it did not ask for by name.
    return fail(
      400,
      'project_scope_missing',
      'This metrics request did not say which project it is about.',
      `Every metrics route carries the project in its path: ${rawPath.replace('/api/', '/api/p/<project>/')}. ` +
        'There is deliberately no default project — a default is how one client\'s numbers get served under another client\'s name.',
    );
  }

  const project = options.project;
  if (!project) {
    return fail(
      500,
      'project_scope_unset',
      'The metrics routes were mounted without a project resolver.',
      'This is a fault in the runner, not in the request. `registerMetricsRoutes` must be given `resolveProject`.',
    );
  }
  if (project.slug !== segment.slug) {
    // The mount resolved one project and the URL named another. Answering either one
    // would be answering a question nobody asked.
    return fail(
      500,
      'project_scope_mismatch',
      `The path names "${segment.slug}" but the resolver produced "${project.slug}".`,
      'The runner mounted these routes with a resolver that disagrees with the path segment. No numbers are returned until they agree.',
    );
  }

  const path = segment.rest;
  const projectId = project.id;

  try {
    // Everything below runs inside the project scope: one pooled connection, one READ ONLY
    // transaction, `agnetos.project_id` set for its lifetime only. The predicate in each
    // statement is what filters today; this is what makes a *missing* predicate raise once
    // the non-superuser role lands. See db/scope.ts.
    return withProjectEchoResult(
      await readInProject(db, projectId, async (scoped) => runMetrics(scoped, path, q, { projectId, timezone })),
      project,
    );
  } catch (error) {
    // A scope violation is not an outage. It is the isolation guarantee firing, and it
    // must never wear `metrics_unavailable`'s clothes.
    if (isScopeViolation(error)) {
      return fail(
        500,
        'project_scope_unset',
        'A metrics query reached a project-scoped table with no project in scope.',
        'This is a fault in the runner, not in the request, and it is deliberately not reported as a database outage: no rows were returned, and none were withheld either.',
      );
    }
    const code = (error as { code?: string }).code;
    if (
      code === 'unknown_query' ||
      code === 'missing_param' ||
      code === 'bad_param' ||
      code === 'unscoped_query'
    ) {
      const e = error as Error & { hint?: string };
      return fail(code === 'unscoped_query' ? 500 : 400, code, e.message, e.hint);
    }
    const message = error instanceof Error ? error.message : String(error);
    return fail(
      503,
      'metrics_unavailable',
      message,
      'The metrics database is not answering. Runs still work; numbers will fill in once it is back.',
    );
  }
}

/** Attach the project echo to a body without disturbing an error envelope's shape. */
function withProjectEchoResult(result: MetricsResponse, project: MetricsProject): MetricsResponse {
  return { status: result.status, body: withProjectEcho(result.body, project) };
}

/** The route table proper, already inside the project scope. */
async function runMetrics(
  db: DbClient,
  path: string,
  q: URLSearchParams,
  ctx: { projectId: string; timezone: string },
): Promise<MetricsResponse> {
  const { projectId, timezone } = ctx;
  {
    if (path === '/api/cost/today') {
      const [{ usd, runs, unpricedRuns }, byAccount] = await Promise.all([
        costToday(db, projectId, timezone),
        costTodayByAccount(db, projectId, timezone),
      ]);
      return {
        status: 200,
        body: {
          // `null` when nothing priced today — CostTicker renders `no cost data`.
          // A real `$0.00` is only returned when at least one run was priced at zero.
          usd: usd === null ? null : Math.round(usd * 100) / 100,
          runs,
          // How many of today's runs we could not price. The ticker shows a bare
          // number; this is how a caller knows whether that number is the whole story.
          unpricedRuns,
          /**
           * The second axis (`Plan §11`): `work $12.40 · personal $3.10`, per project.
           *
           * An empty array means **this project had no runs today**. It does not mean
           * "one account paid for everything", and it never means "there are no
           * accounts" — that is a claim about `ops.billing_account`, which this route
           * does not make and `/api/p/:project/metrics/accounts` does.
           */
          byAccount: byAccount.map((a) => ({
            ...a,
            usd: a.usd === null ? null : Math.round(a.usd * 100) / 100,
          })),
          timezone,
          asOf: new Date().toISOString(),
        },
      };
    }

    /**
     * The per-account split over a window, with the one fact that makes an empty split
     * readable: how many billing accounts exist at all (`Plan §11`, ADR-015 Q20).
     *
     * `accountsRegistered: 0` beside `spend: []` says *the split has never had anything
     * to split*. Without it, an empty array is ambiguous between "no runs" and "no
     * accounts", and a UI would have to guess which sentence to print.
     */
    if (path === '/api/metrics/accounts') {
      const range = q.get('range') ?? '28d';
      if (!isRange(range)) {
        return fail(
          400,
          'bad_range',
          `"${range}" is not a supported range.`,
          `Use one of ${Object.keys(RANGES).join(', ')}.`,
        );
      }
      const hours = RANGES[range as Range];
      const [spend, accountsRegistered] = await Promise.all([
        costByAccount(db, projectId, hours, 0),
        billingAccountCount(db),
      ]);
      return {
        status: 200,
        body: {
          range,
          spend: spend.map((a) => ({
            ...a,
            usd: a.usd === null ? null : Math.round(a.usd * 100) / 100,
          })),
          accountsRegistered,
          /**
           * Stated in the payload, not only in a handoff, because a consumer building a
           * two-account chip row needs to know the split is structural rather than
           * demonstrated: `ops.billing_account` is empty and no run has ever recorded a
           * payer (`project-scoping.md` §6).
           */
          accountsEnforced: false,
          asOf: new Date().toISOString(),
        },
      };
    }

    if (path === '/api/metrics/runs') {
      const agent = q.get('agent');
      const limit = clampLimit(q.get('limit'), 5, 50);
      const thread = readThreadFilter(q);
      if (isRefusal(thread)) return thread;
      const rows = await lastRuns(
        db,
        { projectId, agent: agent ?? undefined, threadId: thread.id ?? undefined },
        limit,
      );
      return {
        status: 200,
        body: {
          // `startedAt` is ISO 8601. Relative time ("14m ago") is the client's job
          // (api-contracts.md Reads) — we do not pre-render it.
          runs: rows.map((r: Record<string, unknown>) => ({
            runId: r.run_id,
            agent: r.agent,
            agentName: r.agent_name,
            startedAt: toIso(r.started_at),
            status: r.status,
            durationMs: r.duration_ms,
            costUsd: r.cost_usd === null ? null : Number(r.cost_usd),
            costSource: r.cost_source,
            // Which account paid, and how that was decided. `unattributed` is a value the
            // ledger stores, not an absence the row forgot — a drawer showing spend owes
            // the reader the same provenance `costSource` already gives the number.
            accountId: r.account_id ?? null,
            accountSource: r.account_source ?? UNATTRIBUTED_ACCOUNT,
            // `{project}/{department}/{slug}` (ADR-014 §2). The addressable agent, so a
            // row can say which library's agent it was without a second lookup.
            agentRef: r.agent_ref ?? null,
            /**
             * The thread this run belongs to (`Plan §12`), or `null` for a run that
             * belongs to none.
             *
             * **`null` on every row today — because there are no rows.** The writer
             * names and binds the column (REQ-OBS-38); zero runs have executed, so
             * `ops.agent_runs` is empty. A consumer rendering this must read `null` as
             * "no thread recorded", never as "this run stands alone": those become
             * different facts the day the first run happens, and only one of them is a
             * thing to draw.
             */
            threadId: r.thread_id ?? null,
            traceUrl: r.trace_url,
          })),
        },
      };
    }

    const toolsMatch = path.match(/^\/api\/runs\/([A-Za-z0-9_-]{1,64})\/tools$/);
    if (toolsMatch) {
      const runId = toolsMatch[1];
      const rows = await runToolCalls(db, projectId, runId);
      if (rows.length === 0) {
        // A run id carries no project in it, so a link copied between two projects is a
        // real and silent way to read the wrong client's spans. `runToolCalls` joins
        // through the parent row, so a foreign run already returns nothing — but nothing
        // is also what a run with no tool calls returns, and those two must not print the
        // same empty drawer. One extra existence check buys the distinction.
        const mine = await runExistsInProject(db, projectId, runId);
        if (!mine) {
          return fail(
            404,
            'run_not_in_project',
            `Run ${runId} is not a run of this project.`,
            'A run id belongs to exactly one project. If you followed a link from another project, open it there — this is not an empty result, it is a different project\'s row.',
          );
        }
      }
      return {
        status: 200,
        body: {
          toolCalls: rows.map((r: Record<string, unknown>) => ({
            seq: r.seq,
            name: r.name,
            status: r.status,
            startedAt: toIso(r.started_at),
            durationMs: r.duration_ms,
            error: r.error,
          })),
        },
      };
    }

    if (path === '/api/metrics/live' || path === '/api/metrics/status') {
      const statuses = (await agentEvidence(db, projectId, THRESHOLDS.window)).map((row: Record<string, unknown>) =>
        deriveStatus(toEvidence(row)),
      );

      if (path === '/api/metrics/live') {
        const counts = countLive(statuses);
        return {
          status: 200,
          body: {
            ...counts,
            // Deliberately no `total`. How many agents exist is a frontmatter fact and
            // belongs to GET /api/graph. Splitting numerator from denominator is what
            // makes it structurally impossible for this endpoint to inflate the count
            // (Part VII.3).
            totalSource: 'GET /api/graph',
            asOf: new Date().toISOString(),
          },
        };
      }

      return {
        status: 200,
        body: {
          agents: statuses.map((s) => ({
            agent: s.agent,
            department: s.department,
            status: s.status,
            errorRate: s.errorRate,
            reason: s.reason,
            runs: s.evidence.totalRuns,
            successfulRuns: s.evidence.successfulRuns,
            lastRunAt: s.evidence.lastRunAt,
          })),
          thresholds: THRESHOLDS,
          asOf: new Date().toISOString(),
        },
      };
    }

    if (path === '/api/metrics/query') {
      const name = q.get('metric') ?? '';
      if (!isMetric(name)) {
        return fail(
          400,
          'unknown_metric',
          `"${name}" is not a metric.`,
          'Use runs, cost, latency_p50 or error_rate.',
        );
      }
      const range = q.get('range') ?? '7d';
      if (!isRange(range)) {
        return fail(
          400,
          'bad_range',
          `"${range}" is not a supported range.`,
          `Use one of ${Object.keys(RANGES).join(', ')}.`,
        );
      }
      const account = q.get('account');
      if (account !== null && !isAccountFilter(account)) {
        return fail(
          400,
          'bad_account',
          `"${account}" is not a billing account.`,
          `Pass an account id, or "${UNATTRIBUTED_ACCOUNT}" for runs whose payer was never recorded. ` +
            'The accounts this project has seen are on GET /api/p/:project/metrics/accounts.',
        );
      }
      const thread = readThreadFilter(q);
      if (isRefusal(thread)) return thread;
      const filter = {
        projectId,
        agent: q.get('agent') ?? undefined,
        department: q.get('department') ?? undefined,
        account: account ?? undefined,
        // One more predicate on the same query — `runs`, `cost`, `latency_p50` and
        // `error_rate` answer for a thread through the code path that answers for an
        // agent. No thread rollup exists, on purpose: two ways to compute one number is
        // how they start disagreeing.
        threadId: thread.id ?? undefined,
      };
      const hours = RANGES[range as Range];
      const current = await metric(db, name as MetricName, filter, hours, 0);

      // The KPI chip's ▲/▼ compares against the immediately preceding window of the
      // same length — "vs previous 28d" in the panel contract's caption.
      const compare = q.get('compare') !== 'false';
      const previous = compare ? await metric(db, name as MetricName, filter, hours * 2, hours) : null;

      return {
        status: 200,
        body: {
          metric: name,
          range,
          filter,
          value: current.value,
          runs: current.runs,
          unpricedRuns: name === 'cost' ? current.unpriced : undefined,
          previous: previous?.value ?? null,
          delta: deltaOf(current.value, previous?.value ?? null),
          asOf: new Date().toISOString(),
        },
      };
    }

    if (path === '/api/metrics/activity') {
      const limit = clampLimit(q.get('limit'), 12, 100);
      const department = q.get('department');
      const thread = readThreadFilter(q);
      if (isRefusal(thread)) return thread;
      const rows = await activityFeed(db, projectId, department, limit, thread.id);
      return {
        status: 200,
        body: {
          items: rows.map((r: Record<string, unknown>) => ({
            runId: r.run_id,
            at: toIso(r.started_at),
            // The feed's leading `09:41`. Rendered in the ticker's timezone so a row
            // reads as the time the human remembers it happening.
            time: formatClock(toIso(r.started_at), timezone),
            event: r.activity_event,
            detail: r.activity_detail,
            agent: r.agent,
            agentName: r.agent_name,
            department: r.department,
            status: r.status,
            // Attribution, not a row source: the feed is still agent runs, and a thread
            // with no run has nothing to report. `null` on every row today because the
            // table is empty — see `/metrics/runs` above.
            threadId: r.thread_id ?? null,
            traceUrl: r.trace_url,
          })),
        },
      };
    }

    const sqlMatch = path.match(/^\/api\/metrics\/sql\/([a-z][a-z0-9_]{1,48})$/);
    if (sqlMatch) {
      const params: Record<string, unknown> = {};
      for (const [key, value] of q.entries()) params[key] = value;
      // The project is a positional argument, never one of `params`. A panel supplies
      // `days` and `limit`; it does not get to supply the isolation boundary.
      delete params.project;
      const bound = bindNamedQuery(sqlMatch[1], projectId, params);
      if (bound.status === 'pending' || !bound.sql) {
        return {
          status: 200,
          body: {
            name: sqlMatch[1],
            rows: [],
            empty: true,
            reason: bound.blockedBy ?? 'This query is registered but not yet served.',
          },
        };
      }
      const { rows } = await db.query(bound.sql, bound.params);
      return { status: 200, body: { name: sqlMatch[1], rows } };
    }

    if (path === '/api/metrics/sql') {
      return {
        status: 200,
        body: {
          queries: Object.entries(NAMED_QUERIES).map(([name, q2]) => ({
            name,
            description: q2.description,
            status: q2.status,
            params: q2.params,
          })),
        },
      };
    }

    return fail(404, 'not_found', `No metrics route matches ${path}.`);
  }
}

/** Signed relative change, or null when there is no honest comparison to draw. */
export function deltaOf(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 1000;
}

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return typeof value === 'string' ? value : '';
}

function formatClock(iso: string, timezone: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return '';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timezone,
    }).format(new Date(ms));
  } catch {
    return new Date(ms).toISOString().slice(11, 16);
  }
}

function toEvidence(row: Record<string, unknown>): AgentEvidence {
  return {
    agent: String(row.agent),
    department: String(row.department ?? ''),
    totalRuns: Number(row.total_runs ?? 0),
    successfulRuns: Number(row.successful_runs ?? 0),
    recentRuns: Number(row.recent_runs ?? 0),
    recentErrors: Number(row.recent_errors ?? 0),
    lastRunAt: row.last_run_at ? toIso(row.last_run_at) : null,
    lastSuccessAt: row.last_success_at ? toIso(row.last_success_at) : null,
  };
}

/**
 * The route table, for whatever mounts this.
 *
 * The paths below are the **suffixes**; every one is served under `/api/p/:project`. They
 * are kept as suffixes rather than written out in full so that the project prefix has
 * exactly one spelling in this codebase (`PROJECT_ROUTE_PREFIX` in `@agnetos/contracts`),
 * and a prefix with one spelling is a prefix that cannot drift.
 */
export const METRICS_ROUTES = [
  'GET /cost/today',
  'GET /metrics/runs',
  'GET /runs/:runId/tools',
  'GET /metrics/live',
  'GET /metrics/status',
  'GET /metrics/query',
  'GET /metrics/activity',
  'GET /metrics/accounts',
  'GET /metrics/sql',
  'GET /metrics/sql/:name',
] as const;

/**
 * The pre-project paths, still mounted, answering `400 project_scope_missing`.
 *
 * Same rule and same reason as `LEGACY_UNSCOPED_PATHS` in `@agnetos/contracts`: a client
 * that has not been updated gets a sentence telling it what to change, on a real 400,
 * rather than a 404 that reads as though the route had been forgotten — and never another
 * project's rows under a default. Delete a row only when no client can still send it.
 */
export const LEGACY_UNSCOPED_METRICS_PATHS = [
  '/api/cost/today',
  '/api/metrics/live',
  '/api/metrics/status',
  '/api/metrics/query',
  '/api/metrics/activity',
  '/api/metrics/accounts',
  '/api/metrics/runs',
  '/api/metrics/sql',
  '/api/metrics/sql/:name',
  '/api/runs/:runId/tools',
] as const;
