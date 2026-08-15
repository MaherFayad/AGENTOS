'use client';

/**
 * `LAST RUNS` — our addition to §2.3, below THE HUMAN, in the same visual grammar.
 *
 * Five rows from `GET /api/runs?agent=&limit=5` (owner: `observability-engineer`):
 * relative time · status dot · cost · duration. Clicking a row opens its Langfuse trace.
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

const STATUS_WORD: Record<RunRow['status'], string> = {
  ok: 'finished',
  error: 'failed',
  running: 'running',
  'awaiting-approval': 'waiting for approval',
};

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
        const when = row.relativeTime ?? relativeTime(row.startedAt);
        const cost = formatCost(row.costUsd);
        const duration = formatDuration(row.durationMs);
        const label = `Run ${when ?? 'at an unrecorded time'} — ${STATUS_WORD[row.status]}`;
        const content = (
          <>
            <span className={s.dot} data-status={row.status} aria-hidden="true" />
            <span className={s.runTime}>{when ?? 'time not recorded'}</span>
            {cost ? <span className={s.runMeta}>{cost}</span> : null}
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
