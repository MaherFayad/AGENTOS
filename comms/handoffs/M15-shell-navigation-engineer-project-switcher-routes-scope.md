---
agent: shell-navigation-engineer
milestone: M15
spec: §2.0 (shell, search, breadcrumb, cost ticker), §3.6 (PWA) · `Plan §9`, `Plan §23.5`, `Plan §23.10`, `Plan §23.11`, `Plan §23.12` P1
created: 2026-08-17T00:47
status: ready-for-review
---

# The project axis reaches the chrome — switcher, routes, breadcrumb, scoped search and ticker

`Plan §23.12`'s P1 row. Four things, one idea: **a URL says which project it is about, and
nothing in the shell substitutes a value when it does not.**

---

## Where the switcher sits, and why the centre line did not move

Top-left, before the fullscreen toggle, exactly as `Plan §23.10` places it. It joins the
existing left cluster **inside** `TopBar`'s `grid-cols-[1fr_auto_1fr]`.

That grid is the load-bearing mechanism and it is untouched: the centre column is `auto`,
so it is sized by the segmented control alone, and the two `1fr` columns split the
remainder **symmetrically**. Weight added to the left cluster moves the left cluster and
nothing else — the tabs stay on the true centre line of the viewport. It is the same
property that let SESSIONS become a fourth tab without disturbing §2.0, used a second time.

**No tab was added and none should be.** `Plan §23.5` measures four wide-tracked labels at
~400px and concludes six will not fit; the answer is two-level navigation, with THREADS and
CALENDAR moving to the right cluster in P2. The switcher spends none of the centre column's
budget because it is not in the centre column and is not a tab. I did not pre-build the
split.

**What gives at 375px, in a stated order.** Three controls in the left cluster is one more
than the row was designed for:

- **The fullscreen toggle hides below `sm`.** It is a desktop affordance; the Fullscreen
  API does not exist on iOS Safari at all, so the control already rendered nothing there;
  and an installed PWA runs in `standalone` display mode where a fullscreen button toggles
  nothing. It returns at `sm`, so the 1440px frame is unchanged.
- **The search pill flexes** rather than stepping through three hardcoded widths — it takes
  whatever the cluster has left, capped at its old 150px, and is the spec's fixed 220px
  from `sm` up. A fourth magic number would have been a fourth thing to re-measure next
  time; now the arithmetic is nobody's job.
- **Neither the switcher nor search is ever dropped.** One answers "which project am I in";
  the other is the keyboard path onto a canvas. A phone needs both.

---

## What happens to routes and deep links

```
/map/sales/account-enrichment   →   /p/agentos/map/sales/account-enrichment
/chart/sales                    →   /p/agentos/chart/sales
/dashboards/pipeline            →   /p/agentos/dashboards/pipeline
/sessions/abc123                →   /p/agentos/sessions/abc123
```

The shape is copied from `packages/contracts`' `/api/p/:project/…` rather than invented,
and `splitProject` consumes the segment only when it passes the same `isProjectSlug`
predicate the runner applies — so `/p/all`, `/p/api` and `/p/p` are not projects in the
browser either, for the same reason they are not on the API.

**Old links keep working, through an ask rather than a default.**
`app/(views)/[...legacy]/page.tsx` catches anything not starting with `/p/`. A catch-all is
the App Router's lowest-priority match, so the four real trees and `/offline` win first —
which is why compatibility costs one file instead of a duplicate of the whole tree. The
resolver asks `GET /api/projects` which project the coordinator mounts, then `replace`s the
URL to name it.

**Why that is not an ambient default by another name**, in four checkable clauses:

1. nothing is served in that state — no view is mounted under an unnamed project;
2. the slug comes from the **coordinator's own report**, not a cookie, a header, a build-time
   env var, or "the first one in the list";
3. it is written into the URL before any data is drawn, so the next thing the reader sees is
   a link they can paste to someone else;
4. **when the coordinator cannot be asked, nothing is picked.** The screen says the link
   does not name a project and that we could not find out which one to use.

Clause 4 is the one that makes the other three a design rather than a rationalisation, and
it is asserted by a test.

