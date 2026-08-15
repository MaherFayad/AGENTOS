---
agent: dashboards-engineer
milestone: M6
spec: §2.4 · §2.5
created: 2026-08-15T21:30
status: ready-for-review
---

# M6 — DASHBOARDS carousel + seven widgets

## What exists now

- `panels/*.json` — six Command Centers (ADR-004). All seven widget types used. No raw SQL.
- `comms/contracts/panel-schema.md` + `packages/contracts/src/panels.ts` — schema.
- `apps/web/src/dashboards/lib/` — carousel maths, chart geometry, formatters, run aggregation.
- `apps/web/src/dashboards/components/` — 3D drag-to-spin carousel, detail layout, KPI tiles, signals strip, seven widget renderers.
- `apps/web/src/app/(views)/dashboards/page.tsx` — mounts `<DashboardsView />` (no longer `ViewMount`).
- `apps/web/src/app/(views)/dashboards/[id]/page.tsx` — mounts `<DashboardDetail />`.
- `comms/specs/dashboards.md` — claims §2.4 · §2.5 only.
- `comms/decisions/ADR-004-command-centers.md` — accepted.

## How to use it

Open `/dashboards`. Drag the ring (momentum, not a snap), or use ‹ › / dots / arrow keys. Click the front card or press Enter to open `/dashboards/:id`.

The detail view reads the same JSON: KPI row, signals, widget grid, prev/next rails. `⌨ Build guide + one-shot prompt` copies a Claude Code prompt that rebuilds `panels/<id>.json`.

Adding a seventh center = a new JSON file + `node scripts/validate-panels.mjs`. Do not add a component.

## Contracts touched

- `comms/contracts/panel-schema.md` (ours) — filled in ADR-004's "Ours" table and the phase-1 query fields (`schemaVersion`, `department[]`, `emptyState`, `pending`, `$range`, result state machine).
- Consumed, not edited: `design-tokens.md`, `api-contracts.md` (`GET /api/runs`, `GET /api/panels`).

## Deliberately not done

- **M6 is blocked on M3 on the BOARD.** The page is a real UI shell over empty metrics. Mission Control's widgets are wired to `GET /api/runs`; until that route is live they render honest empty states, not fabricated KPIs. Business widgets (`sql`) are `unavailable` by design and name the agent that will fill them.
- Live Langfuse windowed aggregates — `lib/runs.ts` derives from the capped runs list and **refuses** when the list is truncated. When observability lands an aggregate route, `resolve.ts` should prefer it.
- A seventh Command Center (ADR-004).
- Named 44px / 26px type utilities — decision-request to `design-system-guardian`. CSS variables on `.view` until they land.
- In-app peek drawer (`drawer-engineer`). A peek row opens `href` / `traceUrl` when present.
- Light theme, RTL, phone carousel geometry (M8).
- Wiring `Get this deployed →` past `/approvals` — that route is the runner's.

## Verification

- `node scripts/validate-panels.mjs` — 6 panels, 7 of 7 widget types, no raw SQL, no fabricated signal numbers (already green before this pass; JSON not rewritten).
- `node --test apps/web/src/dashboards/__tests__/*.test.mjs` — 30 passed (carousel geometry, formatters, sql not phase-1, truncation guard).
- `npm run validate:tokens` / `npm run validate:coverage` — run as part of close-out.

## Next agent

`fidelity-qa-reviewer` — user-visible surface at `/dashboards`. First read: this handoff, then `comms/specs/dashboards.md`, then ADR-004. Do not expect live numbers; empty states are the true state of the system until M3.
