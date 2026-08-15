/* =============================================================================
 * lib/push.ts — the Web Push subscription flow (spec §3.6)
 *
 * "Push notifications via the Happy relay (permission prompts, run failures,
 *  approval requests)." §3.6 also says why this exists at all: the phone is
 * where you approve things.
 *
 * Ownership note: `shell-navigation-engineer` owns the manifest and `sw.js`.
 * The push handlers live in `public/sw-push.js` and are pulled in by their
 * worker with one line:
 *
 *     importScripts('/sw-push.js');
 *
 * so neither of us edits the other's file.
 *
 * Nothing in this module ever sees a decryption key. The notification detail
 * preference below is a *preference*, not a secret, which is why it is allowed
 * to live in localStorage while the key is not (see `lib/e2e.ts`).
 * ========================================================================== */

import type { NotificationDetail } from '@/sessions/push/payload';

const DETAIL_KEY = 'agnetos.notificationDetail';

/** Feature detection, not user-agent sniffing. iOS only gained this in 16.4. */
export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** `default` means we have never asked. `denied` means never ask again. */
export function pushPermission(): NotificationPermission | 'unsupported' {
  return pushSupported() ? Notification.permission : 'unsupported';
}

/**
 * How much an OS notification may reveal. Defaults to `minimal` — fixed copy,
 * no content — because the first time a notification lands the user has not
 * made a choice yet, and a lock screen is a public surface (§3.6).
 */
export function notificationDetail(): NotificationDetail {
  if (typeof localStorage === 'undefined') return 'minimal';
  return localStorage.getItem(DETAIL_KEY) === 'full' ? 'full' : 'minimal';
}

/**
 * Written twice on purpose:
 *   localStorage — a synchronous read for the settings toggle;
 *   IndexedDB    — the service worker's only readable store while the app is
 *                  closed, which is exactly when a push arrives.
 *
 * It is a preference, not a secret. The key it gates access to is in the same
 * IndexedDB but is non-extractable and cannot be read out (`lib/e2e.ts`).
 */
export function setNotificationDetail(detail: NotificationDetail): void {
  if (typeof localStorage !== 'undefined') localStorage.setItem(DETAIL_KEY, detail);
  if (typeof indexedDB === 'undefined') return;

  const req = indexedDB.open('agnetos-e2e', 1);
  req.onupgradeneeded = () => req.result.createObjectStore('keys');
  req.onsuccess = () => {
    try {
      req.result.transaction('keys', 'readwrite').objectStore('keys').put(detail, 'notification-detail');
    } catch {
      /* the SW falls back to `minimal`, which is the safe direction */
    }
  };
}

const urlBase64ToUint8Array = (base64: string): Uint8Array => {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const raw = atob(padded);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
};

export interface SubscribeResult {
  ok: boolean;
  /** Written for a human on a phone, shown verbatim (API contract, Errors). */
  hint?: string;
}

/**
 * Ask for permission, subscribe, and register the subscription with our relay.
 *
 * Called from a tap, never on mount. A permission prompt that appears before
 * the user has done anything is the single fastest way to get `denied`
 * permanently — and `denied` cannot be recovered from inside the page.
 */
export async function enablePush(
  vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
): Promise<SubscribeResult> {
  if (!pushSupported()) {
    return {
      ok: false,
      hint: 'This browser can’t do push. Install the app to your home screen and try again.',
    };
  }
  if (!vapidPublicKey) {
    return {
      ok: false,
      hint: 'Push isn’t configured on the server yet (no VAPID key).',
    };
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return {
      ok: false,
      hint:
        permission === 'denied'
          ? 'Notifications are blocked for this app in your OS settings.'
          : 'Notifications weren’t enabled.',
    };
  }

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      // Required by every browser: a push that shows no notification is not
      // allowed, which suits us — all three of our types are user-facing.
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
    }));

  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(subscription.toJSON()),
  });

  if (!res.ok) {
    return { ok: false, hint: 'Couldn’t register for notifications. Try again on the tailnet.' };
  }
  return { ok: true };
}

/** Stop notifications on this device, and tell the server so it stops trying. */
export async function disablePush(): Promise<void> {
  if (!pushSupported()) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  await fetch('/api/push/subscribe', {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  }).catch(() => {});
  await subscription.unsubscribe();
}

/** Is this device already subscribed? Drives the toggle's state. */
export async function isPushEnabled(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== 'granted') return false;
  const registration = await navigator.serviceWorker.getRegistration();
  return Boolean(await registration?.pushManager.getSubscription());
}
