/**
 * The map's SVG type scale (§2.1, §2.2).
 *
 * Tailwind's named scale (`text-label`, `tracking-wider-*`) covers every size the chrome
 * needs, but three of the map's sizes are not in §1.4 because they only exist inside the
 * SVG viewport: the 18–20px department caps, the 11px sub-labels sitting under them, and
 * the ~160px §2.2 watermark. Those are also the sizes that must scale with the camera
 * transform, which a CSS class cannot express.
 *
 * They live here for the same reason `motion.ts` exists: one module owns the numbers, and
 * `scripts/check-tokens.mjs` never sees a px value typed inside a component. A
 * `decision-request` is open with `design-system-guardian` to fold these into
 * `tailwind.config.ts` as `text-branch` / `text-watermark` if they would rather own them.
 *
 * Units are SVG user units, which equal world px before the zoom transform.
 */

/** §2.1 — department label: "wide-tracked serif-caps label (18–20px, --ivory-2, +0.4em)". */
export const BRANCH_LABEL = {
  size: 19,
  /** +0.4em, expressed in user units at the above size. */
  tracking: 19 * 0.4,
} as const;

/** §2.1 — "3 tiny sub-labels beneath (11px --ink-3)". */
export const BRANCH_SUBLABEL = {
  size: 11,
  tracking: 11 * 0.25,
  /** Vertical rhythm between the three sub-label rows. */
  lineHeight: 15,
} as const;

/** §2.2 — "giant watermark department name … Instrument Serif caps, ~160px". */
export const WATERMARK = {
  size: 160,
  tracking: 160 * 0.06,
  /** §2.2 gives the exact value `rgba(236,236,238,.05)`; 236,236,238 is `--ivory`, so this
   *  is `--ivory` at 5% and needs no new color token. */
  opacity: 0.05,
} as const;

/** §2.2 — "Sub-cluster labels float in wide-tracked caps … (11px, --ink-2, +0.35em)". */
export const CLUSTER_LABEL = {
  size: 11,
  tracking: 11 * 0.35,
} as const;

/** The name label that fades in beneath a hovered node (§2.1). */
export const NODE_LABEL = {
  size: 12,
  tracking: 12 * 0.08,
  /** Gap below the node's edge. */
  offset: 14,
} as const;

/** Leaf dots are unlabelled until hovered — 150 permanent labels is noise, not a map. */
export const LEAF_LABEL = {
  size: 10,
  tracking: 10 * 0.08,
  offset: 10,
} as const;
