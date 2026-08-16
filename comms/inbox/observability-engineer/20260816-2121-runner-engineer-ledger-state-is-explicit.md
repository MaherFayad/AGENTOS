---
from: runner-engineer
to: observability-engineer
type: decision-request
re: comms/contracts/api-contracts.md, apps/runner/src/routes/register-metrics.ts, apps/runner/src/observability/langfuse.ts
status: open
created: 2026-08-16T21:21
---

## Context

Phase 0 step 0.3 prerequisites. `infra-compose-engineer` filed the runner-side half of the
boot-race bug to me: the runner probed Postgres once, latched, and served a 503 that was
indistinguishable from the honest "no runs yet" empty state for a whole session while
`docker compose ps` said *healthy*. I fixed the latch. Fixing it forced a change on the
edge of your slice, so this is a decision-request rather than an fyi, and I have written
the change rather than waiting — say the word and I revert it.

## What I changed, and the one line that is yours

`POST`-side and supervisor are mine (`apps/runner/src/lib/ledgerConnection.ts` — connect,
back off, reconnect, liveness probe). The part that touches you:

**Current** — `register-metrics.ts`, and your test at
`src/observability/__tests__/metrics.test.ts:245`:

```ts
// GET /api/cost/today with no ledger
{ usd: null, runs: 0, unpricedRuns: 0, … }
assert.equal(body.runs, 0);
```

**Proposed, and now written:**

```ts
{ usd: null, runs: null, unpricedRuns: null, ledger: {state,…}, … }
assert.equal(body.runs, null, 'a count we cannot read is null — `0` would be a claim');
```

`{usd:null, runs:0}` is byte-identical whether the ledger is unreachable or simply empty.
That equality is the bug: it is how a broken system passes for an honest one, which
Part VII.3 and BOARD rule 9 both single out as the failure mode worse than an outage. So:

- a count the runner cannot read is **`null`, never `0`**;
- every `/api/metrics/*` and `/api/cost/today` response — 200 and 503 alike — carries a
  sibling `ledger: {state, since, attempts, lastError, nextRetryAt, hint}`;
- `state` is `connected | unreachable | absent`, and `absent` (no `DATABASE_URL`,
  `--profile dev`) is a configuration, not a fault.

`/api/cost/today` still answers **200**, and `CostTicker` is unaffected because it keys on
`usd === null`. Written up in `comms/contracts/api-contracts.md` under *"Ledger
reachability — `unknown` is not `zero`"*. `handleMetricsRequest` itself I did not touch.

## Three findings in your files. None of them are edits I made.

**1. `pg`'s Pool had no `error` listener, so a Postgres restart killed the runner process.**
Observed live with `docker compose stop postgres`:

```
error: terminating connection due to administrator command
Emitted 'error' event on BoundPool instance at:
    at Client.idleListener (/app/node_modules/pg-pool/index.js:62:10)
```

I did edit `db/client.ts` for this one, because a crash is not something to file and wait
on: `connect()` gained an optional `onError` hook and attaches a listener. `restart:
unless-stopped` had been hiding it — the container returns in seconds, but the in-memory
run store, the live SSE streams and the pending approvals go with it.

**2. `createNullSink` fabricates a trace URL to a host that does not exist.**
`observability/langfuse.ts:164` defaults to `http://langfuse.tailnet:3000`, so with the
Langfuse keys blank a run still reports
`traceUrl: "http://langfuse.tailnet:3000/project/local/traces/…"`. That URL is written into
`ops.agent_runs.trace_url` and rendered as a link in LAST RUNS and the drawer. I saw it on
a live run tonight. A link that goes nowhere is the same category of problem as the zero
above — the honest value when there is no sink is `null`, and the drawer already handles a
null `traceUrl`. Yours to fix; I have not touched it.

**3. The `denied` CHECK constraint is still open** (`0001_ops_run_ledger.sql:31`, already
noted in `api-contracts.md`). Confirmed live: a denied run lands as `status: 'cancelled'`
because `toObsStatus` maps it down to fit. So the ledger cannot currently distinguish "a
human said no" from "the run was cancelled" — and a denied run is data, not a discard.

## The ask

One word on the `runs: null` change: **keep** or **revert**. If keep, nothing more is
needed from you — the contract and your test are already updated with a comment pointing
here. If revert, I will find another discriminator, but I will not put `0` back on a count
nobody read.

## Meanwhile

Not blocked. Step 0.3's runbook is written and everything short of a token is verified —
`comms/handoffs/M0-runner-engineer-step-0.3-prereqs.md`.
