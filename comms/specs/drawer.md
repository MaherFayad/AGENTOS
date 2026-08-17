# Spec — MAP job drawer

> The implementation spec for §2.3 of `skilltree-clone-spec.md`.
> Checked by `npm run validate:coverage`.

## Owner

`drawer-engineer`

## Spec sections covered

§2.3 — MAP job drawer (left panel, ~300px, `--glass` + blur, full height), including the
ten-section anatomy and the three additions below THE HUMAN (LAST RUNS, INPUTS, live SSE
console).

## Boundaries — sections this spec cites but does not own

BOARD.md gives this agent §2.3 **and** the §2.6.5 chart-detail *panel*. The coverage
checker treats every `§n.n` under **Spec sections covered** as an ownership claim, and
the spec of record only has a `## 2.6` heading — there is no claimable `§2.6.5` id.
`chart-matrix-engineer` already claims §2.6 (including REQ-CHT-29/30: `More detail →`
emits `openDrawer(agentSlug, {side:'right'})` and CHART contains no drawer of its own).

This spec therefore **does not claim §2.6**. The chart drawer is the same `JobDrawer`
with `side="right"`: autonomy toggle, REPLACES cost quote, WHAT IT DOES, FROM MANUAL TO
AUTONOMOUS with a NOW badge, SKILLS cards, TOOLS chips, HOW TO RUN IT. Those live in
`apps/web/src/drawer/sections/ChartSections.tsx` and `JobDrawer.tsx`. CHART owns the
selection; we own the panel it opens.

| Section | Owner | What is mine | What is theirs |
|---|---|---|---|
| §2.6 / item 5 | `chart-matrix-engineer` | the right-hand panel, the shared section components, `DrawerHost` | the matrix, `More detail →`, `src/chart/events.ts` |
| §2.2 | `map-galaxy-engineer` | the drawer overlay on `/map/:department/:agent` | the department canvas underneath |
| §3.2 | `runner-engineer` | SSE console, reconnect, Run/Schedule buttons | `POST /api/run`, `GET /api/run/:runId/stream`, approvals, git schedule |
| §3.5 | `observability-engineer` | LAST RUNS rows and the trace link | `GET /api/runs`, Langfuse |
| §1.4 | `rtl-arabic-pdpl-specialist` | logical `inset-inline-*` / `data-side=start\|end` | the M8 RTL visual pass |
| Part IV | `agent-library-curator` | the projection `frontmatter → DrawerModel` | the schema itself |

## Decisions

1. **One component, a `side` prop.** `left` is the map drawer (inline-start, 300px, glass,
   full height). `right` is the chart mirror (inline-end, 360px). They share every
   sub-component. A second drawer implementation would be a second copy of the agent
   projection, which Part IV forbids.
2. **CHART's event is consumed, not forked.** `DrawerHost` listens to
   `commandcenter:open-drawer` from `apps/web/src/chart/events.ts`. Map chips use the
   drawer's own `drawer:open` bus for in-place swaps on the same side.
3. **The map drawer is a route.** `/map/:department/:agent` mounts `JobDrawerRoute`, so a
   phone can be handed a link and the back button closes it (shell `route.ts`).
4. **INPUTS are generated.** `planInputs(frontmatter.inputs)` is the only form factory.
   An unrenderable type is a schema gap shown in the drawer, never a hand-written
   per-agent form.
5. **▶ Run now is honest.** Until `GET /api/status` says the runner is configured, the
   button is disabled with a tooltip. There is no decorative ▶.
6. **Reconnect is GET, never a second POST.** After `start` hands back `runId`, a dropped
   connection re-attaches via `GET /api/run/:runId/stream` with `Last-Event-ID`.
7. **The chart autonomy toggle is a readout.** `tier` lives in frontmatter. Changing it
   would be a git write the runner owns. The row is disabled and says so.
8. **Provenance is parsed, never stored.** The header's badge is derived on every render
   from the cascade's own `source_ref` string (`{layer}:{path}@{digest}`, ADR-014 §2). The
   drawer holds no `layer` field, so there is nothing to invalidate and no way for a stale
   answer to survive. `data/provenance.ts` is the web app's only reader of that grammar.