**Switching project keeps the view and the department; it drops the agent, the panel and
the session.** That is `project-scoping.md` invariant 6 turned into a navigation rule — the
shape is shared, the roster is not — plus ADR-014 §2: the same `(department, slug)` in two
projects is a *different agent* with a different history and a different capability
ceiling. Carrying the leaf across would either 404 or, worse, land on a same-named
different agent, which is §21 risk 9's bug class with no error message.

**Two callers stay unscoped on purpose.** `public/manifest.webmanifest`'s `start_url` and
shortcuts, and push deep links. The manifest is a static file baked into the web image, so
naming a project in it would name the same project on every deployment — a configured value
read as an observed one, in the artifact that ships to a phone's home screen. Both land on
the resolver, which is correct.

---

## What a one-project install honestly looks like

There is one project, zero runs have ever executed, and the runner process on `:8787`
predates `GET /api/projects`. The chrome says so rather than implying otherwise:

| surface | what it shows today | what it would show with a real second project |
|---|---|---|
| switcher pill | `agentos ?` — the slug from the URL, with a visible unconfirmed mark | the coordinator's display name, no mark |
| switcher panel | *"One project is mounted. Switching has nothing to switch to yet, so nothing here shows that project scoping works — only that it exists."* | two rows, `mounted` / `elsewhere` |
| isolation line | `scopeEnforced: false` → *"the runner reports that its database connection bypasses row-level security"*; `null` → *"the runner did not say"* | unchanged — three values, three sentences, never collapsed to two |
| breadcrumb head | `agentos ?` | `AgentOS` |
| cost ticker | `no cost data` + *"this runner doesn't answer today's spend for this project yet"* | the five readings, unqualified |
| legacy `/map` | *"This link does not name a project"* | redirect to `/p/<mounted>/map` |

Three rules the slice is built around, each of which had a wrong version I wrote first:

1. **`unknown` is not `zero`, and the project axis adds a sixth question rather than a sixth
   state.** *This project has spent nothing* versus *we cannot read this project's spend*.
   No path through `CostTicker` draws `$0.00` unless the ledger said so **for the project
   the URL names**; there is a test whose only job is that sentence.
2. **A configured value is not an observed one.** A project is shown as *present* because
   the coordinator listed it, and the pill carries a visible `?` when nothing has. The
   switcher's `data-project-confirmed` attribute exists so that can be asserted without
   matching copy.
3. **`scopeEnforced` is tri-state and stays tri-state.** `false` and `null` are different
   sentences. Collapsing them would turn "nobody checked" into "checked and fine".

---

## The fallback I built, read the contract, and deleted

Worth recording because it is the sharpest thing that happened in this slice.

My first cut had every scoped read (`cost/today`, `graph`, `panels`) fall back to the
pre-project path on a 404, with the reading labelled `coordinator` and the pill rendering
`$12.40 today · all projects`. Then I read `packages/contracts/src/api.ts`:

> **`LEGACY_COST_TICKER_PATH`** — *"It is not a fallback and must not be used as one: the
> ticker is chrome and must not error out on an unknown value, but a missing project
> segment is a client fault with a one-line fix, and answering it with a plausible
> `usd: null` would hide the migration from the only people who can finish it."*

So the mechanism is gone — `useEndpoint`'s `fallbackUrl` and its `via` discriminator with
it. **The shell never requests a path in `LEGACY_UNSCOPED_PATHS` or
`LEGACY_COST_TICKER_PATH`, in any state**, and a test asserts the 400 path is not requested
even when the scoped route 404s and a real number is sitting one path over.

The result is stronger than the labelled version, and the reason generalises: **there is no
state in which the shell shows a real number about the wrong project.** An impossible state
beats a correct caveat. `useEndpoint` gained `url: string | null` instead — `null` means
*there is nothing to ask for*, with its own sentence.

---

## What exists now

**New**

- `apps/web/src/components/shell/ProjectSwitcher.tsx` — the pill, the picker, the honest
  footer. `⌘K`/`Ctrl+K` opens from anywhere; the list takes focus and carries
  `aria-activedescendant`; `↓ ↑ Home End` walk, `Enter`/`Space` select, `Esc` closes and
  returns focus to the trigger.
