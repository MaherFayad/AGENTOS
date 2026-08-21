#!/usr/bin/env node
/**
 * check-page-errors — load every route in a real browser and fail on anything the
 * browser itself calls an error.
 *
 * Owner: `agent-library-curator` (with `scripts/smoke-routes.mjs`, ADR-035) until a
 * platform owner claims it.
 *
 * ## The gap this fills, and why it is the last one of its family
 *
 * `comms/BRIEF.md` carries the standing finding **"no gate loads a page"**. On 2026-08-17
 * the app white-screened on every route while `tsc`, three test suites, every validator
 * *and* `next build` were green. `smoke-routes.mjs` (ADR-035) closed most of that: it
 * observes the *artifact* by reading the dev chunks and holding each
 * `__barrel_optimize__?names=N` module to its own name. But it still never runs the page,
 * and it says so in its own header:
 *
 *   > What a fuller version needs, stated rather than implied: a headless browser. Nothing
 *   > here catches a runtime error with a cause other than a missing import — a null deref
 *   > in an effect, a hydration mismatch, a thrown render.
 *
 * This is that. It executes the client bundle in Chrome and listens for the three things
 * only a browser can report:
 *
 *   1. `Runtime.exceptionThrown`   — an uncaught throw, including inside React render
 *   2. `Runtime.consoleAPICalled`  — `console.error`, which is how React reports a
 *                                     hydration mismatch and how error boundaries log
 *   3. `Log.entryAdded`            — browser-level errors: failed subresources, CSP,
 *                                     bad network requests the page never surfaces
 *
 * **Observation 2 is the one that would have caught the outage as a person saw it.** The
 * white screen served HTTP 200 with complete SSR HTML throughout — a request-based check
 * cannot distinguish it from a working page, and *I made exactly that mistake*: every route
 * was reported working on the strength of a 200 that was the error boundary rendering.
 *
 * ## Why CDP and not Playwright
 *
 * Playwright is the obvious choice and it is deliberately not used. Adding it means a
 * dependency, a lockfile change and a browser download, and it buys nothing here: Chrome
 * and Edge are already installed, and Node's built-in `WebSocket` speaks the DevTools
 * Protocol with no package at all. `smoke-routes.mjs` named "Playwright **or a CDP driver**"
 * as the two options; this is the second, and it costs nothing to install in CI beyond a
 * browser that is present on every developer machine here already.
 *
 * ## What this still does not cover
 *
 * **Part VI's 1440px side-by-side is still not runnable, and this does not change that.**
 * That comparison needs *reference frames* from the SkillTree video, which no script can
 * produce — it is a genuine Phase 0 item sitting with the user, and it stays there. What
 * this removes from that list is only the browser half. A screenshot at 1440 is one CDP
 * call away (`Page.captureScreenshot`) the day the frames land; it is deliberately not
 * written yet, because a screenshot with nothing to compare against is a file, not a gate.
 *
 * A clean run here means the page loaded and the browser reported nothing wrong. It does
 * **not** mean the page is correct, and it makes no claim about layout, tokens or content.
 *
 * Usage:
 *   node scripts/check-page-errors.mjs              boot a private dev server, check, exit
 *   node scripts/check-page-errors.mjs --base URL   reuse a server already running
 *   node scripts/check-page-errors.mjs --falsify    prove the detector can go red
 *   node scripts/check-page-errors.mjs --headed     watch it (debugging)
 *
 * Exit 0 = clean. Exit 1 = at least one finding. Exit 2 = the harness never came up.
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WEB = join(ROOT, 'apps', 'web');

/**
 * The same routes `smoke-routes.mjs` requests. Kept as its own list rather than imported,
 * because that file's list is paired with HTML markers this one has no use for — and a
 * shared list would make one gate's route addition silently change the other's meaning.
 */
