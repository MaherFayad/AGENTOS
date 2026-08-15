/**
 * SSE plumbing for `POST /api/run` and `GET /api/run/:runId/stream` (§3.2).
 *
 * The design constraint is the phone. The primary client is a PWA on a device that will
 * lock, sleep, switch networks and come back — so every event is buffered under a
 * monotonic id and replayed from `Last-Event-ID` for five minutes past the end of the
 * run. A run whose output is only visible to a client that stayed awake is not a run you
 * can start from a phone.
 */
import type { RunStreamEvent, RunStreamEventName } from '@agnetos/contracts';
import { SSE_REPLAY_WINDOW_MS } from '@agnetos/contracts';

export interface BufferedEvent {
  id: number;
  event: RunStreamEventName;
  data: unknown;
}

export type SseSink = (chunk: string) => void;

/** Wire format. `id:` is what the browser echoes back as `Last-Event-ID`. */
export function formatSse(frame: BufferedEvent): string {
  const payload = JSON.stringify(frame.data ?? {});
  return `id: ${frame.id}\nevent: ${frame.event}\ndata: ${payload}\n\n`;
}

/** A comment frame. Keeps proxies and dozing radios from dropping an idle stream. */
export const SSE_HEARTBEAT = ': keep-alive\n\n';

export class RunStream {
  readonly runId: string;
  private readonly buffer: BufferedEvent[] = [];
  private readonly sinks = new Set<SseSink>();
  private nextId = 1;
  private endedAt: number | null = null;

  constructor(runId: string) {
    this.runId = runId;
  }

  get ended(): boolean {
    return this.endedAt !== null;
  }

  get eventCount(): number {
    return this.buffer.length;
  }

  /** Append an event, fan it out to attached clients, and keep it for replay. */
  emit<E extends RunStreamEvent>(event: E['event'], data: E['data']): BufferedEvent {
    const frame: BufferedEvent = { id: this.nextId, event, data };
    this.nextId += 1;
    this.buffer.push(frame);

    const chunk = formatSse(frame);
    for (const sink of this.sinks) {
      try {
        sink(chunk);
      } catch {
        // A dead socket must not take the run down with it. The run is the valuable
        // thing here; the connection is disposable and reconnects with Last-Event-ID.
        this.sinks.delete(sink);
      }
    }
    return frame;
  }

  /**
   * Attach a client, replaying everything after `lastEventId` first.
   *
   * Replay before subscribe is deliberate: subscribing first would interleave live events
   * into the middle of the replay and the console would render them out of order.
   */
  attach(sink: SseSink, lastEventId?: number): () => void {
    const from = Number.isFinite(lastEventId) && (lastEventId as number) > 0 ? (lastEventId as number) : 0;
    for (const frame of this.buffer) {
      if (frame.id > from) sink(formatSse(frame));
    }
    this.sinks.add(sink);
    return () => {
      this.sinks.delete(sink);
    };
  }

  /** Mark the run finished. The buffer stays warm for the replay window. */
  end(): void {
    if (this.endedAt === null) this.endedAt = Date.now();
  }

  /** True once the replay window has closed and this stream can be dropped. */
  isExpired(now: number = Date.now()): boolean {
    return this.endedAt !== null && now - this.endedAt > SSE_REPLAY_WINDOW_MS;
  }

  /** Attached client count, for `queueDepth`-style introspection and tests. */
  get listenerCount(): number {
    return this.sinks.size;
  }
}

/** Parse `Last-Event-ID` from either the header or the query fallback. */
export function parseLastEventId(
  header: string | string[] | undefined,
  query: string | undefined,
): number | undefined {
  const raw = Array.isArray(header) ? header[0] : (header ?? query);
  if (raw === undefined) return undefined;
  const parsed = Number.parseInt(String(raw), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}
