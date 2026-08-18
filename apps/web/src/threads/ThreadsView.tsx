'use client';

/* =============================================================================
 * ThreadsView.tsx — the fourth tab (`Plan §23.5`, `Plan §23.8`)
 *
 * *"THREADS — replaces SESSIONS. Thread list grouped by project and kind, with
 * the addressing composer."*
 *
 * The project is the route (`/p/:project/threads`, ADR-015), so the grouping this
 * view can actually make is **by kind**, and there are two kinds it can show:
 *
 *   SESSIONS       relay sessions, decrypted in this browser and nowhere else.
 *                  Real today. This is the screen that used to live at
 *                  `/sessions`, mounted here unchanged.
 *   AGENT THREADS  `ops.thread` rows. **Not readable in this build** — the runner
 *                  declares no collection route and the table has never met a
 *                  running Postgres. Said in as many words rather than drawn as an
 *                  empty list: an unreadable list and an empty one are different
 *                  claims and only one of them is true (BOARD rule 9).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE TWO GROUPS ARE MERGED IN THE BROWSER AND NEVER ON THE SERVER
 *
 * A session's name, repo, model, state and cost live inside `encryptedMetadata`
 * and the relay cannot read any of them (ADR-005 consequence 1, CLAUDE.md rule 5).
 * A server-side "list of all threads including sessions" would have to decrypt to
 * produce a single row, which is the one design this feature refuses on sight. So
 * the merge is two independent reads composed after the decryption boundary, and
 * `useSessionList` keeps that boundary exactly where it was.
 *
 * That is also why the session group cannot show a mailbox depth: thread-model
 * §9.1 is answered **no** (ADR-037) — a session thread holds no `ops.message`
 * rows at all, so there is no depth to render, not a depth of zero.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TWO POTS OF MONEY, NEVER ONE TYPEFACE
 *
 * An interactive session bills to the human's **Claude subscription** (Happy wraps
 * the CLI); an agent thread's runs bill to the runner's capped API-key workspace
 * (Part V). The header says which, because two different pots rendered the same
 * way is how a budget gets misread — and the composer's preview deliberately
 * carries a *run count* and no money at all, so there is nothing here to confuse
 * with the session cost column.
 * ========================================================================== */

import { useMemo } from 'react';
import { useShell } from '@/components/shell';
import { useT } from '@/i18n';
import { SessionsTab } from '@/sessions';
import { AddressComposer } from './AddressComposer';
import { rosterFrom } from './lib/roster';
import s from './threads.module.css';

export function ThreadsView({ composeRequested = false }: { composeRequested?: boolean }): React.JSX.Element {
  const t = useT();
  const { search } = useShell();

  /**
   * Counted only when the index actually loaded.
   *
   * `search.message === null` is the shell's own "nothing is wrong" signal, and an
   * index that failed to load carries a sentence and no items — which looks
   * exactly like a project with no agents. Only one of those is a number, and
   * `rosterFrom` refuses to produce one from the other.
   */
  const roster = useMemo(
    () => rosterFrom(search.items, search.message === null && search.items.length > 0),
    [search.items, search.message],
  );

  return (
    <div className={s.view}>
      <header className={s.header}>
        <span className={`u-eyebrow ${s.eyebrow}`}>{t('threads.eyebrow')}</span>
      </header>
      <p className={s.billingNote}>{t('threads.billing')}</p>

      <div className={s.scroll}>
        <section className={s.group} aria-labelledby="threads-agent-group">
          <div className={s.groupHead}>
            <span id="threads-agent-group" className={`u-label ${s.eyebrow}`}>
              {t('threads.group.agent')}
            </span>
          </div>
          {/* No fetch behind this. See `lib/threadListRoute.ts`: the runner
              declares no collection route, and calling one that was never
              declared would put a permanent 404 excuse into `smoke:browser`. The
              sentence names BOTH reasons — no route, and no database that has ever
              run — because fixing either alone leaves the list empty and the next
              reader gets told a new story. */}
          <p className={s.notice}>
            <span className={s.noticeTitle}>{t('threads.agent.unreadableTitle')}</span>
            {t('threads.agent.unreadable')}
          </p>
        </section>

        <section className={s.group}>
          {/* The session list, mounted unchanged. It brings its own eyebrow, which
              is this group's heading, and its own key gate — the decryption
              boundary moves nowhere. */}
          <SessionsTab />
        </section>
      </div>

      <AddressComposer roster={roster} autoFocus={composeRequested} />
    </div>
  );
}
