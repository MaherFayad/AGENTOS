/* =============================================================================
 * i18n/direction.ts — what mirrors under dir="rtl", and what must not.
 *
 * Owner: rtl-arabic-pdpl-specialist · Spec §1.4, §2.0, §2.2, §2.3, §2.6.5.
 *
 * The default is: MIRROR EVERYTHING, because that is what the browser does to
 * logical properties for free. This file exists for the exceptions — the
 * surfaces where mirroring would be actively wrong — and to give the other
 * twelve agents one place to check instead of twelve opinions.
 *
 * The test for whether something mirrors is not "is it on the left". It is:
 *   Does this arrangement encode READING ORDER?  → mirror it.
 *   Does it encode SPACE, TIME or DATA?          → leave it alone.
 * ============================================================================= */

import { directionOf, type Direction, type Locale } from './config';

/** Surfaces that mirror. Reading order is the reason in every case. */
export const MIRRORS = {
  /** §2.3 map drawer: inline-start (left in LTR, right in RTL). */
  'drawer.map': '§2.3 — the map drawer opens from the inline-start edge',
  /** §2.6.5 chart drawer: the mirror of the map drawer, inline-end. */
  'drawer.chart': '§2.6.5 — the chart drawer opens from the inline-end edge',
  /** §2.2 rail labels on screen edges, and their ‹ › chevrons. */
  'map.railLabels': '§2.2 — BACK OFFICE / DEALS rails swap edges; chevrons point the other way',
  /** §2.0 breadcrumb strip: "← All departments". */
  'shell.breadcrumb': '§2.0 — the breadcrumb and its arrow follow reading order',
  /** §2.0 segmented control: Map · Dashboards · Chart · Sessions reverses. */
  'shell.segmentedControl': '§2.0 — tab order is reading order',
  /** §2.0 shell corners: search+fullscreen at inline-start, actions at inline-end. */
  'shell.corners': '§2.0 — top-bar and bottom-bar clusters swap sides',
  /** §2.3 drawer close ✕, all list bullets, chips, disclosure chevrons. */
  'component.disclosure': 'chevrons and carets point along the reading direction',
} as const;

/**
 * Surfaces that DO NOT mirror. Each one has a reason that is about the content,
 * not about taste. Flipping any of these is a bug, and `check-rtl.mjs` will not
 * flag their physical properties — they carry an `rtl-exempt:` comment instead,
 * so the exemption is visible rather than assumed.
 */
export const DOES_NOT_MIRROR = {
  /** §2.1 — a galaxy has no reading direction. Departments sit at fixed angles
   *  around a core; mirroring would move DEALS to the other side of the sky for
   *  Arabic readers and break every screenshot, every saved viewport, and the
   *  precomputed layout in contracts/graph-layout.md. */
  'map.canvas': '§2.1 — the galaxy is space, not a sentence',
  /** §2.5 — chart axes, series order and legends stay LTR. A time axis running
   *  right-to-left is not an Arabic convention, it is a misread chart. The
   *  chart is an LTR island inside the RTL page. */
  'dashboards.charts': '§2.5 — axes and series are data, and data is LTR here',
  /** §2.6 — the rollout matrix columns are phases 1→4, i.e. time. Time does not
   *  reverse because the page does. Row headers and cell text still mirror. */
  'chart.phaseColumns': '§2.6 — phases 1→4 are a timeline',
  /** §2.3 / §3.1 — progress bars and run timelines fill in the direction the
   *  work advances, which is temporal, not textual. */
  'component.progress': '§1.6 — progress is temporal',
  /** §2.3 / §3.1 — the SSE console and any code/log output. Monospace program
   *  output is LTR by definition; mirroring it would reorder stack traces. */
  'component.console': '§2.3, §3.1 — program output is LTR',
} as const;

export type MirroredSurface = keyof typeof MIRRORS;
export type FixedSurface = keyof typeof DOES_NOT_MIRROR;

export const mirrors = (surface: MirroredSurface | FixedSurface): boolean => surface in MIRRORS;

/**
 * +1 / −1 for the inline axis. The ONE place a component is allowed to think in
 * terms of a sign: Framer Motion's `x` and d3's translate take numbers, not
 * logical properties, so the sign has to come from somewhere. It comes from
 * here, and never from `locale === 'ar'` written inline in a component.
 *
 *   const x = width * inlineSign(dir);   // slides in from the inline-start edge
 */
export const inlineSign = (dir: Direction): 1 | -1 => (dir === 'rtl' ? 1 : -1);

/** Convenience for components that hold a locale rather than a direction. */
export const inlineSignFor = (locale: Locale): 1 | -1 => inlineSign(directionOf(locale));

/**
 * The drawer anchors, as logical edges. Both drawers use the same CSS
 * (`inset-inline-start: 0` / `inset-inline-end: 0`) and the mirroring is the
 * browser's job. `drawer-engineer` consumes this so the two drawers cannot
 * drift apart.
 */
export const DRAWER_ANCHOR = {
  map: 'inline-start',
  chart: 'inline-end',
} as const;

export type DrawerAnchor = (typeof DRAWER_ANCHOR)[keyof typeof DRAWER_ANCHOR];