const ROUTES = [
  '/',
  '/p/agentos/map',
  '/p/agentos/map/design',
  '/p/agentos/map/design/product-designer',
  '/p/agentos/chart',
  '/p/agentos/chart/design',
  '/p/agentos/dashboards',
  // **The detail view, and the reason it is worth naming separately.** Every other view here
  // has its deep route listed — `map/:dept/:agent`, `chart/:dept`, `threads/:id`,
  // `sessions/:id` — and this one did not, for as long as this gate has existed. The carousel
  // above renders no widget at all, so **no widget renderer had ever been executed by a
  // runtime gate**: not the canonical seven, not `thread-feed`, not `calendar`. An
  // include-list is a decision to be blind to everything unnamed, and the comment directly
  // below already described this exact hazard while the list underneath it had it.
  '/p/agentos/dashboards/mission-control',
  // M16 — THREADS took the fourth tab slot; both `/sessions` paths stay live underneath it
  // rather than being redirected, so all four are loaded. Kept in step with the list in
  // `smoke-routes.mjs` by hand: the lists are separate because that one pairs each path with
  // an HTML marker, and the cost of that choice is exactly this — a route added to one gate
  // is not covered by the other until someone copies it.
  '/p/agentos/threads',
  '/p/agentos/threads/3f9a0000-0000-0000-0000-000000000000',
  '/p/agentos/sessions',
  '/p/agentos/sessions/abc123',
  '/offline',
  // **The four this gate could not see, and the reason `finalPath` exists.**
  //
  // Every route above is one the `p/[project]/` tree defines, so none of them reaches
  // `app/(views)/[...legacy]` — where an unbounded redirect loop lived from M15 until
  // 2026-08-21 with this gate reporting exit 0 over it the whole time. Two blindnesses
  // compounded: the loop paths were **not in this list** (an include-list is a decision
  // to be blind to everything unnamed), and **nothing throws while it loops**, so even
  // once a path was listed the three detectors above would still have had nothing to
  // report. An include-list plus a no-exception check is not a check that the page went
  // where it said it was going.
  //
  // The first two are the §3.6 push deep links `sessions/push/payload.ts` actually emits;
  // they were two of the three notification types and both were unreachable.
  '/approvals/abc123',
  '/runs/abc123',
  // Project-scoped with no view underneath — the shape that made the prefixing recursive.
  '/p/agentos/nope',
  // Unscoped and unrouted: still legitimately rewritten once, so this proves the fix did
  // not simply switch the rewrite off.
  '/calendar',
];

/**
 * How many `/p/` segments a pathname may carry. Exactly one, always: a URL names one
 * project or none.
 *
 * Stated as a counted property rather than as *"must not contain `/p/x/p/x`"* on purpose.
 * The standing findings say a **substring is a claim you did not narrow** and an example
 * list is a claim you did not generalise; counting the segment catches the loop at depth 2
 * and at depth 20, and catches any other href builder that ever double-prefixes.
 */
const MAX_PROJECT_SEGMENTS = 1;

function projectSegmentCount(pathname) {
  return pathname.split('/').filter((seg) => seg === 'p').length;
}

/**
 * Console noise that is not a defect.
 *
 * This list is the dangerous part of the file and it is kept deliberately short and
 * specific. **Every entry here is a thing this gate is blind to** — the standing finding
 * *"checkers go blind silently"* is exactly this mechanism: `check-rtl` could not see 190
 * rendered strings and reported green. Anything added here must name why the browser is
 * wrong rather than why the message is inconvenient.
 */
