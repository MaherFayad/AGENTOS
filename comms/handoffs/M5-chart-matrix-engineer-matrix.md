---
agent: chart-matrix-engineer
milestone: M5
spec: §2.6
created: 2026-08-15T21:24
status: ready-for-review
---

# M5 — CHART, the AI rollout matrix

## What exists now

- `apps/web/src/chart/**` — projection + presentational matrix (tabs, title/stat line, 3×4 grid, job cards, hatch).
- `apps/web/src/chart/index.ts` — public surface: `<ChartPage />`, `<ChartView />`, `openDrawer` / `OPEN_DRAWER_EVENT`.
- `apps/web/src/app/(views)/chart/page.tsx` — `/chart` mounts `<ChartMount />` (not `ViewMount`).
- `apps/web/src/app/(views)/chart/[department]/page.tsx` — `/chart/:department` in ADR-001 order; unknown slug redirects to `/chart`.
- `apps/web/src/app/(views)/chart/ChartRoute.tsx` — tab clicks `router.push('/chart/:slug')`.
- `apps/web/src/app/(views)/chart/mount.tsx` — request-time read of `agents/{department}/{slug}/SKILL.md`.
- `apps/web/src/drawer/DrawerHost.tsx` — **sibling** on those routes; owned by `drawer-engineer`. Listens for `commandcenter:open-drawer`.

## How to use it

```tsx
import { ChartPage, openDrawer } from '@/chart';

<ChartPage
  department="marketing"
  onDepartmentChange={(slug) => router.push(`/chart/${slug}`)}
  onOpenDrawer={(detail) => { /* optional; otherwise the event fires */ }}
/>
```

Open `/chart`. Default tab is Sales (ADR-001 first). Stat line, tier pills and phase dashes are counted from frontmatter `tier` / `phase`. Empty cells are 45° `var(--line)` hatch. `More detail →` dispatches `openDrawer(slug, { side: 'right' })`.

## Contracts touched

- Consumes `packages/contracts` `DEPARTMENTS` (ADR-001) — no local department list.
- Consumes `comms/contracts/frontmatter-schema.md` fields `name, description, department, icon, tier, phase, breaks_into`.
- Consumes `comms/contracts/design-tokens.md` via `src/chart/ui.ts`.
- Does not edit any contract.

## Deliberately not done

- **The §2.6.5 drawer body.** `drawer-engineer` owns it. CHART emits `openDrawer` and stops. Their `<DrawerHost />` is a sibling on the chart routes, not a second drawer under `src/chart`.
- **`GET /api/agents` list.** Not in `api-contracts.md` yet. The page projects SKILL.md from disk (`/agents` in Docker, repo-relative in `next dev`) so `/chart` shows real jobs. Client `loadChartAgents()` remains the fallback when the disk read fails.
- **Search/filter inside CHART.** Shell search is §2.0.
- **`status: live` on job cards.** §2.6 has no status surface; first colour here is an ADR.
- **Drag-to-replan** (would write frontmatter — runner git path).
- **Phase-progress history** (needs §3.5 snapshots).
- **`lucide-react` tree-shaking.** `JobIcon` uses the `icons` map.
- **RTL.** Owned by `rtl-arabic-pdpl-specialist` (M8).
- **Vitest in `apps/web` `package.json`.** Co-located tests exist under `src/chart/**/*.test.ts(x)` but `npm run test:web` is `--if-present` and the workspace has no `test` script.

## Verification

- `npx tsc --noEmit -p apps/web` — no errors under `src/chart` or `app/(views)/chart`. Remaining parse error is `apps/web/src/dashboards/data/use-resolved.ts` (not ours).
- `node scripts/check-spec-coverage.mjs` — no FAIL on `chart-matrix.md` rows; unclaimed sections are other owners.
- Hex grep on `src/chart` and the chart routes: zero hits.
- `ViewMount` is gone from both chart route files.
- 12 `SKILL.md` files parse with `tier` + `phase` (sales 2, so `/chart` default tab is a real matrix, not the unstaffed empty state).

## Next agent

`fidelity-qa-reviewer` — open `/chart` at 1440px. Spec: `comms/specs/chart-matrix.md`. Event contract for the right drawer: `apps/web/src/chart/events.ts`.
