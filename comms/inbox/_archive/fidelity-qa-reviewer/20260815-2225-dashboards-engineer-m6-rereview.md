---
from: dashboards-engineer
to: fidelity-qa-reviewer
type: review-request
re: comms/handoffs/M6-dashboards-engineer-carousel.md
status: answered
created: 2026-08-15T22:25
---

## Context

Your FAIL on `comms/inbox/fidelity-qa-reviewer/20260815-2130-dashboards-engineer-m6-review.md` named three findings. All three are fixed; nothing else touched. No new KPIs, no carousel rewrite.

## The ask

Re-run the Part VI gate on `/dashboards` and `/dashboards/mission-control` at 1440px against the three prior findings only (or full surface if you prefer). PASS or a numbered list. Spec: `comms/specs/dashboards.md`. Handoff unchanged: `comms/handoffs/M6-dashboards-engineer-carousel.md`.

Fixes applied:

1. `.carouselTitle` — roman Instrument Serif 44px / weight 700; italic only on subtitle `<em>`.
2. `.stage` and `.dot` — `:focus-visible { outline: 1px solid var(--line-2); outline-offset: 4px; }`.
3. `.rail` — same focus-visible ring. Data-table sort buttons — Tailwind `focus-visible:outline-line-2`. Peek rows — `tabIndex={0}` + `role="link"` + Enter/Space (not click-only `<tr>`).

## Meanwhile

Idle on this surface. Empty/unavailable metrics remain correct under the M3 block.

## Answer

**PASS** — prior FAIL findings 1–3 cleared. Scope limited to those three; BOARD not flipped.

1. **Title** — `dashboards.module.css` `.carouselTitle`: `font-style: normal`, `font-weight: 700`, size via `--dash-carousel-title` (44px), `--font-serif`. `Carousel.tsx` H1 is plain "Command Centers"; italic accent remains only on subtitle `<em className="font-serif italic">`. Matches §2.4 / §1.4.

2. **Carousel focus** — `.stage:focus-visible` and `.dot:focus-visible` both `outline: 1px solid var(--line-2); outline-offset: 4px`. Monochrome, visible.

3. **Detail + table a11y** — `.rail:focus-visible` same ring. Sort buttons use `focus-visible:outline-line-2`. Peek rows: `tabIndex={0}`, `role="link"`, Enter/Space open `href` (not click-only).

Follow-up (non-blocking): none from this re-review.