const IGNORED = [
  // Next's dev-only HMR/websocket chatter on a server that is about to be killed.
  { pattern: /\[Fast Refresh\]/, why: 'dev-server HMR notice, not page behaviour' },
  {
    pattern: /Download the React DevTools/,
    why: 'React’s own install suggestion; emitted on every dev page load',
  },
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

/**
 * Backend absences — reported loudly, but not fatal.
 *
 * A 5xx from one of our own `/api/` routes always logs a browser error, and on this stack
 * it is usually the **correct** behaviour rather than a defect: there is no `DATABASE_URL`,
 * so `GET /api/status` reports `ledger.state: "absent"` and the metrics routes 503 instead
 * of inventing a zero. That is CLAUDE.md rule 9 working (*"`unknown` is not `zero`"*), and a
 * gate that failed on it would be red on every developer machine until Postgres runs — which
 * is how a gate becomes something people pass with `--force`.
 *
 * **This is the seam where this gate could go blind, so it does not get to be quiet.** The
 * absences are printed on a pass, and their count is in the summary line. Two rules keep the
 * split honest: only a **5xx** qualifies (a 404 is a wrong URL and stays fatal), and only on
 * **our own origin's `/api/`** (a third-party failure is not ours to excuse).
 */
const backendGaps = [];

/* ------------------------------------------------------------------ *
 * Finding the browser
 * ------------------------------------------------------------------ */

/**
 * Chrome, then Edge, then whatever Playwright already cached. All three are Chromium and
 * all three speak the same protocol, so any of them is a valid instrument.
 *
 * @returns {{path: string, label: string} | null}
 */
export function findBrowser(env = process.env) {
  const candidates = [];
  if (env.CHROME_PATH) candidates.push({ path: env.CHROME_PATH, label: 'CHROME_PATH' });
  const programFiles = [env['ProgramFiles'], env['ProgramFiles(x86)'], env.LOCALAPPDATA].filter(Boolean);
  for (const base of programFiles) {
    candidates.push({ path: join(base, 'Google', 'Chrome', 'Application', 'chrome.exe'), label: 'Chrome' });
    candidates.push({ path: join(base, 'Microsoft', 'Edge', 'Application', 'msedge.exe'), label: 'Edge' });
  }
  // Linux/macOS, so this gate is not Windows-only the moment CI is not.
  candidates.push({ path: '/usr/bin/google-chrome', label: 'Chrome' });
  candidates.push({ path: '/usr/bin/chromium', label: 'Chromium' });
  candidates.push({
    path: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    label: 'Chrome',
  });
  for (const c of candidates) {
    if (c.path && existsSync(c.path)) return c;
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * A minimal CDP client over Node's built-in WebSocket
 * ------------------------------------------------------------------ */

/**
 * Flat-protocol CDP: one socket to the browser, `sessionId` on every message that belongs
 * to a page. Flat mode is what makes a single socket enough — without it each target needs
 * its own connection and its own message-id space.
 */
class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    /** @type {Map<number, {resolve: Function, reject: Function}>} */
    this.pending = new Map();
    /** @type {Array<(method: string, params: any, sessionId?: string) => void>} */
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
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.pending.delete(id)) reject(new Error(`CDP timeout: ${method}`));
      }, 60_000);
    });
  }

  on(fn) {
    this.listeners.push(fn);
  }

  close() {
    try {
      this.ws.close();
    } catch {
      /* already gone */
    }
  }
}

/* ------------------------------------------------------------------ *
 * Turning CDP events into findings
 * ------------------------------------------------------------------ */

/**
 * Render one CDP error event as a line a person can act on.
 *
 * Exported and pure so it can be unit-tested without a browser — the shape of these
 * payloads is the part most likely to drift between Chrome versions.
 *
 * @returns {string | null} null when the event is not an error, or is ignorable
 */
export function describeError(method, params) {
  if (method === 'Runtime.exceptionThrown') {
    const d = params.exceptionDetails ?? {};
    const text = d.exception?.description ?? d.text ?? 'uncaught exception';
    const at = d.url ? ` (${d.url}:${(d.lineNumber ?? 0) + 1})` : '';
    return `uncaught exception — ${String(text).split('\n')[0]}${at}`;
  }
  if (method === 'Runtime.consoleAPICalled') {
    if (params.type !== 'error' && params.type !== 'assert') return null;
    const text = (params.args ?? [])
      .map((a) => a.description ?? (a.value !== undefined ? String(a.value) : a.type))
      .join(' ');
    if (IGNORED.some((i) => i.pattern.test(text))) return null;
    return `console.${params.type} — ${text.split('\n')[0]}`;
  }
  if (method === 'Log.entryAdded') {
    const e = params.entry ?? {};
    if (e.level !== 'error') return null;
    if (IGNORED.some((i) => i.pattern.test(e.text ?? ''))) return null;
    return `browser ${e.source} error — ${e.text}${e.url ? ` (${e.url})` : ''}`;
  }
  return null;
}

/**
 * Is this finding our own backend being absent, rather than our code being wrong?
 *
 * Two shapes, and the second was missing until `drawer-engineer` reported the
 * inconsistency: an `/api/` route answering 5xx, **and the WebSocket handshake to the same
 * absent runner**. Excusing one while failing the other is incoherent — `/api/p/x/graph`
 * returning 503 and `ws://…/ws/p/x/graph` refusing to handshake are one fact reported twice,
 * and the gate was calling that fact honest in HTTP and fatal in WebSocket. It made
 * `smoke:browser` red for a reason unrelated to the change under test, which is how a gate
 * stops being consulted.
 *
 * That is the include-list finding again, in the file whose header quotes it: **the original
 * rule named `/api/` and was therefore blind to every other way the same backend can be
 * absent.** It is written as a list of shapes now, so adding one is a visible edit here
 * rather than a silent widening somewhere else.
 *
 * Still deliberately narrow: a 404 is a wrong URL and stays fatal, a non-5xx stays fatal,
 * another origin is not ours to excuse, and an uncaught exception or `console.error` is
 * never laundered into this bucket however it is worded.
 *
 * @param {string} line   a line from `describeError`
 * @param {string} base   the origin under test, e.g. `http://127.0.0.1:4401`
 */
