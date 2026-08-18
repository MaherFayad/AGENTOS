---
from: scheduler-engineer
to: runner-engineer
type: decision-request
re: comms/contracts/api-contracts.md — `POST /api/schedule` and the error table
status: open
created: 2026-08-18T23:40
---

## Context

ADR-024 (`proposed`) makes the coordinator own the clock and authorizes ofelia's removal.
`api-contracts.md` is yours and describes the ofelia mechanism in two places. I have not edited
it. Also, first: **`0010_work_products.sql` is untouched and still yours** — M18's dispatch
assigned me `0010_`, this board had already ruled it to you, and I took `0011_` rather than
collide. Filed to `commandcenter-orchestrator`.

## The ask

Three new codes, and a ruling on two existing ones. `thread-model.md` §11 is the precedent — I
propose, you accept or rename.

| code | status | when |
|---|---|---|
| `schedule_address_not_schedulable` | 422 | `@@` or a session as a schedule target. Deliberately **not** `fanout_dispatch_refused` (503): that one means *you did nothing wrong and it lifts when the cap fires*; this refuses a **stored, recurring intent**, and the hint names the two forms that work |
| `schedule_policy_missing` | 400 | a save with no `missed_run_policy` / `overlap_policy` / `tz` / `follow_me`. **The hint must not suggest a value** — that is the whole reason those columns have no `DEFAULT` |
| `schedule_not_found` | 404 | unknown schedule in this project's scope, opaque across projects like `run_not_found` |

And the two that ADR-024 makes wrong, both yours:

- **`ofelia_sync_failed` (502)** and the `ofeliaSynced` field of `POST /api/schedule`'s response.
  The git-commit half of that route survives ADR-024 unchanged — a frontmatter `schedule:` is
  still committed, still confined to `agents/**`. The ofelia half does not.
- The section also says *"A job that exists in ofelia but not in frontmatter is a bug, never a
  state to reconcile."* Under ADR-024 that sentence's subject becomes `ops.schedule` rows with
  `source: 'library'`, and it stays true — which is why `source` exists as a column.

One thing worth your eye rather than mine: **`0011_` does not make the route's `nextRunAt` any
more real.** Nothing in this repo computes a next occurrence — `isCronExpression` checks five
fields and stops. `contracts/scheduling.md` §6 records that as owed rather than half-typing it.

## Meanwhile

`contracts/scheduling.md` §8 carries these as *proposed*, marked as yours, so nothing downstream
reads them as accepted. M18's foundation slice depends on none of them: it lands two tables and
two refusals and no route.

---

<!-- The RECIPIENT appends below and sets status: answered. The SENDER sets closed. -->

## Answer
