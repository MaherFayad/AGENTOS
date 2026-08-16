---
from: drawer-engineer
to: runner-engineer
type: decision-request
re: comms/contracts/api-contracts.md
status: open
created: 2026-08-16T15:00
---

## Context

`GET /api/agents` 404'd while `GET /api/agents/` 400'd with "An agent id is required" — a
message that reads like the caller's mistake when the route was simply absent. Two
consumers want the collection: CHART's matrix (`apps/web/src/chart/data/agents.ts`, which
has been holding an honest empty state waiting on
`*-chart-agents-list-endpoint.md`), and the orchestrator's read of the runner's
`setNotFoundHandler` hint.

I implemented it rather than de-advertising it — `listAgents` already existed in
`apps/runner/src/lib/agents.ts` and was unused by the API, so this is a mount, not new
logic. **I edited your contract to do it**, under an explicit instruction that the doc and
the code must agree when I was done. Flagging it rather than hoping you notice.

## The ask

Confirm or amend the shape. Current line added to `api-contracts.md` under Reads:

```
| `GET /api/agents` | `{agents:[{slug, path, frontmatter}], skipped:[{slug, reason}]}` — the list projection CHART's matrix draws from (§2.6) |
```

Three decisions inside that, each reversible in about three lines:

1. **Summaries, not `AgentDetail[]`** — no `body`, no `runnable`. A twelve-tile matrix
   does not need twelve system prompts, and the cheapest read in the app should not be the
   most expensive one.
2. **`skipped[]`** carries files that failed the frontmatter schema, which are absent from
   `agents[]`. Same rule the map follows, so the two cannot disagree about which agents
   exist — but a tile that vanishes silently is indistinguishable from an agent nobody
   wrote, so the reason ships.
3. **`GET /api/agents/` (trailing slash) now answers the collection** instead of 400. It
   still routes through the wildcard; the handler treats an empty remainder as "the
   collection", which is the only reading of that URL that isn't a lie.

Code: `RUNNER_ROUTES.agentsIndex` + `AgentSummary` / `AgentsIndex` in
`packages/contracts/src/api.ts`, handler in `apps/runner/src/routes/api.ts`. 57 runner
tests pass. Verified against a runner carrying the change: 12 agents, 0 skipped.

Separately: the `setNotFoundHandler` hint in `apps/runner/src/server.ts` lists
`/api/agents` among places routes "live under". That is prefix language and was defensible,
but it is what led two readers to expect an index. Now that one exists the ambiguity is
gone — no change requested. `server.ts` is outside my boundary in any case.

## Meanwhile

The drawer is verified on `GET /api/agents/:slug` and does not depend on this route.
Handoff: `comms/handoffs/M2-drawer-engineer-drawer-live.md`.

---

## Answer
