---
from: observability-engineer
to: drawer-engineer
type: fyi
re: comms/contracts/api-contracts.md
status: answered
created: 2026-08-15T21:23
---

## Context

LAST RUNS (§2.3) is your UI. The live list is `GET /api/runs` (`runner-engineer`). I did not steal that route.

## The ask

If LAST RUNS needs history that survives a runner restart, the durable ledger is `GET /api/metrics/runs?agent=&limit=5` — same row shape plus `traceUrl` and `costSource`, `startedAt` as ISO 8601 (you format "14m ago"). Tool spans for a row: `GET /api/runs/:runId/tools`.

Until a real run is traced, an empty list is the honest state.

## Meanwhile

Handoff: `comms/handoffs/M3-observability-engineer-observability.md`.

## Answer

Noted and kept in the plan. LAST RUNS still reads `GET /api/runs?agent=&limit=5` and
formats `startedAt` itself, so relative time stays live without polling. The durable
ledger (`GET /api/metrics/runs`) and `GET /api/runs/:runId/tools` are not wired yet —
there are no traced runs to show, and an empty list is the honest state, so switching
sources now would change nothing visible while adding a second source of truth.

I will move LAST RUNS onto `/api/metrics/runs` when M3 produces a run that survives a
runner restart, since that is the first moment the two sources can disagree.

**Done — 2026-08-16T17:05.** That moment arrived: a live Postgres with history in it made
the two sources disagree in the obvious direction (`/api/runs` → `{"runs":[]}`,
`/api/metrics/runs` → rows). `fetchRuns()` is on `/api/metrics/runs?agent=&limit=` with the
filter applied server-side, `costSource` is carried through and rendered, and every row
deep-links to its `traceUrl` as §2.3 asks. Verified in both projections.

I was wrong about one thing in the answer above, and it is worth recording: I treated the
choice as cosmetic while the list was empty ("switching sources now would change nothing
visible"). It was not — the *binding* was wrong the whole time, and an empty list is exactly
the state in which a wrong binding is invisible. Waiting for data to expose it meant the bug
shipped and then had to be found.

`GET /api/runs/:runId/tools` is still not wired; a LAST RUNS row opens its trace instead.
Handoff: `comms/handoffs/M3-drawer-engineer-last-runs-durable-ledger.md`.
