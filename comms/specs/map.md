# Spec — MAP galaxy and department drill-in

> The implementation spec for §2.1 and §2.2 of `skilltree-clone-spec.md`.
> Checked by `npm run validate:coverage`.

## Owner

`map-galaxy-engineer`

## Spec sections covered

§2.1 · §2.2

## Boundaries

Citing is not claiming. The coverage checker treats every `§n.n` under **Spec sections
covered** as an ownership claim, so nothing else is named there. Neighbours:

| Section | Owner | What is mine | What is theirs |
|---|---|---|---|
| §2.0 | `shell-navigation-engineer` | consume `shell:flyTo` / `shell:zoom` / `shell:yourTree`; publish `shell:zoomChanged` / `shell:liveCount` | the overlay chrome, search, LIVE counter, YOUR TREE toggle |
| §2.3 | `drawer-engineer` | emit `openDrawer({ slug, view: 'map' })` on job/leaf activation | the left drawer panel |
| §3.2 | `runner-engineer` | render clock badge / amber pulse from payload fields | schedule writes, approval gates, `/ws/graph` `approvalPending` overlay |
| §3.3 | `runner-engineer` | scale particle count/brightness from `core.brainCompleteness`; **measure it** in `scripts/lib/brain-completeness.mjs` from COMPANY.md's `<!-- UNANSWERED: Qn -->` markers, and render the 0/20 empty state | the interview agent, the write-back, `/api/status`, `company/.brain.json` |
| §3.4 | `agent-library-curator` | amber halo when `status: failing` | the audit engine that sets failing |
| §1.5 / §1.6 | `design-system-guardian` | paint starfield/grid/vignette from tokens; `DURATION.zoom` / `DURATION.relax` | `tokens.css`, `primitives/motion.ts` |

## Decisions

1. **One engine, two callers, stored positions (ADR-003).** `computeLayout(agents, previousPositions, opts)` in `scripts/lib/layout.mjs`. `opts.brainCompleteness` is 0…1, default 0 — an input, never a filesystem read of `company/`. Accepted in the runner's decision-request.

2. **The build-time solver is ours (ADR-006).** d3-force's `jiggle()` is `Math.random()`. Client drag warmth is a hop-attenuated spring back to stored coordinates (`lib/relax.ts`), not a second force simulation — a drag is a gesture, not an edit.

3. **Canvas never hits; SVG never paints the sky.** One `<canvas aria-hidden>` for starfield, dotted grid, galaxy particles, core dot, vignette. SVG for nodes, edges, labels, watermarks, hit-testing.

4. **The layout lives in `map/layout.tsx`.** `/map`, `/map/:department` and `/map/:department/:agent` share one canvas instance so the 700ms camera move actually plays. Page files are empty slots.

5. **Honest empty if the payload is missing.** `GET /api/graph`, then `/graph.json` (the ADR-003 artifact Next can serve without the runner). Neither a skeleton of 150 nodes nor a fake LIVE count. Completeness 0 ⇒ zero particles, one core dot.

6. **Frontmatter is projected, not copied.** The map holds no agent records of its own. Everything on a node is a field from the graph payload, which the layout engine projected from `agents/**/SKILL.md`.

7. **Live drops freeze existing positions.** `/ws/graph` `added` nodes fade in at the coordinates the engine already solved. `changed` may update status; `x`/`y` stay.

## Coverage

