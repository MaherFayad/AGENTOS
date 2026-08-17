# ADR-023 — Thread unification: runs, sessions and tasks become threads

**Date:** 2026-08-17 · **Author:** `thread-model-engineer` · **Status:** proposed
**Affects:** `contracts/thread-model.md` (new, mine) · `contracts/api-contracts.md`
(`runner-engineer`, edits proposed not made) · `contracts/project-scoping.md` (consumed
unchanged) · `contracts/agent-cascade.md` (consumed unchanged) · M16 · **supersedes M12's
`POST /api/run/:runId/input`, which is never built**

**Number:** claimed on BOARD when M16 was framed, before this file existed, per
`comms/decisions/README.md`. `Plan §18` calls this decision **"ADR-018"** — translate through
the concordance; the plan's numbers are not this repo's.

---

## Context

AgentOS has three concepts that are the same shape wearing different clothes (`Plan §12`):

| Today | What it is |
|---|---|
| **Session** (Happy, spec §3.1) | a conversation with Claude Code on a machine |
| **Run** (`POST /api/run`, spec §3.2) | a one-shot conversation with an agent, streamed over SSE |
| **Task** (M11, proposed) | a conversation you want to happen later |

They all mean *a conversation with something that does work.* Keeping them separate is why
Part One's M12 has to invent a steering endpoint that duplicates the sessions one, and why
"keep chatting after a run" was awkward enough to need a recommendation rather than an
implementation.

Three constraints made the obvious move — "add a threads table" — not obvious:

1. **One run, one trace** is the observability plane's core assumption (spec §3.5). A design
   in which a thread *is* the traced unit would put four runs in one trace and break every
   cost, duration and tool-span surface already built.
2. **Every table is project-scoped** (ADR-015). A conversation table added without the axis
   would need the same audit 0005 had to perform on four existing tables — backfill, re-keyed
   rollup, a dropped unique index that had been merging two clients' rows.
3. **`#sales` costs one run and `@@sales` costs N**, against a monthly cap that **has never
   once refused anything**, because zero runs have ever executed. Fan-out is the first feature
   here whose first validation run costs N× money against an untested enforcement point.

## Options

| Option | For | Against |
|---|---|---|
| **A. Keep three entities.** Build M11's `ops.task` and `ops.question`, add `POST /api/run/:runId/input` for steering. | Nothing already built has to change. Each entity stays small. | Three tables, three lifecycles, two steering endpoints with different semantics, and "continue this conversation" has no home in any of them. `ops.question` is a system beside threads that has to be kept in step with them. It is the design the plan was written to replace. |
| **B. One thread entity; a run is a thread.** The traced unit becomes the thread. | Conceptually cleanest. | Breaks one-run-one-trace. A thread with four runs is four models, four costs, four durations in one trace, and every §3.5 surface is rebuilt. Rejected on this alone. |
| **C. One thread entity; a run *belongs to* a thread.** `ops.thread` + `ops.message`; `ops.agent_runs` gains `thread_id`. | Collapses three concepts into one addressable unit while leaving the trace boundary exactly where it is. Steering, questions, tasks and schedules all become operations on one object. "Continue" is a new run seeded with the thread's history — which is what Part One recommended anyway. | One more table pair to project-scope, and a nullable `thread_id` on the ledger until its writer catches up (see *Consequences*). |

## Decision

**We adopt option C.**

> **A thread is the unit. A run is a thread with an agent on the other end. A session is a
> thread hosted by a CLI. A task is a thread with a due date. A schedule creates threads.**

`ops.thread` carries `id`, `project_id`, `addressed_to`, `kind`, `state`, `parent_thread_id`,
`created_by`, `due_at`, `account_id` — and one column `Plan §12` does not name, `delivery`,
which the *Consequences* section justifies. `ops.message` carries every turn, including
questions. `ops.agent_runs` gains `thread_id`.

