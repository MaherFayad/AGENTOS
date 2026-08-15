import type { Phase, Tier } from '../data/contracts';

/**
 * The axes of the rollout board (§2.6.3).
 *
 * The *values* are the frontmatter unions from `packages/contracts` — TypeScript checks
 * that below. The *labels and glosses* are §2.6 copy and belong to this view, which is
 * why they live here and not in the frontmatter schema: they are how the matrix explains
 * itself, not data about any agent.
 */

export interface TierRow {
  tier: Tier;
  /** Short name, e.g. "Human-assisted". */
  label: string;
  /** The §2.6 gloss after the em dash, e.g. "AI drafts, a human approves". */
  gloss: string;
  /** Full spec label — `label — gloss`, used as the row's accessible name. */
  full: string;
  /** lucide icon name for the row header glyph (monochrome, chrome not data). */
  icon: string;
}

export interface PhaseColumn {
  phase: Phase;
  /** 1-based rollout ordinal — also the number of filled tier dots on a job card. */
  ordinal: number;
  /** e.g. "Capture". */
  label: string;
  /** e.g. "Classify, extract, score". */
  gloss: string;
  /** Full spec label — `ordinal Label — gloss`. */
  full: string;
  /** The card's phase tag, e.g. "2 · Capture". */
  tag: string;
}

/** Rows, top to bottom: least autonomous first, so the board reads as a climb. */
export const TIER_ROWS: readonly TierRow[] = [
  {
    tier: 'human-led',
    label: 'Human-led',
    gloss: 'a person drives it',
    full: 'Human-led — a person drives it',
    icon: 'user',
  },
  {
    tier: 'assisted',
    label: 'Human-assisted',
    gloss: 'AI drafts, a human approves',
    full: 'Human-assisted — AI drafts, a human approves',
    icon: 'user-check',
  },
  {
    tier: 'autonomous',
    label: 'Fully autonomous',
    gloss: 'AI runs it unattended',
    full: 'Fully autonomous — AI runs it unattended',
    icon: 'bot',
  },
] as const;

/** Columns, left to right: deployment order. This ordering IS the playbook. */
export const PHASE_COLUMNS: readonly PhaseColumn[] = [
  {
    phase: '1-foundation',
    ordinal: 1,
    label: 'Foundation',
    gloss: 'Data + the company brain',
    full: '1 Foundation — Data + the company brain',
    tag: '1 · Foundation',
  },
  {
    phase: '2-capture',
    ordinal: 2,
    label: 'Capture',
    gloss: 'Classify, extract, score',
    full: '2 Capture — Classify, extract, score',
    tag: '2 · Capture',
  },
  {
    phase: '3-generate',
    ordinal: 3,
    label: 'Generate',
    gloss: 'Produce work, take action',
    full: '3 Generate — Produce work, take action',
    tag: '3 · Generate',
  },
  {
    phase: '4-orchestrate',
    ordinal: 4,
    label: 'Orchestrate',
    gloss: 'Agents, monitoring, loops',
    full: '4 Orchestrate — Agents, monitoring, loops',
    tag: '4 · Orchestrate',
  },
] as const;

export const TIER_ORDER: readonly Tier[] = TIER_ROWS.map((r) => r.tier);
export const PHASE_ORDER: readonly Phase[] = PHASE_COLUMNS.map((c) => c.phase);

/** The grid is exactly 3 × 4. Anything else is a schema change, not a layout tweak. */
export const ROW_COUNT = TIER_ROWS.length;
export const COL_COUNT = PHASE_COLUMNS.length;

/** Segments in a phase column's progress dashes (§2.6.3). */
export const PROGRESS_SEGMENTS = 4;

export const tierRow = (tier: Tier): TierRow => {
  const row = TIER_ROWS.find((r) => r.tier === tier);
  if (!row) throw new Error(`Unknown tier "${tier}" — not in the frontmatter union.`);
  return row;
};

export const phaseColumn = (phase: Phase): PhaseColumn => {
  const col = PHASE_COLUMNS.find((c) => c.phase === phase);
  if (!col) throw new Error(`Unknown phase "${phase}" — not in the frontmatter union.`);
  return col;
};
