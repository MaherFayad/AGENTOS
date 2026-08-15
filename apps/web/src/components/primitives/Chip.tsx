/* token-exempt-file: Chip IS data ink. §1.3 names status chips as a sanctioned
 * home for --ink-* on a fill and a hairline; the tone prop is a status value,
 * not decoration. This exemption does not transfer — a chrome component that
 * copies these classes is the violation the rule exists to catch. */
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { cx } from './cx';

/**
 * Chip — 11px, 1px border, 6px radius. The status vocabulary of the product.
 *
 * `tone` is the only place a component may choose a color, and it chooses it
 * from a value, never from taste. If your chip does not report a status, use
 * `neutral` and let it be monochrome — that is the correct answer far more
 * often than it feels like it should be (§1.3).
 */

export type ChipTone =
  /** Monochrome. The default, and the right answer unless a status is present. */
  | 'neutral'
  /** Copper — "alive": running now, live node, active session (§1.3). */
  | 'live'
  /** Teal — on track, healthy, passed. */
  | 'success'
  /** Coral — at risk, stalled, failed. */
  | 'risk'
  /** Amber — warning, approval pending, limited slots. */
  | 'warn'
  /** Blue — informational link-ish state. Sparse by design. */
  | 'info'
  /** Lavender — demo / sample data, so a fake number never reads as real. */
  | 'demo';

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: ChipTone;
  /** Wide-tracked caps variant, for chips used as labels rather than status. */
  caps?: boolean;
  /** A 5px dot in the tone color, left of the label. */
  dot?: boolean;
}

const TONE: Record<ChipTone, string> = {
  neutral: 'border-line bg-transparent text-ivory-2',
  live: 'border-ink-copper-line bg-ink-copper-fill text-ink-copper-2',
  success: 'border-ink-teal-line bg-ink-teal-fill text-ink-teal',
  risk: 'border-ink-coral-line bg-ink-coral-fill text-ink-coral-2',
  warn: 'border-ink-amber-line bg-ink-amber-fill text-ink-amber',
  info: 'border-ink-blue-line bg-ink-blue-fill text-ink-blue',
  demo: 'border-ink-lavender-line bg-ink-lavender-fill text-ink-lavender-2',
};

const DOT: Record<ChipTone, string> = {
  neutral: 'bg-ink-3',
  live: 'bg-ink-copper',
  success: 'bg-ink-teal',
  risk: 'bg-ink-coral',
  warn: 'bg-ink-amber',
  info: 'bg-ink-blue',
  demo: 'bg-ink-lavender',
};

export const Chip = forwardRef<HTMLSpanElement, ChipProps>(function Chip(
  { tone = 'neutral', caps = false, dot = false, className, children, ...rest },
  ref,
) {
  return (
    <span
      ref={ref}
      className={cx(
        'inline-flex items-center gap-1.5 rounded-chip border px-2 py-1 font-sans text-chip',
        caps && 'uppercase tracking-wider-1',
        TONE[tone],
        className,
      )}
      {...rest}
    >
      {dot && <span aria-hidden className={cx('h-1 w-1 rounded-pill', DOT[tone])} />}
      {children}
    </span>
  );
});
