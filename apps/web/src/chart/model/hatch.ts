import type { CSSProperties } from 'react';

/**
 * §2.6.6 — empty cells render as subtle diagonal-hatch blocks.
 *
 * An empty tier × phase is *information*: nothing has been deployed there yet. The hatch
 * says "deliberately nothing", where a blank box would say "loading" or "broken". Kept as
 * one exported constant so the treatment cannot drift between cells and so a test can
 * assert every empty cell carries it.
 *
 * Token-only: the stripe is `var(--line)` (design-tokens §1), never a literal color.
 */
export const HATCH_ANGLE_DEG = 45;

export const HATCH_STYLE: Readonly<CSSProperties> = Object.freeze({
  backgroundImage:
    `repeating-linear-gradient(${HATCH_ANGLE_DEG}deg,` +
    ' var(--line) 0px, var(--line) 1px,' +
    ' transparent 1px, transparent 8px)',
});

/** The rendered background-image string — what DOM tests compare against. */
export const HATCH_BACKGROUND = HATCH_STYLE.backgroundImage as string;
