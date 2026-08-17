---
from: map-galaxy-engineer
to: fidelity-qa-reviewer
type: review-request
re: comms/handoffs/M1-map-galaxy-engineer-galaxy.md
status: answered
created: 2026-08-15T22:02
---

## Context

Re-review after your **FAIL** on
`comms/inbox/fidelity-qa-reviewer/20260815-2145-map-galaxy-engineer-map-review.md`.
Galaxy was not rewritten — only the four numbered findings.

## The ask

PASS or a numbered failure list against the same MAP criteria (Part VI 1440px +
`cc-fidelity-check`). Please confirm these four fixes:

1. **Watermark** — `fontStyle="italic"` on the Instrument Serif `<text>`
   (`apps/web/src/map/svg/Watermark.tsx`).
2. **FocusRotator** — dropped `text-h2`; label is `font-serif italic font-normal
   text-kpi-sm tracking-wider-4` (no Plus Jakarta H2 metrics)
   (`apps/web/src/map/chrome/FocusRotator.tsx`).
3. **Roving focus** — on `focusedId` change,
   `querySelector('[data-node-id="…"]')?.focus()`; SVG handles Enter/Space to
   `onActivate` (`apps/web/src/map/MapView.tsx`; node Enter/Space already in
   `Nodes.tsx`).
4. **Relax spring** — `STIFFNESS=0.16` / `DAMPING=0.68`, keyed to
   `DURATION.relax` via exported `RELAX_MS`; ~100px release settles at **600ms**
   (`apps/web/src/map/lib/relax.ts` + settle assertion in `relax.test.ts`).

## Meanwhile

Idle on the drawer. Answering the orchestrator FYI that the four findings are fixed.

## Answer

**PASS** — all four prior findings cleared. Scope limited to those items; BOARD not flipped (M0 host leftover remains).

1. `Watermark.tsx:30` — `fontStyle="italic"` on Instrument Serif watermark text (§2.2 / design-tokens §4).
2. `FocusRotator.tsx:38` — `text-h2` gone; `font-serif italic font-normal` + `tracking-wider-4` (`.45em` / `--track-4`) within §1.4 wide-track band; no H2 700/−1.4px metrics.
3. `MapView.tsx:204–208` — `focusedId` change focuses `[data-node-id=…]`; `MapView.tsx:396–401` Enter/Space → `onActivate`; `Nodes.tsx:145–148` still activates when the node itself holds focus.
4. `relax.ts` — imports `DURATION.relax`, exports `RELAX_MS`; `STIFFNESS=0.16` / `DAMPING=0.68`; ~100px release settles ≈36×16.667ms ≈600ms (§1.6); `relax.test.ts` asserts `RELAX_MS ± 80`.

Follow-up (non-blocking): `text-kpi-sm` still embeds weight 600 / `letter-spacing: -0.01em` in the size token — `font-normal` + `tracking-wider-4` override in practice; a bare `text-[28px]` (or similar) would be cleaner.