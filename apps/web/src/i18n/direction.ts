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
  /** §2.4 the command-center carousel. Ruled 2026-08-17, because NEITHER table
   *  named it and that omission is what let three components each decide locally.
   *  It is a fixed ordinal list of six named things (ADR-004) presented as a ring
   *  — the ring is presentation, the index is an ordinal, and ordinals are reading
   *  order. It is not `map.canvas`: a department's angle there is a stored
   *  coordinate in contracts/graph-layout.md, and a carousel position is not.
   *
   *  ITS FIX IS THREE COUPLED SITES, NOT ONE. `Carousel.tsx`'s ArrowRight, the
   *  `translateX(offset * STRIDE)` in lib/carousel.ts `cardTransform`, and the
   *  `clientX` drag delta are all physical and all agree with each other today, so
   *  the carousel is internally consistent and only wrong against the page.
   *  Flipping the key handler alone would make ArrowRight walk toward the card on
   *  the reader's left — which is precisely the DepartmentTabs bug, introduced by
   *  the patch meant to fix it. Move all three or none. */
  'dashboards.carousel': '§2.4 — six command centers in a fixed order is a list, not a space',
  /** §2.0 shell corners: search+fullscreen at inline-start, actions at inline-end. */
  'shell.corners': '§2.0 — top-bar and bottom-bar clusters swap sides',
  /** §2.3 drawer close ✕, all list bullets, chips, disclosure chevrons. */
  'component.disclosure': 'chevrons and carets point along the reading direction',
  /** `Plan §12` — the addressing and interrupt badges as a whole. Declared 2026-08-17
   *  by `design-system-guardian` when the two registers landed, and declared HERE
   *  rather than decided in the component, because that is the lesson the carousel
   *  cost: neither table named it, so three components each decided locally and one
   *  shipped backwards.
   *
   *  A badge is a label in a sentence: mark, then sigil, then the run count, joined
   *  by `·`. That is reading order, so the whole run mirrors — and it does so for
   *  free, because the spacing is `gap` and the one enclosure edge is `border-s`.
   *  The `@@` stack lip is inset symmetrically on the inline axis and offset only on
   *  the block axis, so it is the same stack in both directions rather than a
   *  physical property that had to be exempted.
   *
   *  THE PART THAT NEEDED A DECISION: `@`, `#` and `@@` are direction-NEUTRAL
   *  characters (BiDi class ON), so an address sitting against Arabic text takes its
   *  side from whatever runs beside it — `@@sales` can render with the sigils on the
   *  wrong end of the name without anything in the component being wrong. The typed
   *  address is therefore wrapped in `<bdi>`, so the run resolves by its own first
   *  strong character (a kebab slug) instead of by its neighbour. This is the same
   *  answer `ProvenanceBadge` gives `{commit}`, and it is not optional here: the
   *  sigil is the character that distinguishes one run from N. */
  'threads.addressBadge': '`Plan §12` — an address badge is a label in a sentence; its sigil run is bidi-isolated',
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
  /** `Plan §12` — the marks inside `AddressBadge` and `InterruptBadge`. Declared
   *  2026-08-17 by `design-system-guardian`, alongside `MIRRORS['threads.addressBadge']`,
   *  because the badge and the mark inside it answer this question differently and
   *  a single entry would have hidden that.
   *
   *  Both sets of marks are drawn on the BLOCK axis: a message rises into the runs
   *  it becomes, and work runs upward until something interrupts it. A stem, a
   *  crossbar, a trident and a stop bar have no inline asymmetry at all, so there is
   *  nothing to mirror — that was a drawing decision taken to make this one cheap,
   *  not a discovery afterwards.
   *
   *  ONE EXCEPTION, AND IT IS THE ONE WORTH READING: `steer`'s stem steps sideways.
   *  It is a change of course, not a direction of travel — the work is not heading
   *  anywhere on the page — so which side it steps to means nothing, and mirroring it
   *  would assert that it does. Same reasoning as `ProvenanceBadge`'s fork, whose
   *  arms are lineage rather than motion: `check-rtl` will not flag SVG path data, so
   *  this is a promise a reader can check rather than a rule a checker enforces. */
  'threads.registerMarks': '`Plan §12` — arity and interrupt marks are counts and states on the block axis, not sentences',
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

