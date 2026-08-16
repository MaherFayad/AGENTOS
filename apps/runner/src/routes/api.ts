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
  RUNNER_ROUTES,
  type ApprovalDecisionRequest,
  type ArtifactKind,
  type GraphSocketMessage,
  type RunRequest,
  type AgentsIndex,
  type ScheduleRequest,
  type StatusResponse,
} from '@agnetos/contracts';
import { sendApiError } from './http.ts';
import { registerMetricsRoutes } from './register-metrics.ts';
import { ApiError, badRequest } from '../lib/errors.ts';
import { listAgents, loadAgent, toAgentDetail } from '../lib/agents.ts';
import { computeBrainCompleteness } from '../lib/brain.ts';
import { graphIsBuilt, readGraph } from '../lib/graph.ts';
import { listPanels, readPanel } from '../lib/panels.ts';
import { parseLastEventId, SSE_HEARTBEAT, type RunStream } from '../lib/sse.ts';
import { startRun, type RunnerServices } from '../lib/runService.ts';
import { setSchedule } from '../lib/schedule.ts';
import type { GraphWatcher } from '../lib/watcher.ts';

export interface ApiContext {
  services: RunnerServices;
  watcher: GraphWatcher | null;
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
      const state = await startRun(services, (request.body ?? {}) as RunRequest);
      attachSse(request, reply, state.stream);
    } catch (err) {
      sendApiError(reply, err);
    }
  });

  app.get(RUNNER_ROUTES.runStream.path, async (request, reply) => {
    try {
      const state = store.require(runIdParam(request));
      attachSse(request, reply, state.stream);
    } catch (err) {
      sendApiError(reply, err);
    }
  });

  app.get(RUNNER_ROUTES.runArtifact.path, async (request, reply) => {
    try {
      const state = store.require(runIdParam(request));
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
      const body = (request.body ?? {}) as ScheduleRequest;
      return await setSchedule(config, body, services.logger);
    } catch (err) {
      return sendApiError(reply, err);
    }
  });

  app.get(RUNNER_ROUTES.approvals.path, async () => ({
    approvals: store.pendingApprovals(),
  }));

  app.post(RUNNER_ROUTES.approvalDecision.path, async (request, reply) => {
    try {
      const runId = runIdParam(request);
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

  app.get(RUNNER_ROUTES.graph.path, async (_request, reply) => {
    try {
      return await readGraph(config, { approvalPending: store.agentsAwaitingApproval() });
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

  app.get(RUNNER_ROUTES.agentsIndex.path, async (_request, reply) => {
    try {
      return await agentsIndex();
    } catch (err) {
      return sendApiError(reply, err);
    }
  });

  app.get(RUNNER_ROUTES.agent.path, async (request, reply) => {
    try {
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

  app.get(RUNNER_ROUTES.runs.path, async (request) => {
    const query = request.query as { agent?: string; limit?: string };
    const limit = query.limit !== undefined ? Number.parseInt(query.limit, 10) : undefined;
    return {
      runs: store.list({
        agent: query.agent,
        limit: Number.isFinite(limit) ? limit : undefined,
      }),
    };
  });

  app.get(RUNNER_ROUTES.panels.path, async () => ({
    panels: await listPanels(config),
  }));

  app.get(RUNNER_ROUTES.panel.path, async (request, reply) => {
    try {
      const id = (request.params as { id?: string }).id ?? '';
      return await readPanel(config, id);
    } catch (err) {
      return sendApiError(reply, err);
    }
  });

  app.get(RUNNER_ROUTES.status.path, async (): Promise<StatusResponse> => {
    const counts = store.counts();
    const [brain, graphBuilt, budget] = await Promise.all([
      computeBrainCompleteness(config),
      graphIsBuilt(config),
      ledger.status(),
    ]);
    return {
      tailscale: process.env.TAILSCALE_IP || process.env.TS_HOSTNAME ? 'online' : 'unknown',
      queueDepth: counts.queued,
      activeRuns: counts.active,
      pendingApprovals: counts.pendingApprovals,
      runnerConfigured: config.configured,
      budget,
      brain,
      graphBuilt,
      startedAt: ctx.startedAt,
    };
  });

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

  // Observability (§3.5). Always mounted: missing Postgres answers `{usd:null}`
  // on the ticker and `metrics_unavailable` elsewhere — never a 404 that looks
  // like the route was forgotten. GET /api/runs is not in this set.
  registerMetricsRoutes(app, services.obs?.db ?? null);
}

/** Every path this process registers from the contract, for tests. */
export const MOUNTED_RUNNER_PATHS = Object.values(RUNNER_ROUTES).map((route) => route.path);
