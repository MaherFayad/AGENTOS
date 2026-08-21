#!/usr/bin/env node
/**
 * check-map-click — do the MAP's two activation gestures still work in a real browser?
 *
 * Owner: `graph-visualization-engineer` (spec §2.1's interaction budget).
 *
 * ## Why this exists as its own gate
 *
 * On 2026-08-21 a user reported that clicking an agent node on the MAP never opened the
 * drawer. It never had. `MapView.onGrab` called `setPointerCapture` **on the `<svg>`**, and
 * pointer capture retargets the compatibility mouse events, so Chrome dispatched `click` at
 * the nearest common ancestor of the mousedown target (the node) and the mouseup target
 * (the `<svg>`) — the `<svg>`. `Nodes.tsx`'s `onClick` could not fire. Nothing threw,
 * nothing logged, no request failed, and the node was hit-testable the whole time.
 *
 * **Every gate in this repo was green over it**, and they were all correct:
 *   - `tsc`, `vitest`, `next build` — the code is valid and does what it says;
 *   - `smoke-routes` — the route serves 200 with the right HTML;
 *   - `check-page-errors` — the page loads and the browser complains about nothing;
 *   - the jsdom `MapView` tests — they `fireEvent.click` the node directly, and **jsdom does
 *     not implement pointer capture at all**, so they pass against the broken code. A test
 *     that cannot fail on the bug is worse than none, because it gets cited as coverage.
 *
 * The only instrument that can see this is a real browser driven through a real input
 * pipeline. That is this file. It measures **six** things, three of which are controls.
 *
 * ## The controls, and why a probe here is not trusted without them
 *
 * The first version of this probe reported "SWALLOWED" four times, confidently, with no
 * errors — and was wrong: `Input.dispatchMouseEvent` needs the `buttons` bitmask, not just
 * `button`, and without it Chrome accepts the command and dispatches nothing any listener
 * sees. A bug was very nearly filed that the instrument had invented. So:
 *
 *   C1  a nav click must move `location.pathname` — proves the input pipeline works at all
 *   C2  `pointerdown` must land inside `[data-node-id]` — proves the coordinates hit the
 *       node, so a null result means *retargeted*, never *missed*
 *   C3  a synthetic `drawer:open` must reach the probe's own listener — proves "no drawer
 *       event" cannot mean "no listener"
 *
 * **Exit 2 is reserved for the instrument.** If a control fails, this prints what broke and
 * makes no claim about the app. A checker that cannot see must not report clean.
 *
 * ## What it deliberately does not cover
 *
 * Touch and pen (`Input.dispatchTouchEvent` would be a second pass), keyboard activation
 * (jsdom covers that and can fail on it), the drawer's *contents*, anything visual, and any
 * browser that is not Chromium. It asserts `[data-testid="job-drawer"]` appears — that
 * element belongs to `drawer-engineer`; if this gate fails only on that line, the map did
 * its half and the panel is the place to look.
 *
 * Usage:
 *   node scripts/check-map-click.mjs                 boot nothing, expect a dev server
 *   node scripts/check-map-click.mjs --base URL      point at one that is already running
 *   node scripts/check-map-click.mjs --headed        watch it
 *
 * Exit 0 = both gestures work. 1 = at least one is broken. 2 = the instrument is.
 */

import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findBrowser } from './check-page-errors.mjs';

const argv = process.argv.slice(2);
const opt = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const BASE = opt('--base') ?? 'http://127.0.0.1:4321';
const ROUTE = opt('--route') ?? '/p/agentos/map';
const HEADED = argv.includes('--headed');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const findings = [];

/** The instrument failed. Never a verdict about the app. */
function instrument(message) {
  console.error(`\ncheck-map-click — INSTRUMENT BROKEN\n  ${message}\n`);
  console.error('  No verdict about the app was produced. Fix the probe, then re-run.');
  process.exit(2);
}

/** A minimal flat-protocol CDP client. Same shape as `check-page-errors.mjs`'s. */
class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = [];
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(String(ev.data));
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
      }, 30_000);
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

/**
 * Installed fresh after every navigation. Records where the browser *actually* dispatched
 * each event — the retargeting is the whole finding, so the target is what gets logged, not
 * merely whether a handler ran.
 */