export function isBackendAbsence(line, base) {
  if (!line.startsWith('browser network error')) return false;

  // Shape 1 — our own HTTP API answering 5xx.
  if (line.includes(`${base}/api/`) && /status of 5\d\d/.test(line)) return true;

  // Shape 2 — the WebSocket to our own origin failing its handshake. `base` is `http://host`
  // while the socket URL is `ws://host`, so the origin is compared with the scheme stripped
  // rather than by substring — `includes(host)` would also match a third-party URL that
  // merely mentions it.
  const host = base.replace(/^https?:\/\//, '');
  if (/^browser network error — WebSocket connection to/.test(line)) {
    if (line.includes(`ws://${host}/ws/`) || line.includes(`wss://${host}/ws/`)) return true;
  }
  return false;
}

/* ------------------------------------------------------------------ *
 * Boot
 * ------------------------------------------------------------------ */

/**
 * Ask the OS for a free port instead of hoping a fixed one is free.
 *
 * Concurrent agents are normal in this repo, and a hardcoded port turns that into a gate
 * that fails for a reason having nothing to do with the code: `design-system-guardian` lost
 * its page-load evidence to `EADDRINUSE 127.0.0.1:4399` twice in one dispatch, and reported
 * the honest result — *"no page load observed by me"* — rather than a green it had not seen.
 * A gate that a second reader cannot run is a gate with one reader.
 *
 * Binding to 0 and releasing is a race in principle: another process can take the port in
 * the gap. In practice the window is milliseconds and the alternative — a fixed port — fails
 * *reliably* rather than rarely. `--port` still overrides for a reproducible run.
 */
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
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const got = await fn();
    if (got) return got;
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`timed out waiting for ${label}`);
}

/**
 * Load one URL in a fresh tab and return everything the browser complained about, plus
 * **where the browser ended up**.
 *
 * A fresh tab per route on purpose: a shared tab would let one route's error land in
 * another's report, and a client-side navigation would skip the very bundle evaluation
 * this gate exists to observe.
 *
 * `finalPath` was added 2026-08-21 and it is the answer to a specific blindness. For four
 * days this gate returned exit 0 over an **unbounded redirect loop** — `/approvals/abc`
 * climbing to `/p/agentos/p/agentos/…` without terminating — because nothing here looked
 * at the address bar. The loop throws nothing, logs nothing and fails no subresource, so
 * all three of this gate's detectors were correct and all three saw nothing. A checker
 * that only listens for complaints is deaf to a page that is quietly, silently wrong.
 */
async function visit(cdp, url, settleMs) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });

  /** @type {string[]} */
  const errors = [];
  const listener = (method, params, sid) => {
    if (sid !== sessionId) return;
    const line = describeError(method, params);
    if (line) errors.push(line);
  };
  cdp.on(listener);

  await cdp.send('Runtime.enable', {}, sessionId);
  await cdp.send('Log.enable', {}, sessionId);
  await cdp.send('Page.enable', {}, sessionId);

  let loaded = false;
  cdp.on((method, _params, sid) => {
    if (sid === sessionId && method === 'Page.loadEventFired') loaded = true;
  });

  await cdp.send('Page.navigate', { url }, sessionId);
  try {
    await waitFor(async () => loaded, 120_000, `load of ${url}`);
  } catch (e) {
    errors.push(`never fired a load event — ${e.message}`);
  }
  // React renders, effects run and error boundaries log *after* load. The outage this gate
  // exists for was thrown from a `useMemo` during the first client render — a check that
  // stopped at `load` would have reported it clean.
  await new Promise((r) => setTimeout(r, settleMs));

  // Read *after* the settle, so a client-side `router.replace` in an effect is included.
  // That is the only way this observes a redirect: the loop is React navigation, not an
  // HTTP 3xx, so it never appears in a response chain.
  let finalPath = null;
  try {
    const res = await cdp.send(
      'Runtime.evaluate',
      { expression: 'location.pathname', returnByValue: true },
      sessionId,
    );
    if (typeof res?.result?.value === 'string') finalPath = res.result.value;
  } catch {
    /* a tab that has already gone is not a finding; the error listener covers real faults */
  }

  await cdp.send('Target.closeTarget', { targetId }).catch(() => {});
  cdp.listeners = cdp.listeners.filter((fn) => fn !== listener);
  return { errors, finalPath };
}

