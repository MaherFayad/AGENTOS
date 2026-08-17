/**
 * The run transport — `POST /api/p/:project/run` -> SSE frames (§3.2,
 * contracts/api-contracts.md).
 *
 * A function rather than a class so the console can be driven by the real runner, by the
 * mock in `./mock.ts` while the runner is being built, or by a test — all through the same
 * seam. The hook above it never learns which one it has.
 *
 * ---
 *
 * **Both URLs come out of `RUNNER_ROUTES`, and that is the repair rather than a tidy-up.**
 *
 * M15 moved every project-shaped route under `/api/p/:project` (ADR-015). This file held
 * `/api/run` and `/api/run/:runId/stream` as string literals, so nothing failed at build
 * time and nothing failed legibly at run time: `POST /api/run` began answering **400
 * `project_scope_missing`**, which arrives here as an ordinary refusal and is printed in
 * the console as though the runner had rejected the *run*. No test, type or screen said
 * that the address was the problem.
 *
 * A literal is what made that possible, so there is no longer one to type. The same shape
 * as `map/data/socket.ts`, for the same reason: the next time a path moves, this file moves
 * with it or fails to compile.
 *
 * Owner: drawer-engineer · Consumes: contracts/api-contracts.md (owner `runner-engineer`)
 */

import { RUNNER_ROUTES } from '@agnetos/contracts';
import { NO_PROJECT_SENTENCE, projectApiUrl } from '@/components/shell/useSearchIndex';
import { createSseParser, type SseFrame } from './sse';

export interface RunRequest {
  /** `department/agent-name`, exactly the node id from contracts/graph-layout.md. */
  agent: string;
  inputs: Record<string, string | number>;
  dryRun?: boolean;
}

export interface TransportContext {
  /**
   * The project this run belongs to, from the URL (`useProjectSegment`).
   *
   * It is on the **context** and deliberately not on `RunRequest`: `RunRequest` is the
   * JSON body, and the whole point of ADR-015 is that a request names its project in its
   * *path*. A `project` field in the body would be a second spelling of the same fact, and
   * the one the server does not read.
   *
   * `null` means **do not start a run** — never "start it unscoped". See `fetchRunTransport`.
   */
  project: string | null;
  /** Sent as the `Last-Event-ID` header so the runner replays from its buffer. */
  lastEventId?: string;
  /**
   * Set once the run has announced itself with `start`. Its presence is what turns a
   * retry into a RE-ATTACH instead of a second run — see `fetchRunTransport`.
   */
  runId?: string;
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

/**
 * Two routes, one function, and the difference matters more than it looks.
 *
 *   no runId yet   → `POST /api/p/:project/run`               start the run
 *   runId in hand  → `GET  /api/p/:project/run/:runId/stream` re-attach to the run going
 *
 * `EventSource` cannot POST, which is why the runner exposes a GET re-attach at all
 * (contracts/api-contracts.md, "Replay"). Retrying the POST after a dropped connection
 * would spawn a *second* billable run against the same inputs and show its output as if it
 * were the first — the single most expensive bug this component could have.
 *
 * **With no project, nothing is sent at all.** Not the unscoped path, which is still
 * mounted and answers 400 (`LEGACY_UNSCOPED_PATHS`) — calling it anyway would turn the
 * runner's deliberate refusal into a shrug in our console, and it is the one refusal that
 * tells whoever is looking exactly which line to fix. The `TransportError` is raised
 * **non-retryable** on purpose: three retries of an address that names no project produce
 * the same address three times, one second apart, and a "reconnecting…" spinner in front
 * of a bug that is entirely ours.
 */
export const fetchRunTransport: RunTransport = async (
  request,
  { project, lastEventId, runId, signal, onFrame },
) => {
  const reattaching = typeof runId === 'string' && runId.length > 0;
  const headers: Record<string, string> = { accept: 'text/event-stream' };
  if (!reattaching) headers['content-type'] = 'application/json';
  if (lastEventId) headers['Last-Event-ID'] = lastEventId;

  const scoped = projectApiUrl(
    reattaching ? RUNNER_ROUTES.runStream.path : RUNNER_ROUTES.run.path,
    project,
  );
  if (scoped === null) throw new TransportError(NO_PROJECT_SENTENCE, false);

  const path = reattaching
    ? `${scoped.replace(':runId', encodeURIComponent(runId))}${lastEventId ? `?lastEventId=${encodeURIComponent(lastEventId)}` : ''}`
    : scoped;
  const url = `${API_BASE}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: reattaching ? 'GET' : 'POST',
      headers,
      ...(reattaching ? {} : { body: JSON.stringify(request) }),
      signal,
    });
  } catch {
    if (signal.aborted) return;
    throw new TransportError(
      reattaching
        ? 'Lost the connection to a run that is still going. It is still running on the server.'
        : 'The runner did not answer. It may be offline — nothing was started.',
      true,
    );
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
  } catch {
    if (signal.aborted) return;
    throw new TransportError('The run stream was cut off.', true);
  } finally {
    reader.releaseLock?.();
  }
};
