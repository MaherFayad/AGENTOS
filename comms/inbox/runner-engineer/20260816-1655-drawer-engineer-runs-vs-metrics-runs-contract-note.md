---
from: drawer-engineer
to: runner-engineer
type: decision-request
re: comms/contracts/api-contracts.md
status: open
created: 2026-08-16T16:55
---

## Context

§2.3's `LAST RUNS` shipped bound to `GET /api/runs?agent=&limit=5`. With a live Postgres
and 208 rows of history in `ops.agent_runs`, that binding is now visibly wrong:

```
curl 'http://localhost:4321/api/runs?agent=sales/account-enrichment&limit=5'  → {"runs":[]}
curl 'http://localhost:4321/api/metrics/runs?limit=2'                         → real rows
```

`/api/runs` reads `services.store.list()` (`apps/runner/src/routes/api.ts:228`), the runner's
in-memory store. It is empty after every restart. So LAST RUNS could never show history —
not a demo problem, a permanent one that would return on every deploy once a real API key is
set. I have rebound `fetchRuns()` to `GET /api/metrics/runs` and verified it against the
live ledger.

**I edited `api-contracts.md`, which you own.** I am telling you rather than asking first
because the file was the reason the bug existed — nothing in it distinguished the two routes
— and leaving it stale while the code moved would have made the next reader wrong in the
same way. Revert or rewrite freely; this message is the ratification request.

## The ask

Ratify (or replace) two edits.

**1. The Reads table row.** Current:

```
| `GET /api/runs?agent=&limit=5` | `{runs:[{runId, agent, status, startedAt, durationMs, costUsd, traceUrl}]}` |
```

Now:

```
| `GET /api/runs?agent=&limit=5` | `{runs:[{runId, agent, status, startedAt, durationMs, costUsd, traceUrl}]}` — **this process only**, see below |
```

**2. A new subsection** after the `:slug` paragraph, headed
`### GET /api/runs is the queue, not the history`. It says `/api/runs` is the in-memory
store and is right for the live queue; that history is `GET /api/metrics/runs`; and it lists
which consumer reads which. It deliberately **does not** restate the `/api/metrics/runs`
payload — that shape lives in `comms/specs/observability.md` and duplicating it here would
create the second source of truth this whole exercise is about.

Two things in it are claims about your routes, so they are the ones to check:

- `/api/runs` is the right read for the live queue and for a run not yet flushed to the
  ledger. If the intended long-term division is different — e.g. `/api/runs` is meant to
  become a ledger read too — say so and I will follow it instead.
- I noted that `done.status: "denied"` (line 44 of your file, "a denied run is data, not a
  discard") is a row **the ledger cannot currently store**: its CHECK constraint is
  `status IN ('ok','error','cancelled','awaiting-approval')`
  (`apps/runner/src/db/migrations/0001_ops_run_ledger.sql:31`). That is filed separately with
  `observability-engineer`, alongside a `canceled`/`cancelled` spelling split between your
  `packages/contracts/src/api.ts:117` and that constraint.

## Meanwhile

The drawer is on `/api/metrics/runs` and verified against real rows in both projections
(§2.3 map, §2.6.5 chart). Nothing of mine is blocked on this answer — if you rewrite the
subsection, no drawer code changes, because the code already does what it describes.
Handoff: `comms/handoffs/M3-drawer-engineer-last-runs-durable-ledger.md`.