async function main() {
  const reuse = opt('--base');
  const port = Number(opt('--port') ?? (reuse ? 0 : await freePort()));
  const base = reuse ?? `http://127.0.0.1:${port}`;
  const settleMs = Number(opt('--settle') ?? 2500);
  // Fixed, and the collision it used to cause is now *reported* rather than suffered.
  //
  // The history is worth keeping because I got it wrong twice. Originally fixed, with the
  // concurrency limitation written in a comment — and it duly happened: two overlapping runs
  // shared `.next-pagecheck`, one wiped it from under the other, and the second died on a
  // missing `prerender-manifest.json`, which reads like a broken app and is nothing of the
  // kind. That is "a comment is not a mechanism", committed by someone quoting it.
  //
  // The obvious fix — a per-run distDir — is **worse**, and measured so rather than reasoned:
  // Next appends `<distDir>/types/**` to `apps/web/tsconfig.json` when it first sees one, and
  // it writes *during compilation*, so restoring afterwards races. With two agents running
  // this gate at once it corrupted a tracked file, leaving two dead `run-<port>` entries and
  // dropping one run's entry when the other restored. A fix that dirties a tracked file to
  // clean a build directory is not a fix.
  //
  // So: one distDir, already present in the committed tsconfig, so Next never rewrites
  // anything — and a lock, so the second run says what is wrong instead of destroying the
  // first. `--port` gives a caller their own everything when they genuinely need it.
  const distDir = '.next-pagecheck';

  const browser = findBrowser();
  if (!browser) {
    console.error(
      'check-page-errors — no Chromium-family browser found.\n' +
        '  Looked for Chrome and Edge in the usual locations. Set CHROME_PATH to override.\n' +
        '  This gate needs a browser because reading source text is what let a dead app pass.',
    );
    process.exit(2);
  }

  /** @type {import('node:child_process').ChildProcess | null} */
  let server = null;
  let serverLog = '';

  // The lock. A stale one from a killed run must not block forever, so it carries a
  // timestamp and anything older than the server-boot timeout is ignored — a lock that can
  // deadlock the gate is a lock people delete by hand, and then it protects nothing.
  const lockPath = join(WEB, distDir, '.gate-lock');
  const LOCK_STALE_MS = 200_000;
  let holdsLock = false;
  const releaseLock = async () => {
    if (holdsLock) await rm(lockPath, { force: true }).catch(() => {});
    holdsLock = false;
  };

  if (!reuse) {
    let held = null;
    try {
      const raw = await readFile(lockPath, 'utf8');
      const at = Number(JSON.parse(raw).at);
      if (Number.isFinite(at) && Date.now() - at < LOCK_STALE_MS) held = JSON.parse(raw);
    } catch {
      /* no lock, or an unreadable one, which we treat as absent */
    }
    if (held) {
      console.error(
        `check-page-errors — ${join(WEB, distDir)} is in use by pid ${held.pid} (started ` +
          `${Math.round((Date.now() - held.at) / 1000)}s ago).\n` +
          `  Two runs sharing one build directory is how the last one died on a missing\n` +
          `  prerender-manifest — a failure that looks like a broken app and is not. Wait for\n` +
          `  it, or run with --port <n> to get your own server. Refusing rather than racing.`,
      );
      process.exit(2);
    }
  }

  if (!reuse) {
    await rm(join(WEB, distDir), { recursive: true, force: true }).catch(() => {});
    await mkdir(join(WEB, distDir), { recursive: true }).catch(() => {});
    await writeFile(lockPath, JSON.stringify({ pid: process.pid, at: Date.now() }));
    holdsLock = true;
    const nextBin = join(ROOT, 'node_modules', 'next', 'dist', 'bin', 'next');
    server = spawn(process.execPath, [nextBin, 'dev', '--port', String(port), '--hostname', '127.0.0.1'], {
      cwd: WEB,
      env: { ...process.env, NEXT_DIST_DIR: distDir, FORCE_COLOR: '0', NODE_ENV: 'development' },
    });
    server.stdout.on('data', (d) => (serverLog += d.toString()));
    server.stderr.on('data', (d) => (serverLog += d.toString()));
    try {
      await waitFor(
        async () => {
          if (server.exitCode !== null) throw new Error(`dev server exited ${server.exitCode}`);
          try {
            const res = await fetch(base, { signal: AbortSignal.timeout(5000) });
            return res.status < 500;
          } catch {
            return false;
          }
        },
        180_000,
        'the dev server',
      );
    } catch (e) {
      console.error(`check-page-errors — ${e.message}\n`);
      console.error(serverLog.slice(-4000));
      await releaseLock();
      process.exit(2);
    }
  }

  const profile = await mkdtemp(join(tmpdir(), 'agnetos-cdp-'));
  const chrome = spawn(
    browser.path,
    [
      flag('--headed') ? '--headless=false' : '--headless=new',
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      '--disable-extensions',
      '--window-size=1440,900',
      'about:blank',
    ].filter((a) => a !== '--headless=false'),
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );

  // Port 0 makes Chrome choose; it prints the real one on stderr as `DevTools listening on ws://…`.
  // Hardcoding 9222 collides with any browser a developer already has open in debug mode.
  let chromeLog = '';
  const wsUrl = await new Promise((resolveWs, rejectWs) => {
    const timer = setTimeout(() => rejectWs(new Error('Chrome never printed a DevTools endpoint')), 30_000);
    const onData = (d) => {
      chromeLog += d.toString();
      const m = chromeLog.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) {
        clearTimeout(timer);
        resolveWs(m[1]);
      }
    };
    chrome.stderr.on('data', onData);
    chrome.stdout.on('data', onData);
    chrome.on('exit', (code) => {
      clearTimeout(timer);
      rejectWs(new Error(`Chrome exited ${code} before listening\n${chromeLog.slice(-2000)}`));
    });
  }).catch((e) => {
    console.error(`check-page-errors — ${e.message}`);
    return null;
  });

  if (!wsUrl) {
    if (server) server.kill();
    chrome.kill();
    await releaseLock();
    process.exit(2);
  }

  const cdp = await Cdp.connect(wsUrl);
  await cdp.send('Target.setDiscoverTargets', { discover: true });

  let routesChecked = 0;
  let pathsObserved = 0;
  for (const route of ROUTES) {
    const { errors, finalPath } = await visit(cdp, base + route, settleMs);
    routesChecked++;
    for (const e of errors) {
      if (isBackendAbsence(e, base)) backendGaps.push(`${route}\n    ${e}`);
      else fail(`${route}\n    ${e}`);
    }

    // Where did the browser actually end up? A redirect loop is silent to all three
    // detectors above, so this is the only observation in the file that can see one.
    if (finalPath === null) {
      // Not a pass. The instrument failed to read, and a checker that cannot read must
      // not report clean — that is the whole "checkers go blind silently" family.
      fail(
        `${route}\n    could not read location.pathname — this run's redirect check did not run`,
      );
    } else {
      pathsObserved++;
      const count = projectSegmentCount(finalPath);
      if (count > MAX_PROJECT_SEGMENTS) {
        fail(
          `${route}\n    ended at ${finalPath.length} chars carrying ${count} "/p/" segments:` +
            `\n    ${finalPath.slice(0, 120)}${finalPath.length > 120 ? "…" : ""}` +
            `\n    A URL names one project or none. More than one means something prefixed a` +
            `\n    path that was already scoped — see legacyRewriteTarget in` +
            `\n    apps/web/src/components/shell/route.ts.`,
        );
      }
    }
  }

  /* ---- falsification: prove the instrument can go red ---- */
  //
  // "A test that has never been red proves nothing" (comms/BRIEF.md). This is not a
  // decoration: the BRIEF's own 150-line cap passed its first falsification while counting
  // the wrong thing. Under --falsify the gate loads a page that throws and asserts it was
  // caught, so a run can demonstrate its own detector rather than assert it.
  if (flag('--falsify')) {
    const thrower =
      'data:text/html,' +
      encodeURIComponent(
        '<!doctype html><meta charset=utf-8><script>console.error("FALSIFY-CONSOLE");' +
          'setTimeout(function(){throw new Error("FALSIFY-THROW")},10)</script>',
      );
    const caught = (await visit(cdp, thrower, 500)).errors;
    const sawThrow = caught.some((c) => c.includes('FALSIFY-THROW'));
    const sawConsole = caught.some((c) => c.includes('FALSIFY-CONSOLE'));
    console.log(
      `\nFalsification — planted an uncaught throw and a console.error:\n` +
        `  uncaught exception detected: ${sawThrow ? 'YES' : 'NO'}\n` +
        `  console.error detected:      ${sawConsole ? 'YES' : 'NO'}`,
    );
    if (!sawThrow || !sawConsole) {
      fail(
        'the detector did not see a planted error. Every green result from this gate is\n' +
          '    meaningless until this passes — it is reporting clean while blind.',
      );
    }
  }

  cdp.close();
  chrome.kill();
  if (server) server.kill();
  await rm(profile, { recursive: true, force: true }).catch(() => {});
  await releaseLock();

  /* ---- the emptiness guard ---- */
  // Same reasoning as smoke-routes': a gate that observed nothing must not report a pass.
  if (routesChecked === 0) {
    fail('inspected 0 routes. Refusing to pass over an empty observation.');
  }
  // The same guard, aimed at the redirect check specifically. Without it a CDP change
  // that made every `Runtime.evaluate` fail would leave the error detectors green and
  // silently stop checking where the browser landed — the exact shape of every blindness
  // in comms/BRIEF.md. A gate must fail when its own instrument stops reading.
  if (routesChecked > 0 && pathsObserved === 0) {
    fail(`read location.pathname on 0 of ${routesChecked} routes. The redirect check never ran.`);
  }

  // Printed before the verdict, on a pass as well as a fail. An absence that only shows up
  // when something else already failed is an absence nobody reads.
  if (backendGaps.length) {
    console.log(
      `\nBackend absences — reported, not fatal (${backendGaps.length}):\n` +
        `  Our own /api/ answering 5xx. On this stack that is usually correct: there is no\n` +
        `  DATABASE_URL, so the metrics routes 503 rather than inventing a zero. Check\n` +
        `  GET /api/status — if ledger.state is "absent", these are honest.\n`,
    );
    for (const g of backendGaps) console.log(`  ${g}\n`);
  }

  if (findings.length === 0) {
    console.log(
      `Page errors  ${base}  [${browser.label}]\n` +
        `  ${routesChecked} routes loaded in a real browser · ${settleMs}ms settle after load ·\n` +
        `  no uncaught exceptions, no console.error, no browser-level errors` +
        (backendGaps.length ? ` · ${backendGaps.length} backend absence(s) above` : ''),
    );
    // Say what the green covers when the backend was absent throughout.
    //
    // A run against a dead runner produced **66** absences across 12 routes and still printed
    // a pass, which is correct and easy to misread: it proves the client renders *without* a
    // backend, not that it works *with* one. Leaving that inference to the reader is the
    // house defect in the shape this gate is least likely to be forgiven for — a declared
    // pass read as an observed one. The threshold is per-route rather than absolute so it
    // tracks "most pages could not reach it" instead of a number that grows with the route
    // list.
    if (backendGaps.length >= routesChecked) {
      console.log(
        `\n  NOTE — the backend was absent for essentially this whole run ` +
          `(${backendGaps.length} absences across ${routesChecked} routes).\n` +
          `  This pass means the client renders and throws nothing WITHOUT a backend. It is\n` +
          `  not evidence that anything works WITH one, and it cannot see a defect that only\n` +
          `  appears once real data arrives. Start the runner and re-run before citing this\n` +
          `  in a verdict.`,
      );
    }
    process.exit(0);
  }
  console.error(`Page errors — FAIL  ${base}  [${browser.label}]\n`);
  for (const f of findings) console.error(`  ${f}\n`);
  console.error(
    `  ${findings.length} finding(s) across ${routesChecked} routes. These are what a person\n` +
      `  sees in the console when they open the app; HTTP 200 does not contradict them.`,
  );
  process.exit(1);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) await main();
