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
import { useT, type StringKey } from '@/i18n';
import { PermissionCard } from './PermissionCard';
import { Transcript } from './Transcript';
import { KeyGate } from './KeyGate';
import { useSessionKey } from '../data/useSessionKey';
import { useTranscript } from '../data/useTranscript';
import s from '../sessions.module.css';
import type { ConnectionState } from '../types';

/** Connection states that have something honest to say. `open` says nothing. */
const BANNER: Partial<Record<ConnectionState, StringKey>> = {
  connecting: 'sessions.connection.connecting',
  reconnecting: 'sessions.connection.reconnecting',
  offline: 'sessions.connection.offline',
};

export function SessionView({ sessionId }: { sessionId: string }): React.JSX.Element {
  const t = useT();
  const { status, key, error: keyError, unlock } = useSessionKey();
  const transcript = useTranscript(sessionId, key);
  const router = useRouter();
  const [draft, setDraft] = useState('');

  if (status === 'checking') return <div className={s.view} aria-busy="true" />;
  if (status === 'locked') return <KeyGate onUnlock={unlock} error={keyError} />;

  const bannerKey = BANNER[transcript.connection];

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
        <button
          type="button"
          className={`u-tab ${s.back}`}
          onClick={() => router.push('/sessions')}
        >
          {t('sessions.view.back')}
        </button>
        <div className={s.viewTitles}>
          <h1 className={s.viewTitle}>{t('sessions.view.title')}</h1>
          <p className={s.viewMeta}>{t('sessions.view.meta', { id: sessionId })}</p>
        </div>
      </header>

      {bannerKey ? (
        <p className={s.banner} data-tone={transcript.connection} role="status">
          {t(bannerKey)}
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
          placeholder={t('sessions.compose.placeholder')}
          aria-label={t('sessions.compose.label')}
        />
        <button type="submit" className={s.send} disabled={transcript.busy || !draft.trim()}>
          {t('sessions.compose.send')}
        </button>
      </form>
    </div>
  );
}
