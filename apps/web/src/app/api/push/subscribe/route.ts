/* =============================================================================
 * POST/DELETE /api/push/subscribe — Web Push registration (§3.6)
 *
 * A subscription is an endpoint URL plus two public keys the push service
 * issued. It carries no session content and no decryption key — the p256dh in
 * here encrypts the *transport* to this device; it has nothing to do with the
 * E2E key in `lib/e2e.ts`, which never leaves the browser.
 *
 * Stored on a local volume next to the rest of our data (Part VII.4).
 * ========================================================================== */

import { removeSubscription, saveSubscription } from '@/sessions/push/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    };
    await saveSubscription({
      endpoint: String(body.endpoint ?? ''),
      keys: { p256dh: String(body.keys?.p256dh ?? ''), auth: String(body.keys?.auth ?? '') },
    });
    return Response.json({ ok: true });
  } catch {
    return Response.json(
      {
        error: {
          code: 'bad_request',
          message: 'That was not a push subscription.',
          hint: 'Turn notifications off and on again in Settings.',
        },
      },
      { status: 400 },
    );
  }
}

/** Unsubscribing tells the server to stop trying, which is the polite half of
 *  the toggle — a dead endpoint otherwise gets retried until it 410s. */
export async function DELETE(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as { endpoint?: string };
  if (body.endpoint) await removeSubscription(String(body.endpoint));
  return Response.json({ ok: true });
}
