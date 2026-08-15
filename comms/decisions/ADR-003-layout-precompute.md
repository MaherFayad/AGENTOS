# ADR-003 — Where the force layout is computed

- **Status:** accepted
- **Date:** 2026-08-15
- **Owner:** `map-galaxy-engineer`
- **Proposed by:** `commandcenter-orchestrator` (unblocking ruling)
- **Spec:** §2.1 ("Precompute layout server-side once per skills-repo change, store
  positions, hydrate client-side so the map is stable between visits"), Part V (chokidar
  watcher → WebSocket deltas)

## Context

§2.1 demands two things that pull in opposite directions: the map must be **stable
between visits** (so positions are stored, not re-simulated), and new agents must
**animate in live** when the repo changes (so something must recompute on a watcher
event). A pure build-time script satisfies the first and breaks the second; a pure
request-time endpoint satisfies neither, because a fresh simulation on every request
gives a different galaxy every reload.

## Decision

**One layout engine, two callers, one stored artifact.**

The engine is `scripts/lib/layout.mjs` — a pure function
`computeLayout(agents, previousPositions) -> GraphPayload`. It is imported, never
duplicated.

| Caller | When | Writes |
|---|---|---|
| `scripts/build-graph.mjs` | build time, CI, and `npm run graph:build` | `apps/web/public/graph.json` |
| runner watcher (chokidar on `/agents`) | on repo change | same file, then broadcasts a delta over `WS /ws/graph` |

**Stability rule — this is the part that matters.** `computeLayout` is seeded with the
previous positions from the existing `graph.json`. Nodes that already have coordinates
keep them and are pinned (`fx`/`fy`) for the first 200 ticks; only new nodes are free to
find a place. So adding an agent moves *that* agent's neighbourhood, never the whole
galaxy. Simulation is deterministic: fixed seed, fixed tick count (400), no
`Math.random()` without the seeded PRNG.

`GET /api/graph` serves the stored file. It never simulates. A request that arrives while
a recompute is in flight gets the previous version — a slightly stale galaxy is correct;
a galaxy that differs per request is not.

## Consequences

- `apps/web/public/graph.json` is **gitignored** — it is a build artifact, reproducible
  from `agents/**` by the seeded engine. Stored *positions* that must survive are written
  back to a committed `agents/_registry/positions.json` by the same script, which is what
  actually makes the map stable across clones.
- The layout version hash in the payload is `sha256(sorted agent slugs + their
  layout-relevant frontmatter)`. The client refetches only when the hash changes.
- CI runs `graph:build` and fails if it is not deterministic (runs it twice, diffs).

## Deliberately not decided

Whether department drill-in layouts are precomputed too. §2.2 zooms into an existing
branch rather than re-laying it out, so for now the drill-in is a camera transform over
the same coordinates. If a department ever needs its own spread, it becomes ADR-00N.
