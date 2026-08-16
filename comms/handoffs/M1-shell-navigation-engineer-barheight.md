---
agent: shell-navigation-engineer
milestone: M1
spec: §2.0, §2.7, §3.6
created: 2026-08-16T15:20
status: ready-for-review
---

# M1 — The shell publishes its own height, and views stop colliding with it

## The bug this closes

On `/chart` at 1440×900 the CHART department tab bar (SALES · DEALS · MARKETING ·
OPERATIONS · INTELLIGENCE · CUSTOMER · BACK OFFICE) rendered on the **same row** as the
shell's top bar. The tabs overprinted the search pill on the left and the
MAP/DASHBOARDS/CHART/SESSIONS segmented control in the centre — two labels interleaved
into unreadable garbage. Before: `scratchpad/chart-before.png`.

The transparent floating bar is correct and stays (§2.0). What was missing is that the
bar *claims* a band of the viewport and nothing told views about it. MAP got away with it
because its canvas is full-bleed and its labels sit low; DASHBOARDS got away with it by
typing `72px` and `88px` into its own stylesheet. CHART, being the first honest
document-flow view, hit it head-on.

Fixed as a shell contract, not as CHART padding. **CHART was not touched at all.**

## What exists now

- `apps/web/src/styles/tokens.css` — new `§2.0 Shell metrics` block (geometry only, no
  colour): `--shell-control-h`, `--shell-pad-t`, `--shell-pad-b`, `--shell-gap`,
  `--shell-bar-t` / `--shell-bar-b` (the chrome's occupied height, safe-area included),
  and `--shell-inset-t` / `--shell-inset-b` (what a flow view must keep clear). A second
  `[data-shell-root]` rule re-derives the two insets — that is not redundant, see below.
- `apps/web/src/components/shell/useShellInsets.ts` — new. A `ResizeObserver` on the real
  chrome writes the **measured** `--shell-bar-*` onto the shell root once painted, so the
  declared value can never drift from the rendered one.
- `apps/web/src/components/shell/route.ts` — new `viewSurface(view): 'canvas' | 'flow'`
  plus the `CANVAS_VIEWS` exception list.
- `apps/web/src/components/shell/AppShell.tsx` — split into `AppShell` (provider) and a
  route-aware `ShellFrame`. `<main>` now carries `data-surface` and, for `flow` views,
  `pt-[var(--shell-inset-t)] pb-[var(--shell-inset-b)] overflow-auto overscroll-contain`.
  The top cluster (TopBar + BreadcrumbStrip) and the bottom cluster are each wrapped so
  they can be measured.
- `apps/web/src/components/shell/TopBar.tsx` — the same grid becomes two rows below `sm`
  (§3.6, see "Phone" below).
- `apps/web/src/components/shell/SearchPill.tsx` — 150px below 420px wide, 184px from
  there, the spec's 220px from `sm`.
- `apps/web/src/app/(views)/layout.tsx` — the contract, written down where a view author
  will find it.
- `apps/web/src/components/shell/route.test.ts` — three tests pinning `viewSurface`,
  including that `flow` is the default.

## How to use it

**If you are building a view under `(views)/`, do nothing.** The shell already reserves
its band for you; your first row starts below the bar with no padding of your own.

**If your view is a full-bleed canvas** that deliberately paints under the bar, add it to
`CANVAS_VIEWS` in `components/shell/route.ts` and place your own content clear of the
chrome by reading the same two variables:

```css
.myCanvasHeader { padding-top: var(--shell-inset-t); }
```

```tsx
<div className="pt-[var(--shell-inset-t)]">…</div>
```

Never type the bar's height as a literal. `--shell-inset-t` is 66px on `/chart`, 85px on
`/chart/marketing` (the breadcrumb strip only exists in a drill-in), 106px on a 375px
phone (the bar is two rows there) and larger again on a notched device. No literal is
right in all four.

### Why the `[data-shell-root]` rule exists

A custom property's `calc()` resolves **where it is declared**. `--shell-inset-t` declared
on `:root` is frozen at the declared bar height, so an inline `--shell-bar-t` written on a
descendant would be silently ignored. Repeating the formula on `[data-shell-root]` is what
lets the measurement flow through. This was a real bug during the fix: the first build
measured 52px and still padded 60px.

## Contracts touched

None changed. `comms/contracts/design-tokens.md` is `design-system-guardian`'s and its
colour/type/motion values are untouched — the added block is geometry, permitted by the
"only tokens.css may hold literals" rule and by my file boundary for this task. If the
guardian wants these promoted into `tailwind.config.ts` as named spacing utilities
(`pt-shell`), that is their call and their file; the vars work as-is without it. No ADR:
this adds a mechanism, it does not overrule a spec decision.

## Deliberately not done

1. **DASHBOARDS still hardcodes the band.** `dashboards.module.css` has
   `padding-top: calc(72px + var(--dash-safe-t))` (line 70) and
   `padding: calc(88px + var(--dash-safe-t)) …` (line 245). Both are now wrong on a phone
   (the real band is 92px) and both will drift. I classified `dashboards` as `canvas` so
   its pixels are **identical** before and after — I will not silently re-lay-out another
   agent's view. FYI filed; `dashboards-engineer` swaps the literals for
   `var(--shell-inset-t)` and the numbers become right everywhere at once.
2. **SESSIONS' own top padding.** `sessions.module.css` `.tab` header is `padding: 20px
   20px 12px` and `.view` (the transcript) is `calc(12px + var(--ses-safe-t))`. Both would
   have printed under the bar; classifying `sessions` as `flow` fixes them from the shell
   side without editing that agent's file. The KeyGate moved 3px (it is centred). FYI
   filed so they know the shell now reserves the band and they should not add their own.
3. **CHART's matrix at 375px.** The rollout matrix squeezes its four phase columns into
   375px and the phase labels overlap each other. That is horizontal, inside §2.6, and
   `chart-matrix-engineer`'s to solve (the matrix needs its own `overflow-x` region). The
   vertical collision this task was about is fixed. FYI filed.
4. **`tailwind.config.ts` spacing utilities.** `pt-[var(--shell-inset-t)]` is an arbitrary
   value where `pt-shell-t` would read better, but that file is Part I and not mine.
5. **The quarantined shell tests.** `src/test/quarantine.ts` still excludes all eight
   shell component suites (circular `vi.mock` deadlock, mine to fix, tracked in
   `M0-fidelity-qa-reviewer-test-runner.md`). `AppShell.test.tsx` therefore did not run;
   the new behaviour is pinned in `route.test.ts`, which does. Unblocking the quarantine
   is a separate piece of work and I did not smuggle it into this one.
6. **`/api/status`, `/api/cost/today`, `/api/graph`, `/api/panels` all 404** against the
   web server. Pre-existing; the shell already degrades to honest empty states
   (`NO COST DATA`, `NO READING`). `runner-engineer` / `infra-compose-engineer`.
7. **No visual redesign.** The band is exactly as tall as the bar plus 14px of air. I did
   not take the opportunity to restyle anything.

## Verification

Production build, served on `:4321`, driven with `gstack browse`. Screenshots in
`…/scratchpad/`.

| Check | Result |
|---|---|
| `npm run build` | passes (two earlier failures were `src/i18n/strings.*.ts` mid-write by another agent, not this change) |
| `npm run validate:tokens` | `files scanned 281 · violations 0` |
| `vitest run src/components/shell/route.test.ts src/styles/tokens.test.ts` | 84 passed |

Measured at 1440×900, `#view-canvas`:

| Route | surface | padding-top | shell tabs bottom | dept tabs top |
|---|---|---|---|---|
| `/chart` | flow | 66px | 52 | 90 |
| `/chart/marketing` | flow | 85px | 52 | 109 |
| `/chart/operations` | flow | 85px | 52 | 109 |
| `/map` | canvas | 0px | — | — |
| `/dashboards` | canvas | 0px | — | — |
| `/dashboards/mission-control` | canvas | 0px | — | — |
| `/sessions` | flow | 66px | — | — |

`scrollHeight === clientHeight === 900` on every one of the seven — **no scrollbar
introduced anywhere, MAP included**. The segmented control's centre measured 720px (exact
viewport centre) on all seven, so §2.0's centring survived the TopBar change.

