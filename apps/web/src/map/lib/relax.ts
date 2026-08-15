/**
 * Drag warmth — the springy node drag from §2.1's interaction budget, and the ~600ms edge
 * relax from §1.6. Pure: it takes positions and time, and returns positions.
 *
 * WHY THIS IS NOT d3-force (an amendment to ADR-006, recorded there):
 *
 *   ADR-006 said the client keeps `d3-force` for drag warmth. `apps/web/package.json` has
 *   no d3 dependency and is owned by another agent, and — more to the point — a full force
 *   simulation is the wrong tool for what §2.1 actually asks for. The stored layout is
 *   canonical (ADR-003): a drag is a gesture, not an edit. Re-running link/charge/collide
 *   on release would let a drag *permanently* rearrange a galaxy whose whole selling point
 *   is that it looks the same on every visit.
 *
 *   So: the dragged node follows the pointer, its graph neighbourhood is pulled along with
 *   an attenuation that falls off by hop count, and on release everything springs back to
 *   the coordinates the build produced. `alpha` starts at 0.3 and decays to nothing over
 *   `DURATION.relax`, which is §1.6's "edges relax over ~600ms" — the same numbers, the
 *   same feel, three orders of magnitude less machinery, and the map is still stable.
 */

import type { GraphEdge } from '@agnetos/contracts';

export interface Point {
  x: number;
  y: number;
}

/** §1.6 — `alphaTarget(0.3)` on grab. Named for the d3 call it replaces. */
export const ALPHA_TARGET = 0.3;

/** Hop-count attenuation of the drag. Beyond this the galaxy does not move at all. */
const PULL = [1, 0.45, 0.18, 0.06];

/** Spring constants. Stiff enough to feel taut, damped enough to overshoot once. */
const STIFFNESS = 0.055;
const DAMPING = 0.78;

/** Below this the node is home and we stop integrating it — otherwise rAF never idles. */
const SETTLED = 0.05;

interface Body {
  /** The build's coordinate. The one truth; a drag never changes it. */
  home: Point;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 0 = the dragged node, 1 = its neighbours, … */
  hops: number;
}

export interface Relaxer {
  /** Begin a drag. Returns false when the id is unknown (a filtered-out node). */
  grab(id: string): boolean;
  /** Pointer moved, in world coordinates. */
  moveTo(x: number, y: number): void;
  /** Let go — the springs take over and everything returns home. */
  release(): void;
  /**
   * Integrate one frame. Returns the displaced nodes, or `null` when everything is home
   * and the caller should stop its rAF loop. Deliberately fixed-step so a slow frame
   * cannot make the spring explode.
   */
  tick(dtMs: number): Map<string, Point> | null;
  /** True while a node is held. */
  readonly dragging: boolean;
  readonly heldId: string | null;
}

/**
 * Breadth-first hop distance from `id` over tree AND `builds-on` edges — a prerequisite
 * link is visually an edge, so it should tug like one.
 */
function neighbourhood(id: string, adjacency: Map<string, string[]>, maxHops: number): Map<string, number> {
  const hops = new Map<string, number>([[id, 0]]);
  let frontier = [id];
  for (let depth = 1; depth <= maxHops; depth++) {
    const next: string[] = [];
    for (const current of frontier) {
      for (const other of adjacency.get(current) ?? []) {
        if (hops.has(other)) continue;
        hops.set(other, depth);
        next.push(other);
      }
    }
    frontier = next;
    if (frontier.length === 0) break;
  }
  return hops;
}

export function buildAdjacency(edges: readonly GraphEdge[]): Map<string, string[]> {
  const adjacency = new Map<string, string[]>();
  const link = (a: string, b: string): void => {
    if (!adjacency.has(a)) adjacency.set(a, []);
    adjacency.get(a)!.push(b);
  };
  for (const e of edges) {
    link(e.source, e.target);
    link(e.target, e.source);
  }
  return adjacency;
}

export function createRelaxer(
  positions: ReadonlyMap<string, Point>,
  edges: readonly GraphEdge[],
): Relaxer {
  const adjacency = buildAdjacency(edges);
  const bodies = new Map<string, Body>();
  let held: string | null = null;
  let pointer: Point = { x: 0, y: 0 };

  const out = new Map<string, Point>();

  return {
    get dragging() {
      return held !== null;
    },
    get heldId() {
      return held;
    },

    grab(id: string): boolean {
      const home = positions.get(id);
      if (!home) return false;
      held = id;
      pointer = { x: home.x, y: home.y };
      for (const [other, hops] of neighbourhood(id, adjacency, PULL.length - 1)) {
        const p = positions.get(other);
        if (!p) continue;
        const existing = bodies.get(other);
        bodies.set(other, {
          home: p,
          x: existing?.x ?? p.x,
          y: existing?.y ?? p.y,
          vx: existing?.vx ?? 0,
          vy: existing?.vy ?? 0,
          hops,
        });
      }
      return true;
    },

    moveTo(x: number, y: number): void {
      pointer = { x, y };
    },

    release(): void {
      held = null;
    },

    tick(dtMs: number): Map<string, Point> | null {
      // Fixed 60fps step, capped at four frames of catch-up. A backgrounded tab that
      // returns with dt = 4000ms must not launch the galaxy off screen.
      const steps = Math.max(1, Math.min(4, Math.round(dtMs / 16.667)));
      let moving = false;
      out.clear();

      for (const [id, body] of bodies) {
        if (held === id) {
          // The held node is kinematic: it *is* the pointer, so the drag has no lag.
          body.x = pointer.x;
          body.y = pointer.y;
          body.vx = 0;
          body.vy = 0;
        } else {
          for (let s = 0; s < steps; s++) {
            // Target = home, displaced toward the dragged node by the hop attenuation.
            let tx = body.home.x;
            let ty = body.home.y;
            if (held !== null) {
              const anchor = bodies.get(held);
              if (anchor) {
                const pull = PULL[body.hops] ?? 0;
                tx += (pointer.x - anchor.home.x) * pull;
                ty += (pointer.y - anchor.home.y) * pull;
              }
            }
            body.vx = (body.vx + (tx - body.x) * STIFFNESS) * DAMPING;
            body.vy = (body.vy + (ty - body.y) * STIFFNESS) * DAMPING;
            body.x += body.vx;
            body.y += body.vy;
          }
        }

        const offset = Math.hypot(body.x - body.home.x, body.y - body.home.y);
        if (offset > SETTLED || Math.hypot(body.vx, body.vy) > SETTLED) {
          moving = true;
          out.set(id, { x: body.x, y: body.y });
        } else {
          body.x = body.home.x;
          body.y = body.home.y;
          body.vx = 0;
          body.vy = 0;
        }
      }

      if (!moving && held === null) {
        bodies.clear();
        return null;
      }
      return out;
    },
  };
}
