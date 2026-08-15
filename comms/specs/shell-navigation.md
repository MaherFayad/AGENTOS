# Spec — the app shell, search, routing and the PWA

> The implementation spec for the parts of `skilltree-clone-spec.md` that are the same on
> every view, plus the phone story. Checked by `npm run validate:coverage`.

## Owner

`shell-navigation-engineer`

## Spec sections covered

PART II (the shell that all its screens share) · §2.0 · §2.7 · §3.6

Boundary: PART II's per-screen sections are claimed by their own owners in BOARD.md —
this spec claims only the shell that §2.0 calls "identical on all three views", the route
skeleton every screen mounts into, the Phase 4 marketing elements, and the phone. The
coverage checker reads every section id under this heading as an ownership claim, so no
other id appears here; where a requirement touches a neighbour, the row says whose it is.

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
| REQ-SHELL-46 | PART II | URL reflects view state: `/map`, `/dashboards`, `/chart`, `/sessions` | `apps/web/src/components/shell/route.ts` · `apps/web/src/app/(views)/map/page.tsx` | `apps/web/src/components/shell/route.test.ts` |
| REQ-SHELL-47 | PART II | Drill-ins are addressable: `/map/:department` and `/chart/:department` | `apps/web/src/app/(views)/map/[department]/page.tsx` · `apps/web/src/app/(views)/chart/[department]/page.tsx` | `apps/web/src/components/shell/route.test.ts` |
| REQ-SHELL-48 | PART II | An open drawer is addressable: `/map/:department/:agent` | `apps/web/src/app/(views)/map/[department]/[agent]/page.tsx` | `apps/web/src/components/shell/route.test.ts` |
| REQ-SHELL-49 | PART II | A dashboard and a session are addressable: `/dashboards/:id`, `/sessions/:id` | `apps/web/src/app/(views)/dashboards/[id]/page.tsx` · `apps/web/src/app/(views)/sessions/[id]/page.tsx` | `apps/web/src/components/shell/route.test.ts` |
| REQ-SHELL-50 | PART II | Back and forward behave, because navigation is router pushes and no view holds shadow state | `apps/web/src/components/shell/ViewTabs.tsx` · `apps/web/src/components/shell/route.ts` | `apps/web/src/components/shell/route.test.ts` |
| REQ-SHELL-51 | PART II | An unknown or root path resolves to MAP rather than erroring | `apps/web/src/components/shell/route.ts` · `apps/web/src/app/page.tsx` | `apps/web/src/components/shell/route.test.ts` |
| REQ-SHELL-52 | PART II | Every view route is a mount point an owning agent swaps into, with an honest empty state until then | `apps/web/src/components/shell/ViewMount.tsx` | `apps/web/src/components/shell/AppShell.test.tsx` |
| REQ-SHELL-53 | PART II | The shell↔canvas seam is five named, typed events and nothing else | `apps/web/src/lib/shell-bus.ts` | `apps/web/src/lib/shell-bus.test.ts` |
| REQ-SHELL-54 | §3.6 | A web app manifest is served with name, short_name, start_url, scope and `display: standalone` | `apps/web/public/manifest.webmanifest` | `apps/web/src/lib/pwa.test.ts` |
| REQ-SHELL-55 | §3.6 | The manifest is linked from the document head | `apps/web/src/app/(views)/layout.tsx` | `apps/web/src/lib/pwa.test.ts` |
| REQ-SHELL-56 | §3.6 | The installed app is dark: theme_color and background_color are the near-black `--bg` | `apps/web/public/manifest.webmanifest` | `apps/web/src/lib/pwa.test.ts` |
| REQ-SHELL-57 | §3.6 | Icons exist at 192 and 512 plus a maskable 512 | `apps/web/public/icons/icon-192.png` · `apps/web/public/icons/icon-512.png` · `apps/web/public/icons/icon-maskable-512.png` | `apps/web/src/lib/pwa.test.ts` |
| REQ-SHELL-58 | §3.6 | The icons are monochrome placeholders and are labelled as placeholders in the repo | `apps/web/public/icons/README.md` | `apps/web/public/icons/README.md` |
| REQ-SHELL-59 | §3.6 | A notification badge asset exists at the path the relay's worker references | `apps/web/public/icons/badge-72.png` | `apps/web/public/sw-push.js` |
| REQ-SHELL-60 | §3.6 | The service worker registers once on mount and a failed registration never breaks the app | `apps/web/src/components/shell/PwaRegistrar.tsx` · `apps/web/src/lib/pwa.ts` | `apps/web/src/lib/pwa.test.ts` |
| REQ-SHELL-61 | §3.6 | The app shell, manifest, icons and offline page are precached at install | `apps/web/public/sw.js` | `apps/web/src/lib/pwa.test.ts` |
| REQ-SHELL-62 | §3.6 | `/api/*` and `/ws/*` are never cached and never replayed | `apps/web/public/sw.js` | `apps/web/src/lib/pwa.test.ts` |
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
| REQ-SHELL-74 | §3.6 | `sw.js` imports the relay's push module and registers no push handler of its own | `apps/web/public/sw.js` | `apps/web/src/lib/pwa.test.ts` |
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
- `useShell()` — `{ route, zoom, yourTree, liveCounts, liveCountsMessage, search,
  reducedMotion, helpOpen }`.
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
  (`tailscale`, `queueDepth`), `GET /api/panels`, and `POST /api/push/subscribe`.
- `GET /api/cost/today` → `{usd}` — `observability-engineer`'s route, deliberately not
  proxied by the runner (their FYI of 2026-08-15). The ticker reads it directly.
- `comms/contracts/graph-layout.md` (`map-galaxy-engineer`) — `GET /api/graph` shape for
  the search index and the live counts. Read defensively: a payload that drifts degrades
  to "nothing indexed", never to a crash in the top bar.
- `agents/**/SKILL.md` via that graph payload only. The shell holds no agent list.

## Test plan

- **Pure logic** (`route.test.ts`, `search.test.ts`, `shell-bus.test.ts`,
  `pwa.test.ts`) — unit, no DOM. Routing, ranking, event typing, base64url decoding.
- **DOM behaviour** (`*.test.tsx` under `components/shell/`) — Testing Library against a
  stubbed `fetch`. Every endpoint-backed control is tested in three states: answering,
  404 (not built yet), and network error. "What does this look like when the runner is
  down" is a first-class case here, not an afterthought.
- **Token discipline** — `node scripts/check-tokens.mjs`. Zero violations in
  `components/shell/**`, `src/lib/**` and `src/app/**` is the standing bar.
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
- **Keyboard shortcuts for tab switching.** The segmented control is arrow-key navigable
  where it is focused; global `1`–`4` accelerators are not in §2.0 and would collide with
  whatever the canvas owners want the number row for. Their call, later.
- **Real icon artwork.** The three icons and the badge are generated monochrome
  placeholders, marked as such in `public/icons/README.md`.
- **A visible install banner.** The affordance sits in the `?` sheet; §2.0 fixes what is
  in the top bar and an uninvited banner over the galaxy would be the first thing anyone
  screenshotting this product would want removed.
