/**
 * PWA assets the coverage checker cannot see into — the files exist, parse, and keep the
 * §3.6 rules that live in plain JS (no bundler, no vitest).
 *
 * **These tests execute `sw.js`, they do not grep it.** The distinction earned itself on
 * 2026-08-21: the previous version of this file asserted the presence of substrings
 * (`/api/`, `/ws/`, the activate filter) and every one of them was still present, and
 * still green, while the worker pinned `next dev` chunks forever and made the app throw a
 * hydration error on every route. A substring is a claim you did not narrow. So the worker
 * is loaded into a fake `ServiceWorkerGlobalScope` here and its handlers are *dispatched*.
 *
 * What this still cannot see, stated so nobody mistakes it for coverage: this is a fake
 * `caches`, a fake `fetch` and a fake event. It proves the routing logic; it proves nothing
 * about how Chrome actually behaves. `scripts/check-sw-poisoning.mjs` is the half that
 * poisons a real browser and watches it recover — run that before believing this.
 *
 * Run: node --test scripts/__tests__/shell-pwa.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access, stat } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PUBLIC = join(ROOT, 'apps', 'web', 'public');
const ORIGIN = 'https://cc.example.ts.net';

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ *
 * A fake ServiceWorkerGlobalScope, just big enough to run sw.js
 * ------------------------------------------------------------------ */

class FakeCache {
  constructor() {
    this.entries = new Map();
  }
  async put(request, response) {
    this.entries.set(typeof request === 'string' ? request : request.url, response);
  }
  async match(request) {
    return this.entries.get(typeof request === 'string' ? request : request.url);
  }
  async addAll(urls) {
    for (const u of urls) this.entries.set(u, { body: `precached:${u}` });
  }
  async keys() {
    return [...this.entries.keys()];
  }
  async delete(key) {
    return this.entries.delete(typeof key === 'string' ? key : key.url);
  }
}

class FakeCacheStorage {
  constructor(seed = []) {
    this.store = new Map(seed.map((name) => [name, new FakeCache()]));
  }
  async open(name) {
    if (!this.store.has(name)) this.store.set(name, new FakeCache());
    return this.store.get(name);
  }
  async keys() {
    return [...this.store.keys()];
  }
  async delete(name) {
    return this.store.delete(name);
  }
  async match(request) {
    for (const cache of this.store.values()) {
      const hit = await cache.match(request);
      if (hit) return hit;
    }
    return undefined;
  }
}

/**
 * Load `sw.js` into a fake global and hand back its handlers plus the internals worth
 * asserting on. `new Function` rather than `import`: the file is a classic worker script,
 * not a module, and rewriting it into a module so a test can import it would mean testing
 * a file the browser never runs.
 */
async function loadWorker({ seedCaches = [], fetchImpl } = {}) {
  const source = await readFile(join(PUBLIC, 'sw.js'), 'utf8');
  const handlers = new Map();
  const claimed = { count: 0 };
  const skipped = { count: 0 };
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type, fn) => handlers.set(type, fn),
    skipWaiting: () => {
      skipped.count += 1;
    },
    clients: {
      claim: async () => {
        claimed.count += 1;
      },
    },
  };
  const caches = new FakeCacheStorage(seedCaches);
  const fetchStub =
    fetchImpl ??
    (async (request) => ({
      from: 'network',
      url: typeof request === 'string' ? request : request.url,
      clone() {
        return { ...this, clone: this.clone };
      },
    }));

  const factory = new Function(
    'self',
    'caches',
    'fetch',
    'importScripts',
    'URL',
    'Response',
    `${source}\n;return { VERSION, SHELL_CACHE, STATIC_CACHE, PRECACHE, STATIC_MAX_ENTRIES, isImmutableAsset, trimStatic };`,
  );
  const internals = factory(
    self,
    caches,
    fetchStub,
    () => {
      throw new Error('no push module in this harness');
    },
    URL,
    class {
      static error() {
        return { from: 'Response.error' };
      }
    },
  );
  return { internals, handlers, caches, claimed, skipped };
}

/** Dispatch a fetch event and return what the worker chose to answer with, or `null`. */
async function dispatchFetch(handlers, { url, mode = 'cors', method = 'GET' }) {
  let responded = null;
  const event = {
    request: { url: `${ORIGIN}${url}`, mode, method },
    respondWith: (p) => {
      responded = p;
    },
    waitUntil: (p) => p,
  };
  await handlers.get('fetch')(event);
  return responded === null ? null : await responded;
}

async function dispatchLifecycle(handlers, type) {
  const waits = [];
  await handlers.get(type)({ waitUntil: (p) => waits.push(p) });
  await Promise.all(waits);
}

