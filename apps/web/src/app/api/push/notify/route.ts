/* =============================================================================
 * POST /api/push/notify — the one way anything sends a notification (§3.6)
 *
 * THE AGREED INTERFACE with `runner-engineer` (§3.2):
 *
 *     POST /api/push/notify   { "kind": "approval" | "run-failed", "id": "run_…" }
 *     → 202 { "sent": n, "failed": n }
 *
 * `kind` and `id` are the whole body. Anything else in it is dropped by
 * `buildPushPayload`, which rebuilds rather than filters — so a caller that
 * passes an agent name, a run summary or a command line does not leak it, even
 * by mistake. That is asserted in `no-plaintext-boundary.test.mjs`.
 *
 * The runner does not need to know what a notification looks like, and must not
 * compose one: our copy is fixed per kind precisely so a lock screen never
 * shows what a paused run was about.
 *
 * Tailnet-only, no auth in v1 by design (§3.6, BOARD constraint 5). Nothing
 * here is safe *because* auth exists — the worst a caller can do is make a
 * phone buzz with copy it does not control.
 * ========================================================================== */

import { notify } from '@/sessions/push/server';
import { PUSH_KINDS, type PushKind } from '@/sessions/push/payload';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as {
    kind?: string;
    id?: string;
    sealed?: string;
  };

  if (!body.kind || !PUSH_KINDS.includes(body.kind as PushKind) || !body.id) {
    return Response.json(
      {
        error: {
          code: 'bad_request',
          message: `notify needs {kind, id}; kind is one of ${PUSH_KINDS.join(', ')}.`,
          hint: 'Nothing was sent.',
        },
      },
      { status: 400 },
    );
  }

  const result = await notify({
    kind: body.kind as PushKind,
    id: body.id,
    sealed: body.sealed,
  });
  return Response.json(result, { status: 202 });
}
