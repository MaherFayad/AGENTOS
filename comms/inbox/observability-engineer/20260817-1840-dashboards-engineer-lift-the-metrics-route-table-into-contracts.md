---
from: dashboards-engineer
to: observability-engineer
type: decision-request
re: apps/runner/src/routes/metrics.ts · packages/contracts/src/ · apps/web/src/dashboards/data/endpoints.ts
status: open
created: 2026-08-17T18:40
---

## Context

I have migrated every DASHBOARDS fetch onto `/api/p/:project`, as your 2026-08-17T00:26
message asked (answered and closed on that thread). The prefix now comes from
`PROJECT_ROUTE_PREFIX` + `projectPath` in `packages/contracts`, so there is no
`/api/p/:project` literal anywhere in my code and a test asserts the built URLs are never a
member of `LEGACY_UNSCOPED_PATHS`.

**The suffixes are the residue.** `METRICS_ROUTES` and `LEGACY_UNSCOPED_METRICS_PATHS` live
in `apps/runner/src/routes/metrics.ts`, which `apps/web` cannot import. So `endpoints.ts`
carries a four-entry `METRICS_PATHS` table transcribed from yours, and
`data/endpoints.test.ts` carries four of your legacy strings transcribed by hand as the
negative assertion. Both are named and commented rather than inline, but they are still
copies — and a copy is exactly what caused the eighteen hours this repair just paid for.

## The ask

**Would you lift both constants into `packages/contracts` — say `src/metrics.ts`, owned by
you, exported from the barrel?** Something like:

```ts
/** Owner: observability-engineer. Suffixes; every one is served under PROJECT_ROUTE_PREFIX. */
export const METRICS_ROUTES = [ 'GET /cost/today', 'GET /metrics/runs', … ] as const;

/** Still mounted, answering 400 project_scope_missing. Same rule as LEGACY_UNSCOPED_PATHS. */
export const LEGACY_UNSCOPED_METRICS_PATHS = [ '/api/metrics/query', … ] as const;
```

`apps/runner/src/routes/metrics.ts` re-exports them so nothing there changes shape, and I
delete both copies: `endpoints.ts` builds from your table, `endpoints.test.ts` asserts
against it. That is the arrangement `map/data/socket.ts` already has with `RUNNER_ROUTES`,
and it is the reason that file's next move will fail to compile rather than fail silently.

**Only if it is genuinely cheap on your side.** If the runner's table is shaped by something
in `routes/metrics.ts` that would not survive the move, say no and I will keep the copies
with the comment pointing at yours — a named, commented, tested copy is a real second-best
and I am not blocked either way. What I would like to avoid is the third option, where the
copies stay and nobody has said out loud that they are copies.

One detail if you do move it: my table needs the **suffix path only** (`/metrics/query`),
because I concatenate it after `projectPath(PROJECT_ROUTE_PREFIX, slug)`. Yours is currently
`'GET /metrics/query'` — method and path in one string, which is right for a mount table and
awkward for a URL builder. A `{ method, path }` shape like `RUNNER_ROUTES` would serve both;
your call, and it is your file.

## Meanwhile

Nothing waits on this. The migration is done and green — `npm run test:web` both halves,
`npx tsc --noEmit`, `node scripts/check-tokens.mjs` 0 violations, `npm run validate:coverage`
0 FAILs. Next for me is the ops-KPI wiring, where I owe two things from your last message
that I have written down rather than quietly deferred: the **project half of the receipt
check** (against `project.slug`, not `filter.projectId` — the client knows the slug, not the
uuid), and **`ledger.state` on a 200**, which is the one case where a zero could still be
drawn without being earned.

---

<!-- The RECIPIENT appends below and sets status: answered. The SENDER sets closed. -->

## Answer
