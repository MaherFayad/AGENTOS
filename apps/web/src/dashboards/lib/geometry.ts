/**
 * Chart geometry — the maths behind the sparkline, the area chart and the bar lists.
 *
 * Pure functions returning SVG path strings and percentages. No React, no colour, no
 * DOM: colour is applied by the component from the data-ink palette, and geometry that
 * knows about colour is geometry you cannot test.
 *
 * Owner: dashboards-engineer · Spec §2.5.3 (40×16 sparkline), §2.5.5.3 (area chart)
 */

export interface Point {
  x: number;
  y: number;
}

export interface Extent {
  min: number;
  max: number;
}

/**
 * The value range a series is drawn against.
 *
 * Baselined at zero for the area chart, because an area whose fill starts at the series
 * minimum exaggerates every wobble into a cliff — the classic truncated-axis lie. A
 * series that is entirely flat gets a synthetic range so it draws as a line through the
 * middle rather than dividing by zero.
 */
export function extentOf(values: readonly number[], baseline = true): Extent {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0) return { min: 0, max: 1 };
  let min = Math.min(...finite);
  let max = Math.max(...finite);
  if (baseline) min = Math.min(0, min);
  if (max === min) max = min === 0 ? 1 : min + Math.abs(min) * 0.5;
  return { min, max };
}

/** Series values → points in an `w × h` box, y inverted for SVG. */
export function project(values: readonly number[], w: number, h: number, extent?: Extent): Point[] {
  const e = extent ?? extentOf(values);
  const span = e.max - e.min || 1;
  const step = values.length > 1 ? w / (values.length - 1) : 0;
  return values.map((v, i) => ({
    x: values.length === 1 ? w / 2 : i * step,
    y: h - ((Number.isFinite(v) ? v : e.min) - e.min) / span * h,
  }));
}

const r = (n: number): string => (Math.round(n * 100) / 100).toString();

/** `M0,16 L4,9 …` — the stroke. Empty string for an empty series, never `NaN`. */
export function linePath(values: readonly number[], w: number, h: number, extent?: Extent): string {
  const pts = project(values, w, h, extent);
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M0,${r(pts[0].y)} L${r(w)},${r(pts[0].y)}`;
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${r(p.x)},${r(p.y)}`).join(' ');
}

/**
 * The same line closed down to the baseline — the 20%-opacity fill under the stroke
 * (§2.5.5.3). Returns `''` when there is nothing to fill, so the component renders no
 * `<path>` at all rather than an invisible one.
 */
export function areaPath(values: readonly number[], w: number, h: number, extent?: Extent): string {
  const line = linePath(values, w, h, extent);
  if (!line) return '';
  const pts = project(values, w, h, extent);
  const first = pts[0];
  const last = pts[pts.length - 1];
  const x0 = pts.length === 1 ? 0 : first.x;
  const x1 = pts.length === 1 ? w : last.x;
  return `${line} L${r(x1)},${r(h)} L${r(x0)},${r(h)} Z`;
}

/**
 * The 40×16 KPI sparkline (§2.5.3). Inset by half the stroke width so the extremes are
 * not clipped by the viewBox — a sparkline whose peak is shaved flat is a lying sparkline.
 */
export const SPARKLINE = { w: 40, h: 16, stroke: 1.25 } as const;

export function sparklinePath(values: readonly number[]): string {
  const inset = SPARKLINE.stroke / 2;
  return linePath(values, SPARKLINE.w, SPARKLINE.h - SPARKLINE.stroke, undefined)
    .split(' ')
    .map((seg) => {
      const m = seg.match(/^([ML])([-\d.]+),([-\d.]+)$/);
      return m ? `${m[1]}${m[2]},${r(Number(m[3]) + inset)}` : seg;
    })
    .join(' ');
}

/**
 * Bar width as a percentage of the widest row (§2.5.5.1).
 *
 * Scaled against the maximum, not the total: the video's bar lists are a comparison
 * between rows, not a share of a whole. A floor of 1.5% keeps a tiny-but-real row
 * visible, because a row you cannot see reads as a row that is not there.
 */
export function barWidths(values: readonly number[]): number[] {
  const max = Math.max(0, ...values.filter((v) => Number.isFinite(v) && v > 0));
  if (max <= 0) return values.map(() => 0);
  return values.map((v) => (Number.isFinite(v) && v > 0 ? Math.max(1.5, (v / max) * 100) : 0));
}

/** Progress-table track fill, 0..1 → 0..100, clamped. Data decides length, never layout. */
export function progressWidth(progress: unknown): number {
  if (typeof progress !== 'number' || !Number.isFinite(progress)) return 0;
  return Math.max(0, Math.min(1, progress)) * 100;
}

/**
 * Nearest series index to a pointer position, for the area chart's hover readout.
 * `-1` when the series is empty, so the caller shows nothing rather than index 0.
 */
export function nearestIndex(count: number, ratio: number): number {
  if (count <= 0) return -1;
  if (count === 1) return 0;
  return Math.max(0, Math.min(count - 1, Math.round(ratio * (count - 1))));
}
