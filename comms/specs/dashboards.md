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

- The app shell, the `/p/:project/dashboards` route skeleton, the project segment itself
  (`useProjectHref`, `splitProject`, `withProject`, the legacy resolver) and the
  `← ALL DASHBOARDS` breadcrumb are `shell-navigation-engineer`. This spec owns what those
  routes *mount*, and consumes the segment — it does not define it.
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

6. **`/p/:project/dashboards` mounts the view.** `shell-navigation-engineer` owns the route
   files' location; this agent replaces `ViewMount` because the resume wave named that as
   the gap and a carousel that is not on the page is not a carousel.

7. **The project is in the URL, and as of 2026-08-17 it is also in every request.**
   Both halves used to be listed here with only the first finished, and that understated
   it: the *view* URLs were scoped and every *data* URL was not. `endpoints.ts` held five
   metrics paths as string literals and `DashboardsView` held `/api/panels`, all of which
   M15 had moved under `/api/p/:project` — so every widget on every Command Center was
   reading from a route that answers `400 project_scope_missing`, and nothing said so.
   There are now no path literals in either file; both build from `packages/contracts`, and
   **no project means no request**, never the unscoped one. What is still *not* scoped is
   the panel **definitions**: `loadPanels()` takes no project and reads one directory — see
   *Deliberately not done*, which is a mount `runner-engineer` owns.

8. **A refused number is `unavailable`, and that survived the routing bug.** The audit that
   found the literals asked the sharper question: with every metrics route answering 400,
   did a widget draw a zero? It did not — `resolve.ts` gates every plan shape on transport
   before it reads a body, so all six resolved `unavailable`. The defect was the *sentence*:
   a 4xx shared the offline copy and blamed the tailnet for a bug in a query string. Both
   the property and the correction are now pinned by tests (REQ-DSH-42, REQ-DSH-43) rather
   than left as a fact someone re-derives.

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
| REQ-DSH-11 | §2.4 | `/p/:project/dashboards` mounts the carousel, not `ViewMount` | `apps/web/src/app/(views)/p/[project]/dashboards/page.tsx` | `apps/web/src/dashboards/__tests__/carousel.test.mjs` |
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
| REQ-DSH-31 | §2.5.7 | Mission Control footer: lead + detail + a `Get this deployed →` CTA. `href` is an in-app path with **no** project segment and the renderer prefixes the current project; `href` may be omitted, and then the CTA renders as text with a required `note` saying why it is not a link | `panels/mission-control.json` · `apps/web/src/dashboards/components/DashboardDetail.tsx` · `scripts/validate-panels.mjs` | `scripts/__tests__/validate-panels.test.mjs` · `apps/web/src/dashboards/components/navigation.test.tsx` |
| REQ-DSH-32 | §2.5 | Every value formats through `formatValue` (`currency` \| `number` \| `percent` \| `duration` \| `relative-time`) with `tabular-nums` | `apps/web/src/dashboards/lib/format.ts` | `apps/web/src/dashboards/__tests__/widgets.test.mjs` |
| REQ-DSH-33 | §2.5 | Missing data: skeleton at reserved height, then a one-line `--ink-3` empty state — never a layout-shifting spinner | `apps/web/src/dashboards/components/states.tsx` · `apps/web/src/dashboards/components/widget-chrome.tsx` | `apps/web/src/dashboards/__tests__/widgets.test.mjs` |
| REQ-DSH-34 | §2.5 | `sql` queries resolve to `unavailable` in phase 1; the widget prints `emptyState` | `apps/web/src/dashboards/data/resolve.ts` | `apps/web/src/dashboards/__tests__/widgets.test.mjs` |
| REQ-DSH-35 | §2.5 | A capped `/api/runs` list that does not cover the window is `unavailable`, not an undercount | `apps/web/src/dashboards/lib/runs.ts` | `apps/web/src/dashboards/__tests__/runs.test.mjs` |
| REQ-DSH-36 | §2.5 | Panel files contain no raw SQL | `scripts/validate-panels.mjs` | `scripts/__tests__/validate-panels.test.mjs` |
| REQ-DSH-37 | §2.5 | `/p/:project/dashboards/:id` mounts the detail view for that panel JSON | `apps/web/src/app/(views)/p/[project]/dashboards/[id]/page.tsx` | `apps/web/src/dashboards/__tests__/widgets.test.mjs` |
| REQ-DSH-38 | §2.4 | `prefers-reduced-motion` snaps the carousel and skips momentum; the centred card remains | `apps/web/src/dashboards/components/Carousel.tsx` | manual — see Test plan |
| REQ-DSH-39 | §2.4 | Entering a card from the carousel, and the prev/next rail, build their URL through `useProjectHref` — you stay in the project you were looking at, and neither view hardcodes `/dashboards/…` (M15, `Plan §9`) | `apps/web/src/dashboards/components/Carousel.tsx` · `apps/web/src/dashboards/components/DashboardDetail.tsx` | `apps/web/src/dashboards/components/navigation.test.tsx` |
| REQ-DSH-40 | §2.5 | Every metrics URL a panel can build carries `/api/p/:project`, built from `PROJECT_ROUTE_PREFIX` + `projectPath` — no path literal in the module, on any of the six plan shapes (M15, ADR-015 Q1) | `apps/web/src/dashboards/data/endpoints.ts` | `apps/web/src/dashboards/data/endpoints.test.ts` |
| REQ-DSH-41 | §2.5 | No project ⇒ **no request**: the plan is `unsupported`, `urlsOf` is empty, and the widget prints a sentence naming the address as the cause. There is no fallback to the pre-project path, which the runner answers `400 project_scope_missing` (ADR-015 Q2) | `apps/web/src/dashboards/data/endpoints.ts` · `apps/web/src/dashboards/data/use-resolved.tsx` | `apps/web/src/dashboards/data/endpoints.test.ts` · `apps/web/src/dashboards/data/resolve.test.ts` |
| REQ-DSH-42 | §2.5 | A refused or unreadable metric resolves `unavailable` on **every** shape — never `0`, never an empty series, never a dash. Unknown is not zero (BOARD rule 9) | `apps/web/src/dashboards/data/resolve.ts` | `apps/web/src/dashboards/data/resolve.test.ts` |
| REQ-DSH-43 | §2.5 | A 4xx is reported as a refused request naming its status, not as an unreachable runner — a client-side fault must not be diagnosed as a network one | `apps/web/src/dashboards/data/use-resolved.tsx` | `apps/web/src/dashboards/data/resolve.test.ts` |
| REQ-DSH-44 | §2.4 | The carousel's client-side panel read is project-scoped via `RUNNER_ROUTES.panels.path`; with no project it does not ask, and a failed request is never reported as an empty `panels/` folder | `apps/web/src/dashboards/components/DashboardsView.tsx` | `apps/web/src/dashboards/data/endpoints.test.ts` |

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
- **REQ-DSH-39's owed verification is paid.** `components/navigation.test.tsx` renders both views with a mocked `usePathname` and asserts the argument `router.push` actually receives — `/p/acme/dashboards/<id>` for the carousel's Enter and for both rail buttons — plus the negative, that the pre-M15 shape is never pushed. Written to the `map/MapView.test.tsx` pattern named here when the debt was recorded.
- **Routing:** `data/endpoints.test.ts` (Vitest) asserts every plan shape's URL against `PROJECT_ROUTE_PREFIX`, against `LEGACY_UNSCOPED_PATHS`, and against each of the five pre-M15 metrics spellings by name. It replaces the routing half of `__tests__/runs.test.mjs`, which could not survive `endpoints.ts` importing `@agnetos/contracts` — Node's runner cannot resolve that package's extensionless barrel, and that constraint is precisely why the literals existed.
- **Not automatable here:** 1440px side-by-side of the carousel (perspective, elliptical floor, caption tracking), the 44px serif title, drag-to-spin *feel*, reduced-motion snap. Those are `fidelity-qa-reviewer`'s gate (Part VI) once M6 is unblocked.

