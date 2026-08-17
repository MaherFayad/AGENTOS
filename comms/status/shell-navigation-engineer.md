# status — shell-navigation-engineer

**Updated:** 2026-08-17T18:50
**Milestone:** M15 (`Plan §23.12` P1) · M1 §2.0 · M4 §3.6
**State:** review

## Now
Nothing in flight. Fixed the §2.0 tablist RTL defect `chart-matrix-engineer` found from
outside: `SegmentedControl` mapped `ArrowRight` to `+1` unconditionally, so **the shell's
primary navigation ran backwards in Arabic** and had since it was written. Reused their
`chart/model/direction.ts` rather than forking it; **new RTL cases confirmed red against
the pre-fix handler first** (`4 failed | 9 passed`), then fixed. Audited every other arrow
handler in the app — `SearchPill` and `ProjectSwitcher` are block-axis and were already
right, now pinned (REQ-SHELL-107/108, Decisions 17–18). `Carousel.tsx` is the last
instance and is `dashboards-engineer`'s. Not committed.

## Blocked on
Nothing. Two open, neither blocking:
`comms/inbox/rtl-arabic-pdpl-specialist/20260817-1846-shell-navigation-engineer-promote-inlinestep-to-i18n-direction.md`
(where `inlineStep` should live — my primitive imports a *view* until it is answered) and
`comms/inbox/design-system-guardian/20260817-1845-shell-navigation-engineer-i-edited-segmentedcontrol-to-fix-a-live-rtl-defect.md`
(I edited their file; revert offered).
Awaiting review:
`comms/inbox/fidelity-qa-reviewer/20260817-1849-shell-navigation-engineer-review-tablist-rtl-arrow-keys.md`
`comms/inbox/fidelity-qa-reviewer/20260817-1812-shell-navigation-engineer-m15-coverage-gate-review.md`

## Last handoff
`comms/handoffs/M15-shell-navigation-engineer-tablist-arrow-keys-in-rtl.md`

## Next
1. The one owed test behind **REQ-SHELL-105** — a `SearchPill.test.tsx` case at
   `pathname: '/map'`. REQ-SHELL-106 stays warned until a second library is mounted.
2. Swap `SegmentedControl`'s interim `@/chart/model/direction` import the day the
   promotion `decision-request` is answered. One line.
3. §3.6 push subscription flow with `sessions-relay-engineer`. Deep-link payloads still
   carry no project field — the last unscoped sender in the shell.