- `apps/web/src/components/shell/useProjects.ts` — `GET /api/projects`, `ProjectScope`,
  the confirmed/unconfirmed distinction.
- `apps/web/src/components/shell/useProjectHref.ts` — `useProjectHref()` /
  `useProjectSegment()`, the context-free helper every view builds URLs with.
- `apps/web/src/components/shell/LegacyRouteResolver.tsx` — the unscoped-URL path.
- `apps/web/src/app/(views)/[...legacy]/page.tsx` — one file, not a duplicate tree.
- `apps/web/src/components/shell/ProjectSwitcher.test.tsx` — 14 tests.

**Moved** — `(views)/{map,chart,dashboards,sessions}` → `(views)/p/[project]/…` (10 files).

**Changed** — `route.ts` (`project` on `ShellRoute`, `splitProject`, `withProject`,
`projectPrefix`, `switchProjectHref`, `projectTrail`, project-aware `viewHref`/
`breadcrumbFor`) · `ShellContext.tsx` (`project`, `projects`) · `TopBar.tsx` ·
`BreadcrumbStrip.tsx` (the trail) · `CostTicker.tsx` (`COST_TICKER_ROUTE`,
`data-cost-scope`) · `useSearchIndex.ts` (scoped `RUNNER_ROUTES` paths, `SearchScope`,
`projectApiUrl`, `NO_PROJECT_SENTENCE`) · `SearchPill.tsx` (flex width, scope footer, two
RTL fixes) · `ViewTabs.tsx` · `NewSessionAction.tsx` (`NEW_SESSION_HREF` → `newSessionHref(project)`).

**Other owners' files, one line each** — `MapView.tsx`, `Carousel.tsx`,
`DashboardDetail.tsx`, `SessionsTab.tsx`, `SessionView.tsx`, `JobDrawerRoute.tsx`,
`ChartRoute.tsx`, `chart/[department]/page.tsx`, and `usePathname` added to
`MapView.test.tsx`'s mock. FYI filed to `_all`.

## How to use it

```ts
import { useProjectHref } from '@/components/shell/useProjectHref';
const href = useProjectHref();
router.push(href(`/map/${department}`));      // → /p/agentos/map/sales

import { withProject, switchProjectHref } from '@/components/shell';
const { project } = useShell();               // ProjectScope — what the coordinator confirmed
const { project: slug } = useShell().route;   // string | null — what the URL says
```

Read `ShellState.project` when the answer will be **displayed**; `route.project` is what the
URL says, `project` is that *plus what the coordinator was willing to confirm*, and those
are different claims.

## Contracts touched

`comms/contracts/project-scoping.md` — **consumed, not edited.** §5.1 Q1 (path segment,
no default), invariant 6 (shape shared, roster not), §6 (what cannot be validated).
`comms/contracts/agent-cascade.md` §2 (`agent_ref`, why the leaf is dropped on a switch).
`packages/contracts/src/{project,api}.ts` — `isProjectSlug`, `projectPath`, `RUNNER_ROUTES`,
`COST_TICKER_ROUTE`, `ProjectSummary`, `ProjectStatus`, all imported rather than restated.
**No ADR:** implementing a contract that is already written is compliance, not a decision.
No new runtime dependency (`Plan §23.11` rule 4 — `apps/web` still ships one).

---

## Acceptance criteria — structural versus empirical

Split the way `project-scoping.md` §6 splits it, because the difference is the whole point.

### Structural — provable now, and proved

1. Every view route carries `/p/:project`; `parseShellRoute` round-trips it. ✅
2. A URL with no project segment parses to `null` and **no pure function substitutes a
   value**. ✅
3. Reserved slugs (`p`, `all`, `api`) and non-slugs are refused in the browser as on the API. ✅
4. Every href the shell generates — tabs, breadcrumb, search results, drawer close, chart
   tabs, carousel, sessions, `+ New session` — carries the current project. ✅
5. Switching project preserves view + department and drops agent/panel/session. ✅
6. The legacy resolver rewrites from the coordinator's report, and **picks nothing** when
   it cannot ask or when no project is named. ✅
7. The shell never requests `LEGACY_UNSCOPED_PATHS` or `LEGACY_COST_TICKER_PATH`, including
   when the scoped route 404s and a real number is available on the wide one. ✅
