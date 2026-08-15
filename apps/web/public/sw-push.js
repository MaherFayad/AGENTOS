/* =============================================================================
 * sw-push.js — push handlers for the Command Center service worker (spec §3.6)
 *
 * OWNERSHIP: `shell-navigation-engineer` owns `public/sw.js` and the manifest.
 * This file is owned by `sessions-relay-engineer` and is pulled in with one
 * line from theirs:
 *
 *     importScripts('/sw-push.js');
 *
 * so the PWA shell and the push feature never edit the same file.
 *
 * THE RULE THIS FILE EXISTS TO KEEP: our server only ever holds ciphertext
 * (ADR-005), so a push payload carries no content — `{k, id, at}` and an
 * optional sealed box. Fixed copy is rendered by default. If, and only if, the
 * user has opted into detailed notifications, the sealed box is decrypted HERE,
 * in the browser, with the key from IndexedDB. The push service and our relay
 * see ciphertext either way.
 *
 * The copy strings below are duplicated from
 * `src/sessions/push/payload.ts` (NOTIFICATION_COPY) because a service worker
 * cannot import app modules. `sw-push-copy.test.mjs` reads both files and fails
 * if they drift, so the duplication cannot rot quietly.
 * ========================================================================== */

/* eslint-env serviceworker */
/* global self, clients, indexedDB, crypto, atob, TextDecoder */

const NOTIFICATION_COPY = {
  permission: {
    title: 'A session needs your permission',
    body: 'Open Command Center to allow or deny.',
  },
  'run-failed': {
    title: 'A run failed',
    body: 'Open Command Center to see what happened.',
  },
  approval: {
    title: 'An approval is waiting',
    body: 'A run is paused at its plan step.',
  },
};

const PUSH_KINDS = ['permission', 'run-failed', 'approval'];

/** Mirrors `deepLinkFor()` in push/payload.ts. A tap lands on the exact thing. */
function deepLinkFor(kind, id) {
  const safe = encodeURIComponent(id);
  if (kind === 'permission') return `/sessions/${safe}`;
  if (kind === 'approval') return `/approvals/${safe}`;
  return `/runs/${safe}`;
}

/* ------------------------------------------------------- local decryption */

const DB = 'agnetos-e2e';
const STORE = 'keys';

function idbGet(key) {
  return new Promise((resolve) => {
    let req;
    try {
      req = indexedDB.open(DB, 1);
    } catch {
      resolve(null);
      return;
    }
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onerror = () => resolve(null);
    req.onsuccess = () => {
      try {
        const get = req.result.transaction(STORE, 'readonly').objectStore(STORE).get(key);
        get.onsuccess = () => resolve(get.result ?? null);
        get.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    };
  });
}

const unb64 = (s) => {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

/**
 * Open a sealed box locally. Mirrors `open()` in lib/e2e.ts.
 *
 * Every failure path returns null rather than throwing: a notification that
 * cannot be enriched must still fire with the fixed copy. Silently dropping a
 * permission prompt because a decrypt failed would be the worst bug this
 * feature could have.
 */
async function openSealed(encoded) {
  try {
    const key = await idbGet('session-key');
    if (!key) return null;
    const box = JSON.parse(new TextDecoder().decode(unb64(encoded)));
    if (box.v !== 1 || box.alg !== 'AES-GCM') return null;
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: unb64(box.iv) },
      key,
      unb64(box.ct),
    );
    return JSON.parse(new TextDecoder().decode(plain));
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ events */

self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      let payload = null;
      try {
        payload = event.data ? event.data.json() : null;
      } catch {
        payload = null;
      }
      if (!payload || !PUSH_KINDS.includes(payload.k) || !payload.id) return;

      const copy = NOTIFICATION_COPY[payload.k];
      let title = copy.title;
      let body = copy.body;

      // Opt-in only. `detail` defaults to 'minimal' and lives in IndexedDB so
      // this worker can read it while the app is closed.
      const detail = await idbGet('notification-detail');
      if (detail === 'full' && payload.c) {
        const revealed = await openSealed(payload.c);
        if (revealed) {
          title = revealed.title || title;
          body = revealed.body || body;
        }
      }

      await self.registration.showNotification(title, {
        body,
        // The shell owns the icon set; these are its published paths.
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-72.png',
        tag: `${payload.k}:${payload.id}`,
        renotify: true,
        // A permission prompt is blocking a session and costing money, so it
        // stays on screen until touched. The other two are informational.
        requireInteraction: payload.k === 'permission',
        timestamp: payload.at || Date.now(),
        data: { url: deepLinkFor(payload.k, payload.id), k: payload.k, id: payload.id },
      });
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/sessions';

  event.waitUntil(
    (async () => {
      const windows = await clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      // Prefer an open window: on a phone, launching a second copy of an
      // installed PWA loses the user's place in whatever they were reading.
      for (const client of windows) {
        if ('focus' in client) {
          await client.focus();
          client.postMessage({ type: 'agnetos:navigate', url });
          return;
        }
      }
      if (clients.openWindow) await clients.openWindow(url);
    })(),
  );
});
