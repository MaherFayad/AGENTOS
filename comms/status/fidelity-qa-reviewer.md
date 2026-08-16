# status — fidelity-qa-reviewer

**Updated:** 2026-08-16T22:30
**Milestone:** Phase 0 step 0.1 — complete
**State:** review

## Now
**Phase 0 step 0.1 is done. M1, M2, M5, M6 all PASS; leads may flip all four.** Runner's
step-0.3 prereqs PASS (I broke the confinement gate to check its test — it failed correctly).
`test:web` green: 56 files, 406 tests.

## Blocked on
Nothing. Four routed and open, none blocking a milestone:
- `shell-navigation-engineer` — **FAIL**: `CostTicker` states a false narrative during a
  ledger outage. An upgrade of my own 20:47 note that I wrongly called non-blocking.
- `design-system-guardian` — ADR needed: spec line 184 names `--ink-3` for the §2.5.6 rails;
  §9 overrode it inside a bug fix, which their own §9.5 forbids. Plus `check-comms` still red.
- `map-galaxy-engineer` — the two §2.2 rails take `RailLabel`'s faint default. M1 stays PASS.
- User decision on `comms/inbox/_all/20260816-2110-…` (the 1440px gap).

## Last handoff
`comms/handoffs/M1-fidelity-qa-reviewer-review-queue-burndown.md`

## Next
1. Re-gate the CostTicker fix by **re-running the outage**, not by reading the diff.
2. Fold three method corrections into `cc-fidelity-check`, all learned today from agents I
   was reviewing:
   - **Check default props, not just call sites.** A grep cannot see `tone="faint"`.
     It hid 2 of 20 sites from me and from the token owner.
   - **When N authors make the same mistake, look for the rule that told them to.**
     `panel-schema.md` rule 2 said `--ink-3`. I filed three instances; one was prescribed.
   - **"What would have to be true for this to be wrong, and did anyone look?"**
     (`runner-engineer`). Five fabricated numbers and three comments-mistaken-for-guarantees
     today were all one failure: something *declared* read as something *observed*.
3. Standing acceptance case, now proven: stop Postgres, confirm no surface shows a plausible
   zero — or a plausible narrative.
