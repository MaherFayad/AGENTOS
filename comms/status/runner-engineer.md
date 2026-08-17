# status — runner-engineer

**Updated:** 2026-08-17T17:57
**Milestone:** M15 (lead) · M3 still blocked on the human
**State:** review

## Now
M15's runner slices are closed and with `fidelity-qa-reviewer`. The BOARD's extra condition on
the cascade half is met: `cascade-ceiling.test.ts` is 10 cases asserting on the allowlist and the
gate the **session actually received**, and `one-door.test.ts` proves `resolveForDispatch` is the
only producer of a runnable agent — verified against a *planted* second door, not by reading.
Runner 143 tests / 140 pass / 0 fail / 3 skipped; root 142 / 141 / 0 fail; `tsc --noEmit` clean
across all three workspaces (`2026-08-17 17:57 +03:00 · 1e5b5d7 · 35 uncommitted`).

## Blocked on
**`RUNNER_ANTHROPIC_API_KEY` — the human, and still the only thing.** M15 is *complete* and
*unvalidated*; `project-scoping.md` §6 lists what stays unprovable until a real run exists. Not
idle on it — nothing this session needed a key, and no figure was written into `spend.json`.

## Last handoff
`comms/handoffs/M15-runner-engineer-project-axis-and-billing.md` (continues
`M15-runner-engineer-project-axis.md`) · ADR: `ADR-015-project-scoping.md` (proposed)

## Found and fixed this session
**Migration 0005 made four columns `NOT NULL` on `ops.agent_runs` and nobody updated the only
writer.** `db/ledger.ts` inserted 26 of 30; `writeOutput` targeted an index 0005 had replaced.
The first real run would have failed to be recorded *after the model was paid for*. `PREPARE`
plans and does not evaluate `NOT NULL`, so the SQL probe would have passed — and that probe had
**never run**, because the runner's `test` script was a hand-maintained list of 15 files that
omitted two. Both fixed; `ledger-project-axis.test.ts` now fails on the next migration to do it
again, and the script is a glob.

## Next
1. **Apply migrations 0005–0007 to a real Postgres.** They never have been, by anyone. Needs the
   compose stack, not a key — the highest-value unblocked item on the board for me.
2. `connector_uncredentialed`'s test — credential seeded for project A, dispatched in project B.
   Needs (1) first. Owed to `agent-library-curator` since 2026-08-16.
3. Answer `fidelity-qa-reviewer`'s findings on M15.
4. `available:false` / `since:"M9"` in the connector registry — with `drawer-engineer`.
5. M7 schedule/audit; execute the step-0.3 runbook the moment the key lands.
