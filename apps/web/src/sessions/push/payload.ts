/* =============================================================================
 * sessions/push/payload.ts — what a notification is allowed to say (§3.6)
 *
 * Three notification types, per §3.6: permission prompts, run failures, and
 * approval requests. Between them they are the reason the PWA exists — the
 * phone is where you approve things.
 *
 * A push payload is the least private thing in this system. It is composed on
 * our server, handed to a third-party push service (FCM / Mozilla autopush),
 * and rendered by the OS onto a lock screen that anyone standing nearby can
 * read. So the payload carries NO CONTENT by default:
 *
 *     { k: 'permission', id: 'ses_…', at: 1755… }
 *
 * The service worker renders fixed copy per `k`. Tapping deep-links into the
 * app, where the real content is fetched over the tailnet and decrypted in the
 * browser. Our server could not do better than this even if we wanted it to —
 * it only holds ciphertext (ADR-005).
 *
 * A user who explicitly opts into detailed notifications gets `c`: a sealed box
 * the SERVICE WORKER decrypts locally with the key in IndexedDB. Still no
 * plaintext on the server, still no plaintext to the push service.
 *
 * NODE-LOADABLE LEAF: no runtime imports.
 * ========================================================================== */

/** §3.6's three types, and nothing else. */
export type PushKind = 'permission' | 'run-failed' | 'approval';

export const PUSH_KINDS: readonly PushKind[] = ['permission', 'run-failed', 'approval'];

/**
 * The wire payload. Short keys because push services cap payload size, and
 * because a payload with room for prose invites prose.
 */
export interface PushPayload {
  k: PushKind;
  /** Session id, run id, or approval id depending on `k`. Opaque. */
  id: string;
  /** Epoch ms, so a notification delivered late can say so. */
  at: number;
  /** Optional sealed box, decrypted by the SW only under `detail: 'full'`. */
  c?: string;
}

/**
 * How much the OS notification may reveal.
 *   minimal — fixed copy, no content. The default, and what a lock screen gets.
 *   full    — the SW decrypts `c` locally and shows the session name / tool.
 */
export type NotificationDetail = 'minimal' | 'full';

export const DEFAULT_DETAIL: NotificationDetail = 'minimal';

/**
 * Fixed copy. Written to be useful at a glance and useless to a shoulder
 * surfer: it says a decision is waiting, never what the decision is about.
 */
export const NOTIFICATION_COPY: Record<PushKind, { title: string; body: string }> = {
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

/**
 * Build a payload from whatever the caller has in hand.
 *
 * Note that this REBUILDS rather than filters — the same discipline as
 * `relay/envelope.ts`. A caller (including `runner-engineer`'s approval hook)
 * can pass an object stuffed with agent names, session titles and command
 * lines; none of it survives. `push-payload.test.mjs` asserts that with a
 * deliberately poisoned input.
 */
export function buildPushPayload(input: {
  kind: PushKind;
  id: string;
  at?: number;
  sealed?: string;
}): PushPayload {
  if (!PUSH_KINDS.includes(input.kind)) {
    throw new Error(`push: unknown kind "${input.kind}"`);
  }
  if (!input.id || typeof input.id !== 'string') {
    throw new Error('push: an id is required — it is how the tap knows where to go');
  }
  const payload: PushPayload = {
    k: input.kind,
    id: input.id,
    at: typeof input.at === 'number' && Number.isFinite(input.at) ? input.at : Date.now(),
  };
  if (typeof input.sealed === 'string' && input.sealed) payload.c = input.sealed;
  return payload;
}

/** Defensive parse in the service worker — a malformed push must not throw. */
export function parsePushPayload(raw: unknown): PushPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Partial<PushPayload>;
  if (!p.k || !PUSH_KINDS.includes(p.k) || typeof p.id !== 'string' || !p.id) return null;
  return {
    k: p.k,
    id: p.id,
    at: typeof p.at === 'number' ? p.at : Date.now(),
    ...(typeof p.c === 'string' && p.c ? { c: p.c } : {}),
  };
}

/**
 * Where a tap lands. Deep links go to the exact session or approval, never to
 * a list the user then has to search — the whole point of the notification is
 * that they are holding the phone with one thumb.
 *
 * `/sessions/:id` is ours. `/approvals/:id` and `/runs/:id` belong to
 * `runner-engineer` (§3.2); this function is the agreed contract for both.
 */
export function deepLinkFor(payload: PushPayload): string {
  switch (payload.k) {
    case 'permission':
      return `/sessions/${encodeURIComponent(payload.id)}`;
    case 'approval':
      return `/approvals/${encodeURIComponent(payload.id)}`;
    case 'run-failed':
      return `/runs/${encodeURIComponent(payload.id)}`;
    default: {
      const _never: never = payload.k;
      return _never;
    }
  }
}

/**
 * Notification options. `tag` collapses repeats so ten permission prompts from
 * one session are one line in the shade, and `renotify` still buzzes so the
 * newest one is not silently swallowed.
 */
export function notificationOptions(payload: PushPayload): {
  tag: string;
  renotify: boolean;
  requireInteraction: boolean;
  data: { url: string; k: PushKind; id: string; at: number };
} {
  return {
    tag: `${payload.k}:${payload.id}`,
    renotify: true,
    // A permission prompt is blocking a session and costing money; it stays on
    // screen until touched. The other two are informational.
    requireInteraction: payload.k === 'permission',
    data: { url: deepLinkFor(payload), k: payload.k, id: payload.id, at: payload.at },
  };
}
