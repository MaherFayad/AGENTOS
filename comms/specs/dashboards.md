# Spec — DASHBOARDS (carousel + detail)

> The implementation spec for §2.4–§2.5 of `skilltree-clone-spec.md`.
> Checked by `npm run validate:coverage`.

## Owner

`dashboards-engineer`

## Spec sections covered

§2.4 · §2.5

## Boundaries

Owned by others, cited here only so a reader knows where the seams are. **Do not read
section numbers in this heading as claims** — the coverage checker does not scan it.

- The app shell, `/dashboards` route skeleton, and `← ALL DASHBOARDS` breadcrumb are
  `shell-navigation-engineer`. This spec owns what those routes *mount*.
- `GET /api/runs` and `GET /api/cost/today` are `observability-engineer`. We consume the
  runs list; we do not invent a second metrics plane.
- `GET /api/panels` is served by `runner-engineer` from the same `panels/*.json` files.
  The carousel also reads the directory from disk so the cards exist when the runner is down.
- Chart colours and type tokens are `design-system-guardian`. A decision-request asks for
  named 44px / 26px utilities; until they land the sizes live as CSS variables on the view.
- Drawers (peek-inside as a panel) are `drawer-engineer`. A data-table row with a
  `traceUrl` opens that URL; it does not spawn a drawer.
- RTL / light theme / phone polish is M8, `rtl-arabic-pdpl-specialist`.

## Decisions

1. **Dashboards are data, not code.** A new Command Center is a new `panels/*.json` file.
   The renderer has exactly seven widget types. An eighth needs an ADR.

2. **Six centers, seven departments (ADR-004).** `pipeline` covers `sales` and `deals`.
   Outbound is a widget on Pipeline, not a seventh card. Provider glyphs are abstract
   marks, not vendor logos.

3. **Honest empty over a plausible fake.** `sql` queries resolve to `unavailable` and
   print `emptyState`. Langfuse KPIs that cannot be counted (truncated `/api/runs`)
   resolve to `unavailable`, never an undercount. A signal with a digit must carry a query.

4. **The carousel is one floating-point number.** `lib/carousel.ts` is the interaction.
   Momentum comes from the pointer's velocity handed to `motion.carousel.spring`. Reduced
   motion snaps to the nearest card and keeps the end state.

5. **Agent runs ARE the activity feed.** `lib/runs.ts` derives activity rows, ops KPIs and
   grouped lists from `GET /api/runs`. When `observability-engineer` lands an aggregate
   route, `resolve.ts` prefers it; the truncation guard stays until then.

6. **`/dashboards` mounts the view.** `shell-navigation-engineer` owns the route files'
   location; this agent replaces `ViewMount` because the resume wave named that as the gap
   and a carousel that is not on the page is not a carousel.

## Coverage

