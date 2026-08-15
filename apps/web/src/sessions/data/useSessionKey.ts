'use client';

/* =============================================================================
 * data/useSessionKey.ts — unlocking this device (spec §3.1, ADR-005)
 *
 * The key lives in the browser and only in the browser. This hook is the only
 * place the app asks for it, and it hands back a `CryptoKey` handle that
 * `crypto.subtle` will not export (see `lib/e2e.ts` for why that matters).
 *
 * Nothing in this file writes the secret, the key, or anything derived from
 * them to the network. There is no telemetry hook here on purpose: a Langfuse
 * span around an unlock is exactly how a recovery secret ends up in a trace.
 * ========================================================================== */

import { useCallback, useEffect, useState } from 'react';
import {
  assertNonExtractable,
  deriveSessionKey,
  forgetSessionKey,
  loadSessionKey,
  persistSessionKey,
} from '@/lib/e2e';

export type KeyStatus = 'checking' | 'locked' | 'unlocked';

export interface SessionKey {
  status: KeyStatus;
  key: CryptoKey | null;
  /** Written for a human on a phone, shown verbatim. */
  error: string | null;
  unlock: (recoverySecret: string) => Promise<void>;
  lock: () => Promise<void>;
}

/**
 * The salt is DETERMINISTIC, and that is a considered trade.
 *
 * A random per-device salt would be textbook, and would also mean the same
 * recovery secret produced a different key on your phone than on your laptop —
 * i.e. transcripts that decrypt on one device and not the other. The input here
 * is not a human-chosen password: it is the machine-generated secret Happy
 * issues when you pair a machine. Its entropy is the defence; the salt's job
 * (making one rainbow table useless against many users) is moot for a
 * single-human tailnet install.
 *
 * So: SHA-256 of a fixed context string, 32 bytes, the same everywhere. The
 * iteration count still applies, and it is the OWASP floor.
 */
async function sessionSalt(): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode('agnetos/sessions/salt/v1'),
  );
  return new Uint8Array(digest);
}

export function useSessionKey(): SessionKey {
  const [status, setStatus] = useState<KeyStatus>('checking');
  const [key, setKey] = useState<CryptoKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  // A device that has been unlocked before stays unlocked: the handle is in
  // IndexedDB and the material never left the platform's crypto store.
  useEffect(() => {
    let live = true;
    void loadSessionKey().then((existing) => {
      if (!live) return;
      if (existing) {
        assertNonExtractable(existing);
        setKey(existing);
        setStatus('unlocked');
      } else {
        setStatus('locked');
      }
    });
    return () => {
      live = false;
    };
  }, []);

  const unlock = useCallback(async (recoverySecret: string) => {
    setError(null);
    const secret = recoverySecret.trim();
    if (!secret) {
      setError('Paste the recovery secret from `happy auth` on the machine running Claude.');
      return;
    }
    try {
      const derived = await deriveSessionKey(secret, await sessionSalt());
      assertNonExtractable(derived);
      await persistSessionKey(derived);
      setKey(derived);
      setStatus('unlocked');
    } catch {
      // Deliberately vague about *why*: the failure modes here are "wrong
      // secret" and "this browser has no WebCrypto", and neither is worth
      // echoing the input back onto a screen someone may be holding in public.
      setError('That secret didn’t unlock anything. Check you copied all of it.');
    }
  }, []);

  const lock = useCallback(async () => {
    await forgetSessionKey();
    setKey(null);
    setStatus('locked');
  }, []);

  return { status, key, error, unlock, lock };
}
