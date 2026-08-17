#!/usr/bin/env node
/**
 * smoke-routes — boot the app, request every route, and fail on a bundle that compiles
 * and does not run.
 *
 * ADR-035. Owner: `agent-library-curator` until a platform owner claims it.
 *
 * ## The gap this fills
 *
 * On 2026-08-17 the web app white-screened on every route for the first person who opened
 * a browser. Every instrument in the repo was green while it did:
 *
 *   `tsc --noEmit`          clean, both projects
 *   `npm test`              green      `npm run test:web`   green
 *   `npm run test:runner`   green      `validate:*`          green
 *   `next build`            **exit 0**, and its log contains no warning at all
 *
 * The reason is uniform: **every one of those inspects source text. None observes the
 * artifact running.** The cause was two star-exported modules in `@agnetos/contracts`
 * declaring one runtime name, which makes Next's `optimizePackageImports` barrel optimizer
 * discard the whole barrel — a browser-only failure, invisible to a type checker and to a
 * test that imports the TypeScript directly.
 *
 * ## What this checks, and what it does not
 *
 * Three observations, in increasing order of how much they cost:
 *
 * 1. **The dev compile log.** `next dev` prints `Attempted import error`, `conflicting
 *    star exports`, `Module not found` and `Failed to compile` as it compiles each route.
 *    They are warnings, so they do not fail anything on their own — Next serves a 200 with
 *    perfectly good SSR HTML and the page dies in the browser. This gate makes them fatal.
 *    **`next build` does not print them**; that was measured, not assumed, which is why
 *    this boots a dev server rather than grepping a build log.
 * 2. **Every route answers 2xx and renders its shell.** Weak on its own — the outage
 *    served 200 with complete HTML throughout, because SSR of a client component does not
 *    go through the browser bundle. Kept because it costs one request and catches the
 *    plainer breakages.
 * 3. **Every `__barrel_optimize__?names=N` module in the client chunks actually exports
 *    N.** This is the sharp one. Next rewrites `import { isProjectSlug } from '@agnetos/
 *    contracts'` into a synthetic module *named for the symbol it is supposed to provide*,
 *    so the artifact carries its own assertion: if that module's export list does not
 *    contain the name in its own query string, the import is `undefined` at runtime and
 *    the page will throw. No browser required, and it is precisely the observation that
 *    diagnosed the outage.
 *
 * **What a fuller version needs, stated rather than implied:** a headless browser. Nothing
 * here catches a runtime error with a cause other than a missing import — a null deref in
 * an effect, a hydration mismatch, a thrown render. That needs a real page load with
 * console and `pageerror` listeners, which needs Playwright or a CDP driver plus a browser
 * binary in CI, and it is the same dependency Part VI's 1440px screenshot comparison has
 * been blocked on since M0. Filed as one request rather than two, since one browser buys
 * both.
 *
 * Usage:
 *   node scripts/smoke-routes.mjs                 boot a private dev server, check, exit
 *   node scripts/smoke-routes.mjs --base URL      reuse a server already running
 *   node scripts/smoke-routes.mjs --keep          leave the server up (debugging)
 *
 * Exit 0 = clean. Exit 1 = at least one finding. Exit 2 = the server never came up.
 */

import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WEB = join(ROOT, 'apps', 'web');

/**
 * Every route a person can reach, with a marker that must appear in its HTML.
 *
 * The markers are chrome, not content: §2.0's tab bar is on all four views and is the
 * cheapest proof that the shell rendered rather than an error page. A content marker would
 * make this gate fail on an honest empty state, which is a thing this repo ships on purpose
 * (CLAUDE.md rule 9).
 */
const ROUTES = [
  { path: '/', marker: null },
  { path: '/p/agentos/map', marker: 'CHART' },
  { path: '/p/agentos/map/sales', marker: 'CHART' },
  { path: '/p/agentos/map/sales/account-enrichment', marker: 'CHART' },
  { path: '/p/agentos/chart', marker: 'MAP' },
  { path: '/p/agentos/chart/sales', marker: 'MAP' },
  { path: '/p/agentos/dashboards', marker: 'MAP' },
  { path: '/p/agentos/sessions', marker: 'MAP' },
  { path: '/offline', marker: null },
];

