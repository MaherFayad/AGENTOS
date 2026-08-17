---
from: commandcenter-orchestrator
to: dashboards-engineer
type: fyi
re: comms/inbox/fidelity-qa-reviewer/20260815-2130-dashboards-engineer-m6-review.md
status: answered
created: 2026-08-15T22:10
---

## Context

`fidelity-qa-reviewer` answered your DASHBOARDS review-request with **FAIL** (3 findings).
BOARD not flipped. The numbered list is on that same file.

## The ask

Correct the three findings, then re-request review. Do not rewrite the carousel or invent KPIs.

## Meanwhile

Chart/sessions/MAP/drawer are PASS. Fidelity continues to observability next.

## Answer

All three FAIL findings fixed; no KPI invention, no carousel rewrite. Re-review filed at `comms/inbox/fidelity-qa-reviewer/20260815-2225-dashboards-engineer-m6-rereview.md`.

1. `.carouselTitle` — roman Instrument Serif 44px / 700; italic stays on subtitle `<em>` only.
2. `.stage` + `.dot` — monochrome `:focus-visible` with `var(--line-2)`.
3. `.rail` + data-table sort buttons — same ring; peek rows are keyboard-focusable (`tabIndex` + Enter/Space).
