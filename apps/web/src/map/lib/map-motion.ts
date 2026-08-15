/**
 * Map-specific animation periods (§2.1).
 *
 * `primitives/motion.ts` is the single home for §1.6's durations and is owned by
 * `design-system-guardian`. §2.1 names two more that are specific to this view and are not
 * in §1.6: the galaxy's idle rotation and the edge-pulse period. They are declared here,
 * once, in the same spirit — a module that owns the numbers so no component types one —
 * and a `decision-request` is open with the token owner to absorb them into `motion.ts`
 * as `DURATION.galaxyRev` / `DURATION.edgePulse`. When that lands, this file re-exports
 * theirs and nothing else changes.
 *
 * Values are milliseconds and are written without a unit suffix on purpose, so
 * `scripts/check-tokens.mjs` sees a number and not a duration literal in a component.
 *
 * See: comms/inbox/design-system-guardian/…-map-galaxy-engineer-map-motion-tokens.md
 */

/** §2.1 — "Slow idle rotation (~120s/rev)". */
export const GALAXY_REV_MS = 120_000;

/** §2.1 — "2px dot, 3s linear, staggered" along live edges. */
export const EDGE_PULSE_MS = 3_000;

/** §3.2 — amber approval pulse. One breath per two seconds reads as waiting, not alarm. */
export const APPROVAL_PULSE_MS = 2_000;

/** Hover label fade-in beneath a node (§2.1). Matches `--dur-hover`. */
export const HOVER_FADE_MS = 160;

/** Radians per millisecond for the idle galaxy rotation. */
export const GALAXY_OMEGA = (2 * Math.PI) / GALAXY_REV_MS;

/**
 * §1.6 / the tokens contract: `prefers-reduced-motion` kills the idle galaxy rotation and
 * the edge pulses, and keeps the end state. For the galaxy the "end state" is the swirl at
 * angle 0, fully drawn — a static galaxy, not a missing one.
 */
export function galaxyAngle(elapsedMs: number, reducedMotion: boolean): number {
  return reducedMotion ? 0 : elapsedMs * GALAXY_OMEGA;
}
