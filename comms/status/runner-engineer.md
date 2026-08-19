# status — runner-engineer

**Updated:** 2026-08-19T22:10
**Milestone:** M17
**State:** working

## Now
Two things, both closed. (1) **The M17 handoff that never got written** —
`comms/handoffs/M17-runner-engineer-worktree-and-work-product.md`, reconstructed from `6f3abb2`
and `03f04a2` rather than from memory, carrying §0's grading verbatim: mechanic and diff payload
**real**, the `ops.work_product` INSERT **synthesized with no row ever written**, and
`push_state`/`pr_url`/`pr_state`/`ci_state`/`tests_*` **structural** — recorded, not produced,
NULL on every row this build can write. That grading is now load-bearing on a consumer:
`apps/web/src/drawer/work/model.test.ts` (`14f0a36`, `7a1bbc4`, `b68df3b`) parses §0's structural
row out of the markdown and asserts the rendered cells against it in both directions. Loosening a
word in that table goes red in another workspace.

(2) **`02c1955` — the Sunday two validators disagreed about.** `schedule: "0 6 * * 7"` passed
`validate:frontmatter` and threw in `parseCron`. Widened `FIELDS[4]` to `max: 7` with `7` folded
to `0` **after** range expansion (folding a bound turns the legal `5-7` into a backwards `5-0`).
POSIX/Vixie has always meant Sunday by both, so `frontmatter.ts` was the correct side — not
narrowed, and not mine to narrow. `scheduler-engineer`'s pin replaced with the one-way agreement
gate it specified. Three plants, each verified applied: `max: 6` → both tests red; **fold
neutralised → the agreement gate stayed green** and only the occurrence test caught it, which is
the finding worth keeping; fold at parse time → red on `5-7`.

## Blocked on
nothing. Filed, not fixed: `frontmatter.ts:117-121` still justifies the five-field rule with
"ofelia's Go cron would accept it" — already open to `agent-library-curator`
(`20260819-2112`, §1). I did not edit it and did not re-file it.

## Last handoff
`comms/handoffs/M17-runner-engineer-worktree-and-work-product.md` — ready for review.

## Next
1. `POST /api/p/:project/schedule` still calls `syncOfelia` against a container deleted at
   `e4e0bff` — 502 forever. Mine, second ask, not done.
2. `scheduling.md` §13's six route semantics and §8's eight error codes await my accept/rename.
3. `drawer-engineer`'s roster per-agent filter (`20260819-2145`), still open.

<!-- Gates, observed 2026-08-19 21:51 +03:00 on a still tree (nothing else landed during the
     runs; working tree held only my two cron files, since committed):
     test:runner 367 tests / 364 pass / 0 fail / 3 skipped · typecheck exit 0 (web, runner,
     contracts) · typecheck:tests exit 0 · validate:frontmatter exit 0.
     Not re-run today: M17's own falsifications (constant worktree path, planted diff text on
     the trace and prompt planes). Those are recorded in 6f3abb2, not re-observed. -->
