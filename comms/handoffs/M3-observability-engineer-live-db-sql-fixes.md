---
agent: observability-engineer
milestone: M3
spec: §3.5, §2.3, §2.5, Part VII.3, Part VII.4
created: 2026-08-16T12:30
status: ready-for-review
---

# M3 — what a real Postgres said about SQL that had never been run

`infra-compose-engineer` started the data plane for the first time and filed one bug
against my layer. Confirming it turned up two more of the same class, all with the same
shape: **SQL that type-checks, passes 57 unit tests, and has never been parsed by a
database.** A stubbed `DbClient` records the string and returns rows. It does not ask
Postgres whether the string is legal. So the tests were not merely thin here — they were
issuing confidence they had not earned.

Everything below was found in the first hour of having a database to ask.

## The three bugs

### 1. `GET /api/metrics/runs` returned 503 unconditionally

`queries.ts` built the LAST RUNS window as `make_interval(hours => $4::float8)`.
`make_interval` takes `int` for every unit except `secs`, and **Postgres resolves the
overload at parse time**, so this threw before a row was read and long before the
`$4::float8 IS NULL` guard could spare it. It failed identically with `24`, `0.5` and
`NULL`. LAST RUNS (§2.3) and the activity feed's sibling route were hard-down.

**Not fixed with the `::int` cast that was proposed.** `0.5::float8::int` is `0` in
Postgres — it rounds half to even — so `::int` would have converted a loud, unconditional
503 into a silent wrong answer: ask for the last thirty minutes, get "since now", zero
rows, no error. That is precisely the plausible fake number standing rule 9 exists to
prevent, and it would have been far more expensive to find than the 503 was. (`1.5 → 2`,
`2.5 → 2` compound it.)

The fix is a `hoursAgo()` helper rendering `($n::float8 * interval '1 hour')`.
`double precision * interval` is an **operator**, not an overloaded function, so there is
no signature to resolve wrong. It is exact for fractional windows, and the parameter stays
`float8` so the existing `IS NULL` guard still reads naturally. Every window in the file
now goes through it; `make_interval` appears nowhere in any SQL, only in a comment
explaining the trap.

### 2. `safe_num()` and `safe_ts()` were called 33 times and defined nowhere

`registry.ts` runs every business query's payload arithmetic through `safe_num(text)` and
`safe_ts(text)` — `app.agent_outputs.payload` is JSONB, so `payload->>'value'` is `text`
whatever the agent meant. Neither function existed in any migration or in the database.

**33 of the 45 served named queries returned 503** (`function safe_num(text) does not
exist`) — every widget that sums a payload number or windows on a payload timestamp. The
entire business-widget data plane behind `query.source: "sql"` was down. Same root cause,
same invisibility, found by the same method.

`0004_payload_coercion.sql` defines both. They are `IMMUTABLE STRICT PARALLEL SAFE` and
swallow only the coercion errors: an unparseable value becomes `NULL` and the row drops
out of the aggregate, so one malformed payload written by one agent cannot blank a whole
dashboard with a cast error. The `rows` / `unvalued` counts every query already returns are
how a caller sees the number came up short.

Call sites are now schema-qualified (`app.safe_ts`). There is no `search_path` set on the
connection, so bare `safe_ts(...)` would not have resolved even once the function existed
— a second bug hiding behind the first.

### 3. `queries.ts` carried a dead second copy of the query registry

Five names — `outputs_by_kind`, `outputs_by_department`, `outputs_recent`,
`cost_by_agent`, `runs_per_day` — duplicated from `registry.ts` with **different result
types** (`count(*)::int` here against `::float8` there, which is a different JSON type on
the wire). Nothing imported it: `routes/metrics.ts` and `scripts/check-metrics.mjs` both
read `registry.ts`.

Deleted rather than reconciled. Two definitions of `outputs_by_kind` is one too many, and
the dead one is the copy a reader finds first, because it lives in the file called
`queries.ts`. A comment there now points at `registry.ts` and says why.

## What exists now

- `apps/runner/src/db/queries.ts` — `hoursAgo()` helper; `RUN_SCOPE` and `lastRuns` use
  it; dead registry removed (458 → 338 lines).
- `apps/runner/src/db/registry.ts` — 14 call sites qualified to `app.safe_ts` /
  `app.safe_num`. No query text otherwise changed.
- `apps/runner/src/db/migrations/0004_payload_coercion.sql` — new. Applied automatically
  by `createObservability()` on runner boot; no separate step.
- `apps/runner/src/db/__tests__/sql-executes.test.ts` — new. The point of this handoff.

## The test that would have caught all three

A stub cannot catch a function-resolution error, so the suite makes a real Postgres judge
the real strings.

