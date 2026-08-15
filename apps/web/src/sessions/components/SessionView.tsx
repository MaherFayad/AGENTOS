'use client';

/* =============================================================================
 * components/SessionView.tsx — one session, full screen (§3.1)
 *
 * Layout, top to bottom, and the order is deliberate:
 *
 *   header      who/what/where, plus a back target no smaller than a thumb
 *   banner      the connection, stated honestly — a reconnecting stream says so
 *   transcript  the scroller, and the only thing that grows
 *   dock        the permission card, ALWAYS reachable without scrolling
 *   composer    the steering box, above the home indicator
 *
 * This is the route a push notification deep-links into (§3.6), so it must be
 * usable cold: no key in memory yet, no transcript yet, possibly no network
 * yet. Every one of those states has copy written for it.
 * ========================================================================== */

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PermissionCard } from './PermissionCard';
import { Transcript } from './Transcript';
import { KeyGate } from './KeyGate';
import { useSessionKey } from '../data/useSessionKey';
import { useTranscript } from '../data/useTranscript';
import s from '../sessions.module.css';
import type { ConnectionState } from '../types';

const BANNER: Partial<Record<ConnectionState, string>> = {
  connecting: 'Connecting to the session…',
  reconnecting: 'Reconnecting — you’re seeing everything up to the drop.',
  offline: 'Offline. This is the transcript as of the last connection.',
};

export function SessionView({ sessionId }: { sessionId: string }): React.JSX.Element {
  const { status, key, error: keyError, unlock } = useSessionKey();
  const transcript = useTranscript(sessionId, key);
  const router = useRouter();
  const [draft, setDraft] = useState('');

  if (status === 'checking') return <div className={s.view} aria-busy="true" />;
  if (status === 'locked') return <KeyGate onUnlock={unlock} error={keyError} />;

  const banner = BANNER[transcript.connection];

  const send = async (): Promise<void> => {
    const text = draft.trim();
    if (!text) return;
    // Clear optimistically; `steer` throws on failure and puts it back, so a
    // failed send never silently eats what someone typed on a train.
    setDraft('');
    try {
      await transcript.steer(text);
    } catch {
      setDraft(text);
    }
  };

  return (
    <div className={s.view}>
      <header className={s.viewHeader}>
        <button type="button" className={s.back} onClick={() => router.push('/sessions')}>
          Sessions
        </button>
        <div className={s.viewTitles}>
          <h1 className={s.viewTitle}>Session</h1>
          <p className={s.viewMeta}>
            {sessionId} · billed to your Claude subscription
          </p>
        </div>
      </header>

      {banner ? (
        <p className={s.banner} data-tone={transcript.connection} role="status">
          {banner}
        </p>
      ) : null}

      <Transcript entries={transcript.entries} gap={transcript.gap} />

      {transcript.pending ? (
        <div className={s.dock}>
          <PermissionCard
            request={transcript.pending}
            busy={transcript.busy}
            onDecide={(id, allow) => void transcript.decide(id, allow)}
          />
        </div>
      ) : null}

      {transcript.error ? (
        <p className={s.error} role="alert">
          {transcript.error}
        </p>
      ) : null}

      <form
        className={s.composer}
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <textarea
          className={s.composerInput}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends on a keyboard; on a phone the on-screen return key
            // inserts a newline, which is what a thumb expects.
            if (e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) {
              e.preventDefault();
              void send();
            }
          }}
          rows={1}
          placeholder="Steer this session…"
          aria-label="Message this session"
        />
        <button type="submit" className={s.send} disabled={transcript.busy || !draft.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