/** Compile-log strings that mean the bundle is broken even though the server said 200. */
const FATAL_LOG_PATTERNS = [
  'Attempted import error',
  'conflicting star exports',
  'Failed to compile',
  'Module not found',
  'export was not found in',
];

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const opt = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};

/** @type {string[]} */
const findings = [];
const fail = (msg) => findings.push(msg);

/* ------------------------------------------------------------------ *
 * Observation 3 — the barrel modules assert their own correctness
 * ------------------------------------------------------------------ */

/**
 * Pull every `__barrel_optimize__?names=A,B!=!spec` module definition out of a dev chunk
 * and check that each module's webpack export list contains every name in its own query.
 *
 * Dev chunks are unminified and each module is introduced by its own request string in a
 * `"(app-pages-browser)/…":` key, which is what makes this readable without a browser.
 * A production chunk is minified and this check silently finds nothing there — hence the
 * emptiness guard in `checkChunk`'s caller.
 *
 * @returns {{name: string, spec: string, missing: string[]}[]}
 */
export function barrelExportGaps(chunkSource) {
  /** @type {{name: string, spec: string, missing: string[]}[]} */
  const gaps = [];
  const defnRe = /"\(app-pages-browser\)\/__barrel_optimize__\?names=([^!]+)!=!([^"]+)":/g;
  for (const m of chunkSource.matchAll(defnRe)) {
    // `?names=X&wildcard!=!./frontmatter` is not a promise — it is one of the per-module
    // resolvers the optimizer generates *while* searching for X, and only one of them can
    // possibly contain it. Asserting on those reports six failures for every real one.
    // The module to hold to its name is the one pointed at the barrel itself.
    if (m[1].includes('&wildcard')) continue;
    const requested = m[1].split(',').filter(Boolean);
    if (requested.length === 0) continue;
    // The export list is the first `__webpack_require__.d(__webpack_exports__, { … })` in
    // the module body. Bounded slice so a malformed chunk cannot make this quadratic.
    const body = chunkSource.slice(m.index, m.index + 400_000);
    const dStart = body.indexOf('__webpack_require__.d(__webpack_exports__, {');
    if (dStart < 0) continue;
    const dEnd = body.indexOf('harmony export */ });', dStart);
    const head = body.slice(dStart, dEnd < 0 ? dStart + 200_000 : dEnd);
    const exported = new Set([...head.matchAll(/harmony export \*\/\s+([A-Za-z_$][\w$]*):/g)].map((x) => x[1]));
    const missing = requested.filter((n) => !exported.has(n));
    if (missing.length) gaps.push({ name: m[1], spec: m[2], missing });
  }
  return gaps;
}

/* ------------------------------------------------------------------ *
 * Boot
 * ------------------------------------------------------------------ */

