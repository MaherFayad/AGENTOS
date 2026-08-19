# status — drawer-engineer

**Updated:** 2026-08-19T22:52
**Milestone:** M17 (wave 2, re-review filed) · M18 schedule dialog accepted, not started
**State:** review

## Now
**The three surface FAILs from `fidelity-qa-reviewer` are fixed in `45aa518`,** plus the schedule
sentence the coordinator routed mid-slice and one defect found while fixing the first.

- The review screen is a modal that now takes focus and confines it. Eight controls behind it
  were tabbable; a plant names all eight in its failure text.
- `focusables()` asks the ancestor chain for `inert` too. The include-list family again.
- The diff is windowed through `sessions/lib/virtual.ts`. The falsification reproduces the
  reviewer's number: `expected 8000 to be less than 400`. **`drawer.module.css` has no diff** —
  rows flatten and fold back into the same per-file cards.
- ⏰ Schedule renders `runner-engineer`'s `executionNote` and draws **no instant at all**. Their
  `4937d0b` had already made the false sentence unreachable — but by accident of absence, with our
  local type still declaring `nextRunAt`. That is closed too.
- Found on the way: `useFocusTrap` had `onClose` in its deps, so the drawer's own trap re-armed
  and re-autofocused on every review open/close.

Twelve plants across the slice, each verified applied before its suite ran.

`npm run verify` exit 0 **and** `smoke:browser` exit 0 at **2026-08-19 22:41–22:44 +03**, at
`f3180b9`, only my sixteen files dirty. `check-tokens`:
`scanned at 2026-08-19 22:39 +03:00 · f3180b9 · 16 uncommitted under apps/web`, `violations 0`.
**The tree moved under this slice** — `runner-engineer` landed `4937d0b` and `f3180b9` during it.

## Blocked on
**Nothing blocking code.** Still blocking a *complete* verdict on this surface: no test anywhere
asserts that the browser agrees with `focusables()` (jsdom implements neither `inert` nor Tab),
and §9.5's `todo()` and `rtl.css`'s `.u-auto` remain `rtl-arabic-pdpl-specialist`'s.

Inbox is **empty**.

## Last handoff
`comms/handoffs/M17-drawer-engineer-work-product-surface.md` — read the **Addendum** at the foot
and *Deliberately not done*, which now records that naming the diff's unbounded DOM in a handoff
got its magnitude wrong by two orders. `review-request` filed 20260819-2250.

## Next
1. **The schedule editor and save dialog** (§2.3 line 217) — `scheduler-engineer`'s client,
   `saveGuard` and contracts §11 are landed and waiting. Local wall clock, both DST lists on
   screen, no currency symbol at all beside a `null` budget.
2. **LAST RUNS stops blaming the runner for a Postgres outage.** `ApiCallError.code` is the seam.
3. Remove `work.scopeNote` **the day `runner-engineer` lands `agent=`**, and put it on the empty
   branch too until then — the reviewer's observation, unfixed.
