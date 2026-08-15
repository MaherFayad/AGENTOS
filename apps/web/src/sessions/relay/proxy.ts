/* =============================================================================
 * sessions/relay/proxy.ts — the thin, stateless, credential-free proxy (§3.1)
 *
 * Three properties, in the order they matter:
 *
 *  1. STATELESS AND CREDENTIAL-FREE. This module holds no key and no token.
 *     It forwards the browser's own `Authorization` header to happy-server and
 *     nothing else. There is no server-side session, no cookie, no cache. If
 *     someone dumped this process's memory they would find ciphertext in
 *     flight and nothing more.
 *
 *  2. CIPHERTEXT PASSTHROUGH. Every row is rebuilt through
 *     `relay/envelope.ts`'s allowlist on the way out. See that file for why it
 *     rebuilds instead of filtering.
 *
 *  3. NO LOGGING OF PAYLOADS. `logSafe()` exists so that debugging this proxy
 *     never becomes a reason to write a transcript — even an encrypted one —
 *     to disk.
 *
 * Runs server-side only (Next route handlers under app/api/sessions).
 * ========================================================================== */

import { sanitizeSessionList, sanitizeTranscript } from './envelope';
import type { SessionEnvelope, TranscriptEnvelope } from '../types';

/**
 * The `happy` service on our Docker network (Part V). Tailnet-only; Caddy is
 * the sole entry point and binds to the Tailscale IP. There is no public port
 * and nothing here assumes auth exists (§3.6, BOARD constraint 5).
 */
const RELAY_BASE =
  process.env.HAPPY_RELAY_URL ?? process.env.HAPPY_INTERNAL_URL ?? 'http://happy:3005';

/** How long we wait on the relay before telling the human something useful. */
const TIMEOUT_MS = 10_000;

export class RelayError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly hint?: string,
  ) {
    super(message);
  }

  /** The uniform error shape from the API contract. */
  toBody() {
    return { error: { code: this.code, message: this.message, hint: this.hint } };
  }
}

/**
 * The only header we forward. Not cookies (a proxy that forwards cookies is a
 * proxy that can be made to act on someone else's behalf), not user agent, not
 * anything the browser did not explicitly hand us for this call.
 */
export function authOf(req: Request): string {
  const auth = req.headers.get('authorization');
  if (!auth) {
    throw new RelayError(
      401,
      'relay_unauthenticated',
      'No relay credential on this request.',
      'Unlock sessions on this device, then pull to refresh.',
    );
  }
  return auth;
}

async function call(path: string, auth: string, init?: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${RELAY_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      cache: 'no-store',
      headers: {
        authorization: auth,
        ...(init?.body ? { 'content-type': 'application/json' } : {}),
      },
    });

    if (!res.ok) {
      throw new RelayError(
        res.status,
        'relay_upstream',
        `Relay returned ${res.status}.`,
        res.status === 401
          ? 'Your device needs to pair with the relay again.'
          : 'The session relay is not answering. Check the happy container.',
      );
    }
    return await res.json();
  } catch (err) {
    if (err instanceof RelayError) throw err;
    throw new RelayError(
      502,
      'relay_unreachable',
      err instanceof Error ? err.message : 'Relay unreachable.',
      'Can’t reach the session relay. You’re probably off the tailnet.',
    );
  } finally {
    clearTimeout(timer);
  }
}

/** `GET /api/sessions` — ciphertext rows. The browser decrypts and sorts. */
export async function listSessions(auth: string): Promise<SessionEnvelope[]> {
  const body = await call('/v1/sessions', auth);
  const rows = Array.isArray(body) ? body : (body as { sessions?: unknown }).sessions;
  return sanitizeSessionList(rows ?? []);
}

/** Transcript entries after a cursor. Powers both first load and replay. */
export async function listTranscript(
  auth: string,
  sessionId: string,
  after = 0,
): Promise<TranscriptEnvelope[]> {
  const body = await call(
    `/v1/sessions/${encodeURIComponent(sessionId)}/messages?after=${after}`,
    auth,
  );
  const rows = Array.isArray(body) ? body : (body as { messages?: unknown }).messages;
  return sanitizeTranscript(rows ?? []);
}

/** `POST /api/sessions/:id/input` — `ciphertext` was sealed in the browser. */
export async function sendInput(
  auth: string,
  sessionId: string,
  ciphertext: string,
): Promise<void> {
  await call(`/v1/sessions/${encodeURIComponent(sessionId)}/input`, auth, {
    method: 'POST',
    body: JSON.stringify({ ciphertext }),
  });
}

/** `POST /api/sessions/:id/permission` — the Allow / Deny pills. */
export async function sendPermission(
  auth: string,
  sessionId: string,
  requestId: string,
  allow: boolean,
): Promise<void> {
  await call(`/v1/sessions/${encodeURIComponent(sessionId)}/permission`, auth, {
    method: 'POST',
    body: JSON.stringify({ requestId, allow }),
  });
}

/**
 * `GET /api/sessions/:id/stream` — SSE of ciphertext entries.
 *
 * This is a cursor poll, not a socket bridge, and that is a deliberate trade.
 * Upstream speaks Socket.IO; bridging it would give us ~600ms less latency and
 * a stateful proxy that has to reason about a phone that slept for four hours
 * mid-upgrade. A poll with an explicit cursor reconnects perfectly by
 * construction: the client sends `Last-Event-ID`, we resume from it, and a
 * dropped connection costs one interval. On a train, that is the better tab.
 *
 * Upgrade path if latency ever matters: swap this generator for a socket
 * subscription. The SSE contract with the client does not change.
 */
export function streamTranscript(
  auth: string,
  sessionId: string,
  fromSeq: number,
  signal: AbortSignal,
  intervalMs = 1000,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let cursor = fromSeq;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown, id?: number) => {
        const idLine = id === undefined ? '' : `id: ${id}\n`;
        controller.enqueue(
          encoder.encode(`${idLine}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      send('open', { sessionId, from: cursor });

      while (!signal.aborted) {
        try {
          const rows = await listTranscript(auth, sessionId, cursor);
          for (const row of rows) {
            cursor = Math.max(cursor, row.seq);
            send('entry', row, row.seq);
          }
          // A comment line keeps intermediaries from reaping an idle stream.
          if (rows.length === 0) controller.enqueue(encoder.encode(': keepalive\n\n'));
        } catch (err) {
          const e = err instanceof RelayError ? err : null;
          send('error', {
            code: e?.code ?? 'relay_unreachable',
            message: e?.message ?? 'Relay unreachable.',
            hint: e?.hint ?? 'Reconnecting…',
          });
        }
        await new Promise((r) => setTimeout(r, intervalMs));
      }
      controller.close();
    },
  });
}
