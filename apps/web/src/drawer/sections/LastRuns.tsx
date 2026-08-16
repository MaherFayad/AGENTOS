'use client';

/**
 * `LAST RUNS` — our addition to §2.3, below THE HUMAN, in the same visual grammar.
 *
 * Five rows from `GET /api/metrics/runs?agent=&limit=5` — the **durable** ledger
 * (owner: `observability-engineer`): relative time · status dot · cost · duration.
 * Clicking a row opens its Langfuse trace.
 *
 * Every number here is a real number from a real run, or it is absent. There is no
 * placeholder row, no "—", and no zero standing in for "we don't know" (Part VII.3). The
 * three not-yet states are sentences someone wrote:
 *   loading   — "Looking for recent runs…"
 *   empty     — "No runs yet. …"
 *   failed    — "Couldn't reach the runner …"
 *
 * Owner: drawer-engineer
 */

import { formatCost, formatDuration, relativeTime } from '../data/format';
import type { RunRow } from '../data/types';
import s from '../drawer.module.css';

export type RunsState =
  | { kind: 'loading' }
  | { kind: 'ready'; rows: RunRow[] }
  | { kind: 'failed'; message: string };

/**
 * M8 NOTE — these are now **rendered** strings, not just `title` text. They moved into the
 * accessibility tree to fix the colour-only status defect, which makes them user-facing copy
 * that belongs in `i18n/strings.en.ts`. `check-rtl.mjs` does not flag them: it matches JSX
 * text and attribute literals, and a string in a const map is invisible to it. So this is
 * debt the checker will not remind anyone about — hence the comment.
 * Seven keys, for `rtl-arabic-pdpl-specialist`, alongside the other 10 in `sections/**`.
 */
const STATUS_WORD: Record<RunRow['status'], string> = {
  queued: 'queued',
  ok: 'finished',
  error: 'failed',
  running: 'running',
  'awaiting-approval': 'waiting for approval',
  denied: 'denied',
  canceled: 'canceled',
};

/**
 * The cost cell.
 *
 * A run the ledger never priced (`costSource: 'unpriced'`, which its CHECK constraint ties
 * to `cost_usd IS NULL`) is **not a free run**, so it must not render `$0.00` — and it must
 * not render nothing either, because a blank cell in a column of dollar amounts reads as
 * "cheap" rather than "unknown". It says `unpriced`, dimmer than the numbers around it,
 * with the reason on hover. That is a fact the ledger told us, not an inference.
 *
 * A missing cost with no `costSource` at all — a row from a source that does not report one
 * — still renders nothing, because there we genuinely have not been told anything.
 */
function CostCell({ row }: { row: RunRow }) {
  const cost = formatCost(row.costUsd);
  if (cost) return <span className={s.runMeta}>{cost}</span>;
  if (row.costSource === 'unpriced') {
    return (
      <span className={`${s.runMeta} ${s.runMetaAbsent}`} title="This run was never priced — no token usage was recorded for it. Not the same as costing nothing.">
        unpriced
      </span>
    );
  }
  return null;
}

export function LastRuns({ state }: { state: RunsState }) {
  if (state.kind === 'loading') {
    return <p className={s.empty}>Looking for recent runs…</p>;
  }

  if (state.kind === 'failed') {
    return <p className={s.empty}>Couldn’t reach the runner, so this list is empty rather than wrong. {state.message}</p>;
  }

  if (state.rows.length === 0) {
    return <p className={s.empty}>No runs yet. The first ▶ Run now writes the first row here.</p>;
  }

  return (
    <div className={s.runs}>
      {state.rows.map((row, index) => {
        const when = relativeTime(row.startedAt);
        const duration = formatDuration(row.durationMs);
        const label = `Run ${when ?? 'at an unrecorded time'} — ${STATUS_WORD[row.status]}`;
        const content = (
          <>
            {/* Status is data ink, and data ink alone is not an answer for anyone who is not
             * looking at it. The dot carries the value visually; this text carries the same
             * value to a screen reader. It lives inside `content`, which BOTH branches render,
             * because the branch that actually ships today is the non-link one: `traceUrl` is
             * null on every row while `LANGFUSE_*` is unset, and a <span> with a `title` is
             * neither focusable nor reliably announced. Putting it here rather than on the
             * wrapper also means the <a> branch gets the word into its accessible *name*
             * (name-from-content), not into a `title` description that AT may drop. */}
            <span className={s.dot} data-status={row.status} aria-hidden="true" />
            <span className={s.srOnly}>{STATUS_WORD[row.status]}</span>
            <span className={s.runTime}>{when ?? 'time not recorded'}</span>
            <CostCell row={row} />
            {duration ? <span className={s.runMeta}>{duration}</span> : null}
          </>
        );

        return row.traceUrl ? (
          <a
            key={row.runId ?? `${when}-${index}`}
            className={s.runRow}
            href={row.traceUrl}
            target="_blank"
            rel="noreferrer"
            title={`${label} · open the trace`}
          >
            {content}
          </a>
        ) : (
          <span key={row.runId ?? `${when}-${index}`} className={s.runRow} title={`${label} · no trace was recorded`}>
            {content}
          </span>
        );
      })}
    </div>
  );
}
