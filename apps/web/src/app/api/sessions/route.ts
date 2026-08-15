/* =============================================================================
 * GET /api/sessions — the list, as ciphertext (§3.1, api-contracts.md)
 *
 * This handler is deliberately boring: forward the browser's own credential,
 * rebuild each row from the envelope allowlist, return. It cannot sort, filter
 * or search, because it cannot read a single field it would need to
 * (ADR-005). All of that happens in the browser after decryption.
 * ========================================================================== */

import { authOf, listSessions, RelayError } from '@/sessions/relay/proxy';

/** Never prerendered, never cached: this is live state behind a credential. */
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    const sessions = await listSessions(authOf(request));
    return Response.json(sessions, {
      headers: { 'cache-control': 'no-store' },
    });
  } catch (err) {
    const e =
      err instanceof RelayError
        ? err
        : new RelayError(500, 'internal', 'Session list failed.', 'Try again in a moment.');
    return Response.json(e.toBody(), { status: e.status });
  }
}
