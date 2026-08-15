/**
 * Edge geometry and the travelling pulse dots. Pure — no React, no DOM.
 *
 * §2.1: "Edges: 1px rgba(255,255,255,.14), slight curves (quadratic), with occasional
 * orange pulse dots traveling along edges of live branches (2px dot, 3s linear,
 * staggered) — this is the 'alive' feel."
 */

import type { GraphEdge, GraphNode } from '@agnetos/contracts';

export interface Point {
  x: number;
  y: number;
}

/**
 * The quadratic control point for an edge. `curve` is a signed fraction of edge length
 * (from the layout engine, deterministic per edge), applied perpendicular to the chord —
 * so the bend is proportional and a long branch does not look kinked.
 */
export function controlPoint(a: Point, b: Point, curve: number): Point {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  // Perpendicular unit vector, scaled by the signed curvature.
  return { x: mx + (-dy / len) * len * curve * 0.5, y: my + (dx / len) * len * curve * 0.5 };
}

/** SVG path data for one edge. */
export function edgePath(a: Point, b: Point, curve: number): string {
  const c = controlPoint(a, b, curve);
  return `M${a.x},${a.y}Q${c.x},${c.y} ${b.x},${b.y}`;
}

/** Point at parameter `t` ∈ [0,1] along the quadratic Bézier. */
export function pointOnEdge(a: Point, b: Point, curve: number, t: number): Point {
  const c = controlPoint(a, b, curve);
  const u = 1 - t;
  return {
    x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
    y: u * u * a.y + 2 * u * t * c.y + t * t * b.y,
  };
}

/**
 * §2.1's "small orange satellite dot on their outbound edge" for a live node. Placed a
 * little way along the edge leaving the node, not at the midpoint, so it reads as
 * *emitted by* the node rather than as decoration on the line.
 */
export const SATELLITE_T = 0.22;

/** §2.1 — 3s linear, staggered. One period, in ms. */
export const PULSE_PERIOD_MS = 3000;

/**
 * A stable per-edge stagger in [0,1). Derived from the edge's identity rather than its
 * index, so pulses do not re-choreograph when an agent is added mid-list — the same
 * reasoning as the layout's deterministic curvature.
 */
export function pulseOffset(edge: Pick<GraphEdge, 'source' | 'target'>): number {
  let h = 0x811c9dc5;
  const key = `${edge.source}->${edge.target}`;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return (h % 1000) / 1000;
}

/** Where a pulse dot sits on its edge at time `t` ms. Linear, per §2.1. */
export function pulseT(edge: Pick<GraphEdge, 'source' | 'target'>, elapsedMs: number): number {
  return ((elapsedMs / PULSE_PERIOD_MS + pulseOffset(edge)) % 1 + 1) % 1;
}

/**
 * §2.1 says pulses are *occasional* — every live edge firing at once reads as a circuit
 * diagram, not as life. One in three, chosen deterministically per edge.
 */
export function isPulseCarrier(edge: Pick<GraphEdge, 'source' | 'target'>): boolean {
  return Math.floor(pulseOffset(edge) * 1000) % 3 === 0;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Node presentation rules (§2.1, §3.2, §3.4)
 * ──────────────────────────────────────────────────────────────────────────── */

/** §2.1 — "Dormant nodes are dimmed to 45% opacity." */
export const DORMANT_OPACITY = 0.45;

/** §2.1 — live ring: 2px stroke at +4px offset from the node edge. */
export const LIVE_RING_OFFSET = 4;
export const LIVE_RING_WIDTH = 2;

export interface NodePresentation {
  opacity: number;
  /** 2px copper ring at +4px (§2.1, live only). */
  ring: boolean;
  /** Amber halo — `failing`, or flagged by the audit engine (§3.4). */
  halo: boolean;
  /** Amber pulse while a run waits on a human gate (§3.2). */
  pulse: boolean;
  /** Tiny clock badge for a scheduled agent (§3.2). */
  clock: boolean;
}

export function presentation(node: GraphNode): NodePresentation {
  return {
    opacity: node.status === 'draft' ? DORMANT_OPACITY : 1,
    ring: node.status === 'live',
    halo: node.status === 'failing',
    pulse: node.approvalPending,
    clock: node.scheduled,
  };
}

/**
 * `YOUR TREE` (§2.2) filters to installed/live agents only. Anchors always survive the
 * filter — otherwise a department with no live agents loses its label and its branch, and
 * the view would silently claim the department does not exist.
 */
export function passesYourTree(node: GraphNode, enabled: boolean): boolean {
  if (!enabled) return true;
  return node.kind === 'anchor' || node.status === 'live';
}

/** Index nodes by id once; every renderer needs it and nobody should rebuild it per frame. */
export function indexNodes(nodes: readonly GraphNode[]): Map<string, GraphNode> {
  return new Map(nodes.map((n) => [n.id, n]));
}

/** Resolve an edge endpoint, treating `core` as the origin (it is not in `nodes[]`). */
export function endpoint(id: string, index: Map<string, GraphNode>, core: Point): Point | null {
  if (id === 'core') return core;
  return index.get(id) ?? null;
}