| ID | Spec § | Requirement | Implemented in | Verified by |
|---|---|---|---|---|
| REQ-DSH-01 | §2.4 | Carousel header: eyebrow `THE OUTPUT LAYER` (caps, +0.35em) | `apps/web/src/dashboards/components/Carousel.tsx` | `apps/web/src/dashboards/__tests__/carousel.test.mjs` |
| REQ-DSH-02 | §2.4 | Title reads **Command Centers** in Instrument Serif 44px | `apps/web/src/dashboards/components/Carousel.tsx` · `apps/web/src/dashboards/dashboards.module.css` | manual — see Test plan |
| REQ-DSH-03 | §2.4 | Subtitle is "what each department looks like *when the work runs itself*" with the accent phrase in serif italic | `apps/web/src/dashboards/components/Carousel.tsx` | manual — see Test plan |
| REQ-DSH-04 | §2.4 | Cards sit on a dotted-grid floor with an elliptical shadow | `apps/web/src/dashboards/dashboards.module.css` · `apps/web/src/dashboards/components/Carousel.tsx` | manual — see Test plan |
| REQ-DSH-05 | §2.4 | Front card ~720px; flanks `rotateY(±35°)`, rear `scale(.82)` and `brightness(.5)` | `apps/web/src/dashboards/lib/carousel.ts` | `apps/web/src/dashboards/__tests__/carousel.test.mjs` |
| REQ-DSH-06 | §2.4 | Drag-to-spin with momentum (spring, not an instant snap) | `apps/web/src/dashboards/lib/carousel.ts` · `apps/web/src/dashboards/components/Carousel.tsx` | `apps/web/src/dashboards/__tests__/carousel.test.mjs` |
| REQ-DSH-07 | §2.4 | ‹ › arrows, dot indicators, and the footer hint `DRAG TO SPIN · CLICK THE FRONT CARD TO ENTER` | `apps/web/src/dashboards/components/Carousel.tsx` | manual — see Test plan |
| REQ-DSH-08 | §2.4 | Caption under the front card: wide-tracked serif caps title + one-liner + provider glyph | `apps/web/src/dashboards/components/Carousel.tsx` · `apps/web/src/dashboards/lib/icons.tsx` | manual — see Test plan |
| REQ-DSH-09 | §2.4 | Six Command Centers, mapped to our stack, each a `panels/*.json` file — no hardcoded dashboard component per center | `panels/` · `comms/decisions/ADR-004-command-centers.md` · `apps/web/src/dashboards/data/load.ts` | `scripts/__tests__/validate-panels.test.mjs` |
| REQ-DSH-10 | §2.4 | Adding a center is adding a JSON file; the carousel sorts by `order` and never names a panel | `apps/web/src/dashboards/data/normalize.ts` · `apps/web/src/dashboards/components/Carousel.tsx` | `apps/web/src/dashboards/__tests__/widgets.test.mjs` |
| REQ-DSH-11 | §2.4 | `/dashboards` mounts the carousel, not `ViewMount` | `apps/web/src/app/(views)/dashboards/page.tsx` | `apps/web/src/dashboards/__tests__/carousel.test.mjs` |
| REQ-DSH-12 | §2.5.1 | Detail breadcrumb `← ALL DASHBOARDS` is the shell's drill-in label (consumed, not reimplemented) | `apps/web/src/components/shell/route.ts` | `apps/web/src/components/shell/route.test.ts` |
| REQ-DSH-13 | §2.5.1 | Title row is 26px/700 + provider glyph + `⌨ Build guide + one-shot prompt` ghost button | `apps/web/src/dashboards/components/DashboardDetail.tsx` · `apps/web/src/dashboards/lib/prompt.ts` | manual — see Test plan |
| REQ-DSH-14 | §2.5.1 | The ghost button copies a Claude Code one-shot that rebuilds `panels/<id>.json` | `apps/web/src/dashboards/lib/prompt.ts` | `apps/web/src/dashboards/__tests__/widgets.test.mjs` |
| REQ-DSH-15 | §2.5.2 | Optional segmented filter or `7d 14d 28d` pills, declared on the panel, not in code | `apps/web/src/dashboards/components/DashboardDetail.tsx` | manual — see Test plan |
| REQ-DSH-16 | §2.5.3 | KPI row of 5–6 tiles: icon+label 11px `--ink-2` → 30px/600 tabular numeral → delta chip → caption → 40×16 sparkline | `apps/web/src/dashboards/components/KpiTile.tsx` · `apps/web/src/dashboards/lib/geometry.ts` | `apps/web/src/dashboards/__tests__/widgets.test.mjs` |
| REQ-DSH-17 | §2.5.3 | KPI numerals count up 300ms on mount; reduced motion renders the end state | `apps/web/src/components/primitives/KpiNumeral.tsx` | `apps/web/src/components/primitives/KpiNumeral.test.tsx` |
| REQ-DSH-18 | §2.5.3 | Delta chip is ▲ teal / ▼ coral, coloured by `goodDirection` (a cost drop is teal) | `apps/web/src/dashboards/lib/format.ts` | `apps/web/src/dashboards/__tests__/widgets.test.mjs` |
| REQ-DSH-19 | §2.5.4 | Signals strip of 2–4 items: ⚠ amber / ✓ teal / ⏰ ivory + bold lead + plain continuation | `apps/web/src/dashboards/components/SignalsStrip.tsx` | `apps/web/src/dashboards/__tests__/widgets.test.mjs` |
| REQ-DSH-20 | §2.5.4 | A signal with a digit must come from a query; `{value}` interpolates or the strip falls back to `pending` | `apps/web/src/dashboards/lib/format.ts` · `scripts/validate-panels.mjs` | `scripts/__tests__/validate-panels.test.mjs` · `apps/web/src/dashboards/__tests__/widgets.test.mjs` |
| REQ-DSH-21 | §2.5.5 | Widget grid is two columns, 16px gap; a widget declares `span: 1 \| 2` | `apps/web/src/dashboards/dashboards.module.css` · `apps/web/src/dashboards/components/DashboardDetail.tsx` | manual — see Test plan |
| REQ-DSH-22 | §2.5.5 | Exactly seven widget types; unknown `type` renders a bordered placeholder and never crashes | `apps/web/src/dashboards/components/WidgetView.tsx` · `packages/contracts/src/panels.ts` | `apps/web/src/dashboards/__tests__/widgets.test.mjs` |
| REQ-DSH-23 | §2.5.5 | `bar-list` — horizontal bars, coral by default, value right-aligned | `apps/web/src/dashboards/components/BarList.tsx` | `apps/web/src/dashboards/__tests__/widgets.test.mjs` |
| REQ-DSH-24 | §2.5.5 | `source-bar-list` — grey bars + formatted values | `apps/web/src/dashboards/components/BarList.tsx` | `apps/web/src/dashboards/__tests__/widgets.test.mjs` |
| REQ-DSH-25 | §2.5.5 | `area-chart` — coral or lavender stroke, 20% fill, spike readout on hover | `apps/web/src/dashboards/components/AreaChart.tsx` · `apps/web/src/dashboards/lib/geometry.ts` | `apps/web/src/dashboards/__tests__/widgets.test.mjs` |
| REQ-DSH-26 | §2.5.5 | `cost-table` — right-rail values, optional total | `apps/web/src/dashboards/components/CostTable.tsx` | `apps/web/src/dashboards/__tests__/widgets.test.mjs` |
| REQ-DSH-27 | §2.5.5 | `data-table` — chip column, sortable, row peek opens `href` when present | `apps/web/src/dashboards/components/DataTable.tsx` | `apps/web/src/dashboards/__tests__/widgets.test.mjs` |
| REQ-DSH-28 | §2.5.5 | `progress-table` — teal track, `✓ On track` / `! At risk` chips | `apps/web/src/dashboards/components/ProgressTable.tsx` | `apps/web/src/dashboards/__tests__/widgets.test.mjs` |
| REQ-DSH-29 | §2.5.5 | `activity-feed` — clock gutter + bold event + `--ink-2` attribution; rows are agent runs | `apps/web/src/dashboards/components/ActivityFeed.tsx` · `apps/web/src/dashboards/lib/runs.ts` | `apps/web/src/dashboards/__tests__/runs.test.mjs` |
| REQ-DSH-30 | §2.5.6 | Rotated rail labels on both edges are previous/next `railTitle`, copper dot, click switches dashboard | `apps/web/src/dashboards/components/DashboardDetail.tsx` | `apps/web/src/dashboards/__tests__/widgets.test.mjs` |
| REQ-DSH-31 | §2.5.7 | Mission Control footer: lead + detail + `Get this deployed →` to `/approvals` | `panels/mission-control.json` · `apps/web/src/dashboards/components/DashboardDetail.tsx` | `scripts/__tests__/validate-panels.test.mjs` |
| REQ-DSH-32 | §2.5 | Every value formats through `formatValue` (`currency` \| `number` \| `percent` \| `duration` \| `relative-time`) with `tabular-nums` | `apps/web/src/dashboards/lib/format.ts` | `apps/web/src/dashboards/__tests__/widgets.test.mjs` |
| REQ-DSH-33 | §2.5 | Missing data: skeleton at reserved height, then a one-line `--ink-3` empty state — never a layout-shifting spinner | `apps/web/src/dashboards/components/states.tsx` · `apps/web/src/dashboards/components/widget-chrome.tsx` | `apps/web/src/dashboards/__tests__/widgets.test.mjs` |
| REQ-DSH-34 | §2.5 | `sql` queries resolve to `unavailable` in phase 1; the widget prints `emptyState` | `apps/web/src/dashboards/data/resolve.ts` | `apps/web/src/dashboards/__tests__/widgets.test.mjs` |
| REQ-DSH-35 | §2.5 | A capped `/api/runs` list that does not cover the window is `unavailable`, not an undercount | `apps/web/src/dashboards/lib/runs.ts` | `apps/web/src/dashboards/__tests__/runs.test.mjs` |
| REQ-DSH-36 | §2.5 | Panel files contain no raw SQL | `scripts/validate-panels.mjs` | `scripts/__tests__/validate-panels.test.mjs` |
| REQ-DSH-37 | §2.5 | `/dashboards/:id` mounts the detail view for that panel JSON | `apps/web/src/app/(views)/dashboards/[id]/page.tsx` | `apps/web/src/dashboards/__tests__/widgets.test.mjs` |
| REQ-DSH-38 | §2.4 | `prefers-reduced-motion` snaps the carousel and skips momentum; the centred card remains | `apps/web/src/dashboards/components/Carousel.tsx` | manual — see Test plan |

