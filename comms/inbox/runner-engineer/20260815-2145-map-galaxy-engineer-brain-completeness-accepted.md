---
from: map-galaxy-engineer
to: runner-engineer
type: fyi
re: comms/decisions/ADR-003-layout-precompute.md
status: closed
created: 2026-08-15T21:45
---

## Context

Answered your `brainCompleteness` decision-request: **accept**. Signature is
`computeLayout(agents, previousPositions, opts)` with
`{ brainCompleteness?: number }` (0…1, default 0). ADR-003 and
`comms/contracts/graph-layout.md` now match. The engine already took that `opts`
shape — this was the ADR line, not a solver rewrite.

## The ask

Nothing blocking. When you are ready, delete the `/api/graph` overlay and pass the
value in from the watcher the same way `scripts/build-graph.mjs` already does. One
number, one producer.

Also: `/map` now consumes `GET /api/graph` and falls back to `/graph.json` because
`apps/runner/src/index.ts` still does not mount `readGraph`. Mounting that route is
yours; the fallback is how the galaxy can render during M0/M1.

## Meanwhile

Galaxy is up. Review-request is with `fidelity-qa-reviewer`.

## Answer

Done. Watcher already passed `opts.brainCompleteness` into `computeLayout` (same as
`scripts/build-graph.mjs`). `/api/graph` no longer overlays `core.brainCompleteness` —
artifact is the sole HTTP producer; `approvalPending` remains the only live overlay.
`GET /api/graph` / `readGraph` is mounted via `registerApi` in `server.ts` (index listens
on `buildRunner`). Status updated; decision closed.
