/**
 * SSE framing, by hand.
 *
 * `POST /api/run` streams (comms/contracts/api-contracts.md) and `EventSource` cannot
 * POST, so the drawer reads the response body itself. Doing our own framing is also what
 * lets us honour the contract's reconnect clause: "reconnect with `Last-Event-ID`; the
 * runner replays from its buffer for 5 minutes so a phone that slept doesn't lose a run."
 *
 * This module is pure text -> frames. It knows nothing about runs.
 *
 * Owner: drawer-engineer
 */

export interface SseFrame {
  /** `event:` line, or `message` per the SSE default. */
  event: string;
  /** Joined `data:` lines. */
  data: string;
  /** `id:` line, if the server sent one. Becomes the next `Last-Event-ID`. */
  id?: string;
  /** `retry:` line in ms, if the server sent one. */
  retryMs?: number;
}

export interface SseParser {
  /** Feed a decoded chunk; get back whatever frames completed. */
  push(chunk: string): SseFrame[];
  /** Flush a trailing frame at end-of-stream (a server that forgot its final blank line). */
  flush(): SseFrame[];
}

export function createSseParser(): SseParser {
  let buffer = '';
  let event = '';
  let data: string[] = [];
  let id: string | undefined;
  let retryMs: number | undefined;

  function reset(): void {
    event = '';
    data = [];
    id = undefined;
    retryMs = undefined;
  }

  function complete(): SseFrame | null {
    if (data.length === 0 && event === '' && id === undefined) {
      reset();
      return null;
    }
    const frame: SseFrame = { event: event || 'message', data: data.join('\n') };
    if (id !== undefined) frame.id = id;
    if (retryMs !== undefined) frame.retryMs = retryMs;
    reset();
    return frame;
  }

  function consumeLine(line: string, out: SseFrame[]): void {
    if (line === '') {
      const frame = complete();
      if (frame) out.push(frame);
      return;
    }
    if (line.startsWith(':')) return; // comment / keep-alive
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);

    if (field === 'event') event = value;
    else if (field === 'data') data.push(value);
    else if (field === 'id') id = value;
    else if (field === 'retry') {
      const ms = Number(value);
      if (Number.isFinite(ms)) retryMs = ms;
    }
  }

  return {
    push(chunk: string): SseFrame[] {
      buffer += chunk;
      const out: SseFrame[] = [];
      // Normalise CRLF/CR to LF so a proxy's line endings can't swallow a frame.
      buffer = buffer.replace(/\r\n|\r/g, '\n');
      let newline = buffer.indexOf('\n');
      while (newline !== -1) {
        consumeLine(buffer.slice(0, newline), out);
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf('\n');
      }
      return out;
    },
    flush(): SseFrame[] {
      const out: SseFrame[] = [];
      if (buffer.length > 0) {
        consumeLine(buffer, out);
        buffer = '';
      }
      const frame = complete();
      if (frame) out.push(frame);
      return out;
    },
  };
}
