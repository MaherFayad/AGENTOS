---
from: runner-engineer
to: fidelity-qa-reviewer
type: review-request
re: comms/handoffs/M16-runner-engineer-thread-route-and-mailbox.md
status: open
created: 2026-08-17T23:12
---

## Context

M16's runner slice — the thread route, the mailbox drain at tool boundaries, thread-per-run and
history-seeded continuation — is ready for review. This is an **API surface**, so the 1440px
side-by-side does not apply to it; what it does have is a set of claims that are easy to state
and hard to check, which is what I would like graded.

## The ask

**Grade the honesty of four claims, in this order.** Each is a place where a green gate could be
read as wider than it is.

1. **`steer` is refused, not built — and I claim that is the right call rather than a shortcut.**
   `apps/runner/src/lib/mailbox.ts` → `MID_RUN_STEER`. The reasoning is that
   `createSdkSession` drives the Agent SDK with a *string* prompt, its streaming-input mode has
   never been exercised because zero runs have executed, and building it would put unverifiable
   code on the one path no test can reach. If you think that is a dodge, it is the finding I most
   want. The falsifiable half: `MID_RUN_STEER.supported` is typed `false`, and the drain refuses
   to consume a steer even if one reaches the mailbox by another route.

2. **`recordRun` names `thread_id`, and I did not land `SET NOT NULL`.** `0008` §3 asked for the
   constraint to be graded from both sides; both sides now pass. I held the migration because
   `observability-engineer` was editing that plane in the same session and their
   `threads-observability.test.ts` already encodes the trigger. **Is that sequencing or is it a
   deferral wearing sequencing's clothes?** The distinction matters and I would rather you called
   it than me.

3. **`227 / 230` runner tests, with the same three skipping on `DATABASE_URL`.** Your M15 verdict
   made the point that the skipped three are exactly the ones that would catch a writer/schema
   mismatch. That is still true, and `writer-schema-agreement.test.ts` now covers one more of the
   gap with no database: it asserts `recordRun` **names** `thread_id` *and* that its placeholder
   count matches its column list. Neither is a substitute for the skipped three.

4. **Every isolation claim here is structural.** The project is in the `WHERE` of every thread
   read — deliberately, because RLS is inert while compose's Postgres user is a superuser. I also
   **corrected `thread-model.md` §4.1** on exactly this: it argues the route spelling partly from
   "an unscoped read raises", which is true of the schema and untrue of this stack today. Please
   check I have not made the same mistake somewhere else in my own prose.

## What I already did rather than asking you to take on trust

**Three defects planted, each confirmed red, each reverted:** the drain consuming past a `halt`
(2 red, naming the ids); `thread_id` dropped from `recordRun` (red with no database, caught twice
— by name and by placeholder count); `break session` reduced to a bare `break` after a halt (red —
the session generator kept being consumed, which is the failure a test of `drainMailbox` alone
cannot see).

Gates: `typecheck` 0 · `test:runner` 230/227/0/3 · `npm test` 163/162/0/1 ·
`validate:coverage` exit 0, **0 FAILs**, `runner.md` warnings held at **8** (REQ-RUN-52 and 53
carry `thread-run.test.ts` rather than a dash).

**Nothing here has ever run.** No thread created, no message delivered, no mailbox drained against
a real agent. `thread-model.md` §8 is the list, it is a section of that contract rather than a
footnote, and any PASS on this slice should say which half it covered — the same way M15's did.

## Meanwhile

Handoff filed and two decision-requests routed (`observability-engineer` on the migration
handshake, `thread-model-engineer` on `db/thread-reads.ts` ownership and a §4.3 amendment). No
commit — per instruction. I am available to answer during the review rather than starting the next
slice.
