#!/usr/bin/env node
/**
 * check-sw-poisoning — put a real Chrome into the broken state and watch it come back.
 *
 * Owner: shell-navigation-engineer (§3.6, with `apps/web/public/sw.js`).
 *
 * ## The class no other gate in this repo can see
 *
 * `scripts/check-page-errors.mjs` spawns Chrome with `mkdtemp` — **a fresh profile every
 * run**. A profile with no history has no service worker registration, so the service
 * worker's `fetch` handler has never once executed under any gate in this repository.
 * That is not a bug in that gate; it is a blind spot it was never built to cover, and it
 * is why a cache-first rule over `next dev`'s non-hashed chunk URLs could sit in `sw.js`
 * behind a comment asserting it was safe, with every gate green, while the app looked
 * broken to its own author on every route.
 *
 * The mechanism, so nobody has to re-derive it: `next dev` serves chunks at stable paths
 * (`/_next/static/chunks/app/layout.js`) whose *content* changes on every rebuild.
 * Cache-first means the first copy is returned forever. A hard reload does not help — it
 * bypasses the HTTP cache, and the service worker answers `fetch` before the HTTP cache is
 * ever consulted. The server then renders one build's HTML against another build's
 * JavaScript, and React reports it as a hydration error on every route.
 *
 * ## Why this file is shaped as poison-then-recover
 *
 * A test that asserts "development does not register a service worker" is a **declaration
 * check**: it reads a line of our own code back to us. It would pass with the bug fully
 * live in `sw.js`, because the bug is not in whether we register — it is in what the
 * worker does once someone, or a stale bundle, or last week, already registered it.
 *
 * So this checks no declarations. It registers the worker by hand, seeds the cache exactly
 * as a poisoned browser's is seeded, and reads what the browser actually gets back.
 * **Step 3 is the falsification anchor**: it demands that cache-first pinning is
 * reproducible in this very browser, through this very worker, on a URL that is still
 * legitimately cache-first. If step 3 cannot poison an asset, the run proves nothing and
 * exits non-zero saying exactly that — rather than reporting a green built on an
 * instrument that was never plugged in.
 *
 * ## The six observations
 *
 *   1. seed `cc-shell-v1-*` caches, then register `/sw.js` for the first time
 *   2. **`activate` really purges them** — the VERSION-bump self-heal chain run rather
 *      than assumed (`skipWaiting` and `clients.claim` sit on the same path)
 *   3. **poisoning is real**: a seeded `/icons/...` entry is served instead of the
 *      server's bytes (the anchor — if this passes, the instrument works)
 *   4. **a dev chunk cannot be poisoned**: the same seeding on
 *      `/_next/static/chunks/app/layout.js` is ignored and the server's bytes arrive
 *   5. **a poisoned browser is rescued**: loading a real app route with a registration in
 *      place leaves zero registrations, zero caches, and the one-shot reload flag set
 *   6. a second development load acquires no registration at all
 *
 * Usage:
 *   node scripts/check-sw-poisoning.mjs            boot a private dev server, probe, exit
 *   node scripts/check-sw-poisoning.mjs --base URL reuse a server already running
 *   node scripts/check-sw-poisoning.mjs --headed   watch it
 *
 * Exit 0 = the browser recovered. Exit 1 = a finding. Exit 2 = the harness never came up,
 * which includes "could not reproduce the poisoning" — an instrument that cannot go red.
 */

import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findBrowser } from './check-page-errors.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WEB = join(ROOT, 'apps', 'web');

/**
 * Its own dist dir, pre-registered in `apps/web/tsconfig.json` alongside the other three.
 * Next appends `<distDir>/types/**` to that file the first time it sees a new name, and it
 * writes during compilation — so an unregistered name would dirty a tracked file mid-run.
 */
const DIST_DIR = '.next-swprobe';

/**
 * The document steps 1-4 run in. It must be same-origin and it must **not** be an app
 * route: every app route mounts `AppShell`, which renders the eviction script, which would
 * unregister the very worker we are trying to observe. The manifest is served straight
 * from `/public` as its own document and carries none of our JavaScript.
 */
const QUIET_DOC = '/manifest.webmanifest';

/** An app route, i.e. one that does mount the shell. Step 5 needs the eviction script. */
const SHELL_ROUTE = '/p/agentos/map';