| ID | Spec § | Requirement | Implemented in | Verified by |
|---|---|---|---|---|
| REQ-MAP-01 | §2.1 | Starfield is ~200 1px points at opacity .05–.15, screen-space, on one canvas | `apps/web/src/map/lib/particles.ts` · `apps/web/src/map/canvas/GalaxyCanvas.tsx` | `apps/web/src/map/lib/particles.test.ts` |
| REQ-MAP-02 | §2.1 | Dotted grid uses `--dot-pitch` / `--dot-color` (no hex) and pans with the camera | `apps/web/src/map/canvas/GalaxyCanvas.tsx` | `apps/web/src/map/MapView.test.tsx` |
| REQ-MAP-03 | §2.1 | Galaxy is 600 particles on a log spiral + gaussian jitter at completeness 1 | `apps/web/src/map/lib/particles.ts` | `apps/web/src/map/lib/particles.test.ts` |
| REQ-MAP-04 | §2.1 | Particle hues resolve `--ink-copper` / `--ink-teal` / `--ink-coral` / `--ink-lavender` at paint time | `apps/web/src/map/lib/particles.ts` · `apps/web/src/map/canvas/GalaxyCanvas.tsx` | `apps/web/src/map/lib/particles.test.ts` |
| REQ-MAP-05 | §2.1 | Additive blending, ~120s/rev idle rotation, opacity shimmer; rotation dies under `prefers-reduced-motion` | `apps/web/src/map/lib/map-motion.ts` · `apps/web/src/map/canvas/GalaxyCanvas.tsx` | manual — reduced-motion toggle, see Test plan |
| REQ-MAP-06 | §2.1 | One bright core dot is present even at completeness 0 | `apps/web/src/map/canvas/GalaxyCanvas.tsx` | `apps/web/src/map/lib/particles.test.ts` |
| REQ-MAP-07 | §2.1 | Completeness 0 ⇒ 0 particles (honest empty swirl) | `apps/web/src/map/lib/particles.ts` | `apps/web/src/map/lib/particles.test.ts` |
| REQ-MAP-08 | §2.1 | Vignette `--bg` → `--bg-3` at the edges | `apps/web/src/map/canvas/GalaxyCanvas.tsx` | manual — 1440px side-by-side |
| REQ-MAP-09 | §2.1 | Canvas is `aria-hidden` and `pointer-events-none` | `apps/web/src/map/canvas/GalaxyCanvas.tsx` | `apps/web/src/map/MapView.test.tsx` |
| REQ-MAP-10 | §2.1 | Layout is precomputed, stored, hydrated — `computeLayout(agents, previousPositions, opts)` | `scripts/lib/layout.mjs` · `scripts/build-graph.mjs` | `scripts/lib/layout.test.mjs` |
| REQ-MAP-11 | §2.1 | Seven department branches at even ADR-001 angles | `scripts/lib/layout.mjs` · `packages/contracts/src/departments.ts` | `scripts/lib/layout.test.mjs` |
| REQ-MAP-12 | §2.1 | Node radii: anchor 22, job 14–16, leaf 4–5 (spec diameters 44 / 28–32 / 8–10) | `scripts/lib/layout.mjs` · `apps/web/src/map/svg/Nodes.tsx` | `scripts/lib/layout.test.mjs` |
| REQ-MAP-13 | §2.1 | Nodes are ivory filled circles; anchors/jobs carry a line icon; leaves are plain | `apps/web/src/map/svg/Nodes.tsx` | `apps/web/src/map/lib/geometry.test.ts` |
| REQ-MAP-14 | §2.1 | Live nodes get a 2px copper ring at +4px offset | `apps/web/src/map/lib/geometry.ts` · `apps/web/src/map/svg/Nodes.tsx` | `apps/web/src/map/lib/geometry.test.ts` |
| REQ-MAP-15 | §2.1 | Live branches carry a small copper satellite on the outbound edge | `apps/web/src/map/svg/Edges.tsx` | `apps/web/src/map/lib/geometry.test.ts` |
| REQ-MAP-16 | §2.1 | Draft nodes render at 45% opacity | `apps/web/src/map/lib/geometry.ts` | `apps/web/src/map/lib/geometry.test.ts` |
| REQ-MAP-17 | §2.1 | Edges are 1px `--ivory` at .14 opacity, slight quadratic curve | `apps/web/src/map/svg/Edges.tsx` · `apps/web/src/map/lib/geometry.ts` | `apps/web/src/map/lib/geometry.test.ts` |
| REQ-MAP-18 | §2.1 | Occasional copper pulse dots travel live edges (3s linear, staggered); killed under reduced motion | `apps/web/src/map/svg/Edges.tsx` · `apps/web/src/map/lib/geometry.ts` | manual — reduced-motion toggle |
| REQ-MAP-19 | §2.1 | Department labels are wide-tracked serif caps 18–20px `--ivory-2` +0.4em with three 11px `--ink-3` sub-labels | `apps/web/src/map/lib/map-type.ts` · `apps/web/src/map/svg/BranchLabels.tsx` · `apps/web/src/map/lib/branches.ts` | `apps/web/src/map/MapView.test.tsx` |
| REQ-MAP-20 | §2.1 | Bottom-center nearest-department name with ‹ › to rotate focus | `apps/web/src/map/chrome/FocusRotator.tsx` · `apps/web/src/map/lib/camera.ts` | `apps/web/src/map/lib/camera.test.ts` |
| REQ-MAP-21 | §2.1 | Pan empty drag, wheel/pinch zoom clamped 30–300% | `apps/web/src/map/MapView.tsx` · `apps/web/src/map/lib/camera.ts` | `apps/web/src/map/lib/camera.test.ts` |
| REQ-MAP-22 | §2.1 | Node drag is springy and returns to stored coordinates (~600ms relax) | `apps/web/src/map/lib/relax.ts` | `apps/web/src/map/lib/relax.test.ts` |
| REQ-MAP-23 | §2.1 | Hover fades the name label in beneath the node | `apps/web/src/map/svg/Nodes.tsx` | `apps/web/src/map/MapView.test.tsx` |
| REQ-MAP-24 | §2.1 | Click node drills to the department centered on it; click department label opens department view | `apps/web/src/map/MapView.tsx` · `apps/web/src/map/svg/BranchLabels.tsx` | `apps/web/src/map/lib/slugs.test.ts` |
| REQ-MAP-25 | §2.1 | `/map` mounts the galaxy (canvas + SVG), not a `ViewMount` placeholder | `apps/web/src/app/(views)/map/layout.tsx` · `apps/web/src/app/(views)/map/page.tsx` · `apps/web/src/map/MapPage.tsx` | `apps/web/src/map/MapView.test.tsx` |
| REQ-MAP-26 | §2.1 | Missing graph payload shows an honest empty state with no fabricated node counts | `apps/web/src/map/chrome/EmptyState.tsx` · `apps/web/src/map/data/useGraph.ts` | `apps/web/src/map/MapView.test.tsx` · `apps/web/src/map/data/parse.test.ts` |
| REQ-MAP-27 | §2.1 | `/ws/graph` deltas freeze existing positions and fade in added nodes | `apps/web/src/map/data/delta.ts` · `apps/web/src/map/data/useGraph.ts` | `apps/web/src/map/data/delta.test.ts` |
| REQ-MAP-28 | §2.2 | Department view is a 700ms ease-in-out camera transform over the same payload | `apps/web/src/map/lib/animate.ts` · `apps/web/src/map/lib/camera.ts` · `apps/web/src/map/MapView.tsx` | `apps/web/src/map/lib/camera.test.ts` |
| REQ-MAP-29 | §2.2 | Giant Instrument Serif watermark ~160px at `--ivory` 5% | `apps/web/src/map/svg/Watermark.tsx` · `apps/web/src/map/lib/map-type.ts` | `apps/web/src/map/MapView.test.tsx` |
| REQ-MAP-30 | §2.2 | Sub-cluster labels float in 11px `--ink-2` +0.35em around node groups | `apps/web/src/map/svg/ClusterLabels.tsx` · `apps/web/src/map/lib/branches.ts` | `apps/web/src/map/lib/slugs.test.ts` |
| REQ-MAP-31 | §2.2 | Adjacent departments are rail labels with ‹ ›; neighbours come from ADR-001, never a local list | `apps/web/src/map/chrome/DepartmentRails.tsx` | `apps/web/src/map/lib/slugs.test.ts` |
| REQ-MAP-32 | §2.2 | `YOUR TREE` filters to live jobs (anchors survive); live counts are published on the shell bus, never invented | `apps/web/src/map/lib/geometry.ts` · `apps/web/src/map/lib/branches.ts` · `apps/web/src/map/MapView.tsx` | `apps/web/src/map/lib/geometry.test.ts` |
| REQ-MAP-33 | §2.2 | `/map/:department` is a real route sharing the layout canvas | `apps/web/src/app/(views)/map/[department]/page.tsx` · `apps/web/src/app/(views)/map/layout.tsx` | `apps/web/src/map/MapView.test.tsx` |
| REQ-MAP-34 | §2.1 | Payload is parsed defensively — garbage is `null`, not a half-built map | `apps/web/src/map/data/parse.ts` | `apps/web/src/map/data/parse.test.ts` |
| REQ-MAP-35 | §2.1 | `brainCompleteness` is an engine input (0…1, default 0), not a constant inside the solver | `scripts/lib/layout.mjs` · `comms/decisions/ADR-003-layout-precompute.md` | `scripts/lib/layout.test.mjs` |
| REQ-MAP-36 | §3.3 | Completeness counts **answered questions** — COMPANY.md's `<!-- UNANSWERED: Qn -->` markers — never headings, prose length or `sources/`; the payload carries `brainAnswered`/`brainTotal` so the fraction is auditable, and a `.brain.json` snapshot may never claim more than the markers admit | `scripts/lib/brain-completeness.mjs` · `scripts/build-graph.mjs` | `scripts/__tests__/brain-completeness.test.mjs` |
| REQ-MAP-37 | §3.3 | A 0/20 brain renders as a stated empty state — no particles, a dashed disc where the swirl belongs, and the count in words with an `aria-label` — never a dim swirl and never a bare canvas | `apps/web/src/map/svg/BrainEmptyState.tsx` · `apps/web/src/map/canvas/GalaxyCanvas.tsx` | `apps/web/src/map/svg/BrainEmptyState.test.tsx` |

