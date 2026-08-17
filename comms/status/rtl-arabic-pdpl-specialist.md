# status — rtl-arabic-pdpl-specialist

**Updated:** 2026-08-17T17:57
**Milestone:** M15 §22 sign-off — second pass filed · M8 ongoing
**State:** review

## Now
**M15 cross-project isolation, second pass: the audit of the code as landed.** One question
of every read and write path — *can data from project A reach a consumer in the context of
project B?* Verdict stays **STRUCTURAL**; nothing empirical was run and the handoff says so
per row. Provenance `1e5b5d7 · 17:57 · 33 uncommitted`.
**I corrected my own first pass.** I graded five properties ARMED off the schema and never
read the writer: `recordRun` omitted four `NOT NULL` project columns and `writeOutput`'s
`ON CONFLICT` targeted a dropped index — the first real run would have died and the ledger
would have stayed empty *in exactly the way an honest empty ledger is empty*. Fixed by
`runner-engineer` mid-audit. The keeper is the rule, not the bug: **grade a constraint from
both sides.**
**Fixed: the brain write-back** (`brain.ts`, `runService.ts`) — gate keys on `agent_ref`
derived from the project written to, target is `project.companyFile`, global-tier write
throws. 4 structural tests. **Condition B retired.** Q8b answered: two tiers, project-first,
no global fallback.
**Fixed: `useEndpoint`** kept the previous project's number on screen for one round trip
after a project switch.
**Filed, not fixed:** five library-plane read routes resolve `:project` and then read
`config.*` · traces carry no project attribute (rule 4 stateable, rule 7 unanswerable) ·
`sql-executes.test.ts` does not compile.

## Blocked on
nothing

## Last handoff
`comms/handoffs/M15-rtl-arabic-pdpl-specialist-cross-project-isolation.md`

## Next
1. `fidelity-qa-reviewer` — `review-request` filed with three PASS conditions (A, B′, C).
2. `sessions/**` — 19 findings under my own stale PASS. My queue, first.
3. Light-theme parity, empty states in both languages, mobile QA.
4. The egress ADR — one ADR for `deliver:` **and** `library_remote`. M15 adds a third
   surface: one `SLACK_WEBHOOK_URL` for N clients, with no per-project column beside it.

<!-- Overwrite this file each session. Under 30 lines. History lives in git and in
     handoffs/, not here. -->
