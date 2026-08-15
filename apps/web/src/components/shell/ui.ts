/**
 * The shell's single import site for design-system primitives.
 *
 * `design-system-guardian` owns `components/primitives/**` (Part I). The shell does not
 * reimplement any of them — but it also refuses to spread the guess about their export
 * names across fifteen files. Everything the shell uses is re-exported here, so if the
 * guardian's names differ, exactly one file fails to compile and exactly one file gets
 * fixed.
 *
 * Surface, as shipped by the guardian (read from the files, not assumed):
 *   Pill              — { variant?: 'primary'|'secondary'|'ghost'; size?: 'sm'|'md'; square? }
 *   Eyebrow           — { size?: 'sm'|'md'; tone?: 'muted'|'strong'|'alive' }; `alive` is
 *                       the copper one, and copper means "next to something running" (§1.3)
 *   SegmentedControl  — { options: {value,label,badge?}[]; value; onChange; label }
 *   GlassPanel        — { radius?: 'md'|'lg'|'pill'; shadow?: 'drawer'|'none'; bordered? }
 *   motion            — DURATION / EASE / withReducedMotion (§1.6). The shell needs the
 *                       JS numbers because the fly-to duration travels over the event bus
 *                       to a canvas that animates imperatively.
 */

export { Pill } from '../primitives/Pill';
export { Eyebrow } from '../primitives/Eyebrow';
export { SegmentedControl } from '../primitives/SegmentedControl';
export { GlassPanel } from '../primitives/GlassPanel';
export { DURATION, EASE, withReducedMotion } from '../primitives/motion';
