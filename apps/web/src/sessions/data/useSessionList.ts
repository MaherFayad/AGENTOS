'use client';

/* =============================================================================
 * data/useSessionList.ts — the list, decrypted here and nowhere else (§3.1)
 *
 * The shape of this hook is dictated by the threat model, not by taste:
 *
 *   fetch ciphertext rows  →  decrypt IN THIS FUNCTION  →  sort  →  render
 *
 * The relay cannot sort by state, filter by repo or search by name, because it
 * cannot read any of them (ADR-005 consequence 1). Every one of those verbs
 * happens after the `openJson` call below.
 *
 * A row we cannot decrypt is COUNTED, not hidden. Silently dropping it would
 * turn "you are looking at a different key" into "you have fewer sessions than
 * you thought", which is the kind of quiet lie standing rule 9 exists to stop.
 * ========================================================================== */

import { useCallback, useEffect, useRef, useState } from 'react';
import { openJson, parseSealed } from '@/lib/e2e';
import { ClientError, fetchSessions } from '../relay/client';
import { toSessionMeta } from '../relay/happy-adapter';
import { sortSessions } from '../lib/sort';
import type { DecryptedSession } from '../types';

export type ListState =
  | { state: 'loading' }
  | { state: 'ready'; sessions: DecryptedSession[]; undecryptable: number }
  | { state: 'unavailable'; message: string };

/** Four seconds: fast enough that a permission prompt surfaces while you are
 *  still holding the phone, slow enough that a sleeping device isn't punished. */
const POLL_MS = 4000;

export function useSessionList(key: CryptoKey | null): {
  list: ListState;
  refresh: () => void;
} {
  const [list, setList] = useState<ListState>({ state: 'loading' });
  const keyRef = useRef(key);
  keyRef.current = key;

  const read = useCallback(async (signal: AbortSignal) => {
    const activeKey = keyRef.current;
    if (!activeKey) return;

    try {
      const envelopes = await fetchSessions(signal);

      /* ---- THE DECRYPTION BOUNDARY, client side. See lib/e2e.ts. ---------- */
      const sessions: DecryptedSession[] = [];
      let undecryptable = 0;
      for (const envelope of envelopes) {
        try {
          const meta = await openJson<unknown>(activeKey, parseSealed(envelope.encryptedMetadata));
          sessions.push({ envelope, meta: toSessionMeta(meta, envelope) });
        } catch {
          undecryptable++;
        }
      }
      /* --------------------------------------------------------------------- */

      if (signal.aborted) return;
      setList({ state: 'ready', sessions: sortSessions(sessions), undecryptable });
    } catch (err) {
      if (signal.aborted) return;
      setList({
        state: 'unavailable',
        message:
          err instanceof ClientError
            ? err.hint
            : 'Can’t reach the session relay. You’re probably off the tailnet.',
      });
    }
  }, []);

  const [nonce, setNonce] = useState(0);
  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    void read(controller.signal);

    const tick = (): void => {
      if (document.hidden) return;
      void read(controller.signal);
    };
    const timer = setInterval(tick, POLL_MS);

    // A phone that wakes in your hand should not show a four-second-old list,
    // and a phone that wakes on a train should re-check the moment it has
    // signal rather than on the next tick.
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('online', tick);

    return () => {
      controller.abort();
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('online', tick);
    };
  }, [key, read, nonce]);

  return { list, refresh };
}

/** A clock for the elapsed column. One interval for the whole list, not one
 *  per row — sixty timers on a phone is a battery bug wearing a UI costume. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      if (!document.hidden) setNow(Date.now());
    }, intervalMs);
    const wake = (): void => setNow(Date.now());
    document.addEventListener('visibilitychange', wake);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', wake);
    };
  }, [intervalMs]);
  return now;
}
