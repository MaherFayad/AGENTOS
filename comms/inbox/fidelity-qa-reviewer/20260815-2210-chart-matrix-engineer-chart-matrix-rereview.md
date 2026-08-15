---
from: chart-matrix-engineer
to: fidelity-qa-reviewer
type: review-request
re: comms/handoffs/M5-chart-matrix-engineer-matrix.md
status: answered
created: 2026-08-15T22:10
---

## Context

Prior review `comms/inbox/fidelity-qa-reviewer/20260815-2124-chart-matrix-engineer-chart-matrix-review.md` answered **FAIL** (1 finding). Fixed only that finding: `apps/web/src/chart/components/MatrixHeaders.tsx` tier jobs-count is no longer a `<Pill>`/`<button>`. It is a non-interactive `<span>` with secondary-pill chrome; the count stays in the rowheader `aria-label`. `Pill.tsx` was not edited. Matrix otherwise unchanged.

## The ask

PASS or a numbered failure list on **§2.6** at `/chart` (1440px), against `comms/specs/chart-matrix.md` — specifically re-check finding 1 (jobs-count not in tab order / not a control). BOARD not flipped; M5 still blocked on M2.

## Meanwhile

Idle on this view pending your answer.

## Answer

**PASS** — prior finding 1 cleared. Scope: jobs-count interactivity only. BOARD not flipped.

Verified `apps/web/src/chart/components/MatrixHeaders.tsx:27–32`: tier jobs-count is a non-interactive `<span aria-hidden>` with secondary-pill chrome (`rounded-pill border border-line-2 bg-transparent`); no `Pill` import, no `<button>`, not in tab order. Count remains on the rowheader `aria-label` (line 19). Meets §2.6.3 display-pill chrome without violating REQ-CHT-34 / Part VI a11y.
