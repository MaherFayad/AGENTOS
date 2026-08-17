# Spec — the app shell, search, routing and the PWA

> The implementation spec for the parts of `skilltree-clone-spec.md` that are the same on
> every view, plus the phone story. Checked by `npm run validate:coverage`.

## Owner

`shell-navigation-engineer`

## Spec sections covered

PART II · §2.0 · §2.7 · §3.6

## Boundaries

PART II's per-screen sections are claimed by their own owners in BOARD.md — this spec
claims only the shell that §2.0 calls "identical on all three views", the route skeleton
every screen mounts into, the Phase 4 marketing elements, and the phone. The coverage
checker reads every section id under Spec sections covered as an ownership claim, so no
other id appears there; where a requirement touches a neighbour, the row says whose it is.

## Decisions

1. **The chrome is an overlay, not a header.** The view fills the frame absolutely and
   the shell floats above it with `pointer-events-none`, re-enabled control by control.
   §2.0 draws the bar as transparent over the canvas; a canvas you cannot drag under the
   bar would be a dashboard with a header, which is a different product.

2. **The tab group is the `auto` column of a `1fr auto 1fr` grid.** §2.0 states our two
   additions must not disturb the layout. Centring by grid rather than by flex means the
   SESSIONS tab and the cost ticker change the weight of the side clusters without moving
   the tabs a pixel. This is the mechanism, and `AppShell.test.tsx` asserts it, because
   the alternative is discovering it at screenshot time.

3. **Search is the accessibility path, so it is a real combobox.** The map is a canvas and
   ~150 SVG circles; there is no tab order through a galaxy. `/` focuses, arrows walk,
   Enter opens, Esc dismisses, and the listbox has `aria-activedescendant` and a live
   region. Treating search as a nice-to-have would make the whole MAP view keyboard-
   unreachable, which is the one accessibility failure this product could not argue with.

4. **Fly first, navigate second.** Selecting a result emits `shell:flyTo` and *then*
   pushes the route, so the camera starts its 700ms move (§1.6 `DURATION.zoom`) while the
   drawer opens over it. The duration travels in the event, collapsed to 0 under
   `prefers-reduced-motion`, so the canvas never has to ask about motion preferences.

5. **A typed event bus is the shell↔canvas seam** (`src/lib/shell-bus.ts`). The chrome is
   rendered by the route-group layout and the canvas by the page beneath it: siblings in
   the tree, different owners, one of them imperative D3. Five named events with typed
   payloads are the smallest coupling that survives either side being rewritten. Adding an
   event is a message to me; changing a payload is an ADR.

6. **The shell never invents a number.** Zoom shows an em dash until a canvas reports a
   level; the LIVE counter says `NO LIVE COUNT YET` with a sentence explaining why; the
   cost ticker says `no cost data` when Langfuse has not answered. `useEndpoint` has
   exactly three states and none of them is "0 while we find out" (standing rule 9).

7. **Connection status is monochrome.** It is chrome, so a green dot is a fidelity
   failure (§1.3). Online is a filled ivory dot, anything else is a hollow `--line-2` dot,
   and the state is also in the text — which is the accessible outcome as well.

8. **The data does not pretend to work offline.** The service worker caches the app shell
   and precached assets; `/api/*` and `/ws/*` are network-only and a failed navigation
   falls back to an honest "no tailnet" page that shows no numbers at all. A cached KPI is
   a lie with a timestamp on it.

9. **Push lives in `/sw-push.js`, not in `/sw.js`.** `sessions-relay-engineer` owns push
   because §3.1's payloads are end-to-end encrypted and are opened client-side with a key
   the shell must never hold. `sw.js` pulls their module in with a guarded
   `importScripts('/sw-push.js')` and registers no `push` or `notificationclick` handler
   of its own — two listeners would fire two notifications for one message.

10. **The install affordance is in the `?` sheet, not the top bar.** §2.0 fixes what is in
    that bar. A one-time action goes behind the control that already means "things you
    might not know about". Chromium's `beforeinstallprompt` is captured at module scope
    (it fires before hydration); browsers that do not fire it get a sentence, not a user
    agent sniff.

11. **No auth, and nothing that assumes auth** (§3.6, BOARD constraint 5). There is no
    login route, no session cookie, no "current user". The help sheet says so in one
    sentence so a person who notices there is no sign-in learns why. Exposing this off the
    tailnet is an infra change (Authelia / Cloudflare Access in front) and an ADR, not a
    UI feature.

12. **§2.7 is declared, not built.** It is marked "optional, Phase 4" in the spec of
    record. Every element it names is enumerated below with `—` in the `Implemented in`
    column, which is the honest way to show the section is read and owned before any of it
    exists. Note that §2.7 calls it a "login/landing page": under decision 11 the landing
    half is legitimate marketing and the login half does not exist in v1.

### M15 — the project segment (`Plan §9`, `Plan §23.12`)

Decisions 13–16 were taken while re-scoping every route under `/p/:project`. They are
filed here rather than in a Part Two spec because ADR-013 keeps the coverage gate pointed
at the spec of record: the routing skeleton is still PART II's and the chrome is still
§2.0's, so the requirements below cite those and name `Plan §n` in their own text. That is
the same treatment `observability.md` gives REQ-OBS-27 and it is deliberate — a second
spec file for the same surface would be a second owner for the same rows.