const DEV_CHUNK = '/_next/static/chunks/app/layout.js';
/**
 * The anchor's victim. **Not** `icon-192`, and the reason is worth keeping: that one is in
 * `PRECACHE`, so `caches.match` finds the real bytes in `-shell` — which is created first
 * and searched first — before it ever reaches a seeded entry in `-static`. The first run of
 * this probe reported "could not reproduce pinning" for exactly that reason, which is the
 * void-not-pass branch doing its job on its own author.
 */
const CACHEABLE_ASSET = '/icons/icon-512.png';
const POISON = 'AGNETOS-POISON-MARKER-0f1e2d3c';

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const opt = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};

const findings = [];
const fail = (msg) => findings.push(msg);
const steps = [];
const note = (msg) => {
  steps.push(msg);
  console.log(`  ${msg}`);
};

/* ------------------------------------------------------------------ *
 * A very small CDP client. Deliberately not imported from
 * check-page-errors.mjs: that file belongs to another agent (ADR-035)
 * and its `Cdp` is not exported. `findBrowser` is, so that much is shared.
 * ------------------------------------------------------------------ */

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = [];
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data));
      if (msg.id !== undefined) {
        const p = this.pending.get(msg.id);
        if (!p) return;
        this.pending.delete(msg.id);
        if (msg.error) p.reject(new Error(`${msg.error.message} (${msg.error.code})`));
        else p.resolve(msg.result);
        return;
      }
      for (const fn of this.listeners) fn(msg.method, msg.params, msg.sessionId);
    });
  }

  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true });
      ws.addEventListener('error', () => rej(new Error(`could not open ${url}`)), { once: true });
    });
    return new Cdp(ws);
  }

  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    this.ws.send(JSON.stringify(payload));
    return new Promise((res, rej) => {
      this.pending.set(id, { resolve: res, reject: rej });
      setTimeout(() => {
        if (this.pending.delete(id)) rej(new Error(`CDP timeout: ${method}`));
      }, 60_000);
    });
  }

  on(fn) {
    this.listeners.push(fn);
  }
}

async function freePort() {
  return new Promise((res, rej) => {
    const srv = createServer();
    srv.on('error', rej);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => res(port));
    });
  });
}

async function waitFor(fn, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    try {
      if (await fn()) return;
    } catch (e) {
      last = e;
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`timed out waiting for ${label}${last ? ` — ${last.message}` : ''}`);
}

/** Evaluate an async expression in the page and return its value. Throws if the page throws. */
async function evaluate(cdp, sessionId, expression) {
  const res = await cdp.send(
    'Runtime.evaluate',
    { expression, awaitPromise: true, returnByValue: true },
    sessionId,
  );
  if (res.exceptionDetails) {
    const d = res.exceptionDetails;
    throw new Error(d.exception?.description ?? d.text ?? 'page threw');
  }
  return res.result?.value;
}

async function navigate(cdp, sessionId, url, settleMs) {
  let loaded = false;
  const listener = (method, _p, sid) => {
    if (sid === sessionId && method === 'Page.loadEventFired') loaded = true;
  };
  cdp.on(listener);
  await cdp.send('Page.navigate', { url }, sessionId);
  try {
    await waitFor(async () => loaded, 120_000, `load of ${url}`);
  } finally {
    cdp.listeners = cdp.listeners.filter((fn) => fn !== listener);
  }
  await new Promise((r) => setTimeout(r, settleMs));
}

/* ------------------------------------------------------------------ *
 * Expressions evaluated inside the page
 * ------------------------------------------------------------------ */

const seedV1Caches = `(async () => {
  const a = await caches.open('cc-shell-v1-static');
  await a.put('${DEV_CHUNK}', new Response('${POISON}', { headers: { 'content-type': 'application/javascript' } }));
  const b = await caches.open('cc-shell-v1-shell');
  await b.put('/offline', new Response('${POISON}', { headers: { 'content-type': 'text/html' } }));
  return (await caches.keys()).sort();
})()`;

const registerAndWait = `(async () => {
  await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  const reg = await navigator.serviceWorker.ready;
  for (let i = 0; i < 100 && !navigator.serviceWorker.controller; i += 1) {
    await new Promise((r) => setTimeout(r, 100));
  }
  return {
    active: reg.active ? reg.active.state : null,
    scope: reg.scope,
    controlled: navigator.serviceWorker.controller !== null,
  };
})()`;

const cacheKeys = 'caches.keys().then((k) => k.sort())';

