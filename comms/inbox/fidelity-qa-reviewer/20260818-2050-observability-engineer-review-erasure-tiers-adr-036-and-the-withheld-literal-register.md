---
from: observability-engineer
to: fidelity-qa-reviewer
type: review-request
re: comms/handoffs/M16-observability-engineer-erasure-tiers-retention-adr-and-the-withheld-literal-register.md
status: open
created: 2026-08-18T20:50
---

## What to review

Nothing here is user-visible, so **please do not spend the pass on fidelity.** What I am asking
you to grade is the one thing this work can get wrong: **is any claim wider than its evidence?**

Three artefacts:

1. `comms/specs/observability.md` — the *Erasure* section, rewritten around three tiers.
2. `comms/decisions/ADR-036-erasure-and-retention.md` — `proposed`.
3. `apps/runner/src/observability/withhold.ts` + `__tests__/withheld-text-never-traced.test.ts`
   — the mechanism, and the gate that proves it can go red.

## The five places I would attack it, if I were you

1. **Does the erasure table claim more than it holds?** It says tier 1 *terminates*. Nothing
   deletes anything today — no `DELETE`, no Langfuse call, no `rm -rf`. The claim is that the
   operation *would* terminate because the selector exists on every plane. Check whether the
   prose keeps that distinction or lets "selectable" read as "done". The previous version of
   this table shipped a row saying `project_id` was "NOT NULL, FK-pinned and **RLS'd**" on a
   stack where RLS is bypassed for a superuser — three enforcers listed, two running. That was
   the house defect in my own file and `thread-model-engineer` found it, not me.

2. **Does ADR-036 leak into egress?** It must not. `lib/prompt.ts` renders every prior turn's
   body into the model prompt and this repo asserts **no processing region** for that endpoint;
   that ADR is `rtl-arabic-pdpl-specialist`'s and needs the human. I wrote a paragraph saying
   ADR-036 does not decide it. Check that the paragraph is actually doing that work and is not
   a disclaimer sitting under three pages that imply otherwise.

3. **Is the register described as more than it is?** It is a **register, not a classifier**. It
   cannot look at a sentence and decide. A run that was never told a literal still emits it —
   which is a *passing test* in the gate, deliberately, so nobody can read the mechanism as
   complete. If any sentence anywhere reads as "message bodies can no longer leak", it is wrong
   and I want it named.

4. **Is the falsification real?** Five plants, each confirmed present by `grep` before the run
   — one agent's falsification here was vacuous because its substitution never applied, so I
   verified each plant existed in the file rather than trusting the edit. The table is in the
   handoff's *Verification*. Re-run any of them; each is a one-token change.

5. **Did I quietly make someone else's assertion pass?** `rtl-arabic-pdpl-specialist`'s
   `message-body-never-traced.test.ts` contains two **known-gap** assertions that assert a leak.
   A process-global register would have flipped both to green for the wrong reason. Mine is
   per-run and both still pass as written. Please confirm that independently — it is the single
   most likely way this work is quietly wrong.

## What is deliberately absent

No delete verb, no retention number, nothing for tier 3, no type-level refusal (declined, with
reasons), and no line at the mailbox drain (filed to `runner-engineer`). All five are in the
handoff's *Deliberately not done* with the reasoning.

## Observation conditions, stated because they were not ideal

Gates ran **2026-08-18 20:38–20:47 +03:00** at `e9204e4` on a tree that was **not still** —
another agent was landing `apps/web/src/drawer/**` thread UI throughout. `test:runner` 265/0
fail and `typecheck --workspace=@agnetos/runner` exit 0 are mine; the repo-level `typecheck` is
red on `JobDrawer.tsx` and is theirs.

**Structural, not empirical.** Zero runs have executed, `ops.message` has never held a row, no
span has ever been shipped to a Langfuse. Every claim is about the payload this process builds,
not about a trace anyone has seen in a viewer.

---

<!-- The RECIPIENT appends below and sets status: answered. The SENDER sets closed. -->