9. **`unknown` is a state, not a fallback — and it is no longer the state the drawer opens
   in.** Two sources can answer, in this order: `AgentDetail.sourceRef` from the agent read
   (present on open, resolved through the same call dispatch uses — *the file that would
   run*), then `SseStartData.sourceRef` from the run stream (*the file that did run*, in
   this session). `unknown` is what the header says when **neither** did, which now needs a
   reason — a runner older than the contract, or a ref in a grammar this app cannot read —
   rather than being the normal case. The badge primitive refuses a default `state` (tokens
   contract §10) and this spec does not work around it.

   *This decision used to read "`GET /api/agents/:slug` carries no `source_ref` today".*
   That was true when written and stopped being true mid-M15, when `AgentDetail.sourceRef`
   landed as a **required** field. Nothing consumed it, so the header said SOURCE UNKNOWN
   for every agent, always, and the sentence in this file explained the bug as if it were
   the design. Recorded rather than quietly corrected, because the shape — producer shipped,
   consumer did not, documentation asserting the pre-change fact — is the same one M15's
   verdict found twice.
10. **No path is typed; every path is built from `RUNNER_ROUTES`.** M15 moved the routes
   under `/api/p/:project` (ADR-015) and this drawer's five literals kept pointing at the
   pre-project spelling, so the drawer could not open an agent or start a run for a day
   with nothing red. A literal is what made that possible. `data/client.ts` and
   `run/transport.ts` now hold no path string; the one exception is documented in
   decision 12. The URL builder is `shell-navigation-engineer`'s shared `projectApiUrl`,
   not a private copy — four copies of one builder is the shape that disagrees quietly a
   month later.
11. **`null` project means *do not ask*.** Never *ask the unscoped one*. The pre-project
   paths are still mounted and refuse by name so the migration stays visible
   (`LEGACY_UNSCOPED_PATHS`); calling one anyway converts a deliberate 400 into a shrug,
   and a 400 swallowed by a fallback is exactly how this stayed invisible. Reads and
   writes raise an `ApiCallError` carrying the shell's `NO_PROJECT_SENTENCE`; `downloadUrl`
   returns `null` because an `<a>` is a URL and not a call. A run is refused
   **non-retryably**, because retrying an address that names no project produces the same
   address behind a spinner. `GET /api/status` is the deliberate exception: it is
   `scope: 'coordinator'`, it describes the process rather than a project's data, and both
   `runner-engineer` and `shell-navigation-engineer` have written that down.
12. **One suffix is still written here, and it is named.** `/metrics/runs` has no export in
   `@agnetos/contracts` — the metrics surface is `observability-engineer`'s and lives in
   `apps/runner`, which a web module may not import. So the half that *moved* (the project
   prefix) comes from `PROJECT_ROUTE_PREFIX` and only the suffix is local, which is exactly
   the construction their own `METRICS_ROUTES` uses and for the reason stated there. A
   `decision-request` is open to export that table beside `COST_TICKER_ROUTE`; when it
   lands the constant is deleted, not corrected.

## Coverage