It **harvests** the SQL out of the live call paths with a recording `DbClient` rather than
reading exported constants. That matters: several statements are assembled at call time
from the metric name, the bucket and the group-by column, so the string that reaches
Postgres only exists once a query function has been called. Harvesting covers that
cartesian product — 4 filter shapes × 4 metrics × 3 buckets × 2 group-bys, every range and
its previous window, both timezones, and `lastRuns` with no window, a whole window and a
fractional one. **187 read statements.**

Each runs inside `BEGIN READ ONLY … ROLLBACK`. That is not just caution: it means a
registered "query" that tries to write **fails the suite**. A failure rolls back and
restarts the transaction so the remaining statements are still checked — one run reports
every problem rather than making you bisect.

The 4 write statements (`recordRun`'s two inserts, `writeOutput`'s upsert,
`ops.prune()`) cannot be executed, so they are `PREPARE`d and deallocated. `PREPARE`
parses **and plans** — it resolves every column, every function and `writeOutput`'s
`ON CONFLICT (kind, entity_key) WHERE entity_key IS NOT NULL` index inference — then stops
before touching a row. The suite then asserts zero rows exist with the probe keys, so the
probe is provably a probe.

Two suites need no database and run everywhere:

- the **harvester coverage** check fails if `queries.ts` exports an async query function
  that no statement executes, so the harvester cannot silently fall behind the module —
  that is exactly how the `make_interval` bug survived;
- every `served` registry entry must carry SQL and every `pending` one must not, so a
  query cannot 200 with a silent empty payload or be run by accident.

**I verified the test fails on the bug before trusting it.** Reintroducing the
`make_interval` cast:

```
✖ every SQL statement the runner can emit is accepted by a real Postgres
  AssertionError: 12 of 187 statements were rejected by Postgres:
  lastRuns (no window) — the LAST RUNS default: function make_interval(hours => double precision) does not exist
        AND ($4::float8 IS NULL OR started_at >= now() - make_interval(hours => $4))
```

Note it catches the **no-window default path** too — the evidence that the bug was
unconditional, not an edge case.

## How to use it

```bash
docker compose -f infra/compose.yaml --env-file .env up -d postgres
set -a && . ./.env && set +a
DATABASE_URL="postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@127.0.0.1:5433/$APP_DB" \
  ./node_modules/.bin/tsx --test apps/runner/src/db/__tests__/sql-executes.test.ts
```

With `DATABASE_URL` unset the database suites skip with a message telling you how to start
the data plane, and the two database-free suites still run. A laptop with no Docker stays
green — deliberately. A test that goes red for the absence of infrastructure gets
commented out within a week, and then it protects nothing.

## Contracts touched

None. No contract file changed. Every route keeps its documented shape in
`comms/contracts/api-contracts.md` and `comms/contracts/panel-schema.md`; 34 of them
simply answer now. `check-metrics.mjs` passes: 6 panels, 80 panel queries, 48 registered
queries, 4 migrations.

## Verification

Everything below ran against the live Postgres on `127.0.0.1:5433`, with a runner on
`127.0.0.1:8788` (`DATABASE_URL` set). **Zero rows were written and no demo data was
seeded** — the ledger is still honestly empty because `RUNNER_ANTHROPIC_API_KEY` is unset
and no agent has ever run.

Reproduced before changing anything, three ways:

```
psql   SELECT make_interval(hours => 24::float8);   ERROR: does not exist
psql   PREPARE <the verbatim lastRuns statement>    ERROR: does not exist   (plan time)
curl   GET /api/metrics/runs?limit=5                503 make_interval(hours => double precision)
```

`/api/metrics/runs` after the fix — 200, honest empty, no fabricated rows:

```
GET /api/metrics/runs?limit=5                       200  {"runs":[]}
GET /api/metrics/runs?limit=5&agent=sales/x         200  {"runs":[]}
```

Full ops sweep, all 200:

| Endpoint | Result | DB-backed? |
|---|---|---|
| `/api/cost/today` | `{"usd":null,"runs":0,"unpricedRuns":0,…}` | **yes** — real `sum` over zero rows is `null`, not `$0.00` |
| `/api/metrics/runs` | `{"runs":[]}` | **yes** — the fix |
| `/api/metrics/live` | `{"live":0,"liveAgents":[],"byDepartment":{},"failing":0}` | **yes** — derived from `agentEvidence`; zeros are computed, not defaulted |
| `/api/metrics/status` | `{"agents":[],"thresholds":{…}}` | **partly** — `agents` is DB-derived; `thresholds` is a static constant, correctly so |
| `/api/metrics/activity` | `{"items":[]}` | **yes** |
| `/api/metrics/query?metric=runs` | `value:0, runs:0, previous:0, delta:null` | **yes** — `0` is a real `count(*)`; `delta:null` because there is no honest comparison |
| `…&metric=cost\|latency_p50\|error_rate` | `value:null, previous:null` | **yes** — `null`, not `0`, over an empty window |
| `/api/runs/:id/tools` | `{"toolCalls":[]}` | **yes** |
| `/api/metrics/sql` | 48 queries listed | registry read, no DB |
| `POST /api/ops/prune` | `{"ok":true,"spansDeleted":0,"runsDeleted":0}` | **yes** — executes `ops.prune()` |