const poison = (path) => `(async () => {
  const bucket = (await caches.keys()).find((k) => k.endsWith('-static')) || 'cc-shell-v2-static';
  const c = await caches.open(bucket);
  await c.put('${path}', new Response('${POISON}', { headers: { 'content-type': 'application/javascript' } }));
  return bucket;
})()`;

/**
 * A plain `fetch`, deliberately: no `cache` option. The service worker answers before the
 * HTTP cache is consulted, so cache-busting here would only add a variable — and the whole
 * point of the bug is that bypassing the HTTP cache does not help.
 */
const readThrough = (path) =>
  `fetch('${path}').then((r) => r.text()).then((t) => t.slice(0, 300))`;

const state = `(async () => ({
  registrations: (await navigator.serviceWorker.getRegistrations()).length,
  caches: (await caches.keys()).sort(),
  reloadFlag: sessionStorage.getItem('agnetos:dev-sw-evicted'),
  controlled: navigator.serviceWorker.controller !== null,
}))()`;

/* ------------------------------------------------------------------ */

async function main() {
  const reuse = opt('--base');
  const port = Number(opt('--port') ?? (reuse ? 0 : await freePort()));
  const base = reuse ?? `http://127.0.0.1:${port}`;
  const settleMs = Number(opt('--settle') ?? 2500);

  const browser = findBrowser();
  if (!browser) {
    console.error(
      'check-sw-poisoning — no Chromium-family browser found. Set CHROME_PATH to override.\n' +
        '  This probe needs a real browser: jsdom has no service worker, and a mock of one\n' +
        '  would be a mock of the exact component whose behaviour is in question.',
    );
    process.exit(2);
  }

  let server = null;
  let serverLog = '';
  if (!reuse) {
    await rm(join(WEB, DIST_DIR), { recursive: true, force: true }).catch(() => {});
    await mkdir(join(WEB, DIST_DIR), { recursive: true }).catch(() => {});
    const nextBin = join(ROOT, 'node_modules', 'next', 'dist', 'bin', 'next');
    server = spawn(
      process.execPath,
      [nextBin, 'dev', '--port', String(port), '--hostname', '127.0.0.1'],
      {
        cwd: WEB,
        env: { ...process.env, NEXT_DIST_DIR: DIST_DIR, FORCE_COLOR: '0', NODE_ENV: 'development' },
      },
    );
    server.stdout.on('data', (d) => (serverLog += d.toString()));
    server.stderr.on('data', (d) => (serverLog += d.toString()));
    try {
      await waitFor(
        async () => {
          if (server.exitCode !== null) throw new Error(`dev server exited ${server.exitCode}`);
          const res = await fetch(base, { signal: AbortSignal.timeout(5000) });
          return res.status < 500;
        },
        180_000,
        'the dev server',
      );
    } catch (e) {
      console.error(`check-sw-poisoning — ${e.message}\n${serverLog.slice(-3000)}`);
      process.exit(2);
    }
  }

  // A profile directory that persists **across the loads in this run** is the whole point.
  // It is still per-run, so nothing leaks into the developer's own browser.
  const profile = await mkdtemp(join(tmpdir(), 'agnetos-swprobe-'));
  const chrome = spawn(
    browser.path,
    [
      flag('--headed') ? null : '--headless=new',
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      '--disable-extensions',
      '--window-size=1440,900',
      // 127.0.0.1 is a secure context by origin, so service workers are available with no
      // flag at all. Said out loud because TLS is the first thing anyone suspects here.
      'about:blank',
    ].filter(Boolean),
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );

  let chromeLog = '';
  const wsUrl = await new Promise((res, rej) => {
    const timer = setTimeout(
      () => rej(new Error('Chrome never printed a DevTools endpoint')),
      30_000,
    );
    const onData = (d) => {
      chromeLog += d.toString();
      const m = chromeLog.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) {
        clearTimeout(timer);
        res(m[1]);
      }
    };
    chrome.stderr.on('data', onData);
    chrome.stdout.on('data', onData);
    chrome.on('exit', (code) => {
      clearTimeout(timer);
      rej(new Error(`Chrome exited ${code} before listening\n${chromeLog.slice(-2000)}`));
    });
  }).catch((e) => {
    console.error(`check-sw-poisoning — ${e.message}`);
    return null;
  });

  const shutdown = async (code) => {
    try {
      chrome.kill();
    } catch {
      /* already gone */
    }
    if (server) server.kill();
    await rm(profile, { recursive: true, force: true }).catch(() => {});
    process.exit(code);
  };

  if (!wsUrl) await shutdown(2);

  const cdp = await Cdp.connect(wsUrl);
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Runtime.enable', {}, sessionId);
  await cdp.send('Page.enable', {}, sessionId);

  const consoleErrors = [];
  cdp.on((method, params, sid) => {
    if (sid !== sessionId) return;
    if (method === 'Runtime.consoleAPICalled' && params.type === 'error') {
      consoleErrors.push((params.args ?? []).map((a) => a.description ?? a.value).join(' '));
    }
    if (method === 'Runtime.exceptionThrown') {
      consoleErrors.push(
        params.exceptionDetails?.exception?.description ?? params.exceptionDetails?.text ?? '',
      );
    }
  });

  try {
    console.log(`check-sw-poisoning — ${base} (${browser.label})\n`);

    /* -- 1. a quiet same-origin document, and the caches a poisoned browser holds ---- */
    await navigate(cdp, sessionId, base + QUIET_DOC, 300);
    const swAvailable = await evaluate(cdp, sessionId, `'serviceWorker' in navigator`);
    if (swAvailable !== true) {
      console.error(
        `check-sw-poisoning — navigator.serviceWorker is absent on ${QUIET_DOC}.\n` +
          '  The probe cannot register anything, so it can observe nothing. Refusing to\n' +
          '  report a pass from an instrument that is not plugged in.',
      );
      await shutdown(2);
    }
    const seeded = await evaluate(cdp, sessionId, seedV1Caches);
    note(`1. seeded the previous version's caches: ${seeded.join(', ')}`);

    /* -- 2. first registration; activate must purge every non-VERSION key ------------ */
    const reg = await evaluate(cdp, sessionId, registerAndWait);
    note(`2. registered /sw.js — worker ${reg.active} at ${reg.scope}, controlling=${reg.controlled}`);
    if (reg.controlled !== true) {
      console.error(
        'check-sw-poisoning — the worker activated but never claimed this document.\n' +
          '  Every later step reads through that control, so none of them would mean anything.\n' +
          '  Void, not a pass. `clients.claim()` in the activate handler is the suspect.',
      );
      await shutdown(2);
    }
    const afterActivate = await evaluate(cdp, sessionId, cacheKeys);
    const survivors = afterActivate.filter((k) => k.startsWith('cc-shell-v1'));
    if (survivors.length > 0) {
      fail(
        `the VERSION bump does not self-heal: ${survivors.join(', ')} survived activation.\n` +
          '    `activate` is supposed to delete every key not starting with VERSION and then\n' +
          '    claim open clients. Bumping VERSION buys nothing if that chain does not run.',
      );
    } else {
      note(`   activate purged them; caches now: ${afterActivate.join(', ') || '(none)'}`);
    }

    /* -- 3. THE ANCHOR: pinning must be reproducible on a still-cache-first URL ------ */
    const bucket = await evaluate(cdp, sessionId, poison(CACHEABLE_ASSET));
    const pinned = String(await evaluate(cdp, sessionId, readThrough(CACHEABLE_ASSET)));
    if (!pinned.includes(POISON)) {
      console.error(
        `check-sw-poisoning — could not reproduce cache-first pinning on ${CACHEABLE_ASSET}.\n` +
          `  Seeded ${bucket} with a marker body and the browser returned the server's bytes\n` +
          '  anyway. That means this probe cannot observe the failure it exists to observe, so\n' +
          '  a green from step 4 below would prove nothing. **This run is void**, not a pass.\n' +
          '  Likely causes: the worker is not intercepting; the asset is in PRECACHE so -shell answers first; or the cache-first branch no longer\n' +
          '  covers /icons/ — in which case re-aim step 3 at a URL it does cover, rather than\n' +
          '  deleting the step that keeps the rest of this file honest.',
      );
      await shutdown(2);
    }
    note(`3. anchor: ${CACHEABLE_ASSET} returned the seeded body, not the server's — pinning is real here`);

    /* -- 4. the same seeding must be inert for a non-hashed dev chunk ---------------- */
    await evaluate(cdp, sessionId, poison(DEV_CHUNK));
    const chunk = String(await evaluate(cdp, sessionId, readThrough(DEV_CHUNK)));
    if (chunk.includes(POISON)) {
      fail(
        `${DEV_CHUNK} was served from the cache.\n` +
          '    This is the bug exactly: a stable, non-hashed `next dev` path pinned cache-first,\n' +
          "    so the browser answers with one build's JavaScript against every later build's\n" +
          '    HTML. React reports it as a hydration error on every route and a hard reload does\n' +
          '    not clear it. `isImmutableAsset` in apps/web/public/sw.js must be false here.',
      );
    } else if (chunk.trim().length === 0) {
      fail(
        `${DEV_CHUNK} came back empty, so step 4 distinguished nothing.\n` +
          '    An empty read is not a clean read — if the dev server does not serve this path,\n' +
          '    aim the probe at one it does rather than accepting the silence as a pass.',
      );
    } else {
      note(`4. ${DEV_CHUNK} ignored the seeded entry and returned ${chunk.length}+ bytes from the server`);
    }

    /* -- 5. a poisoned browser loading a real route must end up clean ---------------- */
    await evaluate(cdp, sessionId, poison(DEV_CHUNK));
    const before = await evaluate(cdp, sessionId, state);
    if (before.registrations === 0) {
      console.error(
        'check-sw-poisoning — step 5 starts with zero registrations, so there is nothing to\n' +
          '  rescue and a green would be vacuous. Void, not a pass.',
      );
      await shutdown(2);
    }
    await navigate(cdp, sessionId, base + SHELL_ROUTE, settleMs);
    // The eviction reloads once, and the reload swaps execution context, so re-read until
    // it settles rather than sampling in the middle of it.
    let after = before;
    await waitFor(
      async () => {
        after = await evaluate(cdp, sessionId, state);
        return after.registrations === 0;
      },
      20_000,
      'the dev eviction to remove every registration',
    ).catch(() => {});

    if (after.registrations !== 0) {
      fail(
        `after loading ${SHELL_ROUTE} in development, ${after.registrations} service worker ` +
          'registration(s) remain.\n' +
          '    A guard that only refuses *new* registrations leaves every already-poisoned\n' +
          '    browser broken forever. The unregister path is the half that rescues people.',
      );
    } else if (after.caches.length !== 0) {
      fail(
        `the registration is gone but ${after.caches.length} cache(s) remain: ${after.caches.join(', ')}.\n` +
          '    An unregistered worker stops intercepting, but the caches it filled are still\n' +
          '    there for the next worker to serve from. Both halves or neither.',
      );
    } else {
      note(
        `5. rescued: ${before.registrations} registration(s) and ${before.caches.length} cache(s) before, ` +
          `0 and 0 after; one-shot reload flag = ${after.reloadFlag}`,
      );
      if (after.reloadFlag !== '1') {
        fail(
          'registrations and caches are gone but the one-shot reload never fired ' +
            `(sessionStorage flag = ${JSON.stringify(after.reloadFlag)}).\n` +
            '    Unregistering does not re-fetch the chunks this page already took from the\n' +
            '    cache, so without the reload the very load that performed the rescue still\n' +
            '    renders stale JavaScript — which is exactly what the developer sees.',
        );
      }
    }

    /* -- 6. and a clean development browser must not acquire one at all -------------- */
    await navigate(cdp, sessionId, base + SHELL_ROUTE, settleMs);
    const clean = await evaluate(cdp, sessionId, state);
    if (clean.registrations !== 0) {
      fail(
        `a second development load ended with ${clean.registrations} service worker(s) present.\n` +
          '    This step cannot distinguish a newly created registration from one that step 5\n' +
          '    failed to remove, and does not claim to — either way, the guard in\n' +
          '    `registerServiceWorker` or the eviction script is not holding.',
      );
    } else {
      note('6. a second development load registered nothing');
    }
  } catch (e) {
    console.error(`\ncheck-sw-poisoning — the probe itself failed: ${e.message}`);
    console.error('  Reporting exit 2. A harness that fell over is not a passing app.');
    await shutdown(2);
  }

  const hydration = consoleErrors.filter((m) => /hydrat|did not match/i.test(m));
  if (hydration.length > 0) {
    fail(`React reported a hydration problem during the probe:\n    ${hydration[0].slice(0, 300)}`);
  }

  console.log('');
  if (findings.length > 0) {
    console.error(`check-sw-poisoning — ${findings.length} finding(s):\n`);
    for (const f of findings) console.error(`  - ${f}\n`);
    await shutdown(1);
  }
  console.log(`check-sw-poisoning — clean. ${steps.length} observations, all in a real browser.`);
  await shutdown(0);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) await main();
