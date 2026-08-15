import type { PhaseProgress } from '../types';
import type { PhaseColumn, TierRow } from '../model/taxonomy';
import { IconSquare } from './JobIcon';
import { ProgressDashes } from './ProgressDashes';

/**
 * §2.6.3 — the two header bands of the matrix.
 *
 * Both carry a derived number: the row header a jobs-count pill (display chrome only —
 * not a control; count is announced via the rowheader aria-label), the column header the
 * 4-segment progress dashes. Neither number is ever passed in as a literal.
 */

export function TierRowHeader({ row, count }: { row: TierRow; count: number }) {
  return (
    <div
      role="rowheader"
      data-testid="chart-tier-row-header"
      aria-label={`${row.full} — ${count} ${count === 1 ? 'job' : 'jobs'}`}
      className="flex items-center gap-2 border-b border-r border-line px-3 py-2.5"
    >
      <IconSquare name={row.icon} />
      <span className="min-w-0 flex-1">
        <span className="block text-meta font-semibold leading-tight text-ivory">{row.label}</span>
        <span className="mt-0.5 block text-chip font-normal leading-tight text-ink-3">{row.gloss}</span>
      </span>
      <span
        aria-hidden
        className="inline-flex h-8 select-none items-center justify-center rounded-pill border border-line-2 bg-transparent px-3 font-sans text-pill text-ivory"
      >
        <span className="tabular-nums">{count}</span>
      </span>
    </div>
  );
}

export function PhaseColumnHeader({
  column,
  progress,
}: {
  column: PhaseColumn;
  progress: PhaseProgress;
}) {
  return (
    <div
      role="columnheader"
      data-testid="chart-phase-column-header"
      className="border-b border-r border-line px-3 py-2.5"
    >
      <span className="flex items-baseline gap-1.5">
        <span className="text-chip tabular-nums text-ink-3">{column.ordinal}</span>
        <span className="text-label uppercase tracking-wider-2 text-ivory-2">
          {column.label}
        </span>
      </span>
      <span className="mt-0.5 block truncate text-chip font-normal leading-tight text-ink-3">
        {column.gloss}
      </span>
      <ProgressDashes filled={progress.filled} phaseLabel={column.full} />
    </div>
  );
}

/** The empty top-left corner of the grid — labels the two axes for screen readers. */
export function MatrixCorner() {
  return (
    <div
      role="columnheader"
      className="border-b border-r border-line px-3 py-2.5 text-label-sm uppercase leading-tight text-ink-3"
    >
      Tier
      <span className="mx-1 text-ink-3">/</span>
      Phase
    </div>
  );
}
