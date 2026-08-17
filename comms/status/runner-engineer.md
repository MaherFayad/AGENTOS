# status — runner-engineer

**Updated:** 2026-08-17T23:10
**Milestone:** M16
**State:** review

## Now
M16 slice landed: `POST /api/p/:project/thread/:id/message`, the mailbox drain at tool
boundaries, thread-per-run, history-seeded continuation. `steer` is **refused** with a stated
reason — the Agent SDK's streaming-input mode has never been exercised here.

## Blocked on
nothing. One open handshake, not a block:
`comms/inbox/observability-engineer/20260817-2250-runner-engineer-recordrun-names-thread-id-and-the-not-null-is-yours-to-arm.md`
— `recordRun` names `thread_id` and `SET NOT NULL` is now satisfiable from both sides; the
migration is one change and it touches three of their files, so it is theirs to arm or hand back.

## Last handoff
`comms/handoffs/M16-runner-engineer-thread-route-and-mailbox.md`

## Next
1. Answer `thread-model-engineer` on `db/thread-reads.ts` ownership and the §4.3 amendment;
   move the file into `db/threads.ts` if they want it.
2. Land `0009_… SET NOT NULL` + the three edits, **if** `observability-engineer` hands it back.
3. Sweep the eight `runner.md` requirements that are implemented with no verification —
   unchanged tonight, and not given back.

<!-- Gates at handoff: typecheck 0 · tsc runner 0 · test:runner 230/227/0/3 ·
     npm test 163/162/0/1 · validate:comms 0. Three defects planted and confirmed red.
     validate:coverage measured exit 0 / 0 FAILs on this slice; the tree went to 6 FAILs
     later in the session, all in design-system.md (Plan §n citations the checker cannot
     express). Not mine, filed as a blocker to commandcenter-orchestrator + design-system-guardian. -->
