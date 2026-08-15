/**
 * Graph layout payload — the shape of `GET /api/graph` and `agents/_registry/positions.json`.
 *
 * Normative prose: `comms/contracts/graph-layout.md` (owner: `map-galaxy-engineer`).
 * Produced by: `scripts/lib/layout.mjs` (ADR-003 one engine, ADR-004 our solver).
 * Consumed by: `apps/web/src/map/**`, the runner's `/api/graph` and `/ws/graph`.
 *
 * Spec: §2.1 (galaxy), §2.2 (department view), §3.2 (schedule/approval badges),
 * §3.3 (brain completeness drives the core), §3.4 (audit halo).
 */

/* ────────────────────────────────────────────────────────────────────────────
 * Nodes
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Three sizes, three meanings (§2.1). `r` in the payload is a **radius**; the spec quotes
 * diameters, so anchor 44px ⇒ `r: 22`, job 28–32px ⇒ `r: 14 | 16`, leaf 8–10px ⇒ `r: 4 | 5`.
 */
export type GraphNodeKind = 'anchor' | 'job' | 'leaf';

/** Mirrors frontmatter `status:` (Part IV). Drives the ring / dim / halo treatments. */
export type GraphNodeStatus = 'live' | 'draft' | 'failing';

export interface GraphNode {
  /** `"{department}/{slug}"` for jobs, `"{department}/_anchor"` for anchors,
   *  `"{department}/{slug}/{leaf}"` for `breaks_into` leaves. Stable across builds. */
  id: string;
  kind: GraphNodeKind;
  /** Display label — frontmatter `name`, or the department label for an anchor. */
  label: string;
  /** ADR-001 department slug. Anchors and leaves inherit it from their branch. */
  department: string;
  /** Frontmatter `cluster` — the §2.2 sub-cluster caption this node groups under. */
  cluster: string | null;
  /** lucide icon name (frontmatter `icon`). Leaves have none — they are plain dots. */
  icon: string | null;
  status: GraphNodeStatus;
  /** frontmatter `schedule:` present ⇒ tiny clock badge (§3.2). */
  scheduled: boolean;
  /** A run is paused on a human gate ⇒ amber pulse (§3.2). Never set from frontmatter
   *  alone: `approval: required` is a *capability*, this is a *pending state*. */
  approvalPending: boolean;
  /** Distance from the core: 0 anchor, 1 job, 2 leaf. Sets the radial force target. */
  depth: number;
  x: number;
  y: number;
  /** Radius in px (see `GraphNodeKind`). */
  r: number;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Edges
 * ──────────────────────────────────────────────────────────────────────────── */

/** `tree` = the branch skeleton (core→anchor→job→leaf). `builds-on` = a prerequisite
 *  link from frontmatter `builds_on`, which may cross clusters. */
export type GraphEdgeKind = 'tree' | 'builds-on';

/** Valid edge endpoint for the galaxy core. Resolves to `GraphPayload.core`, which is not
 *  in `nodes[]` because it is not an agent and must never be clickable as one. */
export const CORE_ID = 'core';

export interface GraphEdge {
  /** Node id, or `CORE_ID` for the seven spokes. */
  source: string;
  target: string;
  kind: GraphEdgeKind;
  /** Quadratic control-point offset as a fraction of edge length, signed. §2.1 "slight
   *  curves". Deterministic per edge, so a branch does not re-bend between visits. */
  curve: number;
  /** This edge is on a live branch ⇒ an orange pulse dot travels it (§2.1). */
  pulse: boolean;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Departments and core
 * ──────────────────────────────────────────────────────────────────────────── */

export interface GraphDepartment {
  /** ADR-001 slug. */
  id: string;
  /** ADR-001 display label, rendered wide-tracked caps (§2.1). */
  label: string;
  /** Branch angle in **radians**, from ADR-001 (`index × 360/7`, starting at −90°). */
  angle: number;
  /** The first three clusters from `agents/_registry/clusters.json` — §2.1's "3 tiny
   *  sub-labels beneath". Always length 3; padded with `''` when the registry is thinner,
   *  because an honest gap beats an invented cluster name (CLAUDE.md rule 9). */
  sublabels: [string, string, string];
  /** Node id of this branch's anchor. */
  anchor: string;
  /** Real counts — `liveCount` is `status: live`, which observability sets from real runs
   *  (frontmatter invariant 6). Feeds `N OF 22 LIVE` (§2.2). */
  liveCount: number;
  totalCount: number;
}

/**
 * The Second Brain core (§3.3). `brainCompleteness` ∈ [0,1] scales the galaxy's particle
 * count and brightness — "a delightful, honest progress indicator". At 0 it renders as a
 * bare core dot with no swirl. It is never faked to look populated.
 */
export interface GraphCore {
  x: number;
  y: number;
  brainCompleteness: number;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Payload
 * ──────────────────────────────────────────────────────────────────────────── */

export interface GraphBounds {
  /** `[min, max]` over all node coordinates, padded. Used to fit the initial camera. */
  x: [number, number];
  y: [number, number];
}

export interface GraphPayload {
  /** `sha256:…` over the sorted slugs + layout-relevant frontmatter (ADR-003). The client
   *  caches on it and refetches only when it changes. */
  version: string;
  computedAt: string;
  bounds: GraphBounds;
  core: GraphCore;
  departments: GraphDepartment[];
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** What `agents/_registry/positions.json` stores: the coordinates worth surviving a clone
 *  (ADR-003). Everything else in the payload is re-derivable from frontmatter. */
export interface StoredPositions {
  version: string;
  computedAt: string;
  positions: Record<string, { x: number; y: number }>;
}

/** Convenience for seeding a simulation from stored positions. */
export type PreviousPositions = Record<string, { x: number; y: number }>;

/* ────────────────────────────────────────────────────────────────────────────
 * Live deltas — `WS /ws/graph`
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * The repo watcher pushes deltas, never a full payload (§Part V, `api-contracts.md`).
 * The client re-seeds with existing positions **frozen** and lets only `added` settle, so
 * a weekly agent drop animates in without the map jumping. That is the feature.
 */
export interface GraphDelta {
  version: string;
  added: GraphNode[];
  removed: string[];
  changed: GraphNode[];
  /** Edges are re-sent whole for the touched neighbourhood — cheaper than diffing them
   *  and they carry no position of their own. */
  edges: GraphEdge[];
  /** Present when §3.3 completeness moved, so the galaxy can re-budget its particles. */
  core?: GraphCore;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Camera budget
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Zoom budget (§2.1: "zoom (wheel/pinch, 30%–300%)"). Exported so the shell's −/+ buttons,
 * the map's `d3-zoom` `scaleExtent` and the zoom readout all clamp to the same numbers.
 */
export const ZOOM_MIN = 0.3;
export const ZOOM_MAX = 3;

/**
 * The map does NOT define its own event bus. Two already exist and each has an owner:
 *
 *   - `apps/web/src/lib/shell-bus.ts`   (owner: `shell-navigation-engineer`)
 *     map CONSUMES  `shell:flyTo`, `shell:zoom`, `shell:yourTree`
 *     map PUBLISHES `shell:zoomChanged`, `shell:liveCount`
 *
 *   - `apps/web/src/drawer/events.ts`   (owner: `drawer-engineer`)
 *     map PUBLISHES `openDrawer({ slug, view: 'map' })` on node activation (§2.3).
 *
 * Node ids in this payload are exactly the `slug` those buses expect
 * (`"{department}/{agent}"`), which is what lets the three views address each other
 * without sharing a component.
 */