## Deliberately not done

- **The per-project panel mount — a gap, not a decision, and it is the one thing on this
  list somebody else has already ruled on.** `project-scoping.md` §5.1 **Q8** answers
  *"Are `panels/*.json` cascaded like agents?"* with *"**No — not in M15.** Panels are
  mounted **per project**, not resolved through layers"*, and §3 lists `library_path` as
  *"the repo holding `agents/`, `panels/`, `company/`"*. **Neither half of that mount
  exists.** `loadPanels()` takes no project and walks a fixed candidate list
  (`PANELS_DIR`, `/panels`, then monorepo-relative); both route files destructure `id` and
  never `project`. So the six Command Centers render identically in every project, and two
  projects on one coordinator cannot have different dashboards.
  **Resolved on the contract side, 2026-08-17, by `runner-engineer` — while this pass was
  in flight.** §5.1 Q8 now carries the mount mechanism plus a state table of what is and is
  not built, and **Q8a answers the sub-question Q8 had declined: a project with no `panels/`
  shows an empty carousel, no fallthrough, no coordinator tier to fall through to.** The
  runner half is built (`GET /api/p/:project/panels[/:id]` reads `MountedProject.panelsDir`;
  `lib/panels.ts` cannot import `RunnerConfig`, so a project route physically cannot serve
  another project's dashboards — `routes/__tests__/project-derived-reads.test.ts`).
  `panel-schema.md` § *Panels and projects* adopts both rulings.

  *Worth recording:* this spec and Q8a reached the same answer independently in one session,
  and **both refused to inherit ADR-014's reasoning** — it ruled against fallthrough for
  *agents* on a capability ceiling panels have no analogue for, and its conclusion was
  sitting there correct-looking and free.

  **The web half is now mine, and half of it shipped in this pass.** `DashboardsView`'s
  client read goes to `RUNNER_ROUTES.panels.path` through `projectApiUrl` (REQ-DSH-44), so
  the reachable path honours the mount. What remains is **one decision, not a rename**: the
  server-side `loadPanels()` disk read exists so the carousel works with no runner at all —
  a property this spec's *Boundaries* claims on purpose — and a disk read cannot name the
  project it read, which is precisely the ambient default ADR-015 removes. Threading
  `project` into `loadPanels()` would buy a parameter and no guarantee. It is either dropped
  in favour of the route, or kept and made to declare itself coordinator-local and
  unverified. Owned by `dashboards-engineer`, dated, and scheduled with the ops-KPI pass —
  deliberately not smuggled into a routing fix. Until then six Command Centers render
  identically in every project, which is true of exactly one project today: **latent, not
  live**, and now stated identically in both contracts.
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
