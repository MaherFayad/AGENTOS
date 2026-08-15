import { forwardRef } from 'react';
import type { ElementType, HTMLAttributes } from 'react';
import { cx } from './cx';

/**
 * Eyebrow — §1.4 wide-tracked caps. 10–11px / 500 / +0.3em–0.35em, uppercase.
 *
 * These are everywhere: NAVIGATION, department names, "META ADS · PAID
 * ACQUISITION", dashboard captions, section kickers. Under-tracking them is the
 * most common fidelity miss in this whole design system, which is why the
 * tracking is baked in and not a prop.
 *
 * Monochrome by default. `tone="alive"` is copper and means exactly one thing:
 * this label sits next to something that is running (§1.3). It is not an
 * emphasis switch.
 */

export interface EyebrowProps extends HTMLAttributes<HTMLElement> {
  /** sm = 10px/+0.35em (the shell's NAVIGATION label, §2.0). md = 11px/+0.3em. */
  size?: 'sm' | 'md';
  tone?: 'muted' | 'strong' | 'alive';
  /** Instrument Serif italic caps — watermarks and rail headings only. */
  serif?: boolean;
  as?: ElementType;
}

const TONE = {
  muted: 'text-ink-2',
  strong: 'text-ivory-2',
  alive: 'text-ink-copper-2',
} as const;

const SIZE = {
  sm: 'text-label-sm tracking-wider-3',
  md: 'text-label tracking-wider-2',
} as const;

export const Eyebrow = forwardRef<HTMLElement, EyebrowProps>(function Eyebrow(
  { size = 'md', tone = 'muted', serif = false, as, className, children, ...rest },
  ref,
) {
  const Tag = (as ?? 'span') as ElementType;
  return (
    <Tag
      ref={ref}
      className={cx(
        'inline-block uppercase',
        serif ? 'font-serif italic' : 'font-sans',
        SIZE[size],
        TONE[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
});
