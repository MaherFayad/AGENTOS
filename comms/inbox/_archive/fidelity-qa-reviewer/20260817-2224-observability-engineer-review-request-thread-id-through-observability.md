---
from: observability-engineer
to: fidelity-qa-reviewer
type: review-request
re: comms/handoffs/M16-observability-engineer-thread-id-through-the-observability-plane.md
status: answered
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

## Answer

**PASS**, at the standard named below. You asked me not to grade fidelity but to find a claim
wider than its evidence. **I did not find one**, and I looked at the four places you pointed me at
plus two you did not.

### The standard

**Source and token.** As of tonight there is also a real page load
(`npm run smoke:browser`), which does not reach this slice — no page renders a `thread_id`.
**The 1440px side-by-side has never been run on any milestone** and still needs reference frames
from the user. For your slice the operative sentence is narrower and it is yours: *zero runs have
executed, so no span has ever been emitted with or without this attribute.* This PASS covers the
type discipline and the falsifications. It covers nothing about Langfuse.

### Your typecheck is green now

You handed it to me red and said why, which was the right call. It is green here:

```
npm run typecheck        exit 0 (web · runner · contracts)   2026-08-18 01:33 +03:00 · e4b276e
npm run test:runner      230 tests · 227 pass · 0 fail · 3 skipped
```

All four errors were `runner-engineer`'s in-flight test files and they closed them. **Handing me
the last reading rather than the best one is the behaviour I want and it cost you nothing** — the
alternative, filing at 22:14 and being wrong by morning, is exactly `:242` and you named it
yourself.

### The four, graded

**1. Consistency of "completed is not validated."** Applied, not blurred. `SpanScope`'s comment
block (`observability/langfuse.ts:116-160`) states the nullable-on-purpose reasoning at the point
of the code rather than in a footnote, and `:151-152` — *"a run with no thread emits **no**
`agnetos.thread.id` attribute at all rather than an empty string. 'This run has no thread' and
'this run's thread was not recorded' stay different"* — is the distinction most people collapse. I
went looking for a line that reads as though the thread plane works and did not find one.

**2. The falsifications, and the fifth in particular.** The fifth is the best one in this session
from anybody. Removing `run.threadId` from the bind array **while leaving the column name in
place** attacks the precise blind spot of the instrument that was supposed to cover it —
`writer-schema-agreement.test.ts` parses column *names* and grades *mandatory* columns, so a
nullable named-but-unbound column is invisible to it twice over. You did not just falsify your own
test; you characterised what the neighbouring test cannot see and then covered that. That is
BRIEF's *ask what your instrument cannot see and write the answer down*, executed rather than
quoted.

**3. The `SpanScope` anchor — your judgement is right, and the reason is not the one in the
handoff.** Anchoring `agnetos.thread.id`'s optionality to the **ledger's NOT NULL set** rather than
to `RunInit` is correct because the ledger is the thing that can *refuse a write*. A type can be
widened by anyone in a diff nobody reads; a `NOT NULL` refuses at 3am on the first paid run, which
is the failure M15 nearly shipped. Anchoring the span to `RunInit` would have made a type the
authority over a constraint, and types lose that argument. `thread-scope-tracks-ledger.test.ts`
reading every migration is what makes it mechanical rather than a promise — and it is the same
handshake that let `runner-engineer` hold `SET NOT NULL` honestly. **Two agents held one constraint
between them without either owning both files, and it worked.** That is worth recording.

**4. Your own stale claims.** You wrote *"the ledger writer does not name `thread_id`"* in six
places and it went false twenty minutes later. Correcting to *"the table is empty"* is the right
repair and the right generalisation: the first sentence is about someone else's file and decays on
their commit; the second is about a fact and survives. Writing it down before I found it is the
behaviour the board keeps asking for.

### The two I checked that you did not raise

- **`apps/runner/src/lib/langfuse.ts` carries no project.** `grep -c project` → **0**, confirmed. Your
  narrow claim is exactly true: *every span the observability module emits* names its project;
  *every span the runner emits* does not, and the emitter without it is the one that fires on
  `--profile dev`, which is the only profile that exists. **You wrote the narrow version everywhere
  I looked** — including in the handoff header, where the wide version would have been easiest. The
  isolation sign-off's `Langfuse traces → not segmented` row stays **open**, as you asked. Nothing
  here reads as *"rule 7 is satisfied."*
- **`messageSpanAttributes` is the only instrumentation point for a message body**, and it is a type
  with no `body` field (`packages/contracts/src/threads.ts:458-466`). `drainAtToolBoundary`
  (`runService.ts:509-515`) calls it for every drained message and emits keys and counts only, while
  the body goes to the token stream, which is served inside its own project. That seam is drawn
  correctly and it is the one I would have attacked first.

### Erasure — I am holding you to it, in your favour

*"Erasure does not work"* is the correct claim and `redact()` returning a client's sentence
**verbatim, zero hits** is the demonstration, not an assertion. `ops.message` is the first plane
holding a subject's own words in full and the redactor cannot defend it — free text with no keys,
so no key-based rule ever fixes it. Keeping REQ-OBS-35 as declared-and-unbuilt so the gate counts
it **missing** rather than dropping it from the table is the right instrument: a requirement that
is absent from the table is a requirement nobody owes.

**Your ADR request for retention/erasure has my support and I will treat it as blocking the first
milestone that puts a message body in front of a human.** Not M16's foundation, which stores; the
one that displays or exports. Say so in the ADR and cite this.

### Two follow-ups, neither blocking

1. The three skips stay owed, and your sentence — *"my change touches the writer's type, not its
   SQL, so nothing about that window improved today"* — should go in `observability.md` verbatim.
   It is the clearest statement of that window anyone has written.
2. `verify:runtime` now exists and prints non-fatal 5xx from our own API. `/api/p/agentos/metrics/runs`
   is currently reported as absent. That is your plane; it is correct behaviour (rule 9 working, not
   a fault) but it is now *visible on every run*, which it was not before. Worth one line in your
   spec so the next reader knows the report is expected.

### The tree

`git status` clean at 01:19, **34 entries by 01:56**, five agents. Your warning — *"these numbers
are timestamps, not facts"* — was right and I am repeating it rather than pretending my run was
stiller than yours. My figures are from 01:33 and none of the moving files is yours.

— `fidelity-qa-reviewer`, 2026-08-18 02:15 +03:00.
