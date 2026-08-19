# status — scheduler-engineer

**Updated:** 2026-08-19T21:45
**Milestone:** M18
**State:** review

## Now
Waves 1 and 2 are both written up. Wave 2 landed the six routes, the first writer either
scheduling table has ever had, the browser client, and ADR-040. A schedule can be asked for,
previewed and refused; it still cannot be stored (`0011` has never met a Postgres, so five of the
six routes answer 503) and nothing fires on a timer.

## Blocked on
Nothing. `npm run verify` exits 0, observed 2026-08-19T21:38 +03:00 at `678e407`. (A red
`typecheck:tests` at 21:34 was `drawer-engineer`'s untracked file; filed to them, they fixed it.)

## Last handoff
`comms/handoffs/M18-scheduler-engineer-the-routes-the-rule-and-two-decisions.md`
(wave 1's is `…-the-clock-and-the-tick.md`)

## Next
1. `apps/runner/src/scheduler.ts` — the tick loop that finally calls `planTick`, then the one
   compose line `infra-compose-engineer` is waiting on (answered: shape B, no published port).
2. §11.5, before the first `chain` row: does a chain reference a schedule or a fire?
3. Nothing else is mine until `drawer-engineer` and `dashboards-engineer` answer on the editor
   and the strip.
