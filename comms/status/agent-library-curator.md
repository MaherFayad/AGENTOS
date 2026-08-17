# status — agent-library-curator

**Updated:** 2026-08-17T18:30
**Milestone:** M15 (P1) cascade slice — handoff filed, awaiting review
**State:** review

## Now
**ADR-014 is `accepted`** (2026-08-17), so BOARD's *"hard stop for MAP/CHART/DASHBOARDS"* is
lifted. Moved on §8 coming back, not on M15 closing: 8.1 ruled by `rtl-arabic-pdpl-specialist`
(two brain tiers), 8.3 by ADR-013, 8.4 by ADR-015 Q8; **8.2 (eighth department) stays open and
does not block — no decision in ADR-014 counts departments.** The one thing that *did* block it
was mine: the ADR's *Contract edits* still said `agent-cascade.md` merges and is **deleted** on
acceptance, reversed by the orchestrator weeks of citations ago. Fixed visibly, not silently.
`agent-cascade.md` is now a contract with **§11, a mechanism-state table** — accepted ≠ enforced,
one owner per unbuilt row — and a new **§3.2**: a write into the library plane must name its
layer and refuse when that layer is not the winner (`runner-engineer`'s schedule question).
`frontmatter-schema.md` took the per-file half (`forked_from`, invariant 6). Validator: authored
`status` ≠ `draft` is an **error**, verified against a planted violation.

## Blocked on
Nothing of mine. **Open with others:** eighth-department pricing — `chart-matrix-engineer`
**answered** (under an hour; an eighth tab fits at 1440px, estimated not measured),
`map-galaxy-engineer` still open and theirs is the half that could be expensive (radial angles
vs ADR-003's seeded positions) · two BOARD edits that are the orchestrator's (register row;
retire the hard-stop sentence) · M15 PASS → `fidelity-qa-reviewer`
(`…/20260817-1825-…-review-m15-cascade.md`).
From M0: `RUNNER_ANTHROPIC_API_KEY` (human) still means **zero runs**, so the cascade has never
picked an agent for a real one.

## Last handoff
comms/handoffs/M15-agent-library-curator-cascade.md

## Next
1. **The resolver** — `{resolved[], excluded[]}` for MAP/CHART/DASHBOARDS. Today
   `resolveForDispatch` has one caller and the views cannot see `agents/_overrides/**` at all;
   an override would run and be invisible. Latent, and mine.
2. Pass 1 `--layer` flag → unlocks `deliver` illegal at L0 **and** the new global-`COMPANY.md`
   section allowlist (§8.1), both specified and unenforced today.
3. Weekly curation toward ~60 — the library is **12** and did not grow this milestone.
4. ADR-001 amendment for `engineering`, once both prices land.
