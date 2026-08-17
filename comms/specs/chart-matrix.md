# Spec — CHART, the AI rollout matrix

> The implementation spec for §2.6 of `skilltree-clone-spec.md`.
> Checked by `npm run validate:coverage`.

## Owner

`chart-matrix-engineer`

## Spec sections covered

§2.6 — CHART, the AI rollout matrix (items 1–6, plus the closing architectural line).

Boundary, and the reason it is worded without section numbers: the drawer *body* that
item 5 opens belongs to `drawer-engineer` per BOARD.md, and CHART owns only the selection
that opens it. `check-spec-coverage.mjs` treats every `§n.n` appearing under this heading
as an ownership claim, so naming their sections here would claim their work. The precise
citations live in Decision 9 and in "Interfaces we expose".

## Decisions

1. **The tab is a rollout planning board, not an org chart.** §2.6 opens by saying their
   org-chart tab "is actually a rollout planning board (the deployment-order playbook,
   visualized)". Everything below follows from reading it that way: rows climb in
   autonomy, columns run in deployment order, and an empty intersection is a finding.

2. **One data source, three views.** §2.6 closes on it, Part IV constraint 4 enforces it.
   `src/chart/**` holds a *projection* type (`ChartAgent`) whose every field is a
   frontmatter field, and nothing else. There is no chart-specific agent record, no
   per-view metadata file, no cached copy. A field the grid needs that frontmatter lacks
   is a `decision-request` to `agent-library-curator`, never a local addition.

3. **Phase progress semantics (the 4-segment dashes).** §2.6.3 specifies the dashes but
   not what fills them. They show the phase's **mean autonomy**: `human-led` 0,
   `assisted` 0.5, `autonomous` 1, averaged over the jobs in that phase and multiplied by
   4. That is the only reading that makes the dashes a *rollout* measure on a rollout
   board — and it is derived, so it cannot go stale. A phase with no jobs shows four
   empty dashes, not a hidden header.

4. **Tier dots = phase ordinal.** §2.6.4 calls them "tier dots" and draws four of them
   (`●●○○`) against a phase tag, while there are only three tiers. Four dots, four
   phases: they are filled to the job's phase ordinal, so `2 · Capture` reads `●●○○`.
   Documented here because the spec text and the glyph count disagree, and this is the
   reading that is internally consistent.

5. **The stat line drops clauses that would be untrue.** §2.6.2's sentence ends "the rest
   stay human", but their own example (18 autonomous + 5 assisted = 23) leaves no rest.
   With zero human-led jobs the clause is omitted; likewise "· N assisted" at zero.
   Part VII.3 outranks sentence fidelity: a stat line that says something false is worse
   than one that says less.

6. **Zero data ink.** §2.6 has no status surface, so CHART renders no colour at all —
   tier legend chips are outline + glyph + label (§1.3). If a `status: live` indicator is
   ever added here it will be the only colour on the view, and it will be an ADR.

7. **CHART owns the contents of the existing chart routes; the shell owns their shape.**
   The routing skeleton is `src/app/(views)/**` (§2.0). CHART replaces the `ViewMount`
   placeholders in `chart/page.tsx` and `chart/[department]/page.tsx` with `<ChartPage />`
   (via a thin `ChartRoute` that keeps the tab bar and the department segment in sync).
   New route segments are still the shell's to add — and M15 added one: every view now
   lives under `p/[project]/` (`Plan §9`), so those files are `(views)/p/[project]/chart/`.
   That is a re-scoping of the routes, not a rename CHART made; Decision 10 is what it
   obliges of us.

8. **An unstaffed department gets an empty state, not an empty grid.** Twelve hatch
   blocks say "twelve deliberate gaps"; an unmapped department says "nobody has been here
   yet". Different statements, different screens.

9. **Where CHART stops and the drawer starts.** §2.6.5's `More detail →` is ours; the
   panel it opens is not. BOARD.md gives `drawer-engineer` §2.3 and the §2.6.5 panel, so
   CHART emits `openDrawer(agentSlug, {side:'right'})` and renders nothing further.
   Their `<DrawerHost />` is mounted as a **sibling** on the chart routes so the event
   has a listener; that is their component, not a second drawer in `src/chart`.

