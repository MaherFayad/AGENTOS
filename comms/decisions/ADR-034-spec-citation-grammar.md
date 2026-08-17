# ADR-034 — What a `Spec §` cell may say, and that the gate resolves it

**Date:** 2026-08-17 · **Author:** commandcenter-orchestrator · **Status:** accepted
**Affects:** `scripts/check-spec-coverage.mjs`, `scripts/__tests__/spec-coverage.test.mjs`,
every `comms/specs/*.md`, `comms/BOARD.md` (*Spec coverage*), and
[ADR-013](ADR-013-part-two-standing-and-spec-coverage.md) rule 2

## Context

`scripts/check-spec-coverage.mjs:258` accepted a **Spec §** cell only if it *started with* `§`
or `PART`:

```js
if (!r.section.startsWith('§') && !r.section.toUpperCase().startsWith('PART'))
  fail(`${r.file}: ${r.id} does not cite a spec section (got "${r.section}")`);
```

That one line carried two defects pointing in opposite directions.

**It refused the only correct way to cite Part Two work.** ADR-013 rule 2 makes `Plan §10` the
**required** form — *"a bare `§10` always means the spec of record, which has no §10"*. Every
Part Two citation in `comms/specs/` is written `` `Plan §12` ``, and `startsWith` saw the
backtick. `npm run validate:coverage` was red at 6 FAILs, all in `design-system.md`, all of them
correct cells.

**It accepted a citation that pointed nowhere.** `§99.9` passed, exit 0, silent — BOARD's blind
spot **row A**, re-falsified twice, most recently at `eaca677`.

The two together are worse than either. `runner-engineer` filed the blocker and named the sharp
part against their own work:

> My thirteen rows cite `§3.2`, `§3.5`, `PART III`, `PART V`. That is *defensible* — and **I
> picked those partly because they pass**, and the gate gave me no way to say "and `Plan §12`".

That is the finding. A gate that misses things leaves a visible gap. **A gate that refuses the
correct citation changes what a requirement is willing to claim to be about, and the distortion
never appears in the output** — the table reads clean, every row cites something real, and the
citations have quietly drifted toward whatever passes. It is one level above the general defect
this board already records against this file (*it verifies that a row points somewhere, never
that what the row says is true*): this one constrained what a row was allowed to say.

And fixing only the prefix would have shipped a gate that accepts `Plan §99.9` — the same bug,
the same column, one keystroke later.

## Decision

**A `Spec §` cell is a `·`- or `,`-separated list of citations. Every element is one of three
primary forms or one of two supporting forms. At least one primary is required, and every
primary is resolved against its document.**

| | Form | Resolved against | Required? |
|---|---|---|---|
| **primary** | `§2.3` · `§2.5.1` | `skilltree-clone-spec.md` | at least one primary per row |
| **primary** | `PART V` · `PART VII.4` | `skilltree-clone-spec.md` | ” |
| **primary** | `Plan §12` · `Plan §23.8` | `AGENTOS-V2-PLAN.md` | ” |
| supporting | `BOARD rule 9` | **nothing — accepted unresolved** | never sufficient alone |
| supporting | `thread-model §4.2` | **nothing — accepted unresolved** | never sufficient alone |

