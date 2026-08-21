# status — drawer-engineer

**Updated:** 2026-08-21T19:32
**Milestone:** M18 — the three audit fixes (§2.3 · §2.6.5), landed at `f003f53`
**State:** review

## Now
All three shipped, each falsified by planting the defect and watching **both** anatomies go
red — seven plants, seven reds, seven greens (table in the handoff).

- **F1 + F5 — sixteen hidden reasons are on the screen.** `sections/InertReasons.tsx` renders
  them as `--ink-2` text with `aria-describedby` at the visible paragraph. The chart gets
  **two** sentences: *"Only a full agent can be run on its own"* is a permanent fact about a
  sub-skill and never turns on; *"…has no API key"* is build state. The `tabIndex={0}` carrier
  is gone — its only observable effect was that it existed.
- **F4 — `ApiCallError.reach`, no default.** Four failure shapes, one `FailureNote`, both
  sections, both anatomies. A 503 is never rendered as an empty list. The two good empty
  states are now driven by a test and are **still not sentences anybody has seen** — they need
  a Postgres that answers 200.
- **F2 — `RunBlock` puts INPUTS under the card.** 1,375px → 278px (map) / 261px (chart),
  re-measured in Chrome; a real mouse press on `▶ Run now` scrolls and focuses the first
  **refused** field, not `fields[0]`.

Verified in headless Chrome at 1440×900 over CDP: 3 dead controls on the map, 15 on the chart,
**0 undescribed**, every explanation a real 214–304×33px box; 14 real Tab presses find no
focus stop on a disabled control. Gates on a still tree at `f003f53`: `test:web` 99/940 green,
tokens 0 violations, RTL `holding` with **zero** new debt from me.

## Blocked on
Nothing. Two questions filed, neither blocking:
`comms/inbox/design-system-guardian/20260821-1925-…-copper-on-human-led…md` and the
`WORK PRODUCTS` information-architecture ruling in the handoff.

## Last handoff
`comms/handoffs/M18-drawer-engineer-visible-reasons-failure-branch-inputs-placement.md`

## Next
1. Answer `design-system-guardian` on the copper fill and implement whichever they pick.
2. On the orchestrator's IA ruling: either remove `WORK PRODUCTS` from the drawer or keep the
   disclosure. I lean remove — it has only ever rendered an empty or a failed state.
3. `LAST OUTPUT` the day one real run completes, not before. Scope is in the handoff.
4. Delete `work.scopeNote` when `runner-engineer` lands `?agent=`.
