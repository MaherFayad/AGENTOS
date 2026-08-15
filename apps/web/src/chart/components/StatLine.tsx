import { statLineSegments } from '../model/stats';
import type { ChartStats } from '../types';

/**
 * §2.6.2 — "**18 of 23 jobs** run autonomously · **5 assisted** · the rest stay human".
 *
 * This component owns emphasis and nothing else. Every numeral arrives already counted
 * from frontmatter `tier`; there is no arithmetic and no literal in this file, which is
 * the point — the stat line is the view's credibility, so it can only ever be derived.
 */
export function StatLine({ stats }: { stats: ChartStats }) {
  return (
    <p data-testid="chart-stat-line" className="text-body text-ivory-2">
      {statLineSegments(stats).map((segment, i) =>
        segment.strong ? (
          <strong key={i} className="font-semibold tabular-nums text-ivory">
            {segment.text}
          </strong>
        ) : (
          <span key={i}>{segment.text}</span>
        ),
      )}
    </p>
  );
}