8. No path draws `$0.00` for a project it did not ask about; `data-cost-scope` is printed
   in every state, not only `ready`. ✅
9. An unconfirmed project is marked in the **visible label**, not only the tooltip. ✅
10. `scopeEnforced` `true`/`false`/`null` produce three different outcomes. ✅
11. The switcher is fully operable from the keyboard and announces as a listbox. ✅
12. `grid-cols-[1fr_auto_1fr]` is unchanged and the tab group is still `col-start-2`
    `justify-self-center`. ✅ (existing AppShell test, unmodified assertion)

### Empirical — **not proved, and cannot be here**

13. That switching project changes what is on screen. **There is one project.** A switcher
    with one entry cannot demonstrate that switching scopes anything, and the panel says so
    in words rather than leaving a reader to infer it from a menu.
14. That project A's runs never appear in project B. **`ops.run_ledger` has no rows** —
    zero runs have executed, `RUNNER_ANTHROPIC_API_KEY` is unset. Isolation is structural
    only, per §6 and `rtl-arabic-pdpl-specialist`'s mandatory sign-off, which must say
    which of the two it is.
15. That the cost ticker shows a *correct project figure*. `/api/p/:project/cost/today`
    is not built and no run has ever cost anything.
16. That the switcher lists more than one project, or that `elsewhere` ever renders against
    a real coordinator. Covered by a fixture; not by a system.
17. Proportion, density and optical weight at 1440px. No reference frame, no headless
    browser (BOARD, *Awaiting the user*). Source-and-token standard, as every verdict on
    the record.

**13–16 are unblocked by exactly the items already on BOARD** — the API key, and a second
mounted library. None of them is unblocked by more work on this slice.

---

## Deliberately not done

1. **The all-projects search toggle** (`Plan §23.10`: *"project-scoped vs all-projects"*).
   `/api/all/*` has exactly one member today (`allApprovals`) and there is one project, so
   the toggle would be a control that cannot change its result. Search reads the scoped
   index and says so; the toggle lands when a second project exists and there is something
   cross-project to read.
2. **The account split** (`work $12.40 · personal $3.10`). `defaultAccountId` is `null`,
   `AccountSource` has an explicit `unattributed` case, and there are no runs — a split
   today would render one bucket holding everything beside a label implying the other was
   measured and found empty. Filed to `observability-engineer` with the shape it should
   arrive in.
3. **Provenance badges.** `design-system-guardian` shipped `ProvenanceBadge` while I was
   working; the orchestrator scoped M15's badge to the shell and the drawer. The shell has
   no per-agent surface to hang one on — the switcher is about a project, not an agent, and
   `⌂/▣/⑂` is a claim about which *file* won a cascade. Putting one on the switcher would be
   a category error. The drawer half is `drawer-engineer`'s and is the right vertical slice.
4. **Recent projects** in the picker (`Plan §23.10`). A recency list whose only entry is the
   project you are already in is decoration. Needs ≥2 projects.
5. **A filter input in the picker.** `⌘K`-style implies one; with one row it is a text box
   that can only filter a list to nothing. The listbox is fully keyboard-operable without
   it, and the input is additive when N is large enough to need it.
6. **`budgetMonthlyUsd`, `hostAffinity`, `defaultAccountId` are read from the payload and
   rendered nowhere.** Each ships with a sibling `…Enforced: false` in the contract because
   nothing enforces it. A cap drawn next to no enforcement is a UI telling a lie it was
   handed.
7. **No runner code.** `GET /api/projects` is `runner-engineer`'s and is already in their
   source at `routes/api.ts:344`. I did not write it, move it, or work around it.
8. **The i18n catalogue.** ~28 new strings, listed with proposed keys and sent to
   `rtl-arabic-pdpl-specialist`; the shell's `t()` migration is theirs. I did fix the two
   physical-utility RTL bugs their upgraded checker found in `SearchPill.tsx`, because that
   is my file and they were real (a left-anchored dropdown opens off the far side of its
   own control in Arabic).
