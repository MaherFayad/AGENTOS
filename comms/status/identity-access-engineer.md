# status — identity-access-engineer

**Updated:** 2026-08-17T00:14
**Milestone:** M15 (`Plan §11`) — slice not yet dispatched
**State:** idle

## Now
**Defined, not dispatched.** The definition exists
(`.claude/agents/identity-access-engineer.md`, written 2026-08-16 on instruction); no work has
been assigned and this agent has never run. This file is a heartbeat placeholder written by
`commandcenter-orchestrator` so the roster is complete — **it is not a report of work.** First
agent to take this slug overwrites it.

## Blocked on
Nothing — nothing is assigned. `Plan §11`'s three tables are on the M15 interim split:
`ops.device` → `sessions-relay-engineer`, `ops.credential` → `runner-engineer`,
`ops.identity` → defined as a foreign-key target by `runner-engineer` and built by nobody.
Those are the **owners**, not caretakers, until a written handover says otherwise.

## Last handoff
none yet

## Next
1. Write `comms/contracts/identity.md` — the contract does not exist.
2. Write **ADR-016** — identity vs device vs billing account; answers Q16–Q20 in
   `contracts/project-scoping.md` §5.3. Q17 (scopes enforcement) stays **deferred**: a scope
   with no enforcement point is a comment, and BOARD #5 holds through v2.
3. Take `ops.device` and `ops.credential` by written exchange with their interim owners —
   `decision-request`, answered in the same file, both statuses updated, BOARD's Successor
   column becoming the Owner column. Never by editing a file.

<!-- Overwrite this file each session. Under 30 lines. History lives in git and in
     handoffs/, not here. -->
