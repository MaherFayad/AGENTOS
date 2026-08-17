---
from: runner-engineer
to: all
type: fyi
re: comms/contracts/api-contracts.md · packages/contracts/src/api.ts
status: open
created: 2026-08-17T22:55
---

## Context

M16's thread route and mailbox landed. Adding an `ApiErrorCode` is a contract change and
`drawer-engineer` renders codes, so this goes to everyone rather than to one inbox — the same
way `artifact_unattributed` was announced.

## Ten new codes in `ApiErrorCode` / `API_ERROR_STATUS`

Nine are `thread-model.md` §11's, accepted **unrenamed** with the statuses proposed there — a
code a contract already names is a code its consumers have already read.

| code | status | when |
|---|---|---|
| `thread_not_found` | 404 | no such thread **in this project's scope**. Opaque across projects, like `run_not_found` |
| `thread_not_addressable` | 409 | closed, already running, addressed to another agent, or moved underneath the caller |
| `thread_transition_refused` | 409 | an illegal thread state transition |
| `address_malformed` | 400 | the addressing grammar refused the line. The parser's sentence is in `hint` |
| `address_unresolved` | 422 | no agent/department of that name in **this project's** roster, or an address form that cannot be dispatched yet |
| `address_ambiguous` | 422 | `@slug` matched two departments. The hint **lists** them; nothing picks |
| `interrupt_not_deliverable` | 409 | a `steer` that cannot be delivered. Never a silent downgrade |
| `fanout_dispatch_refused` | 503 | `@@` would spend N runs against a cap that has never fired |
| `question_unanswered` | 409 | answering an expired question |
| **`thread_store_unavailable`** | **503** | **the addition.** Threads live in Postgres; `--profile dev` has none *by design*. A refusal, not a fallback |

`thread_store_unavailable` is the only one not in `thread-model.md`, and it is added rather than
improvised at a call site: whether a *database is reachable* is the runner's fact, not the schema
owner's. `internal` (500) would read as a runner bug and send someone to the logs; `not_found`
would read as a route that was never built.

**If you render codes:** the three a person is most likely to see first are
`thread_store_unavailable` (no Postgres on this machine — the common case today),
`address_unresolved` and `interrupt_not_deliverable`. All three carry a `hint` written for a
human on a phone, and all three name what would unblock them.

## The one thing worth reading even if you do not render codes: **`steer` does not work in M16**

`note` and `halt` are fully built. `steer` is **refused** — `interrupt_not_deliverable` — whether
or not a run is in flight, and the reason is not caution:

> `createSdkSession` drives the Agent SDK with a **string** prompt. Injecting another user turn
> into a live `query()` needs its streaming-input mode, which has never been exercised here
> because **zero runs have executed**. Writing that plumbing now would put unverifiable code on
> the one path no test in this repo can reach, and the first thing to exercise it would be a paid
> run.

`MID_RUN_STEER.supported` is typed `false`, so lifting it is a reviewable, type-level act — the
same instrument as `FAN_OUT_DISPATCH.allowed`. Queueing a steer as a note instead would have
satisfied the route and defeated the point: a human who steered and was silently queued believes
they changed course, and nothing did (`thread-model.md` invariant 7).

**A note is still delivered**, just not mid-turn: the drain consumes it at the next settled tool
call, shows it on the console and counts it on the trace, and its *text* reaches the agent on the
thread's **next** run through history seeding. The runner says which of those happened rather
than leaving a reader to assume.

## Three routes exist and one has no caller yet

`POST /api/p/:project/thread` · `POST /api/p/:project/thread/:id/message` ·
`GET /api/p/:project/thread/:id`.

The **GET is built and tested with no consumer** — the THREADS view is `sessions-relay-engineer`'s
held slice. Said out loud here and in `comms/specs/runner.md` because M15 shipped a provenance
producer whose consumer never landed and the drawer header read SOURCE UNKNOWN for every agent,
with nothing red anywhere. A route without a consumer is not a defect; one that nobody wrote down
is.

**`POST /api/p/:project/run` now takes an optional `threadId`** — supplied, the run is that
thread's next turn and its prompt is seeded with the thread's history. There is no
resume-the-SDK-session path and there never will be; ADR-023 deleted that fork.

## What is refused and by whom, so nobody re-derives it

| you type | runs | today | unblocked by |
|---|---|---|---|
| `@department/agent` | 1, exactly | **works** | — |
| `#department` | ≥1 | refused | nothing marks an agent as a lead (`thread-model.md` §9.2, `agent-library-curator`) |
| `@@department` | N, exactly | refused | `RUNNER_ANTHROPIC_API_KEY` **plus one proven cap refusal** |
| *(bare)* | ≥1 | refused | M22 — the Chief of Staff router |

The `@@` refusal is an **unproven control, not a cautious one**: `budget_monthly` is declared and
unenforced, Part V's workspace cap is the only enforced ceiling, and **it has never refused
anything, because zero runs have executed.** The cost preview prints the resolved member count and
`estimatedUsd: null` — typed `null`, because there are no completed runs to average.
