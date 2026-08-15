/**
 * Camera maths for the map. Pure, framework-free, d3-free — so it is unit-testable and so
 * the zoom budget is enforced in one place rather than at every call site.
 *
 * The transform convention matches `d3-zoom`'s: screen = world * k + (x, y).
 *
 * Spec: §2.1 (pan, wheel/pinch zoom clamped 30–300%, drill to a department centred on a
 * node), §2.2 (the drill-in camera).
 */

import { ZOOM_MIN, ZOOM_MAX, type GraphBounds, type GraphNode } from '@agnetos/contracts';

export interface Transform {
  x: number;
  y: number;
  k: number;
}

export interface Viewport {
  width: number;
  height: number;
}

export const IDENTITY: Transform = { x: 0, y: 0, k: 1 };

/** §2.1's whole zoom budget, in one function. */
export function clampScale(k: number): number {
  if (!Number.isFinite(k)) return 1;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, k));
}

/** The shell's zoom readout wants a percentage; §2.0. */
export function toPercent(k: number): number {
  return Math.round(clampScale(k) * 100);
}

/** One notch of the shell's −/+ buttons. Geometric so it feels even at both ends. */
export const ZOOM_STEP = 1.3;

export function stepScale(k: number, direction: 'in' | 'out'): number {
  return clampScale(direction === 'in' ? k * ZOOM_STEP : k / ZOOM_STEP);
}

export function applyTransform(t: Transform, x: number, y: number): [number, number] {
  return [x * t.k + t.x, y * t.k + t.y];
}

export function invertTransform(t: Transform, sx: number, sy: number): [number, number] {
  return [(sx - t.x) / t.k, (sy - t.y) / t.k];
}

/** Centre the viewport on a world point at a given scale. */
export function centreOn(point: { x: number; y: number }, k: number, view: Viewport): Transform {
  const scale = clampScale(k);
  return { k: scale, x: view.width / 2 - point.x * scale, y: view.height / 2 - point.y * scale };
}

/**
 * Fit the whole galaxy in view with a margin. Used on first paint so the map opens showing
 * all seven branches rather than an arbitrary corner.
 */
export function fitBounds(bounds: GraphBounds, view: Viewport, margin = 0.9): Transform {
  const worldW = Math.max(1, bounds.x[1] - bounds.x[0]);
  const worldH = Math.max(1, bounds.y[1] - bounds.y[0]);
  const k = clampScale(Math.min(view.width / worldW, view.height / worldH) * margin);
  const centre = { x: (bounds.x[0] + bounds.x[1]) / 2, y: (bounds.y[0] + bounds.y[1]) / 2 };
  return centreOn(centre, k, view);
}

/**
 * §2.1 "click node → drill to department view centered on it". The scale is chosen so a
 * branch fills the viewport comfortably rather than by a magic number: fit the department's
 * own extent, then centre on the clicked node so the thing you clicked stays under the
 * cursor's attention.
 */
export function focusDepartment(
  nodes: readonly GraphNode[],
  department: string,
  view: Viewport,
  centreNodeId?: string,
): Transform {
  const mine = nodes.filter((n) => n.department === department);
  if (mine.length === 0) return IDENTITY;

  const xs = mine.map((n) => n.x);
  const ys = mine.map((n) => n.y);
  const pad = 220;
  const worldW = Math.max(1, Math.max(...xs) - Math.min(...xs) + pad * 2);
  const worldH = Math.max(1, Math.max(...ys) - Math.min(...ys) + pad * 2);
  const k = clampScale(Math.min(view.width / worldW, view.height / worldH));

  const target =
    (centreNodeId && mine.find((n) => n.id === centreNodeId)) ||
    ({
      x: (Math.max(...xs) + Math.min(...xs)) / 2,
      y: (Math.max(...ys) + Math.min(...ys)) / 2,
    } as { x: number; y: number });

  return centreOn(target, k, view);
}

/**
 * §2.1 bottom-centre: "department name of the branch nearest viewport center". Measured
 * against each department's anchor, in world space, so the answer does not change with
 * zoom — only with what you have panned to.
 */
export function nearestDepartment(
  nodes: readonly GraphNode[],
  transform: Transform,
  view: Viewport,
): string | null {
  const anchors = nodes.filter((n) => n.kind === 'anchor');
  if (anchors.length === 0) return null;
  const [cx, cy] = invertTransform(transform, view.width / 2, view.height / 2);

  let best: string | null = null;
  let bestD = Infinity;
  for (const a of anchors) {
    const d = (a.x - cx) ** 2 + (a.y - cy) ** 2;
    // Ties broken by id so the label never flickers between two equidistant branches.
    if (d < bestD || (d === bestD && best !== null && a.department < best)) {
      bestD = d;
      best = a.department;
    }
  }
  return best;
}

/** Linear interpolation between two camera states, for the 700ms drill-in (§1.6). */
export function lerpTransform(from: Transform, to: Transform, t: number): Transform {
  const e = Math.min(1, Math.max(0, t));
  return {
    x: from.x + (to.x - from.x) * e,
    y: from.y + (to.y - from.y) * e,
    k: from.k + (to.k - from.k) * e,
  };
}

/** `ease-in-out` as a function, matching `EASE.zoom` from `primitives/motion`. */
export function easeInOut(t: number): number {
  const e = Math.min(1, Math.max(0, t));
  return e < 0.5 ? 2 * e * e : 1 - (-2 * e + 2) ** 2 / 2;
}

/** Zoom about a fixed screen point (the cursor), preserving what is under it. */
export function zoomAbout(t: Transform, sx: number, sy: number, k: number): Transform {
  const scale = clampScale(k);
  const [wx, wy] = invertTransform(t, sx, sy);
  return { k: scale, x: sx - wx * scale, y: sy - wy * scale };
}
