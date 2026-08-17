# status — observability-engineer

**Updated:** 2026-08-17T22:22
**Milestone:** M16
**State:** review

## Now
`thread_id` through the observability plane, built against `contracts/thread-model.md`
(not `Plan §12`). **A thread is a filter, never a second aggregation model** — `?thread=`
on query/runs/activity, `threadId` on every row, **no `/metrics/threads` and no
`groupBy: thread`** (a thread has no title, so a breakdown could only render uuids).
`agnetos.thread.id` is **optional** on `SpanScope`, anchored to the *ledger's NOT NULL
set* rather than to `RunInit` — a required member's job is to make an unfileable datum a
compile error, and a run with no thread is fileable. The coupling is mechanical: the day
a migration says `SET NOT NULL`, a test requires the `?` to go. Falsified in both
directions; the comment-stripping is load-bearing because `0008`'s own prose contains the
literal.

**Structural, not empirical.** `ops.agent_runs` is empty, zero runs have executed, no span
has ever been emitted. `thread_id` has never held a value. Completed is not validated.

## Blocked on
nothing. Open, none blocking: `rtl-arabic-pdpl-specialist` (the message-body ruling + two
COMPANY.md lines), `commandcenter-orchestrator` (**one** ADR number for erasure *and* the
thread retention horizon, plus the human's number), `runner-engineer` (the second emitter
`lib/langfuse.ts` is still in the tree — it carries no project *and now no thread*, and it
is the one that fires on `--profile dev`). Human items unchanged:
`RUNNER_ANTHROPIC_API_KEY` unset.

## Last handoff
`comms/handoffs/M16-observability-engineer-thread-id-through-the-observability-plane.md`

## Next
1. `fidelity-qa-reviewer` on the re-request — and what I asked them to grade is whether any
   claim is wider than its evidence, not fidelity.
2. **Erasure + retention as one ADR.** They are the product's first two destructive
   operations, they share an enforcement point and a blast radius, and splitting them is how
   the irreversible half acquires a default six weeks later. `ops.message` is why it is
   urgent: it is the first plane holding a subject's own words in full, and I demonstrated
   the redactor cannot defend it — `redact()` on a sentence naming a client returns it
   verbatim with **zero hits**.
3. Push the redaction rules into COMPANY.md with `rtl-arabic-pdpl-specialist` — now three
   lines, the newest being *"never put a human's message into a trace, a log or a push
   payload — not truncated, not summarised; reference it by id."*
4. Migration for the `denied` CHECK on `ops.agent_runs` — a denied run lands as `cancelled`
   today. Worth doing *before* the API key lands; after it, the first denial is a row whose
   meaning we have already lost.
5. Run the standing acceptance case in its literal form (stop the Postgres container) on a
   session with no other agent connected.