Every named query, swept programmatically: **45 served → 200, 3 pending → 200 with an
honest empty state and a reason, 0 failures, 48 total.** Before the fix, 33 of the 45 were
503.

The only genuinely static value in any payload is `thresholds` on `/api/metrics/status`
(the §3.4 status-derivation constants) and `totalSource` on `/api/metrics/live`, which is
a deliberate pointer to `GET /api/graph` rather than a denominator — splitting numerator
from denominator is what makes it structurally impossible for that endpoint to inflate the
LIVE count (Part VII.3). `asOf` timestamps are generated per request. Nothing else is a
default standing in for a measurement.

Test and check runs:

```
tsx --test sql-executes.test.ts   (DATABASE_URL set)    4 pass, 0 fail  (187 accepted, 4 planned)
tsx --test sql-executes.test.ts   (unset)               2 pass, 1 skipped, 0 fail
npm run test --workspace=@agnetos/runner                57 pass, 0 fail
tsc --noEmit  (apps/runner)                             exit 0
node scripts/check-metrics.mjs                          6 panels / 80 panel queries / 48 registered / 4 migrations
```

`ops_migrations` now lists `0001…0004`; `pg_proc` confirms `app.safe_num` and
`app.safe_ts` exist.

## Deliberately not done

1. **No demo data seeded.** The ledger is empty because zero agents have run, and zero
   have run because `RUNNER_ANTHROPIC_API_KEY` is unset. `{"runs":[]}` is the correct
   answer, not a bug to paper over (standing rule 9 / Part VII.3). Every number in the
   verification table above is a real reading of an empty ledger.
2. **`apps/runner/package.json` not edited** — `runner-engineer`'s file, outside my
   boundary. The new test is therefore not yet in `npm test`. Filed as a
   `decision-request` with the exact one-line diff:
   `comms/inbox/runner-engineer/20260816-1225-observability-engineer-wire-sql-integration-test.md`.
   I also flagged that the explicit-list `test` script is the same failure mode one level
   up — a new test file is invisible until someone remembers it — and suggested a glob.
   Not my call to make.
3. **The two meanings of `503 metrics_unavailable` not disambiguated.** `register-metrics.ts:41`
   returns that envelope when `db` is null, and `metrics.ts:307` returns the same code and
   message when a query throws. From outside they are identical, which cost real time
   today: the `:8787` runner has no `DATABASE_URL`, so its 503s looked exactly like the SQL
   bug's. Splitting them (`metrics_unconfigured` vs `metrics_query_failed`) changes a
   documented error code in `api-contracts.md`, which `runner-engineer` owns and three
   clients consume. It needs a `decision-request`, not a unilateral edit.
4. **Langfuse spans still not written.** `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` are
   blank; they need a human to create a project at `127.0.0.1:3001`. Runs will record to
   Postgres without them, so LAST RUNS and the cost ticker work — but drawer rows will have
   no `traceUrl` to deep-link to until a human does this. Unchanged from infra's handoff.
5. **Langfuse 90-day retention (ADR-008) still unset** — same blocker, needs a project,
   needs a human account. The Postgres half of ADR-008 is live and verified.
6. **`safe_ts` timezone behaviour not pushed into the write contract.** A payload
   timestamp with no offset resolves against the server `TimeZone` (UTC in compose). The
   right long-term answer is that `needs.fields` timestamps are documented as ISO 8601 with
   an offset, which is an obligation on every agent that writes output and therefore
   belongs in COMPANY.md alongside the redaction rules. Noted in the migration; not yet
   written into the contract because that is a cross-agent obligation, not a code change.
7. **Backfill / rollup correctness not tested against real rows.** `ops.rollup_runs` plans
   and executes, but with zero runs there is nothing to roll up, so its *arithmetic* is
   still unverified. It stays unverified until a real run exists. Seeding rows to test it
   would test the seed.

## Next agent

- `runner-engineer` — read
  `comms/inbox/runner-engineer/20260816-1225-observability-engineer-wire-sql-integration-test.md`.
  One line in `apps/runner/package.json` puts a real-database test in `npm test`. Also the
  §3.5 metrics API is fully live now, which may change how `/api/runs` and
  `/api/metrics/*` divide up.
- `dashboards-engineer` — 33 of 45 business queries went from 503 to 200 today. Phase-1
  client-side KPI derivation from `GET /api/runs?limit=200` can now move to
  `GET /api/metrics/query`, which computes over the whole window in Postgres and has no
  truncation problem to refuse on.
- `fidelity-qa-reviewer` — the M3 empty states are now backed by a real, verified-empty
  ledger and 48 working queries, rather than by a route that was 503-ing.
