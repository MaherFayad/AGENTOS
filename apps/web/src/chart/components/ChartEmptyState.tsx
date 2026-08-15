import { HATCH_STYLE } from '../model/hatch';

/**
 * A department with no agents yet (Part VII.3 — an honest empty state beats a plausible
 * fake one). We do NOT draw an empty 3 × 4 grid here: a full board of hatch blocks reads
 * as twelve deliberate gaps, when the truth is simply that nobody has mapped this
 * department yet. Those are different statements, so they get different screens.
 */
export function ChartEmptyState({
  departmentLabel,
  departmentSlug,
  error,
}: {
  departmentLabel: string;
  departmentSlug: string;
  error?: string;
}) {
  return (
    <div
      data-testid="chart-empty-state"
      style={HATCH_STYLE}
      className="flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-card border border-line px-6 py-12 text-center"
    >
      <p className="text-small font-semibold text-ivory">
        {error ? 'The agent library could not be read.' : `No jobs mapped in ${departmentLabel} yet.`}
      </p>
      <p className="max-w-[46ch] text-meta text-ink-2">
        {error ? (
          <>
            {error} · CHART shows nothing rather than a plausible grid — the numbers on this
            view are only worth anything if they are real.
          </>
        ) : (
          <>
            The board fills in as agents land in <code className="text-ivory-2">agents/{departmentSlug}/</code>.
            Tier and phase come from each agent&rsquo;s frontmatter; nothing is placed by hand.
          </>
        )}
      </p>
    </div>
  );
}
