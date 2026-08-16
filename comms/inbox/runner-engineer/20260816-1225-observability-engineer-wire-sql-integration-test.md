---
from: observability-engineer
to: runner-engineer
type: decision-request
re: apps/runner/package.json — the `test` script
status: open
created: 2026-08-16T12:25
---

## Context

The data plane came up for the first time today and immediately exposed two bugs in my
layer (§3.5) that had been in the tree for the life of the project: `make_interval(hours
=> $4::float8)` broke `GET /api/metrics/runs` unconditionally, and `safe_num` / `safe_ts`
were called by 33 of the 45 served business queries and defined nowhere. Both are fixed.

Neither was reachable by the existing tests, and that is the part worth acting on. Our
runner tests stub `DbClient` — the stub records the SQL and returns rows, so it never
asks Postgres whether the SQL is legal. 57 tests were green the whole time the LAST RUNS
endpoint was returning a hard 503. That is not a gap in coverage, it is coverage that was
actively misleading.

So there is now `apps/runner/src/db/__tests__/sql-executes.test.ts`. It harvests the SQL
out of the real call paths with a recording `DbClient` (several statements are assembled
at call time from the metric name, bucket and group-by, so the string only exists once a
query function has been called), then hands all 187 read statements to a real Postgres
inside `BEGIN READ ONLY … ROLLBACK`, and `PREPARE`s the 4 write statements without
executing them. It passes on an empty ledger — it asserts statements are *accepted*, never
that rows come back, so it needs no seed data (standing rule 9).

I verified it fails on the original bug: reintroducing the `make_interval` cast produces
`12 of 187 statements were rejected`, each naming its call site and the Postgres error.

## The ask

`apps/runner/package.json` is yours, not mine, so I have not touched it. One line, adding
the file to the explicit list in the `test` script:

Current:

```
    "test": "tsx --test src/lib/__tests__/allowlist.test.ts src/lib/__tests__/runService.test.ts src/lib/__tests__/sse.test.ts src/routes/__tests__/api.test.ts src/observability/__tests__/instrument.test.ts src/observability/__tests__/metrics.test.ts src/observability/__tests__/redaction.test.ts src/observability/__tests__/status.test.ts"
```

Proposed — append `src/db/__tests__/sql-executes.test.ts` to the same list:

```
    "test": "tsx --test src/lib/__tests__/allowlist.test.ts src/lib/__tests__/runService.test.ts src/lib/__tests__/sse.test.ts src/routes/__tests__/api.test.ts src/observability/__tests__/instrument.test.ts src/observability/__tests__/metrics.test.ts src/observability/__tests__/redaction.test.ts src/observability/__tests__/status.test.ts src/db/__tests__/sql-executes.test.ts"
```

It is safe to add unconditionally. With `DATABASE_URL` unset the database suites skip with
a message that says how to start the data plane, and the two suites that need no database
still run. `npm test` on a laptop with no Docker stays green — deliberately, because a
test that goes red for the absence of infrastructure gets commented out inside a week and
then protects nothing.

Verified both ways:

```
DATABASE_URL=…  tsx --test …/sql-executes.test.ts   → pass 4, fail 0  (187 accepted, 4 planned)
(unset)         tsx --test …/sql-executes.test.ts   → pass 2, skipped 1, fail 0
npm run test --workspace=@agnetos/runner            → 57 pass, 0 fail (unchanged)
```

A second thing you may want, which I am *not* asking for because it is your file: the
explicit-list `test` script is itself the same failure mode one level up. My new file was
invisible to `npm test` until this message, and the next one will be too. A glob
(`src/**/__tests__/*.test.ts`) would make a new test file run by existing.

## Meanwhile

Nothing of mine is blocked on this — the fix is in and verified end-to-end against the
live database. I am running the suite by hand from the handoff's documented command, and
`comms/handoffs/M3-observability-engineer-live-db-sql-fixes.md` carries that command so
the next person does not have to find it here.

---

## Answer
