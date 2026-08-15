/* =============================================================================
 * GET /api/sessions/:id/stream — SSE of ciphertext entries (§3.1)
 *
 * `Last-Event-ID` is the reconnect contract (api-contracts.md): the client says
 * where it got to, we resume from there. That is what lets a phone sleep for an
 * hour and rejoin mid-transcript with no gap and no duplicates.
 *
 * The stream carries sealed boxes. This process could not render a line of it.
 * ========================================================================== */

import { authOf, RelayError, streamTranscript } from '@/sessions/relay/proxy';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  try {
    const auth = authOf(request);
    const header = request.headers.get('last-event-id');
    const query = new URL(request.url).searchParams.get('lastEventId');
    const from = Number(header ?? query ?? 0);

    return new Response(
      streamTranscript(auth, id, Number.isFinite(from) ? from : 0, request.signal),
      {
        headers: {
          'content-type': 'text/event-stream',
          'cache-control': 'no-store, no-transform',
          connection: 'keep-alive',
          // Caddy and any intermediary must not buffer an event stream, or the
          // "live" in live transcript becomes "every 30 seconds in a burst".
          'x-accel-buffering': 'no',
        },
      },
    );
  } catch (err) {
    const e =
      err instanceof RelayError
        ? err
        : new RelayError(500, 'internal', 'Stream failed to open.', 'Pull to refresh.');
    return Response.json(e.toBody(), { status: e.status });
  }
}
