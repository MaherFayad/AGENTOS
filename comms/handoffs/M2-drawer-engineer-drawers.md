---
agent: drawer-engineer
milestone: M2
spec: §2.3 (chart-detail panel of §2.6.5 jointly implemented; §2.6 remains chart-matrix-engineer)
created: 2026-08-15T21:45
status: ready-for-review
---

# M2 — MAP job drawer + chart-detail panel

## What exists now

- `apps/web/src/drawer/JobDrawer.tsx` — composing shell, `side: 'left' | 'right'`.
- `apps/web/src/drawer/JobDrawerRoute.tsx` — map route mount.
- `apps/web/src/drawer/DrawerHost.tsx` — chart mount; consumes `src/chart/events.ts`.
- `apps/web/src/drawer/index.ts` — public export.
- `apps/web/src/app/(views)/map/[department]/[agent]/page.tsx` — left drawer over the department `ViewMount`.
- `apps/web/src/app/(views)/chart/page.tsx` and `chart/[department]/page.tsx` — `<DrawerHost />` sibling.
- Section kit already on disk (unchanged in role): Header, Chips, Ladder, Prose, SkillFileCard, InputsForm, LastRuns, RunConsole, ChartSections, `data/*`, `run/*`, `a11y/*`, `drawer.module.css`.
- `comms/specs/drawer.md` — claims **§2.3 only**.

## How to use it

```tsx
import { JobDrawer, JobDrawerRoute, DrawerHost } from '@/drawer';

// Map deep link
<JobDrawerRoute slug="sales/account-enrichment" side="left" />

// Chart — do not fork; CHART already emits this:
// openDrawer('sales/account-enrichment', { side: 'right' })
<DrawerHost />
```

`GET /api/agents/:slug` feeds the projection. `GET /api/status` enables ▶ Run. A dropped run reconnects at `GET /api/run/:runId/stream` with `Last-Event-ID`.

## Contracts touched

- Consumed, not edited: `comms/contracts/frontmatter-schema.md`, `comms/contracts/api-contracts.md`, `comms/contracts/design-tokens.md`.
- Consumed, not forked: `apps/web/src/chart/events.ts` (`commandcenter:open-drawer`).

## Deliberately not done

- **`Take it ↓` zip.** `GET /api/agents/:slug/download` is not in the API contract. Button disabled with an honest tooltip (`DOWNLOAD_ROUTE_AGREED = false`).
- **A decorative ▶.** Run/Schedule call the real routes and stay disabled while the runner is unreachable or `runnerConfigured: false`.
- **`<ChartPage />` wiring.** `chart-matrix-engineer` owns it. Keep `<DrawerHost />` as a sibling when replacing the chart `ViewMount`.
- **Department canvas under the map drawer.** `map-galaxy-engineer` owns §2.2. Keep `JobDrawerRoute` as a sibling of their canvas.
- **Writing `tier` from the chart toggle.** Frontmatter git write — runner's path. Toggle is a disabled readout.
- **Sub-skill descriptions on SKILLS cards.** `breaks_into` leaves have no `description`; the line collapses.
- **M8 RTL screenshot pass.** Layout is logical (`inset-inline-*`); visual QA is `rtl-arabic-pdpl-specialist`.
- **A list-virtualizer library.** Reducer caps at 2k lines and counts drops; painting is the last 400.

## Verification

- Unit files: `apps/web/src/drawer/data/inputs.test.ts` (form is derived), `data/project.test.ts`, `run/sse.test.ts`, `run/transport.test.ts` (GET reconnect + Last-Event-ID), `run/console-model.test.ts`, `a11y/focus-trap.test.ts`, `JobDrawer.test.tsx`.
- No raw hex under `src/drawer`.
- `comms/specs/drawer.md` written from the template; §2.6 is under Boundaries so the coverage checker does not steal it from chart-matrix.

## Next agent

`fidelity-qa-reviewer` — 1440px side-by-side of the Account Enrichment frame vs `/map/sales/account-enrichment`. Then `chart-matrix-engineer` (keep `DrawerHost`) and `map-galaxy-engineer` (keep `JobDrawerRoute`).
