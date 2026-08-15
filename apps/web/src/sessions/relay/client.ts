/* =============================================================================
 * sessions/relay/client.ts — browser side of the relay (spec §3.1)
 *
 * Why this does not use `EventSource`: `EventSource` cannot set headers, so the
 * relay credential would have to travel in the query string — and query strings
 * end up in access logs, in referrers and in browser history. A `fetch` with a
 * streamed body is thirty lines more code and keeps the credential in a header
 * where it belongs.
 *
 * The credential is NOT the decryption key. It is a capability token for the
 * relay: it can list ciphertext and post ciphertext, and it cannot read a
 * single word of a transcript. The key lives in `lib/e2e.ts`, is
 * non-extractable, and never touches this file.
 * ========================================================================== */

import type { SessionEnvelope, TranscriptEnvelope } from '../types';

const TOKEN_KEY = 'agnetos.relayToken';

/** The pairing credential for happy-server. Local to this device. */
export function relayToken(): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setRelayToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export class ClientError extends Error {
  hint: string;
  constructor(message: string, hint: string) {
    super(message);
    this.hint = hint;
  }
}

function authHeaders(): Record<string, string> {
  const token = relayToken();
  if (!token) {
    throw new ClientError(
      'no relay credential',
      'This device isn’t paired with the session relay yet.',
    );
  }
  return { authorization: `Bearer ${token}` };
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: { message?: string; hint?: string };
    } | null;
    throw new ClientError(
      body?.error?.message ?? `Request failed (${res.status}).`,
      body?.error?.hint ?? 'Something went wrong talking to the relay.',
    );
  }
  return (await res.json()) as T;
}

/** Ciphertext rows. The browser decrypts and sorts them (ADR-005). */
export async function fetchSessions(signal?: AbortSignal): Promise<SessionEnvelope[]> {
  const res = await fetch('/api/sessions', {
    headers: authHeaders(),
    cache: 'no-store',
    signal,
  });
  return json<SessionEnvelope[]>(res);
}

/** What the user typed, already sealed in the browser. */
export async function postInput(sessionId: string, ciphertext: string): Promise<void> {
  await json(
    await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/input`, {
      method: 'POST',
      headers: { ...authHeaders(), 'content-type': 'application/json' },
      body: JSON.stringify({ ciphertext }),
    }),
  );
}

/** The Allow / Deny pills. An opaque id and a boolean — see envelope.ts. */
export async function postPermission(
  sessionId: string,
  requestId: string,
  allow: boolean,
): Promise<void> {
  await json(
    await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/permission`, {
      method: 'POST',
      headers: { ...authHeaders(), 'content-type': 'application/json' },
      body: JSON.stringify({ requestId, allow }),
    }),
  );
}

/* -------------------------------------------------------------- SSE parsing */

export interface SseEvent {
  event: string;
  data: unknown;
  id?: number;
}

/**
 * Open the transcript stream from a cursor.
 *
 * `Last-Event-ID` is the reconnect contract from `comms/contracts/api-contracts.md`:
 * we say where we got to, the relay resumes from there. A phone that slept for
 * an hour rejoins mid-transcript with no gap and no duplicates
 * (`lib/replay.ts` handles the overlap).
 */
export async function* openTranscriptStream(
  sessionId: string,
  fromSeq: number,
  signal: AbortSignal,
): AsyncGenerator<SseEvent> {
  const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/stream`, {
    headers: {
      ...authHeaders(),
      accept: 'text/event-stream',
      ...(fromSeq > 0 ? { 'last-event-id': String(fromSeq) } : {}),
    },
    cache: 'no-store',
    signal,
  });

  if (!res.ok || !res.body) {
    throw new ClientError('stream failed', 'Lost the session stream. Reconnecting…');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (!signal.aborted) {
    const { done, value } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true });

    let split = buffer.indexOf('\n\n');
    while (split !== -1) {
      const frame = buffer.slice(0, split);
      buffer = buffer.slice(split + 2);
      const parsed = parseFrame(frame);
      if (parsed) yield parsed;
      split = buffer.indexOf('\n\n');
    }
  }
}

/** One `event:/data:/id:` frame. Comment lines (`: keepalive`) yield nothing. */
export function parseFrame(frame: string): SseEvent | null {
  let event = 'message';
  let id: number | undefined;
  const dataLines: string[] = [];

  for (const line of frame.split('\n')) {
    if (!line || line.startsWith(':')) continue;
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    const value = colon === -1 ? '' : line.slice(colon + 1).trimStart();
    if (field === 'event') event = value;
    else if (field === 'data') dataLines.push(value);
    else if (field === 'id') id = Number(value);
  }

  if (dataLines.length === 0) return null;
  try {
    return { event, data: JSON.parse(dataLines.join('\n')), id };
  } catch {
    return null;
  }
}

export type { TranscriptEnvelope };
