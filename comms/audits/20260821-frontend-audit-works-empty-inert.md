# Frontend audit — what works, what is honestly empty, what is inert

**Reviewer:** `fidelity-qa-reviewer` · **Requested by:** the user (audit, **not a gate** — no PASS/FAIL)
**Observed:** 2026-08-21 17:40–18:10 +03:00, against the live stack the user provided:
`next dev` on `http://127.0.0.1:4321` (`.next` wiped before boot) and the runner on
`http://127.0.0.1:8787` (loopback, **no API key**, **no Postgres**).
**Instrument:** headless Chrome at exactly 1440×900 over CDP, driven by a probe kept in the
session scratchpad — never in `apps/`, `packages/` or `scripts/`. Every number below is a
**reading taken in that browser**, not a claim read off source.

## What I could not compare

**The 1440px side-by-side in spec Part VI was not performed, because the reference frames
still do not exist.** I measured our geometry against the spec's *written* numbers and they
match (drawer 300px / radius 18px / `blur(14px)`; watermark Instrument Serif 160px italic;
branch labels 19px at +0.40em; section labels 11px at +0.30em; ladder labels 9px at +0.25em;
widget grid 2×532px at 16px gap; all six motion durations exact). **That is conformance to
the written spec, not fidelity to the video.** Do not read it as the latter.

---

# 1. The honest three-way inventory

## 1.1 WORKS — a user does this today, end to end, and sees a real result