| ID | Spec § | Requirement | Implemented in | Verified by |
|---|---|---|---|---|
| REQ-DRW-01 | §2.3 | Map drawer is ~300px, full height, `--glass` + blur, on the inline-start edge | `apps/web/src/drawer/drawer.module.css` · `apps/web/src/drawer/JobDrawer.tsx` | `apps/web/src/drawer/JobDrawer.test.tsx` |
| REQ-DRW-02 | §2.3 | Drawer slides in over a scrim in `--dur-drawer` (320ms) | `apps/web/src/drawer/drawer.module.css` | manual — see Test plan |
| REQ-DRW-03 | §2.3 | Eyebrow is the autonomy state in copper caps (`FULLY AUTONOMOUS`) plus a close ✕ | `apps/web/src/drawer/sections/Header.tsx` · `apps/web/src/drawer/data/project.ts` | `apps/web/src/drawer/data/project.test.ts` |
| REQ-DRW-04 | §2.3 | Title is 24px/700 ivory; breadcrumb is 12px `--ink-2` (`Sales · Enrichment`) | `apps/web/src/drawer/sections/Header.tsx` · `apps/web/src/drawer/drawer.module.css` | `apps/web/src/drawer/data/project.test.ts` |
| REQ-DRW-05 | §2.3 | Description is 13px `--ivory-2` | `apps/web/src/drawer/sections/Header.tsx` · `apps/web/src/drawer/drawer.module.css` | `apps/web/src/drawer/data/project.test.ts` |
| REQ-DRW-06 | §2.3 | Skill-file card: 1px `--line`, 12px radius, download line plus Take it / ▶ Run now / ⏰ Schedule | `apps/web/src/drawer/sections/SkillFileCard.tsx` | `apps/web/src/drawer/JobDrawer.test.tsx` |
| REQ-DRW-07 | §2.3 | ▶ Run now is primary copper; it is disabled with an honest tooltip when the runner is down | `apps/web/src/drawer/sections/SkillFileCard.tsx` · `apps/web/src/drawer/run/useRunnerAvailability.ts` | `apps/web/src/drawer/run/useRunnerAvailability.ts` |
| REQ-DRW-08 | §2.3 | BREAKS INTO chips (11px, 1px border, 6px radius); click emits `shell:flyTo` | `apps/web/src/drawer/sections/Chips.tsx` | `apps/web/src/drawer/data/project.test.ts` |
| REQ-DRW-09 | §2.3 | WIRED INTO is a plain text list (`Exa · Firecrawl`) | `apps/web/src/drawer/sections/Prose.tsx` | `apps/web/src/drawer/data/project.test.ts` |
| REQ-DRW-10 | §2.3 | BUILDS ON is a dashed-border chip that opens the prerequisite agent | `apps/web/src/drawer/sections/Chips.tsx` | `apps/web/src/drawer/data/project.test.ts` |
| REQ-DRW-11 | §2.3 | WHAT IT REPLACES is a quote box on `--card` | `apps/web/src/drawer/sections/Prose.tsx` | `apps/web/src/drawer/data/project.test.ts` |
| REQ-DRW-12 | §2.3 | THE LADDER is three rows HUMAN-LED / HUMAN-ASSISTED / FULLY AUTONOMOUS; active ivory, others `--ink-3` | `apps/web/src/drawer/sections/Ladder.tsx` | `apps/web/src/drawer/JobDrawer.test.tsx` |
| REQ-DRW-13 | §2.3 | THE HUMAN is the closing paragraph from frontmatter `the_human` | `apps/web/src/drawer/sections/Prose.tsx` | `apps/web/src/drawer/data/project.test.ts` |
| REQ-DRW-14 | §2.3 | LAST RUNS shows up to 5 rows from `GET /api/p/:project/metrics/runs?agent=&limit=5` — the durable ledger, not the in-memory queue view (relative time, status dot, cost, duration; click → trace) | `apps/web/src/drawer/sections/LastRuns.tsx` · `apps/web/src/drawer/data/client.ts` | `apps/web/src/drawer/data/client.test.ts` · `apps/web/src/drawer/data/project.test.ts` |
| REQ-DRW-15 | §2.3 | INPUTS form is generated from frontmatter `inputs:` (`type` + `required`); never hand-written per agent | `apps/web/src/drawer/data/inputs.ts` · `apps/web/src/drawer/sections/InputsForm.tsx` | `apps/web/src/drawer/data/inputs.test.ts` · `apps/web/src/drawer/JobDrawer.test.tsx` |
| REQ-DRW-16 | §2.3 | Live SSE console is monospace 12px on `--screen` and slides up over the drawer | `apps/web/src/drawer/sections/RunConsole.tsx` · `apps/web/src/drawer/drawer.module.css` | `apps/web/src/drawer/run/console-model.test.ts` |
| REQ-DRW-17 | §2.3 | Console renders exactly the contract events (`start`, `token`, `tool`, `plan`, `artifact`, `done`, `error`) | `apps/web/src/drawer/run/console-model.ts` | `apps/web/src/drawer/run/console-model.test.ts` |
| REQ-DRW-18 | §2.3 | Reconnect uses `GET /api/p/:project/run/:runId/stream` plus `Last-Event-ID` (header and `?lastEventId=`); it does not POST a second run | `apps/web/src/drawer/run/transport.ts` · `apps/web/src/drawer/run/useRunStream.ts` | `apps/web/src/drawer/run/transport.test.ts` |
| REQ-DRW-19 | §2.3 | Console window is bounded (~2k lines in the reducer, 400 painted) | `apps/web/src/drawer/run/console-model.ts` · `apps/web/src/drawer/sections/RunConsole.tsx` | `apps/web/src/drawer/run/console-model.test.ts` |
| REQ-DRW-20 | §2.3 | `plan` with `awaitingApproval` pauses the run and shows Allow / Deny | `apps/web/src/drawer/run/console-model.ts` · `apps/web/src/drawer/sections/RunConsole.tsx` | `apps/web/src/drawer/run/console-model.test.ts` |
| REQ-DRW-21 | §2.3 | Missing optional sections collapse — no empty headers, no "N/A" | `apps/web/src/drawer/sections/Section.tsx` · `apps/web/src/drawer/data/project.ts` | `apps/web/src/drawer/data/project.test.ts` |
| REQ-DRW-22 | §2.3 | Focus trap + Esc to close + scrim click; focus ring is monochrome | `apps/web/src/drawer/a11y/useFocusTrap.ts` · `apps/web/src/drawer/a11y/focus-trap.ts` · `apps/web/src/drawer/drawer.module.css` | `apps/web/src/drawer/a11y/focus-trap.test.ts` |
| REQ-DRW-23 | §2.3 | Every agent-facing string is projected from frontmatter; the drawer stores no copy | `apps/web/src/drawer/data/project.ts` · `apps/web/src/drawer/JobDrawer.tsx` | `apps/web/src/drawer/data/project.test.ts` |
| REQ-DRW-24 | §2.3 | No raw hex in the drawer tree — colours are `var(--token)` | `apps/web/src/drawer/drawer.module.css` | `scripts/check-tokens.mjs` |
| REQ-DRW-25 | §2.3 | Map route `/p/:project/map/:department/:agent` mounts the left drawer, and closing it returns to the department **in the project it was opened in** (M15) | `apps/web/src/drawer/JobDrawerRoute.tsx` · `apps/web/src/app/(views)/p/[project]/map/[department]/[agent]/page.tsx` | `apps/web/src/components/shell/route.test.ts` |
| REQ-DRW-26 | §2.3 | Chart `More detail` opens the same component on the right via `DrawerHost` consuming `src/chart/events.ts` | `apps/web/src/drawer/DrawerHost.tsx` · `apps/web/src/drawer/JobDrawer.tsx` | `apps/web/src/drawer/JobDrawer.test.tsx` · `apps/web/src/chart/events.test.ts` |
| REQ-DRW-27 | §2.3 | Chart extras (autonomy toggle, REPLACES cost quote, SKILLS cards, TOOLS, HOW TO RUN IT, NOW badge) share the map section set | `apps/web/src/drawer/sections/ChartSections.tsx` · `apps/web/src/drawer/JobDrawer.tsx` | `apps/web/src/drawer/JobDrawer.test.tsx` |
| REQ-DRW-28 | §2.3 | Direction is logical (`inset-inline-*`, `data-side=start\|end`) so RTL is a `dir` attribute, not a retrofit | `apps/web/src/drawer/drawer.module.css` | `apps/web/src/i18n/direction.ts` |
| REQ-DRW-29 | §2.3 | An unknown input type is reported in the drawer as a schema gap, not coerced into a text box | `apps/web/src/drawer/data/inputs.ts` | `apps/web/src/drawer/data/inputs.test.ts` |
| REQ-DRW-30 | §2.3 | Both drawer headers show where the agent came from, using the shared `ProvenanceBadge`, projected from the cascade's `source_ref` — the drawer stores no layer of its own (`Plan §23.6`, ADR-014 §2) | `apps/web/src/drawer/data/provenance.ts` · `apps/web/src/drawer/sections/Header.tsx` · `apps/web/src/drawer/run/console-model.ts` | `apps/web/src/drawer/data/provenance.test.ts` · `apps/web/src/drawer/sections/Header.test.tsx` · `apps/web/src/drawer/JobDrawer.test.tsx` |
| REQ-DRW-31 | §2.3 | Unknown provenance renders as **unknown** and never as `global`; an unreadable `source_ref`, a silent runner, or another agent's run all resolve to the same honest empty state | `apps/web/src/drawer/data/provenance.ts` · `apps/web/src/drawer/drawer.module.css` | `apps/web/src/drawer/data/provenance.test.ts` · `apps/web/src/drawer/sections/Header.test.tsx` · `apps/web/src/drawer/JobDrawer.test.tsx` |
| REQ-DRW-36 | §2.3 | The header's provenance is **wired to the agent read**: `AgentDetail.sourceRef` survives `normalizeAgentDoc` onto `AgentDoc`, and `drawerProvenance` prefers it over the run stream — so opening an agent names a real layer **with no run having executed**, which is the state this repo is actually in | `apps/web/src/drawer/data/types.ts` · `apps/web/src/drawer/data/normalize.ts` · `apps/web/src/drawer/data/provenance.ts` · `apps/web/src/drawer/JobDrawer.tsx` | `apps/web/src/drawer/JobDrawer.test.tsx` · `apps/web/src/drawer/data/provenance.test.ts` |
| REQ-DRW-32 | §2.3 | Every drawer fetch carries `/api/p/:project` (M15, ADR-015) and every path is **built from `RUNNER_ROUTES`**, never typed — no path literal remains in `data/client.ts` or `run/transport.ts` | `apps/web/src/drawer/data/client.ts` · `apps/web/src/drawer/run/transport.ts` · `apps/web/src/drawer/JobDrawer.tsx` | `apps/web/src/drawer/data/client.test.ts` · `apps/web/src/drawer/run/transport.test.ts` |
| REQ-DRW-33 | §2.3 | No project ⇒ **no request**: a `null` (or non-slug) segment refuses with a sentence and never falls back to an unscoped path, and the tests assert `fetch` was not called at all | `apps/web/src/drawer/data/client.ts` | `apps/web/src/drawer/data/client.test.ts` |
| REQ-DRW-34 | §2.3 | A run that cannot name its project is refused **before any POST** and **non-retryably**, so no billable run starts and no "reconnecting…" spinner hides a client-side fault | `apps/web/src/drawer/run/transport.ts` · `apps/web/src/drawer/run/useRunStream.ts` | `apps/web/src/drawer/run/transport.test.ts` |
| REQ-DRW-35 | §2.3 | `GET /api/status` stays **coordinator-scoped on purpose** and is read from the route table, so nobody "fixes" it by pattern-matching the migrated calls | `apps/web/src/drawer/data/client.ts` · `apps/web/src/drawer/run/useRunnerAvailability.ts` | `apps/web/src/drawer/data/client.test.ts` |