## Interfaces we expose

From `apps/web/src/map` (`index.ts` is the public surface):

- `<MapPage />` — reads the shell route and mounts the galaxy
- `<MapView />` — presentational; `payload` skips the fetch (tests)
- `<GalaxyCanvas />` — the canvas underlay, if a sibling view ever needs the sky
- `comms/contracts/graph-layout.md` + `packages/contracts/src/graph.ts` — the payload
- `scripts/lib/layout.mjs` `computeLayout(agents, previousPositions, opts)` — the engine

Node click publishes `openDrawer({ slug, view: 'map' })` (`drawer/events.ts`, owner
`drawer-engineer`) and `shell:liveCount` / `shell:zoomChanged` (`lib/shell-bus.ts`).

## Interfaces we consume

| What | From | Contract |
|---|---|---|
| `GET /api/graph`, `WS /ws/graph` | `runner-engineer` | `comms/contracts/api-contracts.md` |
| Graph payload shape | this agent | `comms/contracts/graph-layout.md` |
| Seven departments + rail neighbours | `agent-library-curator` / ADR-001 | `packages/contracts/src/departments.ts` |
| `shell:flyTo`, `shell:zoom`, `shell:yourTree` | `shell-navigation-engineer` | `apps/web/src/lib/shell-bus.ts` |
| `openDrawer` | `drawer-engineer` | `apps/web/src/drawer/events.ts` |
| `DURATION`, `useReducedMotion`, `RailLabel` | `design-system-guardian` | `comms/contracts/design-tokens.md` |