const INSTALL = `(() => {
  window.__probe = { events: [], drawer: [], listenerAlive: false };
  const desc = (t) => {
    if (!(t instanceof Element)) return String(t);
    const n = t.closest && t.closest('[data-node-id]');
    return n ? 'node[' + n.getAttribute('data-node-id') + ']' : t.tagName.toLowerCase();
  };
  for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click']) {
    document.addEventListener(type, (e) => {
      window.__probe.events.push(type + ' -> ' + desc(e.target));
    }, true);
  }
  window.addEventListener('drawer:open', (e) => {
    window.__probe.listenerAlive = true;
    window.__probe.drawer.push((e.detail && e.detail.slug) || '(no slug)');
  });
  return true;
})()`;

async function main() {
  const browser = findBrowser();
  if (!browser) instrument('no Chromium-family browser found; set CHROME_PATH');

  try {
    const res = await fetch(BASE + ROUTE, { signal: AbortSignal.timeout(8000) });
    if (res.status >= 500) instrument(`${BASE}${ROUTE} answered ${res.status}`);
  } catch (e) {
    instrument(`no server at ${BASE} (${e.message}). Start one, or pass --base.`);
  }

  const profile = await mkdtemp(join(tmpdir(), 'agnetos-mapclick-'));
  const chrome = spawn(
    browser.path,
    [
      ...(HEADED ? [] : ['--headless=new']),
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      '--disable-extensions',
      '--window-size=1440,900',
      'about:blank',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  let chromeLog = '';
  const wsUrl = await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('Chrome never printed a DevTools endpoint')), 30_000);
    const onData = (d) => {
      chromeLog += d.toString();
      const m = chromeLog.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) {
        clearTimeout(t);
        res(m[1]);
      }
    };
    chrome.stderr.on('data', onData);
    chrome.stdout.on('data', onData);
  }).catch((e) => instrument(e.message));

  const cdp = await Cdp.connect(wsUrl);
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);

  const done = async (code) => {
    cdp.close();
    chrome.kill();
    await rm(profile, { recursive: true, force: true }).catch(() => {});
    process.exit(code);
  };

  const evalIn = async (expression) => {
    const r = await cdp.send(
      'Runtime.evaluate',
      { expression, returnByValue: true, awaitPromise: true },
      sessionId,
    );
    if (r.exceptionDetails) instrument(`the page threw evaluating probe JS: ${r.exceptionDetails.text}`);
    return r.result?.value;
  };

  const goto = async (url) => {
    let loaded = false;
    const l = (m, _p, sid) => {
      if (sid === sessionId && m === 'Page.loadEventFired') loaded = true;
    };
    cdp.on(l);
    await cdp.send('Page.navigate', { url }, sessionId);
    for (let i = 0; i < 300 && !loaded; i++) await sleep(100);
    cdp.listeners = cdp.listeners.filter((f) => f !== l);
    if (!loaded) instrument(`never fired a load event for ${url}`);
    // React render + the graph fetch + §2.1's fit animation all land after `load`.
    await sleep(3000);
    await evalIn(INSTALL);
  };

  const move = (x, y, buttons = 0) =>
    cdp.send(
      'Input.dispatchMouseEvent',
      { type: 'mouseMoved', x, y, button: buttons ? 'left' : 'none', buttons },
      sessionId,
    );
  const down = (x, y) =>
    cdp.send(
      'Input.dispatchMouseEvent',
      { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 },
      sessionId,
    );
  const up = (x, y) =>
    cdp.send(
      'Input.dispatchMouseEvent',
      { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 },
      sessionId,
    );
  const click = async (x, y) => {
    await move(x, y);
    await down(x, y);
    await sleep(60);
    await up(x, y);
    await sleep(500);
  };

  /* ---------------- C1 — the input pipeline works at all ---------------- */

  await goto(BASE + ROUTE);
  const nav = await evalIn(`(() => {
    const els = [...document.querySelectorAll('[role="tab"], a[href], button')];
    const el = els.find((e) => /chart/i.test((e.textContent || '') + ' ' + (e.getAttribute('href') || '')));
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return null;
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, label: (el.textContent || '').trim() };
  })()`);
  if (!nav) instrument('no visible CHART control to use as the positive control');
  const beforeNav = await evalIn('location.pathname');
  await click(nav.x, nav.y);
  await sleep(1200);
  const afterNav = await evalIn('location.pathname');
  if (afterNav === beforeNav) {
    instrument(
      `C1 failed: clicking "${nav.label}" left the path at ${beforeNav}. The synthetic mouse is ` +
        `not reaching the page, so every "did not fire" this run could report would be mine, not the app's.`,
    );
  }
  console.log(`  C1 control  mouse reaches the page — ${beforeNav} -> ${afterNav}`);

  /* ---------------- 1 — a click on a node opens the drawer ---------------- */

  await goto(BASE + ROUTE);
  await evalIn(`window.dispatchEvent(new CustomEvent('drawer:open', { detail: { slug: '__control__', seq: -1 } })), true`);
  if (!(await evalIn('window.__probe.listenerAlive === true'))) {
    instrument('C3 failed: a synthetic drawer:open never reached the probe listener');
  }
  await evalIn('window.__probe.drawer.length = 0');
  console.log('  C3 control  the drawer:open listener is reachable');

  const node = await evalIn(`(() => {
    const all = [...document.querySelectorAll('[data-node-id]')];
    if (all.length === 0) return { error: 'no [data-node-id] rendered — is /graph.json served?' };
    for (const g of all) {
      const id = g.getAttribute('data-node-id');
      if (id.endsWith('/_anchor')) continue;
      const r = g.getBoundingClientRect();
      const cx = r.x + r.width / 2;
      const cy = r.y + r.height / 2;
      if (cx < 60 || cy < 60 || cx > innerWidth - 60 || cy > innerHeight - 120) continue;
      if (r.width < 14) continue;
      const hit = document.elementFromPoint(cx, cy);
      const owner = hit && hit.closest && hit.closest('[data-node-id]');
      if (!owner || owner.getAttribute('data-node-id') !== id) continue;
      return { id, x: cx, y: cy, hit: hit.tagName.toLowerCase() };
    }
    return { error: 'no job node landed somewhere clickable among ' + all.length + ' rendered' };
  })()`);
  if (!node || node.error) instrument(node?.error ?? 'could not choose a node');
  console.log(`  target      ${node.id} at (${node.x.toFixed(0)}, ${node.y.toFixed(0)}), over <${node.hit}>`);

  await click(node.x, node.y);
  // Poll rather than sleep a guess. On the MAP the side panel is **route-driven** — the
  // click pushes `/map/:dept/:agent` and that route renders the drawer — so this waits on a
  // Next navigation, and in dev that route may be compiled on demand the first time.
  for (let i = 0; i < 60; i++) {
    if (await evalIn(`!!document.querySelector('[data-testid="job-drawer"]')`)) break;
    await sleep(250);
  }
  const clicked = await evalIn(`({
    events: window.__probe.events.slice(),
    drawer: window.__probe.drawer.slice(),
    path: location.pathname,
    panel: !!document.querySelector('[data-testid="job-drawer"]'),
  })`);

  if (!clicked.events.some((e) => e.startsWith('pointerdown -> node['))) {
    instrument(
      `C2 failed: pointerdown did not land inside [data-node-id]. Saw ${JSON.stringify(clicked.events)}. ` +
        `A null result here would mean the probe missed, not that the app swallowed.`,
    );
  }
  console.log('  C2 control  pointerdown landed on the node');
  for (const e of clicked.events) console.log(`              ${e}`);

  if (clicked.drawer.length === 0) {
    findings.push(
      `clicking node ${node.id} did not emit drawer:open.\n` +
        `      the browser dispatched: ${clicked.events.join(' | ')}\n` +
        `      a 'click -> svg' there is pointer capture on an ancestor retargeting it (§2.1, REQ-MAP-41).`,
    );
  } else if (!clicked.panel) {
    findings.push(
      `drawer:open fired for ${clicked.drawer[0]} but [data-testid="job-drawer"] never appeared.\n` +
        `      the map did its half — this one is the drawer's (drawer-engineer).`,
    );
  } else {
    console.log(`  PASS        click -> drawer:open ${JSON.stringify(clicked.drawer)}, panel mounted`);
  }
  if (!clicked.path.includes(node.id.split('/')[0])) {
    findings.push(`clicking ${node.id} left the path at ${clicked.path}; §2.2 expects the drill-in URL.`);
  }

  /* ---------------- 2 — a drag moves the node and opens nothing ---------------- */

  await goto(BASE + ROUTE);
  const again = await evalIn(`(() => {
    const g = document.querySelector('[data-node-id="${node.id}"]');
    if (!g) return null;
    const r = g.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`);
  if (!again) instrument(`node ${node.id} vanished before the drag half`);

  await move(again.x, again.y);
  await down(again.x, again.y);
  for (let i = 1; i <= 12; i++) {
    await move(again.x + i * 8, again.y + i * 4, 1);
    await sleep(16);
  }
  // Read *before* the release: §1.6 springs the node home, so a reading after the release
  // cannot tell a working drag from a drag that never moved anything.
  const midDrag = await evalIn(`(() => {
    const r = document.querySelector('[data-node-id="${node.id}"]').getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`);
  await up(again.x + 96, again.y + 48);
  await sleep(900);
  const dragged = await evalIn('({ drawer: window.__probe.drawer.slice(), path: location.pathname })');

  const moved = Math.hypot(midDrag.x - again.x, midDrag.y - again.y);
  if (moved < 10) {
    findings.push(
      `dragging ${node.id} moved it ${moved.toFixed(1)}px on screen — the springy node drag ` +
        `(§2.1) is broken, which is the other half of this fix.`,
    );
  } else {
    console.log(`  PASS        drag moved the node ${moved.toFixed(0)}px`);
  }
  if (dragged.drawer.length > 0) {
    findings.push(
      `releasing a drag opened the drawer (${dragged.drawer.join(', ')}). Drag and click must not ` +
        `collapse into one gesture — that is what the ${'DRAG_SLOP_PX'} threshold is for.`,
    );
  } else {
    console.log('  PASS        drag released without opening the drawer');
  }

  /* ---------------- 3 — a department label still activates ---------------- */

  await goto(BASE + ROUTE);
  const label = await evalIn(`(() => {
    const gs = [...document.querySelectorAll('svg [role="button"]')].filter((g) => !g.hasAttribute('data-node-id'));
    for (const g of gs) {
      const r = g.getBoundingClientRect();
      const cx = r.x + r.width / 2;
      const cy = r.y + r.height / 2;
      if (cx < 40 || cy < 40 || cx > innerWidth - 40 || cy > innerHeight - 100) continue;
      const hit = document.elementFromPoint(cx, cy);
      const self = !!(hit && hit.closest && hit.closest('[role="button"]') === g);
      return { aria: g.getAttribute('aria-label'), x: cx, y: cy, self, hit: hit ? hit.tagName.toLowerCase() : null };
    }
    return null;
  })()`);
  if (!label) instrument('no department label was on screen to click');
  if (!label.self) {
    findings.push(
      `the "${label.aria}" label has no hit area: elementFromPoint at its centre returned <${label.hit}>.\n` +
        `      a <g> has no geometry of its own, so role="button" + onClick with pointer-events:none\n` +
        `      children is a button nothing can land on (§2.1 "click a department label").`,
    );
  } else {
    const beforeLabel = await evalIn('location.pathname');
    await click(label.x, label.y);
    await sleep(1500);
    const afterLabel = await evalIn('location.pathname');
    if (afterLabel === beforeLabel) {
      findings.push(`clicking "${label.aria}" left the path at ${beforeLabel}; §2.1 says it enters the department.`);
    } else {
      console.log(`  PASS        label click ${beforeLabel} -> ${afterLabel}`);
    }
  }

  /* ---------------- report ---------------- */

  console.log('');
  if (findings.length > 0) {
    console.error(`check-map-click — ${findings.length} finding(s):\n`);
    for (const f of findings) console.error(`  - ${f}`);
    console.error('');
    await done(1);
  }
  console.log('check-map-click — the MAP\'s activation gestures work in a real browser.');
  await done(0);
}

main().catch((e) => instrument(e.stack ?? String(e)));
