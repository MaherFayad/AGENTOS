/**
 * The ONE place where CHART couples to the shared primitives and motion tokens
 * (`design-system-guardian` owns `src/components/primitives/**`). Chart components import
 * from here, so a rename over there is a one-file fix here.
 *
 * Assumed API — confirmed by message to `design-system-guardian`:
 *   `@/components/primitives`        → Pill, Chip, Eyebrow (children + className)
 *   `@/components/primitives/motion` → DURATION.reveal (500ms), EASE.reveal
 *                                      (cubic-bezier(.2,.7,.2,1)) — design-tokens.md §6
 */

export { Pill, Chip, Eyebrow } from '@/components/primitives';

import { DURATION, EASE } from '@/components/primitives/motion';

/**
 * §1.6 / design-tokens §6: the 500ms `cubic-bezier(.2,.7,.2,1)` reveal is the app's
 * panel motion, and an expanding job card is a panel. Durations are never literals here.
 */
export const CHART_MOTION = {
  expandMs: DURATION.reveal,
  ease: EASE.reveal,
} as const;
