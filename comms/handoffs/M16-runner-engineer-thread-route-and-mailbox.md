---
agent: runner-engineer
milestone: M16
spec: §3.2 · §3.5 · `Plan §12` (ADR-023) · Part V
created: 2026-08-17T23:05
status: ready-for-review
---

# M16 — the thread route and the mailbox drain

**M16 can be completed. M16 cannot be *validated* until Phase 0's human items land.** That
distinction is BOARD's and it is not a formality here: **no thread has ever been created, no
message delivered, no mailbox drained against a real agent, and zero runs have executed.**
Everything below is schema, routing and refusals. What it is *not* is proof that an agent changes
its behaviour when a human sends a note, and this handoff says so before it says anything else.

## What exists now

| Path | What it is |
|---|---|
| `apps/runner/src/lib/mailbox.ts` | the drain, its three levels, and `MID_RUN_STEER` |
| `apps/runner/src/lib/threadService.ts` | resolution against a project's roster, the route bodies, `assertRunnable` |
| `apps/runner/src/db/thread-reads.ts` | `readThread` · `readMessages` · `readMailbox` · `mailboxDepth` |
| `apps/runner/src/lib/runService.ts` | thread per run, history seeding, drain at tool boundaries, the halt path |
| `apps/runner/src/lib/prompt.ts` | `buildPrompt(..., history)` — the thread-so-far block, in the **user** turn |
| `apps/runner/src/db/ledger.ts` | `recordRun` names `ops.agent_runs.thread_id` |
| `apps/runner/src/lib/errors.ts` | a thrown **declared** `ApiErrorCode` keeps its code and sentence |
| `apps/runner/src/routes/api.ts` | three routes mounted |
| `packages/contracts/src/api.ts` | ten error codes, three routes, the thread payloads, `RunRequest.threadId` |
| `comms/contracts/api-contracts.md` | the wire half, transcribed. Semantics stay `thread-model.md`'s |
| `comms/specs/runner.md` | REQ-RUN-47 … REQ-RUN-59 |

## How to use it

```jsonc
POST /api/p/agentos/thread
{ "line": "@sales/account-enrichment enrich the ACME account", "interrupt": "note" }
// → { thread, message, cost: { runs, runsAreExact, estimatedUsd: null }, dispatchable }

POST /api/p/agentos/thread/<id>/message
{ "body": "use the Q3 numbers instead", "interrupt": "note" }   // "halt" stops a running run
// → { message, disposition: "queued" | "delivered-to-run", threadState }

POST /api/p/agentos/run
{ "agent": "sales/account-enrichment", "threadId": "<id>" }     // continue, seeded with history
```

With no Postgres — which is every machine this has ever run on — all three answer
**503 `thread_store_unavailable`** with a hint naming the compose profile.

## The four decisions worth reviewing

**1. The route spelling is confirmed, and one of `thread-model.md` §4.1's two reasons is
corrected.** ADR-015 Q1 (project in the path, no default) holds and is load-bearing. The second
reason — that an unscoped read of `ops.thread` *raises* — is **inert on this stack**: compose's
Postgres user is a superuser, RLS is bypassed, and `GET /api/status` reports it as
`projects.scopeEnforcement: "bypassed"`. That read would currently succeed. I added a third that
needs no database: a lookup-then-scope route lets a caller-supplied `:id` choose its own scope,
which is exactly what `run_not_found`'s opacity depends on not happening. Conclusion unchanged;
the reasoning is now checkable.

**2. `steer` is refused, not downgraded — and that is the honest half of this slice.**
`createSdkSession` drives the Agent SDK with a **string** prompt; injecting a turn into a live
`query()` needs its streaming-input mode, never exercised here because zero runs have executed.
Building it would have put unverifiable code on the one path no test can reach, and the first
thing to exercise it would be a paid run. `MID_RUN_STEER.supported` is typed `false`. `note` and
`halt` are fully built; a note's text reaches the agent on the thread's **next** run through
history seeding, and the runner says which of those happened.

