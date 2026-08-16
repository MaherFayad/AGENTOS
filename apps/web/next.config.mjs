import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Repo root — apps/web/../.. — pinned so the standalone output layout is deterministic. */
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Where the runner lives when nothing is fronting this app, or `null` when something is.
 *
 * Loopback default, never `0.0.0.0` (BOARD constraint 5 / §3.6): this address is dialled
 * by the Next server on the developer's own machine, and a wildcard here would be a
 * bind-shaped mistake in the file nobody re-reads.
 *
 * The two branches answer one question — "is Caddy in front of me?" — and they answer it
 * from the only two signals available at config time:
 *
 *   `next dev`  → nothing is ever in front. Proxy by default; `RUNNER_ORIGIN` overrides.
 *   production  → Caddy normally is, so proxying is OFF unless `RUNNER_ORIGIN` is set
 *                 explicitly. That is the escape hatch for `next build && next start` on
 *                 a laptop with no Caddy.
 *
 * `RUNNER_INTERNAL_URL` is deliberately honoured in dev only. `infra/compose.yaml` sets it
 * on the web service *and* runs behind Caddy, so treating it as an opt-in in production
 * would put two proxies on the same prefix — a worse bug than none.
 */
const RUNNER_PROXY_ORIGIN =
  process.env.NODE_ENV === 'production'
    ? (process.env.RUNNER_ORIGIN ?? null)
    : (process.env.RUNNER_ORIGIN ?? process.env.RUNNER_INTERNAL_URL ?? 'http://127.0.0.1:8787');

/**
 * Next's phase string for `next dev`. Hardcoded rather than imported from `next/constants`
 * because that module is CJS and this config is ESM — the named export resolves today and
 * would be a confusing boot failure the day it doesn't, for a value that is part of Next's
 * public API and has not changed since Next 9.
 */
const PHASE_DEVELOPMENT_SERVER = 'phase-development-server';

/**
 * The build's output directory — deliberately NOT the dev server's.
 *
 * `next build` and `next dev` used to share `apps/web/.next`. A build run while a dev
 * server was up replaced that server's `routes-manifest.json` and chunk files mid-flight,
 * and the dev server then answered *every* route with a 500 until someone restarted it.
 * It cost three agents an afternoon each because the symptom (unstyled HTML, "No tailnet"
 * fallback, blank dashboard) looks exactly like a code bug, not a filesystem race. See
 * `comms/inbox/_all/20260816-1355-dashboards-engineer-next-build-kills-next-dev.md` and
 * `…-1556-shell-navigation-engineer-dev-server-is-next-dev.md`.
 *
 * Keyed off the *phase*, not `NODE_ENV`: `next build` with `NODE_ENV=development` is a
 * thing people do, and under a NODE_ENV rule that build would write `.next` again and
 * reintroduce exactly the bug this removes. The phase is what the CLI actually ran.
 *
 *   next dev            → `.next`        (only `next dev` ever writes here)
 *   next build / start  → `.next-build`
 *
 * `next start` sees `phase-production-server` and therefore reads `.next-build`, which is
 * what `next build` just wrote — the pair stays consistent without a flag.
 *
 * `NEXT_DIST_DIR` overrides the build dir, so a second concurrent build (CI matrix, a
 * `--distDir`-style one-off verification build) can have its own directory too.
 */
const BUILD_DIST_DIR = process.env.NEXT_DIST_DIR ?? '.next-build';

