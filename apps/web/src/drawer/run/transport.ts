/**
 * The run transport — `POST /api/run` -> SSE frames (§3.2, contracts/api-contracts.md).
 *
 * A function rather than a class so the console can be driven by the real runner, by the
 * mock in `./mock.ts` while the runner is being built, or by a test — all through the same
 * seam. The hook above it never learns which one it has.
 *
 * Owner: drawer-engineer · Consumes: contracts/api-contracts.md (owner `runner-engineer`)
 */

import { createSseParser, type SseFrame } from './sse';

export interface RunRequest {
  /** `department/agent-name`, exactly the node id from contracts/graph-layout.md. */
  agent: string;
  inputs: Record<string, string | number>;
  dryRun?: boolean;
}

export interface TransportContext {
  /** Sent as the `Last-Event-ID` header so the runner replays from its buffer. */
  lastEventId?: string;
  signal: AbortSignal;
  onFrame: (frame: SseFrame) => void;
}

/** Resolves when the stream ends cleanly; rejects with a `TransportError` otherwise. */
export type RunTransport = (request: RunRequest, context: TransportContext) => Promise<void>;

export class TransportError extends Error {
  readonly retryable: boolean;
  readonly hint?: string;
  constructor(message: string, retryable: boolean, hint?: string) {
    super(message);
    this.name = 'TransportError';
    this.retryable = retryable;
    this.hint = hint;
  }
}

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '';

export const fetchRunTransport: RunTransport = async (request, { lastEventId, signal, onFrame }) => {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'text/event-stream',
  };
  if (lastEventId) headers['Last-Event-ID'] = lastEventId;

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/run`, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
      signal,
    });
  } catch (cause) {
    if (signal.aborted) return;
    throw new TransportError('The runner did not answer. It may be offline — nothing was started.', true);
  }

  if (!response.ok || !response.body) {
    // The contract's error envelope: `{error: {code, message, hint?}}`, hint shown verbatim.
    let message = `The runner refused the run (HTTP ${response.status}).`;
    let hint: string | undefined;
    try {
      const body = (await response.json()) as { error?: { message?: string; hint?: string } };
      if (body?.error?.message) message = body.error.message;
      hint = body?.error?.hint;
    } catch {
      /* a non-JSON error body is still an error; the status line carries it */
    }
    throw new TransportError(message, response.status >= 500, hint);
  }

  const parser = createSseParser();
  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      for (const frame of parser.push(decoder.decode(value, { stream: true }))) onFrame(frame);
    }
    for (const frame of parser.flush()) onFrame(frame);
  } catch (cause) {
    if (signal.aborted) return;
    throw new TransportError('The run stream was cut off.', true);
  } finally {
    reader.releaseLock?.();
  }
};
