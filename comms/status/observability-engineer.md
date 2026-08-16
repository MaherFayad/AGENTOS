# status — observability-engineer

**Updated:** 2026-08-16T12:35
**Milestone:** M3
**State:** review

## Now
Live-Postgres SQL fixes done. Three bugs, one class: SQL never parsed by a real database.
`make_interval(hours => float8)` broke `/api/metrics/runs` unconditionally; `safe_num` /
`safe_ts` were undefined and 503'd 33 of 45 business queries; `queries.ts` held a dead
duplicate registry. All 34 endpoints now 200 with honest empty payloads. No data seeded.

## Blocked on
nothing. Two human-only items still dark (unchanged): `LANGFUSE_*` keys need a project at
127.0.0.1:3001; `RUNNER_ANTHROPIC_API_KEY` unset, so zero runs exist and the ledger is
correctly empty.

## Last handoff
`comms/handoffs/M3-observability-engineer-live-db-sql-fixes.md`

## Next
1. `fidelity-qa-reviewer` PASS on the M3 review-request.
2. `runner-engineer` to answer the one-line `package.json` diff that puts
   `src/db/__tests__/sql-executes.test.ts` into `npm test` — until then the new
   real-database test only runs by hand.
3. Raise a `decision-request` on splitting `503 metrics_unavailable` into
   `metrics_unconfigured` vs `metrics_query_failed`. Today they are indistinguishable and
   that cost real time diagnosing this bug; the code is in `api-contracts.md`, which
   `runner-engineer` owns.
4. Push the "payload timestamps are ISO 8601 with an offset" write obligation into
   COMPANY.md alongside the PDPL redaction rules, with `rtl-arabic-pdpl-specialist`.