## Interfaces we expose

From `apps/web/src/drawer` (`index.ts` is the public surface):

- `<JobDrawer slug side open onClose />` — the composing drawer. `side="left"` is §2.3,
  `side="right"` is the §2.6.5 panel.
- `<JobDrawerRoute slug side />` — map-route mount; Esc / ✕ navigates back to the
  department.
- `<DrawerHost />` — chart-route mount; listens to `commandcenter:open-drawer`.
- `projectAgent(doc) → DrawerModel` — the frontmatter projection.
- `planInputs(inputs) → InputPlan` — the form factory.

Everything else under `src/drawer` is private.

## Interfaces we consume

| What | From | Contract |
|---|---|---|
| Agent frontmatter + `inputs[]` | `agent-library-curator` | `comms/contracts/frontmatter-schema.md` |
| `RUNNER_ROUTES` (`agent`, `run`, `runStream`, `schedule`, `approvalDecision`, `status`), `PROJECT_ROUTE_PREFIX`, `LEGACY_UNSCOPED_PATHS` | `runner-engineer` | `comms/contracts/api-contracts.md` · `comms/contracts/project-scoping.md` |
| `GET /api/p/:project/metrics/runs` — the durable LAST RUNS ledger | `observability-engineer` | `comms/specs/observability.md` |
| `projectApiUrl` + `NO_PROJECT_SENTENCE` (`components/shell/useSearchIndex`), `useProjectSegment` | `shell-navigation-engineer` | `comms/specs/shell-navigation.md` § *Interfaces we expose* |
| `openDrawer(agentSlug, {side:'right'})`, `OPEN_DRAWER_EVENT` | `chart-matrix-engineer` | `apps/web/src/chart/events.ts` |
| `shell:flyTo` | `shell-navigation-engineer` | `apps/web/src/lib/shell-bus.ts` |
| `GlassPanel`, `Pill`, `Eyebrow`, `ProvenanceBadge`, `--dur-drawer` | `design-system-guardian` | `comms/contracts/design-tokens.md` §10 |
| `sourceRef()` / `CascadeLayer`; **`AgentDetail.sourceRef` on the agent read** (required, from `resolveForDispatch`); `SseStartData.sourceRef` on the first frame | `runner-engineer` · resolution semantics `agent-library-curator` | `comms/contracts/api-contracts.md` · ADR-014 |
| Drawer string keys | `rtl-arabic-pdpl-specialist` | `apps/web/src/i18n/strings.en.ts` |

