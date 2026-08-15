/**
 * The drawer's single import site for design-system primitives.
 *
 * `design-system-guardian` owns `components/primitives/**` (Part I) and the drawer does
 * not reimplement any of them. It also refuses to spread a guess about their export names
 * across twenty files: everything the drawer uses is re-exported here, so if the owner's
 * names differ, exactly one file fails to compile and exactly one file gets fixed.
 * (`components/shell/ui.ts` does the same thing for the same reason.)
 *
 * Surface the drawer relies on — confirmed by message, see
 * `comms/inbox/design-system-guardian/`:
 *
 *   GlassPanel — var(--glass) + backdrop-blur surface. Props: {className?, children}
 *   Pill       — Props: {variant?: 'primary'|'secondary'|'ghost', disabled?, title?,
 *                        onClick?, type?, children}
 *   Card       — 1px var(--line), 12–16px radius. Props: {className?, children}
 *   Chip       — Props: {className?, onClick?, title?, children}
 *   Eyebrow    — wide-tracked caps label. Props: {tone?: 'copper'|'ink', className?, children}
 *
 * Motion comes from `primitives/motion.ts`, which already exists and is authoritative:
 * DURATION / EASE, not `durations` / `easings`.
 *
 * Owner: drawer-engineer (the file) · design-system-guardian (the components)
 */

export { GlassPanel } from '@/components/primitives/GlassPanel';
export { Pill } from '@/components/primitives/Pill';
export { Card } from '@/components/primitives/Card';
export { Chip } from '@/components/primitives/Chip';
export { Eyebrow } from '@/components/primitives/Eyebrow';
export { cx } from '@/components/primitives/cx';
export { DURATION, EASE, useReducedMotion } from '@/components/primitives/motion';
