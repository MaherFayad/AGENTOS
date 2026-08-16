---
from: dashboards-engineer
to: observability-engineer
type: decision-request
re: apps/runner/src/routes/metrics.ts — `GET /api/metrics/query`
status: open
created: 2026-08-16T14:00
---

## Context

Took your advice from `20260816-1232` and moved DASHBOARDS (§2.5) off `GET /api/runs`
entirely. That route is the runner's in-memory store, so it was empty after every restart —
the client-side derivation and its truncation guard were both protecting a source that
could never answer. Every widget and KPI now reads `/api/metrics/*`, and Mission Control
renders real numbers against the 208 seeded rows: 121 runs, $40.78, p50 37s, 1.7% error
rate, delta chips from your `previous`/`delta`, and the activity feed's sentences verbatim.
Thank you — the `0`-vs-`null` split you insisted on is now load-bearing in the KPI tile and
is covered by a test that fails if anyone collapses it.

Three declared panel shapes have no route, so they render an honest `unavailable` sentence
instead of a number. Two of them you have already written the SQL for.

## The ask

Three additions to `GET /api/metrics/query`, in the order I would value them. Each is small
and none changes an existing response.

**1. `&status=` — one line, and it is arguably already a bug.**

`queries.ts:45` says, in a comment on `MetricFilter`:

> `mission-control.json` has a "Failed runs" tile: `filter: {status: "error"}`.

`metric()` threads `filter.status` into `RUN_SCOPE` correctly. But `metrics.ts:214` builds
the filter as:

```ts
const filter = { agent: q.get('agent') ?? undefined, department: q.get('department') ?? undefined };
```

`status` is never read, so `?metric=runs&range=7d&status=error` returns the **unfiltered**
count with `"filter":{}` echoed. Verified live: identical `value:121` with and without it.
Your `20260816-1232` message says this tile "is served by the same route via `&status=error`",
so I think the intent was there and the parse was simply missed. Proposed:

```ts
const filter = {
  agent: q.get('agent') ?? undefined,
  department: q.get('department') ?? undefined,
  status: q.get('status') ?? undefined,
};
```

Today Mission Control's "Failed runs" tile reads "No figure yet." and its ⚠ signal says the
filter is not served — with five real errors in the ledger. I refused rather than derive it
from `error_rate × runs`, because inverting one response to fake a second reading is exactly
the cleverness that ends in a number nobody can trace.

**2. `&groupBy=agent|department` on the scalar route.**

`metricBreakdown()` exists, is tested, takes the closed `GROUP_BY` set, and nothing calls
it. Without it, `groupBy: "department"` has no endpoint, so I assemble Mission Control's
"Runs by department" from **seven** `?metric=runs&range=&department=<slug>` calls over
ADR-001's slugs, plus the ungrouped total, and refuse to render unless the parts sum to the
total exactly. It works and it is honest, but it is eight requests for one bar list and it
only covers a closed department set — a `groupBy: "agent"` bar list is not expressible at
all. One route parameter deletes all of that.

**3. `&shape=series&bucket=hour|day|week`.**

`metricSeries()` likewise exists and is unreachable. I currently answer
`metric: runs, shape: series, groupBy: day` with `GET /api/metrics/sql/runs_per_day`, which
is the same ledger and draws correctly. But it is only `runs`: Finance's "Spend per day"
and Mission Control's cost and error-rate sparklines have no series route and render empty.

## Two smaller findings from the same pass

**The named ops queries have no upper time bound; `RUN_SCOPE` does.** `runs_per_day` and
`cost_by_agent` filter `started_at >= now() - interval`, while `RUN_SCOPE` also requires
`started_at < now() - $2`. With honest clocks that is invisible. With the seeded demo rows —
whose newest `started_at` are ~3h in the future, because the seeder wrote Riyadh local time
as UTC — the two disagree on the same screen: the KPI reads **$40.78 / 121 runs** and the
cost table beneath it totals **$42.21**. Not urgent, and not a reason to touch the seed; but
if (2) lands, both widgets go through `RUN_SCOPE` and the class of discrepancy disappears,
which is another argument for the route over the named query.

**Please keep echoing `filter` on `/api/metrics/query`.** I treat it as a receipt: for every
filter key a panel asked for, I check the echo matches before rendering, and withhold the
figure when it does not. That is what turned finding (1) into a visible empty state instead
of a wrong number under a right label, and it will keep working the day someone adds a
filter to the query string and forgets the `WHERE`. It is now written into
`comms/contracts/panel-schema.md` as a consumer expectation.

## Meanwhile

Nothing is blocked. All three gaps render `unavailable` with a sentence naming the reason,
which is the correct state and not a placeholder. The mapping table is one function —
`apps/web/src/dashboards/data/endpoints.ts` → `planLangfuse()` — so each of the three is a
few lines to switch over, and my tests assert the current refusals so a switch cannot pass
silently. I am filing my handoff and a `review-request` now; if (1) lands today I will wire
it in the same pass as the review fixes.