13. **Every view URL carries its project, and `null` is a question, never a default.** The
    whole view tree moved to `app/(views)/p/[project]/…`, mirroring the API shape
    `packages/contracts/src/project.ts` fixes (*"a request names its project in its path,
    and there is no default"*). `parseShellRoute` returns `project: null` for a path with
    no `/p/` segment, meaning *this URL does not say* — and nothing in the shell
    substitutes a value for it. A `null` that quietly became `'agentos'` here would
    reintroduce, one layer up, the ambient default the API contract refuses: some
    project's data rendered under a name the reader supplied from memory.

14. **The compatibility path is one catch-all that asks, not a redirect that assumes.**
    `app/(views)/[...legacy]/page.tsx` is the lowest-priority match in the App Router, so
    the four real view trees win before it is consulted — the whole pre-M15 URL space costs
    one file rather than a duplicate tree. It renders no project's data. It reads
    `GET /api/projects` for the coordinator's own `mounted` slug and `replace`s the URL to
    name it. **When it cannot ask, it picks nothing** and says so. That last clause is what
    makes this a design rather than a default with extra steps, and it is why the redirect
    could not live in `next.config`: the build does not know which library a coordinator
    mounts, and baking one in would ship an app that relabels one deployment's data with
    another's project name.

    **Intended resolution for a project-less URL, stated once because it is the first thing
    a bookmark hits:** `/map` → `/p/<mounted>/map`, where `<mounted>` is the coordinator's
    answer and nothing else. Three named senders stay unscoped on purpose and all land
    here — `manifest.webmanifest`'s `start_url` and shortcuts (a static file cannot name a
    project without naming the same one on every deployment), push deep links until a
    payload carries a project field (`sessions-relay-engineer`'s to add), and anything
    bookmarked before M15. *Verified 2026-08-17 against a runner booted at `1e5b5d7`:
    `GET /api/projects` answers `mounted: "agentos"`, so the resolution completes. The
    "this link does not name a project" screen seen earlier was a **stale runner process
    that predated the route**, not the resting state — it is the honest failure state, and
    it is what a reader sees whenever the coordinator is unreachable.*

15. **The switcher joins the left cluster; it is not a fifth tab.** `Plan §23.5` is
    explicit that the centre column's budget is spent — four wide-tracked labels measure
    ~400px and six will not fit. The switcher is placed before the fullscreen toggle inside
    the left `1fr` of decision 2's grid, so it changes the weight of a side cluster and
    moves the tab group by nothing. Same mechanism, same reason, as the SESSIONS tab and
    the cost ticker.

16. **No shell surface falls back to a pre-project route.** `/api/graph`, `/api/panels`
    and `/api/cost/today` are all still mounted and now answer **400
    `project_scope_missing`**, with the contract's instruction attached: *"it is not a
    fallback and must not be used as one … answering it with a plausible `usd: null` would
    hide the migration from the only people who can finish it."* So when there is no
    project the shell asks for **nothing** — `projectApiUrl` returns `null`, `useEndpoint`
    renders `noTargetMessage`, and the search panel and the ticker each print which absence
    it is. The consequence is worth stating positively: **there is no state in which a
    shell surface shows a real number about a project other than the one the URL names.** A
    design with a correctly-labelled fallback would have had one, and a correct label is a
    weaker guarantee than an impossible state.

### 2026-08-17 — the tablist arrow keys, and the boundary around the fix

17. **Arrow keys follow reading order; the direction is read from the rendered tree.**
    `SegmentedControl`'s handler mapped `ArrowRight` to `+1` unconditionally. The tablist is
    an `inline-flex` row, so `dir="rtl"` reverses it and MAP sits at the far *right* — the
    handler did not reverse with it, so **the shell's primary navigation ran backwards for
    every Arabic reader**, and had since the control was written. Found from outside, by
    `chart-matrix-engineer`, who had just fixed the identical three lines in `DepartmentTabs`
    (`inbox/_all/20260817-1832-…-tablist-arrow-keys-run-backwards-in-rtl.md`).

    Direction comes from `elementDirection(e.currentTarget)` — `closest('[dir]')` — and never
    from the locale. Two reasons, and the second is the load-bearing one: `useI18n()` throws
    outside its provider and would take every bare-render suite down, and **§2.5 and §3.1 both
    put LTR islands inside the RTL page**, so a control must key the direction it is *rendered*
    in rather than the one the app is set to. A tab bar inside a dashboard's LTR chart island
    keys LTR, and the nesting case is tested.

    **Mirroring is a per-control decision, not a global one** — the half that is easy to
    over-apply, so it is written down with the fix rather than after the next bug. `Home` and
    `End` are **ordinals**, not edges: `Home` means "the first tab", which is MAP in both
    directions. The search results and the project switcher walk the **block** axis, which
    `dir` does not touch. `DOES_NOT_MIRROR['chart.phaseColumns']` is the same rule one view
    over. The test everywhere: **reading order mirrors; ordinals, space and time do not.**
    Both sides are pinned by tests so the fix cannot later be "completed" into a second bug.

18. **The direction helpers are reused, not re-implemented — and the import points the wrong
    way on purpose.** `elementDirection` and `inlineStep` live in
    `apps/web/src/chart/model/direction.ts` (`chart-matrix-engineer`). `SegmentedControl` is a
    primitive and a primitive should not depend on a view; that import is interim and is
    labelled as such in the file. The alternative was a second copy of six lines, and **two
    copies of one rule is precisely what let this bug exist in two components at once**. The
    promotion target is `i18n/direction.ts`, next to `inlineSign` and the `MIRRORS` table that
    already governs both call sites — `rtl-arabic-pdpl-specialist`'s file, so it is proposed
    by `decision-request` rather than performed. The visible odd import is the debt marker;
    removing it silently by forking would hide the thing worth fixing.

## Coverage

| ID | Spec § | Requirement | Implemented in | Verified by |
|---|---|---|---|---|
| REQ-SHELL-01 | §2.0 | The chrome is transparent over the view canvas and passes pointer events through except on its own controls | `apps/web/src/components/shell/AppShell.tsx` | `apps/web/src/components/shell/AppShell.test.tsx` |
| REQ-SHELL-02 | §2.0 | Every control §2.0 names is present on screen at once on every view | `apps/web/src/components/shell/AppShell.tsx` · `apps/web/src/components/shell/TopBar.tsx` · `apps/web/src/components/shell/BottomBar.tsx` | `apps/web/src/components/shell/AppShell.test.tsx` |
| REQ-SHELL-03 | §2.0 | Top-left, first control: a fullscreen toggle drawn as a 32px ghost square, not a pill | `apps/web/src/components/shell/FullscreenToggle.tsx` | `apps/web/src/components/shell/AppShell.test.tsx` |
| REQ-SHELL-04 | §2.0 | The toggle enters and exits fullscreen and reports state via aria-pressed; it hides itself where the API is unavailable | `apps/web/src/components/shell/FullscreenToggle.tsx` | `apps/web/src/components/shell/AppShell.test.tsx` |
| REQ-SHELL-05 | §2.0 | The search input is a pill on `--card` with a 1px `--line` border | `apps/web/src/components/shell/SearchPill.tsx` | `apps/web/src/components/shell/SearchPill.test.tsx` |
| REQ-SHELL-06 | §2.0 | Placeholder reads "Search jobs" on MAP and CHART | `apps/web/src/components/shell/route.ts` | `apps/web/src/components/shell/route.test.ts` |
| REQ-SHELL-07 | §2.0 | Placeholder reads "Search panels" on DASHBOARDS | `apps/web/src/components/shell/route.ts` | `apps/web/src/components/shell/route.test.ts` |
| REQ-SHELL-08 | §2.0 | Search is fuzzy (subsequence, non-contiguous) over agent names and descriptions | `apps/web/src/lib/search.ts` | `apps/web/src/lib/search.test.ts` |
| REQ-SHELL-09 | §2.0 | A name hit always outranks a description-only hit; ties break to the shorter label | `apps/web/src/lib/search.ts` | `apps/web/src/lib/search.test.ts` |
| REQ-SHELL-10 | §2.0 | Matched characters are highlighted in the result label | `apps/web/src/lib/search.ts` · `apps/web/src/components/shell/SearchPill.tsx` | `apps/web/src/lib/search.test.ts` |
| REQ-SHELL-11 | §2.0 | Choosing an agent result emits a typed `shell:flyTo` with the node id and a motion budget | `apps/web/src/components/shell/SearchPill.tsx` · `apps/web/src/lib/shell-bus.ts` | `apps/web/src/components/shell/SearchPill.test.tsx` |
| REQ-SHELL-12 | §2.0 | The fly-to duration comes from `DURATION.zoom` and collapses to 0 under prefers-reduced-motion | `apps/web/src/components/shell/SearchPill.tsx` · `apps/web/src/components/primitives/motion.ts` | `apps/web/src/components/shell/SearchPill.test.tsx` |
| REQ-SHELL-13 | §2.0 | Choosing a panel result opens that dashboard instead of flying the map | `apps/web/src/components/shell/SearchPill.tsx` | `apps/web/src/components/shell/SearchPill.test.tsx` |
| REQ-SHELL-14 | §2.0 | `/` focuses search from anywhere except a text field | `apps/web/src/components/shell/SearchPill.tsx` | `apps/web/src/components/shell/SearchPill.test.tsx` |
| REQ-SHELL-15 | §2.0 | Arrow keys walk results, Enter opens the active one, Esc clears then dismisses | `apps/web/src/components/shell/SearchPill.tsx` | `apps/web/src/components/shell/SearchPill.test.tsx` |
| REQ-SHELL-16 | §2.0 | The result list is an ARIA combobox/listbox with `aria-activedescendant` and a polite live region | `apps/web/src/components/shell/SearchPill.tsx` | `apps/web/src/components/shell/SearchPill.test.tsx` |
| REQ-SHELL-17 | §2.0 | No results, or nothing indexed, is a written sentence rather than an empty box | `apps/web/src/components/shell/SearchPill.tsx` · `apps/web/src/components/shell/useSearchIndex.ts` | `apps/web/src/components/shell/SearchPill.test.tsx` |
| REQ-SHELL-18 | §2.0 | The search index is built from the graph and panel payloads only — the shell stores no agent list of its own | `apps/web/src/components/shell/useSearchIndex.ts` | `apps/web/src/components/shell/AppShell.test.tsx` |
| REQ-SHELL-19 | §2.0 | Top-centre segmented control, optically centred by a `1fr auto 1fr` grid independent of the side clusters | `apps/web/src/components/shell/TopBar.tsx` | `apps/web/src/components/shell/AppShell.test.tsx` |
| REQ-SHELL-20 | §2.0 | Exactly four tabs in the order MAP · DASHBOARDS · CHART · SESSIONS | `apps/web/src/components/shell/route.ts` · `apps/web/src/components/shell/ViewTabs.tsx` | `apps/web/src/components/shell/ViewTabs.test.tsx` |
| REQ-SHELL-21 | §2.0 | Active tab is an ivory pill with `#131315` text, inactive is `--ink-2`, 11px uppercase +0.25em (the guardian's SegmentedControl) | `apps/web/src/components/primitives/SegmentedControl.tsx` | `apps/web/src/components/primitives/SegmentedControl.test.tsx` |
| REQ-SHELL-22 | §2.0 | The active tab follows the URL; tabs hold no state of their own | `apps/web/src/components/shell/ViewTabs.tsx` | `apps/web/src/components/shell/ViewTabs.test.tsx` |
| REQ-SHELL-23 | §2.0 | Top-right eyebrow reads NAVIGATION in copper at 10px / +0.35em | `apps/web/src/components/shell/NewSessionAction.tsx` · `apps/web/src/components/primitives/Eyebrow.tsx` | `apps/web/src/components/shell/AppShell.test.tsx` |
| REQ-SHELL-24 | §2.0 | Their "Book a call" slot is a `+ New session` primary pill that starts a Claude session | `apps/web/src/components/shell/NewSessionAction.tsx` | `apps/web/src/components/shell/AppShell.test.tsx` |
| REQ-SHELL-25 | §2.0 | Bottom-left `?` pill opens a help panel; `?` also toggles it from the keyboard | `apps/web/src/components/shell/ZoomControls.tsx` · `apps/web/src/components/shell/HelpSheet.tsx` | `apps/web/src/components/shell/HelpSheet.test.tsx` |
| REQ-SHELL-26 | §2.0 | The help panel states the access model: no sign-in, tailnet only | `apps/web/src/components/shell/HelpSheet.tsx` | `apps/web/src/components/shell/HelpSheet.test.tsx` |
| REQ-SHELL-27 | §2.0 | `−` and `+` publish `shell:zoom` to the canvas; the shell never owns the camera | `apps/web/src/components/shell/ZoomControls.tsx` · `apps/web/src/lib/shell-bus.ts` | `apps/web/src/components/shell/ZoomControls.test.tsx` |
| REQ-SHELL-28 | §2.0 | The zoom readout renders the level the canvas reports, and an em dash before any canvas has reported one | `apps/web/src/components/shell/ZoomControls.tsx` | `apps/web/src/components/shell/ZoomControls.test.tsx` |
| REQ-SHELL-29 | §2.0 | Clicking the readout resets zoom; the controls disable on views with no camera | `apps/web/src/components/shell/ZoomControls.tsx` · `apps/web/src/components/shell/route.ts` | `apps/web/src/components/shell/ZoomControls.test.tsx` |
| REQ-SHELL-30 | §2.0 | Bottom-right, their Feedback pill is replaced by connection status: Tailscale state plus runner queue depth from `GET /api/status` | `apps/web/src/components/shell/ConnectionStatus.tsx` | `apps/web/src/components/shell/ConnectionStatus.test.tsx` |
| REQ-SHELL-31 | §2.0 | Connection status is monochrome — no colour is used to encode online/offline | `apps/web/src/components/shell/ConnectionStatus.tsx` | `apps/web/src/components/shell/ConnectionStatus.test.tsx` |
| REQ-SHELL-32 | §2.0 | Status unreachable or unbuilt reads as a sentence, never as a cheerful default | `apps/web/src/components/shell/ConnectionStatus.tsx` · `apps/web/src/components/shell/useEndpoint.ts` | `apps/web/src/components/shell/ConnectionStatus.test.tsx` |
| REQ-SHELL-33 | §2.0 | Cost ticker beside the status pill renders `$12.40 today` from `GET /api/cost/today` | `apps/web/src/components/shell/CostTicker.tsx` | `apps/web/src/components/shell/CostTicker.test.tsx` |
| REQ-SHELL-34 | §2.0 | The ticker uses the same wide-tracked monochrome type as the status pill and is not a coloured badge | `apps/web/src/components/shell/CostTicker.tsx` | `apps/web/src/components/shell/CostTicker.test.tsx` |
| REQ-SHELL-35 | §2.0 | A real zero renders as `$0.00 today`; a missing endpoint renders as `no cost data` with a sentence | `apps/web/src/components/shell/CostTicker.tsx` | `apps/web/src/components/shell/CostTicker.test.tsx` |
| REQ-SHELL-36 | §2.0 | Neither addition (SESSIONS tab, cost ticker) shifts the tab group or any of their controls | `apps/web/src/components/shell/TopBar.tsx` · `apps/web/src/components/shell/BottomBar.tsx` | `apps/web/src/components/shell/AppShell.test.tsx` |
| REQ-SHELL-37 | §2.0 | A breadcrumb strip appears under the bar in drill-ins only | `apps/web/src/components/shell/BreadcrumbStrip.tsx` · `apps/web/src/components/shell/route.ts` | `apps/web/src/components/shell/BreadcrumbStrip.test.tsx` |
| REQ-SHELL-38 | §2.0 | Top-left of the strip is `← ALL DEPARTMENTS`, and it is a real link back | `apps/web/src/components/shell/BreadcrumbStrip.tsx` | `apps/web/src/components/shell/BreadcrumbStrip.test.tsx` |
| REQ-SHELL-39 | §2.0 | Top-right of the strip is the `N OF 22 LIVE · YOUR TREE` counter, copper numeral on ivory small-caps | `apps/web/src/components/shell/BreadcrumbStrip.tsx` | `apps/web/src/components/shell/BreadcrumbStrip.test.tsx` |
| REQ-SHELL-40 | §2.0 | The counter is scoped to the current department and comes from real run data, never synthesised | `apps/web/src/components/shell/ShellContext.tsx` · `apps/web/src/components/shell/useSearchIndex.ts` | `apps/web/src/components/shell/BreadcrumbStrip.test.tsx` |
| REQ-SHELL-41 | §2.0 | With no live data the counter says so in a sentence instead of printing a zero | `apps/web/src/components/shell/BreadcrumbStrip.tsx` | `apps/web/src/components/shell/BreadcrumbStrip.test.tsx` |
| REQ-SHELL-42 | §2.0 | `YOUR TREE` toggles, reports `aria-pressed`, and publishes `shell:yourTree` to the canvas | `apps/web/src/components/shell/BreadcrumbStrip.tsx` · `apps/web/src/lib/shell-bus.ts` | `apps/web/src/components/shell/BreadcrumbStrip.test.tsx` |
| REQ-SHELL-43 | §2.0 | A skip link is the first tabbable element and jumps past the chrome to the view | `apps/web/src/components/shell/AppShell.tsx` | `apps/web/src/components/shell/AppShell.test.tsx` |
| REQ-SHELL-44 | §2.0 | Every colour in the shell is a token; the only colour is the copper eyebrow and the copper LIVE numeral | `apps/web/src/components/shell/AppShell.tsx` | `scripts/check-tokens.mjs` |
| REQ-SHELL-45 | PART II | The shell mounts once for all four views and survives navigation between them without remounting | `apps/web/src/app/(views)/layout.tsx` | `apps/web/src/components/shell/AppShell.test.tsx` |
| REQ-SHELL-46 | PART II | URL reflects view state **inside a project**: `/p/:project/map`, `/p/:project/dashboards`, `/p/:project/chart`, `/p/:project/sessions` — the whole view tree lives under `p/[project]/` (M15, `Plan §9`) | `apps/web/src/components/shell/route.ts` · `apps/web/src/app/(views)/p/[project]/map/page.tsx` · `apps/web/src/app/(views)/p/[project]/dashboards/page.tsx` · `apps/web/src/app/(views)/p/[project]/chart/page.tsx` · `apps/web/src/app/(views)/p/[project]/sessions/page.tsx` | `apps/web/src/components/shell/route.test.ts` |
| REQ-SHELL-47 | PART II | Drill-ins are addressable inside the project: `/p/:project/map/:department` and `/p/:project/chart/:department` | `apps/web/src/app/(views)/p/[project]/map/[department]/page.tsx` · `apps/web/src/app/(views)/p/[project]/chart/[department]/page.tsx` | `apps/web/src/components/shell/route.test.ts` |
| REQ-SHELL-48 | PART II | An open drawer is addressable: `/p/:project/map/:department/:agent` | `apps/web/src/app/(views)/p/[project]/map/[department]/[agent]/page.tsx` | `apps/web/src/components/shell/route.test.ts` |
| REQ-SHELL-49 | PART II | A dashboard and a session are addressable: `/p/:project/dashboards/:id`, `/p/:project/sessions/:id` | `apps/web/src/app/(views)/p/[project]/dashboards/[id]/page.tsx` · `apps/web/src/app/(views)/p/[project]/sessions/[id]/page.tsx` | `apps/web/src/components/shell/route.test.ts` |
| REQ-SHELL-50 | PART II | Back and forward behave, because navigation is router pushes and no view holds shadow state | `apps/web/src/components/shell/ViewTabs.tsx` · `apps/web/src/components/shell/route.ts` | `apps/web/src/components/shell/route.test.ts` |
| REQ-SHELL-51 | PART II | An unknown or root path resolves to MAP rather than erroring — `/` redirects to `/map`, which names no project and is answered by the resolver (REQ-SHELL-93), not by an error | `apps/web/src/components/shell/route.ts` · `apps/web/src/app/page.tsx` · `apps/web/src/app/(views)/[...legacy]/page.tsx` | `apps/web/src/components/shell/route.test.ts` |
| REQ-SHELL-52 | PART II | Every view route is a mount point an owning agent swaps into, with an honest empty state until then | `apps/web/src/components/shell/ViewMount.tsx` | `apps/web/src/components/shell/AppShell.test.tsx` |
| REQ-SHELL-53 | PART II | The shell↔canvas seam is five named, typed events and nothing else | `apps/web/src/lib/shell-bus.ts` | `apps/web/src/lib/shell-bus.test.ts` |
| REQ-SHELL-54 | §3.6 | A web app manifest is served with name, short_name, start_url, scope and `display: standalone` | `apps/web/public/manifest.webmanifest` | `apps/web/src/lib/pwa.test.ts` · `scripts/__tests__/shell-pwa.test.mjs` |
| REQ-SHELL-55 | §3.6 | The manifest is linked from the document head | `apps/web/src/app/(views)/layout.tsx` | `apps/web/src/lib/pwa.test.ts` |
| REQ-SHELL-56 | §3.6 | The installed app is dark: theme_color and background_color are the near-black `--bg` | `apps/web/public/manifest.webmanifest` | `apps/web/src/lib/pwa.test.ts` |
| REQ-SHELL-57 | §3.6 | Icons exist at 192 and 512 plus a maskable 512 | `apps/web/public/icons/icon-192.png` · `apps/web/public/icons/icon-512.png` · `apps/web/public/icons/icon-maskable-512.png` | `apps/web/src/lib/pwa.test.ts` · `scripts/__tests__/shell-pwa.test.mjs` |
| REQ-SHELL-58 | §3.6 | The icons are monochrome placeholders and are labelled as placeholders in the repo | `apps/web/public/icons/README.md` | `apps/web/public/icons/README.md` |
| REQ-SHELL-59 | §3.6 | A notification badge asset exists at the path the relay's worker references | `apps/web/public/icons/badge-72.png` | `apps/web/public/sw-push.js` · `scripts/__tests__/shell-pwa.test.mjs` |
| REQ-SHELL-60 | §3.6 | The service worker registers once on mount and a failed registration never breaks the app | `apps/web/src/components/shell/PwaRegistrar.tsx` · `apps/web/src/lib/pwa.ts` | `apps/web/src/lib/pwa.test.ts` |
| REQ-SHELL-61 | §3.6 | The app shell, manifest, icons and offline page are precached at install | `apps/web/public/sw.js` | `apps/web/src/lib/pwa.test.ts` · `scripts/__tests__/shell-pwa.test.mjs` |
| REQ-SHELL-62 | §3.6 | `/api/*` and `/ws/*` are never cached and never replayed | `apps/web/public/sw.js` | `apps/web/src/lib/pwa.test.ts` · `scripts/__tests__/shell-pwa.test.mjs` |
| REQ-SHELL-63 | §3.6 | A failed navigation falls back to an offline page, not to a browser error | `apps/web/public/sw.js` · `apps/web/src/app/(views)/offline/page.tsx` | `apps/web/src/lib/pwa.test.ts` |
| REQ-SHELL-64 | §3.6 | The offline page shows no agent data and says plainly that this device is off the tailnet | `apps/web/src/app/(views)/offline/page.tsx` | `apps/web/src/lib/pwa.test.ts` |
| REQ-SHELL-65 | §3.6 | Caches from an older shell version are deleted on activate | `apps/web/public/sw.js` | `apps/web/src/lib/pwa.test.ts` |
| REQ-SHELL-66 | §3.6 | The viewport is `viewport-fit: cover` so the app paints under the notch | `apps/web/src/app/(views)/layout.tsx` | `apps/web/src/components/shell/AppShell.test.tsx` |
| REQ-SHELL-67 | §3.6 | Every edge of the chrome reserves its `env(safe-area-inset-*)` | `apps/web/src/components/shell/TopBar.tsx` · `apps/web/src/components/shell/BottomBar.tsx` | `apps/web/src/components/shell/AppShell.test.tsx` |
| REQ-SHELL-68 | §3.6 | The shell is `100dvh`, so collapsing browser UI cannot hide the bottom pills | `apps/web/src/components/shell/AppShell.tsx` | `apps/web/src/components/shell/AppShell.test.tsx` |
| REQ-SHELL-69 | §3.6 | Pinch-zoom stays available on the phone — the viewport does not lock scale | `apps/web/src/app/(views)/layout.tsx` | `apps/web/src/components/shell/AppShell.test.tsx` |
| REQ-SHELL-70 | §3.6 | The install prompt is captured before hydration and offered from a user gesture | `apps/web/src/lib/pwa.ts` · `apps/web/src/components/shell/HelpSheet.tsx` | `apps/web/src/lib/pwa.test.ts` |
| REQ-SHELL-71 | §3.6 | Browsers that never fire an install event are told how to install, without user-agent sniffing | `apps/web/src/components/shell/HelpSheet.tsx` | `apps/web/src/components/shell/HelpSheet.test.tsx` |
| REQ-SHELL-72 | §3.6 | The browser half of the push handshake asks permission, subscribes, and posts the subscription to the relay | `apps/web/src/lib/pwa.ts` | `apps/web/src/lib/pwa.test.ts` |
| REQ-SHELL-73 | §3.6 | Every push failure path returns a sentence a person can act on, and none of them throws | `apps/web/src/lib/pwa.ts` | `apps/web/src/lib/pwa.test.ts` |
| REQ-SHELL-74 | §3.6 | `sw.js` imports the relay's push module and registers no push handler of its own | `apps/web/public/sw.js` | `apps/web/src/lib/pwa.test.ts` · `scripts/__tests__/shell-pwa.test.mjs` |
| REQ-SHELL-75 | §3.6 | The three notification types — permission prompts, run failures, approval requests — are rendered by the relay's module | `apps/web/public/sw-push.js` | `apps/web/public/sw-push.js` |
| REQ-SHELL-76 | §3.6 | There is no login route and no code path that is only safe because a session exists | `apps/web/src/app/(views)/layout.tsx` | `apps/web/src/components/shell/HelpSheet.test.tsx` |
| REQ-SHELL-77 | §3.6 | The absence of sign-in is explained to the user once, in the help sheet | `apps/web/src/components/shell/HelpSheet.tsx` | `apps/web/src/components/shell/HelpSheet.test.tsx` |
| REQ-SHELL-78 | §2.7 | Floating pill navbar, glass with blur | — | — |
| REQ-SHELL-79 | §2.7 | Light-theme hero with an 86px display headline | — | — |
| REQ-SHELL-80 | §2.7 | Instrument Serif italic accent words inside that headline | — | — |
| REQ-SHELL-81 | §2.7 | Badge pill reading `137 AGENTS MAPPED · 100 FOUNDING SEATS` | — | — |
| REQ-SHELL-82 | §2.7 | Sticky bottom bar with cohort status and a CTA | — | — |
| REQ-SHELL-83 | §2.7 | Before/after stats with the old figure struck through | — | — |
| REQ-SHELL-84 | §2.7 | "What is actually in the box" priced line-items table | — | — |
| REQ-SHELL-85 | §2.7 | FAQ accordions | — | — |
| REQ-SHELL-86 | §2.7 | Four-step card row: Install, Interview, Second brain, Live | — | — |
| REQ-SHELL-87 | §2.7 | All of the above use the Part I tokens with no marketing-only palette | — | — |
| REQ-SHELL-88 | §2.7 | The landing page is public-facing and lives outside the tailnet-only app; it carries no login | — | — |
| REQ-SHELL-89 | PART II | A path with no `/p/` segment parses to `project: null` — *this URL does not say* — and no code path in the shell substitutes a value for it (M15, `Plan §9`) | `apps/web/src/components/shell/route.ts` | `apps/web/src/components/shell/route.test.ts` |
| REQ-SHELL-90 | PART II | `/p/:project` is consumed only when the segment passes `packages/contracts`' own slug predicate — the runner's, not a second one — so `/p/all`, `/p/api` and `/p/p` are not projects | `apps/web/src/components/shell/route.ts` · `packages/contracts/src/project.ts` | `apps/web/src/components/shell/route.test.ts` |
| REQ-SHELL-91 | PART II | Every href the shell or a view builds stays in the project it was built from, and degrades to the pre-project shape rather than emitting `/p/null/…` when there is none | `apps/web/src/components/shell/route.ts` · `apps/web/src/components/shell/useProjectHref.ts` | `apps/web/src/components/shell/route.test.ts` |
| REQ-SHELL-92 | PART II | Every pre-M15 path is answered by one catch-all rather than a duplicated route tree, and that file renders no project's data | `apps/web/src/app/(views)/[...legacy]/page.tsx` · `apps/web/src/components/shell/LegacyRouteResolver.tsx` | `apps/web/src/components/shell/ProjectSwitcher.test.tsx` |
| REQ-SHELL-93 | PART II | A project-less URL is resolved by asking `GET /api/projects` which project this coordinator mounts, then `replace`-ing the URL to name it — so the reader sees the project in the address bar before any of its data is drawn | `apps/web/src/components/shell/LegacyRouteResolver.tsx` · `apps/web/src/components/shell/useProjects.ts` | `apps/web/src/components/shell/ProjectSwitcher.test.tsx` |
| REQ-SHELL-94 | PART II | When the coordinator cannot be asked, or answers without naming a mounted project, **nothing is picked**: the page says the link does not name a project and why, and no view is mounted under an unnamed project | `apps/web/src/components/shell/LegacyRouteResolver.tsx` | `apps/web/src/components/shell/ProjectSwitcher.test.tsx` |
| REQ-SHELL-95 | PART II | Switching project keeps the view and the department and drops the agent, the panel and the session — the same slug in two projects is a different agent (ADR-014 §2) | `apps/web/src/components/shell/route.ts` · `apps/web/src/components/shell/ProjectSwitcher.tsx` | `apps/web/src/components/shell/route.test.ts` · `apps/web/src/components/shell/ProjectSwitcher.test.tsx` |
| REQ-SHELL-96 | §2.0 | The project switcher sits first in the top-left cluster, adds no fifth tab, and spends none of the centring grid's `auto` column — the tab group does not move (`Plan §23.5`) | `apps/web/src/components/shell/ProjectSwitcher.tsx` · `apps/web/src/components/shell/TopBar.tsx` | `apps/web/src/components/shell/AppShell.test.tsx` |
| REQ-SHELL-97 | §2.0 | The switcher is a real `listbox` reachable without a pointer: `⌘K`/`Ctrl+K` opens from anywhere, arrows and Home/End walk, Enter selects, Esc closes and returns focus to the trigger | `apps/web/src/components/shell/ProjectSwitcher.tsx` | `apps/web/src/components/shell/ProjectSwitcher.test.tsx` |
| REQ-SHELL-98 | §2.0 | The pill shows the slug **the URL names**, and the coordinator's display name only once the coordinator confirms that slug exists; an unconfirmed name is marked in the visible label, not only in a tooltip a phone cannot show | `apps/web/src/components/shell/ProjectSwitcher.tsx` · `apps/web/src/components/shell/useProjects.ts` | `apps/web/src/components/shell/ProjectSwitcher.test.tsx` |
| REQ-SHELL-99 | §2.0 | A URL naming a project the coordinator does not serve renders and says so in a sentence, rather than 404ing later; a listed project this coordinator cannot serve is marked `elsewhere` | `apps/web/src/components/shell/useProjects.ts` · `apps/web/src/components/shell/ProjectSwitcher.tsx` | `apps/web/src/components/shell/ProjectSwitcher.test.tsx` |
| REQ-SHELL-100 | §2.0 | With one project the switcher says out loud that nothing here demonstrates scoping, and prints the coordinator's own `scopeEnforced` — with "not reported" kept apart from "not enforced" | `apps/web/src/components/shell/ProjectSwitcher.tsx` · `apps/web/src/components/shell/useProjects.ts` | `apps/web/src/components/shell/ProjectSwitcher.test.tsx` |
| REQ-SHELL-101 | §2.0 | The breadcrumb strip carries a project trail — `project › department › leaf` — whose head crumb is the project the URL names and never the coordinator's mounted one, with the separator rendered by the component so RTL flips it (`Plan §23.12`, §1.4) | `apps/web/src/components/shell/BreadcrumbStrip.tsx` · `apps/web/src/components/shell/route.ts` | `apps/web/src/components/shell/AppShell.test.tsx` · `apps/web/src/components/shell/route.test.ts` |
| REQ-SHELL-102 | §2.0 | The search index is read from this project's scoped routes only, and every result is a link into this project's map or dashboards | `apps/web/src/components/shell/useSearchIndex.ts` · `apps/web/src/components/shell/SearchPill.tsx` | `apps/web/src/components/shell/SearchPill.test.tsx` |
| REQ-SHELL-103 | §2.0 | No shell surface calls a pre-project route: with no project in the URL `projectApiUrl` returns `null`, nothing is requested, and the deliberate 400 on the old spelling is never converted into a shrug | `apps/web/src/components/shell/useSearchIndex.ts` · `apps/web/src/components/shell/useEndpoint.ts` | `apps/web/src/components/shell/CostTicker.test.tsx` |
| REQ-SHELL-104 | §2.0 | The cost ticker reads `/api/p/:project/cost/today` and has exactly two scopes, `project` and `unscoped`, both readable off the DOM — there is no state in which it shows a real number about another project | `apps/web/src/components/shell/CostTicker.tsx` | `apps/web/src/components/shell/CostTicker.test.tsx` |
| REQ-SHELL-105 | §2.0 | The search panel says which absence it is when the URL names no project, instead of an empty list | `apps/web/src/components/shell/useSearchIndex.ts` · `apps/web/src/components/shell/SearchPill.tsx` | — |
| REQ-SHELL-106 | §2.0 | Every endpoint-backed shell control drops the previous target's answer before asking about the new one, so no figure survives a project switch on screen | `apps/web/src/components/shell/useEndpoint.ts` | — |
| REQ-SHELL-107 | §2.0 | The tab bar's arrow keys follow **reading order**: under `dir="rtl"` ArrowLeft advances and ArrowRight goes back, the wrap runs along the list rather than the screen, and the direction is read from the rendered tree so a control inside an LTR island keys LTR (Decision 17, `MIRRORS['shell.segmentedControl']`) | `apps/web/src/components/primitives/SegmentedControl.tsx` · `apps/web/src/chart/model/direction.ts` | `apps/web/src/components/primitives/SegmentedControl.test.tsx` |
| REQ-SHELL-108 | §2.0 | Mirroring is per-control: `Home`/`End` on the tab bar and the arrow keys of the search listbox and the project switcher are ordinal or block-axis, and stay direction-blind under `dir="rtl"` (Decision 17) | `apps/web/src/components/primitives/SegmentedControl.tsx` · `apps/web/src/components/shell/SearchPill.tsx` · `apps/web/src/components/shell/ProjectSwitcher.tsx` | `apps/web/src/components/primitives/SegmentedControl.test.tsx` · `apps/web/src/components/shell/SearchPill.test.tsx` · `apps/web/src/components/shell/ProjectSwitcher.test.tsx` |
| REQ-SHELL-109 | §2.0 | The fourth tab is **THREADS**, which *replaced* SESSIONS rather than joining it: the segmented control holds at most `MAX_SEGMENTED_TABS` (4) labels and the strip stays inside the width `Plan §23.5` measured, so a fifth tab fails the build instead of a review | `apps/web/src/components/shell/route.ts` · `apps/web/src/components/shell/ViewTabs.tsx` | `apps/web/src/components/shell/route.test.ts` · `apps/web/src/components/shell/ViewTabs.test.tsx` |
| REQ-SHELL-110 | §2.0 | The THREADS route is project-scoped like every other view (ADR-015) — `/p/:project/threads` and `/p/:project/threads/:id`, with no unscoped variant; an unscoped link resolves through `LegacyRouteResolver` rather than picking a project | `apps/web/src/app/(views)/p/[project]/threads/page.tsx` · `apps/web/src/app/(views)/p/[project]/threads/[id]/page.tsx` · `apps/web/src/components/shell/route.ts` | `apps/web/src/components/shell/route.test.ts` · `scripts/smoke-routes.mjs` |
| REQ-SHELL-111 | §2.0 · §3.1 | §3.1's `/sessions` and `/sessions/:id` stay live as paths **under** the THREADS tab — neither redirected nor removed — and a relay session id never arrives in `ShellRoute.thread` nor a thread id in `.session`, because the two id namespaces do not map (`thread-model.md` §5.1, §9.1 open) | `apps/web/src/components/shell/route.ts` · `apps/web/src/app/(views)/p/[project]/sessions/page.tsx` | `apps/web/src/components/shell/route.test.ts` · `scripts/smoke-routes.mjs` |
| REQ-SHELL-112 | §2.0 · §1.4 | THREADS is reachable and operable from the keyboard through the **real** primitive and the real router — arrows advance in reading order in both directions, `End` reaches it as an ordinal, and a session path selects it so the roving tab stop starts where the reader is (`Plan §23.11` rule 7) | `apps/web/src/components/shell/ViewTabs.tsx` · `apps/web/src/components/primitives/SegmentedControl.tsx` | `apps/web/src/components/shell/ViewTabs.keyboard.test.tsx` |

## Interfaces we expose

Everything below is exported from `apps/web/src/components/shell/index.ts` or
`apps/web/src/lib/*`. Anything not listed is private to the shell and may change without a
message.

- `<AppShell>` — the §2.0 chrome. Already mounted by `app/(views)/layout.tsx`; no view
  should mount it a second time.
- `<ViewMount title owner spec>` — the placeholder a route shows until its owner lands.
  **Replacing one is the point**: swap it in your `page.tsx`, change nothing else.
- `parseShellRoute`, `breadcrumbFor`, `searchPlaceholder`, `viewHref`, `viewHasZoom`,
  `viewHasLiveCounter`, `VIEWS`, `VIEW_LABELS`, `ShellView`, `ShellRoute` — routing as
  pure functions, testable without a router.
- **The project segment, also as pure functions** (M15): `splitProject`, `withProject`,
  `projectPrefix`, `switchProjectHref`, `projectTrail`, `PROJECT_SEGMENT`. `ShellRoute`
  gained `project: string | null`; `null` means *the URL does not say* and must not be
  read as a default (decision 13).
- **`useProjectHref()` / `useProjectSegment()`** — the seam for the four view owners.
  A view builds `href('/map/sales')` and stays in the project it is already in without
  taking a dependency on `ShellContext`. `chart-matrix.md` and `dashboards.md` already
  consume it; `map-galaxy-engineer` and `drawer-engineer` are its other callers.
  **Changing what it prefixes is an ADR, not a refactor.**
- `projectApiUrl(template, project)` (from `useSearchIndex.ts`) — the one place a scoped
  API URL is built. Returns `null` when there is no project, which every caller must read
  as *do not ask*, never as *ask the wide one* (decision 16).
- `useShell()` — `{ route, project, zoom, yourTree, liveCounts, liveCountsMessage, search,
  reducedMotion, helpOpen, projects }`. `project` is a `ProjectScope`: what the URL says,
  what the coordinator confirmed, and — when those differ — the sentence that says so.
- **`src/lib/shell-bus.ts`** — the contract that matters to `map-galaxy-engineer` and
  `chart-matrix-engineer`:
  - shell → canvas: `shell:flyTo` `{target, source, durationMs}`, `shell:zoom`
    `{direction, level?}`, `shell:yourTree` `{enabled}`
  - canvas → shell: `shell:zoomChanged` `{level}`, `shell:liveCount`
    `{department, live, total}`
  A canvas that never emits `shell:liveCount` gets an honest empty counter, not a zero.
- `src/lib/pwa.ts` — `registerServiceWorker`, `isStandalone`, `watchInstallPrompt`,
  `promptInstall`, `enablePushNotifications`, `PushKind`, `PushPayload`. The SESSIONS view
  owns the button that calls `enablePushNotifications`; the shell only exposes it.
- `apps/web/public/sw.js` — imports `/sw-push.js`. That filename is the seam with
  `sessions-relay-engineer`; the shell will not add push handlers to `sw.js`.

## Interfaces we consume

- `comms/contracts/design-tokens.md` (`design-system-guardian`) — every token, plus
  `components/primitives/**`. The shell imports them through one file,
  `components/shell/ui.ts`, so a rename breaks one file rather than fifteen.
- `comms/contracts/api-contracts.md` (`runner-engineer`) — `GET /api/status`
  (`tailscale`, `queueDepth`), `GET /api/p/:project/panels`, and `POST /api/push/subscribe`.
  **`/api/status` is coordinator-level and stays unscoped on purpose** — tailnet state and
  queue depth are facts about the process, not about a project. It is the one shell read
  that decision 16 does not apply to, written down here so it is not "fixed" later.
- `comms/contracts/project-scoping.md` (`runner-engineer`, in trust for
  `platform-projects-engineer`) and `packages/contracts/src/project.ts` — the slug
  predicate, `RESERVED_PROJECT_SLUGS`, `projectPath`, `RUNNER_ROUTES`,
  `COST_TICKER_ROUTE`. The shell defines none of these a second time, which is why
  `/p/all` cannot become a project by disagreement between two regexes.
- `GET /api/projects` → `{projects[], mounted, scopeEnforced}` — the switcher's list and
  the legacy resolver's only input. `mounted` and `scopeEnforced` are read as reported and
  never inferred: `scopeEnforced` is tri-state on purpose, because "not reported" and "not
  enforced" are two different sentences.
- `GET /api/p/:project/cost/today` → `{usd, runs, ledger}` — `observability-engineer`'s
  route, deliberately not proxied by the runner (their FYI of 2026-08-15). The pre-project
  spelling answers 400 and the ticker does not call it (decision 16).
- `comms/contracts/graph-layout.md` (`map-galaxy-engineer`) — `GET /api/p/:project/graph`
  shape for the search index and the live counts. Read defensively: a payload that drifts
  degrades to "nothing indexed", never to a crash in the top bar.
- `agents/**/SKILL.md` via that graph payload only. The shell holds no agent list.

## Test plan

- **Pure logic** (`route.test.ts`, `search.test.ts`, `shell-bus.test.ts`,
  `pwa.test.ts`) — unit, no DOM. Routing, ranking, event typing, base64url decoding.
- **On-disk PWA assets** (`scripts/__tests__/shell-pwa.test.mjs`) — node:test, runs in
  `npm run verify`. Manifest parse, PNG magic bytes, `sw.js` cache rules and the
  no-push-handler invariant. This is the check that actually ships; jsdom has no SW.
- **DOM behaviour** (`*.test.tsx` under `components/shell/`) — Testing Library against a
  stubbed `fetch`. Every endpoint-backed control is tested in three states: answering,
  404 (not built yet), and network error. "What does this look like when the runner is
  down" is a first-class case here, not an afterthought.
- **Keyboard, in both directions the product ships in.** Every arrow-key handler in the
  shell is rendered under `dir="rtl"` as well as `dir="ltr"` — the ones that mirror
  (REQ-SHELL-107) and, just as deliberately, the ones that must not (REQ-SHELL-108). This is
  a standing rule, not a one-off: **an LTR-only render is how the same bug stays green**, and
  it is what kept a backwards tablist on the shell's primary navigation. New RTL cases are
  run against the *pre-fix* handler and confirmed red before the fix is kept; the four
  direction-sensitive cases here were, on 2026-08-17. A regression test that has never been
  red is a description, not a test.
- **Token discipline** — `node scripts/check-tokens.mjs`. Zero violations in
  `components/shell/**`, `src/lib/**` and `src/app/**` is the standing bar.
- **Two rows are owed a test and say so with `—`** (which is what makes
  `validate:coverage` warn on them rather than passing them in silence):
  **REQ-SHELL-105**, the search panel's no-project sentence — the shared helper it rests
  on is pinned by `CostTicker.test.tsx` (REQ-SHELL-103), but the panel's own copy is not,
  and one `SearchPill.test.tsx` case at `pathname: '/map'` closes it. **REQ-SHELL-106**,
  the drop-the-previous-answer rule in `useEndpoint` — this one is genuinely unreachable
  today, because the coordinator mounts one project and refuses every other with
  `project_not_mounted`, so a test would have to drive the hook directly rather than a
  surface. Both are in scope for me and were left out of this pass only because it was
  scoped to the spec file.
- **Not automatable here.** (a) The 1440px side-by-side against their frame — that is
  `fidelity-qa-reviewer`'s gate (PART VI). (b) Real install-to-home-screen on iOS and
  Android, and a real push arriving while the app is closed: both need a device on the
  tailnet, and both are on the M4 manual checklist with `sessions-relay-engineer`.
  (c) Service worker caching behaviour — jsdom has no SW; `sw.js` is verified by reading
  it and by the device checklist, which is why it is deliberately small and dependency-free.

## Deliberately not done

- **§2.7 in full.** Phase 4, and marked optional in the spec of record. Enumerated above
  with `—` so the section is owned and countable before it is built.
- **A login screen.** §3.6 says the app has no auth in v1 by design. Building one "for
  later" would invite code that is only safe because auth exists.
- **Offline data.** The shell caches; `/api/*` does not. No stale KPIs, no optimistic
  numbers, no last-known-good cost ticker.
- **A push module in `sw.js`.** Owned by `sessions-relay-engineer` (decision 9). The
  shell provides the import point, the badge asset and the browser-side handshake.
- **A command palette.** Search is scoped to finding a job, a department or a panel.
  Turning it into an action launcher would put "run this agent" behind a text field with
  no confirmation, which contradicts §3.2's approval model.
- **Recent searches or any client persistence.** Nothing is stored per user because there
  is no user (decision 11).
- **Keyboard shortcuts for tab switching.** Global `1`–`4` accelerators are not in §2.0 and
  would collide with whatever the canvas owners want the number row for. Their call, later.
  The segmented control is arrow-key navigable where it is focused — **which is now
  REQ-SHELL-107/108 with a test behind it, in both directions, rather than the bare sentence
  that used to stand here.** That sentence was this spec's only statement about the tab
  keyboard and nothing checked it; the control had been walking backwards in Arabic the whole
  time it was on the page. A claim in a *Deliberately not done* bullet is the easiest place
  in a spec for an untested assertion to hide, because the section is read as a list of
  absences rather than a list of promises.
- **Real icon artwork.** The three icons and the badge are generated monochrome
  placeholders, marked as such in `public/icons/README.md`.
- **A visible install banner.** The affordance sits in the `?` sheet; §2.0 fixes what is
  in the top bar and an uninvited banner over the galaxy would be the first thing anyone
  screenshotting this product would want removed.

### M15 — deliberately not done

- **A `p/[project]/layout.tsx` that validates the slug and 404s.** An unknown project
  renders, and the switcher and the trail both mark it unconfirmed in the visible label
  (REQ-SHELL-98, REQ-SHELL-99). Refusing the page instead would put the coordinator's
  project list on the critical path of every navigation, and would turn "the runner is
  down" into "your project does not exist" — which is the wrong sentence and the one a
  reader would act on.
- **A static redirect for the legacy paths.** Decision 14: the build cannot know which
  library a coordinator mounts, so the redirect has to ask. This costs one frame on a
  bookmarked link and buys the property that no deployment can relabel another's data.
- **The all-projects search toggle** (`/api/all/…` exists in the contract). A second
  project would be needed to show that it scopes anything, and a toggle whose two states
  look identical teaches the reader that scope is decorative.
- **The cost ticker's account split** (`work $12.40 · personal $3.10`, `Plan §23.12`). It
  lands as a field on the existing `amount` reading, not as a second component — the
  formatter and the four unknown-shaped cases are reusable as they stand. Blocked on
  `ops.credential` having more than one row, not on shell work.
- **Any client persistence of "the last project you were in."** Decision 11 still holds:
  there is no user, so there is nowhere honest to keep it. The URL is the state.
- **A project field in push deep links.** A notification payload has no project yet, so a
  tapped notification resolves through the legacy catch-all. That field is
  `sessions-relay-engineer`'s to add (§3.6); the shell will consume it the day it exists.
