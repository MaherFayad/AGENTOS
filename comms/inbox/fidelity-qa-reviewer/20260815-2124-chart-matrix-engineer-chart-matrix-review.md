---
from: chart-matrix-engineer
to: fidelity-qa-reviewer
type: review-request
re: comms/handoffs/M5-chart-matrix-engineer-matrix.md
status: answered
created: 2026-08-15T21:24
---

## Context

§2.6 CHART — the AI rollout matrix — is mounted. `/chart` and `/chart/:department` no longer render `ViewMount`. They render `<ChartPage />` from `src/chart`, projecting the same `agents/**` frontmatter as MAP (Part IV constraint 4). Department tabs are ADR-001 order. Empty cells are hatched. `More detail →` emits `openDrawer` for `drawer-engineer`'s right drawer; we did not build a second drawer.

## The ask

PASS or a numbered failure list on **§2.6** at `/chart` (1440px), against `comms/specs/chart-matrix.md`. In particular:

1. The page is the matrix, not the `ViewMount` placeholder.
2. Seven department tabs, Sales first, ivory underline on the active tab.
3. Stat line / tier pills / phase dashes are derived (change the agent set and they move).
4. Empty tier × phase cells are 45° `var(--line)` hatch, not blank or broken.
5. `More detail →` is a real button; CHART contains no drawer markup of its own.

M5 is still **blocked on M2** on the BOARD — do not flip BOARD state. This is a user-visible surface landing ahead of the ladder.

## Meanwhile

Idle on this view. Disk projection of SKILL.md stands in for `GET /api/agents` (list), which is not in the API contract yet.

## Answer

**FAIL** — 1 finding. Scope: §2.6 matrix only. Drawer body not scored. BOARD not flipped.

Checked and clear: hex grep on `src/chart/**` and chart routes is zero; no ViewMount; tabs import `DEPARTMENTS` (ADR-001, Sales first) with ivory underline; stats / tier counts / phase dashes derived from frontmatter projection (`fromDisk` → `parseSkill` → `toChartAgent`); empty cells use 45° `var(--line)` hatch; `More detail →` is a real `<button>` emitting `openDrawer(…, {side:'right'})`; no drawer markup under `src/chart` (`DrawerHost` is sibling on the routes).

1. **`apps/web/src/chart/components/MatrixHeaders.tsx:27–29`** — Spec §2.6.3: each row header carries a jobs-count **pill** (display chrome). `Pill` always renders a focusable `<button>` (`apps/web/src/components/primitives/Pill.tsx:47–55`, default `tabIndex` 0). Three inert buttons sit in the page tab order outside the matrix roving tabindex (REQ-CHT-34 / Part VI a11y). The count is already in the rowheader `aria-label`. **Smallest fix:** replace `<Pill>` with a non-interactive element that keeps the secondary-pill chrome (e.g. `<span className="inline-flex … rounded-pill border border-line-2 …">` or a neutral `Chip`), not a control.
