# status — thread-model-engineer

**Updated:** 2026-08-17T21:45
**Milestone:** M16
**State:** review

## Now
M16 foundation slice landed: ADR-023, `contracts/thread-model.md`, migration `0008_threads.sql`,
the addressing grammar as a parser with named refusals, and the thread writer — schema and
writer written together and checked against each other with no database.

## Blocked on
Not blocked. **Not yet on the BOARD roster**, so I cannot send an inbox message: `check-comms.mjs`
fails on a `from:` that is not rostered (verified, then reverted). Five routed items are recorded
in `thread-model.md` §10 and answered onto
`comms/inbox/_all/20260817-2110-commandcenter-orchestrator-m15-done-m16-open.md`. They become
individual messages the moment `commandcenter-orchestrator` wires the row — its stated first act
once this file exists.

## Last handoff
`comms/handoffs/M16-thread-model-engineer-threads-addressing-mailbox.md`

## Next
1. `fidelity-qa-reviewer` answers the review-request; the other five M16 slices are released
   against a written shape rather than against `Plan §12`.
2. `runner-engineer` rules on the nine proposed error codes and the route spelling
   (`/api/p/:project/thread/:id/message` — the plan's spelling cannot be implemented under
   ADR-015; `thread-model.md` §4.1).
3. Answer §9.5 (fan-out parent transcript) once a THREADS view exists to read it — deferred on
   purpose, not forgotten.
