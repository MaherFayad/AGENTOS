'use client';

/* =============================================================================
 * components/SessionsTab.tsx — the session group (spec §3.1)
 *
 * **It is no longer a tab, and it is no longer a page.** M16 gave the fourth slot
 * to THREADS (`Plan §23.5`), and this component now mounts as the *session
 * threads* group inside `ThreadsView`. `/p/:project/sessions` redirects there.
 * The name is kept because renaming a file is two paths in a diff and no reader's
 * question is answered by it; what changed is the layout, which no longer claims
 * the viewport height or its own scroller — the THREADS view owns both, and two
 * nested scrollers on a phone is a list you cannot reach the bottom of.
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
import { useT } from '@/i18n';
import { useProjectHref } from '@/components/shell/useProjectHref';
import { formatCost, formatElapsed, shortenRepo } from '../lib/format';
import { countWaiting } from '../lib/sort';
import { STATE_KEY } from '../lib/stateKey';
import { useNow, useSessionList } from '../data/useSessionList';
import { useSessionKey } from '../data/useSessionKey';
import { KeyGate } from './KeyGate';
import { PushSettings } from './PushSettings';
import s from '../sessions.module.css';
import type { DecryptedSession } from '../types';

export function SessionsTab(): React.JSX.Element {
  const t = useT();
  const { status, key, error, unlock } = useSessionKey();
  const { list } = useSessionList(key);
  const now = useNow();
  const router = useRouter();
  // M15: a session belongs to a project — which library its agents resolve from and
  // which account pays for it (`Plan §11`) — so its route carries one.
  const href = useProjectHref();

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
        <span className={`u-eyebrow ${s.eyebrow}`}>{t('sessions.eyebrow')}</span>
        {waiting > 0 ? (
          <span className={`u-nums ${s.waitingCount}`}>
            {t('sessions.waiting', { count: waiting })}
          </span>
        ) : null}
      </header>
      <p className={s.billingNote}>{t('sessions.billing')}</p>

      <div className={s.list} role="list">
        {list.state === 'loading' ? (
          <p className={s.empty}>{t('sessions.list.loading')}</p>
        ) : null}

        {list.state === 'unavailable' ? (
          <p className={s.empty}>
            <span className={s.emptyTitle}>{t('empty.relay.title')}</span>
            {list.message || t('empty.relay.body')}
          </p>
        ) : null}

        {list.state === 'ready' && list.sessions.length === 0 ? (
          <p className={s.empty}>
            <span className={s.emptyTitle}>{t('empty.sessions.title')}</span>
            {t('empty.sessions.body')}
            {list.undecryptable > 0 ? (
              <span className={s.emptyHint}>
                {t('sessions.list.undecryptable', { count: list.undecryptable })}
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
                onOpen={() => router.push(href(`/sessions/${encodeURIComponent(session.envelope.id)}`))}
              />
            ))
          : null}

        {list.state === 'ready' && list.sessions.length > 0 && list.undecryptable > 0 ? (
          <p className={s.emptyHint}>
            {t('sessions.list.undecryptable', { count: list.undecryptable })}
          </p>
        ) : null}
      </div>

      <PushSettings />
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
  const t = useT();
  const { meta } = session;
  const label = t(STATE_KEY[meta.state]);

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

      {/* Durations and money are LTR islands inside an RTL line (§1.4) —
          `.u-nums` isolates them so "$1.20" never renders as "1.20$". */}
      <span className={`u-nums ${s.rowNumbers}`}>
        <span className={s.elapsed}>{formatElapsed(now - meta.startedAt)}</span>
        <span className={s.cost}>{formatCost(meta.costUsd)}</span>
      </span>
    </button>
  );
}
