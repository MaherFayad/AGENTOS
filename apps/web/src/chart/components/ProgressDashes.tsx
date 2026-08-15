import { PROGRESS_SEGMENTS } from '../model/taxonomy';

/**
 * §2.6.3 — the 4-segment progress dashes under each phase column header.
 *
 * `filled` is computed by `phaseProgress()` from the autonomy mix of the jobs actually
 * sitting in that phase. A phase nobody has started shows four empty dashes and says so
 * in its accessible label rather than drawing a flattering bar.
 */
export function ProgressDashes({ filled, phaseLabel }: { filled: number; phaseLabel: string }) {
  return (
    <span
      role="img"
      data-testid="chart-progress-dashes"
      data-filled={filled}
      aria-label={`${phaseLabel}: ${filled} of ${PROGRESS_SEGMENTS} segments rolled out`}
      className="mt-2 flex w-full items-center gap-[3px]"
    >
      {Array.from({ length: PROGRESS_SEGMENTS }, (_, i) => (
        <span
          key={i}
          className={`h-[2px] flex-1 rounded-full ${i < filled ? 'bg-ivory-2' : 'bg-line'}`}
        />
      ))}
    </span>
  );
}