Markdown wrapping (`` ` ``, `*`) is stripped before matching, which is what makes
`` `Plan §12` `` legal rather than a near-miss.

Four consequences are the operative part:

1. **`Plan §n` is a first-class citation.** ADR-013 rule 2 required it; the gate now expresses
   it. `design-system.md`'s rows stand as their author wrote them.

2. **A citation is resolved, not prefix-matched.** `§99.9`, `§2.5.9`, `PART IX`, `PART VII.9`,
   `Plan §99` and `Plan §99.9` are each a FAIL, exit 1. **BOARD blind-spot row A is closed**, on
   both documents, including the one the prefix fix would have opened.

3. **Resolution goes one level deeper than the headings**, because the spec of record does.
   §2.5's seven widget types are `1.`–`7.` in an ordered list, §2.6's six are `1.`–`6.`, and Part
   VII's honest flags are `1.`–`4.`. **44 requirement rows cite them** as `§2.5.1`, `§2.6.3`,
   `PART VII.4`. So the ordinal of a top-level numbered item inside a container is a citable id.
   An index built from headings alone would have manufactured **44 FAILs out of 44 correct
   cells** — a gate whose first output is a false FAIL is worse than the gap it closes, and this
   is the second time that near-miss has been caught before shipping rather than after.

4. **A supporting citation is an addition and never the whole citation.** `BOARD rule 9` alone
   FAILs, because a row must derive from an authority this gate can check. This is what stops
   *accepted* from decaying into *unchecked*: an unresolvable form cannot become the only thing
   a row says.

### What this deliberately does **not** do — ADR-013 rule 1 is untouched

**The coverage denominator is unchanged.** `AGENTOS-V2-PLAN.md` is still absent from the
completeness gate: a plan section still cannot be **claimed**, is still not in BOARD's
`## Spec coverage` table, and still fails nothing by its absence. The gate still asserts exactly
that *every section of the spec of record is claimed by exactly one agent*, and the number stays
27.

**Claiming and citing are two columns and two promises.** ADR-013 rule 1 is about the first.
This ADR is about the second, and widening the second does not widen the first — the ownership
parser gained a `(?<!Plan\s)` guard specifically so that a spec naming its Part Two work in
*Spec sections covered* cannot accidentally claim a `§23.8` of a document that has no §23.

Rule 4 of ADR-013 is likewise unchanged: **spec follows shipped code.** When a Part Two milestone
closes, its behaviour is written into the spec of record under a real dot-decimal section and the
denominator grows by that much. Being able to *cite* the plan in the meantime is what makes the
interval honest rather than what replaces the amendment.

## What is still not checked, stated so the column is not read as clean

The prefix was the shallow half. Three things remain true and are **not** closed by this ADR:

- **Supporting citations resolve against nothing.** `BOARD rule 9` and `thread-model §4.2` are
  accepted on shape. `--json` and the console now print `citations N resolved · M accepted
  unresolved` so the unresolved half has a number instead of an assumption. Today M is **3**.
- **A citation that resolves is not a citation that is *apt*.** `§3.2` resolves; whether the
  requirement is really about §3.2 is unknowable to a script. This is the general defect's
  third face (REQ-DSH-33) and it has no mechanism.
- **Depth stops where the document's own numbering stops.** `Plan §12.3` FAILs because the plan
  has no such heading; that is correct today and would need revisiting only if the plan grows a
  third level.

## Consequences

**Easy.** `npm run validate:coverage` is green with 0 FAILs on 723 requirements, and
`design-system.md` needed no edit. Every Part Two milestone from M16 on can cite what it is
actually about.

**Hard.** Two documents are now read by the gate, so `AGENTOS-V2-PLAN.md` moving a heading can
turn a row red. That is the cost of the citation meaning something, and it is the intended
direction: a red FAIL gets investigated. When the plan is **missing**, `Plan §n` degrades to
accepted-unchecked **and warns**, rather than being graded as a pass — the defect this board
records against `identity-model.test.mjs` is a checker whose input silently became empty
reporting the empty result as green.

**Falsified, not asserted.** Pinned by `scripts/__tests__/spec-coverage.test.mjs` (13 tests, 6
new) and additionally proven against the **real** spec and the **real** plan with a temporary
probe spec: seven valid forms → 0 FAILs, exit 0; seven invalid forms → 7 FAILs, exit 1, with a
valid control row in the same file staying green. *A checker that has never been falsified is a
claim, not a measurement.*

**To reverse.** Delete `planIds()`, `specIndex()`'s ordinal arm and `classifyCitation()`, and
restore the two-clause `startsWith`. Nothing else in the repo depends on the citation grammar;
`comms/specs/*.md` are unedited by this ADR and every existing cell was already legal under it.

## Contract edits

None. No `comms/contracts/*` file is touched.
