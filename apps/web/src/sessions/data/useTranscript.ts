'use client';

/* =============================================================================
 * data/useTranscript.ts — one session's stream, healed after every drop (§3.1)
 *
 * Assume a bad network and a sleeping device. The loop below is written for a
 * phone on a train, not a laptop on a desk:
 *
 *   open stream from our cursor
 *     → decrypt each entry HERE, in the browser
 *     → merge by `seq` so a replay produces no duplicates
 *   connection dies (it will)
 *     → back off with jitter, reopen from the same cursor, keep the transcript
 *       on screen the whole time
 *
 * The transcript is never cleared on a reconnect. Blanking the screen because a
 * socket blinked is the single most alarming thing this view could do.
 *
 * Decryption happens in this file and only in this file (with `lib/e2e.ts`).
 * Neither the relay nor our proxy ever holds a plaintext line — see
 * `__tests__/no-plaintext-boundary.test.mjs`.
 * ========================================================================== */

import { useCallback, useEffect, useRef, useState } from 'react';
import { encodeSealed, openJson, parseSealed, sealJson } from '@/lib/e2e';
import { openTranscriptStream, postInput, postPermission } from '../relay/client';
import { toTranscriptEntry, pendingPermission } from '../relay/happy-adapter';
import { backoffMs, cursorOf, hasGap, mergeByCursor } from '../lib/replay';
import type {
  ConnectionState,
  PermissionRequest,
  TranscriptEntry,
  TranscriptEnvelope,
} from '../types';

export interface TranscriptView {
  entries: TranscriptEntry[];
  connection: ConnectionState;
  /** True when the relay's replay buffer aged out and we know we missed lines. */
  gap: boolean;
  /** The newest unresolved permission prompt, or null. Drives the copper card. */
  pending: PermissionRequest | null;
  /** True while an Allow/Deny or a steer is in flight. Disables the pills. */
  busy: boolean;
  error: string | null;
  decide: (requestId: string, allow: boolean) => Promise<void>;
  steer: (text: string) => Promise<void>;
}

export function useTranscript(sessionId: string, key: CryptoKey | null): TranscriptView {
  const [entries, setEntries] = useState<TranscriptEntry[]>([]);
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [gap, setGap] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Optimistic: the pill greys out the moment it is tapped, before the relay
  // has confirmed. A thumb that gets no feedback taps again.
  const [resolved, setResolved] = useState<ReadonlySet<string>>(() => new Set());

  const entriesRef = useRef<TranscriptEntry[]>([]);
  entriesRef.current = entries;
  const keyRef = useRef(key);
  keyRef.current = key;

  useEffect(() => {
    if (!key || !sessionId) return;
    const controller = new AbortController();
    let attempt = 0;
    let stopped = false;

    const run = async (): Promise<void> => {
      while (!stopped && !controller.signal.aborted) {
        setConnection(attempt === 0 ? 'connecting' : 'reconnecting');
        try {
          const from = cursorOf(entriesRef.current);
          for await (const event of openTranscriptStream(sessionId, from, controller.signal)) {
            if (event.event === 'open') {
              attempt = 0;
              setConnection('live');
              continue;
            }
            if (event.event === 'error') {
              setConnection('reconnecting');
              continue;
            }
            if (event.event !== 'entry') continue;

            const envelope = event.data as TranscriptEnvelope;
            const activeKey = keyRef.current;
            if (!activeKey) continue;

            let entry: TranscriptEntry;
            try {
              /* ---- THE DECRYPTION BOUNDARY, client side ------------------- */
              const plain = await openJson<unknown>(
                activeKey,
                parseSealed(envelope.ciphertext),
              );
              entry = toTranscriptEntry(plain, envelope);
              /* ------------------------------------------------------------- */
            } catch {
              // An entry sealed with another key is shown as a placeholder, not
              // dropped: a hole in a transcript should be visible.
              entry = {
                id: envelope.id,
                seq: envelope.seq,
                at: envelope.at,
                kind: 'system',
                text: '[this entry was encrypted with a different key]',
              };
            }

            setEntries((prev) => {
              if (hasGap(prev, [entry])) setGap(true);
              return mergeByCursor(prev, [entry]);
            });
            setConnection('live');
          }
          // The generator returned: the server closed the stream cleanly.
          if (stopped || controller.signal.aborted) return;
        } catch {
          if (stopped || controller.signal.aborted) return;
        }

        setConnection(navigator.onLine === false ? 'offline' : 'reconnecting');
        await new Promise((r) => setTimeout(r, backoffMs(attempt)));
        attempt++;
      }
    };

    void run();
    return () => {
      stopped = true;
      controller.abort();
    };
  }, [sessionId, key]);

  const decide = useCallback(
    async (requestId: string, allow: boolean) => {
      setBusy(true);
      setError(null);
      setResolved((prev) => new Set(prev).add(requestId));
      try {
        await postPermission(sessionId, requestId, allow);
      } catch {
        // Put it back: an un-sent decision must not look like a sent one.
        setResolved((prev) => {
          const next = new Set(prev);
          next.delete(requestId);
          return next;
        });
        setError('That didn’t reach the session. Check the tailnet and tap again.');
      } finally {
        setBusy(false);
      }
    },
    [sessionId],
  );

  const steer = useCallback(
    async (text: string) => {
      const activeKey = keyRef.current;
      if (!activeKey || !text.trim()) return;
      setBusy(true);
      setError(null);
      try {
        // Sealed BEFORE it is posted. There is no code path that sends prose.
        const sealed = await sealJson(activeKey, { role: 'user', text });
        await postInput(sessionId, encodeSealed(sealed));
      } catch {
        setError('Couldn’t send that. It’s still in the box — try again.');
        throw new Error('steer failed');
      } finally {
        setBusy(false);
      }
    },
    [sessionId],
  );

  return {
    entries,
    connection,
    gap,
    pending: pendingPermission(entries, resolved),
    busy,
    error,
    decide,
    steer,
  };
}