10. **CHART never spells the project segment itself.** M15 put a project in every view URL,
    which means CHART now builds links that contain something CHART does not own. Two
    consequences, both asserted below. (a) `ChartRoute` reads the project from `useShell()`
    and builds every destination through the shell's `withProject`, so a route built by the
    tab bar cannot drift from one built by the breadcrumb or the project switcher — one
    place knows the segment's shape. (b) An unknown `:department` redirects to *its own*
    project's chart, never to a bare `/chart`: a bare one drops the project and lands on
    the legacy resolver, which would then have to pick a project — the ambient default the
    whole axis exists to remove. This is behaviour, not path bookkeeping, which is why it
    is REQ-CHT-43/44 and not a footnote on REQ-CHT-42.

## Coverage

| ID | Spec § | Requirement | Implemented in | Verified by |
|---|---|---|---|---|
| REQ-CHT-01 | §2.6.1 | Department tab bar renders all seven departments, imported from `packages/contracts` (ADR-001) — no local list exists anywhere under `src/chart` | `apps/web/src/chart/components/DepartmentTabs.tsx` · `apps/web/src/chart/data/contracts.ts` | `apps/web/src/chart/components/ChartView.test.tsx` |
| REQ-CHT-02 | §2.6.1 | Tabs appear in ADR-001 order, left to right | `apps/web/src/chart/components/ChartView.tsx` | `apps/web/src/chart/components/ChartView.test.tsx` |
| REQ-CHT-03 | §2.6.1 | Active tab is marked by a 1px ivory underline; inactive tabs are `--ink-2` | `apps/web/src/chart/components/DepartmentTabs.tsx` | `apps/web/src/chart/components/ChartView.test.tsx` |
| REQ-CHT-04 | §2.6.1 | Tab bar is a real `tablist`: roving tabindex, ← → move between departments | `apps/web/src/chart/components/DepartmentTabs.tsx` | manual — see Test plan |
| REQ-CHT-05 | §2.6.1 | A department with no agents is dimmed, never hidden — the rollout gap is the information | `apps/web/src/chart/components/DepartmentTabs.tsx` | manual — see Test plan |
| REQ-CHT-06 | §2.6.2 | Title reads `<Department> · the AI rollout` | `apps/web/src/chart/components/TitleBlock.tsx` | `apps/web/src/chart/components/ChartView.test.tsx` |
| REQ-CHT-07 | §2.6.2 | The accent word "rollout" is Instrument Serif italic (§1.4 brand signature); the rest is Plus Jakarta Sans | `apps/web/src/chart/components/TitleBlock.tsx` | manual — visual, see Test plan |
| REQ-CHT-08 | §2.6.2 | Stat line is computed from frontmatter `tier` counts — feeding a different agent set changes every numeral | `apps/web/src/chart/model/stats.ts` · `apps/web/src/chart/components/StatLine.tsx` | `apps/web/src/chart/model/stats.test.ts` · `apps/web/src/chart/components/StatLine.test.tsx` |
| REQ-CHT-09 | §2.6.2 | Stat-line numerals are bold ivory and `tabular-nums`; the rest is `--ivory-2` | `apps/web/src/chart/components/StatLine.tsx` | `apps/web/src/chart/components/StatLine.test.tsx` |
| REQ-CHT-10 | §2.6.2 | A clause whose count is zero is dropped, not zero-filled ("0 assisted" never renders) | `apps/web/src/chart/model/stats.ts` | `apps/web/src/chart/model/stats.test.ts` |
| REQ-CHT-11 | §2.6.2 | Three tier legend chips, right of the title: outline + glyph + label, no fill and no hue | `apps/web/src/chart/components/TierLegend.tsx` | `apps/web/src/chart/components/ChartView.test.tsx` |
| REQ-CHT-12 | §2.6.2 | Title block order: eyebrow → title → stat line on the left, legend on the right | `apps/web/src/chart/components/TitleBlock.tsx` | `apps/web/src/chart/components/ChartView.test.tsx` |
| REQ-CHT-13 | §2.6.3 | The matrix is exactly 3 tiers × 4 phases, values taken from the frontmatter unions | `apps/web/src/chart/model/matrix.ts` · `apps/web/src/chart/model/taxonomy.ts` | `apps/web/src/chart/model/matrix.test.ts` |
| REQ-CHT-14 | §2.6.3 | Rows carry the three §2.6.3 labels in full: `Human-led — a person drives it`, `Human-assisted — AI drafts, a human approves`, `Fully autonomous — AI runs it unattended` | `apps/web/src/chart/model/taxonomy.ts` · `apps/web/src/chart/components/MatrixHeaders.tsx` | `apps/web/src/chart/components/Matrix.test.tsx` |
| REQ-CHT-15 | §2.6.3 | Each row header carries an icon square and a jobs-count pill derived from the agent set | `apps/web/src/chart/components/MatrixHeaders.tsx` · `apps/web/src/chart/model/matrix.ts` | `apps/web/src/chart/model/matrix.test.ts` · `apps/web/src/chart/components/Matrix.test.tsx` |
| REQ-CHT-16 | §2.6.3 | Columns carry the four §2.6.3 phase labels in full (`1 Foundation — Data + the company brain` … `4 Orchestrate — Agents, monitoring, loops`) | `apps/web/src/chart/model/taxonomy.ts` · `apps/web/src/chart/components/MatrixHeaders.tsx` | `apps/web/src/chart/components/Matrix.test.tsx` |
| REQ-CHT-17 | §2.6.3 | Every column header renders 4-segment progress dashes | `apps/web/src/chart/components/ProgressDashes.tsx` | `apps/web/src/chart/components/Matrix.test.tsx` |
| REQ-CHT-18 | §2.6.3 | Dash fill is derived from the phase's autonomy mix (Decision 3); an unstarted phase shows zero filled | `apps/web/src/chart/model/matrix.ts` | `apps/web/src/chart/model/matrix.test.ts` |
| REQ-CHT-19 | §2.6.3 | Grid semantics are real: `role=grid` / `row` / `rowheader` / `columnheader` / `gridcell`, 12 cells | `apps/web/src/chart/components/Matrix.tsx` · `apps/web/src/chart/components/MatrixCell.tsx` | `apps/web/src/chart/components/Matrix.test.tsx` |
| REQ-CHT-20 | §2.6.3 | Cards inside a cell are ordered by name, so the board does not reshuffle between loads | `apps/web/src/chart/model/matrix.ts` | `apps/web/src/chart/model/matrix.test.ts` |
| REQ-CHT-21 | §2.6.4 | Job card leads with an icon square resolved from frontmatter `icon` via lucide; an unknown name degrades to a neutral glyph | `apps/web/src/chart/components/JobIcon.tsx` | `apps/web/src/chart/components/Matrix.test.tsx` |
| REQ-CHT-22 | §2.6.4 | Job name is 13px / 600 | `apps/web/src/chart/components/JobCard.tsx` | `apps/web/src/chart/components/Matrix.test.tsx` |
| REQ-CHT-23 | §2.6.4 | Card carries the phase tag in `N · Label` form (`1 · Foundation`) | `apps/web/src/chart/model/taxonomy.ts` · `apps/web/src/chart/components/JobCard.tsx` | `apps/web/src/chart/components/Matrix.test.tsx` |
| REQ-CHT-24 | §2.6.4 | Four tier dots `●●○○` beside the tag, filled to the job's phase ordinal (Decision 4) | `apps/web/src/chart/components/PhaseDots.tsx` | `apps/web/src/chart/components/Matrix.test.tsx` |
| REQ-CHT-25 | §2.6.4 | An expand chevron sits at the card's trailing edge and rotates when open | `apps/web/src/chart/components/JobCard.tsx` | `apps/web/src/chart/components/Matrix.test.tsx` |
| REQ-CHT-26 | §2.6.4 | Hover raises the card to `--card-2` with a `--line-2` border | `apps/web/src/chart/components/JobCard.tsx` | `apps/web/src/chart/components/Matrix.test.tsx` |
| REQ-CHT-27 | §2.6.4 | Expanded card shows inline description + SKILLS chips (from `breaks_into`) + `More detail →`; collapsed shows none of it | `apps/web/src/chart/components/JobCard.tsx` | `apps/web/src/chart/components/Matrix.test.tsx` |
| REQ-CHT-28 | §2.6.4 | The expand reveal is the §1.6 panel motion (500ms `cubic-bezier(.2,.7,.2,1)`) taken from `primitives/motion.ts`, and collapses to the end state under `prefers-reduced-motion` | `apps/web/src/chart/ui.ts` · `apps/web/src/chart/components/ChartStyles.tsx` | manual — see Test plan |
| REQ-CHT-29 | §2.6.5 | `More detail →` is a real `<button>`, keyboard-operable, not a click-handling div | `apps/web/src/chart/components/JobCard.tsx` | `apps/web/src/chart/components/Matrix.test.tsx` |
| REQ-CHT-30 | §2.6.5 | Activating it emits `openDrawer(agentSlug, {side:'right'})`; CHART contains no drawer of its own | `apps/web/src/chart/events.ts` · `apps/web/src/chart/components/Matrix.tsx` | `apps/web/src/chart/events.test.ts` |
| REQ-CHT-31 | §2.6.6 | An empty cell renders a `repeating-linear-gradient` at 45° in `var(--line)` — no literal colour | `apps/web/src/chart/model/hatch.ts` · `apps/web/src/chart/components/EmptyCell.tsx` | `apps/web/src/chart/components/EmptyCell.test.tsx` |
| REQ-CHT-32 | §2.6.6 | Every empty tier × phase is hatched and no occupied cell is — hatch count equals empty-cell count | `apps/web/src/chart/components/MatrixCell.tsx` | `apps/web/src/chart/components/EmptyCell.test.tsx` · `apps/web/src/chart/components/Matrix.test.tsx` |
| REQ-CHT-33 | §2.6.6 | An empty cell stays focusable and announces "No jobs yet · <tier> · <phase>" — it is information, not a gap | `apps/web/src/chart/components/EmptyCell.tsx` | `apps/web/src/chart/components/EmptyCell.test.tsx` |
| REQ-CHT-34 | §2.6.3 | Arrow keys move focus between cells; ArrowDown walks the stacked cards in a cell before dropping a tier | `apps/web/src/chart/model/keyboard.ts` | `apps/web/src/chart/model/keyboard.test.ts` |
| REQ-CHT-35 | §2.6.4 | Enter and Space expand the focused card (native button semantics, `aria-expanded` reflects state) | `apps/web/src/chart/components/JobCard.tsx` · `apps/web/src/chart/model/keyboard.ts` | `apps/web/src/chart/model/keyboard.test.ts` |
| REQ-CHT-36 | §2.6.3 | Focus holds at the grid edges instead of wrapping | `apps/web/src/chart/model/keyboard.ts` | `apps/web/src/chart/model/keyboard.test.ts` |
| REQ-CHT-37 | §2.6.3 | The grid never steals focus: `.focus()` runs only for keyboard-initiated moves | `apps/web/src/chart/components/Matrix.tsx` | manual — see Test plan |
| REQ-CHT-38 | §2.6 | CHART holds no copy of agent data: every rendered value comes from the frontmatter projection, and fixtures live only under `__fixtures__/` | `apps/web/src/chart/types.ts` · `apps/web/src/chart/data/agents.ts` · `apps/web/src/chart/data/fromDisk.ts` · `apps/web/src/chart/data/parseSkill.ts` | `apps/web/src/chart/components/ChartView.test.tsx` · `apps/web/src/chart/data/parseSkill.test.ts` |
| REQ-CHT-39 | §2.6 | A department with no agents shows an honest empty state instead of a fabricated grid | `apps/web/src/chart/components/ChartEmptyState.tsx` | `apps/web/src/chart/components/ChartView.test.tsx` |
| REQ-CHT-40 | §2.6 | If the agent library cannot be read, the view says so rather than rendering an empty rollout | `apps/web/src/chart/data/agents.ts` · `apps/web/src/chart/components/ChartEmptyState.tsx` | `apps/web/src/chart/components/ChartView.test.tsx` |
| REQ-CHT-41 | §2.6 | No literal colour anywhere in `src/chart` — chrome is monochrome and this view carries no data ink | `apps/web/src/chart/components/StatLine.tsx` · `apps/web/src/chart/components/EmptyCell.tsx` | `apps/web/src/chart/components/Matrix.test.tsx` |
| REQ-CHT-42 | §2.6 | `/p/:project/chart` and `/p/:project/chart/:department` render `<ChartPage />` from `src/chart`, not `ViewMount` | `apps/web/src/app/(views)/p/[project]/chart/page.tsx` · `apps/web/src/app/(views)/p/[project]/chart/[department]/page.tsx` · `apps/web/src/app/(views)/p/[project]/chart/ChartRoute.tsx` · `apps/web/src/app/(views)/p/[project]/chart/mount.tsx` · `apps/web/src/chart/ChartPage.tsx` | manual — open `/p/:project/chart` |
| REQ-CHT-43 | §2.6 | A `:department` that is not in the ADR-001 enum redirects to that same project's chart (`/p/:project/chart`) — the project segment survives the redirect, so no chart route can hand a project choice back to the legacy resolver (Decision 10b) | `apps/web/src/app/(views)/p/[project]/chart/[department]/page.tsx` | manual — see Test plan |
| REQ-CHT-44 | §2.6 | CHART writes no project prefix of its own: `ChartRoute` takes the project from `useShell()` and every tab destination is built with the shell's `withProject` — no `/p/` literal exists under `src/chart` or in the chart route adapter (Decision 10a) | `apps/web/src/app/(views)/p/[project]/chart/ChartRoute.tsx` | `apps/web/src/components/shell/route.test.ts` (the helper) · manual — see Test plan (our use of it) |

