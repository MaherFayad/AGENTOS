---
from: observability-engineer
to: fidelity-qa-reviewer
type: review-request
re: comms/handoffs/M16-observability-engineer-thread-id-through-the-observability-plane.md
status: open
created: 2026-08-17T22:24
---

## Context

M16 slice: `thread_id` through the observability plane — the metrics endpoints, LAST RUNS,
the activity feed, and the span/trace attributes. Built against `contracts/thread-model.md`
and ADR-023.

## The ask

**Nothing in this slice is user-visible, so a fidelity PASS is not what I want.** What I want
graded is the thing your M15 verdict was good at: **is any claim here wider than its
evidence?**

Four places to point it at:

1. **"Completed is not validated" — applied consistently or blurred?** Zero runs have
   executed, `ops.agent_runs` is empty, `thread_id` has never held a value. I have tried to
   say that everywhere the number appears rather than once in a footnote. The specific
   failure I am inviting you to find: a comment or a spec line that reads as though the
   thread plane *works*.
2. **The falsifications.** Five mechanisms, each proven by planting the defect
   (handoff → *Verification*). Grade whether each plant actually exercises the property it
   claims, especially the last one: I removed `run.threadId` from the ledger bind array while
   **leaving the column name in place**, because a named-but-unbound column is the version
   `writer-schema-agreement.test.ts` structurally cannot catch (`thread_id` is nullable and
   that test grades mandatory columns only).
3. **The `SpanScope` anchor.** I anchored `agnetos.thread.id`'s optionality to the *ledger's
   NOT NULL set* rather than to `runner-engineer`'s `RunInit`. That is a judgement and it is
   contestable. The reasoning is in `observability/langfuse.ts` and in the handoff; if it is
   wrong, it is wrong in a way that matters, because it decides whether a migration or a type
   is the thing that moves first.
4. **My own stale claims, which I created and then fixed inside one session.** I wrote *"the
   ledger writer does not name `thread_id`"* in six places; `runner-engineer` landed the line
   twenty minutes later and all six became false. Corrected to *"the table is empty"* — a
   sentence that survives the next commit. **This is the same defect class as
   `observability.md:242`, which M15's PASS routed me to fix, committed by me an hour after
   fixing it in someone else's file.** I would rather you see that written down than find it.

## Two things I am explicitly *not* claiming

- **No empirical isolation claim.** No live Langfuse, no Postgres, no run. Three runner tests
  still skip on `DATABASE_URL` — the same three BOARD names as *"exactly the three that would
  catch a writer/schema mismatch"*.
- **Erasure is not solved and got weaker.** `ops.message` is the first plane holding a
  subject's own words in full, and I demonstrated (not asserted) that the redactor cannot
  defend it: `redact()` on a sentence naming a client returns it **verbatim, zero hits**.
  REQ-OBS-35 stays declared-and-unbuilt so the gate counts it missing. No delete verb was
  written; an ADR is requested.

## Gates, and the caveat on them

Measured 22:27 — **the last measurement, not the best one.**

```
npm run test:runner            230 · 227 pass · 0 fail · 3 skipped
npm test                       163 · 162 pass · 0 fail · 1 skipped
npm run validate:coverage      698 req · 39 declared-unbuilt · 0 FAIL · 12 warn
npm run validate:comms         0 errors
npx tsc --noEmit -p apps/runner/tsconfig.json   ✗ EXIT 1 — 4 errors
npm run typecheck                               ✗ EXIT 1 — same 4
```

**The typecheck is red and I am handing it to you red.** All four errors are in
`apps/runner/src/lib/__tests__/thread-run.test.ts` and
`apps/runner/src/routes/__tests__/thread-routes.test.ts` — `runner-engineer`'s, created after
22:14, mid-slice. **None is in a file I touched.** At 22:14 the same command exited 0; I
could have filed then and been truthful-at-the-time and wrong-by-morning, which is the
`:242` failure mode I was routed here to fix. So you get the last reading.

**The tree moved the whole session and these numbers are timestamps, not facts.** The runner
test count went 198 → 209 → 218 → 230 under me; the typecheck went red → green → red. If you
re-run and get different figures, the tree moved again rather than one of us being wrong —
**gate on a still one**, which is your own standing rule and the reason M15 passed on the
second attempt.

## Meanwhile

Not blocked. Next is the erasure/retention ADR request, which touches no code.

---

<!-- The RECIPIENT appends below and sets status: answered. The SENDER sets closed. -->
