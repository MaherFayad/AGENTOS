import type { Phase, Tier } from '../data/contracts';
import type { ChartAgent, ChartCell, ChartMatrix, PhaseProgress } from '../types';
import { PHASE_ORDER, PROGRESS_SEGMENTS, TIER_ORDER } from './taxonomy';

/**
 * `tier × phase` — the projection §2.6 closes on. Pure: same agents in, same grid out,
 * no I/O, no globals, no memo of agent data.
 */

/** Rollout weight of a tier. This is what the column dashes measure. */
const TIER_WEIGHT: Record<Tier, number> = {
  'human-led': 0,
  assisted: 0.5,
  autonomous: 1,
};

/** Stable card order inside a cell: by name, so the board does not reshuffle per load. */
const byName = (a: ChartAgent, b: ChartAgent) => a.name.localeCompare(b.name);

/**
 * Rollout progress for one phase, quantized to the 4 header segments.
 *
 * Derived, never authored: the mean autonomy of the jobs sitting in that phase
 * (human-led 0, assisted 0.5, autonomous 1) × 4, rounded. A phase with no jobs shows
 * zero filled segments — honestly "not started", not a fabricated bar.
 */
export function phaseProgress(phase: Phase, agents: readonly ChartAgent[]): PhaseProgress {
  const inPhase = agents.filter((a) => a.phase === phase);
  if (inPhase.length === 0) return { phase, jobs: 0, filled: 0 };
  const mean = inPhase.reduce((sum, a) => sum + (TIER_WEIGHT[a.tier] ?? 0), 0) / inPhase.length;
  return { phase, jobs: inPhase.length, filled: Math.round(mean * PROGRESS_SEGMENTS) };
}

/** Jobs at one tier — the row header's count pill. */
export function tierCount(tier: Tier, agents: readonly ChartAgent[]): number {
  return agents.filter((a) => a.tier === tier).length;
}

/** True when nothing lives at this tier × phase yet — renders as the 45° hatch (§2.6.6). */
export const isEmptyCell = (cell: ChartCell): boolean => cell.agents.length === 0;

/**
 * Build the 3 × 4 grid. Agents whose `tier`/`phase` fall outside the frontmatter unions
 * are dropped rather than bucketed into a default — a half-parsed agent never renders
 * (frontmatter-schema.md, Validation).
 */
export function buildMatrix(agents: readonly ChartAgent[]): ChartMatrix {
  const placed = agents.filter(
    (a) => TIER_ORDER.includes(a.tier) && PHASE_ORDER.includes(a.phase),
  );

  const cells = TIER_ORDER.map((tier, row) =>
    PHASE_ORDER.map(
      (phase, col): ChartCell => ({
        tier,
        phase,
        row,
        col,
        agents: placed.filter((a) => a.tier === tier && a.phase === phase).sort(byName),
      }),
    ),
  );

  return {
    cells,
    tierCounts: TIER_ORDER.map((tier) => tierCount(tier, placed)),
    phaseProgress: PHASE_ORDER.map((phase) => phaseProgress(phase, placed)),
    total: placed.length,
  };
}

/** Card counts per cell — everything the keyboard reducer needs to know about layout. */
export const cellCounts = (matrix: ChartMatrix): number[][] =>
  matrix.cells.map((row) => row.map((cell) => cell.agents.length));