| Surface | Evidence taken in Chrome |
|---|---|
| **MAP galaxy** `/p/agentos/map` | 60 nodes rendered from `GET /api/p/agentos/graph` — 12 `job`, 41 `leaf`, 7 `anchor`. Pan, wheel-zoom, node drag, `‹ ›` department rotation, starfield canvas repainting. |
| **MAP department** `/map/sales` | Watermark `SALES` Instrument Serif 160px italic; sub-cluster caps; both rotated rails (`BACK OFFICE` / `DEALS`); `0 · 2 · YOUR TREE` counter with the copper live numeral. |
| **MAP drawer** `/map/sales/account-enrichment` | All ten §2.3 sections in spec order, plus provenance badge, `LAST RUNS`, `WORK PRODUCTS`, `INPUTS`. Real prose from `agents/sales/account-enrichment/SKILL.md`. **URL-addressable and shareable.** |
| **Leaf → parent resolution** | Clicking `sales/account-enrichment/growth-signal-scorer` on the canvas correctly navigates to the *parent* agent's drawer. The map's own click path is right. |
| **CHART** `/chart/sales` | Same frontmatter, `tier × phase` projection. Tab bar, stat line, 4-segment phase dashes, diagonal-hatch empty cells, card expand → description + SKILLS chips + `More detail →` → right drawer (x=1080, w=360) carrying §2.6.5's exact anatomy incl. the `NOW` badge. |
| **DASHBOARDS carousel** | Six centres from `panels/*.json`, `‹ ›`, dots, drag-spin, `DRAG TO SPIN · CLICK THE FRONT CARD TO ENTER`, front card → detail. |
| **DASHBOARDS detail** | 2-col grid, 16px gap, both edge rails (`FINANCE` / `PIPELINE`) navigating panel-to-panel, `7D/14D/28D` segmented filter, the Mission Control footer. |
| **Shell** | Four tabs, breadcrumbs, project switcher, fullscreen, help sheet, `/sessions` → `/threads` **307**, `/sessions/:id` still live. |
| **Reduced motion** | Under `prefers-reduced-motion: reduce` the six duration tokens all resolve to `1ms`, `transition-property` stays `transform` (**no layout change**), and the galaxy canvas **stills completely** — two `toDataURL` snapshots 1.2s apart are byte-identical, versus both differing at normal motion. `<canvas aria-hidden="true">`. |
| **Drawer a11y** | `aria-modal="true"`, `aria-labelledby` set, Esc closes both flavours, scrim is a real `<button>`. The parked console and review overlays are `inert` + `aria-hidden="true"` and translated off — **zero tabbables leak** (M17's fix holds in real Chrome). |
| **RTL** | `dir="rtl"` alone moves the drawer from x=0 to x=1140 and reverses the tab order. Logical properties throughout. |

## 1.2 HONESTLY EMPTY — wired right, absent for a named reason

Every one of these renders a written sentence instead of a zero, a spinner or a blank.
This is the app's best quality and it is not a small thing.

| Surface | What would fill it |
|---|---|
| `LAST RUNS`, run console, `WORK PRODUCTS` | `RUNNER_ANTHROPIC_API_KEY` + one executed run |
| Six Mission Control KPIs, activity feed, area chart, bar lists, cost table, last-runs table | `DATABASE_URL` + `0005`–`0008`, then a run that writes a ledger row |
| `The week ahead` calendar | `0011` against a live Postgres + an agent put on a clock |
| `AGENT THREADS`, `/threads/:id` | a runner route that lists threads **and** a thread store — the copy names *both*, correctly |
| Cost ticker, `N OF n LIVE` | Langfuse reachable |
| Connection pill | a Tailscale interface |
| Second Brain core (`0 of 20 questions answered`) | the twenty `COMPANY.md` answers |
| `/sessions/:id` | the E2E unlock gate is shown first — correct, and it should stay that way |

Best-written examples, verbatim from the DOM:

> *"Two things are missing, not one: the runner serves no route that lists threads, and the
> table they would come from has never met a running database. This is an absence of a
> reading, not a count of zero."* — `/threads`

> *"No agent at "sales/no-such-agent" in this project. Nothing exists at
> `agents/sales/no-such-agent/SKILL.md` in this project's library or in its overrides."*

## 1.3 INERT — renders, cannot act

**The column that matters is the last one.**

| Control | Reason exists? | **Shown on screen?** |
|---|---|---|
| `▶ Run now` | yes | **NO** — `title=""`, reason is a 1×1 `.srOnly` span |
| `⏰ Schedule` | yes | **NO** — same |
| `Take it ↓` | yes | **NO** — `title` tooltip only |
| Chart drawer: 3× autonomy toggle, 3× `Read →`, 3× `Download ⬇`, 3× `▶ Run`, `Take it ↓`, `▶ Run now`, `Schedule` (**16 of 18 controls**) | yes, and each is specific and good | **NO** — `title` only, every one |
| `⌨ Build guide + one-shot prompt` | **no** | **NO** — silent no-op, see F3 |
| `/p/<unknown>/map` project chip | yes | **NO** — `title` + `aria-label`; on screen it is one `?` glyph beside a full, wrong galaxy |
| Mailbox `Send`, `STEER` | yes | **yes** — visible text |
| `Approve` / `Request changes` | yes | **yes** — visible caveat *and* a visible blocker line |
| `Get this deployed →` | yes | **yes**, and it even names the JSON edit that turns it on |
| Zoom `− / +` off MAP/CHART | yes | `title` only (minor — the readout shows `—`) |
| **Arabic / RTL** | `app/layout.tsx:32` `const locale = DEFAULT_LOCALE` | **comment only.** Two full catalogues, `strings.ar.ts`, direction logic and an RTL gate exist; **no user can reach any of it.** M8. |

---

# 2. Findings, ranked by damage to usefulness

## F1 — Search dead-ends on 48 of 60 nodes (80%)

`apps/web/src/components/shell/useSearchIndex.ts:118-128`

```ts
...nodes.map((node) => ({
  id: node.id,
  kind: 'agent' as const,
  href: withProject(
    node.department ? `/map/${node.department}/${node.id.split('/').pop()}` : '/map',
    project,
  ),
```

`GET /api/p/agentos/graph` returns each node with an explicit **`kind`** — `job` (12),
`leaf` (41), `anchor` (7). The index reads `id`, `label`, `description`, `department` and
`status`, and **drops `kind`**. `.pop()` then takes the last segment of every id:

- `sales/account-enrichment` → `/map/sales/account-enrichment` — correct (12 nodes)
- `sales/account-enrichment/growth-signal-scorer` → `/map/sales/growth-signal-scorer` — 404 drawer
- `sales/_anchor` → `/map/sales/_anchor` — 404 drawer

Measured, not inferred: typing `growth` → `↓` → `Enter` navigates to
`/p/agentos/map/sales/growth-signal-scorer` and opens a drawer reading **"This agent could
not be loaded."** with **zero focusable elements — not even a `✕`.**

Why this is the top finding: fidelity-check §5 makes search *the map's non-visual path*, and
`a11y.mapCanvas` promises it. It is also the fastest mouse path. Four in five results are a
dead end, and the map's own click handler already resolves leaves correctly — so the app
knows the right answer and search doesn't ask.

**Smallest fix:** read `kind` in `parseGraph` and branch the href — `anchor` →
`/map/{department}`, `leaf` → drop the last segment (the parent job), `job` → as today.
This is the standing *"a producer without a consumer"* finding in a new costume.

## F2 — The reason a control is disabled is invisible to sighted and touch users

`apps/web/src/drawer/sections/SkillFileCard.tsx:110-147`

The comment above the code is right about the mechanism and wrong about the audience:

```ts
// Disabled Pill uses pointer-events-none, so the runner-down reason must live
// on a hoverable/focusable carrier — do not put title only on the disabled button.
<span className={s.disabledAction} title={capabilities.reason ?? undefined} tabIndex={0}
      aria-describedby="drawer-run-disabled-reason">
  <span id="drawer-run-disabled-reason" className={s.srOnly}>{capabilities.reason}</span>
  <Pill variant="primary" disabled>▶ Run now</Pill>
```

Measured: `▶ Run now` and `Schedule` both have `title=""`, `aria-label=null`,
`opacity: 0.4`, `cursor: default`. The sentence *"The runner is up but has no API key, so
nothing can be started. Nothing was sent."* renders at **1×1 px** (`drawer.module.css:338`).

So the reason reaches a screen reader and nobody else. `title` requires a ~1s hover and
**never fires on touch** — and §3.6 says the phone *is* the reason the PWA exists. The
CHART drawer is the same failure sixteen times over: 16 of 18 controls disabled, every
reason specific and good, every one `title`-only. At 1440×900 that panel is a wall of grey
buttons with no explanation on screen.

This damages usefulness more than any missing feature, because it converts *"the key isn't
set"* into *"this app is broken."*

**Smallest fix:** render `capabilities.reason` as a visible `s.sectionNote` line under the
button row — the exact treatment already used, correctly, by `Approve` / `Request changes`
and `Get this deployed →` two hundred lines away. The `title` + `sr-only` carrier can stay.

## F3 — `⌨ Build guide + one-shot prompt` is a silent no-op off `localhost`

`apps/web/src/dashboards/components/DashboardDetail.tsx:36-44`

```ts
const copyPrompt = async () => {
  try { await navigator.clipboard.writeText(prompt); setCopied(true); … }
  catch { setCopied(false); }
};
```

Clicked it in Chrome: no dialog, no text change, `document.body.innerText` grew by **0**,
focus fell back to `BODY`. `navigator.clipboard` requires a **secure context**. Rule 6 says
tailnet-only, no public ports — so the normal way to reach this app is
`http://<magicdns-name>:3000`, which is **not** a secure context. `navigator.clipboard` is
`undefined` there, the `TypeError` is swallowed by the empty `catch`, and the button does
nothing forever with no error and no fallback.

Also: the label promises a *"Build guide"*. There is no guide — only a clipboard write.

**Smallest fix:** on failure, reveal the prompt in a `<details>`/textarea the user can
select. That also makes the feature work on the phone, where clipboard permission is worse.

## F4 — An unknown project renders another project's library as its own

`/p/nosuchproject/map` returns **200** and draws all 60 `agentos` nodes and seven
departments. The project chip carries the truth —
`title`: *"The runner does not list a project called "nosuchproject". It serves "agentos"."*
`aria-label`: *"Project: nosuchproject. Not confirmed by the runner."* — but on screen that
is a single `?` glyph next to a full, confident, wrong map.

Rule 2 says views are projections of that project's `agents/**/SKILL.md`. This one is a
projection of somebody else's. Same shape as F2: the honest sentence exists and is hidden
behind the loud surface that contradicts it.

**Smallest fix:** when the runner does not list the project, replace the canvas with the
sentence that is already written, rather than putting it in a tooltip beside the canvas.

## F5 — An unknown dashboard id silently becomes the carousel

`/p/agentos/dashboards/nope` → **200**, renders the carousel, and the breadcrumb reads
`AGENTOS › NOPE`. Nothing says the id was not found; the breadcrumb *asserts* it exists.
Compare `/map/sales/no-such-agent`, which is exemplary. The map's handling is the one to
copy.

## F6 — The focus ring is effectively invisible, and the galaxy has none of its own

Two separate problems, measured by focusing each control and reading computed style.

**(a) No global `:focus-visible` rule exists.** Eighteen files declare their own. The house
ring is `outline: 1px solid var(--line-2)` = `rgba(255,255,255,.16)`, which composites over
`--bg` `#111114` to `rgb(55,55,57)` — **1.60:1**. WCAG 2.2 SC 1.4.11 requires **3:1** for a
focus indicator. `--line-2` is a *hairline* token; the fidelity skill's own §5 names it,
and that wording should change. `--ivory-2` at the same 1px gives **9.0:1**, and
`map/svg/Nodes.tsx:206` already uses an `--ivory` dashed ring — the codebase's better half.

**(b) The galaxy's primary navigation targets have no ring at all.**
- `apps/web/src/map/svg/BranchLabels.tsx:24-42` — the seven department labels are
  `role="button" tabIndex={0}` with **no focus style**; measured `outline: auto 5px`, the
  browser default.
- `apps/web/src/map/MapView.tsx:456-461` — the `<svg>` root is `role="group" tabIndex={0}`,
  also UA `auto`, which paints a ring around the entire 1440×900 viewport.

## F7 — Mission Control states one fact thirteen times

Counted in the rendered text: **7×** *"Cannot reach the runner, so ledger-backed numbers are
unavailable. This box may be off the tailnet."* and **6×** *"No figure yet."* One cause,
thirteen restatements, no page-level banner. Rule 9 is kept; fidelity-check §7's *"written
like a human wrote it"* is not — a human would say it once, at the top, and dim the grid.

The signals strip already carries the better sentence (*"Mission Control is the only center
that is real today…"*). Lift the runner-absence sentence to sit beside it and let the
widgets show a short dash.

## F8 — `INPUTS` is 1,375px below the `▶ Run now` button it feeds

Measured y-offsets inside the drawer's 1,800px scroll body: `▶ Run now` at **303**,
`INPUTS` (`Account website · required`) at **1,678**. Spec §2.3 defines `INPUTS` as *"form
fields generated from frontmatter `inputs:` used by ▶ Run"*. On the day the key lands, the
flow is: press a button at the top, scroll past nine sections, fill a required field, scroll
back. Everything above `INPUTS` in the order is reading material; the run controls and their
form are the only two things a user *acts* on and they are at opposite ends.

Sections 1–10 in spec order is otherwise exactly right and should not be disturbed —
`INPUTS`, `LAST RUNS` and `WORK PRODUCTS` are our additions and their placement is ours to
choose.

## F9 — Scaffolding metadata is shipping as a user-facing error page

`apps/web/src/components/shell/ViewMount.tsx:24-33`, used at
`app/(views)/offline/page.tsx:13` and three times in `LegacyRouteResolver.tsx`.

`/offline` renders `§3.6` and **`BUILT BY SHELL-NAVIGATION-ENGINEER`** to a user whose only
problem is that Tailscale is down. The component's own docstring says it is *"the empty
state a route shows **before** its owning agent has mounted a view into it"* — it has
outlived that job in four places that are now permanent, shipped states. The body copy
itself is excellent; the spec-section eyebrow and the owner byline are internal.

## F10 — The CHART drawer is not addressable

`More detail →` opens the right drawer and `location.pathname` **does not change**
(stays `/p/agentos/chart/sales`). The MAP drawer is a route (`/map/:dept/:agent`) and can be
linked, shared and reloaded. Two drawers, two models, one grammar. Esc closes both.

## Minor, noted not argued

- `/map/sales/no-such-agent` and every not-found drawer render **zero focusables** — no
  `✕`. Esc and scrim-click work; there is no visible close affordance.
- Its copy is engineer-facing: *"Check the id on the map — it is the folder path, not the
  display name."* That instructs a frontmatter author, not someone who clicked a link.
- `apps/web/src/dashboards/components/DataTable.tsx:66` maps rows with no cap. Latent only —
  no `sql` widget returns rows yet. The console is bounded correctly
  (`console-model.ts:22` `MAX_LINES = 2000`, oldest dropped and counted).
- Tailwind preflight's `rgb(229,231,235)` is the computed `border-color` on many elements.
  Invisible today (`border-width: 0`), but it is a non-token literal one utility class away
  from being seen. Set `--default-border-color` to `var(--line)`.

---

# 3. Judgement — design, structure, usefulness

## Where it is genuinely good, and why

**The empty-state writing is better than most shipped products', and it is the single
biggest reason this app is trustworthy.** It does not say "no data." It says *which* of two
things is missing, on whose side, and what turns it on — sometimes naming the exact
`docker compose` profile or the JSON key to add. `unknown` and `zero` are consistently
different words. Rule 9 is not a slogan here; it is visible in the DOM on every route.

**Monochrome discipline holds.** Zero hex outside `tokens.css` (comments and the token
mirror-test aside). Sweeping every rendered element's `color`, `background-color`,
`border-color`, `fill` and `stroke` across seven routes, the **only** chromatic values on
screen are `#E08A50` (`--ink-copper-2`, the autonomy eyebrow) and `#C9784A`
(`--ink-copper`, the live-count numeral). Both are data, and both are spec-mandated
(§2.3.1, §2.2). No tinted border, no coloured tab, no blue focus ring anywhere.

**Motion is exact and reduced-motion is real.** 500 / 320 / 600 / 700 / 300 / 160ms, both
easings `cubic-bezier(.2,.7,.2,1)`, all → 1ms under `reduce` with no layout change, and the
canvas actually stops. Verified by pixel comparison, not by reading CSS.

**M17's inert half holds.** Both parked overlays are `inert` + `aria-hidden`, the trap
scopes correctly, Esc closes, the scrim is a real button.

**Type is on-spec where it counts.** Wide caps land at +0.25em–0.40em everywhere I measured
— the under-tracking that usually fails this check does not happen here.

## Structure

352 source files across thirteen routes, organised by **feature**, not by kind:
`map/ chart/ dashboards/ drawer/ threads/ sessions/ schedules/` each with its own
`data/ model/ components/`, over shared `components/primitives` + `components/shell` +
`i18n/ lib/ styles/`. The code structure matches the feature structure, ownership maps onto
folders, and the barrel is gated. The MAP and CHART drawers sharing one component with two
flavours is correct, not a smell — spec §2.6.5 calls the chart one a mirror.

The one structural gap is the absence of a **global `:focus-visible`** rule (F6): eighteen
files each inventing the ring is exactly how two of them ended up with the browser's.

## Is it actually useful for the use case?

**Today: it is an excellent reader and a non-functional writer — and it is honest about
which is which nearly everywhere.**

As a *reader* of your agent library it already earns its place: the galaxy, the department
drill-in, the tier×phase rollout board and the drawer are four genuinely different, genuinely
useful views of one `agents/**/SKILL.md` tree, with no view keeping its own copy. Sixty
nodes, three projections, one source. That is Part IV working.

As a *writer* — run, schedule, approve, steer, download — nothing can act, which is expected
with no key and no Postgres, and is not a criticism. **The criticism is F2**: the app has
written a specific, correct, human explanation for every single dead control and then hidden
sixteen of them in tooltips and 1×1 spans. A user who opens the CHART drawer sees sixteen
grey buttons and no words. The build's greatest strength — saying exactly what is absent and
why — is switched off at precisely the moment the user most needs it, and switched off
hardest on the phone the PWA exists for.

Fix F1 and F2 and this becomes a genuinely pleasant tool to browse and understand an agent
estate, with a clearly-labelled set of levers waiting on one API key. Neither is a redesign;
F2 is moving a string that is already written into a paragraph that already has a style.
