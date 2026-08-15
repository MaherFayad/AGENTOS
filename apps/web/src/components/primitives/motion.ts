/**
 * motion.ts — spec §1.6, the single source of every duration and easing.
 *
 * THIS IS THE ONLY MODULE ALLOWED TO TYPE A DURATION NUMBER.
 * `scripts/check-tokens.mjs` fails the build on a hardcoded `320ms`, a
 * `transition: … .3s`, a `duration-[400ms]` arbitrary utility or a framer
 * `transition={{ duration: 0.5 }}` anywhere else under apps/web.
 *
 * CSS-side, prefer the Tailwind utilities (`duration-drawer`, `ease-reveal`) —
 * they read the same tokens from tokens.css and inherit the reduced-motion
 * guard automatically. Import from here when the value must reach JS:
 * Framer Motion transitions, d3 `.duration()`, requestAnimationFrame loops.
 *
 * Owner: design-system-guardian
 */

import { useSyncExternalStore } from 'react';

/* -----------------------------------------------------------------------------
 * Durations, in milliseconds (§1.6).
 * -------------------------------------------------------------------------- */
export const DURATION = {
  /** Section/panel reveal. App uses it for panels and drawers ONLY, not scroll. */
  reveal: 500,
  /** Drawer slide-in: left for the map drawer, right for the chart drawer. */
  drawer: 320,
  /** Map edges relax after a d3-force drag release. */
  relax: 600,
  /** Department transition: d3-zoom transform + label cross-fade. */
  zoom: 700,
  /** KPI numerals count up on mount; progress bars animate width. */
  countUp: 300,
  /** Not in §1.6 — owner addition so hover states are not a magic number. */
  hover: 160,
} as const;

export type DurationName = keyof typeof DURATION;

/** Seconds, for Framer Motion, which takes seconds and not milliseconds. */
export const SECONDS = {
  reveal: DURATION.reveal / 1000,
  drawer: DURATION.drawer / 1000,
  relax: DURATION.relax / 1000,
  zoom: DURATION.zoom / 1000,
  countUp: DURATION.countUp / 1000,
  hover: DURATION.hover / 1000,
} as const;

/* -----------------------------------------------------------------------------
 * Easings (§1.6).
 * -------------------------------------------------------------------------- */
/** CSS `transition-timing-function` strings. */
export const EASE = {
  reveal: 'cubic-bezier(.2,.7,.2,1)',
  drawer: 'cubic-bezier(.2,.7,.2,1)',
  zoom: 'ease-in-out',
} as const;

/** The same curves as Framer Motion cubic-bezier tuples. */
export const EASE_ARRAY = {
  reveal: [0.2, 0.7, 0.2, 1] as [number, number, number, number],
  drawer: [0.2, 0.7, 0.2, 1] as [number, number, number, number],
  zoom: [0.42, 0, 0.58, 1] as [number, number, number, number], // ease-in-out
};

/** Reveal travel distance: translateY(12px → 0). */
export const REVEAL_Y = 12;

/** Drawer scrim. A token reference, never an rgba literal. */
export const SCRIM = 'var(--scrim)';

/* -----------------------------------------------------------------------------
 * Framer Motion variants. Import these rather than re-describing the motion.
 * -------------------------------------------------------------------------- */

/** §1.6 section reveal — opacity 0→1 + translateY 12px→0 over 500ms. */
export const reveal = {
  initial: { opacity: 0, y: REVEAL_Y },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: REVEAL_Y },
  transition: { duration: SECONDS.reveal, ease: EASE_ARRAY.reveal },
};

/** §1.6 drawer — 320ms slide. `side: 'left'` for MAP, `'right'` for CHART. */
export const drawer = (side: 'left' | 'right' = 'left') => {
  const offset = side === 'left' ? '-100%' : '100%';
  return {
    initial: { x: offset },
    animate: { x: 0 },
    exit: { x: offset },
    transition: { duration: SECONDS.drawer, ease: EASE_ARRAY.drawer },
  };
};

/** Scrim behind a drawer — fades with the drawer, no travel. */
export const scrim = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: SECONDS.drawer, ease: EASE_ARRAY.drawer },
};

/** §1.6 department transition — d3-zoom transform, 700ms ease-in-out. */
export const zoom = {
  duration: DURATION.zoom,
  ease: EASE.zoom,
  easeArray: EASE_ARRAY.zoom,
};

/** §1.6 map — edges relax over ~600ms after `alphaTarget(0.3)` restart. */
export const relax = {
  duration: DURATION.relax,
  alphaTarget: 0.3,
} as const;

/** §1.6 mount — KPI numerals count up over 300ms. */
export const countUp = {
  duration: DURATION.countUp,
} as const;

/** §1.6 / §2.4 dashboards carousel. */
export const carousel = {
  perspective: 1400,
  rotate: 35,
  frontScale: 1,
  rearScale: 0.82,
  rearBrightness: 0.5,
  /** Drag-to-spin momentum. */
  spring: { type: 'spring' as const, stiffness: 120, damping: 20, mass: 0.9 },
};

/* -----------------------------------------------------------------------------
 * Reduced motion.
 * -------------------------------------------------------------------------- */

const QUERY = '(prefers-reduced-motion: reduce)';

/** SSR-safe one-shot read. Returns false on the server. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(QUERY).matches;
}

/**
 * Live `prefers-reduced-motion`. Kill the idle galaxy rotation, edge pulses,
 * count-ups and carousel momentum when this is true — and keep the end state.
 * An instant jump to the final value is correct; a frozen half-animation is not.
 *
 * Deliberately implemented with useSyncExternalStore so the first client render
 * matches the server (false) and then corrects, instead of hydration-mismatching.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mql = window.matchMedia(QUERY);
  // Safari < 14 only has addListener; both are cheap to guard.
  if (mql.addEventListener) {
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }
  mql.addListener(onChange);
  return () => mql.removeListener(onChange);
}

function getSnapshot(): boolean {
  return prefersReducedMotion();
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * Collapse any duration to an instant when motion is reduced.
 * `withReducedMotion(DURATION.drawer, reduced)` → 0 when reduced.
 */
export function withReducedMotion(ms: number, reduced: boolean): number {
  return reduced ? 0 : ms;
}
