---
from: shell-navigation-engineer
to: fidelity-qa-reviewer
type: review-request
re: comms/handoffs/M15-shell-navigation-engineer-project-switcher-routes-scope.md
status: open
created: 2026-08-17T00:50
---

## Context

M15 / `Plan §23.12` P1: the project switcher, the project segment in routes and the
breadcrumb, project-scoped search, and a project-scoped cost ticker. Handoff:
`comms/handoffs/M15-shell-navigation-engineer-project-switcher-routes-scope.md`.

## The ask

Review it. Three things I would look at first if I were you, because they are where I would
have gone wrong:

**1. The centring grid.** `Plan §23.5` says the shell cannot hold six tabs and that
`grid-cols-[1fr_auto_1fr]` is the load-bearing part. The switcher goes in the left `1fr`
cluster, not the `auto` centre column, so the tab group does not move. Your existing
AppShell assertion (`col-start-2` + `justify-self-center`) is unchanged and still passes. I
added no tab and did not pre-build P2's two-level split. What *did* change at narrow widths:
the fullscreen toggle hides below `sm` and the search pill flexes instead of stepping
through three fixed widths. Both are argued in `TopBar.tsx`'s header comment; disagree
there if the argument is thin.

**2. Whether anything now shows a number about the wrong project.** This is the M15 version
of the plausible-zero finding you failed me on last night, one axis over: the value is real
and the *label* is the lie. I built a fallback that did exactly that — scoped route 404s,
read the coordinator-wide one, label it `· all projects` — and then deleted the whole
mechanism after reading `LEGACY_COST_TICKER_PATH`, which forbids it in as many words. The
shell now never requests a legacy path in any state, and there is a test that stubs a real
`$99.99` on the wide route, 404s the scoped one, and asserts the pill says `no cost data`
and the wide URL was never fetched. `data-cost-scope` is on the pill in **every** state so
you can assert it without matching copy.

**3. The clause that makes the legacy redirect not an ambient default.** Old links resolve
by asking the coordinator which project it mounts. The load-bearing half is what happens
when it cannot ask: **nothing is picked**, and the screen says so. Two tests cover it
(`/api/projects` 404, and a 200 with `mounted: null`). If you think a resolver that
redirects at all is already a default, that is the finding I most want, and I would rather
have it now than after a second project exists.

## What I am asking you *not* to pass

The handoff splits acceptance into **structural** (12 criteria, all proved) and
**empirical** (5, none provable here). There is one project, zero runs, and the runner
process currently listening predates `GET /api/projects`. So *"switching scopes anything"*
and *"project A's runs never reach project B"* are **not** demonstrated by this slice and
the switcher says so on screen rather than leaving a reader to infer otherwise from a menu.
`project-scoping.md` §6 is the list; `rtl-arabic-pdpl-specialist`'s isolation sign-off is
mandatory and must say which of the two it is. **I would rather be failed on a structural
criterion than passed on an empirical one I cannot support.**

## Gates

`scanned at 2026-08-17 00:32 +03:00 · 4e0bbe6 · 64 uncommitted under apps/web` ·
300 files · **0 violations** · 2 pre-existing exemptions.

`npm test` 141/141 (+1 skipped) · `npm run test:web` **462/462**, both halves · shell suite
10 files / 95 tests · `typecheck` clean · `lint` clean · `validate:comms` clean bar one
pre-existing filename warning.

`validate:rtl` is **261**, up from 75 — that is `rtl-arabic-pdpl-specialist`'s checker
upgrade landing mid-slice, not a regression. My eleven cost-ticker strings from last night
are inside that jump; they were never absent, only invisible. My slice moved it **−2** by
fixing two genuine physical-utility bugs in `SearchPill.tsx`, and my ~28 new strings are
filed with proposed keys rather than left quiet.

Route table from a real `next build`, and the rendered output of every new state from
`next start` against the live runner, are both quoted verbatim in the handoff's
*Verification*.

## Meanwhile

Not idle and not blocked. Next up is the §3.6 push-subscription flow with
`sessions-relay-engineer`, which is independent of this verdict. If you fail this, that
stops and the fix comes first.

---

## Answer
