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
 *   AGENT THREADS  `ops.thread` rows, read from `GET /api/p/:project/threads`.
 *                  **Readable as of the ADR-042 session**, when that route landed and
 *                  `0008_threads.sql` met a running Postgres for the first time. Both
 *                  halves of the old notice — "no collection route" and "no database
 *                  that has ever run" — are now false, so the notice is gone rather
 *                  than softened: a view explaining an absence that ended is the same
 *                  defect as a view inventing data (BOARD rule 9), pointed backwards.
 *
 *                  What replaced it still distinguishes the four states the old
 *                  sentence collapsed: loading, unreachable, drifted, and a real
 *                  zero. `unknown` is not `zero`, and only one of those four is a
 *                  count.
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
import Link from 'next/link';
import { projectPath } from '@agnetos/contracts';
import { useProjectSegment, useShell } from '@/components/shell';
import { useEndpoint } from '@/components/shell/useEndpoint';
import { useT } from '@/i18n';
import { SessionsTab } from '@/sessions';
import { AddressComposer } from './AddressComposer';
import { parseThreadList, type ThreadList, type ThreadListRow } from './lib/list';
import { rosterFrom } from './lib/roster';
import s from './threads.module.css';

/** Matches the drawer's LAST RUNS cadence — a thread list is not a live console. */
const POLL_MS = 15_000;

export function ThreadsView({ composeRequested = false }: { composeRequested?: boolean }): React.JSX.Element {
  const t = useT();
  const { search } = useShell();
  const project = useProjectSegment();

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

  const url = useMemo(() => {
    if (project === null) return null;
    try {
      return projectPath('/api/p/:project/threads', project);
    } catch {
      return null;
    }
  }, [project]);

  const list = useEndpoint<ThreadList>(url, {
    intervalMs: POLL_MS,
    noTargetMessage: t('threads.agent.noProject'),
    parse: parseThreadList,
    // A 404 here is the runner not serving the route on THIS box — the route is declared
    // in the contract, so it is a reachability fact, not a missing feature. Saying
    // "not built" would send a reader to look for work that is already done.
    notBuiltMessage: t('threads.agent.notBuilt'),
    malformedMessage: t('threads.agent.malformed'),
    offlineMessage: t('threads.agent.offline'),
  });

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
          {/* Four states, kept apart on purpose. The one that used to be missing is
              the last: a real zero, which only the `ready` branch can produce, and
              which reads differently from every failure above it. */}
          {list.state === 'loading' && <p className={s.notice}>{t('threads.agent.loading')}</p>}
          {list.state === 'unavailable' && <p className={s.notice}>{list.message}</p>}
          {list.state === 'ready' && list.data.threads.length === 0 && (
            <p className={s.notice}>{t('threads.agent.empty')}</p>
          )}
          {list.state === 'ready' && list.data.threads.length > 0 && (
            <>
              {/* `.rows` / `.row` / `.rowBody` are the classes this stylesheet already
                  carries for exactly this list, hover and focus states included. Adding a
                  parallel set would give the two thread groups two different row designs
                  on one screen. */}
              <ul className={s.rows}>
                {list.data.threads.map((row: ThreadListRow) => (
                  <li key={row.id}>
                    <Link
                      className={s.row}
                      href={project === null ? '#' : `${projectPath('/p/:project/threads', project)}/${row.id}`}
                    >
                      <span className={s.rowBody}>
                        {/* The address IS the label. No title, no first-message excerpt —
                            `lib/list.ts` records why nothing a person typed crosses this
                            boundary, and composing the label here is what
                            `thread-model.md` §9.6 meant by "a label is a view concern". */}
                        <span className={s.rowName}>{row.addressedTo}</span>
                        <span className={s.rowMeta}>
                          <span className={`u-label ${s.eyebrow}`}>{row.state}</span>
                          {/* Decorative. `--ink-3` fails AA, so the contrast gate requires it be hidden
                              from the accessibility tree rather than merely small. */}
                          <span className={s.sep} aria-hidden="true">·</span>
                          <span className={`u-label ${s.eyebrow}`}>{t('threads.agent.turnsLabel')}</span>
                          <span>{row.messageCount}</span>
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              {list.data.total > list.data.threads.length && (
                <p className={s.notice}>
                  {t('threads.agent.truncated', {
                    shown: String(list.data.threads.length),
                    total: String(list.data.total),
                  })}
                </p>
              )}
            </>
          )}
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
