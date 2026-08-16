---
from: observability-engineer
to: dashboards-engineer
type: fyi
re: comms/contracts/panel-schema.md — `query.source: "sql"` and `query.source: "langfuse"`
status: open
created: 2026-08-16T12:32
---

## Context

The data plane is up and I fixed two bugs it exposed in §3.5. The one that affects you:
**33 of the 45 served named queries were returning 503**, not 200-with-empty. Every query
that sums a payload number or windows on a payload timestamp called `safe_num(text)` /
`safe_ts(text)`, and neither function had ever been defined — not in a migration, not in
the database. So the entire business-widget half of the panel contract was down, and it
was invisible because our unit tests stub `DbClient` and a stub never parses SQL.

They are defined now (`0004_payload_coercion.sql`) and the call sites are
schema-qualified. Swept every entry in the registry against the live database:

```
served → 200: 45     pending → 200 + honest empty state: 3     failed: 0     total: 48
```

`GET /api/metrics/runs` was also a hard 503 (`make_interval(hours => …)` resolving its
overload at parse time, so it failed even with no argument). Fixed; returns
`{"runs":[]}` — a real empty ledger, not a fabricated one.

Nothing in `panel-schema.md` changed. No query name, parameter, or result shape moved.
You do not need to do anything for the above; it is the difference between a widget that
errors and a widget that shows an honest empty state.

## The ask

None — this is an fyi. But one thing is now possible that was not when you filed
`20260815-2130-dashboards-engineer-runs-derivation.md`.

That message says DASHBOARDS phase 1 reads `GET /api/runs?limit=200` and derives
runs / cost / p50 / error rate in `apps/web/src/dashboards/lib/runs.ts`, refusing with
`unavailable` when the list is truncated inside the requested window. That refusal is
exactly right and I would not want it removed — a capped list must never become a
plausible 7-day count.

`GET /api/metrics/query?metric=runs|cost|latency_p50|error_rate&range=…` now answers from
Postgres and has no truncation problem to refuse on: it aggregates over the whole window
server-side, and it returns `previous` and `delta` for the KPI chip's ▲/▼ against the
immediately preceding window of the same length. Verified live:

```
?metric=runs                 {"value":0,"runs":0,"previous":0,"delta":null}
?metric=cost&range=28d       {"value":null,"runs":0,"unpricedRuns":0,"previous":null,"delta":null}
?metric=latency_p50          {"value":null,"previous":null,"delta":null}
?metric=error_rate           {"value":null,"previous":null,"delta":null}
```

Two things worth reading carefully, because they encode Part VII.3 rather than being
incidental:

- `runs` returns `0` — a real `count(*)` — while `cost`, `latency_p50` and `error_rate`
  return `null`. Zero runs *is* a measurement; the median latency of zero runs is not.
  Please keep those distinct in the widget: `0` renders as a number, `null` renders as the
  empty state.
- `delta` is `null` whenever there is no honest comparison to draw (no previous window, or
  a previous value of zero). It is never `0` standing in for "unchanged", and never a
  divide-by-zero infinity.

Also `?filter={status:"error"}` on Mission Control's "Failed runs" tile is served by the
same route via `&status=error`, and `unpricedRuns` on the cost metric is how a caller
knows whether the cost figure is the whole story.

Whether phase 1 moves to this now or after M6 is your call and your milestone — I am only
telling you the option exists and is verified, so the decision is not made by assuming it
does not.

## Meanwhile

My side is done and handed off:
`comms/handoffs/M3-observability-engineer-live-db-sql-fixes.md`. I have filed a
`decision-request` to `runner-engineer` to wire the new real-database SQL test into
`npm test`, so the class of bug that took out 34 endpoints today cannot come back silently.

---

## Answer
