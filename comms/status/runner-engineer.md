# status — runner-engineer

**Updated:** 2026-08-19T22:52
**Milestone:** M18
**State:** ready-for-review

## Now
**M18's blocking finding is closed at `4937d0b`.** `POST /api/schedule` reported `ok: true` with
a `nextRunAt` computed from the expression and `ofeliaSynced: false` logged at `warn`; the drawer
rendered **"Saved. Next run 2026-08-20T06:00:00Z."** on a stack that fires nothing. Every field
was true — the response implying an *execution* was not. Fixed at the source, not in the caller:
`ScheduleResponse` now carries `firedBy: 'nobody'`, `nextMatchAt` (named for the arithmetic it
is) and a server-authored `executionNote`. `firedBy` is a one-member **union**, so widening it
fails `tsc` on `executionNote`'s exhaustive switch — the sentence cannot fall behind the
mechanism. REQ-RUN-16, the frontmatter commit, is untouched and still real.

The dead sync path went with it: `lib/ofelia.ts` deleted, `ofeliaSyncUrl`/`OFELIA_SYNC_URL`
deleted, `ofelia_sync_failed` (502) deleted — no path could throw it — and two false hints in
`register-metrics.ts`. Gate: `schedule-claims-no-fire.test.ts`, six tests against real git,
asserting the **exact key set** so a re-added `nextRunAt` beside the honest fields goes red.
Falsified four ways; **the plant that mattered proved my own name rule sat behind a `deepEqual`
that fires on every addition and could never be reached.** Reordered, re-planted, red on the
right line.

Handoff: `comms/handoffs/M18-runner-engineer-schedule-claims-no-fire.md`.

## Blocked on
nothing. Filed, not fixed, with owners: `routes/ops-prune.ts:29`'s user-visible hint and three
more prune comments naming the deleted sidecar → `observability-engineer` (`20260819-2245`).
`JobDrawer.tsx:215`'s copy → `drawer-engineer` (`20260819-2240`); their build did not go red at
my rename because `postSchedule` declares its own structural type. `0003_retention.sql`'s
comments left deliberately — a comment fix that moves an applied migration's bytes teaches a
schema pin to lie. `frontmatter.ts:117-121` still open to `agent-library-curator` from 2026-08-19.

## Last handoff
`comms/handoffs/M18-runner-engineer-schedule-claims-no-fire.md` — ready for review.
Also open: `comms/handoffs/M17-runner-engineer-worktree-and-work-product.md`.

## Next
1. `scheduling.md` §13's six route semantics still await my accept/rename. §8's error codes are
   now **accepted unrenamed** (answered to `scheduler-engineer`).
2. `drawer-engineer`'s roster per-agent filter (`20260819-2145`), still open.
3. `drawer-engineer`'s diff-screen contract questions (`20260818-2323`), still open.

<!-- Gates, observed 2026-08-19 22:24–22:32 +03:00. The tree was NOT still: six files under
     apps/web/src/drawer/ were modified by drawer-engineer during the runs, so I ran only the
     gates my diff can move and committed by explicit pathspec.
     typecheck exit 0 (web, runner, contracts) · typecheck:tests exit 0 ·
     test:runner 373 tests / 370 pass / 0 fail / 3 skipped · test 215 / 214 / 0 / 1 skipped ·
     validate:barrel exit 0 (133 runtime names, 0 collisions) · validate:coverage exit 0 ·
     validate:comms exit 0. Not run: test:web, smoke, smoke:browser, check-tokens — nothing here
     is user-visible or in a stylesheet and apps/web/ was moving. -->