## Test plan

- **Pure projection** (`data/inputs.test.ts`, `data/project.test.ts`) — two agents produce
  two forms; unknown types become schema gaps; optional sections collapse to `null`.
- **Transport** (`run/transport.test.ts`, `run/sse.test.ts`) — start is POST
  `/api/p/:project/run`; re-attach is GET `/api/p/:project/run/:runId/stream` with
  `Last-Event-ID`.
- **The URL at the wire** (`data/client.test.ts`, `run/transport.test.ts`) — every
  assertion is on the string `fetch` was called with, compared against `RUNNER_ROUTES`
  rather than against a copy, plus the negative: the URL is never a member of
  `LEGACY_UNSCOPED_PATHS`. The no-project cases assert `fetch` was **not called**, which
  is the property a message-only assertion would miss. This is the direct lesson of the
  M15 miss: the old suite asserted `'/api/agents/…'` and stayed green for a day after that
  path started refusing, because it agreed with the literal in the subject.
- **Console reducer** (`run/console-model.test.ts`) — the seven events, the approval
  pause, unknown events as notices, and `start`'s `agent` + `sourceRef` retained so the
  header can answer at all.
- **Provenance** (`data/provenance.test.ts`, `sections/Header.test.tsx`,
  `JobDrawer.test.tsx`) — every input either yields a layer the cascade named or yields
  `unknown`; `override` reads as `project` per ADR-014 §4.1; one agent's run is never
  attributed to another agent's header; the unknown state draws no mark and is not painted
  in the disabled token. **The third file is the one that matters and it was missing:** the
  first two prove the parser and the component, and between them sits the wiring — which of
  the two sources the drawer hands the header — which had no test and was where the bug was.
  `JobDrawer.test.tsx` mounts the real drawer, answers `GET /api/p/:project/agents/:slug`
  with a real `AgentDetail`, starts **no run**, and asserts the header names the layer. It
  was run against the pre-fix wiring first and failed on *"expected 'Source unknown' to
  contain 'Resolved from this project's library.'"* — a test that has never been red proves
  nothing.
