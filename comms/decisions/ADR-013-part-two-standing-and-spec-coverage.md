# ADR-013 — Part Two is a plan that amends the spec, not a second spec of record

**Date:** 2026-08-16 · **Author:** commandcenter-orchestrator · **Status:** accepted
**Affects:** `comms/BOARD.md` (spec-coverage gate, milestone ladder), `scripts/check-spec-coverage.mjs`, every `comms/specs/*.md`, all future ADR numbering

## Context

`AGENTOS-V2-PLAN.md` Part Two (§9–§24) describes projects, threads, scheduling, clients and
a Chief of Staff. None of it exists in `skilltree-clone-spec.md`, which is the spec of
record and which has no §9–§24 at all — its numbering stops at Part VII.

`BOARD.md` carries a completeness gate: *every section of the spec of record must be claimed
by exactly one agent*, enforced by `npm run validate:coverage`. Opening M15 forces the
question the gate cannot answer for itself: **is Part Two spec?**

Three outcomes were possible and only one of them is honest.

**The mechanical fact that decides it.** `scripts/check-spec-coverage.mjs` extracts sections
from exactly one file:

```js
const SPEC = join(ROOT, 'skilltree-clone-spec.md');
// …
const sub = line.match(/^##\s+(\d+\.\d+)\s+(.+)$/);
```

and reads ownership out of BOARD with `/§(\d+\.\d+)|\bPART\s+([IVX]+)\b/g`.

Both patterns require a **dot-decimal** section id. Part Two's headings are `## 9.`,
`## 10.`, `## 23.` — `\d+\.\d+` does not match `9.` followed by a space. So:

1. The checker cannot see Part Two's sections, because they are in another file.
2. Even if they were in the spec file, `§9` and `§10` would not parse as section ids.
3. Adding `| §9 · §10 | platform-projects-engineer |` to BOARD's coverage table would parse
   to **zero entries** and fail nothing, ever.

That third point is the whole decision. A coverage table with Part Two rows in it would
*look* enforced and be decorative. This is the same disease as `BOARD.md:7` asserting a
fidelity bar that had never been run — a gate that has quietly stopped meaning what it says
is worse than no gate, because people cite it.

## Options

| Option | For | Against |
|---|---|---|
| **A — Part Two becomes spec of record.** Renumber it into the spec, extend the coverage table, extend the checker. | One document, one gate, one meaning. | Rewrites a 1385-line proposal that is still a proposal; §3 and §18's ADRs are not accepted; forces ~15 new spec files before a line of M15 code; and it would relitigate Part One's Parts I–VII numbering. Expensive, and premature for a plan whose first milestone has not started. |
| **B — Part Two is a plan that amends the spec.** The gate stays pointed at the spec of record and keeps its exact current meaning. Part Two gets its own, separately-named, honestly-unenforced traceability. | Costs nothing today. The gate keeps meaning precisely what it claims. The relationship is stated once, in writing, where both documents can point at it. | Two documents to read. Part Two's coverage is checked by humans until someone funds a checker. |
| **C — add Part Two rows to the coverage table anyway.** | Looks complete. | The rows parse to nothing. The gate becomes a decoration that four validators still pass. Rejected on sight. |

## Decision

**We take B. `skilltree-clone-spec.md` remains the sole spec of record.
`AGENTOS-V2-PLAN.md` Part Two is a plan that amends it.** Four rules follow, and they are
the operative part of this ADR:

1. **The coverage gate is unchanged and unextended.** `npm run validate:coverage` continues
   to assert that every section of the spec of record is claimed by exactly one agent. No
   Part Two section is added to BOARD's `## Spec coverage` table. The gate's promise stays
   true and narrow.

2. **Part Two sections are cited as `Plan §10`, never `§10`.** One character of prefix
   removes an entire class of ambiguity in messages, handoffs and ADRs. `§` alone always
   means the spec of record. Agents whose ownership is Part-Two-only say so in their
   definition, and this is why the five new agent definitions all carry the sentence.

3. **Part Two coverage is tracked in BOARD's `## Part Two — plan coverage` table, which is
   explicitly marked as not machine-checked.** Saying "not enforced" in the table itself is
   the entire point; an unmarked table is indistinguishable from an enforced one.

4. **The moment a Part Two milestone closes, the spec of record is amended for real** — the
   built behaviour is written into `skilltree-clone-spec.md` under a genuine dot-decimal
   section, claimed in `comms/specs/`, and added to the coverage table, where the checker
   will then see it. **Spec follows shipped code, not the other way round.** That is the
   condition under which the gate grows, and it grows by one milestone at a time rather
   than by fifteen sections of proposal.

### The ADR numbering collision, ruled at the same time

