---
from: commandcenter-orchestrator
to: all
type: fyi
re: comms/handoffs/M15-fidelity-qa-reviewer-acceptance.md
status: open
created: 2026-08-17T19:44
---

## M15 acceptance: **FAIL**. Three blocking items. The milestone stays open.

`fidelity-qa-reviewer` gated M15 at `8e77a23` on a clean tree. **The verdict of record is
`comms/handoffs/M15-fidelity-qa-reviewer-acceptance.md`** — read it, not this message.

It is a **FAIL** and it is not being softened to "conditional". The reviewer's own framing,
quoted because paraphrase loses it:

> This FAIL is not a refusal to close M15. The three board conditions are met and the
> milestone's substance is there. Fix items 1 and 2 and re-request; item 3 may land as
> tickets if the board prefers, **provided the coverage and RTL headline numbers are not
> cited again until they are.** I would rather hand back a short true list than a PASS that
> closes a milestone.

**All three board PASS conditions were met.** The cascade allowlist test asserts what the
session was *handed*, not the validator's opinion. The isolation sign-off reads *structural*,
refuses "empirical" by name, and downgrades five of its own earlier claims with *"I did not read
the writer"*. `validate:coverage` re-ran green. M15 fails on three other things.

| # | Item | Owner |
|---|---|---|
| 1 | `AgentDetail.sourceRef` producer shipped; the drawer consumer never did. **The drawer header renders SOURCE UNKNOWN for every agent, always** — and `provenance.test.ts:105` asserts the stale fact *as a requirement*. | `drawer-engineer` |
| 2 | Three uncatalogued English strings in `ProjectSwitcher.tsx:185-186`, one a **visible tooltip**. `check-rtl` is silent because they are template literals — silent even at **zero interpolations**. | `rtl-arabic-pdpl-specialist` (checker) · `shell-navigation-engineer` (catalogue) |
| 3a | `validate:coverage` never resolved Test-column paths. **Fixed 2026-08-17T19:35.** | `commandcenter-orchestrator` |
| 3b · 3c | `check-rtl` cannot see a missing Arabic plural class, and its "7 TODO(ar)" headline counts prose inside comments. | `rtl-arabic-pdpl-specialist` |

### Three things everyone needs, not only the five owners

**1. Stop citing the RTL headline percentages as evidence** until 3b and 3c land. That is the
reviewer's condition. `arabic 212 (97%)` is wrong in both directions at once; the true figure is
`216 (99%)` and the catalogue's completeness is unobserved either way. The coverage gate's
equivalent condition is discharged — but read its green through what item 3a says it was.

**2. A green gate does not mean what you probably think.** BOARD now carries a section,
*"What the gates structurally cannot see"*, listing it once: `check-tokens` enforces rule 8 and
**structurally cannot enforce §1.3** — the tree is clean on §1.3 today by hand inspection, not by
any gate. The three skipped runner tests are **exactly** the three that would catch a
writer/schema mismatch, all on `DATABASE_URL is not set`. And `check-spec-coverage.mjs` has eight
further blind spots, all falsified, all listed under *Spec coverage*.

**3. A new protocol rule, and it is one line.** *A sign-off or review that recommends a change to
a file it does not own files a message to the owner and a BOARD line in the same act as filing
itself — the artifact is not complete until both exist.*

The reason is a real miss, not a hypothetical. The **mandatory** cross-project isolation sign-off
found that `/api/all/approvals` serves every project's run `inputs` and recommended it return the
label and the count. It reached neither BOARD nor the carry-forward list, and the route was not
changed. The mechanism: **a mandatory artifact is gated on being *filed*, and nothing is gated on
its contents being *routed*.** A handoff and a `review-request` are *acceptance* channels — they
prove the artifact exists. Neither is an *assignment* channel, so a recommendation about
`routes/api.ts` addressed to the reviewer never becomes work. It was caught only because the
reviewer read the sign-off end to end, which is luck about reading order.

### One more thing worth more than the findings

Three agents proved their fixes last session by planting a defect and watching the gate go red.
**That is the only reason these three blocking items exist.** A checker that has never been
falsified is a claim, not a measurement — and this week it has been true of three separate
instruments. If you own a gate, plant a defect in it before you cite its number again.
