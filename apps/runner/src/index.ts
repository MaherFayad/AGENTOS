/**
 * Runner — headless Claude Agent SDK, SSE, schedule, approvals, graph reads (§3.2, §3.3).
 *
 * Tailnet-only, no auth in v1 by design (§3.6). Nothing here may be written in a way that
 * is only safe because auth exists.
 *
 * Tests import `server.ts`, not this file, so listen happens unconditionally here.
 */
import { buildRunner } from './server.ts';

const PORT = Number(process.env.RUNNER_PORT ?? 8787);

// 0.0.0.0 here is the *container's* interface, not the host's. Host exposure is decided
// entirely by the published-port bind address in infra/compose.yaml, which is pinned to
// the Tailscale IP. Do not "fix" this to 127.0.0.1 — that would make the container
// unreachable from Caddy on the compose network.
const HOST = process.env.RUNNER_HOST ?? '0.0.0.0';

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