## Test plan

- **Pure engine** (`scripts/lib/layout.test.mjs`) — determinism, stability under insertion, sizing, honest empty (seven anchors, completeness 0).
- **Pure client** (`src/map/lib/*.test.ts`, `src/map/data/*.test.ts`) — camera clamp, particle budget, delta freeze, parse-or-null.
- **Markup** (`MapView.test.tsx`) — canvas + SVG mount from a stored fixture; empty state prints no fabricated counts. `renderToStaticMarkup`, no jsdom required for that file's assertions.
- **Not automatable here:** 1440px side-by-side vs their video frame (Part VI) — `fidelity-qa-reviewer`. Reduced-motion (galaxy freeze, pulse kill). Pinch on a real trackpad.

## Deliberately not done

- **The §2.3 drawer body.** We emit `openDrawer` and push `/map/:department/:agent`. The agent page is an empty slot for `drawer-engineer`.
- **d3-force / d3-zoom on the client.** ADR-006 plus `lib/relax.ts`: a full client simulation would rearrange a map whose selling point is stability. Camera maths are ours; they match d3-zoom's transform convention.
- **A second copy of agent data.** No `src/map/agents.json`. The fixture under `__fixtures__/` is test-only.
- **Department-specific precomputed layouts.** ADR-003 left this open; drill-in is a camera transform over the same coordinates.
- **RTL verification.** `rtl-arabic-pdpl-specialist` owns M8. Rails use `start-0` / `end-0`.
- **Mounting `GET /api/graph` on the runner process.** `apps/runner/src/lib/graph.ts` exists; `index.ts` still does not serve it. The client falls back to `/graph.json` after `npm run graph:build`.