Screenshots read back by eye: `after-chart.png`, `after-chart-marketing.png`,
`final-dashboards.png` (pixel-identical to `before-dashboards.png`), `after-map.png`,
`after-sessions.png`.

### Phone, 375×812 (§3.6)

The top bar did not fit one row at 375px — search pill, four wide-tracked tabs and
`+ New session` measure ~760px, so they overprinted each other. **This was pre-existing
and is now fixed**: below `sm` the same grid becomes two rows (controls + action, then the
segmented control centred on its own row, horizontally scrollable with the scrollbar
suppressed). Nothing is hidden and no tab is dropped.

The taller bar needed **no change anywhere else in the app** — it is measured, so
`--shell-inset-t` became 106px (136px on `/chart/marketing`) and every flow view moved
down on its own. That is the contract paying for itself on the first day.

Also measured at 375: `--shell-bar-b` = 72px, because the bottom-right cluster wraps to
two rows there. Measurement caught that too; a declared constant would not have.
`scrollWidth === clientWidth === 375` on every route. Screenshots: `phone2-chart.png`,
`phone2-chart-marketing.png`, `phone2-map.png`, `phone2-sessions.png`.

Safe areas: `env(safe-area-inset-*)` is inside `--shell-bar-*` by construction (TopBar's
own padding carries it and the measurement includes it), so the band grows with a notch
without anyone adding a second inset. `viewport-fit=cover` unchanged.

## Next agent

`fidelity-qa-reviewer` — `review-request` filed. Start with `after-chart.png` against
`chart-before.png`, then `final-dashboards.png` against `before-dashboards.png` to confirm
nothing that was already right moved.

Then `dashboards-engineer` (item 1 above), `sessions-relay-engineer` (item 2) and
`chart-matrix-engineer` (item 3). All three should read
`apps/web/src/app/(views)/layout.tsx`'s header comment first — it is the contract in
twelve lines.