/* -----------------------------------------------------------------------------
 * The keyboard's inline axis — `inlineSign`'s sibling, for arrow keys.
 *
 * Promoted here from `chart/model/direction.ts` on 2026-08-17, granted on
 * `shell-navigation-engineer`'s decision-request. `chart-matrix-engineer` wrote it
 * and deliberately did not promote it — *"if a third caller wants them, that is
 * the moment"* — which was right at one caller and is spent at three:
 * `DepartmentTabs`, `SegmentedControl`, and `dashboards/components/Carousel.tsx`,
 * where the same defect is still live.
 *
 * It lives here because the RULE already does. `MIRRORS['shell.segmentedControl']`
 * — *"tab order is reading order"* — and `DOES_NOT_MIRROR['chart.phaseColumns']`
 * are the two tables that decide whether a given arrow key flips at all; this is
 * their application to a keystroke. A rule and its application in two owners'
 * directories is how they drift, and the alternative on offer had a design-system
 * primitive importing from a view.
 *
 * WHERE IT MUST NOT BE APPLIED, kept verbatim from the original because it is the
 * more valuable half: the matrix grid's arrow keys (`chart/model/keyboard.ts`)
 * stay direction-blind. `DOES_NOT_MIRROR['chart.phaseColumns']` — phases 1→4 are
 * time, and time does not reverse because the page does. The test for whether an
 * arrow key flips is the same one that decides whether the pixels flip: reading
 * order mirrors, space and time do not. Applying this to the grid would be a
 * second bug, not a completion of the first fix.
 * -------------------------------------------------------------------------- */

/**
 * The element's effective direction, by HTML's own rule: the nearest ancestor
 * carrying a `dir` attribute wins, and the document element ends that chain.
 *
 * Read from the DOM rather than from `useI18n()`, and the second reason is the
 * load-bearing one. (a) `useI18n()` throws outside its provider, so it would break
 * every bare-render test of a control. (b) A component's keys should follow the
 * direction it is actually *rendered* in, not the app's locale: §2.5 and §3.1 both
 * put LTR islands inside the RTL page, and a control inside one of those must key
 * LTR.
 *
 * `dir="auto"` resolves per text run and cannot be computed here, so it reads as
 * `ltr` — stated rather than silently assumed.
 *
 * **One surface sets it, as of M16:** `ThreadView`'s `<p>` for a message body, which
 * is the only element in this app whose direction belongs to its content rather than
 * to the reader. Nothing keyboard-driven lives inside it, so this function's `ltr`
 * resolution is never consulted there — but the sentence above used to say *"no
 * surface in this app sets it"*, and a claim about the whole app is exactly the kind
 * that goes stale silently, so it is named here instead of re-derived later.
 */
export function elementDirection(element: Element | null | undefined): Direction {
  const owner = element?.closest('[dir]');
  return owner?.getAttribute('dir')?.toLowerCase() === 'rtl' ? 'rtl' : 'ltr';
}

/**
 * ArrowRight / ArrowLeft → a step along the *list*, once the direction is known.
 * `0` for every other key, so the caller lets it bubble.
 *
 * Pure, so the direction half is provable without a DOM; a component test then
 * proves the DOM half under a real `dir="rtl"` render.
 */
export function inlineStep(key: string, direction: Direction): -1 | 0 | 1 {
  const forward = direction === 'rtl' ? -1 : 1;
  if (key === 'ArrowRight') return forward;
  if (key === 'ArrowLeft') return direction === 'rtl' ? 1 : -1;
  return 0;
}

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
