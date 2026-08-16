/**
 * Register the runner's HTTP + WebSocket surface (§3.2, §3.3).
 *
 * Mounts exactly `RUNNER_ROUTES` from `@agnetos/contracts`. `GET /api/cost/today` is
 * observability-engineer's (`COST_TICKER_ROUTE`) and is always registered via
 * `registerMetricsRoutes` — it is not in `RUNNER_ROUTES`. `/api/sessions*` and `/api/push*`
 * are Caddy-routed to web and are not registered here.
 */
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  LEGACY_UNSCOPED_PATHS,
  RUNNER_ROUTES,
  type ApprovalDecisionRequest,
  type ArtifactKind,
  type GraphSocketMessage,
  type ProjectsResponse,
  type RunRequest,
  type AgentsIndex,
  type ScheduleRequest,
  type StatusResponse,
} from '@agnetos/contracts';
import { sendApiError } from './http.ts';
import { registerMetricsRoutes } from './register-metrics.ts';
import { ApiError, badRequest } from '../lib/errors.ts';
import { listAgents, loadAgent, toAgentDetail } from '../lib/agents.ts';
import {
  mountedProject,
  probeScopeEnforcement,
  resolveProject,
  scopeMissing,
  toProjectSummary,
} from '../lib/project.ts';
import type { RunState } from '../lib/runStore.ts';
import { computeBrainCompleteness } from '../lib/brain.ts';
import { graphIsBuilt, readGraph } from '../lib/graph.ts';
import { listPanels, readPanel } from '../lib/panels.ts';
import { parseLastEventId, SSE_HEARTBEAT, type RunStream } from '../lib/sse.ts';
import { startRun, type RunnerServices } from '../lib/runService.ts';
import { setSchedule } from '../lib/schedule.ts';
import type { GraphWatcher } from '../lib/watcher.ts';
import type { LedgerConnection } from '../lib/ledgerConnection.ts';
import { readTailnet } from '../lib/tailscale.ts';

export interface ApiContext {
  services: RunnerServices;
  watcher: GraphWatcher | null;
  /**
   * The self-healing ledger connection. Read per request, never captured — that is the
   * whole fix for the latched "observability is not up" (see `ledgerConnection.ts`).
   */
  ledger: LedgerConnection;
  startedAt: string;
  websocket: boolean;
  sockets: Set<{ send: (data: string) => void; readyState: number; on: (event: string, cb: () => void) => void }>;
}

const ARTIFACT_TYPE: Record<ArtifactKind, string> = {
  md: 'text/markdown; charset=utf-8',
  json: 'application/json; charset=utf-8',
  pdf: 'application/pdf',
  txt: 'text/plain; charset=utf-8',
};

function slugParam(request: FastifyRequest): string {
  const params = request.params as Record<string, string>;
  const raw = params['*'] ?? '';
  return decodeURIComponent(String(raw)).replace(/^\/+/, '').replace(/\/+$/, '');
}

function runIdParam(request: FastifyRequest): string {
  const runId = (request.params as { runId?: string }).runId;
  if (!runId) throw badRequest('A run id is required.');
  return runId;
}

/**
 * Read `:project` and refuse anything this coordinator does not mount (ADR-015 Q1/Q2).
 *
 * Every project-scoped handler calls this **first**, before it touches config or the store.
 * It is a function rather than a Fastify hook on purpose: a hook is registered once and is
 * silently absent from a route someone adds later, whereas an unresolved `project` variable
 * is a compile error in the handler that forgot it. The check that fails loudly when you
 * forget it is worth more than the one that is tidier.
 */
function projectOf(ctx: ApiContext, request: FastifyRequest) {
  return resolveProject(ctx.services.config, (request.params as { project?: string }).project);
}

function attachSse(request: FastifyRequest, reply: FastifyReply, stream: RunStream): void {
  reply.hijack();
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const lastEventId = parseLastEventId(
    request.headers['last-event-id'],
    typeof request.query === 'object' && request.query !== null
      ? (request.query as { lastEventId?: string }).lastEventId
      : undefined,
  );

  const write = (chunk: string): void => {
    if (!reply.raw.writableEnded) reply.raw.write(chunk);
  };

  const detach = stream.attach(write, lastEventId);
  const heartbeat = setInterval(() => write(SSE_HEARTBEAT), 15_000);

  let closed = false;
  const close = (): void => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    detach();
    unend();
    if (!reply.raw.writableEnded) reply.raw.end();
  };

  const unend = stream.whenEnded(() => {
    // Let the last `done` frame flush before we hang up, so EventSource sees it.
    setTimeout(close, 10);
  });

  request.raw.on('close', close);
}