- **Focus arithmetic** (`a11y/focus-trap.test.ts`) — Esc / Tab wrap.
- **Markup** (`JobDrawer.test.tsx`) — INPUTS markup is the frontmatter label, not the
  agent name; chart NOW badge and autonomy toggle; chart event name is stable.
- **Not automatable here:** 320ms slide, 1440px side-by-side vs the Account Enrichment
  frame, glass blur, monochrome focus ring. Those are `fidelity-qa-reviewer`'s gate.

## Deliberately not done

- **`Take it ↓` zip download.** `GET /api/agents/:slug/download` is not in the API
  contract. The button is disabled with a tooltip that says so, rather than linking at a
  404. (`DOWNLOAD_ROUTE_AGREED = false` in `data/client.ts`.)
- **A fake ▶ that does nothing.** M2 is read-only for the runner. The control is wired
  to `POST /api/run` and disabled while the runner is unreachable or unconfigured.
- **Mounting `<ChartPage />`.** `chart-matrix-engineer` owns that. Chart routes mount
  `<DrawerHost />` next to the existing `ViewMount` so `More detail →` has a listener
  the moment the matrix is wired; do not drop the host.
- **The department canvas under the map drawer.** `map-galaxy-engineer` owns §2.2. The
  agent route keeps their `ViewMount` as a sibling of `JobDrawerRoute`.
