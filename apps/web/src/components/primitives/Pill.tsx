import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';

/**
 * Pill — §1.5 buttons. Every button in this product is a pill; there is no
 * second button shape.
 *
 *   primary   --copper background, --copper-ink text, 13px/600
 *   secondary transparent, 1px --line-2 border
 *   ghost     no border, no fill — the 32px shell squares (§2.0 fullscreen, ?,
 *             zoom −/+) and low-emphasis inline actions
 *
 * Note what primary does across themes and do not "fix" it: --copper resolves
 * to ivory in dark and near-black in light, --copper-ink inverts with it. One
 * class pair, both themes, no branch (§1.2).
 */

export type PillVariant = 'primary' | 'secondary' | 'ghost';

export interface PillProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: PillVariant;
  /** sm = 32px, the shell control height (§2.0). md = 36px, page actions. */
  size?: 'sm' | 'md';
  /** Equal width and height — the 32px ghost square in the shell. */
  square?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
}

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-pill font-sans text-pill ' +
  'whitespace-nowrap select-none transition-colors duration-hover ease-reveal ' +
  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-line-2 ' +
  'disabled:pointer-events-none disabled:opacity-40';

const VARIANT: Record<PillVariant, string> = {
  primary: 'bg-copper text-copper-ink hover:opacity-90',
  secondary: 'border border-line-2 bg-transparent text-ivory hover:bg-card-2',
  ghost: 'border border-transparent bg-transparent text-ivory-2 hover:bg-card-2 hover:text-ivory',
};

const SIZE = { sm: 'h-8', md: 'h-9' } as const;
const PAD = { sm: 'px-3', md: 'px-4' } as const;
const SQUARE = { sm: 'w-8 px-0', md: 'w-9 px-0' } as const;

export const Pill = forwardRef<HTMLButtonElement, PillProps>(function Pill(
  { variant = 'secondary', size = 'sm', square = false, leading, trailing, className, children, type, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      className={cx(BASE, VARIANT[variant], SIZE[size], square ? SQUARE[size] : PAD[size], className)}
      {...rest}
    >
      {leading}
      {children}
      {trailing}
    </button>
  );
});
