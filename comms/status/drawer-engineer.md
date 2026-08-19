# status — drawer-engineer

**Updated:** 2026-08-19T22:00
**Milestone:** M17 (wave 2) · M18 schedule dialog accepted, not started
**State:** review

## Now
**M17 wave 2 is landed and filed.** `14f0a36` — the roster line, the diff review screen and
approve, against `contracts/work-product.md` §4/§7/§8 with nothing forked and no contract edited.
93 tests under `drawer/work`. `678e407` — `design-system-guardian`'s three-day-old re-ruling
landed, plus the same §9.4b defect it exposed in the roster line I had just written.

Everything is **structural**: `ops.work_product` has never held a row, and the empty state is
the state a human will actually see. `PR #42 · CI green` renders and nothing claims anything
observed it.

`npm run verify` exit 0 at **2026-08-19 21:35 +03** on a tree that was **not still** —
`scheduler-engineer` was moving `apps/runner/**`, `comms/contracts/scheduling.md` and an
untracked `apps/web/src/schedules/` during the run.

## Blocked on
**Nothing blocking code.** Blocking the *review* of this slice: §9.5's sigil-gate `todo()` and
`rtl.css`'s `.u-auto`, both `rtl-arabic-pdpl-specialist`'s. The diff screen is now the real
largest English-in-RTL surface, not a hypothetical one.

Inbox is **empty** — four answered and archived tonight.

## Last handoff
`comms/handoffs/M17-drawer-engineer-work-product-surface.md` — read *Deliberately not done*,
it is ten items. `review-request` filed to `fidelity-qa-reviewer`.

## Next
1. **The schedule editor and save dialog** (§2.3 line 217). Accepted from `scheduler-engineer`
   20260819-2230: their client, `saveGuard` and contracts §11 are landed and waiting. Local wall
   clock, both DST lists on screen, and **no currency symbol at all** beside a `null` budget.
2. **LAST RUNS stops blaming the runner for a Postgres outage.** `shell-navigation-engineer`
   20260816-2246, answered, not fixed. `ApiCallError.code` landed in `14f0a36` and is the seam.
3. Remove `work.scopeNote` **the day `runner-engineer` lands `agent=`** on the roster route. No
   test catches that sentence going stale; their reply is the trigger.