Part One §3 labels its decisions **ADR-009** (two planes), **ADR-010** (MCP runtime),
**ADR-011** (memory tiering) and **ADR-013** (auth in v2). Those four numbers are **already
taken** by entirely unrelated decisions in this repo:

| Number | Actually is | Status |
|---|---|---|
| ADR-009 | Artifact write capability | accepted |
| ADR-010 | SESSIONS runtime deps (`tweetnacl`, `web-push`) | accepted |
| ADR-011 | Light-theme `--ink-2` AA floor | proposed, with the user |

Part Two §18 then proposes ADR-016–ADR-025, skipping 012–015 entirely.

**Ruling: the ADR numbers written in `AGENTOS-V2-PLAN.md` are advisory labels inside a
proposal, not allocations.** A real ADR takes the next free number at the time it is
written. Nobody files an "ADR-016" by copying the plan; `check-comms.mjs` only catches a
collision once two files have landed, and by then two documents already cite the number.

**And "next free number at the time it is written" is not sufficient either — this ADR
proved it within twenty minutes of being written.** `agent-library-curator` and I both
computed "next free = 012" from the same directory listing at the same moment and both
filed an ADR-012. Then we both noticed and both renamed, in opposite directions. Two
concurrent agents cannot allocate from a shared sequence by observation.

**So the rule has a second half: allocation is claimed in `BOARD.md` before the file is
written, and the claim is the orchestrator's.** Write the row first, then the file.

| Number | Decision | Author | Status |
|---|---|---|---|
| ADR-012 | — | — | **vacant, deliberately.** Burned by the two-sided rename above. Re-racing it to close a cosmetic gap costs more than the gap. Left empty as the visible record of why the claim-first rule exists. |
| ADR-013 | This ADR — Part Two's standing and the coverage gate | `commandcenter-orchestrator` | accepted |
| ADR-014 | The agent cascade — resolution, identity, capability narrowing, promote/fork/provenance | `agent-library-curator` | proposed |
| ADR-015 | Project scoping — the third plane, `ops.project`, project-scoped routes, what deleting a project means | `runner-engineer` | **claimed, not yet written** |
| ADR-016 | Identity vs device vs billing account — three tables, orthogonal | *unowned — see M15* | **claimed, not yet written** |

Everything from ADR-017 onward is claimed just-in-time, in BOARD, at its own milestone.

### Amendment, 2026-08-17 — the collision is wider than this ADR found, and the fix is a concordance, not a renumber

**What this ADR missed.** The table above lists three collisions. There are **six**, and the
plan allocates in *two* separate places, not one:

| Plan cite | Plan means | This repo's file |
|---|---|---|
| §3 line 84 — ADR-009 | Two planes: Library (git) + Operations (Postgres) | ADR-009 artifact write capability |
| §3 line 125 — ADR-010 | MCP runtime and credential custody | ADR-010 SESSIONS runtime deps |
| §3 line 141 — ADR-011 | Memory tiering and write authority | ADR-011 light `--ink-2` AA floor |
| §3 line 142 — ADR-012 | Task-board semantics | **vacant, for an unrelated reason** |
| §3 line 110 — ADR-013 | Auth exists in v2 | ADR-013 *(this file)* |
| §3 line 143 — ADR-014 | Foundry token-budget policy | ADR-014 agent cascade resolution |

And §18's table (lines 965–975) allocates ADR-016–ADR-025 on a *different* offset, where
**plan ADR-016 is project scoping + the cascade** — which is precisely what this repo filed as
ADR-014 and claimed as ADR-015.

**The harm this ADR did not name.** The plan does not merely list these numbers; it *cites
them in prose* — §4's phase descriptions, §11's *"transport stays as ADR-013 proposed"*,
line 387's *"ADR-013, ADR-015"*, line 844's *"ADR-011 is amended, not replaced"*, line 995,
line 1253. **A reader following a citation lands on a different decision than the author
meant.** That is one identifier with two readings, which is the same defect class as every
other bug found on 2026-08-16.

**Ruling: the filed ADRs keep their numbers. The plan's numbers are re-allocated.**

The original ruling — *plan numbers are advisory labels inside a proposal, not allocations* —
**stands and is not weakened.** What is added is the deciding principle for the tie, which
this ADR should have stated and did not:

> **You cannot renumber a decision that has already been acted on. Allocate against the side
> with no dependents.**

ADR-009 changed twelve agents' frontmatter and is enforced by `validate-frontmatter.mjs`.
ADR-013 set the coverage gate this whole document is about. ADR-010 is the standing
justification for two entries in `apps/web/package.json`. All six are cited in BOARD's
Evidence column, in four contracts, and in **answered and closed messages, which ADR-000 makes
append-only** — renumbering would mean rewriting reasoning history. Against that, the plan's
numbers have been acted on by **nobody**: zero files, zero code, zero tests. Renumbering the
side with no dependents costs a table; renumbering the side with dependents costs a silent
wrong pointer for every citation anyone misses.

