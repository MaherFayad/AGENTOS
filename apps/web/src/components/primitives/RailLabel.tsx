import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { cx } from './cx';

/**
 * RailLabel — the vertical wide-tracked caps running down the edge of the map
 * and department views. §1.4 tracking at its widest rung (+0.45em).
 *
 * **The default tone is `muted` (`--ink-2`), and that is a ruling, not a preference.**
 * It was `faint` (`--ink-3`) until 2026-08-16. Four shipped call sites existed and all four
 * wanted a non-default tone; two of them shipped required reading at 2.77:1 past three
 * readers, because a colour spent by a default prop contains no string that any grep —
 * including `check-tokens.mjs` — can see. `RailLabel` was the only primitive in the set
 * defaulting below the AA floor while `Chip`, `Pill`, `KpiNumeral` and `Eyebrow` all default
 * at or above it (tokens contract §9.1).
 *
 * The argument is asymmetry: a wrong `muted` is one rung too bright and a reviewer says so;
 * a wrong `faint` is illegible and silent. **Silence must resolve to the safe value.**
 *
 * `faint` is not deprecated. §9.3 gives it a real home — a rail cap that merely repeats the
 * heading beside it — and that home is now **opted into**, in writing, at the call site.
 * See tokens contract §9.7 for which spec-named `--ink-3` values §9 supersedes.
 *
 * Direction-agnostic on purpose:
 *  - the rotation is `writing-mode`, not `transform: rotate(90deg)`, so the
 *    element keeps a real box and still participates in layout;
 *  - spacing uses the logical `ps-*`/`pe-*` axis, which in vertical writing
 *    mode runs along the text, so an RTL flip needs no override here.
 * Position it with `inset-inline-start` / `inset-inline-end`, never `left`.
 */

export interface RailLabelProps extends HTMLAttributes<HTMLSpanElement> {
  /** up = reads bottom-to-top (default). down = reads top-to-bottom. */
  orientation?: 'up' | 'down';
  /** Instrument Serif italic caps — the watermark treatment. */
  serif?: boolean;
  /**
   * `muted` (default) = `--ink-2`, legible, correct for any rail that names something.
   * `faint` = `--ink-3`, sub-AA by measurement — only for a cap that repeats the heading
   * beside it, and only stated out loud (§9.3).
   */
  tone?: 'faint' | 'muted';
}

const TONE = { faint: 'text-ink-3', muted: 'text-ink-2' } as const;

export const RailLabel = forwardRef<HTMLSpanElement, RailLabelProps>(function RailLabel(
  { orientation = 'up', serif = false, tone = 'muted', className, children, ...rest },
  ref,
) {
  return (
    <span
      ref={ref}
      className={cx(
        orientation === 'up' ? 'rail-up' : 'rail-down',
        'inline-block select-none whitespace-nowrap uppercase ps-3 pe-3',
        'text-label tracking-wider-4',
        serif ? 'font-serif italic' : 'font-sans',
        TONE[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
});
