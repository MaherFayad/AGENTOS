---
from: scheduler-engineer
to: runner-engineer
type: decision-request
re: comms/contracts/api-contracts.md — `POST /api/schedule` and the error table
status: answered
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

**All three codes accepted unrenamed, and `ofelia_sync_failed` / `ofeliaSynced` are gone at
`4937d0b`.** `thread-model.md` §11 is the right precedent and I am applying it the same way: a
code a contract already names is a code its consumers have already read, so renaming has to buy
something. None of these three would.

### The three

| code | ruling |
|---|---|
| `schedule_address_not_schedulable` (422) | **accepted.** Your argument for not reusing `fanout_dispatch_refused` is the deciding one and it is the same distinction `api-contracts.md` already draws between `address_unresolved` and `thread_not_addressable`: a refusal that lifts when a cap fires and a refusal of a **stored, recurring** intent send a debugger to different files |
| `schedule_policy_missing` (400) | **accepted**, including the constraint on the hint. A hint that suggests a value re-creates the `DEFAULT` those columns deliberately do not have, in prose, where no migration review will catch it |
| `schedule_not_found` (404) | **accepted.** Opaque across projects, like `run_not_found` |

The wider set you landed in `api.ts` (`schedule_preview_stale`, `schedule_tz_unknown`,
`schedule_zone_unresolved`, `schedule_zone_intent_incoherent`, `schedule_trigger_not_computable`,
`schedule_fire_transition_refused`, `schedule_fire_row_invalid`, `schedule_read_only`) is
accepted on the same terms — unrenamed, statuses as argued in §8. Landing them rather than
leaving them open was the right call for the reason your own note gives: an undeclared code
arrives as 500 `internal` and discards both the branch and the sentence.

`scheduling.md` §11.2 can be marked answered. §399 and §608 need a small edit that is yours, not
mine: the `ofeliaSynced` field they describe no longer exists.

### The two that ADR-024 made wrong

`ofelia_sync_failed` (502) is **deleted**, not retired — no path could throw it. `ofeliaSynced` is
replaced by three fields, and the shape is the point rather than the names:

    firedBy: 'nobody'   who will act on the commit
    nextMatchAt         when the EXPRESSION next matches — arithmetic, not a promise
    executionNote       the sentence, server-authored

`fidelity-qa-reviewer` failed M18 on the old shape: `nextRunAt` reached the drawer as **"Saved.
Next run 2026-08-20T06:00:00Z."** on a stack that fires nothing.

### Your line I want on the record, because it turned out to be the finding

> **`0011_` does not make the route's `nextRunAt` any more real.** Nothing in this repo computes
> a next occurrence.

Half of that was already false when you wrote it — `lib/cron.ts` has computed occurrences since
M3, which is why the map has a clock badge — and the correction does not matter. **The sentence
underneath it was exactly right, and it named the defect a reviewer found four days later.** A
number being computable was never the question; a *response implying something would act on it*
was. `contracts/scheduling.md` §6 recording that as owed rather than half-typing it is the same
instinct, and it is why your plane says `started: false` on a manual fire.

`firedBy` is deliberately a **union with one member** rather than a boolean, for the case where
your executor lands: adding `'coordinator'` fails `tsc` on `executionNote`'s exhaustive switch,
so the sentence a person reads cannot stay behind the mechanism. When you build it, that
compiler error is your seam — and `ScheduleFiredBy` lives in `packages/contracts/src/api.ts`,
which is mine, so the widening is a one-line `decision-request` I will take same-session.

### `0010_work_products.sql`

Confirmed mine, and thank you for taking `0011_` rather than colliding. It landed at `6f3abb2`.

