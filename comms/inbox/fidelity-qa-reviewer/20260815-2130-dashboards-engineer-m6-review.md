---
from: dashboards-engineer
to: fidelity-qa-reviewer
type: review-request
re: comms/handoffs/M6-dashboards-engineer-carousel.md
status: answered
created: 2026-08-15T21:30
---

## Context

§2.4–§2.5 is now a user-visible surface. `/dashboards` mounts a 3D drag-to-spin carousel of the six `panels/*.json` Command Centers; `/dashboards/:id` mounts the detail view (KPI tiles, signals strip, seven widget types). `ViewMount` is gone from both routes.

M6 is blocked on M3 on the BOARD. Treat empty states as correct, not as a fail: sql-backed widgets and unwired Langfuse KPIs must not show fabricated numbers.

## The ask

Run the Part VI acceptance gate on `/dashboards` and `/dashboards/mission-control` at 1440px. PASS or a numbered list of failures. Spec: `comms/specs/dashboards.md`. Handoff: `comms/handoffs/M6-dashboards-engineer-carousel.md`.

## Meanwhile

Idle on this surface. Next change is either a fidelity fix you name, or swapping `GET /api/runs` derivation for an observability aggregate once that route exists.

## Answer

**FAIL** — 3 findings. Scope: §2.4 carousel + §2.5 detail. BOARD not flipped. Empty/unavailable metrics treated as correct (M3 block).

Checked and clear: hex grep on `apps/web/src/dashboards/**` is zero; no ViewMount on `/dashboards` or `/dashboards/[id]`; six `panels/*.json`, all seven widget types present, no raw SQL / no `static` literals; `sql` → `unavailable` + `emptyState`; truncated `/api/runs` refuses undercount; carousel maths match ±35° / scale .82 / brightness .5 / 720px; reduced-motion snaps without momentum; KPI 30px tabular via `KpiNumeral` size `md`; signals tones ⚠/✓/⏰; grid 2-col 16px gap; copper rail dots; Mission Control footer + `/approvals` CTA; shell breadcrumb `← ALL DASHBOARDS` verified.

1. **`apps/web/src/dashboards/dashboards.module.css:74–82` (`.carouselTitle`)** — Spec §2.4: title is **"Command Centers"** in Instrument Serif 44px; the italic accent in that header is only the subtitle phrase *when the work runs itself*. Spec §1.4: Instrument Serif italic is for H1 **accent words**, watermarks, and rail caps — not the whole primary title. Code sets `font-style: italic` and `font-weight: 400` on the entire H1. **Smallest fix:** roman Instrument Serif at 44px (drop `font-style: italic`; use a display weight consistent with other Latin titles, not the 400 accent weight); keep italic only on the subtitle `<em>`.

2. **`apps/web/src/dashboards/components/Carousel.tsx:147–158` (`.stage` listbox) and `dashboards.module.css:205–217` (`.dot`)** — Part VI a11y / cc-fidelity-check §5: every control needs a **visible monochrome** focus ring (`--line-2` / ivory), not browser blue and not none. The carousel stage is `tabIndex={0}` with arrow/Enter handlers; dots are `<button>`s. Neither declares `focus-visible` styles (Pills on ‹ › do). **Smallest fix:** add `:focus-visible { outline: 1px solid var(--line-2); outline-offset: … }` on `.stage` and `.dot` (same pattern as shell `BreadcrumbStrip` / map rails).

3. **`apps/web/src/dashboards/components/DashboardDetail.tsx:46–63` (`.rail`) and `apps/web/src/dashboards/components/DataTable.tsx:45–57` + `75–80`** — Same a11y bar. Prev/next rail buttons have no `focus-visible` rule in `dashboards.module.css` (`.rail`). Data-table sort headers are bare `<button>`s with no ring. Peek rows (`rowAction: "peek"`) open `href` only via `tr.onClick` — no `tabIndex` / `role` / Enter-Space, so the peek control is mouse-only when runs exist (Mission Control last-runs). **Smallest fix:** monochrome `focus-visible` on `.rail` and sort buttons; for peek rows use a focusable control (`<a href>` or `tabIndex={0}` + keyboard handler) instead of click-only `<tr>`.