/**
 * Next.js 15 config — Part V.
 *
 * `output: 'standalone'` is what makes infra/web.Dockerfile small and, more importantly,
 * portable: the runtime image carries its own traced node_modules, so nothing depends on
 * the build machine.
 *
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,

  // Without this, Next guesses the monorepo root from lockfile position. Pinning it means
  // `.next/standalone/apps/web/server.js` is where infra/web.Dockerfile expects it —
  // on every machine, not just one.
  outputFileTracingRoot: REPO_ROOT,

  // @agnetos/contracts ships TypeScript source with no build step (ADR-002 keeps web and
  // runner on one set of types). Next compiles it as if it were app code.
  transpilePackages: ['@agnetos/contracts'],

  // §1.4 / BOARD constraint 7: fonts are self-hosted via @fontsource. No runtime network
  // requests, so Next's font optimizer (which fetches from Google) stays off.
  experimental: {
    optimizePackageImports: ['@agnetos/contracts', 'lucide-react'],
  },

  // The stack has no public ports (§3.6) and the tailnet terminates TLS at Caddy, which
  // is the only hop that sees the real client. Trust its forwarded headers.
  poweredByHeader: false,

  // Next's dev-tools badge is drawn bottom-left, on top of the §2.0 `?` / zoom cluster —
  // exactly where Part VI's acceptance screenshots look. A dev affordance that sits in
  // the frame being compared to their video is a fidelity hazard, and it costs nothing to
  // turn off: everything it offers is also in the terminal.
  devIndicators: false,

  /**
   * Stand in for Caddy, so `/api/*` exists on the origin the browser is actually on.
   *
   * In the deployed stack `infra/Caddyfile` joins `/` (web) and `/api` (runner) onto one
   * origin, which is why every client-side read in this app uses a *relative* URL
   * (`NEXT_PUBLIC_API_BASE` defaults to `''`). Under bare `next dev` there is no Caddy, so
   * those same relative URLs hit Next, miss, and come back as the HTML 404 page — which
   * the drawer (§2.3), the cost ticker and the connection status pill all correctly report
   * as "not built / not reachable". Five empty states, one missing proxy.
   *
   * The fix is here rather than in the client because the alternative — pointing the
   * browser straight at `http://localhost:8787` — needs CORS on the runner, and the runner
   * is deliberately same-origin-only with no public port (§3.6, BOARD constraint 5).
   * Forking the topology (cross-origin in dev, same-origin in prod) across SSE, preflight
   * and credentials to paper over a missing proxy is the more expensive bug.
   *
   * PRECEDENCE IS LOAD-BEARING, and it is copied from the Caddyfile rather than invented:
   * two owners share the `/api` prefix. `sessions-relay-engineer` owns `/api/sessions*`
   * and `/api/push*` (§3.1), served from *this* app as Next route handlers under
   * `src/app/api/`; `runner-engineer` owns everything else under `/api` (§3.2/§3.3).
   * Caddy matches the two narrow `handle` blocks first; the negative lookahead below is
   * the same rule in path-to-regexp form. Drop it and the sessions routes get handed to a
   * process with no relay code — a silent 404 on the phone, not an error here.
   *
   * Returning `[]` under the deployed stack is not a nicety: `infra/compose.yaml` runs web
   * with `NODE_ENV=production` behind Caddy, and a rewrite there would put Next and Caddy
   * both in the path for the same prefix. See `RUNNER_PROXY_ORIGIN` above for how the two
   * cases are told apart. One caveat worth knowing: `next start` reads rewrites from the
   * build manifest, so under a production build the env must be set at `next build` time,
   * not at start time. Under `next dev` it is read live.
   *
   * @returns {Promise<import('next').Rewrite[]>}
   */
  async rewrites() {
    // Caddy answers first in the deployed stack; anything here would be a second proxy.
    if (RUNNER_PROXY_ORIGIN === null) return [];

    return [
      // §3.2/§3.3 — runner. Everything under /api EXCEPT the two prefixes web owns.
      // `:path` carries a custom pattern, so `.` matches `/` too and this is multi-segment
      // (`/api/agents/sales/account-enrichment` → path = `agents/sales/account-enrichment`).
      {
        source: '/api/:path((?!sessions|push).*)',
        destination: `${RUNNER_PROXY_ORIGIN}/api/:path`,
      },
      // Part V watcher — WebSocket graph deltas (`ws://…/ws/graph`). Verified end to end
      // under `next dev`: the handshake comes back `101 Switching Protocols` and the
      // runner's `hello` frame arrives, so the dev proxy does carry the upgrade. Under a
      // production build this path is Caddy's (`handle /ws/*`), so the `next start` case
      // is untested on purpose rather than assumed.
      {
        source: '/ws/:path*',
        destination: `${RUNNER_PROXY_ORIGIN}/ws/:path*`,
      },
    ];
  },
};

/**
 * Config as a function so Next hands us the phase it is running in — the only reliable
 * answer to "am I the dev server or a build?" at config time.
 *
 * @param {string} phase one of Next's `PHASE_*` constants
 * @returns {import('next').NextConfig}
 */
export default function config(phase) {
  return {
    ...nextConfig,
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next' : BUILD_DIST_DIR,
  };
}
