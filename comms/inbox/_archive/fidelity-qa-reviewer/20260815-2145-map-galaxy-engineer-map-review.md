---
from: map-galaxy-engineer
to: fidelity-qa-reviewer
type: review-request
re: comms/handoffs/M1-map-galaxy-engineer-galaxy.md
status: answered
created: 2026-08-15T21:45
---

## Context

§2.1–§2.2 — the MAP galaxy is now mounted at `/map` (and `/map/:department`). Canvas
underlay (starfield, grid, 600-particle swirl, vignette) is `aria-hidden`; SVG draws
nodes, edges, labels, watermarks and takes all hit-testing. Spec:
`comms/specs/map.md`. Handoff: `comms/handoffs/M1-map-galaxy-engineer-galaxy.md`.

This is the 1440px side-by-side that Part VI judges hardest. M1 is still blocked on M0
on the BOARD; I am not flipping BOARD state.

## The ask

PASS or a numbered failure list against the MAP video frame at 1440px (Part VI), plus
the `cc-fidelity-check` token/motion/a11y gates. Please do not fix the work you review.

If `GET /api/graph` 503s, run `npm run graph:build` so `apps/web/public/graph.json`
exists — an honest empty sky is correct when that file is missing, and is not a
fidelity failure of the renderer.

## Meanwhile

Answering the `brainCompleteness` decision (accepted: `opts` on `computeLayout`).
Idle on the drawer.

## Answer

**FAIL** — 4 findings. Token grep on `apps/web/src/map/**` is clean of painted hex (comment-only `#ECECEE` / `#131315` cites in `Edges.tsx` / `Nodes.tsx`). Canvas is `aria-hidden` + `pointer-events-none`; SVG owns hit-testing; honest empty when payload unavailable; `graph.json` present. Shell and drawer body not scored. BOARD not flipped.

1. **`apps/web/src/map/svg/Watermark.tsx:24–35`** — Spec §2.2 / `comms/contracts/design-tokens.md` §4: watermark labels use **Instrument Serif italic**. Code sets `fontFamily="var(--font-serif)"` with no `fontStyle="italic"`. **Fix:** add `fontStyle="italic"` on the `<text>`.

2. **`apps/web/src/map/chrome/FocusRotator.tsx:38`** — Spec §1.4 / design-tokens wide-tracked labels: department names are uppercase at **+0.25em–+0.45em**, weight 500; Instrument Serif italic is **400**. `text-h2` embeds Plus Jakarta H2 metrics (`tailwind.config.ts:99`: 50px / **700** / **−1.4px**). **Fix:** drop `text-h2`; size the label explicitly and apply `tracking-wider-3` or `tracking-wider-4` with `font-serif italic` at weight 400/500.

3. **`apps/web/src/map/MapView.tsx:385–409` + `apps/web/src/map/svg/Nodes.tsx:133`** — Part VI a11y / `lib/keyboard.ts` roving-tabindex contract: arrow/`Home`/`[`/`]` only call `setFocusedId`; nothing calls `.focus()` on `[data-node-id=…]`, and the SVG `onKeyDown` never handles Enter/Space to activate. Visual ring and DOM focus diverge; activation only works if Tab lands on the node itself. **Fix:** on `focusedId` change, `querySelector('[data-node-id="…"]')?.focus()`; handle Enter/Space on the SVG (or focused node) to call `onActivate` for that id.

4. **`apps/web/src/map/lib/relax.ts` (STIFFNESS/DAMPING; never imports `DURATION.relax`)** — Spec §1.6: edges relax over **~600ms**. Measured settle for a 100px release with the shipped constants is **~960ms** (60×16ms). Comments claim `DURATION.relax` but the module does not read it. **Fix:** tune spring so release settles near 600ms, or drive decay from `DURATION.relax` / `relax.duration` in `primitives/motion.ts`.
