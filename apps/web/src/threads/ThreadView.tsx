'use client';

/* =============================================================================
 * ThreadView.tsx — one thread and its turns (`Plan §12`, `Plan §23.8`)
 *
 * `GET /api/p/:project/thread/:id`, which exists and is tested on the runner side
 * with no caller until now. `:id` is an **`ops.thread` uuid and nothing else** —
 * a relay session id keeps its own path at `/p/:project/sessions/:id`, because
 * thread-model §9.1 is answered *no* (ADR-037) and the two namespaces do not map.
 * `ShellRoute` carries `.thread` and `.session` as separate fields with a test
 * that neither ever holds the other's value; this view is the `.thread` half.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * READ-ONLY, ON PURPOSE
 *
 * The mailbox composer — sending a `note` or a `halt` into a *running* thread —
 * is `drawer-engineer`'s surface in the same milestone. Two composers writing to
 * `POST /api/p/:project/thread/:id/message` from two files is the shape this board
 * has paid for four times, so this view renders the mailbox and does not write to
 * it. The one composer here creates *new* threads and lives in the list.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT IS DRAWN, AND THE TWO THINGS THAT ARE NOT
 *
 * - **No title.** thread-model §9.6 closed that: a title is either authored (a
 *   field nobody fills) or derived from the first message — a second copy of the
 *   highest-PII value in the database, in a column that would then travel in every
 *   list payload. The address is the label, drawn by `AddressBadge`.
 * - **No `steer` in the feed, ever.** The route refuses every steer, so no `steer`
 *   message can be persisted; if one appears here it means something bypassed the
 *   route, which is the condition the runner's drain deliberately wedges the
 *   mailbox over. It is rendered as the refusal it is — `InterruptBadge`'s
 *   `deliverable={false}`, in the register's own future-conditional wording —
 *   rather than papered over with a friendlier past tense. A feed row that reads
 *   oddly is the signal; a fluent one would hide it (design-system-guardian,
 *   2026-08-18).
 * ========================================================================== */

import { useMemo } from 'react';
import { projectPath, type InterruptLevel } from '@agnetos/contracts';
import { AddressBadge, InterruptBadge } from '@/components/primitives';
import { useEndpoint } from '@/components/shell/useEndpoint';
import { useProjectSegment } from '@/components/shell';
import { useT } from '@/i18n';
import s from './threads.module.css';
import { addressOfSummary, parseThreadDetail, type ThreadFeed } from './lib/detail';

const POLL_MS = 6000;

export function ThreadView({ threadId }: { threadId: string }): React.JSX.Element {
  const t = useT();
  const project = useProjectSegment();

  const url = useMemo(() => {
    if (project === null) return null;
    try {
      return `${projectPath('/api/p/:project/thread/:id', project).replace(
        ':id',
        encodeURIComponent(threadId),
      )}`;
    } catch {
      return null;
    }
  }, [project, threadId]);

  const feed = useEndpoint<ThreadFeed>(url, {
    intervalMs: POLL_MS,
    noTargetMessage: t('threads.one.noProject'),
    parse: parseThreadDetail,
    notBuiltMessage: t('threads.one.notFound'),
    // A route that answers is not a route that is missing. Saying "not found"
    // here would send a reader to look for a thread when the bug is ours —
    // exactly the conflation `useEndpoint` documents at length.
    malformedMessage: t('threads.one.malformed'),
    offlineMessage: t('threads.one.offline'),
  });

  return (
    <div className={s.view}>
      <div className={s.threadHead}>
        <span className={`u-eyebrow ${s.eyebrow}`}>{t('threads.one.eyebrow')}</span>
        {feed.state === 'ready' && (
          <div className={s.previewRow}>
            {/* No `cost` prop: a thread that already exists is not a spend
                decision and should not wear a price tag. `null` is a session
                thread, which the grammar has no sigil for — see `detail.ts`. */}
            {(() => {
              const address = addressOfSummary(feed.data.thread);
              return address === null ? null : <AddressBadge address={address} />;
            })()}
            <span className={s.rowMeta}>{t(STATE_KEY[feed.data.thread.state])}</span>
          </div>
        )}
      </div>

      <div className={s.scroll}>
        {feed.state === 'loading' && <p className={s.notice}>{t('threads.one.loading')}</p>}

        {feed.state === 'unavailable' && (
          <p className={s.notice}>
            <span className={s.noticeTitle}>{t('threads.one.unavailableTitle')}</span>
            {feed.message}
          </p>
        )}

        {feed.state === 'ready' && feed.data.messages.length === 0 && (
          <p className={s.notice}>
            <span className={s.noticeTitle}>{t('threads.one.emptyTitle')}</span>
            {t('threads.one.empty')}
          </p>
        )}

        {feed.state === 'ready' && feed.data.messages.length > 0 && (
          <div className={s.messages}>
            {feed.data.messages.map((message) => (
              <article key={message.id} className={s.message}>
                <div className={s.messageHead}>
                  {/* An author is a slug (`sales/account-enrichment`) sitting in a
                      row of translated chrome. `<bdi>` so the run resolves by its
                      own first strong character instead of by its neighbour —
                      the same answer `AddressBadge` and `ProvenanceBadge` give. */}
                  <bdi>{message.author}</bdi>
                  <span className={s.sep} aria-hidden="true">
                    ·
                  </span>
                  <span>{t(KIND_KEY[message.kind])}</span>
                  {message.interrupt !== null && <Level level={message.interrupt} />}
                  {message.deliveredAt === null && (
                    <span className={s.sep}>{t('threads.one.inMailbox')}</span>
                  )}
                </div>
                {/* `dir="auto"` — THE ONE PLACE IN THIS APP THAT SETS IT, and the
                    reason is that this is the only element whose direction is not
                    the app's to decide. A message body is written by a person or by
                    a model, in whatever language they used, and an English sentence
                    laid out at the page's RTL base direction gets its full stop
                    moved to the wrong end. `dir="auto"` resolves per element from
                    its own first strong character, which is exactly the question
                    being asked. `elementDirection()` reads `dir="auto"` as `ltr`
                    and says so; nothing keyboard-driven lives inside this element,
                    so that resolution is never consulted here. */}
                <p className={s.messageBody} dir="auto">
                  {message.body}
                </p>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * `steer` can only reach this feed if something bypassed the route. Drawn as the
 * refusal it is, in the register's own words — see the header note.
 */
function Level({ level }: { level: InterruptLevel }): React.JSX.Element {
  return level === 'steer' ? (
    <InterruptBadge level="steer" deliverable={false} size="sm" />
  ) : (
    <InterruptBadge level={level} size="sm" />
  );
}

const STATE_KEY = {
  open: 'threads.state.open',
  running: 'threads.state.running',
  waiting: 'threads.state.waiting',
  closed: 'threads.state.closed',
  failed: 'threads.state.failed',
} as const;

const KIND_KEY = {
  human: 'threads.kind.human',
  agent: 'threads.kind.agent',
  question: 'threads.kind.question',
  answer: 'threads.kind.answer',
  system: 'threads.kind.system',
} as const;
