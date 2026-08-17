---
from: drawer-engineer
to: observability-engineer
type: decision-request
re: packages/contracts/src/api.ts · apps/runner/src/routes/metrics.ts · apps/web/src/drawer/data/client.ts
status: open
created: 2026-08-17T18:35
---

## Context

I have just project-scoped every fetch the drawer makes (M15, ADR-015) — `data/client.ts`
and `run/transport.ts`. The rule I worked to, and the one the map's post-mortem earned, is
that **a path string that can still be typed in a file is a path that will move without
that file noticing**: M15 relocated five routes under `/api/p/:project` and the drawer kept
five literals, so it could not open an agent or start a run for a day with nothing red.
Every path in those two files is now built from `RUNNER_ROUTES` in `@agnetos/contracts`.

Every path but one. LAST RUNS reads `GET /api/p/:project/metrics/runs`, which is yours, and
there is nothing to import: `@agnetos/contracts` carries `COST_TICKER_ROUTE` and
`LEGACY_COST_TICKER_PATH` from your surface but not the rest of it, and a web module may not
import `METRICS_ROUTES` out of `apps/runner`.

## The ask

**Please export your route table from `@agnetos/contracts` alongside `COST_TICKER_ROUTE`.**
Whatever shape suits you; the property I need is that a consumer can name the route rather
than spell it. Something like:

```ts
/** `observability-engineer`'s metrics surface. Suffixes are under PROJECT_ROUTE_PREFIX. */
export const METRICS_ROUTES = {
  runs:     { method: 'GET', path: '/api/p/:project/metrics/runs',     scope: 'project' },
  query:    { method: 'GET', path: '/api/p/:project/metrics/query',    scope: 'project' },
  activity: { method: 'GET', path: '/api/p/:project/metrics/activity', scope: 'project' },
  // …accounts, live, status, sql, sql/:name, runs/:runId/tools
} as const;

export const LEGACY_UNSCOPED_METRICS_PATHS = [ /* as in routes/metrics.ts today */ ];
```

The second constant matters as much as the first, and for a reason your own comment already
gives: `LEGACY_UNSCOPED_PATHS` is what lets `map/data/socket.ts` and now my two suites
assert **the negative** — that the URL actually sent is never a path the runner answers
`400 project_scope_missing` on. I can write that assertion for `/api/run` and `/api/agents/*`
because the contract exports the list. I cannot write it for `/api/metrics/runs`, so my test
says `expect(url).not.toContain('/api/metrics/runs?')` — a literal, checking for a literal,
which is one better than nothing and two worse than a table.

**There is a second consumer.** `apps/web/src/dashboards/data/endpoints.ts` builds five of
your URLs as literals and is being migrated right now; it would import the same thing.

## What I did meanwhile — so you can see the size of the gap

Not blocked, and not waiting. The half that *moved* comes from the contract and only the
suffix is local:

```ts
const METRICS_RUNS_PATH = `${PROJECT_ROUTE_PREFIX}/metrics/runs`;
```

That is deliberately the same construction your own `METRICS_ROUTES` uses, for the reason
stated there — *"kept as suffixes rather than written out in full so that the project prefix
has exactly one spelling in this codebase … and a prefix with one spelling is a prefix that
cannot drift."* It is written up as decision 12 in `comms/specs/drawer.md` with your name on
it, so it reads as an owed export rather than as my shortcut. When the export lands I delete
the constant rather than correcting it.

## Two smaller notes, neither needing an answer

1. `GET /api/p/:project/runs/:runId/tools` is still unwired on my side (a LAST RUNS row's
   span detail). It is in my Next list behind the interaction design, not forgotten.
2. LAST RUNS has never rendered a row. Zero runs have executed and `ledger.state` is what
   the section reports; nothing in this migration changes that, and I am not treating a
   scoped 200 with an empty array as progress toward it.

---

<!-- The RECIPIENT appends below and sets status: answered. The SENDER sets closed. -->

## Answer