**One run, one trace does not change.** That is the whole reason this unification is
affordable, and it is recorded as a negative fact in the migration because negative facts are
the ones that get quietly reversed.

### The addressing grammar

| You type | Semantics | Cost |
|---|---|---|
| `@account-enrichment` | **direct** — one agent, one run per turn | 1, exactly |
| `#sales` | **dispatch** — the department lead answers or delegates | **at least** 1 |
| `@@sales` | **fan-out** — every member answers independently | N, exactly |
| *(no address)* | **Chief of Staff** — the project's default recipient | at least 1 |

`#` and `@@` are different characters and must *look* different, because one costs one run and
the other costs six. The parser is total, its refusals are named, and it **never guesses**: an
`@slug` matching two departments is `address_ambiguous`, not a pick.

### The mailbox

Every thread has a mailbox; every running agent drains it at tool boundaries. Three levels,
declared by the sender: `note` (queued), `steer` (injected now), `halt` (stop, checkpoint,
ask). The same pipe carries the agent's questions back, so `ops.question` becomes a message
kind inside a thread rather than a system beside one. **`expires_at` stays mandatory**; on
expiry the thread fails loudly with `question_unanswered`.

## What this deletes, deliberately

| Deleted | Fate |
|---|---|
| **M11's parallel task entity** | A task **is** a thread with `due_at` (`Plan §19`). The board and the notification ladder survive inside M16/M17; the second entity model does not. `ops.task` is never created. |
| **`ops.question` as a standalone entity** | A question **is** a message kind. `expires_at` stays mandatory on it. `ops.question` is never created. |
| **`POST /api/run/:runId/input`** | **Never built.** Steering is `POST /api/p/:project/thread/:id/message`. It is not in `api-contracts.md` today, and M16 leaves behind a *test asserting it is absent* rather than a comment saying it should be. If it ever appears there, that is a defect, and correcting it is a `decision-request` to `runner-engineer` — not a quiet edit by anyone else. |
| **The "resume the SDK session vs re-seed a new run" fork** | Continuing a thread starts a new run seeded with the thread's history. That was Part One's recommendation; the thread model makes it the natural implementation rather than a compromise. |

`POST /api/sessions/:id/input` (spec §3.1) is **not** superseded and is untouched. ADR-023
supersedes the *run* input endpoint.

## Consequences

### What becomes easy

- Steering, questions, tasks, schedules and "keep chatting" are all operations on one object,
  so each new surface is a query rather than a new lifecycle.