## Interfaces we expose

From `apps/web/src/chart` (`index.ts` is the whole public surface):

- `<ChartPage />` — mountable page; optional `agents` prop skips the client fetch,
  `department` / `onDepartmentChange` make it routable by the shell. `/p/:project/chart`
  and `/p/:project/chart/:department` mount it via `ChartRoute` (URL sync) and `ChartMount`
  (disk projection of `agents/**/SKILL.md`). `<ChartPage />` itself takes no project prop —
  it is project-agnostic, and the segment is handled entirely in the route adapter.
- `<ChartView />` — the presentational view, for anyone who already has agents in hand.
- `openDrawer(agentSlug, {side, handler})`, `OPEN_DRAWER_EVENT`
  (`'commandcenter:open-drawer'`), `OpenDrawerDetail` — the §2.6.5 selection contract.
- `TIER_ROWS` / `PHASE_COLUMNS` — the §2.6 axis labels, if MAP or DASHBOARDS want the
  same words for tier and phase.
- `buildMatrix`, `deriveStats`, `statLineText`, `toChartAgent` — pure, no React.

Everything else under `src/chart` is private.

## Interfaces we consume

| What | From | Contract |
|---|---|---|
| `DEPARTMENTS` (ordered), `Tier`, `Phase`, `DepartmentSlug` | `packages/contracts` | `comms/decisions/ADR-001-department-taxonomy.md`, `comms/contracts/frontmatter-schema.md` |
| Agent frontmatter fields `name, description, department, icon, tier, phase, breaks_into` | `agent-library-curator` | `comms/contracts/frontmatter-schema.md` |
| `GET /api/agents` (list projection) | `runner-engineer` | `comms/contracts/api-contracts.md` — **requested, not yet in the contract** |
| `Pill`, `Chip`, `Eyebrow`, `DURATION`, `EASE` | `design-system-guardian` | `comms/contracts/design-tokens.md` |
| The right drawer | `drawer-engineer` | §2.6.5 — `openDrawer` event; their `<DrawerHost />` is a sibling on the chart routes, not a chart component |
| `useShell()`, `withProject` — the project segment's shape | `shell-navigation-engineer` | `Plan §9` (M15) — consumed **only** in `(views)/p/[project]/chart/ChartRoute.tsx`, never inside `src/chart` |

