/**
 * Runner — headless Claude Agent SDK, SSE, schedule, approvals, graph reads (§3.2, §3.3).
 *
 * Tailnet-only, no auth in v1 by design (§3.6). Nothing here may be written in a way that
 * is only safe because auth exists.
 *
 * Tests import `server.ts`, not this file, so listen happens unconditionally here.
 */
import { buildRunner } from './server.ts';
import { bindHost } from './lib/bind.ts';

const PORT = Number(process.env.RUNNER_PORT ?? 8787);

// Loopback unless `RUNNER_HOST` says otherwise. The container still binds wide —
// `infra/compose.yaml` and `infra/runner.Dockerfile` both set `RUNNER_HOST=0.0.0.0`, so
// Caddy reaches it over the compose network exactly as before. What this refuses to do is
// put an unauthenticated API on every interface of a developer's host on a bare
// `npm start`. See `lib/bind.ts` for the whole argument; do not re-inline this default.
const HOST = bindHost();

const runner = await buildRunner();
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    runner.close().then(() => process.exit(0));
  });
}
try {
  await runner.app.listen({ port: PORT, host: HOST });
} catch (err) {
  runner.app.log.error(err);
  process.exit(1);
}
