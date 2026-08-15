/**
 * The shared vocabulary. Eight primitives; everything else in the product
 * composes from them (Part V — no component library).
 *
 *   import { Card, Chip, Eyebrow } from '@/components/primitives';
 *
 * Adding a ninth primitive is a decision-request to design-system-guardian,
 * not a pull request. Most "new primitive" needs are a prop on an existing one.
 */
export { Pill } from './Pill';
export type { PillProps, PillVariant } from './Pill';

export { Card } from './Card';
export type { CardProps, CardRadius } from './Card';

export { Chip } from './Chip';
export type { ChipProps, ChipTone } from './Chip';

export { Eyebrow } from './Eyebrow';
export type { EyebrowProps } from './Eyebrow';

export { RailLabel } from './RailLabel';
export type { RailLabelProps } from './RailLabel';

export { KpiNumeral } from './KpiNumeral';
export type { KpiNumeralProps, KpiTone } from './KpiNumeral';

export { SegmentedControl } from './SegmentedControl';
export type { SegmentedControlProps, SegmentedOption } from './SegmentedControl';

export { GlassPanel } from './GlassPanel';
export type { GlassPanelProps } from './GlassPanel';

export { cx } from './cx';
export type { ClassValue } from './cx';

export * as motion from './motion';
export * as theme from './theme';
