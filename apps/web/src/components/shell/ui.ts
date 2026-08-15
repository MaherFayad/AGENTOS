/**
 * The shell's single import site for design-system primitives.
 *
 * `design-system-guardian` owns `components/primitives/**` (Part I). The shell does not
 * reimplement any of them — but it also refuses to spread the guess about their export
 * names across fifteen files. Everything the shell uses is re-exported here, so if the
 * guardian's names differ, exactly one file fails to compile and exactly one file gets
 * fixed.
 *
 * Assumed surface (confirm with the owner, see comms/inbox/design-system-guardian/):
 *   Pill              — props: { variant?: 'primary' | 'secondary' | 'ghost'; as?; ... }
 *   Eyebrow           — wide-tracked caps label, props: { tone?: 'copper' | 'ink' }
 *   SegmentedControl  — props: { items: {value,label}[]; value; onChange; label }
 *   GlassPanel        — --glass + backdrop-blur surface
 *   motion            — { durations, easings } per contracts/design-tokens.md §6
 */

export { Pill } from '../primitives/Pill';
export { Eyebrow } from '../primitives/Eyebrow';
export { SegmentedControl } from '../primitives/SegmentedControl';
export { GlassPanel } from '../primitives/GlassPanel';
export { durations, easings } from '../primitives/motion';
