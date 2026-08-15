# CONTRACT — Graph layout payload

**Owner:** `map-galaxy-engineer` · **Source:** spec §2.1–2.2 · **Status:** draft

The map's layout is **precomputed once per skills-repo change and stored**, then hydrated
client-side, so node positions are stable between visits (§2.1 — theirs is stable, and a
map that reshuffles every reload feels cheap). The client runs d3-force only for
interaction warmth (drag springs), seeded from these positions.

## Payload — `GET /api/graph`

```jsonc
{
  "version": "sha256:…",          // hash of the agents/ tree; client caches on it
  "computedAt": "2026-08-15T18:40:00Z",
  "bounds": { "x": [-1200, 1200], "y": [-900, 900] },
  "core": { "x": 0, "y": 0, "brainCompleteness": 0.62 },   // §3.3 particle count/brightness
  "departments": [
    { "id": "sales", "label": "SALES", "angle": 0.897,      // radians, 7 even branches
      "sublabels": ["lead sourcing", "enrichment", "outreach"],
      "anchor": "node:sales-anchor", "liveCount": 4, "totalCount": 22 }
  ],
  "nodes": [
    { "id": "sales/account-enrichment",
      "kind": "anchor" | "job" | "leaf",   // 44px | 28–32px | 8–10px
      "label": "Account Enrichment",
      "department": "sales", "cluster": "enrichment",
      "icon": "building",
      "status": "live" | "draft" | "failing",
      "scheduled": true,                    // clock badge
      "approvalPending": false,             // amber pulse
      "x": 412.7, "y": -288.1, "r": 30 }
  ],
  "edges": [
    { "source": "sales/database-mining", "target": "sales/account-enrichment",
      "kind": "tree" | "builds-on",
      "curve": 0.18,                        // quadratic control offset
      "pulse": true }                       // orange dot travels this edge (live branch)
  ]
}
```

## Layout algorithm (§2.1)

`d3-force` with four forces: `forceLink` (tree edges) + `forceManyBody` (repulsion) +
**`forceRadial` per department** (holds the 7 branches at their angles) + `forceCollide`.
Run to convergence server-side, snap-round coordinates to 1 decimal, store.

- 7 departments at even angles around the core.
- Node sizes: anchor 44px (line icon in dark ink on ivory), job 28–32px (line icon),
  leaf/skill dot 8–10px (plain).
- Dormant (`status: draft`) nodes render at 45% opacity.
- Edges: 1px `rgba(255,255,255,.14)`, slight quadratic curve.
- ~150 nodes total — perf is a non-issue; correctness and stability are the point.

## Rendering split (non-negotiable)

| Layer | Tech | Contents |
|---|---|---|
| back | one `<canvas>` | starfield (~200 pts, opacity .05–.15), dotted grid, **galaxy particles** (600 on a log spiral + gaussian jitter, hue from the data-ink palette, additive blending, ~120s/rev idle rotation, opacity shimmer) |
| front | SVG | nodes, edges, labels, halos, badges — because they need hit-testing, focus rings, and transitions |

Canvas never handles interaction. SVG never draws the starfield.

## Interaction budget

pan (drag empty space) · zoom wheel/pinch **30%–300%** · drag nodes (springy,
`alphaTarget(0.3)` restart) · hover → name label fades in beneath · click node → drill to
department view centered on it · click department label → department view ·
bottom-center department name with ‹ › to rotate focus.

## Department view deltas (§2.2)

Same payload, different camera: `d3-zoom` transform 700ms ease-in-out with label
cross-fade. Adds the giant Instrument Serif watermark (~160px, `rgba(236,236,238,.05)`),
sub-cluster labels floating in wide-tracked caps, rotated rail labels for the adjacent
departments on both screen edges, and the `N OF 22 LIVE · YOUR TREE` counter (copper
numeral; `YOUR TREE` filters to installed/live only).

## Deltas over WebSocket

`/ws/graph` pushes `{version, added[], removed[], changed[]}`. The client re-seeds the
simulation with existing positions frozen and lets only new nodes settle — so a weekly
agent drop animates in without the whole map jumping. This is a feature, not an
optimization; do not replace it with a full refetch.
