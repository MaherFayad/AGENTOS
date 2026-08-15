import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Repo root — apps/web/../.. — pinned so the standalone output layout is deterministic. */
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

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
    optimizePackageImports: ['@agnetos/contracts'],
  },

  // The stack has no public ports (§3.6) and the tailnet terminates TLS at Caddy, which
  // is the only hop that sees the real client. Trust its forwarded headers.
  poweredByHeader: false,
};

export default nextConfig;
