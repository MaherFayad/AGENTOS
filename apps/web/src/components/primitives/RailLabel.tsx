import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { cx } from './cx';

/**
 * RailLabel — the vertical wide-tracked caps running down the edge of the map
 * and department views. §1.4 tracking at its widest rung (+0.45em), `--ink-3`.
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
  tone?: 'faint' | 'muted';
}

const TONE = { faint: 'text-ink-3', muted: 'text-ink-2' } as const;

export const RailLabel = forwardRef<HTMLSpanElement, RailLabelProps>(function RailLabel(
  { orientation = 'up', serif = false, tone = 'faint', className, children, ...rest },
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
