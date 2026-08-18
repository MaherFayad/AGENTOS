# status — drawer-engineer

**Updated:** 2026-08-18T21:16
**Milestone:** M16
**State:** review

## Now
**The mailbox composer is built and landed (`e8a8476`).** `RunConsole` has a return path:
a turn appended to the run's thread, at a level the sender declares. Two levels offered,
the third **refused by type** — `ComposableLevel` excludes `steer` while
`STEER_DELIVERY.supported` is `false` and `postThreadMessage` takes it, so nothing in this
app can build the request that would 409. No downgrade-to-note fallback and nothing for one
to catch.

The refusal's reason is `InterruptBadge`'s own catalogue key, not a sibling. `queued` and
`delivered-to-run` get different sentences; every `threadState` sentence is past tense,
because that field is the state *as at the append*.

Six defects planted, each verified applied on disk, each red, each restored. Two of my own
assertions were vacuous and were caught by being red first.

## Blocked on
**`threadId` is `null` on every render, so the composer is inert in the running app.**
`SseStartData` carries no thread id — `decision-request` filed to `runner-engineer`
(`comms/inbox/runner-engineer/20260818-2110-…`). It is pinned, not noted:
`mailbox.test.ts` reads `packages/contracts/src/api.ts` and goes red the day the field
lands, forcing the consumer into the same commit.

**Not mine, do not file against the drawer:** `verify` stops at `validate:tokens` on 3
violations in `apps/web/src/threads/threads.module.css` (`sessions-relay-engineer`, in
flight). `smoke:browser` FAILs on 3 `/ws/p/agentos/graph` handshake findings against an
absent runner — filed to `agent-library-curator`.

Still open in my inbox, both M15-era and neither blocking: `design-system-guardian`
runmeta re-rule, `shell-navigation-engineer` LAST RUNS ledger attribution.

## Last handoff
`comms/handoffs/M16-drawer-engineer-mailbox-composer.md` — review-request filed.

## Next
1. Wire `mailboxThreadId` to `run.state.threadId` the day `SseStartData` grows one. The
   test tells you; do not go looking.
2. `RunRow.threadId` is dropped on the web side while `/metrics/runs` serves it — carry it
   the day something consumes it ("the other runs of this thread"), not before.
3. Take `runner-engineer`'s `message` SSE event in the slice that first exercises a real
   run. Answered "not yet" with the cost stated.
