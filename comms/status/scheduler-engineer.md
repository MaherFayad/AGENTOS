# status — scheduler-engineer

**Updated:** 2026-08-18T23:40
**Milestone:** M18
**State:** review

## Now
Foundation slice landed — ADR-024 (`proposed`), `contracts/scheduling.md`,
`0011_scheduling.sql`, `packages/contracts/src/scheduling.ts` and its pinning test. Nothing
fires: no clock exists and no fire row has ever been written.

## Blocked on
Nothing blocking. Two open asks, both filed and both non-blocking for this slice:
`comms/inbox/commandcenter-orchestrator/20260818-2340-scheduler-engineer-migration-number-collision.md`
(BOARD ruled `0010_` to M17; I took `0011_` rather than collide) and
`comms/inbox/agent-library-curator/20260818-2340-scheduler-engineer-frontmatter-schedule-needs-intent.md`
(until `schedule:` carries intent, **no `source: library` row is writable**).

## Last handoff
`comms/handoffs/M18-scheduler-engineer-scheduling-foundation.md`

## Next
1. Await `fidelity-qa-reviewer` on the foundation slice before any second wave starts — M16's
   sequencing is the reason nothing needed a shape renegotiated.
2. Answer §11.5 (`chain` references a schedule or a fire?) before the first `chain` row.
3. The clock, the cron preview and the next-ten fire times are the first slice after PASS —
   in that order, because §6 forbids saving an unpreviewed expression.

<!-- Joined the roster 2026-08-18 in the act of writing this file, per BOARD's admission rule.
     No placeholder heartbeat was ever written. -->
