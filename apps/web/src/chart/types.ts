import type { DepartmentSlug, Phase, Tier } from './data/contracts';

/**
 * CHART's *projection* of agent frontmatter (§2.6 closing line: "same frontmatter,
 * different projection"). These are field references, not a second copy of the library —
 * every value here is read from the agent SKILL.md frontmatter at load time, and nothing
 * under `src/chart` may persist, cache to disk, or hand-author an agent record.
 */
export interface ChartAgent {
  /** `{department}/{agent-slug}` — the id the drawer opens with. */
  slug: string;
  /** frontmatter `name` — card face, 13px/600. */
  name: string;
  /** frontmatter `description` — expanded card body. */
  description: string;
  /** frontmatter `department` — which tab this agent belongs to. */
  department: DepartmentSlug;
  /** frontmatter `icon` — lucide name for the card's icon square. */
  icon: string;
  /** frontmatter `tier` — the matrix ROW. */
  tier: Tier;
  /** frontmatter `phase` — the matrix COLUMN. */
  phase: Phase;
  /** frontmatter `breaks_into` — the `SKILLS` chip on an expanded card. */
  skills: readonly string[];
}

/** One tier × phase intersection. `agents` may be empty — an empty cell is information. */
export interface ChartCell {
  tier: Tier;
  phase: Phase;
  /** Row index 0–2 and column index 0–3, for keyboard navigation. */
  row: number;
  col: number;
  agents: readonly ChartAgent[];
}

/** Exactly 3 tiers × 4 phases. Rows in TIER_ORDER, columns in PHASE_ORDER. */
export interface ChartMatrix {
  cells: readonly (readonly ChartCell[])[];
  /** Jobs per tier, in TIER_ORDER — the row-header count pills. */
  tierCounts: readonly number[];
  /** Per-phase rollout progress, in PHASE_ORDER — the 4-segment column dashes. */
  phaseProgress: readonly PhaseProgress[];
  /** Every agent that landed in the grid, for the derived stat line. */
  total: number;
}

/** The derived value behind a column header's 4-segment progress dashes. */
export interface PhaseProgress {
  phase: Phase;
  /** Jobs in this phase. */
  jobs: number;
  /** 0–4 filled segments. Derived — never authored. */
  filled: number;
}

/** The derived numbers behind the title block's stat line. Never hand-written. */
export interface ChartStats {
  total: number;
  autonomous: number;
  assisted: number;
  humanLed: number;
}

/** Roving-focus position inside the grid: cell (row, col) and card index within it. */
export interface GridPos {
  row: number;
  col: number;
  /** Index of the focused job card in that cell; 0 for an empty cell. */
  item: number;
}
