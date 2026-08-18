# status — rtl-arabic-pdpl-specialist

**Updated:** 2026-08-18T22:25
**Milestone:** M16 — §23.11 rule-6 pass over the threads surfaces · ADR-038 · M8 ongoing
**State:** review

## Now
**The rule-6 pass is done and it found one measured defect, not an opinion.** In `dir="rtl"`,
`threads.compose.placeholder` rendered as `… · @@sales@` — the leading `@` is a bidi neutral
at paragraph start, so it detached and landed at the far end of the Latin run. **`@sales` lost
its sigil and `@@sales` appeared to gain one**, in the one field where the sigil is the
difference between one run and N. Measured per character in headless Chrome, not derived from
UAX #9. Fixed with `⁨…⁩` and gated in `i18n.test.ts`.
**The interrupt radio group was the fourth site of the M15 arrow-key class** — a
`role="radiogroup"` of buttons with **no key handling at all**, while its own comment argued
from what arrow keys do to a `disabled` radio. `inlineStep` + roving tabindex; arrows now land
on the refused `steer` without selecting it, which is what `aria-disabled` was for.
**Four of `drawer-engineer`'s seventeen Arabic strings changed** — all word choices, none
guesses. Their call to write rather than file seventeen `todo()`s was right; the ceiling of 5
stays, and two agents hitting it and both routing copy to me *is* the ceiling working.
**PDPL:** ADR-036's table is honest in its hardest column and wider than its evidence in two
cells — **an author is not a data subject** (they are tier 3 for what others wrote about
them) and **a backup is a fourth store no `DELETE` reaches**. Both are now in `COMPANY.md`
rule 7, gated, falsified — one file, every run inherits it. `withhold.ts` is the right
mechanism and its `MAX_LITERALS` eviction is a **fail-open** its blind-spot list does not
name; asserted as a known gap in my file, filed to its owner.
**ADR-038 (egress) is filed `proposed`.** `deliver:` carries references never bodies;
`library_remote` stays `NULL`; **the model endpoint is the human's question** and deriving a
region from SDK docs is refused by name.

## Blocked on
nothing. ADR-038's open half needs the human: whether a DPA exists for the runner's key, and
what region it names. Neither is derivable and no agent may invent one.

## Last handoff
`comms/handoffs/M16-rtl-arabic-pdpl-specialist-the-rule-6-pass-and-the-egress-adr.md`

## Next
1. `components/shell` — 91 `check-rtl` findings, the largest module.
2. **M8 core:** light-theme parity · edge pulses · count-up numbers · mobile QA. Empty states
   are done for the threads surfaces only.
3. `panels/*.json` — 151 English strings, the largest untranslated surface, outside the walk.
4. `Carousel.tsx` still carries the M15 arrow-key defect (`dashboards-engineer`'s).

<!-- Overwrite this file each session. Under 30 lines. History lives in git and in
     handoffs/, not here. -->
