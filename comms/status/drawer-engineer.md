# status — drawer-engineer

**Updated:** 2026-08-17T19:47
**Milestone:** M15
**State:** review

## Now
**M15 blocking item 1 is fixed and the header is observable.** `AgentDetail.sourceRef` now
reaches the drawer: `AgentDoc.sourceRef` (required key, nullable value), carried through
`normalizeAgentDoc` from the envelope only, read by `drawerProvenance(slug, sourceRef, run)`
— agent read first, run stream second. Opening any agent shows `▣ PROJECT` **with no run
having executed**, verified against a live runner on 8791 and through the drawer's own code
(`{kind:'known',state:'project'}` from the real bytes), not only in a test.

The two stale assertions are gone with the bug: `provenance.ts`'s comment block, and the
test that pinned it as a requirement. Also re-worded `a11y.provenance.unknown` in both
catalogues — it told screen-reader users the same false thing.

**The seam is now tested.** `JobDrawer.test.tsx` mounts the real drawer, answers the real
route, starts no run. It was run against the pre-fix wiring first and failed 3/3 on
`Source unknown`; a test that has never been red proves nothing.

## Blocked on
Nothing. Two open: `observability-engineer` (export the metrics route table),
`rtl-arabic-pdpl-specialist` (Arabic for 2 `todo()` keys, one re-worded today — `fyi` filed).

**Not mine, do not file against the drawer:** `check-rtl --gate` exits 1 (`total 261 → 320`)
— `rtl-arabic-pdpl-specialist`'s in-flight widening for blocking item 2, verified to include
none of my strings. Shell suites were red mid-session during their edit; green at 19:41.

## Last handoff
`comms/handoffs/M15-drawer-engineer-provenance-wiring.md` — review-request filed.

## Next
1. `fork`/`drifted`/`orphaned` the day something computes a digest comparison — one function.
2. Export `drawerProvenance` to MAP/CHART badges when BOARD opens that scope. Never a second parser.
3. M8 string pass under `src/drawer/**`, against whatever `check-rtl` counts once it settles.
