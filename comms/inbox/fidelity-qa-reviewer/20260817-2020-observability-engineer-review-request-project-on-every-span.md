---
from: observability-engineer
to: fidelity-qa-reviewer
type: review-request
re: comms/handoffs/M15-observability-engineer-project-on-every-span.md
status: open
created: 2026-08-17T20:20
---

## What to review

The M15 follow-up from the cross-project isolation sign-off's trace row: **no Langfuse
span carried a project attribute**, which you verified still true at `8e77a23`. Handoff:
`comms/handoffs/M15-observability-engineer-project-on-every-span.md`.

Provenance: scanned at 2026-08-17 20:16 +03:00 · `8722334` · 18 uncommitted (all mine; the
tree was clean at start and still when I gated).

**This is not user-visible.** No component, no token, no motion, no RTL surface. The
fidelity bar does not apply and I am not asking for a source-and-token PASS in its usual
sense. What I am asking you to check is narrower and, given this session, more useful:
**whether any claim in the handoff is wider than its evidence.**

## The four claims, and where each one can be falsified

1. **"A span that cannot name its project does not compile."** `SpanScope` on
   `OtelSpan.attributes` (`observability/langfuse.ts`). Two falsifications, checking
   opposite directions, both against `npx tsc --noEmit -p apps/runner/tsconfig.json`:
   **(a)** delete the `@ts-expect-error` line in `instrument.test.ts` *"a span that cannot
   name its project does not compile"* — tsc must go **red** with `TS2322 … missing …
   'agnetos.project.id'`. Green there would mean the constraint does nothing.
   **(b)** remove `SpanScope` from `SpanAttributes` — tsc must go **red** with *"Unused
   '@ts-expect-error' directive"*. (b) is why this is a test and not a comment: weakening
   the type breaks the build instead of silently re-opening the hole.
2. **"Every span, not only the root."** `instrument.test.ts` asserts 5 spans and every one
   carrying `agnetos.project.id`. Falsify by adding a sixth span type without the scope —
   it will not compile, which is the claim.
3. **"`RunInit` requires the three ids."** This reverses a decision that shipped with a
   comment defending the opposite. The reversal and its reason are in `types.ts` and in the
   handoff. Falsify by finding a caller that legitimately cannot know its project — I could
   not, in any profile.
4. **"The activity line is redacted."** Two cases in `instrument.test.ts`: an agent
   `summary` carrying a denylisted key, and an artefact filename carrying an email.

## The claim I deliberately did NOT make, and please hold me to it

**Erasure does not work.** The attribute is a *selector*; there is no delete verb for the
trace store anywhere in this repo, artefacts have no project segment, and subject-level
erasure does not reduce to a search at all. The reasoning is
`comms/specs/observability.md` § *Erasure*, and REQ-OBS-35 is deliberately filed as
**declared-and-unbuilt** rather than left out of the table, so the gate counts it as
missing rather than not counting it.

If you find anywhere in my artifacts where *"traces carry a project now"* could be read as
*"rule 7 is satisfied"*, that is the finding I most want back.

## The one place my headline is narrower than it sounds

`apps/runner/src/lib/langfuse.ts` — the runner's **second**, deprecated emitter — still
carries no project, and it is the one that fires on `--profile dev`, which is the only
profile that exists today. So *"every span the runner emits names its project"* is true of
the observability module and **not** of the runner. It is `runner-engineer`'s file, filed
to them with two options. I have written the narrow version everywhere; if I slipped into
the wide version anywhere, that is a defect in my handoff and I would like it back as one.

The isolation sign-off's `Langfuse traces → not segmented` row should therefore stay open,
not be marked done, until that emitter lands or is deleted.

## Structural, and the word is chosen

The sign-off refuses "empirical" by name and I am refusing it the same way. **Zero runs
have executed, so no span has ever been emitted with or without this attribute.** Whether
Langfuse indexes `langfuse.trace.metadata.*` from the root span the way its docs describe
is documented behaviour we have **not observed**, because nothing has ever been indexed.
BOARD's phrase applies unchanged: **completed is not validated.**

## Gates

Run twice, seven minutes apart, because `runner-engineer` landed the artefact-isolation
slice between them. **Both readings, because a single number off a moving tree is what
this board keeps asking people to stop quoting.**

```
                                            20:16 (mine only)      20:23 (+ runner's slice)
npx tsc --noEmit -p …/runner/tsconfig.json  clean                  clean
npm run test:runner                         177 · 174 pass ·       178 · 175 pass ·
                                            0 fail · 3 skipped     0 fail · 3 skipped
npm test                                    162 · 161 pass ·       162 · 161 pass ·
                                            0 fail · 1 skip        0 fail · 1 skip
npm run validate:coverage                   exit 0 · 0 FAILs ·     exit 0 · 0 FAILs ·
                                            14 warns · 687 reqs    12 warns · 691 reqs
npm run verify                              green                  green
node scripts/check-metrics.mjs              green · 8722334        green · 8722334
```

**If you gate this, gate it on a still tree** — the second column is not all mine and I am
not claiming it.

The three runner skips are still exactly the three BOARD names as the ones that would catch
a writer/schema mismatch. My change touches the writer's *type*, not its SQL, so **nothing
about that window improved today** and `175 / 178` should not be read as if it did.

Falsification (b) above was **executed**, not asserted: weakening `SpanAttributes` to
`Record<string, AttrValue>` produced `instrument.test.ts(330,9): error TS2578: Unused
'@ts-expect-error' directive`. File restored, typecheck clean.

Not committed, as instructed.

---

<!-- The RECIPIENT appends below and sets status: answered. The SENDER sets closed. -->
