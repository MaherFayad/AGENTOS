/* =============================================================================
 * POST /api/sessions/:id/permission — the Allow / Deny pills (§3.1)
 *
 * `{requestId, allow}`. This body is legitimately plaintext: it reveals that a
 * decision was made, never what it was about. The tool name and the command
 * stay sealed inside the transcript (see `relay/envelope.ts`).
 * ========================================================================== */

import { permissionBody } from '@/sessions/relay/envelope';
import { authOf, RelayError, sendPermission } from '@/sessions/relay/proxy';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  try {
    const auth = authOf(request);
    const raw = (await request.json()) as { requestId?: unknown; allow?: unknown };
    const body = permissionBody(String(raw?.requestId ?? ''), raw?.allow === true);
    await sendPermission(auth, id, body.requestId, body.allow);
    return Response.json({ ok: true });
  } catch (err) {
    const e =
      err instanceof RelayError
        ? err
        : new RelayError(
            400,
            'bad_request',
            'That decision was missing its request id.',
            'Open the session again — the prompt may already be answered.',
          );
    return Response.json(e.toBody(), { status: e.status });
  }
}