/* ------------------------------------------------------------------ *
 * Static assets
 * ------------------------------------------------------------------ */

test('manifest is valid JSON with standalone display and a dark theme', async () => {
  const raw = await readFile(join(PUBLIC, 'manifest.webmanifest'), 'utf8');
  const manifest = JSON.parse(raw);
  assert.equal(manifest.name, 'Command Center');
  assert.equal(manifest.short_name, 'Command');
  assert.equal(manifest.start_url, '/map');
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.theme_color, '#111114');
  assert.equal(manifest.background_color, '#111114');
  const sizes = new Set(manifest.icons.map((i) => `${i.sizes}:${i.purpose}`));
  assert.ok(sizes.has('192x192:any'));
  assert.ok(sizes.has('512x512:any'));
  assert.ok(sizes.has('512x512:maskable'));
});

test('placeholder icons and the notification badge exist as non-empty PNGs', async () => {
  for (const name of ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'badge-72.png']) {
    const path = join(PUBLIC, 'icons', name);
    assert.ok(await exists(path), `${name} is missing`);
    const bytes = await readFile(path);
    assert.ok(bytes.length > 32, `${name} is too small to be a PNG`);
    assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.ok((await stat(path)).size > 0);
  }
});

test('sw-push.js (sessions-owned) still lives at the import path and names the three kinds', async () => {
  const push = await readFile(join(PUBLIC, 'sw-push.js'), 'utf8');
  assert.match(push, /permission/);
  assert.match(push, /run-failed/);
  assert.match(push, /approval/);
  assert.match(push, /addEventListener\(\s*['"]push['"]/);
});

/* ------------------------------------------------------------------ *
 * The worker, executed
 * ------------------------------------------------------------------ */

test('sw.js registers no push handler of its own and imports the sessions module', async () => {
  const source = await readFile(join(PUBLIC, 'sw.js'), 'utf8');
  assert.match(source, /importScripts\('\/sw-push\.js'\)/);
  // Still a source assertion, and correctly so: the claim is about a listener that must
  // *not* exist, and a listener that does not exist cannot be dispatched to.
  assert.doesNotMatch(source, /addEventListener\(\s*['"]push['"]/);
  assert.doesNotMatch(source, /addEventListener\(\s*['"]notificationclick['"]/);
  const { handlers } = await loadWorker();
  assert.deepEqual([...handlers.keys()].sort(), ['activate', 'fetch', 'install', 'message']);
});

test('a `next dev` chunk is never answered from the cache — the whole bug, as a unit test', async () => {
  const { internals, handlers, caches } = await loadWorker();
  // Seed the cache exactly as a poisoned browser's is seeded.
  const poisoned = await caches.open(internals.STATIC_CACHE);
  await poisoned.put(`${ORIGIN}/_next/static/chunks/app/layout.js`, { from: 'STALE-CACHE' });

  assert.equal(internals.isImmutableAsset('/_next/static/chunks/app/layout.js'), false);
  const answered = await dispatchFetch(handlers, { url: '/_next/static/chunks/app/layout.js' });
  assert.equal(
    answered,
    null,
    'the worker called respondWith for a non-hashed dev chunk; it must leave that request ' +
      'to the browser entirely, or it pins one build of the app forever',
  );
});

test('a content-hashed chunk is still cache-first, so the PWA still opens instantly', async () => {
  const hashed = '/_next/static/chunks/app/layout-8f2a1b3c4d5e6f70.js';
  const { internals, handlers, caches } = await loadWorker();
  assert.equal(internals.isImmutableAsset(hashed), true);

  const first = await dispatchFetch(handlers, { url: hashed });
  assert.equal(first.from, 'network', 'a cold cache must go to the network');

  const cache = await caches.open(internals.STATIC_CACHE);
  await cache.put(`${ORIGIN}${hashed}`, { from: 'warm-cache' });
  const second = await dispatchFetch(handlers, { url: hashed });
  assert.equal(second.from, 'warm-cache', 'a hashed URL is immutable and must be served from cache');
});

test('isImmutableAsset classifies the shapes Next actually emits', async () => {
  const { internals } = await loadWorker();
  const immutable = [
    '/_next/static/chunks/app/layout-8f2a1b3c4d5e6f70.js',
    '/_next/static/css/a1b2c3d4e5f60718.css',
    '/_next/static/media/instrument-serif-4f3e2d1c0b9a8776.woff2',
    '/_next/static/oCkS4L8ZQ1sHtRPBUM5rk/_buildManifest.js', // build-id directory
    '/icons/icon-512.png',
  ];
  const mutable = [
    '/_next/static/chunks/app/layout.js',
    '/_next/static/chunks/main-app.js',
    '/_next/static/chunks/webpack.js',
    '/_next/static/css/app/layout.css',
    '/_next/static/development/_buildManifest.js', // dev's build id is the literal word
    '/some/other/path.js',
  ];
  for (const p of immutable) assert.equal(internals.isImmutableAsset(p), true, `${p} should be immutable`);
  for (const p of mutable) assert.equal(internals.isImmutableAsset(p), false, `${p} should be mutable`);
});

test('/api and /ws are never answered, cached or replayed (rule 9: no stale numbers)', async () => {
  const { handlers } = await loadWorker();
  for (const url of ['/api/status', '/api/cost/today', '/ws/sessions/abc']) {
    assert.equal(await dispatchFetch(handlers, { url }), null, `${url} must reach the network`);
  }
});

test('a navigation is network-only, with /offline as the only fallback', async () => {
  const offline = { from: 'precached-offline' };
  const { handlers, caches } = await loadWorker({
    fetchImpl: async () => {
      throw new Error('no tailnet');
    },
  });
  const shell = await caches.open('cc-shell-preseeded');
  await shell.put('/offline', offline);
  const answered = await dispatchFetch(handlers, { url: '/p/agentos/map', mode: 'navigate' });
  assert.equal(answered, offline, 'a failed navigation must land on /offline, never on cached HTML');
});

test('activate purges every cache from a previous VERSION, then claims open clients', async () => {
  // This is the self-heal chain a VERSION bump depends on. Asserting the filter expression
  // exists is not the same as watching it delete something.
  const { internals, handlers, caches, claimed, skipped } = await loadWorker({
    seedCaches: ['cc-shell-v1-shell', 'cc-shell-v1-static', 'someone-elses-cache'],
  });
  await dispatchLifecycle(handlers, 'install');
  assert.equal(skipped.count, 1, 'install must call skipWaiting or the new worker waits for a tab close');

  await dispatchLifecycle(handlers, 'activate');
  const surviving = await caches.keys();
  assert.deepEqual(
    surviving.filter((k) => !k.startsWith(internals.VERSION)),
    [],
    `caches from another VERSION survived activation: ${surviving.join(', ')}`,
  );
  assert.equal(claimed.count, 1, 'activate must claim clients, or the fix waits for a tab close');
});

test('VERSION has moved past the release that shipped the cache-first bug', async () => {
  const { internals } = await loadWorker();
  assert.notEqual(
    internals.VERSION,
    'cc-shell-v1',
    'v1 is the version that pinned dev chunks. Leaving VERSION there means every already- ' +
      'poisoned browser keeps its caches, because activate only deletes keys that do not match.',
  );
  assert.match(internals.VERSION, /^cc-shell-v\d+$/);
});

test('the static cache is bounded — VERSION is a constant no deploy changes', async () => {
  const { internals, caches } = await loadWorker();
  const cache = await caches.open(internals.STATIC_CACHE);
  for (let i = 0; i < internals.STATIC_MAX_ENTRIES + 25; i += 1) {
    await cache.put(`${ORIGIN}/_next/static/chunks/${i}-0123456789abcdef.js`, { i });
  }
  await internals.trimStatic(cache);
  const keys = await cache.keys();
  assert.equal(keys.length, internals.STATIC_MAX_ENTRIES);
  assert.match(keys[0], /\/25-/, 'the oldest entries are the ones evicted');
});

test('the file header describes the file: PRECACHE holds no app route', async () => {
  // The header used to open "the app shell caches, the data does not" while `PRECACHE`
  // contained no app route at all. A headline sentence that is not what the file does gets
  // granted by the next reviewer who reads only the header, so it is now a gate.
  const { internals } = await loadWorker();
  const source = await readFile(join(PUBLIC, 'sw.js'), 'utf8');
  // The *doc* block, not the eslint pragma on line 1 — the first `*/` in the file closes
  // `/* eslint-disable no-undef */`, and slicing to it reads a header that is nine characters
  // long and matches nothing. An instrument pointed at the wrong nine characters is the
  // house defect in miniature; it failed on its first run, which is the only reason it is right.
  const docStart = source.indexOf('/**');
  const header = source.slice(docStart, source.indexOf('*/', docStart));

  const appRoutes = internals.PRECACHE.filter(
    (u) => !u.startsWith('/icons/') && u !== '/offline' && u !== '/manifest.webmanifest',
  );
  assert.deepEqual(appRoutes, [], 'PRECACHE grew an app route — the header must be rewritten with it');
  assert.match(
    header,
    /No route HTML is ever cached/,
    'the header must say that navigations are network-only, because that is what the code does',
  );
  assert.doesNotMatch(
    header,
    /the app shell caches/,
    'that sentence promises a precached shell this file does not implement',
  );
});
