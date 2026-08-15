/**
 * PWA plumbing — spec §3.6 ("installs to home screen, dark themed, safe-area aware …
 * push notifications via the Happy relay").
 *
 * Two honest constraints encoded here:
 *  - The service worker caches the *app shell*, never `/api/*`. Data does not pretend to
 *    work offline; a stale number is worse than a blank one.
 *  - There is no auth in v1 by design (§3.6, tailnet only). Nothing in this file may be
 *    made "safe" by assuming a session exists.
 *
 * Owner: shell-navigation-engineer. Push *delivery* is `sessions-relay-engineer`'s
 * (`POST /api/push/subscribe`, contracts/api-contracts.md); this file only holds the
 * browser half of the handshake.
 */

export const SERVICE_WORKER_URL = '/sw.js';
export const PUSH_SUBSCRIBE_ENDPOINT = '/api/push/subscribe';

/** The three notification types §3.6 names. The service worker renders only these. */
export type PushKind = 'permission-request' | 'run-failure' | 'approval-request';

/**
 * Payload the relay must send. Kept in one place because `public/sw.js` is plain JS and
 * cannot import this type — the SW validates `kind` against the same three strings.
 */
export interface PushPayload {
  kind: PushKind;
  title: string;
  body: string;
  /** Deep link opened on notification click, e.g. `/sessions/abc123`. */
  url: string;
  /** Collapse key, so a chatty session does not stack ten notifications. */
  tag?: string;
}

export type PushPermissionOutcome =
  | { state: 'subscribed' }
  | { state: 'denied'; message: string }
  | { state: 'unsupported'; message: string }
  | { state: 'failed'; message: string };

const supportsServiceWorker = (): boolean =>
  typeof navigator !== 'undefined' && 'serviceWorker' in navigator;

/**
 * Register the service worker. Safe to call more than once; the browser dedupes.
 * Failure is swallowed to a resolved `null` — a dead SW must never break the app.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!supportsServiceWorker()) return null;
  try {
    return await navigator.serviceWorker.register(SERVICE_WORKER_URL, { scope: '/' });
  } catch {
    return null;
  }
}

/* -----------------------------------------------------------------------------
 * Install flow (§3.6 "installs to home screen").
 *
 * Chromium fires `beforeinstallprompt` and lets us re-raise it later from a user
 * gesture; Safari fires nothing and installs from the Share sheet. So: capture the event
 * if it comes, offer a button only then, and tell everyone else the truth in a sentence
 * rather than sniffing user agents to guess which browser they are holding.
 * -------------------------------------------------------------------------- */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

/**
 * Subscribe to install availability. Returns an unsubscribe function.
 *
 * The listener is attached at module level rather than on mount because the browser fires
 * `beforeinstallprompt` once, early — often before React has hydrated. Missing it means no
 * install button for the whole visit.
 */
export function watchInstallPrompt(onChange: (available: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => undefined;

  const capture = (event: Event): void => {
    event.preventDefault(); // stop the mini-infobar; we own the placement
    deferredPrompt = event as BeforeInstallPromptEvent;
    onChange(true);
  };
  const installed = (): void => {
    deferredPrompt = null;
    onChange(false);
  };

  onChange(deferredPrompt !== null);
  window.addEventListener('beforeinstallprompt', capture);
  window.addEventListener('appinstalled', installed);
  return () => {
    window.removeEventListener('beforeinstallprompt', capture);
    window.removeEventListener('appinstalled', installed);
  };
}

/** Re-raise the captured prompt. Must be called from a user gesture. */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (deferredPrompt === null) return 'unavailable';
  const event = deferredPrompt;
  deferredPrompt = null;
  await event.prompt();
  const { outcome } = await event.userChoice;
  return outcome;
}

/** True when running as an installed PWA rather than a browser tab. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
  return window.matchMedia('(display-mode: standalone)').matches || iosStandalone === true;
}

/**
 * VAPID keys arrive base64url-encoded; `PushManager` wants raw bytes.
 *
 * The buffer is allocated explicitly so the result is a `Uint8Array<ArrayBuffer>` and not
 * the `ArrayBufferLike` default — `applicationServerKey` takes a `BufferSource`, which a
 * possibly-shared buffer does not satisfy.
 */
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const normalised = padded.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalised);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/**
 * Ask for notification permission and register a push subscription.
 *
 * **Must be called from a user gesture** (browsers reject a bare prompt). §3.1 says the
 * SESSIONS view is the reason the PWA exists, so that view owns the button; the shell
 * only exposes this function.
 */
export async function enablePushNotifications(
  vapidPublicKey: string,
): Promise<PushPermissionOutcome> {
  if (!supportsServiceWorker() || typeof window === 'undefined' || !('PushManager' in window)) {
    return {
      state: 'unsupported',
      message: 'This browser cannot receive push notifications. The sessions list still updates while the app is open.',
    };
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return {
      state: 'denied',
      message: 'Notifications are off. Permission prompts and failed runs will only show while this app is open.',
    };
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
    const response = await fetch(PUSH_SUBSCRIBE_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(subscription.toJSON()),
    });
    if (!response.ok) {
      return {
        state: 'failed',
        message: 'The relay refused the subscription. Check that the sessions relay is up on the tailnet.',
      };
    }
    return { state: 'subscribed' };
  } catch {
    return {
      state: 'failed',
      message: "Couldn't reach the relay to register for notifications. This box may be off the tailnet.",
    };
  }
}
