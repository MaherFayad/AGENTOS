/* eslint-disable no-undef */
/**
 * Command Center service worker — spec §3.6.
 *
 * What this file actually does, stated so the next reviewer does not have to read it to
 * find out (the retired headline promised a precached app shell while `PRECACHE` held no
 * app route at all — a header that is not the file is a header that gets granted, and the
 * gate in scripts/__tests__/shell-pwa.test.mjs now refuses that exact sentence):
 *
 *  - **No route HTML is ever cached.** Navigations are network-only; the only fallback is
 *    the precached `/offline` page, shown when the fetch fails outright.
 *  - **`/api/*` and `/ws/*` are never cached and never replayed.** If the tailnet is gone
 *    you get the honest "no tailnet" page, not yesterday's cost ticker under today's date.
 *  - **Precached at install:** `/offline`, the manifest, and two icons. That is the whole
 *    list. The badge is on it because it is needed while the app is closed, when the
 *    device may well be off the tailnet.
 *  - **Cached on demand:** only build output whose URL is *content-addressed*, plus
 *    `/icons/`. See `isImmutableAsset` — the assumption is now a predicate, not a comment.
 *
 * Owner: shell-navigation-engineer — caching, offline fallback, versioning.
 * **Push lives in `/sw-push.js`, owned by `sessions-relay-engineer`** (§3.1 E2E: the
 * payload is opened client-side, and none of that is the shell's business). It is pulled
 * in below with one line, so the two features never edit the same file and never register
 * two `push` listeners for one message.
 *
 * Plain JS with no build step, served from /public: a service worker that needs a
 * bundler is a service worker that silently stops matching the app it caches.
 */

/**
 * Guarded: if the push module is missing or throws while parsing, the shell's caching and
 * offline page must still install. A PWA that fails to install because notifications are
 * broken is a worse outcome than a PWA without notifications.
 */
try {
  importScripts('/sw-push.js');
} catch (error) {
  // Nothing to report to — no client is listening at install time.
}

/**
 * **Bumping this is the rescue lever.** `activate` deletes every cache key that does not
 * start with `VERSION`, then claims open clients — so a bump makes an already-poisoned
 * browser heal itself on the next load, without anyone opening DevTools.
 *
 * v1 -> v2 on 2026-08-21 for exactly that: v1 pinned non-hashed `next dev` chunks
 * cache-first and served them forever. Every `cc-shell-v1-*` cache is now purged on sight.
 */
const VERSION = 'cc-shell-v2';
const SHELL_CACHE = `${VERSION}-shell`;
const STATIC_CACHE = `${VERSION}-static`;
const OFFLINE_URL = '/offline';

/**
 * Cap on `STATIC_CACHE` entries. `VERSION` is a hardcoded constant that no deploy changes,
 * so without a cap this cache accumulates every chunk of every build for the life of the
 * installation. Every entry is content-addressed and therefore disposable: evicting the
 * oldest costs one re-fetch and nothing else.
 */
const STATIC_MAX_ENTRIES = 200;

const PRECACHE = [
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  // The notification badge must be cached: it is needed while the app is closed and the
  // device may well be off the tailnet by then.
  '/icons/badge-72.png',
];

/**
 * Is this URL safe to serve cache-first *forever*?
 *
 * Only when the URL is content-addressed: a different build produces a different URL, so
 * a hit can never be stale. Two shapes qualify, both produced by Next's production build:
 *
 *   1. a content hash in the filename — `…/layout-8f2a1b3c4d5e6f70.js`, `…/css/<hash>.css`
 *   2. a build-id directory — `/_next/static/<buildId>/_buildManifest.js`
 *
 * **Everything else under `/_next/static/` is network-only**, which is the whole point.
 * `next dev` serves stable, non-hashed paths (`/_next/static/chunks/app/layout.js`) whose
 * *content changes on every rebuild*. v1 cache-first'd those, so a developer's browser
 * pinned one build's JavaScript against every later render of the HTML — React threw a
 * hydration error on every route, and a hard reload did not clear it, because a hard
 * reload bypasses the HTTP cache and the service worker answers before it.
 *
 * That was a comment ("build output is content-hashed or stable: cache-first is safe")
 * asserting something no code checked, in a file that had no way to know it was in dev.
 * It is a predicate now, so the claim is enforced rather than believed.
 */
function isImmutableAsset(pathname) {
  if (pathname.startsWith('/icons/')) return true;
  if (!pathname.startsWith('/_next/static/')) return false;
  // 2. build-id directory. `development` is Next's dev build id and is explicitly not one.
  if (/^\/_next\/static\/(?!chunks\/|css\/|media\/|development\/)[^/]+\//.test(pathname)) return true;
  // 1. content hash in the filename: >= 8 hex characters immediately before the extension.
  return /(?:^|[-/.])[0-9a-f]{8,}\.[a-z0-9]+$/i.test(pathname);
}

/** Keep `STATIC_CACHE` bounded. `cache.keys()` is insertion-ordered, so this is FIFO. */
async function trimStatic(cache) {
  const keys = await cache.keys();
  const excess = keys.length - STATIC_MAX_ENTRIES;
  for (let i = 0; i < excess; i += 1) await cache.delete(keys[i]);
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Data is never cached, never replayed. See the file header.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL).then((cached) => cached ?? Response.error()),
      ),
    );
    return;
  }

  // Cache-first, but only for URLs a rebuild cannot reuse. Anything else — including every
  // `next dev` chunk — is left to the browser: no respondWith, no cache read, no cache write.
  if (!isImmutableAsset(url.pathname)) return;

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ??
        fetch(request).then((response) => {
          const copy = response.clone();
          caches
            .open(STATIC_CACHE)
            .then((cache) => cache.put(request, copy).then(() => trimStatic(cache)))
            .catch(() => undefined);
          return response;
        }),
    ),
  );
});

/**
 * `push` and `notificationclick` are deliberately absent from this file. They live in
 * `/sw-push.js` (imported at the top), because §3.1's payloads are end-to-end encrypted
 * and are opened with a key this file must never see. Adding a handler here would fire a
 * second notification for every message.
 */

/** Lets the page tell a waiting worker to take over, instead of asking a person to. */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'agnetos:skip-waiting') self.skipWaiting();
});
