/* =============================================================================
 * sessions/push/server.ts — subscription storage and the send seam (§3.6)
 *
 * What lives here: the list of devices that asked to be told, and the one
 * function that turns a `{kind, id}` into a notification. What does NOT live
 * here: any content. The payload is built by `push/payload.ts`, which rebuilds
 * rather than filters, so this module physically cannot forward a session name
 * even if a caller passes one.
 *
 * Web Push over a tailnet, and why it works with no public ports (§3.6):
 * delivery is OUTBOUND. Our box POSTs to the push service (FCM / Mozilla
 * autopush); the push service already holds a connection to the phone. Nothing
 * needs to reach us. The phone needs internet; our box needs egress; neither
 * needs an inbound port. That is the whole compatibility argument, and it is
 * why push does not weaken BOARD constraint 5.
 *
 * Server-side only.
 * ========================================================================== */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { buildPushPayload } from './payload';
import type { PushKind, PushPayload } from './payload';

/** A `PushSubscription` as `pushManager.subscribe()` serialises it. */
export interface StoredSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  /** Epoch ms, so a dead device can be aged out rather than retried forever. */
  createdAt: number;
}

/**
 * Kept on a local volume next to Langfuse's Postgres, for the same reason:
 * Part VII.4 — this data stays on our box.
 */
const STORE_PATH = process.env.PUSH_SUBSCRIPTIONS_PATH ?? '/data/push-subscriptions.json';

export async function readSubscriptions(path = STORE_PATH): Promise<StoredSubscription[]> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as StoredSubscription[];
  } catch {
    return [];
  }
}

/** Idempotent by endpoint — re-subscribing a device must not duplicate it. */
export async function saveSubscription(
  sub: Omit<StoredSubscription, 'createdAt'>,
  path = STORE_PATH,
): Promise<StoredSubscription[]> {
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    throw new Error('push: subscription is missing endpoint or keys');
  }
  const all = (await readSubscriptions(path)).filter((s) => s.endpoint !== sub.endpoint);
  all.push({ endpoint: sub.endpoint, keys: sub.keys, createdAt: Date.now() });
  await mkdir(dirname(path), { recursive: true }).catch(() => {});
  await writeFile(path, JSON.stringify(all, null, 2), 'utf8');
  return all;
}

export async function removeSubscription(
  endpoint: string,
  path = STORE_PATH,
): Promise<void> {
  const all = (await readSubscriptions(path)).filter((s) => s.endpoint !== endpoint);
  await writeFile(path, JSON.stringify(all, null, 2), 'utf8').catch(() => {});
}

/* ------------------------------------------------------------- the send seam */

export interface PushSender {
  send(sub: StoredSubscription, payload: PushPayload): Promise<void>;
}

/**
 * The shipped sender.
 *
 * RFC 8291 payload encryption and RFC 8292 VAPID signing need a dependency
 * (`web-push`) that `apps/web/package.json` does not yet carry, and that file
 * is owned elsewhere — a decision-request is filed. Hand-rolling ECDH-HKDF-
 * aes128gcm here without being able to integration-test it against a real push
 * service would be the kind of "works in the unit test" crypto that fails
 * silently on a phone at 2am.
 *
 * So this records the intent and says so out loud. It never pretends a
 * notification was delivered (Part VII.3 — an honest empty state beats a
 * plausible fake one).
 */
export const pendingSender: PushSender = {
  async send(sub, payload) {
    console.warn(
      `push: no sender configured — would notify ${sub.endpoint.slice(0, 40)}… ` +
        `kind=${payload.k} id=${payload.id}. Add the web-push dependency to enable delivery.`,
    );
  },
};

let sender: PushSender = pendingSender;

/** Swap in the real sender once the dependency lands. One call site. */
export function setPushSender(next: PushSender): void {
  sender = next;
}

/**
 * Notify every subscribed device.
 *
 * Callers: our own permission watcher (§3.1) and `runner-engineer`'s approval /
 * failure hooks (§3.2) via `POST /api/push/notify`. The agreed interface is
 * `{kind, id}` and nothing else — see the message in
 * `comms/inbox/runner-engineer/`.
 */
export async function notify(input: {
  kind: PushKind;
  id: string;
  at?: number;
  sealed?: string;
}): Promise<{ sent: number; failed: number }> {
  const payload = buildPushPayload(input);
  const subs = await readSubscriptions();

  // pendingSender only warns — nothing left the box. Do not count as sent
  // (Part VII.3 — honest empty beats a plausible fake delivery).
  if (sender === pendingSender) {
    await Promise.all(subs.map((sub) => sender.send(sub, payload)));
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await sender.send(sub, payload);
        sent++;
      } catch {
        failed++;
      }
    }),
  );
  return { sent, failed };
}
