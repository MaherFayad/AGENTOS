import { TIER_ROWS } from '../model/taxonomy';
import { Chip } from '../ui';
import { JobIcon } from './JobIcon';

/**
 * §2.6.2, right side of the title block — legend chips for the three autonomy tiers.
 *
 * Outline + icon + label, no fills and no hues: a tier is not a status, so it earns no
 * data ink (§1.3). The tiers are told apart by glyph and word, which is also the only
 * version that survives the light theme and a colour-blind reader.
 */
export function TierLegend() {
  return (
    <ul
      data-testid="chart-tier-legend"
      aria-label="Autonomy tiers"
      className="flex flex-wrap items-center gap-1.5"
    >
      {TIER_ROWS.map((row) => (
        <li key={row.tier}>
          <Chip>
            <span title={row.full} className="inline-flex items-center gap-1.5">
              <JobIcon name={row.icon} size={12} />
              <span className="text-label-sm uppercase">{row.label}</span>
            </span>
          </Chip>
        </li>
      ))}
    </ul>
  );
}
