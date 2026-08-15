/**
 * Runner — boot + health only (M0 scaffold).
 *
 * Everything this service is actually for belongs to `runner-engineer` (§3.2, §3.3) and
 * `sessions-relay-engineer` (§3.1), specified in comms/contracts/api-contracts.md. This
 * file exists so infra has something with a real healthcheck to compose, and so the route
 * owners inherit a server rather than arguing about one.
 *
 * Tailnet-only, no auth in v1 by design (§3.6). Nothing here may be written in a way that
 * is only safe because auth exists.
 */
import Fastify from 'fastify';
import { DEPARTMENT_SLUGS } from '@agnetos/contracts';

const PORT = Number(process.env.RUNNER_PORT ?? 8787);

// 0.0.0.0 here is the *container's* interface, not the host's. Host exposure is decided
// entirely by the published-port bind address in infra/compose.yaml, which is pinned to
// the Tailscale IP. Do not "fix" this to 127.0.0.1 — that would make the container
// unreachable from Caddy on the compose network.
const HOST = process.env.RUNNER_HOST ?? '0.0.0.0';

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? 'info',
    // Secrets never reach logs, traces or comms (Part V billing, Part VII.4).
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

const startedAt = Date.now();

/**
 * GET /healthz — the compose healthcheck target. Deliberately dependency-free: it reports
 * that this process can serve, not that Langfuse or Postgres are up. A health endpoint
 * that fails because a downstream is down turns one outage into a restart loop.
 */
app.get('/healthz', async () => ({
  ok: true,
  service: 'runner',
  uptimeMs: Date.now() - startedAt,
  // Proves the shared contracts package resolved — the ADR-002 wiring, checked at runtime.
  departments: DEPARTMENT_SLUGS.length,
}));

// ---------------------------------------------------------------------------
// TODO(runner-engineer) — §3.2, comms/contracts/api-contracts.md. Mount here:
//   POST /api/run                 -> SSE; tool allowlist is EXACTLY `wired_into`,
//                                    never a superset (BOARD trap M3)
//   POST /api/schedule            -> frontmatter git commit, then ofelia sync
//   GET  /api/approvals           -> pending gates
//   POST /api/approvals/:runId    -> {decision}
//   GET  /api/graph               -> serves apps/web/public/graph.json, never simulates
//                                    (ADR-003)
//   GET  /api/agents/:slug | /api/runs | /api/cost/today | /api/panels | /api/status
//   WS   /ws/graph                -> chokidar deltas from the read-only /agents mount
//
// TODO(sessions-relay-engineer) — §3.1. Mount here:
//   GET  /api/sessions | /api/sessions/:id/stream | POST /api/sessions/:id/input
//   POST /api/sessions/:id/permission | POST /api/push/subscribe
//   Passthrough only. The relay never sees plaintext; decryption is client-side.
//
// Uniform error envelope for every route above: {error:{code,message,hint?}} with a real
// HTTP status. `hint` is shown verbatim to a human on a phone.
// ---------------------------------------------------------------------------

app.setNotFoundHandler((request, reply) => {
  reply.code(404).send({
    error: {
      code: 'not_found',
      message: `No route for ${request.method} ${request.url}`,
      hint: 'The runner is a scaffold at M0 — only GET /healthz exists yet.',
    },
  });
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    app.close().then(() => process.exit(0));
  });
}

try {
  await app.listen({ port: PORT, host: HOST });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
