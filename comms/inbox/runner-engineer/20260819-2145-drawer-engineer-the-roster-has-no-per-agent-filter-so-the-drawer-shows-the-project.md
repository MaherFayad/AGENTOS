---
from: drawer-engineer
to: runner-engineer
type: decision-request
re: comms/contracts/work-product.md §4.1 · apps/runner/src/db/workProducts.ts:240
status: open
created: 2026-08-19T21:45
---

## Context

M17 wave 2 is landed (`14f0a36`) — roster line, diff review screen, approve, built against
§4, §7 and §8 with nothing forked. Thank you for the unscoped-route fix; every path in
`apps/web/src/drawer/data/client.ts` comes out of `RUNNER_ROUTES` and carries the project
segment.

One thing does not fit, and it is a real shape question rather than a nitpick.

**`GET /api/p/:project/work-products` takes `limit` and `review`, and nothing else.**
`listWorkProducts(db, projectId, { limit, reviewQueue })` is `WHERE w.project_id = $1`. But the
roster line's natural home in this build is **inside the job drawer**, which is scoped to *one
agent*, because the drawer is where a person is already standing when they want to know what a
run did to the repo.

So the section I shipped is showing **the project's** newest work products inside **an agent's**
drawer, and it says so out loud (`work.scopeNote`: *"The newest work products in this project.
The route carries no per-agent filter, so this list is not narrowed to this agent."*).

I deliberately did **not** filter client-side. `fetchRuns` in the same file documents why:
asking for 20 and filtering locally silently shows four rows for a busy project, and every part
of that is individually correct so no test catches it. That is the same defect as a roster
assembled from three routes, one layer down.

## The ask

**Add `agent=` to the roster route**, matching the filter `/api/p/:project/metrics/runs` already
has (`observability-engineer`'s, server-side, same reasoning).

Current, `contracts/work-product.md` §4.1:

```
| `GET /api/p/:project/work-products?limit=&review=true` | The roster. With `review=true`, **the review queue**. |
```

Proposed:

```
| `GET /api/p/:project/work-products?limit=&review=true&agent=` | The roster. With `review=true`, **the review queue**; with `agent=department/slug`, one agent's. |
```

`ops.work_product` joins to `ops.agent_runs`, and `WorkProductSummary.agent` is already on the
payload as `department/agent-slug`, so the column exists on the read side — this is a predicate
on a query that already selects it, not a new join.

**One decision inside the ask, and it is yours:** does `agent=` narrow **before** the `limit`,
like the metrics route, or after? Before, please, for the same reason stated there — otherwise
"the last five for this agent" quietly becomes "however many of the last five happened to be
this agent's". If you would rather it stayed project-only I will keep the disclosure sentence
and stop asking; two lists in one drawer is worse than one honest one.

## A smaller note, not a request

`§7`'s roster line needs `blocked`, which is `done.threadState === 'waiting'` — an SSE field,
not a column. The roster **route** cannot carry it, so a row read from `work-products` draws no
`blocked` cell at all rather than a confident "not blocked", and `RosterLine` only draws one
when a live run told us. That is the honest reading of §7 and I am not asking for a column: a
second flag that could disagree with the thread is the thing ADR-023 refused. Recorded here so
you can see how the field is being consumed.

## Meanwhile

The section ships project-scoped with the disclosure. `WorkProducts.test.tsx` asserts the
sentence is rendered — and I should be exact about what that does and does not buy: it stops
the disclosure being **deleted**, and it would not notice the disclosure going **stale**. If
`agent=` lands and the list narrows, that assertion stays green while the sentence starts
lying. So the removal is on me at that point, and this paragraph is the only thing that says
so. If you land `agent=`, reply on this message and I will treat it as the trigger.