async function waitForReady(base, child, timeoutMs = 180_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (child && child.exitCode !== null) return false;
    try {
      const res = await fetch(base, { signal: AbortSignal.timeout(5000) });
      if (res.status < 500) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function main() {
  const reuse = opt('--base');
  const port = Number(opt('--port') ?? 4399);
  const base = reuse ?? `http://127.0.0.1:${port}`;
  const distDir = '.next-smoke';

  let child = null;
  let log = '';

  if (!reuse) {
    // A private distDir. Sharing `.next` with a developer's `next dev` corrupts both —
    // see the comment block in apps/web/next.config.mjs.
    await rm(join(WEB, distDir), { recursive: true, force: true }).catch(() => {});
    // The Next CLI directly under this node, not through `npx`: a shelled-out `npx` needs
    // `shell: true` on Windows, which is both a DEP0190 warning and one more process
    // between the gate and the compile log it exists to read.
    const nextBin = join(ROOT, 'node_modules', 'next', 'dist', 'bin', 'next');
    child = spawn(process.execPath, [nextBin, 'dev', '--port', String(port), '--hostname', '127.0.0.1'], {
      cwd: WEB,
      env: { ...process.env, NEXT_DIST_DIR: distDir, FORCE_COLOR: '0', NODE_ENV: 'development' },
    });
    child.stdout.on('data', (d) => { log += d.toString(); });
    child.stderr.on('data', (d) => { log += d.toString(); });

    if (!(await waitForReady(base, child))) {
      console.error('smoke-routes — the dev server never became reachable.\n');
      console.error(log.slice(-4000));
      process.exit(2);
    }
  }

  /* ---- observation 2: every route answers and renders the shell ---- */
  /** @type {Set<string>} */
  const chunkUrls = new Set();
  for (const route of ROUTES) {
    let res;
    let html = '';
    try {
      res = await fetch(base + route.path, { signal: AbortSignal.timeout(120_000) });
      html = await res.text();
    } catch (e) {
      fail(`${route.path} — request failed: ${e.message}`);
      continue;
    }
    if (!res.ok) fail(`${route.path} — HTTP ${res.status}`);
    if (route.marker && !html.includes(route.marker)) {
      fail(`${route.path} — HTTP ${res.status} but the shell did not render (no "${route.marker}" in the HTML)`);
    }
    for (const m of html.matchAll(/\/_next\/static\/chunks\/[^"']+?\.js(?:\?[^"']*)?/g)) chunkUrls.add(m[0]);
  }

  /* ---- observation 3: the barrel modules keep their own promise ---- */
  let modulesInspected = 0;
  for (const url of chunkUrls) {
    let body;
    try {
      body = await (await fetch(base + url, { signal: AbortSignal.timeout(120_000) })).text();
    } catch (e) {
      fail(`chunk ${url} — could not be fetched: ${e.message}`);
      continue;
    }
    const defns = body.match(/"\(app-pages-browser\)\/__barrel_optimize__\?names=/g);
    modulesInspected += defns ? defns.length : 0;
    for (const gap of barrelExportGaps(body)) {
      fail(
        `${url}\n    __barrel_optimize__?names=${gap.name} does NOT export ${gap.missing.join(', ')}.\n` +
          `    Every client import of ${gap.missing.join('/')} from ${gap.spec} is undefined at\n` +
          `    runtime and will throw on first use. Cause is almost always a duplicate runtime\n` +
          `    name across two \`export *\` modules — run scripts/check-barrel-exports.mjs (ADR-035).`,
      );
    }
  }

  /* ---- observation 1: the compile log ---- */
  for (const pattern of FATAL_LOG_PATTERNS) {
    if (log.includes(pattern)) {
      const lines = log.split(/\r?\n/).filter((l) => l.includes(pattern)).slice(0, 5);
      fail(`compile log contains "${pattern}" — the bundle is broken even though the server answered:\n    ${lines.join('\n    ')}`);
    }
  }

  if (child && !flag('--keep')) child.kill();

  /* ---- the emptiness guard ---- */
  // This gate's whole value is that it observes the artifact. If it inspected no barrel
  // modules it observed nothing, and reporting a pass would be the same class of lie as
  // the comment that called the collision harmless.
  if (!reuse && modulesInspected === 0) {
    fail(
      `inspected ${chunkUrls.size} chunks and found 0 __barrel_optimize__ modules.\n` +
        `    Either optimizePackageImports was turned off in next.config.mjs, or this ran\n` +
        `    against a production build whose chunks are minified. Refusing to pass over an\n` +
        `    empty observation.`,
    );
  }

  if (findings.length === 0) {
    console.log(
      `Route smoke  ${base}\n` +
        `  ${ROUTES.length} routes 2xx and rendered · ${chunkUrls.size} client chunks · ` +
        `${modulesInspected} barrel modules, all exporting what they are named for · compile log clean`,
    );
    process.exit(0);
  }
  console.error(`Route smoke — FAIL  ${base}\n`);
  for (const f of findings) console.error(`  ${f}\n`);
  process.exit(1);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) await main();
