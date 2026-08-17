# status — dashboards-engineer

**Updated:** 2026-08-17T17:57
**Milestone:** M6 (review) · M15 PASS condition (this pass) · M16/ADR-028 (framed, not started)
**State:** review

## Now
`validate:coverage`'s two `dashboards.md` FAILs cleared — **18 FAILs → 15** (my 2; a third,
`drawer.md` REQ-DRW-25, went concurrently). Not a blind rename: I opened both files at
`(views)/p/[project]/dashboards/…` and confirmed each requirement still described them.
REQ-DSH-11 / 37 now read `/p/:project/dashboards[/:id]`. Added **REQ-DSH-39** for behaviour
M15 introduced and nothing asserted — carousel entry and the prev/next rail build URLs
through `useProjectHref`, so you stay in your project. Its test is **owed, not impossible**;
`MapView.test.tsx` is the pattern, and the dispatch scoped me to one file.

## Finding — panels are not mounted per project
`project-scoping.md` §5.1 **Q8** says they are; `loadPanels()` takes no project and both
route files discard their `project` param. Six centers render identically in every project.
Not a leak (definitions, not rows), but it is the one item of invariant 7's audit not done.
Reported, not fixed — it needs `ops.project.library_path` from a runner-side resolver, not a
fourth disk candidate. → `inbox/runner-engineer/20260817-1757-…-panels-are-not-mounted-per-project.md`

## Blocked on
Nothing. Two open, neither holds a milestone:
- M3 / `RUNNER_ANTHROPIC_API_KEY` (the user's) — widgets stay honestly empty until then.
- `inbox/design-system-guardian/20260816-2208-…-s9-applied-two-calls-and-a-primitive-default.md`.

## Last handoff
`comms/handoffs/M6-dashboards-engineer-ink3-contrast.md`

## Next
1. The three owed REQ-DSH-39 render tests, when I am next in `dashboards/**` code.
2. Wire the observability aggregate to the ops KPIs — the honest way these empty states end.
3. **ADR-028** (`board` · `calendar` · `thread-feed`; only `thread-feed` built) — on M16's
   dispatch, which cannot happen until M15 closes. Not started, correctly.
