'use client';

import { useEffect, useRef, useState } from 'react';
import type { HTMLAttributes } from 'react';
import { cx } from './cx';
import { DURATION, useReducedMotion } from './motion';

/**
 * KpiNumeral — §1.4 KPI numerals (28–32px / 600, tabular-nums) with the §1.6
 * mount behaviour (count up over 300ms).
 *
 * `tabular-nums` is not cosmetic: without it the digits change width mid-count
 * and the whole tile jitters. Every number in this product that can change is
 * tabular.
 *
 * Reduced motion renders the final value on the first frame. The end state is
 * always the truth; only the travel is optional (§1.6).
 *
 * THE INVARIANT, and it is a BOARD-rule-9 invariant, not a cosmetic one: the
 * printed value never leaves [min(from, to), max(from, to)]. A KPI tile is the
 * most credible surface in the product; a tile that paints -1617290 for one
 * frame has fabricated a number (Part VII.3). `KpiNumeral.test.tsx` pins this
 * against a deliberately skewed clock — do not weaken that test to a
 * happy-path "it reaches 22".
 *
 * Accessibility: the animating digits are aria-hidden and the element carries
 * the final formatted value as its label, so a screen reader announces "22",
 * once, rather than counting out loud.
 */

export type KpiTone = 'default' | 'alive' | 'up' | 'down' | 'muted';

export interface KpiNumeralProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  value: number;
  /** sm = 28px, md = 30px, lg = 32px — the §1.4 range. */
  size?: 'sm' | 'md' | 'lg';
  /**
   * default/muted are monochrome. alive = copper (the "N OF 22 LIVE" numeral),
   * up = teal, down = coral. Tone must come from the number's meaning (§1.3).
   */
  tone?: KpiTone;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  /** Full control of the printed string. Receives the interpolated value. */
  format?: (n: number) => string;
  /** Opt out of the count-up for numbers that are not a headline. */
  animate?: boolean;
}

const SIZE = { sm: 'text-kpi-sm', md: 'text-kpi', lg: 'text-kpi-lg' } as const;

const TONE: Record<KpiTone, string> = {
  default: 'text-ivory',
  muted: 'text-ivory-2',
  alive: 'text-ink-copper-2',
  up: 'text-ink-teal',
  down: 'text-ink-coral',
};

/** Decelerating curve — the count should land, not stop. Domain is [0,1] only. */
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * The animation parameter is clamped at BOTH ends, and that is load-bearing.
 * `easeOut` is a cubic: feed it t = -40 and it returns -73500, and the tile
 * paints a large negative number that looks like a real reading. Clamping the
 * top only (`Math.min(1, …)`) leaves the bottom open, which is exactly the
 * defect fidelity-qa-reviewer measured on 2026-08-16 — four isolated runs
 * painted -1617290, -112, -79 and 15 where the value was 22.
 */
const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);

export function KpiNumeral({
  value,
  size = 'md',
  tone = 'default',
  decimals = 0,
  prefix = '',
  suffix = '',
  format,
  animate = true,
  className,
  ...rest
}: KpiNumeralProps) {
  const reduced = useReducedMotion();
  const shouldAnimate = animate && !reduced;
  const [shown, setShown] = useState(shouldAnimate ? 0 : value);
  const from = useRef(shouldAnimate ? 0 : value);

  useEffect(() => {
    if (!shouldAnimate) {
      from.current = value;
      setShown(value);
      return;
    }
    const a = from.current;
    const b = value;
    let raf = 0;
    // Seeded by the FIRST frame, from the rAF clock — never performance.now().
    // The two are different clocks with different time origins (jsdom skews
    // them by ~845ms; a browser hands rAF the frame-start time, which precedes
    // a performance.now() taken inside that same frame). Reading `start` and
    // `now` from one clock means `now - start` cannot be negative at all;
    // clamp01 below is the belt to that pair of braces.
    let start: number | null = null;
    const tick = (now: number) => {
      if (start === null) start = now;
      const t = clamp01((now - start) / DURATION.countUp);
      setShown(a + (b - a) * easeOut(t));
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = b;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, shouldAnimate]);

  const print = (n: number) => (format ? format(n) : n.toFixed(decimals));
  const label = `${prefix}${print(value)}${suffix}`;

  return (
    <span
      className={cx('font-sans tabular-nums', SIZE[size], TONE[tone], className)}
      aria-label={label}
      {...rest}
    >
      <span aria-hidden="true">
        {prefix}
        {print(shown)}
        {suffix}
      </span>
    </span>
  );
}