**`AGENTOS-V2-PLAN.md` is not edited to match.** It is the user's file, committed at `56e93cf`,
and rewriting twenty-odd citations inside someone else's plan of record is exactly the quiet
cross-boundary edit this repo forbids. **Recommended to the user, not performed** — and
recorded on BOARD as such.

**The concordance is the instrument.** `comms/decisions/README.md` now carries a two-way
mapping and is visible to anyone running `ls comms/decisions/`, which is where the failing
method ("next free from the directory listing") is actually practised. BOARD remains the sole
**allocation** authority; the README is **translation** only. Two jobs, two files, no second
source of truth.

**Answering the two inputs raised with this ruling:**

1. **Do the plan's allocations count as claims under the BOARD-first rule?** *Retroactively,
   no — prospectively, yes.* They predate the rule and they live in a file nobody treated as
   an allocation table, which is precisely how the collision happened. But they are now
   **imported into the BOARD register as reserved rows with real numbers**, so the same
   sequence can never be allocated from two documents again.
2. **Should `decisions/` carry a reserved-numbers block?** *Yes* — `decisions/README.md`, for
   the reason above: the block has to be where the wrong method is performed, not only where
   the right one is written down.

This closes the exposure the ADR-012 analysis identified from the other side. That analysis —
`decisions/` is the only shared-integer namespace in the repo, because every other `comms/`
filename embeds its author's slug — was correct, and this is the same namespace with a second
claimant that happens to be a document rather than an agent.

### The other thing that text is doing: "auth exists in v2" ≠ "the tailnet boundary moves"

Plan line 110's heading is literally **"ADR-013 — Auth exists in v2 (amends BOARD constraints
#5 and #6)"**, and Plan §11 line 649 says **"Transport stays as ADR-013 proposed: tailnet-only
for v2."** Two readers read those two ways in one evening, which means the text is doing too
much work. The distinction, stated once so it stops being re-derived:

| | v2 | Amended? |
|---|---|---|
| **Identity/auth** — accounts, devices, scopes, per-account billing | **exists**, *inside* the tailnet | BOARD #5's *"no auth in v1 by design"* — yes, by Part Two |
| **Transport** — public ports, exposure | **unchanged.** Tailnet-only | BOARD #5's *"no public ports"* — **no.** Authelia in front of Caddy is a *later* ADR (Part One §8 stands; Plan line 995 confirms *"not further amended here"*) |

So: **v2 gains accounts; v2 does not gain a public surface.** Both halves must be quoted
together or one of them is misleading on its own. Anything relying on the second half staying
true — including the deferred scopes-enforcement ruling — remains safe.

### The contract boundary between `agent-cascade.md` and `project-scoping.md`

`agent-cascade.md` §0 asks me to accept or re-route its proposed boundary and says
explicitly that my routing wins. **I accept it as written, unchanged.** The split is:

| Question | Contract | Owner |
|---|---|---|
| Which layers exist, where they mount, how a library is fetched and synced, what deleting a project means, project switching | `project-scoping.md` | `runner-engineer`, in trust |
| How a slug resolves across layers, what a resolved agent *is*, which fields may differ per layer, what the validator enforces on the resolved agent, promote/fork/provenance | `agent-cascade.md` | `agent-library-curator` |

It is better than the arrangement I had drafted, which folded resolution into
`frontmatter-schema.md`. That schema describes **one file**; the cascade describes **which
of three files wins**, and those are different subjects with different failure modes. Two
contracts, one owner each, no shared prose to drift — which is the rule, not a compromise
with it.

Consequently `project-scoping.md` §5.2 no longer poses cascade questions of its own. It
points. A question asked in two contracts is one contract with two readings, which is the
exact failure this repo has an orchestrator to prevent.

## Consequences

**Easy.** M15 starts today without renumbering a spec. The four green validators stay
green and stay meaningful. Anyone reading `BOARD.md` can tell enforced from unenforced by
looking, not by reading a script.

**Hard.** Part Two's coverage is a human responsibility until a milestone closes and
amends the spec. That is a real cost and it is accepted deliberately: the alternative was
a table that fails nothing.

**To reverse.** Reversing to option A means extending `check-spec-coverage.mjs` to read a
second file and to accept single-integer section ids in both its extractor and its BOARD
parser, then filing ~15 `comms/specs/*.md` files. That is roughly a day, it is entirely
additive, and nothing decided here makes it harder later. Preferring the reversible
decision now is the point.

## Contract edits

None. `comms/contracts/*` are untouched by this ADR. `comms/BOARD.md` gains a
`## Part Two — plan coverage` section and a `## Part Two ladder` section; the
`## Spec coverage — the completeness gate` section is edited only to state, in one
sentence, what it does **not** cover.
