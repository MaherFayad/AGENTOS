/**
 * The one import site for design-system primitives used by DASHBOARDS.
 * `design-system-guardian` owns `components/primitives/**`. If a name moves, this file
 * fails to compile and nothing else does.
 *
 * Owner: dashboards-engineer
 */

export { Card } from '@/components/primitives/Card';
export { Chip } from '@/components/primitives/Chip';
export { Eyebrow } from '@/components/primitives/Eyebrow';
export { KpiNumeral } from '@/components/primitives/KpiNumeral';
export { Pill } from '@/components/primitives/Pill';
export { RailLabel } from '@/components/primitives/RailLabel';
export { SegmentedControl } from '@/components/primitives/SegmentedControl';
export { cx } from '@/components/primitives/cx';
export { carousel as carouselMotion, DURATION, useReducedMotion } from '@/components/primitives/motion';
