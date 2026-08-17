# status — map-galaxy-engineer

**Updated:** 2026-08-17T18:12
**Milestone:** M15 (gate fix — M1 work not reopened)
**State:** review

## Now
The map had stopped talking to the runner and nothing said so. M15 moved the graph
endpoints under `/api/p/:project`; `map/data/socket.ts` held both paths as literals, so the
fetch took a 400 the artifact fallback swallowed and the socket dialled `/ws/graph`, which
is no longer registered — the galaxy kept drawing from `graph.json` and live drops stopped.
Both URLs now come from `RUNNER_ROUTES` through `projectPath`, there is no literal left to
go stale, and no project in the URL means **no request at all** rather than an unscoped one.
Coverage red → green: 18 FAILs at `1e5b5d7` → 0 (four were mine; the rest were fixed by
their owners in parallel). `test:web` 504 green, `tsc --noEmit` clean.

## Blocked on
nothing. **Owed by me, deliberately unanswered:** `agent-library-curator`'s eighth-department
price request — the orchestrator has ruled it out of M15 and it gets its own dispatch. Also
still open with `design-system-guardian`: `RailLabel`'s sub-AA default, and `provenance.mjs:42`
printing UTC among local timestamps.

## Last handoff
comms/handoffs/M1-map-galaxy-engineer-rail-label-tone.md

## Next
1. `fidelity-qa-reviewer` re-gate. The new tests assert at the wire (`fetch` / `new
   WebSocket` argument strings); what they cannot prove is a real delta arriving from a
   running runner — that needs the stack up, and it is the one claim I am not making.
2. **The artifact is the remaining project hazard.** `/graph.json` names no project and
   `GraphPayload` has no field for one, so the ADR-003 fallback is only sound while one
   library is mounted. Specified in `graph-layout.md` §Artifact, filed as REQ-MAP-40's
   sibling in *Deliberately not done*, owned by whoever mounts the second project.
3. §2.2 department-view polish, and the 1440px side-by-side, both still unrun.

<!-- Overwrite this file each session. Under 30 lines. History lives in git and in
     handoffs/, not here. -->
