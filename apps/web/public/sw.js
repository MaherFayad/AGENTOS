/* eslint-disable no-undef */
/**
 * Command Center service worker — spec §3.6.
 *
 * The rule this file exists to enforce: **the app shell caches, the data does not.**
 * `/api/*` is network-only. If the tailnet is gone you get an honest "no tailnet" page,
 * never yesterday's cost ticker with today's date on it.
 *
 * Owner: shell-navigation-engineer. Push payloads are produced by the relay
 * (`sessions-relay-engineer`) — see `PushPayload` in `src/lib/pwa.ts`.
 *
 * Plain JS with no build step, served from /public: a service worker that needs a
 * bundler is a service worker that silently stops matching the app it caches.
 */

const VERSION = 'cc-shell-v1';
const SHELL_CACHE = `${VERSION}-shell`;
const STATIC_CACHE = `${VERSION}-static`;
const OFFLINE_URL = '/offline';

const PRECACHE = [OFFLINE_URL, '/manifest.webmanifest', '/icons/icon-192.png'];

const PUSH_KINDS = ['permission-request', 'run-failure', 'approval-request'];

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

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }
  if (!payload || !PUSH_KINDS.includes(payload.kind)) return;

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag || payload.kind,
      // Permission prompts and approvals block a run: they should survive being ignored.
      requireInteraction: payload.kind !== 'run-failure',
      data: { url: payload.url || '/sessions' },
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/sessions';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