9. **The two-level navigation split** (`Plan §23.5`). P2's. Not pre-built.
10. **Mobile IA** (`Plan §23.9`) — bottom tab bar, hidden zoom, swipe. P5's. What I did do
    is the minimum that keeps 375px working with a third control in the left cluster, and
    the trade is stated above rather than discovered later.

---

## Verification

**Token provenance (design-tokens §8b):**
`scanned at 2026-08-17 00:32 +03:00 · 4e0bbe6 · 64 uncommitted under apps/web` ·
files scanned **300** · **violations 0** · 2 exemptions, both pre-existing (`Chip.tsx`,
`Chip.test.tsx`).

**Gates**

| gate | result |
|---|---|
| `npm test` | 142 tests · **141 pass, 0 fail**, 1 skipped |
| `npm run test:web` | **462 pass / 462**, both halves (vitest + `node:test`), 60 files |
| shell suite alone | 10 files · **95 tests** |
| `npm run typecheck` | clean, all three workspaces |
| `npm run lint` | "No ESLint warnings or errors" |
| `npm run validate:tokens` | 0 violations, provenance above |
| `npm run validate:rtl` | 261 findings — the checker was upgraded mid-slice by `rtl-arabic-pdpl-specialist` and the count jumped from 75 because it can now see object-literal strings. **−2 from my fixes**; my new strings are filed, not hidden |
| `npm run validate:comms` | clean bar one pre-existing filename warning |

**Route table, from a real `next build`** — not inferred:

```
ƒ /[...legacy]                              ○ /offline
ƒ /p/[project]/map                          ƒ /p/[project]/map/[department]
ƒ /p/[project]/map/[department]/[agent]     ƒ /p/[project]/chart
ƒ /p/[project]/chart/[department]           ƒ /p/[project]/dashboards
ƒ /p/[project]/dashboards/[id]              ƒ /p/[project]/sessions
ƒ /p/[project]/sessions/[id]
```

The catch-all is present and last; the four view trees and `/offline` outrank it.

**Against the running stack** — `next start` on `:3100` from a clean build, proxying to the
live runner on `:8787`:

```
/p/agentos/map           -> 200    data-project-confirmed="false"
                                   data-cost-scope="project"  data-cost-state="loading"
/p/agentos/chart/sales   -> 200
/p/agentos/dashboards    -> 200
/p/agentos/map/sales     -> 200    <nav aria-label="Where you are">, href="/p/agentos/map"
/map                     -> 200    "Finding your project"  (then the unresolved state)
/offline                 -> 200
```

The runner it was talking to, at 00:28:

```
GET /api/projects              -> 404      (the process predates the route; the source has it)
GET /api/p/agentos/graph       -> 404
GET /api/p/agentos/cost/today  -> 404
GET /api/cost/today            -> 200      (and the shell never calls it)
```

So the *live* end-to-end path is unverified in exactly one respect — a coordinator that
actually answers `/api/projects` — and that is a container restart belonging to
`runner-engineer`, filed. Every state above is nonetheless covered by a test against a
stubbed runner, including the four failure states of `/api/projects`.

**Not run:** the 1440px side-by-side against the reference frame. There is no reference
frame and no headless browser (BOARD, *Awaiting the user*). This is a source-and-token
change with live verification of behaviour, not a proportion check.

## Next agent

**`fidelity-qa-reviewer`** — review requested. The cheapest way in is
`route.test.ts` (29 tests, the whole URL contract without a DOM) and then
`ProjectSwitcher.test.tsx`. `data-project-confirmed` and `data-cost-scope` give you both
assertions without matching copy. The criteria are split structural/empirical above and I
would rather be failed on a structural one than passed on an empirical one I cannot support.

**`runner-engineer`** — restart the runner so `/api/projects` answers; the app's front door
is behind it. `comms/inbox/runner-engineer/20260817-0035-…`.

**`observability-engineer`** — the scoped cost route, and one question that decides whether
I can be wrong: does a project with no rows answer `runs: 0` (a reading) or a `ledger.state`
(an unknown)? `comms/inbox/observability-engineer/20260817-0038-…`.

**`rtl-arabic-pdpl-specialist`** — ~28 keys, and the note that a UI now exists which your
one-brain-or-N ruling can contradict.
