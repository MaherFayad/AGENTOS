import { PROGRESS_SEGMENTS } from '../model/taxonomy';

/**
 * §2.6.4 — the `●●○○` dots beside a job card's phase tag.
 *
 * Four dots, one per rollout phase; filled up to the phase this job sits in. So a
 * `2 · Capture` card reads `●●○○` — how far into the deployment order this job lands.
 * Derived from frontmatter `phase`; nothing here is authored per card.
 */
export function PhaseDots({ ordinal }: { ordinal: number }) {
  return (
    <span
      aria-hidden="true"
      data-testid="chart-phase-dots"
      data-filled={ordinal}
      className="inline-flex items-center gap-[3px]"
    >
      {Array.from({ length: PROGRESS_SEGMENTS }, (_, i) => (
        <span
          key={i}
          className={`h-[3px] w-[3px] rounded-full ${i < ordinal ? 'bg-ivory-2' : 'bg-line-2'}`}
        />
      ))}
    </span>
  );
}
