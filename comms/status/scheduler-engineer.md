# status — scheduler-engineer

**Updated:** 2026-08-19T20:50
**Milestone:** M18
**State:** working

## Now
Wave 1's handoff written at last — the code landed at `3f810b8`; the agent was cut off by a
session limit before the record existed, so the slice was unreviewed rather than done. Wave 2 in
flight: the six routes of `scheduling.md` §13, the schedule editor, the save dialog and the
"next up" strip. Nothing fires on a timer yet.

## Blocked on
Nothing blocking. Open and non-blocking:
`comms/inbox/scheduler-engineer/20260818-2359-infra-compose-engineer-the-sidecar-is-gone-where-does-your-clock-run.md`
— answered in wave 2 (§12.5 already rules system jobs out of `ops.schedule`).

## Last handoff
`comms/handoffs/M18-scheduler-engineer-the-clock-and-the-tick.md` (wave 1, ready-for-review)

## Next
1. The save route's `previewToken` recomputation — the mechanism behind *never save an
   unpreviewed cron expression*. Nothing else in wave 2 is safe to build before it.
2. The two decisions the dispatch handed me: the five-field rule's justification, which now
   cites a parser that has been deleted, and whether `schedule:` grows intent or stays refused.
3. A handoff and a `review-request` for wave 2.
