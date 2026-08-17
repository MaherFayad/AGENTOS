# CONTRACT — Graph layout payload

**Owner:** `map-galaxy-engineer` · **Source:** spec §2.1–2.2 · **Status:** draft

The map's layout is **precomputed once per skills-repo change and stored**, then hydrated
client-side, so node positions are stable between visits (§2.1 — theirs is stable, and a
map that reshuffles every reload feels cheap). The client runs d3-force only for
interaction warmth (drag springs), seeded from these positions.

## Payload — `GET /api/p/:project/graph`

```jsonc
{
  "version": "sha256:…",          // hash of the agents/ tree; client caches on it
  "computedAt": "2026-08-15T18:40:00Z",
  "bounds": { "x": [-1200, 1200], "y": [-900, 900] },
  "core": { "x": 0, "y": 0,
            "brainCompleteness": 0.15,   // §3.3 particle count/brightness
            "brainAnswered": 3,          // the count behind the fraction — null if unmeasured
            "brainTotal": 20 },
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

## `core` — Second Brain completeness (§3.3)

The galaxy's particle count and brightness scale with this number, so it is the most
visible claim the product makes about itself. Three rules, and they are not preferences:

1. **It is measured from the `<!-- UNANSWERED: Qn -->` markers in `company/COMPANY.md`**,
   by `scripts/lib/brain-completeness.mjs` — the only implementation. Twenty markers, one
   per interview question; `answered = 20 − markers left`. Nothing else counts: not `## `
   headings (authored once, never move — this is what reported a 0/20 brain as 45%), not
   prose length (the template's own instructions are prose), not `company/sources/*`
   (easier to move than an answer, so it would inflate). The interview SKILL calls the gap
   list "the honest completeness signal"; COMPANY.md's header forbids deleting a marker to
   make the file look finished. The markers are therefore the contract.
2. **`brainAnswered` / `brainTotal` travel with the fraction.** A bare `0.45` is
   unauditable; `0.45` next to `9 of 20` can be checked against the file by anyone holding
   the payload. `null` on either means *not measured* — a different claim from zero, and
   rendered differently. A count without its denominator, or above it, is dropped by the
   client parser rather than repeated in words.
3. **Two producers, and the lower one wins.** `apps/runner` publishes
   `company/.brain.json` `{completeness, answered, total}` and `build-graph.mjs` honours
   it — but only when it does not claim *more* than the markers admit. On disagreement the
   build takes the marker measurement and warns. The asymmetry is the point: a
   disagreement between the two producers can cost brightness, never invent it (CLAUDE.md
   rule 9).

**Zero looks like this, deliberately.** No particles at all (`particleBudget(0) === 0`),
plus two things that make the emptiness legible rather than broken: the canvas draws a
dashed ring at the galaxy radius rotating on the same 120s clock the swirl would use — a
failed render produces nothing, never a dotted circle — and the SVG layer states the count
in words under the core (`svg/BrainEmptyState`), which is also what a screen reader gets.
Both disappear at the first answered question, from which point the swirl carries the
signal on its own.

## Layout algorithm (§2.1)

Four forces — link (tree edges) + manyBody (repulsion) + **radial per department**
(holds the 7 branches at their angles) + collide — solved by `scripts/lib/layout.mjs`
(ADR-006). The engine is a pure function
`computeLayout(agents, previousPositions, opts) -> GraphPayload`, where `opts` is
`{ brainCompleteness?: number }` (0…1, default 0) plus layout knobs (ADR-003). It never
reads `company/` itself. Coordinates are snap-rounded to 1 decimal and stored.

Client-side, drag warmth and the 700ms department camera are interaction — not a cold
simulation. The client hydrates every node from this payload.

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

`WS /ws/p/:project/graph` pushes `{version, added[], removed[], changed[]}`. The client
re-seeds the simulation with existing positions frozen and lets only new nodes settle — so
a weekly agent drop animates in without the whole map jumping. This is a feature, not an
optimization; do not replace it with a full refetch.

## Both endpoints name their project, and a client may not spell them itself

M15 moved both under `/api/p/:project` and `/ws/p/:project` (ADR-015). The unscoped forms
still exist and answer **400 `project_scope_missing`**; the unscoped socket path is not
registered at all.

**Build both URLs from `RUNNER_ROUTES` via `projectPath()`** — never from a string literal.
This is not style. The map held the two paths as literals, so when they moved, the HTTP
call took a 400 that the client counted as one more "not built" and fell through to the
static artifact, and the socket connected to nothing. The galaxy still drew, from a file,
and live drops silently stopped for a milestone. A literal is what made a route change
survivable-looking; a helper makes it a compile error.

When the caller cannot name a project, the correct URL is **`null` — do not ask.** Not the
unscoped path (a 400 swallowed by a fallback is precisely the failure above) and not the
artifact (see below). Reference implementations: `apps/web/src/map/data/socket.ts` and
`projectApiUrl` in `apps/web/src/components/shell/useSearchIndex.ts`.

## Artifact — `/graph.json`, and the day it stops being safe

`npm run graph:build` writes `apps/web/public/graph.json` and the client falls back to it
when the runner cannot serve the payload (ADR-003). It is what makes the map work with no
runner at all, and it stays.

**It carries no project, and the payload has no field for one.** That is sound only while
the coordinator mounts exactly one library, which is the M15 state (`/api/status` →
`projects.mounted`). The moment a second library is mounted, this file becomes one
project's map served under whatever project the URL happens to name — the exact hazard the
segment exists to remove. The fix at that point is a `project` field on `GraphPayload`
written by `scripts/build-graph.mjs` and checked against the URL's segment before the
fallback is accepted, or dropping the fallback. Whoever mounts the second project owns
that change; it is deliberately not pre-built here (`comms/specs/map.md` REQ-MAP-40).
