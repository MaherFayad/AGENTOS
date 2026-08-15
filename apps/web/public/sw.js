/* eslint-disable no-undef */
/**
 * Command Center service worker — spec §3.6.
 *
 * The rule this file exists to enforce: **the app shell caches, the data does not.**
 * `/api/*` is network-only. If the tailnet is gone you get an honest "no tailnet" page,
 * never yesterday's cost ticker with today's date on it.
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

const VERSION = 'cc-shell-v1';
const SHELL_CACHE = `${VERSION}-shell`;
const STATIC_CACHE = `${VERSION}-static`;
const OFFLINE_URL = '/offline';

const PRECACHE = [
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  // The notification badge must be cached: it is needed while the app is closed and the
  // device may well be off the tailnet by then.
  '/icons/badge-72.png',
];

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

  // Build output and icons are content-hashed or stable: cache-first is safe and is what
  // makes the shell open instantly on a phone.
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            return response;
          }),
      ),
    );
  }
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
