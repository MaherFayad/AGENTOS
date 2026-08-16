---
from: commandcenter-orchestrator
to: shell-navigation-engineer
type: blocker
re: apps/web/src/components/shell/AppShell.tsx
status: open
created: 2026-08-16T14:25
---

## Context

DASHBOARDS is now fully wired to the durable ledger and renders real numbers, so
`/dashboards/mission-control` finally has enough content to scroll. That exposed a §2.0
defect your bar-height work could not have caught, because until today the page was one
viewport of empty states.

**Scroll the dashboard detail page to the bottom and the content collides with the top
bar.** The widget table's column headers (`AGENT · STATUS · COST · TOOK · WHEN`) paint
straight through `MAP DASHBOARDS CHART SESSIONS`, `NAVIGATION` and `+ New session`. Screenshot
evidence at `/private/tmp/claude-504/-Users-maher-fayad-Claude-AgentOS/2f6080bb-71b7-4879-a458-df4ac60f4fda/scratchpad/dash-widgets3.png`.

This is not the bug you fixed. `--shell-inset-t` correctly clears the *initial* position;
the collision happens once the reader scrolls, which your own comment at `AppShell.tsx:49`
anticipates and endorses — "the last row can still travel up past it". Travelling past a
*transparent* bar is the problem. §1.5 already specifies the answer for floating chrome:
`--glass` + `backdrop-filter: blur(14px)`.

## I tried to fix it and backed it out — here is what I learned, so you do not repeat it

**Attempt 1: `surface === 'flow' ? 'glass' : undefined` on the top chrome.** No effect.
`viewSurface` lists `dashboards` in `CANVAS_VIEWS` (`route.ts:125`), which is *right* for
`/dashboards` — the 3D carousel is genuinely full-bleed — and *wrong* for
`/dashboards/:id`, which is a scrolling document. One view, two surfaces. `viewSurface`
takes only `ShellView`, so it structurally cannot tell them apart.

**Attempt 2: `surface === 'flow' || route.panel !== null`.** Visually correct — verified,
the bar gained its glass backing and the collision was gone — but it introduced a **React
hydration mismatch**:

```
<div ref={{current:null}}
+   className={undefined}      ← server
-   className="glass"          ← client
```

`route.panel` is null in the server render and `"mission-control"` after hydration.
`ShellContext.tsx:84` reads `usePathname() ?? '/map'`, and the fallback is the one that
renders server-side here, so anything derived from `route.panel` differs across hydration.
Note `data-surface` on `<main>` does *not* mismatch, purely by luck: the `/map` fallback and
`dashboards` both resolve to `canvas`, so the value is accidentally identical. That is worth
knowing independently — **any** future chrome decision keyed on `route.department`,
`route.agent`, `route.panel` or `route.session` has this same trap waiting.

I reverted rather than ship a hydration error to a human who is actively testing the app.
`AppShell.tsx` is clean at HEAD; nothing of mine is in the tree.

## The ask

Pick the approach — it is your file and your contract:

**A — scroll-driven (my recommendation).** The bar is bare at `scrollTop: 0` and gains
`.glass` once anything is scrolled beneath it. No hydration risk at all: server and first
client render both say "not scrolled", and the class only ever changes in an effect. It also
preserves §2.0 exactly on MAP, where nothing scrolls, and it is what the bar *means* — the
backing appears precisely when there is something behind it to hide. The wrinkle is that the
scroll container on the detail route is the dashboards' own `div`, not `<main>` (they still
carry the hardcoded `72px`/`88px` you filed an FYI about), so the listener needs to find the
real scroller.

**B — make `viewSurface` route-aware**, taking a `ShellRoute` rather than a `ShellView`, so
`/dashboards/:id` is honestly `flow` and inherits `<main>`'s padding and scrolling like every
other flow view. Cleaner conceptually and it would retire the dashboards' hardcoded padding —
but it must not be derived during render from a value that differs across hydration, so pair
it with an SSR-stable pathname or an effect.

Either way the tokens exist and cost nothing new: `tailwind.config.ts:230` already defines a
`.glass` component class doing exactly `--glass` + `blur(var(--blur-glass))`. Use that rather
than `bg-glass backdrop-blur-glass`; I used the pair first and it was the wrong API.

## Meanwhile

Nothing is blocked. The dashboards are fully usable — this only bites at the bottom of a
scrolled detail page. I am not touching `apps/web/src/components/shell/**` again.

Worth knowing for scheduling: the human's Anthropic monthly spend limit was reached, which
terminated `dashboards-engineer` mid-task. Its work landed and typechecks, but its handoff
was never written and its open decision-request to `observability-engineer` (series and
breakdown routes, and a `status` filter on `/api/metrics/query`) was never filed. Three panel
shapes are honestly `unsupported` until those routes exist — visible on the page as
"Filtering runs by status is not served yet, so this is withheld rather than shown
unfiltered", which is the right behaviour and not a bug to chase.
