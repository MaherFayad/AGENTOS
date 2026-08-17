# status — dashboards-engineer

**Updated:** 2026-08-17T18:45
**Milestone:** M15 (this pass) · M6 (review) · M16/ADR-028 (framed, not started)
**State:** review

## Now
**Every DASHBOARDS fetch is project-scoped.** `endpoints.ts` and `DashboardsView` held six
`/api/…` literals that M15 had moved — so every widget on all six Command Centers was
reading a route answering `400 project_scope_missing`. **No path literal remains**; URLs
build from `PROJECT_ROUTE_PREFIX` + `projectPath`, and **no project means no request**, never
the unscoped one. New: `data/endpoints.test.ts`, `components/navigation.test.tsx` (which pays
REQ-DSH-39's owed verification). REQ-DSH-40…44 added.

## Finding — rule 9 held; the sentence did not
Nothing rendered a zero, an empty series or a dash: `resolve.ts` gates every plan shape on
transport before reading a body. What was wrong was the **diagnosis** — a 4xx shared the
offline copy, so six dashboards blamed the tailnet for a bug in a query string, and
`DashboardsView` reported the same 400 as an empty `panels/` folder. Both fixed and pinned
(REQ-DSH-42 · 43). One way to draw an unearned zero is still open and named: `ledger.state`
is not read on a **200**.

## Q8 — closed by its owner mid-pass; the remainder is mine
`runner-engineer` corrected §5.1 Q8 and answered **Q8a** while I worked: a project with no
`panels/` shows an empty carousel, **no fallthrough**. I reached the same answer independently
from the consumer side, and **both of us explicitly refused to inherit ADR-014's reasoning** —
it ruled on a capability ceiling panels have no analogue for. Runner half **built**; the web
half is now mine, half shipped (client read → `RUNNER_ROUTES.panels.path`). The rest is **one
decision, not a rename**: `loadPanels()`'s disk read is the no-runner fallback and cannot name
the project it read — drop it for the route, or make it declare itself coordinator-local.
Dated, owned, scheduled. My drafted `decision-request` was deleted unsent (it asked for a done
change) and `panel-schema.md` was rewritten — it had briefly carried the stale claim itself.

## Blocked on
Nothing. Three open, none holds a milestone:
- `observability-engineer` — lift `METRICS_ROUTES` into `packages/contracts` so the last
  copy dies. `shell-navigation-engineer` — the legacy resolver re-prefixes an already-scoped
  path, unbounded (`/approvals` was my trigger, push deep links hit it too).
  `runner-engineer` — `fyi` only, nothing owed back.
- M3 / `RUNNER_ANTHROPIC_API_KEY` (the user's) — widgets stay honestly empty until then.

## Last handoff
`comms/handoffs/M15-dashboards-engineer-project-scoped-fetches.md`

## Next
1. Ops KPIs off the observability aggregate — with `ledger.state` on 200 and the
   project half of the receipt check (`project.slug`), both owed above.
2. **ADR-028** (`thread-feed`; `board`/`calendar` named only) — on M16's dispatch.
