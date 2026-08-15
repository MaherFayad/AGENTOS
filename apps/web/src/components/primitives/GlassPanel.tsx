import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { cx } from './cx';

/**
 * GlassPanel — §1.5 glass surfaces: `--glass` fill plus
 * `backdrop-filter: blur(14px)`. The map drawer, the chart drawer, the
 * floating shell bar.
 *
 * `shadow="drawer"` is the one shadow that exists in dark mode
 * (`0 8px 40px rgba(0,0,0,.5)`). Floating chrome that is not a drawer passes
 * `shadow="none"` — a shadow under the top bar reads as a cheap template.
 */

export interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
  /** md = 18px, lg = 20px, pill = fully round (the floating shell bar). */
  radius?: 'md' | 'lg' | 'pill';
  shadow?: 'drawer' | 'none';
  /** 1px --line hairline. On for panels, off for edge-to-edge drawers. */
  bordered?: boolean;
}

const RADIUS = { md: 'rounded-panel', lg: 'rounded-panel-lg', pill: 'rounded-pill' } as const;

export const GlassPanel = forwardRef<HTMLDivElement, GlassPanelProps>(function GlassPanel(
  { radius = 'md', shadow = 'drawer', bordered = true, className, children, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cx(
        'glass',
        RADIUS[radius],
        bordered && 'border border-line',
        shadow === 'drawer' && 'shadow-drawer',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
});