export async function registerApi(app: FastifyInstance, ctx: ApiContext): Promise<void> {
  const { services } = ctx;
  const { config, store, ledger } = services;

  app.post(RUNNER_ROUTES.run.path, async (request, reply) => {
    try {
      const project = projectOf(ctx, request);
      const state = await startRun(services, project, (request.body ?? {}) as RunRequest);
      attachSse(request, reply, state.stream);
    } catch (err) {
      sendApiError(reply, err);
    }
  });

  /**
   * A run belongs to exactly one project, and asking for it under another project's path is
   * refused rather than served.
   *
   * `run_not_found` and not a "wrong project" code, deliberately: a run id is opaque, and
   * telling a caller in project B that a given id exists in project A is itself a
   * cross-project disclosure. From outside its project, the run does not exist.
   */
  const runInProject = (request: FastifyRequest): RunState => {
    const project = projectOf(ctx, request);
    const state = store.require(runIdParam(request));
    if (state.project !== project.slug) {
      throw new ApiError('run_not_found', `No run with id ${state.runId} in "${project.slug}".`, {
        hint: 'That run id does not belong to this project. Open it from the LAST RUNS list of the project it ran in.',
        retryable: false,
      });
    }
    return state;
  };

  app.get(RUNNER_ROUTES.runStream.path, async (request, reply) => {
    try {
      const state = runInProject(request);
      attachSse(request, reply, state.stream);
    } catch (err) {
      sendApiError(reply, err);
    }
  });

  app.get(RUNNER_ROUTES.runArtifact.path, async (request, reply) => {
    try {
      const state = runInProject(request);
      if (!state.artifact) {
        throw new ApiError('run_not_found', `Run ${state.runId} has no artifact.`, {
          hint: 'This run finished without producing output.md (or pdf/json/txt). Open the console for what it said instead.',
          retryable: false,
        });
      }
      const info = await stat(state.artifact.absolutePath);
      const filename = state.artifact.path.split('/').pop() ?? 'artifact';
      reply
        .header('content-type', ARTIFACT_TYPE[state.artifact.kind])
        .header('content-length', info.size)
        .header('content-disposition', `attachment; filename="${filename}"`);
      return reply.send(createReadStream(state.artifact.absolutePath));
    } catch (err) {
      return sendApiError(reply, err);
    }
  });

  app.post(RUNNER_ROUTES.schedule.path, async (request, reply) => {
    try {
      // Resolved for its refusal, not for its value: a schedule is written into the mounted
      // library's frontmatter, and writing project B's cron into project A's repo is the
      // same class of mistake as serving its rows.
      projectOf(ctx, request);
      const body = (request.body ?? {}) as ScheduleRequest;
      return await setSchedule(config, body, services.logger);
    } catch (err) {
      return sendApiError(reply, err);
    }
  });

  app.get(RUNNER_ROUTES.approvals.path, async (request, reply) => {
    try {
      return { approvals: store.pendingApprovals(projectOf(ctx, request).slug) };
    } catch (err) {
      return sendApiError(reply, err);
    }
  });

  /**
   * The footer badge (§2.5.7) is genuinely cross-project — a human wants to know something
   * is waiting, wherever it is. Every row carries `project`, so the queue can never render
   * an item without saying whose it is.
   */
  app.get(RUNNER_ROUTES.allApprovals.path, async () => ({
    approvals: store.pendingApprovals('*'),
  }));

  app.post(RUNNER_ROUTES.approvalDecision.path, async (request, reply) => {
    try {
      const runId = runInProject(request).runId;
      const body = (request.body ?? {}) as ApprovalDecisionRequest;
      if (body.decision !== 'approve' && body.decision !== 'deny') {
        throw badRequest(
          'A decision must be "approve" or "deny".',
          'Send {"decision":"approve"} or {"decision":"deny","note":"why"}.',
        );
      }
      store.decide(runId, body.decision, body.note);
      return {
        ok: true as const,
        runId,
        decision: body.decision,
        decidedAt: new Date().toISOString(),
        outcome: body.decision === 'approve' ? ('resumed' as const) : ('aborted' as const),
      };
    } catch (err) {
      return sendApiError(reply, err);
    }
  });

  app.get(RUNNER_ROUTES.graph.path, async (request, reply) => {
    try {
      const project = projectOf(ctx, request);
      return await readGraph(config, { approvalPending: store.agentsAwaitingApproval(project.slug) });
    } catch (err) {
      return sendApiError(reply, err);
    }
  });

  /**
   * The collection (§2.6 — CHART draws its matrix from this). Summaries only: no `body`,
   * no `runnable`. See `AgentsIndex` for why.
   *
   * `listAgents` skips a file it cannot parse rather than throwing, so one bad SKILL.md
   * costs its own tile and not the whole matrix — but the reason is reported in
   * `skipped[]`, because a tile that vanishes silently is indistinguishable from an agent
   * that was never written.
   */
  const agentsIndex = async (): Promise<AgentsIndex> => {
    const skipped: AgentsIndex['skipped'] = [];
    const records = await listAgents(config, (slug, reason) => skipped.push({ slug, reason }));
    return {
      agents: records.map((record) => ({ slug: record.slug, path: record.path, frontmatter: record.data })),
      skipped,
    };
  };

  app.get(RUNNER_ROUTES.agentsIndex.path, async (request, reply) => {
    try {
      projectOf(ctx, request);
      return await agentsIndex();
    } catch (err) {
      return sendApiError(reply, err);
    }
  });

  app.get(RUNNER_ROUTES.agent.path, async (request, reply) => {
    try {
      projectOf(ctx, request);
      const slug = slugParam(request);
      // `/api/agents/` — a trailing slash on the collection, not a request for an agent
      // with no name. Fastify routes it here because the wildcard matches the empty
      // remainder; answering with the list is the only reading that isn't a lie.
      if (!slug) return await agentsIndex();
      return toAgentDetail(await loadAgent(config, slug));
    } catch (err) {
      return sendApiError(reply, err);
    }
  });

  app.get(RUNNER_ROUTES.runs.path, async (request, reply) => {
    try {
      const project = projectOf(ctx, request);
      const query = request.query as { agent?: string; limit?: string };
      const limit = query.limit !== undefined ? Number.parseInt(query.limit, 10) : undefined;
      return {
        runs: store.list({
          project: project.slug,
          agent: query.agent,
          limit: Number.isFinite(limit) ? limit : undefined,
        }),
      };
    } catch (err) {
      return sendApiError(reply, err);
    }
  });

  app.get(RUNNER_ROUTES.panels.path, async (request, reply) => {
    try {
      projectOf(ctx, request);
      return { panels: await listPanels(config) };
    } catch (err) {
      return sendApiError(reply, err);
    }
  });

  app.get(RUNNER_ROUTES.panel.path, async (request, reply) => {
    try {
      projectOf(ctx, request);
      const id = (request.params as { id?: string }).id ?? '';
      return await readPanel(config, id);
    } catch (err) {
      return sendApiError(reply, err);
    }
  });

  /**
   * `GET /api/projects` — what the switcher lists. Coordinator-scoped: a mount registry
   * describes this process, not a project's data.
   *
   * In M15 this answers from the coordinator's own mount, not from `ops.project`, and
   * `scopeEnforced` says whether the database half is actually in force. Listing rows the
   * runner cannot serve is left for the day a second library is mounted; `mounted` is what
   * a switcher must read until then.
   */
  app.get(RUNNER_ROUTES.projects.path, async (): Promise<ProjectsResponse> => {
    const project = mountedProject(config);
    const enforcement = await probeScopeEnforcement(ctx.ledger.current()?.db ?? null);
    return {
      projects: [toProjectSummary(project)],
      mounted: project.slug,
      // `null`, not `false`: with no ledger we have not *learned* that RLS is bypassed, we
      // have failed to ask. Unknown is not zero, one plane up.
      scopeEnforced: enforcement === 'unknown' ? null : enforcement === 'enforced',
    };
  });

  app.get(RUNNER_ROUTES.status.path, async (): Promise<StatusResponse> => {
    const counts = store.counts();
    const project = mountedProject(config);
    const [brain, graphBuilt, budget, scopeEnforcement] = await Promise.all([
      computeBrainCompleteness(config),
      graphIsBuilt(config),
      ledger.status(),
      probeScopeEnforcement(ctx.ledger.current()?.db ?? null),
    ]);
    // Observed, not read back from `.env`. `readTailnet` looks for a tailnet address on
    // this process's own interfaces; anything it cannot see is `unknown`, never `online`.
    const tailnet = readTailnet();

    return {
      tailscale: tailnet.state,
      tailscaleAddress: tailnet.address,
      tailscaleHint: tailnet.hint,
      queueDepth: counts.queued,
      activeRuns: counts.active,
      pendingApprovals: counts.pendingApprovals,
      runnerConfigured: config.configured,
      budget,
      brain,
      // The one place a caller can tell "no runs yet" from "we cannot see the runs".
      // Everything on the shell that renders a zero should check this first.
      ledger: ctx.ledger.health(),
      graphBuilt,
      startedAt: ctx.startedAt,
      projects: {
        // The coordinator mounts exactly one library, so `brain` and `graphBuilt` above are
        // unambiguously about it and `answeredFor` says which one rather than leaving a
        // consumer to assume. The day a second library is mounted, both go `null` and this
        // route refuses to pick — which is the whole reason the field exists now, while it
        // costs nothing.
        count: 1,
        answeredFor: project.slug,
        mounted: project.slug,
        scopeEnforcement,
      },
    };
  });

  /**
   * The pre-project paths, still mounted, answering `project_scope_missing` (400).
   *
   * **This is the migration's only visible surface and it is not decoration.** A client
   * that has not been updated must get a sentence naming the path it should use. The
   * alternatives are both worse: a 404 reads as "the route was forgotten" and sends someone
   * hunting a deleted feature, and a redirect to a default project is the ambient default
   * this entire ADR exists to remove — it would serve one client's rows under another
   * client's name, silently, and look like it worked.
   *
   * Registered from `LEGACY_UNSCOPED_PATHS` rather than by hand so the contract is the
   * thing that decides which paths exist. Deleting a row there deletes the route here.
   */
  for (const legacy of LEGACY_UNSCOPED_PATHS) {
    const handler = async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      sendApiError(reply, scopeMissing(config, RUNNER_ROUTES[legacy.scopedKey].path));
    };
    if (legacy.method === 'POST') app.post(legacy.path, handler);
    else app.get(legacy.path, handler);
  }

  if (ctx.websocket) {
    app.get(RUNNER_ROUTES.graphSocket.path, { websocket: true }, (socket: ApiContext['sockets'] extends Set<infer S> ? S : never) => {
      ctx.sockets.add(socket);
      const hello: GraphSocketMessage = {
        type: 'hello',
        version: ctx.watcher?.version() ?? '',
        brainCompleteness: ctx.watcher?.brainCompleteness() ?? 0,
      };
      try {
        socket.send(JSON.stringify(hello));
      } catch {
        ctx.sockets.delete(socket);
      }
      socket.on('close', () => {
        ctx.sockets.delete(socket);
      });
    });
  }

  // Observability (§3.5). Always mounted: an unreachable Postgres answers `{usd:null,
  // runs:null}` on the ticker and `metrics_unavailable` elsewhere — never a 404 that looks
  // like the route was forgotten, and never a `0` that looks like an honest empty state.
  // Getters, not values: the connection can come back, and these routes must notice.
  // GET /api/runs is not in this set.
  registerMetricsRoutes(app, {
    db: () => ctx.ledger.current()?.db ?? null,
    health: () => ctx.ledger.health(),
    reportQueryError: (err) => ctx.ledger.reportQueryError(err),
    // The metrics routes are mounted under `/api/p/:project` and resolve the segment
    // through the same `resolveProject` every other project route uses — one resolver,
    // one set of refusals, no second reading of what a project id means.
    resolveProject: (slug) => {
      const project = resolveProject(config, slug);
      return { id: project.id, slug: project.slug };
    },
  });
}

/** Every path this process registers from the contract, for tests. */
export const MOUNTED_RUNNER_PATHS = Object.values(RUNNER_ROUTES).map((route) => route.path);