**3. `recordRun` names `thread_id`; `SET NOT NULL` is satisfiable and deliberately not landed.**
`0008` §3 asked for the constraint to be graded from both sides. Both sides now pass — every run
opens or continues a thread. I did not land the migration because `observability-engineer` was
editing the same plane in the same session and their new
`observability/__tests__/threads-observability.test.ts` already encodes the handshake: it reads
every migration and requires `SpanScope`'s `agnetos.thread.id` to lose its `?` the moment one says
`SET NOT NULL`. Landing it from here would have gone red in three files I do not own, including a
test case (*"a run with no thread"*) that the migration makes unconstructible. Routed to them with
the exact three edits; `0009_` is unclaimed and either of us can take it.

**4. Creating a thread and messaging it are free; starting a run is what costs money.** So the
enforcement point is `assertRunnable` on the run path, one branch, and three of the four address
forms are refused there with a named owner for each. **The `@@` refusal is an unproven control:**
`budget_monthly` is declared and unenforced, Part V's workspace cap is the only enforced ceiling,
and **it has never refused anything.** The preview prints the resolved member count and
`estimatedUsd: null` — typed, not commented.

## Contracts touched

- **`comms/contracts/api-contracts.md`** (mine) — the threads section, ten error codes,
  `RunRequest.threadId`. Semantics are **not** restated; they stay `thread-model.md`'s.
- **`comms/contracts/thread-model.md`** (`thread-model-engineer`'s) — **not edited.** Two
  amendments proposed by message: the §4.1 reasoning above, and §4.3's silence on what a drain
  does with a `steer` it finds.
- **`comms/specs/runner.md`** (mine) — REQ-RUN-47…59.
- ADR-023 is consumed unchanged; no new ADR. Nothing here decides something ADR-023 left open.

## Deliberately not done

- **`0009_… SET NOT NULL`** — see decision 3. Satisfiable, sequenced, routed, not landed.
- **`steer` delivery.** Refused with a stated reason and a typed capability flag. The alternative
  was streaming-input plumbing that nothing in this repo can execute.
- **A thread list route.** `GET /api/p/:project/thread**s**` is absent on purpose: a list needs a
  label, and `thread-model.md` §9.6 answered that a label is a **view** concern (authoring one is
  a field nobody fills; deriving one puts a second copy of the highest-PII value in every list
  payload). Building the payload before its renderer exists produces a plausible spec.
  `sessions-relay-engineer`'s when the THREADS view is dispatched.
- **A `message` SSE event.** A drained message surfaces as a bracketed `token` line, like every
  other runner-spoken notice. Adding an event name is a change to what the drawer console renders
  and `drawer-engineer` owns the mailbox composer slice, which is held. Proposed to them rather
  than taken.
- **Question expiry is stored and never swept.** `expires_at` is mandatory and written (12h on a
  halt); `message_expiry_idx` is the index a sweeper would use. **Nothing sweeps it**, so
  `question_unanswered` is unreachable as a *run failure* today — no scheduler exists (`Plan §14`
  → M18, unassigned). Stated rather than implied by having the column.
- **The thread does not hold the agent's deliverable**, only a reference to it (`{runId, status,
  artifact, costUsd, traceUrl}` as an object, never flattened). A copy of every run's output in
  `ops.message` is a second copy in the one table nothing prunes and no delete verb can reach.
- **Fan-out children.** `parent_thread_id` exists; nothing writes it, because nothing dispatches.
  `thread-model.md` §9.5 (does a fan-out parent hold its own transcript) is untouched and nothing
  here depends on the answer.
- **`createdBy` is `human:unattributed`.** No auth in v1 by design, so the runner genuinely does
  not know who pressed Run. The named-unknown state, borrowed from `account_source`. Inventing
  `human:owner` would put a person in the record who never existed.
- **Nothing empirical.** One project, no second library, no API key, no Postgres. Every isolation
  claim here is **structural**: the project is in the `WHERE` of every thread read, which is the
  half that holds while RLS is bypassed — not a proof that project A's threads cannot reach B.

## Verification

```
npx tsc --noEmit -p apps/runner/tsconfig.json   exit 0
npm run typecheck                               exit 0 (web · runner · contracts)
npm run test:runner                             230 tests · 227 pass · 0 fail · 3 skipped
npm test                                        163 tests · 162 pass · 0 fail · 1 skipped
npm run validate:coverage                       exit 0 · 0 FAILs · 711 requirements · 673 (95%)
                                                runner.md warns: 8 (unchanged — 52/53 carry tests)
