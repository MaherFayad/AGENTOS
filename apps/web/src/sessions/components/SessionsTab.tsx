'use client';

/* =============================================================================
 * components/SessionsTab.tsx — the fourth tab (spec §3.1)
 *
 * One row per session: name, repo, model, state, elapsed, cost — sorted with
 * `waiting on permission` first, because that is the state that is costing the
 * human time (`lib/sort.ts`).
 *
 * The whole tab is monochrome except two things, and both of them are data ink:
 * the status dot and the border of a row that is waiting on you (§1.3).
 *
 * The cost shown here is the HUMAN'S CLAUDE SUBSCRIPTION (Part V) — Happy wraps
 * the CLI, so an interactive session spends their subscription, not the
 * runner's capped API-key workspace. The header says so, because two different
 * pots of money rendered in the same typeface is how a budget gets misread.
 * ========================================================================== */

import { useRouter } from 'next/navigation';
import { formatCost, formatElapsed, shortenRepo } from '../lib/format';
import { countWaiting, stateLabel } from '../lib/sort';
import { useNow, useSessionList } from '../data/useSessionList';
import { useSessionKey } from '../data/useSessionKey';
import { KeyGate } from './KeyGate';
import s from '../sessions.module.css';
import type { DecryptedSession } from '../types';

export function SessionsTab(): React.JSX.Element {
  const { status, key, error, unlock } = useSessionKey();
  const { list } = useSessionList(key);
  const now = useNow();
  const router = useRouter();

  if (status === 'checking') {
    // One frame of nothing beats a spinner that flashes: the key lookup is a
    // single IndexedDB read.
    return <div className={s.tab} aria-busy="true" />;
  }
  if (status === 'locked') return <KeyGate onUnlock={unlock} error={error} />;

  const waiting = list.state === 'ready' ? countWaiting(list.sessions) : 0;

  return (
    <div className={s.tab}>
      <header className={s.header}>
        <span className={s.eyebrow}>SESSIONS</span>
        {waiting > 0 ? (
          <span className={s.waitingCount}>{waiting} waiting on you</span>
        ) : null}
      </header>

      <div className={s.list} role="list">
        {list.state === 'loading' ? <p className={s.empty}>Reading the relay…</p> : null}

        {list.state === 'unavailable' ? (
          <p className={s.empty}>
            <span className={s.emptyTitle}>No answer from the relay</span>
            {list.message}
          </p>
        ) : null}

        {list.state === 'ready' && list.sessions.length === 0 ? (
          <p className={s.empty}>
            <span className={s.emptyTitle}>Nothing is running</span>
            Start a Claude Code session on any machine paired with this relay and it will
            appear here — with its transcript, and with a button to answer its permission
            prompts from wherever you are.
            {list.undecryptable > 0 ? (
              <span className={s.emptyHint}>
                {list.undecryptable} session{list.undecryptable === 1 ? '' : 's'} on the relay
                could not be decrypted with this device’s key.
              </span>
            ) : null}
          </p>
        ) : null}

        {list.state === 'ready'
          ? list.sessions.map((session) => (
              <SessionRow
                key={session.envelope.id}
                session={session}
                now={now}
                onOpen={() => router.push(`/sessions/${encodeURIComponent(session.envelope.id)}`)}
              />
            ))
          : null}

        {list.state === 'ready' && list.sessions.length > 0 && list.undecryptable > 0 ? (
          <p className={s.emptyHint}>
            {list.undecryptable} more session{list.undecryptable === 1 ? '' : 's'} on the relay
            could not be decrypted with this device’s key.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function SessionRow({
  session,
  now,
  onOpen,
}: {
  session: DecryptedSession;
  now: number;
  onOpen: () => void;
}): React.JSX.Element {
  const { meta, envelope } = session;
  const label = stateLabel(meta.state);

  return (
    <button
      type="button"
      role="listitem"
      className={s.row}
      data-state={meta.state}
      onClick={onOpen}
      // The whole row is one target, ~64px tall. On a phone that matters more
      // than any hover affordance, which a thumb never gets anyway.
      aria-label={`${meta.name}, ${label}, ${formatCost(meta.costUsd)}`}
    >
      <span className={s.dot} data-state={meta.state} aria-hidden="true" />

      <span className={s.rowBody}>
        <span className={s.rowName}>{meta.name}</span>
        <span className={s.rowMeta}>
          <span>{shortenRepo(meta.repo)}</span>
          <span className={s.sep} aria-hidden="true">
            ·
          </span>
          <span>{meta.model}</span>
          <span className={s.sep} aria-hidden="true">
            ·
          </span>
          <span>{label}</span>
        </span>
      </span>

      <span className={s.rowNumbers}>
        <span className={s.elapsed}>{formatElapsed(now - meta.startedAt)}</span>
        <span className={s.cost}>{formatCost(meta.costUsd)}</span>
      </span>
    </button>
  );
}