- Every later phase — presence, scheduling, mobile, the Chief of Staff — reads from or writes
  to one table instead of three (`Plan §20`'s reason for putting P2 second).
- Fan-out has a natural shape: a parent `department` thread with N child `agent` threads on
  `parent_thread_id`. "You see N answers side by side" is one query.

### What becomes hard, and the four judgements that were forced

**1. `delivery` is a column `Plan §12` does not list, and it is not optional.** `#sales` and
`@@sales` both produce a thread of `kind = 'department'`. They differ in exactly one fact — one
costs a run and the other costs N — and a schema that cannot represent the difference between a
$1 action and a $6 action has lost the thing `Plan §12` spends a paragraph insisting on. It is
stored and pinned to `kind` by a CHECK, in the shape of 0005's `account_provenance`.

**2. `ops.agent_runs.thread_id` ships nullable, and that is the decision rather than a
shortcut.** M15's most expensive defect: 0005 made four columns `NOT NULL` and `ledger.ts`
named none of them, so the first real run would have been paid for and then failed to record.
*Grade a constraint from both sides — a `NOT NULL` nobody can satisfy and one that holds are
identical in a schema dump.* `recordRun` is `runner-engineer`'s and the thread-creating route is
their M16 slice; shipping `NOT NULL` ahead of that writer would be writing the M15 defect on
purpose. The forcing function is elsewhere and it is real: the day `SET NOT NULL` lands,
`writer-schema-agreement.test.ts` goes red with no database. Falsified by planting it.

**3. The plan's route cannot be implemented as written.** `Plan §12` says
`POST /api/thread/:id/message`. ADR-015 Q1 makes the project a path segment on every route that
touches one project's data, with no default and no session state; and finding a thread's project
in order to derive the segment would require reading `ops.thread` with no project in scope,
which **raises** by design (0005 §5). So the route is
`POST /api/p/:project/thread/:id/message`. This is a consequence of an accepted decision, not a
style preference — and `runner-engineer` owns the final spelling.

**4. Fan-out dispatch is refused in M16, with the reason stated.** Grammar, parser, composer and
preview all ship. The path that spends N× money does not, because the only enforced ceiling is
Part V's workspace cap and **it has never fired once**. `FAN_OUT_DISPATCH.allowed` is typed
`false` so flipping it is a reviewable, type-level act. One branch, deleted in one line the day
the key and a proven refusal land.

### The cost preview, which is where a plausible number gets believed

`Plan §23.8` asks the composer to say `@@sales · 4 runs · ~$0.40`. **The `4` is knowable
exactly — it is the resolved member count. The `$0.40` has no source**, because there are no
completed runs to average. `TurnCost.estimatedUsd` is typed `null`, so producing a figure stops
the file compiling and the diff that widens it has to say where the number came from.

And a smaller correction in the same direction: `#sales` "says 1 run" understates it. The lead
answers *or delegates*, and a delegation is a second run — hence `runsAreExact: false`.

### `ops.message` is the highest-PII surface in this repo, and one PDPL argument stops working

The body is free text a person typed, stored **verbatim** — a redacted record is not a record.
Three rules bind and each is a mechanism: redact at instrumentation (`messageSpanAttributes` is
a type with no `body` field); structured content stays an **object**, because flattening into
prose defeats key-based redaction; and session content cannot enter the table at all, by
composite foreign key.

**The consequence worth flagging beyond M16:** `comms/specs/observability.md`'s erasure table
rests on minimisation — *"for every field the rules catch, erasure is satisfied by construction:
there is nothing there to erase."* **That does not extend to `ops.message`.** It is the first
plane here where a data subject's own words are stored in full. Project-level erasure still
terminates; subject-level moves from *unanswerable because we minimised* to *unanswerable
because no delete verb exists*, which is a weaker position. Routed to `observability-engineer`
and `rtl-arabic-pdpl-specialist`.

### If we reverse this later

Reversing means re-creating `ops.task` and `ops.question` and re-splitting steering — i.e.
building M11 and M12 as originally specified. The migration is additive (two new tables, one
nullable column), so nothing already built is destroyed by a reversal; what is lost is the
work in `thread-model.md` and the two contract modules. **The expensive direction is the other
one:** having built the parallel entities first and then unified them, because `ops.question`
rows would have to be re-homed into messages after a human had answered some of them.

## Contract edits

| File | Change | By whom |
|---|---|---|
| `comms/contracts/thread-model.md` | **created** — the normative shape the other five M16 slices consume | this ADR's author (owner) |
| `comms/contracts/api-contracts.md` | **none made.** Nine error codes and the route spelling are *proposed* in `thread-model.md` §4.1 and §11 | `runner-engineer` — theirs to accept, rename or refuse |
| `comms/contracts/project-scoping.md` | none — consumed unchanged | — |
| `comms/contracts/agent-cascade.md` | none — consumed unchanged; §9.2 routes one question to its owner | — |
| `comms/BOARD.md` | none by this author. The roster row is `commandcenter-orchestrator`'s first act once `comms/status/thread-model-engineer.md` exists, which it now does | `commandcenter-orchestrator` |

## Status note

**`proposed`, not `accepted`.** Nothing built on it has run: no thread has been created, no
message delivered, no mailbox drained, and `RUNNER_ANTHROPIC_API_KEY` is unset. Acceptance
belongs with the M16 gate, and its PASS will have to say which half it covered —
`thread-model.md` §8 is the list of what it cannot.