## Interfaces we expose

- `<DashboardsView panels error />` — carousel page.
- `<DashboardDetail panel panels />` — detail page.
- `loadPanels()` — server-only disk read of `panels/*.json` (`data/load.ts`).
- `normalizePanelPayload(raw)` — runner envelope / array / document → `Panel[]`.
- `buildPromptFor(panel)` — one-shot prompt text.
- `comms/contracts/panel-schema.md` + `packages/contracts/src/panels.ts` — the schema.

## Interfaces we consume

- `comms/contracts/panel-schema.md` (ours).
- `comms/contracts/design-tokens.md` — tokens, type scale, `--carousel-*`, `--dot-*`.
- `comms/contracts/api-contracts.md` — `GET /api/runs`, `GET /api/panels`, `GET /api/approvals`.
- `@/components/primitives` — Card, Chip, Eyebrow, KpiNumeral, Pill, RailLabel, SegmentedControl, motion.
- Shell breadcrumb for `← ALL DASHBOARDS` (`breadcrumbFor` on `view: dashboards`).

## Test plan

- **Unit:** `node --test apps/web/src/dashboards/__tests__/*.test.mjs` — carousel geometry, bar widths, formatters, sql→unavailable, truncation guard, panel payload normalize.
- **Contract:** `node scripts/validate-panels.mjs` — 6 panels, 7 of 7 widget types, no raw SQL, no fabricated signal numbers.
- **Coverage:** `npm run validate:coverage` — this file claims §2.4 and §2.5 only.
- **Tokens:** `npm run validate:tokens` — no hex outside `tokens.css`.
- **Not automatable here:** 1440px side-by-side of the carousel (perspective, elliptical floor, caption tracking), the 44px serif title, drag-to-spin *feel*, reduced-motion snap. Those are `fidelity-qa-reviewer`'s gate (Part VI) once M6 is unblocked.

## Deliberately not done

- **Live Langfuse aggregates.** M6 is blocked on M3 on the BOARD. The detail view is a
  real renderer over empty metrics until `GET /api/runs` (and later a windowed aggregate)
  is served. Mission Control's widgets are wired; they will read as empty states, not as
  lorem numbers, until the runner writes traces.
- **`sql` widgets lighting up.** Named queries are declared. The runner's query registry
  is not ours. Empty states name the agent that owes the rows.
- **A seventh Command Center.** ADR-004. Outbound stays a widget on Pipeline.
- **Named 44px / 26px type utilities.** Decision-request to `design-system-guardian`.
  Until they land, those two sizes are CSS variables on `.view`.
- **In-app peek drawer.** Data-table `rowAction: "peek"` opens `href` (a Langfuse
  `traceUrl` when the run has one). A drawer body is `drawer-engineer`.
- **`GET /api/panels` as the only load path.** Disk read first so the carousel works
  without the runner; the API is a client fallback.
- **Light theme, RTL, phone carousel geometry.** M8.
