/* =============================================================================
 * POST /api/sessions/:id/input — steer the session (§3.1)
 *
 * The body is `{ciphertext}` and nothing else. It was sealed in the browser
 * before this request existed, so there is no version of this handler that
 * could log what the human typed even by accident — `inputBody()` throws on
 * anything that is not a sealed box.
 * ========================================================================== */

import { inputBody } from '@/sessions/relay/envelope';
import { authOf, RelayError, sendInput } from '@/sessions/relay/proxy';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  try {
    const auth = authOf(request);
    const raw = (await request.json()) as { ciphertext?: unknown };
    const body = inputBody(String(raw?.ciphertext ?? ''));
    await sendInput(auth, id, body.ciphertext);
    return Response.json({ ok: true });
  } catch (err) {
    const e =
      err instanceof RelayError
        ? err
        : new RelayError(
            400,
            'bad_request',
            'That input was not a sealed box.',
            'Reload the app and try again.',
          );
    return Response.json(e.toBody(), { status: e.status });
  }
}
