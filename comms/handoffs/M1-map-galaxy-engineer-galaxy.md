---
agent: map-galaxy-engineer
milestone: M1
spec: §2.1 · §2.2
created: 2026-08-15T21:45
status: ready-for-review
---

# M1 — Galaxy view mounted at `/map`

## What exists now

```
apps/web/src/map/MapPage.tsx              mounts MapView from the shell route
apps/web/src/map/MapView.tsx              canvas + SVG composition
apps/web/src/map/canvas/GalaxyCanvas.tsx  starfield, grid, 600-particle swirl, vignette
apps/web/src/map/svg/Nodes.tsx            ivory nodes, copper rings, hover labels
apps/web/src/map/svg/Edges.tsx            quadratic edges, satellites, live pulses
apps/web/src/map/svg/BranchLabels.tsx     serif department caps + three sub-labels
apps/web/src/map/svg/ClusterLabels.tsx    §2.2 floating cluster captions
apps/web/src/map/svg/Watermark.tsx        160px Instrument Serif department name
apps/web/src/map/chrome/FocusRotator.tsx  bottom-centre ‹ DEPT ›
apps/web/src/map/chrome/DepartmentRails.tsx  adjacent rails from ADR-001 neighbours
apps/web/src/map/chrome/EmptyState.tsx    honest empty, no invented counts
apps/web/src/app/(views)/map/layout.tsx   persists the canvas across drill-in URLs
scripts/lib/layout.mjs                   computeLayout(agents, previousPositions, opts)
comms/specs/map.md                       §2.1 · §2.2 claimed
comms/contracts/graph-layout.md          payload + rendering split
```

## How to use it

`/map` mounts `<MapPage />` via the route layout. Drill-in is the same canvas at
`/map/:department`. After `npm run graph:build`, `apps/web/public/graph.json` is the
stored artifact; the client asks `GET /api/graph` first and falls back to `/graph.json`
while the runner has not mounted that route.

Node click emits `openDrawer({ slug, view: 'map' })` and pushes
`/map/{department}/{agent}`. The drawer body is not ours.

## Contracts touched

- `comms/contracts/graph-layout.md` — layout-algorithm paragraph now names
  `scripts/lib/layout.mjs` (ADR-006) and the `opts.brainCompleteness` signature (ADR-003).
- `comms/decisions/ADR-003-layout-precompute.md` — signature line updated.
- `packages/contracts/src/graph.ts` — `GraphDelta.edges` optional (runner frames omit it).
- Decision-request `comms/inbox/map-galaxy-engineer/20260815-1858-runner-engineer-brain-completeness-in-layout.md` **answered: accept**.

## Deliberately not done

- **§2.3 drawer.** Emit and route only. The agent page is an empty slot for
  `drawer-engineer`.
- **Client d3-force.** Drag springs back to stored coordinates (`lib/relax.ts`). A
  client resimulate would shuffle a map that is supposed to look the same every visit.
- **Runner `GET /api/graph` mount.** `apps/runner/src/lib/graph.ts` exists;
  `apps/runner/src/index.ts` still does not serve it. Fallback: `/graph.json`.
- **Department-specific layouts.** Same coordinates, different camera (ADR-003).
- **1440px side-by-side PASS.** First review FAIL (4 findings) patched 2026-08-15T22:02;
  re-review open. Not claiming PASS until fidelity answers.
- **RTL pass.** Rails are logical (`start-0` / `end-0`); M8 owns the rest.
- **A second copy of agent data.** None. Test fixture only under `__fixtures__/`.
- **Galaxy rewrite.** Out of scope for the FAIL patch — only the four numbered findings.
## Verification

- `node scripts/lib/layout.test.mjs` — engine determinism / stability / completeness
  default 0 (pre-existing; not rewritten).
- Markup tests under `apps/web/src/map/**/*.test.ts(x)` — canvas mounts, empty state
  prints no `150` / `0 OF 22`, deltas freeze coordinates, particle budget is 0 at
  completeness 0.
- `npm run validate:coverage` must now claim §2.1 · §2.2 via `comms/specs/map.md`.

## Next agent

`fidelity-qa-reviewer` — 1440px MAP vs their video frame. Then `drawer-engineer`
mounts the left drawer on `/map/:department/:agent`.
