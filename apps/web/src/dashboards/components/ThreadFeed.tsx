'use client';

import type { ActivityRow, ThreadFeedWidget } from '@agnetos/contracts';
import { formatClock, formatCount, interpolate } from '../lib/format';
import { groupByThread, toActivityRows, unthreadedCount } from '../lib/rows';
import { EmptyLine } from './states';
import { QueryGate, WidgetChrome } from './widget-chrome';

/**
 * `thread-feed` (ADR-028 · `Plan §23.7`) — the activity feed's rows, grouped by the thread
 * they belong to. The grouping is the widget: no arrangement of the canonical seven can
 * group, which is the whole reason this is a type rather than a composition.
 *
 * **It has nothing to render and says so precisely.** `ops.agent_runs.thread_id` is
 * nullable, no writer sets it, and the table is empty because zero runs have executed
 * (`thread-model.md` §5.3). Two emptinesses sit on top of each other and this widget can
 * tell them apart, so it does:
 *
 *   no rows at all          → `emptyState`
 *   rows, none with a thread → `unthreadedState`, carrying the count it observed
 *
 * The second is the one that will be true for the whole window between the first real run
 * and the first threaded run, and it is the one that stops a reader concluding something
 * about *their* thread from a fact about the writer.
 *
 * **Every sentence comes from the panel JSON.** Not a style preference: dashboards are data
 * (§2.5), and copy in a data file is copy that a translator and a panel author can both
 * reach. There is no English literal in this file.
 *
 * The group header is a truncated thread id, deliberately not a name. A thread carries no
 * title (`thread-model.md` §9.6, answered *no, not in M16*), and deriving one from a
 * message body would put `ops.message.body` — the highest-PII value in the database (§7.1)
 * — into a dashboard payload.
 *
 * Owner: dashboards-engineer · ADR-028 · §2.5.5
 */
export function ThreadFeed({ widget }: { widget: ThreadFeedWidget }): React.JSX.Element {
  const limit = widget.limit ?? 12;
  return (
    <WidgetChrome title={widget.title} subtitle={widget.subtitle} span={widget.span}>
      <QueryGate query={widget.query} emptyState={widget.emptyState} height={220}>
        {(data) => {
          const rows = toActivityRows(data).slice(0, limit);
          const groups = groupByThread(rows);

          if (groups.length === 0) return <EmptyLine>{emptyCopyFor(widget, rows)}</EmptyLine>;

          return (
            <ol className="flex flex-col gap-4">
              {groups.map((group) => (
                <li key={group.threadId} className="flex flex-col gap-2">
                  {/* Wide-tracked caps, monochrome: an id is chrome, not data ink. The
                      tracking utility is the one `rtl.css` un-tracks under :lang(ar). */}
                  <p
                    className="text-label uppercase tracking-wider-2 tabular-nums text-ink-2"
                    title={group.threadId}
                  >
                    {shortThreadId(group.threadId)}
                  </p>
                  <ol className="flex flex-col gap-3">
                    {group.rows.map((row, i) => (
                      <li key={`${row.at}-${i}`} className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
                        <time className="text-meta tabular-nums text-ink-2" dateTime={row.at}>
                          {formatClock(row.at) ?? '—'}
                        </time>
                        <p className="text-small text-ivory">
                          <span className="font-semibold">{row.event}</span>
                          {row.detail ? <span className="font-normal text-ivory-2"> · {row.detail}</span> : null}
                          <span className="text-ink-2"> — {row.attribution}</span>
                        </p>
                      </li>
                    ))}
                  </ol>
                </li>
              ))}
            </ol>
          );
        }}
      </QueryGate>
    </WidgetChrome>
  );
}

/**
 * Which of the two emptinesses this is — the honest-empty-state rule, as a function, so it
 * is checkable without a browser.
 *
 * `[]` means *nothing arrived*. Rows that all lack a `threadId` mean *things happened and
 * the writer does not record threads*, which is the true state today and stays true for the
 * whole window between the first real run and the first threaded one. Collapsing the two
 * would let the widget tell a reader their thread is quiet when nothing was ever asked of
 * it. The number in the second sentence is counted from the payload, never declared.
 */
export function emptyCopyFor(
  widget: Pick<ThreadFeedWidget, 'emptyState' | 'unthreadedState'>,
  rows: readonly ActivityRow[],
): string {
  if (rows.length === 0) return widget.emptyState;
  // `interpolate` returns null only when a sentence needs a number it was not given; the
  // count is always real here, so the fallback is a whole sentence rather than one with a
  // `{value}` hole in it.
  return interpolate(widget.unthreadedState, formatCount(unthreadedCount(rows))) ?? widget.emptyState;
}

/**
 * A uuid is not readable and a full one is not useful in a 1-column card. The first
 * segment identifies a thread well enough to match it against the THREADS view, and the
 * whole id stays in `title` so nothing is lost — truncation in the render, never in the
 * data.
 */
export function shortThreadId(id: string): string {
  return id.split('-')[0].slice(0, 8);
}
