/**
 * Which interface the runner listens on — **the safe case is the default, the wide case is
 * written down** (§3.6, BOARD constraint 5).
 *
 * ## Why this is a module and not `process.env.RUNNER_HOST ?? '0.0.0.0'` inline
 *
 * It used to be that line, in `index.ts`, and `index.ts` is the one file the tests cannot
 * import — it calls `listen()` unconditionally. So the bind address was the single most
 * security-relevant value in this process and the only one with no test at all.
 *
 * ## Why the default moved from `0.0.0.0` to loopback
 *
 * Both are correct in exactly one context and wrong in the other:
 *
 * | | `0.0.0.0` | `127.0.0.1` |
 * |---|---|---|
 * | in the container | right — Caddy reaches it over the compose network | wrong — unreachable |
 * | on the host, `npm start` | **an unauthenticated API on the LAN** | right |
 *
 * `infra/compose.yaml` and `infra/runner.Dockerfile` both set `RUNNER_HOST=0.0.0.0`
 * explicitly, so the container keeps binding wide and loses nothing. What changes is that a
 * bare `npm start` on the host no longer publishes this process to every interface it can
 * find — which on the machine that reported it meant a LAN address and a Hyper-V bridge.
 *
 * BOARD constraint 5 is *"no public ports; nothing may be built that is only safe because
 * auth exists"*, and there is no auth in v1 **by design**: the second half of that design is
 * that nothing off the tailnet can reach the process. A default that is safe only because
 * the host happens to be on a trusted network is the same defect shape as a route that is
 * safe only because a login page exists — and on a tailnet system the exposure is real
 * without any port ever being published, because the LAN is not the tailnet.
 *
 * Deliberately **not** a validator: `RUNNER_HOST=0.0.0.0` is a legitimate answer and this
 * function does not second-guess it. It only decides which answer you get when you say
 * nothing.
 */

/** The bind address when nothing says otherwise. Loopback: reachable, not published. */
export const DEFAULT_RUNNER_HOST = '127.0.0.1';

export function bindHost(env: NodeJS.ProcessEnv = process.env): string {
  const declared = env.RUNNER_HOST?.trim();
  return declared === undefined || declared === '' ? DEFAULT_RUNNER_HOST : declared;
}
