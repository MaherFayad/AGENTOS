import type { ChartStats } from '../types';
import { Eyebrow } from '../ui';
import { StatLine } from './StatLine';
import { TierLegend } from './TierLegend';

/**
 * §2.6.2 — "Marketing · the AI rollout" over the derived stat line, tier legend right.
 *
 * The serif italic on "rollout" is the brand signature (§1.4): italic Instrument Serif
 * inside a bold sans headline. It is used on the accent word only, never the whole title.
 */
export function TitleBlock({
  departmentLabel,
  stats,
}: {
  departmentLabel: string;
  stats: ChartStats;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <Eyebrow>The deployment order</Eyebrow>
        <h1 className="mt-2 text-kpi-sm font-bold leading-tight text-ivory">
          {departmentLabel}
          <span className="mx-1.5 font-normal text-ink-3">·</span>
          <span className="font-normal text-ivory-2">the AI </span>
          <span className="font-serif text-kpi font-normal italic">rollout</span>
        </h1>
        {stats.total > 0 && (
          <div className="mt-1.5">
            <StatLine stats={stats} />
          </div>
        )}
      </div>
      <TierLegend />
    </header>
  );
}