- **Writing `tier` from the chart toggle.** That is a frontmatter git commit, which is
  the runner's path (ADR-002). The toggle is a disabled readout.
- **Per-sub-skill descriptions on SKILLS cards.** `breaks_into` entries are leaf files
  (frontmatter-schema invariant 4) and do not carry their own `description`. The card
  collapses that line.
- **The M8 RTL screenshot pass.** Layout is logical from the start; visual QA is
  `rtl-arabic-pdpl-specialist`'s.
- **Virtualizing past the 2k/400 window with a real list virtualizer.** The reducer
  drops and counts; a windowing library would be a component-library-shaped dependency
  Part V forbids.
- **Provenance badges on MAP nodes and CHART job cards.** BOARD puts both explicitly out
  of M15 — *"shell and drawer only — one vertical slice, not four half-slices"*. The
  primitive already takes `size="sm"` for exactly that, and the mapping they need is
  `data/provenance.ts`, which is exported for them rather than duplicated.
- **`fork` / `drifted` / `orphaned`.** Three of the badge's five states are unreachable and
  nothing here pretends otherwise. `forked_from` **is** in the schema now that ADR-014 is
  accepted, and that is still not enough: all three are states of a *comparison* against
  the parent's current digest (cascade §4.3), and §11 records that nothing computes one —
  *"nothing computes a digest comparison — not built."* They arrive through the same
  function when the resolver does.
- ~~**Inventing `AgentDetail.sourceRef`.**~~ **Done — and the gap between the two is the
  finding.** The field was requested rather than invented, `runner-engineer` shipped it
  inside the same milestone, and this line went on saying "until it lands" for the rest of
  M15 while the drawer read the run stream only. *Deferring a consumer is legitimate; the
  defect is that nothing watched for the producer.* The consumer is now wired
  (REQ-DRW-36) and the deferral is struck rather than deleted, so the shape stays visible.
- **Exporting the metrics route table.** `/metrics/runs` is still a local suffix here
  (decision 12) because it is `observability-engineer`'s to export and not mine to add to
  `@agnetos/contracts`. Requested, not built around.
- **Driving the `known` provenance branch from a *running* cascade.** Narrowed, not closed.
  The branch is now reachable without a run — `AgentDetail.sourceRef` is produced by
  `resolveForDispatch` and consumed here — and `JobDrawer.test.tsx` drives it end to end
  through the drawer's own fetch. What is still untested by anything in this repo is the
  **round trip against a live runner**: `runnerConfigured: false`, zero runs have ever
  executed, and the runner's own resolution has never been observed from a browser. So the
  claim this slice can make is *"the drawer renders whatever `resolveForDispatch` says"*,
  not *"the layer on your screen is the layer on disk"*. The second needs a runner that runs.
- **A per-project `Take it ↓`.** `downloadUrl` now builds
  `/api/p/:project/agents/:slug/download`, which is still not in the contract; the button
  stays disabled with the same honest tooltip (`DOWNLOAD_ROUTE_AGREED = false`).
