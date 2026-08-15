import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { cx } from './cx';

/**
 * Card — §1.5. 1px `--line` hairline, 12–16px radius, `--card` fill,
 * `--card-2` + `--line-2` on hover.
 *
 * No shadow. Dark mode has no shadows except drawers, and reaching for one is
 * the fastest way to make this look like a generic dashboard template. Depth
 * here comes from the hairline and the fill step, nothing else.
 */

export type CardRadius = 'sm' | 'md' | 'lg';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** sm = 12px, md = 14px, lg = 16px — the §1.5 range. */
  radius?: CardRadius;
  /** Hover response. Only for cards that are actually clickable. */
  interactive?: boolean;
  /** Standard 16px inset. Off for cards that own their own layout. */
  padded?: boolean;
}

const RADIUS: Record<CardRadius, string> = {
  sm: 'rounded-card-sm',
  md: 'rounded-card',
  lg: 'rounded-card-lg',
};

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { radius = 'md', interactive = false, padded = true, className, children, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cx(
        'border border-line bg-card transition-colors duration-hover ease-reveal',
        RADIUS[radius],
        padded && 'p-4',
        interactive && 'cursor-pointer hover:border-line-2 hover:bg-card-2',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
});
