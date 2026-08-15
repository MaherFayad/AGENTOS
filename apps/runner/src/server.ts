/**
 * Runner HTTP server factory — the thing `index.ts` listens on and tests inject into.
 *
 * Tailnet-only, no auth in v1 by design (§3.6). Nothing here may be written in a way that
 * is only safe because auth exists.
 */
import Fastify, { type FastifyInstance } from 'fastify';
import { DEPARTMENT_SLUGS, type GraphSocketMessage } from '@agnetos/contracts';
import { loadConfig, type RunnerConfig } from './lib/config.ts';
import { createRunnerServices, type RunnerLogger, type RunnerServices } from './lib/runService.ts';
import { createGraphWatcher, type GraphWatcher } from './lib/watcher.ts';
import { registerApi, type ApiContext } from './routes/api.ts';
import { createObservability, type Observability } from './observability/index.ts';

export interface BuiltRunner {
  app: FastifyInstance;
  services: RunnerServices;
  watcher: GraphWatcher | null;
  close: () => Promise<void>;
}

export interface BuildOptions {
  config?: RunnerConfig;
  logger?: RunnerLogger;
  /** Skip the chokidar watcher (tests). */
  watch?: boolean;
  /** Skip Postgres/Langfuse wiring (tests). */
  observe?: boolean;
}

function alignEnv(): void {
  // Compose names these differently from the modules that read them. Align once at boot
  // so neither side has to know about the other's spelling.
  if (!process.env.LANGFUSE_BASE_URL && process.env.LANGFUSE_HOST) {
    process.env.LANGFUSE_BASE_URL = process.env.LANGFUSE_HOST;
  }
  if (!process.env.DATABASE_URL && process.env.APP_DATABASE_URL) {
    process.env.DATABASE_URL = process.env.APP_DATABASE_URL;
  }
}

export async function buildRunner(options: BuildOptions = {}): Promise<BuiltRunner> {
  alignEnv();
  const config = options.config ?? loadConfig();
  const logger: RunnerLogger = options.logger ?? {
    info: (obj, msg) => console.info(msg ?? obj),
    warn: (obj, msg) => console.warn(msg ?? obj),
    error: (obj, msg) => console.error(msg ?? obj),
  };

  const services = createRunnerServices(config, logger);

  if (options.observe !== false && process.env.DATABASE_URL) {
    try {
      const obs: Observability = await createObservability();
      services.obs = obs;
    } catch (err) {
      logger.warn({ err }, 'observability is not up — runs still work; LAST RUNS and the cost ticker will be empty');
    }
  }

  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.headers["x-api-key"]',
          '*.apiKey',
          '*.ANTHROPIC_API_KEY',
        ],
        censor: '[redacted]',
      },
    },
  });

  let websocket = false;
  try {
    const plugin = (await import('@fastify/websocket')).default;
    await app.register(plugin);
    websocket = true;
  } catch (err) {
    logger.warn({ err }, '@fastify/websocket is not installed — /ws/graph will 404 until the image is rebuilt');
  }

  const sockets: ApiContext['sockets'] = new Set();
  const broadcast = (message: GraphSocketMessage): void => {
    const payload = JSON.stringify(message);
    for (const socket of sockets) {
      if (socket.readyState !== 1) continue;
      try {
        socket.send(payload);
      } catch {
        sockets.delete(socket);
      }
    }
  };

  let watcher: GraphWatcher | null = null;
  if (options.watch !== false) {
    watcher = await createGraphWatcher(config, { broadcast, logger });
  }

  const ctx: ApiContext = {
    services,
    watcher,
    startedAt: new Date().toISOString(),
    websocket,
    sockets,
  };
  await registerApi(app, ctx);

  /**
   * GET /healthz — the compose healthcheck target. Deliberately dependency-free: it reports
   * that this process can serve, not that Langfuse or Postgres are up. A health endpoint
   * that fails because a downstream is down turns one outage into a restart loop.
   */
  const startedMs = Date.now();
  app.get('/healthz', async () => ({
    ok: true,
    service: 'runner',
    uptimeMs: Date.now() - startedMs,
    departments: DEPARTMENT_SLUGS.length,
  }));

  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      error: {
        code: 'not_found',
        message: `No route for ${request.method} ${request.url}`,
        hint: 'Runner routes live under /api/run, /api/schedule, /api/approvals, /api/graph, /api/agents, /api/runs, /api/cost/today, /api/metrics, /api/panels, /api/status and /ws/graph. Sessions and push are served by the web app, not this process.',
      },
    });
  });

  const sweep = setInterval(() => services.store.sweep(), 30_000);
  sweep.unref?.();

  return {
    app,
    services,
    watcher,
    close: async () => {
      clearInterval(sweep);
      await watcher?.close();
      await services.obs?.close();
      await app.close();
    },
  };
}
