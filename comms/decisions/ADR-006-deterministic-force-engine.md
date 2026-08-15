# ADR-004 — The build-time force solver is ours; d3 stays client-side

**Date:** 2026-08-15 · **Author:** map-galaxy-engineer · **Status:** accepted
**Affects:** `comms/contracts/graph-layout.md`, ADR-003, M1, `scripts/lib/layout.mjs`

## Context

§2.1 and Part V both name `d3-force` as the map's layout engine, and ADR-003 makes
`computeLayout(agents, previousPositions)` a **pure, deterministic, seeded** function whose
output is committed to `agents/_registry/positions.json` and diffed in CI ("runs it twice,
diffs"). Those two requirements fight each other in one specific place:

- `d3-force` is not deterministic. `forceLink` and `forceCollide` call an internal
  `jiggle()` that is literally `(Math.random() - 0.5) * 1e-6`, applied whenever two nodes
  coincide or a link distance resolves to zero. It fires exactly in the case we hit most —
  a new node seeded at its parent's coordinates. A CI job that reruns the build and diffs
  would fail intermittently, and "intermittently non-reproducible galaxy" is the failure
  ADR-003 exists to prevent.
- The build script also has to run on a clean clone with **no install step** (the layout
  artifact is what makes the map stable across clones; regenerating it must not depend on
  `npm ci` having succeeded first). `scripts/` currently has no dependency of its own.

Monkey-patching `Math.random` around a `d3-force` call would fix determinism and is the
kind of thing that works until someone runs the engine concurrently.

## Options

| Option | For | Against |
|---|---|---|
| A — `d3-force` at build time, patch `Math.random` with a seeded PRNG for the duration of the run | Literal reading of "use d3-force"; zero new math | Global mutation, breaks under concurrency, still couples the build artifact to a node_modules tree; d3's phyllotaxis seeding of un-positioned nodes is another hidden source of drift |
| B — `d3-force` at build time, accept the jiggle | No work | CI determinism check fails randomly; ADR-003 is void |
| C — our own velocity-Verlet solver in `scripts/lib/layout.mjs`, same four force formulations, seeded PRNG, fixed tick count; `d3-force`/`d3-zoom` on the client | Deterministic by construction, dependency-free, runs on a bare clone, lets us add the per-department angular spring d3 has no force for | ~200 lines of physics we own and must test |

## Decision

We use **option C**. `scripts/lib/layout.mjs` implements the four forces §2.1 names —
`link`, `manyBody` (Barnes-Hut-free, `distanceMax`-capped), `radial` per department, and
`collide` — as a self-contained deterministic solver with a `mulberry32` PRNG, fixed 400
ticks and the same velocity-Verlet integration scheme d3-force uses, so the *feel* of the
resulting layout is d3's. It has no imports outside `node:` builtins.

`d3-force` and `d3-zoom` remain the client's engine, where they earn their place and where
determinism is not wanted: drag warmth (`alphaTarget(0.3)` restart, edges relaxing over
~600ms, §1.6) and the 700ms department camera transform. The client never runs a cold
simulation — it seeds every node from the stored payload.

The spec's intent ("D3 force simulation … more control over the exact physics/feel than
Cytoscape") is honoured: we kept the physics model and took *more* control, which is the
same reason the spec rejected Cytoscape.

## Consequences

- Easy: `node scripts/build-graph.mjs` works on a fresh clone with nothing installed; CI's
  run-twice-and-diff is exact, byte for byte; adding a force (the per-department angular
  spring, which `d3.forceRadial` cannot express) is a local edit.
- Hard: the solver is ours to debug. Mitigated by `scripts/lib/layout.test.mjs`, which
  pins determinism, stability under insertion, branch separation and node-kind sizing.
- Reversing this means deleting the solver, adding `d3-force` to the root package and
  re-proving determinism. The payload shape (`contracts/graph-layout.md`) does not change,
  so nothing downstream of `/api/graph` is affected either way — that is the point of
  putting the engine behind `computeLayout()`.
- The runner's chokidar watcher imports the same `scripts/lib/layout.mjs` (ADR-003, one
  engine, two callers). It must not add its own d3 path.

## Contract edits

`comms/contracts/graph-layout.md` — the "Layout algorithm (§2.1)" section now reads
"four forces, solved by `scripts/lib/layout.mjs` (ADR-004)" instead of naming `d3-force`
as the server-side engine, and states explicitly that `d3-force`/`d3-zoom` are the
client-side interaction engines.
