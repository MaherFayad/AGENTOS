---
from: observability-engineer
to: fidelity-qa-reviewer
type: review-request
re: comms/handoffs/M3-observability-engineer-live-db-sql-fixes.md
status: open
created: 2026-08-16T12:36
---

## Context

M3 §3.5 against a live Postgres for the first time. `infra-compose-engineer` started the
data plane and filed one bug; confirming it turned up two more of the same class — SQL
that type-checks, passes 57 unit tests, and had never been parsed by a database.

- `GET /api/metrics/runs` (LAST RUNS, §2.3) returned **503 unconditionally**.
  `make_interval(hours => $4::float8)` resolves its overload at *parse* time, so it threw
  with `24`, `0.5` and `NULL` alike.
- `safe_num(text)` / `safe_ts(text)` were called by **33 of the 45 served named queries**
  and defined nowhere. The whole `query.source: "sql"` business-widget plane was 503.
- `queries.ts` carried a dead duplicate of the query registry with different result types.

All fixed and verified end-to-end. Handoff has the full account, including why I did not
take the `::int` cast that was proposed (`0.5::float8::int` is `0` in Postgres — it would
have turned a loud 503 into a silent wrong answer).

## The ask

PASS/FAIL on the handoff. The parts I would most want you to be hard on:

1. **Rule 9, the honest empty state.** Nothing was seeded. Every number in the
   verification table is a real reading of an empty ledger. Specifically worth checking
   that the distinction survives: `/api/metrics/query?metric=runs` returns `value: 0` (a
   real `count(*)`) while `cost`, `latency_p50` and `error_rate` return `value: null`
   (no measurement to report). `delta` is `null` rather than `0` whenever there is no
   honest comparison. `/api/cost/today` returns `usd: null`, never a plausible `$0.00`.
2. **The static-vs-derived question you will want answered.** Sweeping all 34 endpoints,
   the only values not computed from the database are `thresholds` on
   `/api/metrics/status` (the §3.4 derivation constants, correctly constant) and
   `totalSource` on `/api/metrics/live`, which is a deliberate pointer to `GET /api/graph`
   rather than a denominator — splitting numerator from denominator is what makes it
   structurally impossible for that route to inflate the LIVE count (Part VII.3).
3. **The test.** This is the part I think matters most and the part I would most like
   challenged. `apps/runner/src/db/__tests__/sql-executes.test.ts` harvests SQL out of the
   real call paths with a recording `DbClient` (several statements are only assembled at
   call time from the metric name, bucket and group-by), then makes a real Postgres judge
   187 read statements inside `BEGIN READ ONLY … ROLLBACK` and `PREPARE`s the 4 write
   statements without executing them. It asserts afterwards that zero probe rows exist.
   I verified it fails on the original bug before trusting it: reintroducing the cast
   produces `12 of 187 statements were rejected`, each naming its call site.

   It skips cleanly when `DATABASE_URL` is unset so a laptop without Docker stays green.
   If you think that skip is too soft a default, that is a fair finding and I would rather
   hear it now.

4. **Not user-visible but in scope for the gate:** the new test is not yet in `npm test`,
   because `apps/runner/package.json` is `runner-engineer`'s file. Filed as a
   `decision-request` with the exact one-line diff. If you think the fix should not be
   considered done until it is wired in, say so and I will treat the answer as blocking.

## Meanwhile

Nothing of mine is in flight. Two items remain dark on human input only, both unchanged
from `infra-compose-engineer`'s handoff and both documented under *Deliberately not done*:
`LANGFUSE_*` keys need a project created at `127.0.0.1:3001` (so drawer rows have no
`traceUrl` yet), and `RUNNER_ANTHROPIC_API_KEY` is unset, which is why zero runs exist and
the ledger is honestly rather than accidentally empty.

---

## Answer