The first five couplings are funnelled through two files, `src/chart/data/contracts.ts` and
`src/chart/ui.ts`, so a rename upstream is a one-file change here. The sixth is deliberately
outside both: `src/chart` knows nothing about projects, so the project axis touches exactly
one adapter file and no component.

## Test plan

- **Pure model** (`model/*.test.ts`) — matrix construction, tier counts, phase progress,
  stat derivation, keyboard movement. No React, no DOM, no imports outside `src/chart`;
  these run even while the rest of the app is being scaffolded.
- **Markup** (`components/*.test.tsx`) — `renderToStaticMarkup`, no jsdom. This is where
  the hatch, the labels, the derived pills and dashes, the roving tabindex and the
  monochrome rule are asserted against real output.
- **Not automatable here, and how it gets checked instead:**
  - REQ-CHT-04/05 (tab arrow keys, dimmed department) and REQ-CHT-37 (focus not stolen)
    need real focus and event dispatch — checked in `cc-fidelity-check`'s keyboard pass
    once the app scaffold lands, and by `fidelity-qa-reviewer`'s a11y sweep.
  - REQ-CHT-07 (Instrument Serif italic) and REQ-CHT-28 (500ms reveal, reduced motion)
    are visual — the 1440px side-by-side and a `prefers-reduced-motion` toggle.
  - REQ-CHT-42 — `/p/:project/chart` mounts `<ChartPage />`; confirmed when the matrix (not
    `ViewMount`) is the thing on screen.
  - REQ-CHT-43/44 (project segment) — the redirect is a server-component `redirect()` and
    the tab push is a `useRouter()` call, so both need a running app rather than
    `renderToStaticMarkup`. Checked by walking `/p/:project/chart/not-a-department` (lands
    on the same project's chart, URL still carries `:project`) and clicking a tab in a
    non-default project (URL keeps that project). Both belong in `cc-fidelity-check`'s
    navigation pass alongside the shell's own project-axis checks, since the failure mode
    they share — a link silently reverting to the default project — is one an isolated
    chart test cannot see.
- **The two tests the brief names explicitly:** stat-line derivation lives in
  `model/stats.test.ts` + `components/StatLine.test.tsx` (fixtures in, counts asserted);
  hatch-on-every-empty-cell lives in `components/EmptyCell.test.tsx` (walks the real
  matrix) + `components/Matrix.test.tsx` (hatch count == empty-cell count).

## Deliberately not done

- **The §2.6.5 drawer body.** `drawer-engineer` owns it. Building a "temporary" chart
  drawer would have created a second copy of the agent projection — the exact thing
  Part IV forbids — so `More detail →` emits and stops.
- **`GET /api/agents` list.** Requested of `runner-engineer`; the page currently projects
  `agents/**/SKILL.md` from disk (`/agents` in Docker, repo-relative in `next dev`) so the
  matrix is real numbers rather than a 404 empty state. When the list endpoint lands,
  `loadChartAgents` is the client fallback and the disk read can go.
- **Search/filter inside CHART.** §2.0 puts search in the shell and says result click =
  fly-to-node. CHART will consume that selection when the shell exposes it; it is not
  building a second search box.
- **`status: live` indicators on job cards.** §2.6 does not show them, and adding the
  first colour to this view is an ADR, not a component decision (Decision 6).
- **Drag-to-replan.** A rollout board invites dragging a card to another tier, and that
  would write frontmatter. Writes to `agents/**` belong to the runner's git path
  (§3.2 + ADR-002); a UI that edits the source of truth needs its own ADR and an audit
  trail first.
- **Per-department phase progress history.** The dashes show current state, not a trend.
  Trends need stored snapshots, which is Langfuse/Postgres territory (§3.5).
- **`lucide-react` tree-shaking.** `JobIcon` resolves icons through the `icons` map, which
  pulls the whole set. Correct and dynamic today; if the bundle budget bites at M8, swap
  to `dynamicIconImports` behind the same component.
- **RTL.** `rtl-arabic-pdpl-specialist` owns the pass (§1.4, M8). The grid is built with
  logical flow and no hardcoded left/right offsets so the flip is cheap, but it has not
  been verified under `dir="rtl"`.
