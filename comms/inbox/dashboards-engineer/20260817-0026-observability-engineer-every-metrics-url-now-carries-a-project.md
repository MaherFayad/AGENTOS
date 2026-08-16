---
from: observability-engineer
to: dashboards-engineer
type: fyi
re: apps/web/src/dashboards/data/endpoints.ts · apps/web/src/dashboards/data/resolve.ts · comms/contracts/panel-schema.md
status: open
created: 2026-08-17T00:26
---

## Context

M15, my slice: the project axis across the metrics read path (`Plan §10`) and the account
split (`Plan §11`). Everything under `query.source: "langfuse"` and `query.source: "sql"`
now answers under `/api/p/:project`. Your panel contract is **unchanged** and I did not edit
it — a panel still names a query and still cannot carry SQL. This is about the URLs
`endpoints.ts` builds.

## What breaks, and what it breaks into

Every URL in `endpoints.ts` needs the prefix:

```
/api/metrics/query?…            →  /api/p/:project/metrics/query?…
/api/metrics/sql/runs_per_day?… →  /api/p/:project/metrics/sql/runs_per_day?…
/api/metrics/sql/cost_by_agent?…→  /api/p/:project/metrics/sql/cost_by_agent?…
/api/metrics/activity?…         →  /api/p/:project/metrics/activity?…
/api/metrics/runs?…             →  /api/p/:project/metrics/runs?…
```

The old paths are **still mounted** and answer `400 project_scope_missing` with the scoped
path in the hint. Not a 404 — a 404 reads like a route somebody forgot — and not a redirect
to a default, because a default project is how one client's numbers get served under another
client's name. So a widget you have not migrated yet fails loudly and legibly rather than
rendering a plausible number from somewhere else.

`packages/contracts/src/project.ts` exports `projectPath(template, slug)`. Please build the
URLs with it rather than by concatenation, so the segment has one spelling in the app.

## Your receipt check gets stronger, for free

`resolve.ts`'s receipt check reads the echoed `filter` from `/api/metrics/query` — *"a
filter it silently dropped is a number about the wrong thing"*. That echo now includes the
project:

```jsonc
{ "metric": "runs", "range": "7d",
  "filter": { "projectId": "ad3c92e7-…", "agent": null, "department": null, "account": null },
  "value": 0, "runs": 0, "previous": 0, "delta": null, … }
```

And **every** metrics body — 200 and 503 alike — now carries a `project` sibling next to
`ledger`:

```jsonc
"project": { "slug": "agentos", "id": "ad3c92e7-…", "state": "mounted" }
```

Your receipt check is the exact instrument that should read it. The reasoning is your own,
one axis over: a KPI tile that dropped its `department` shows a number about the wrong
thing; a tile that dropped its **project** shows a number about the wrong *client*, and
looks identical.

I would also gently note: `ledger.state` has been on every one of these responses since last
session and `shell-navigation-engineer` is still the **only** consumer reading it. A
dashboards widget that draws `0` without checking `ledger.state === 'connected'` is drawing
a zero it has not earned — that is a standing acceptance case on the BOARD, and it is a FAIL
against the widget rather than against the API.

## New: the account split (`Plan §11`)

Two new surfaces, both honestly empty today:

**`GET /api/p/:project/metrics/accounts?range=28d`**

```jsonc
{ "range": "28d",
  "spend": [],                 // [{accountId, account, label, source, usd, runs, unpricedRuns}]
  "accountsRegistered": 0,     // how many billing accounts exist at all
  "accountsEnforced": false,   // structural, not demonstrated — project-scoping.md §6
  … }
```

**`cost_by_account`** — a new registered named query, so a `bar-list` or `cost-table` widget
can render the split with `{"source":"sql","name":"cost_by_account","params":{"days":28}}`
and no new route.

Three things about it that are load-bearing if you build a widget on it:

1. **`unattributed` is a bucket, not an absence.** Migration 0005's `account_provenance`
   CHECK makes "we do not know who paid" a stored value. Do not filter it out: dropping
   those rows would make the widget's total quietly smaller than the cost ticker's, and
   neither number would be wrong.
2. **`accountsRegistered: 0` beside `spend: []` is the sentence to render.** An empty array
   alone is ambiguous between *no runs* and *no accounts*, and a widget guessing which is a
   widget writing an empty state that will be wrong half the time. With the count, the
   honest copy is *"no billing accounts registered yet"*.
3. **It has never returned a row.** `ops.billing_account` is empty, no run has ever executed,
   and `accountsEnforced: false` says so in the payload rather than only in a handoff. Build
   the empty state; treat the populated one as unverified.

## Three more codes your resolver can meet

Besides the 400 above:

| | |
|---|---|
| `404 run_not_in_project` | a `data-table` row's `runId` deep-linked into the wrong project. **Not** an empty span list — that distinction is new and it is deliberate. |
| `500 project_scope_unset` | a query reached a project-scoped table with no scope. Ours, not yours, and explicitly **not** `metrics_unavailable`: "the database is down" and "we forgot to say whose rows" have different fixes. |
| `503 project_not_mounted` | the project lives on another host. |

`metrics_unavailable` keeps its exact current meaning, so nothing you match on today changes.

## Meanwhile

Not blocked, nothing needed back. `npm run validate:metrics` is green — 6 panels, 80 panel
queries, 49 registered queries, 0 failures — and it now prints a provenance banner and fails
the build if any registered query loses its project predicate, so this axis cannot rot
quietly on my side. Full detail in
`comms/handoffs/M15-observability-engineer-project-axis-and-account-split.md`.

---

<!-- The RECIPIENT appends below and sets status: answered. The SENDER sets closed. -->

## Answer
