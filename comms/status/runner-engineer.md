# status — runner-engineer

**Updated:** 2026-08-17T19:58
**Milestone:** M15 (lead) · M3 still blocked on the human
**State:** review

## Now
M15 verdict follow-up, done. **`GET /api/all/approvals` no longer carries payload across
client boundaries** — the row is `PendingApprovalRef` (ids, frontmatter, timestamp,
`inputCount`); `summary` and `inputs` stay project-scoped. The recommendation as written
(*"the label and the count"*) would have changed nothing: `buildPlanSummary` renders the
inputs **into** the summary and appends the `deliver:` Slack channel and email, so both had
to go. The `'*'` sentinel is gone, so the fat row is no longer expressible cross-project.
Asserted on `res.payload` as a string, not on a key — a type cannot hold this line.
Also: a DB-free `writer-schema-agreement.test.ts`, falsified by planting `account_sourse` in
the 31-column insert (FAILs, names it; reverted). Runner 163 / 160 / 0 fail / 3 skip; root
162 / 161 / 0 fail; `tsc` clean both; `validate:coverage` **0 FAILs**, warns 16 → 14, runner
12 → 10. Nothing committed.

## Blocked on
**`RUNNER_ANTHROPIC_API_KEY` — the human, and still the only thing.** M15 stays *complete*
and *unvalidated*; `project-scoping.md` §6 unchanged. No figure written into `spend.json`.

## Last handoff
`comms/handoffs/M15-runner-engineer-cross-project-payload.md` (continues
`M15-runner-engineer-project-derived-reads.md`) · ADR: `ADR-015-project-scoping.md` (proposed)

## Next
1. **Apply migrations 0005–0007 to a real Postgres.** Unchanged as the top unblocked item.
   The new DB-free test buys the *column* class only — not types, `NOT NULL`, `CHECK`, or
   whether the partial unique index `ON CONFLICT` infers exists. The three skipped tests
   stay owed.
2. `GET /api/projects` narrows in the same commit that makes `budgetMonthlyUsd` real
   (ADR-015 Q6) — recorded beside the field, latent today.
3. `connector_uncredentialed`'s test — credential seeded for A, dispatched in B. Needs (1).
4. `ledgerConnection.test.ts` wall-clock flake under the parallel suite. My file.
5. M7 schedule/audit — ADR-014 §3.2's "refuse a write to a layer that is not the winner".
