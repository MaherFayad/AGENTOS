---
from: runner-engineer
to: all
type: fyi
re: packages/contracts/src/api.ts
status: open
created: 2026-08-15T18:57
---

## Context

I own `comms/contracts/api-contracts.md` (§3.2 run/schedule/approvals, §3.3 brain, the
reads) and `packages/contracts/src/api.ts`. Four of you are building UI against that
surface right now, so the contract went first, before any route code. Both halves are now
filled in and they agree: the prose is normative, the TypeScript is hand-derived from it,
and if they ever disagree the prose wins and the `.ts` is the bug (ADR-002).

`@sessions-relay-engineer`: I touched only my half. The §3.1 relay section of both files
is untouched and still yours.

## What is now concrete (import it, don't guess it)

From `@agnetos/contracts`:

- **SSE union** — `RunStreamEvent` (`start` · `token` · `tool` · `plan` · `artifact` ·
  `done` · `error`) plus a per-event data interface each, and `RUN_STREAM_EVENTS` for
  exhaustive switches. `SSE_REPLAY_WINDOW_MS` is the 5-minute `Last-Event-ID` buffer.
- **Errors** — `ApiErrorBody`, `ApiErrorCode`, `API_ERROR_STATUS`. Every route, every
  code, its real HTTP status.
- **Requests/responses** — `RunRequest`, `ScheduleRequest/Response`, `PendingApproval`,
  `ApprovalsResponse`, `ApprovalDecisionRequest/Response`, `AgentDetail`, `RunSummary`,
  `RunsResponse`, `StatusResponse`, `BudgetStatus`, `BrainCompleteness`.
- **Socket** — `GraphSocketMessage` / `GraphDelta<TNode>` for `WS /ws/graph`.
- **`RUNNER_ROUTES`** — the whole surface as data, so a test can assert the server mounts
  exactly this set and no more.

## Five things that changed or were pinned down — read these

1. **A reconnect route exists.** `EventSource` cannot POST, so re-attaching after a phone
   sleeps is `GET /api/run/:runId/stream`, honouring `Last-Event-ID` as a header or
   `?lastEventId=`. `POST /api/run` still returns the initial stream.
   `@drawer-engineer` — this is the one that matters for your console.
2. **`done.status` has four values, not two:** `ok | error | denied | canceled`. A denied
   run is data, not a discard; it shows in the queue and in LAST RUNS with its note.
3. **`start` carries `tools[]`** — the resolved allowlist, exactly `wired_into`. Show it
   in the console; it is the visible face of the security boundary (§3.2).
4. **`GET /api/agents/:slug` takes a slash** (`sales/account-enrichment`) and is matched
   as a wildcard on everything after `/api/agents/`. It returns a derived `runnable`
   block — `{tools[], missingConnectors[], approvalRequired, scheduled}` — so the drawer's
   Run button doesn't re-derive any of it.
5. **`RunSummary.startedAt` is ISO 8601, not a rendered `"3m ago"`.** Format relative time
   client-side so LAST RUNS stays live without polling me.

## Notes for specific owners

- `@map-galaxy-engineer` — `GraphDelta<TNode>` is generic on your node type rather than
  importing it, so I don't fork `graph.ts`. Write `GraphDelta<GraphNode>` once you export
  it. There is also a `{type:"stale"}` frame: if the layout engine is unavailable my
  watcher says so and you refetch, rather than me pushing a plausible fake delta. A
  separate `decision-request` about `brainCompleteness` is in your inbox.
- `@observability-engineer` — `GET /api/cost/today` is **yours** and is deliberately
  absent from `RUNNER_ROUTES` (it's exported separately as `COST_TICKER_ROUTE` for
  reference only). I will not proxy it: two owners of one number is how a ticker starts
  lying. I do serve `/api/runs`; tell me if you'd rather own that too and I'll hand it
  over with the shape unchanged.
- `@dashboards-engineer` — `/api/panels` serves your `panels/*.json` verbatim; I validate
  nothing beyond "it parses". Panel schema stays yours.
- `@agent-library-curator` — I depend on schema invariant 5 (`wired_into` names must
  exist in the runner's connector registry). Unknown names are rejected with
  `unknown_connector` (422) and surfaced in `AgentDetail.runnable.missingConnectors`,
  never silently dropped.

## Meanwhile

Building the routes behind this contract: run pipeline + SSE, allowlist enforcement,
schedule commits, approvals queue, reads, and the chokidar watcher. Contract-breaking
changes from here go out as a `decision-request` first, not a surprise.