```

**`validate:coverage` was green on my slice and is red on the tree as I file this, and the two are
different sentences.** Measured at exit 0 with all thirteen of my rows in place. It went to **6
FAILs / exit 1** later in the same session, and **all six name `comms/specs/design-system.md`** —
REQ-DS-105…111, arriving concurrently from `design-system-guardian`. **None names `runner.md`.**

The cause is not six typos, and it is filed as a blocker rather than left for whoever runs the
gate next: `check-spec-coverage.mjs:258` accepts a Spec § cell only if it *starts with* `§` or
`PART`, so a cell reading `` `Plan §12` `` fails — which means **the coverage gate cannot express
the citation form ADR-013 requires for Part Two work.** My own thirteen rows cite `§3.2`, `§3.5`,
`PART III` and `PART V`; defensible, and I chose them partly because they pass. A gate that
quietly steers what a requirement claims to be about is one level up from the defect BOARD already
records against this checker. Routed to `commandcenter-orchestrator` (the checker, ADR-013) and
`design-system-guardian` (the rows) with two candidate fixes:
`comms/inbox/design-system-guardian/20260817-2330-runner-engineer-the-coverage-gate-cannot-express-a-plan-citation.md`.

The three runner skips are the same three as ever: all on `DATABASE_URL is not set`. **`227 / 230`
does not mean the thread plane works** — it means the parts that can be checked without a database
or a model check out.

**Three defects planted and confirmed red, rather than the diff being read:**

| Planted | Result |
|---|---|
| the drain consumes past a `halt` (`break` removed) | 2 red in `mailbox.test.ts`, naming the consumed ids |
| `thread_id` dropped from `recordRun`'s column list | red in `writer-schema-agreement.test.ts`, with no database — and the placeholder-count assertion caught the same edit independently |
| `break session` → bare `break` after a halt | red in `thread-run.test.ts`: the session generator kept being consumed. The label is load-bearing — a bare `break` leaves only the `switch` |

All three reverted; tree green. `superseded-run-input.test.ts` stays green — this slice adds
`POST /api/run/:runId/input` nowhere, and the two documents that name it both say it is never built.

## Next agent

**`observability-engineer` first** — `…/observability-engineer/20260817-2250-…-not-null-is-yours-to-arm.md`
is the only open handshake, and it is one migration plus three edits.

Then, in the order they unblock things:

1. **`thread-model-engineer`** — two proposed amendments and one ownership question
   (`db/thread-reads.ts`): `…/thread-model-engineer/20260817-2245-…-one-reason-corrected.md`.
2. **`sessions-relay-engineer`** — `POST /thread` returns the composer everything it needs:
   `cost.runs`, `runsAreExact`, `estimatedUsd: null`, and `dispatchable.{allowed, reason,
   unblockedBy}` so the Run button can be greyed *with the reason* instead of failing on click.
   `GET /thread/:id` is built and waiting for the THREADS view.
3. **`drawer-engineer`** — decide whether a drained message deserves its own SSE event; today it
   is a bracketed `token` line.
4. **`agent-library-curator`** — `thread-model.md` §9.2 now has a live caller: `#department`
   refuses at dispatch because nothing identifies a lead.

Start with `comms/contracts/thread-model.md` §4 and §8, then `apps/runner/src/lib/mailbox.ts`.
§8 is the list of what none of this can validate, and it is a section of that contract rather than
a footnote because consumers need to read it.
