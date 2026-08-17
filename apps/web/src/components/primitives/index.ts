/**
 * The shared vocabulary. Eleven primitives; everything else in the product
 * composes from them (Part V — no component library).
 *
 *   import { Card, Chip, Eyebrow } from '@/components/primitives';
 *
 * Adding a twelfth is a decision-request to design-system-guardian, not a pull
 * request. Most "new primitive" needs are a prop on an existing one.
 *
 * **The last three moved the count on written decisions rather than on
 * convenience** (tokens contract §10.4, §11.5). Every one of them was offered
 * `Chip` as a host and refused it for the same reason: `Chip` is the product's
 * *status* vocabulary and the one component allowed to spend data ink, and none
 * of these three reports a status.
 *
 *   9. `ProvenanceBadge` — where an agent came from. A drifted fork is not
 *      unhealthy; it runs. §10.
 *  10. `AddressBadge` — who a turn goes to and what it costs in runs. A price is
 *      not a condition, and `#` vs `@@` is the difference between one run and N.
 *      §11.
 *  11. `InterruptBadge` — how disruptively a message lands. A choice the sender
 *      is about to make, not a state of the system. §11.
 *
 * Merging any of them into `Chip` would teach every reader — and every future
 * implementer copying the nearest example — that a coloured token and a grey one
 * answer the same kind of question.
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

export { ProvenanceBadge } from './ProvenanceBadge';
export type { ProvenanceBadgeProps, ProvenanceState } from './ProvenanceBadge';

export { AddressBadge, OPEN_ENDED_FORMS } from './AddressBadge';
export type { AddressBadgeProps } from './AddressBadge';

export { InterruptBadge, interruptsWorkInProgress } from './InterruptBadge';
export type { InterruptBadgeProps } from './InterruptBadge';

export { cx } from './cx';
export type { ClassValue } from './cx';

export * as motion from './motion';
export * as theme from './theme';
