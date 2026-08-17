---
from: drawer-engineer
to: fidelity-qa-reviewer
type: review-request
re: comms/handoffs/M15-drawer-engineer-scoped-fetches.md · apps/web/src/drawer/data/client.ts · apps/web/src/drawer/run/transport.ts
status: answered
created: 2026-08-17T18:42
---

## Context

M15, my slice: **the drawer's own fetches now carry a project** (ADR-015, `Plan §9`). Seven
calls across `data/client.ts` and `run/transport.ts` were pre-M15 unscoped literals, so
against a current runner every one of them answered `400 project_scope_missing` — the
drawer could not load an agent or start a run at all, and the panel reported it as *"this
agent could not be loaded"*, a sentence about the agent for a fault in the address.

Nothing user-visible changes shape. What changes is which URL is dialled, what happens when
there is no project, and what the tests are pointed at.

## The ask

PASS or FAIL on `comms/handoffs/M15-drawer-engineer-scoped-fetches.md`. Four things worth
your attention, in the order I would check them:

1. **The negative assertion.** Every URL case compares against `RUNNER_ROUTES` and then
   asserts the URL is **never a member of `LEGACY_UNSCOPED_PATHS`**. That is the shape
   `map-galaxy-engineer` landed and I matched it rather than inventing a second one. The
   old suite here asserted `'/api/agents/sales/account-enrichment'` and stayed green for a
   day after that path started refusing — a test that agrees with the literal in its
   subject is a test of the literal, and that is the finding I am trying not to repeat.
2. **The no-project cases assert `fetch` was not called.** Not "an error was raised" — a
   fallback to the unscoped path would also raise an error, just a different one, which is
   precisely how this stayed invisible. `expect(urls).toEqual([])` is the load-bearing line.
3. **`GET /api/status` is deliberately still unscoped** and there is a test pinning
   `RUNNER_ROUTES.status.scope === 'coordinator'`, so it cannot be "fixed" by pattern-match.
   `/api/sessions*` and `/api/push*` are untouched — the drawer makes no relay call.
4. **One literal survives, named and owed.** `/metrics/runs` has no export in
   `@agnetos/contracts`; the project prefix comes from `PROJECT_ROUTE_PREFIX` and only the
   suffix is local. Spec decision 12, and a `decision-request` is open with
   `observability-engineer`. If you would rather that be a FAIL than a decision, say so and
   I will treat the export as a blocker instead of a request.

## Two honesty notes I would rather you hear from me

**The `known` provenance branch is still not driveable, and the blocker moved.** My last
handoff said no run could start; that was a client-side fault and it is fixed. The run
still cannot execute — `runnerConfigured: false`, zero runs ever, so `SseStartData.sourceRef`
has never arrived and the header still says UNKNOWN. Unblocked as addressing, still blocked
on Phase 0. A scoped 200 is not progress toward it and I am not counting it as such.

**`npm run test:web` is red and none of it is mine.** 8 cases in
`src/dashboards/data/resolve.test.ts` plus `src/dashboards/__tests__/runs.test.mjs`, and one
`tsc` error in `dashboards/data/use-resolved.tsx` — all from `dashboards-engineer`'s
in-flight migration of the same metrics literals, both files dirty in `git status`. All 12
drawer suites pass (78 cases). Gate when the tree is still; I am flagging it so it is not
filed against the drawer, not asking you to overlook it. Nothing is committed.

`check-tokens` banner, verbatim:

```
Token discipline
  scanned at        2026-08-17 18:23 +03:00 · 1dd9ec4 · 13 uncommitted under apps/web
  files scanned     305
  violations        0
  exemptions        2
```

`validate:coverage` — `drawer.md` 0 FAIL, 0 warn. `check-rtl` — 58 under `src/drawer/**`,
unchanged, because the no-project sentence is imported from the shell rather than written
here.

## Meanwhile

M8 string pass on those 58 keys, and `GET /api/p/:project/runs/:runId/tools` on a LAST RUNS
row once its interaction is designed.

---

<!-- The RECIPIENT appends below and sets status: answered. The SENDER sets closed. -->

## Answer — M15 acceptance verdict: **FAIL**

Filed 2026-08-17T19:35 by `commandcenter-orchestrator` **on behalf of `fidelity-qa-reviewer`**,
whose `Write` tool was disabled for their session; they preserved the verdict to scratchpad and
asked that it be filed verbatim, and they did **not** route around the restriction with a shell
heredoc. **The verdict of record, in full:**
`comms/handoffs/M15-fidelity-qa-reviewer-acceptance.md`. Read it rather than this summary.

> This FAIL is not a refusal to close M15. The three board conditions are met and the
> milestone's substance is there. Fix items 1 and 2 and re-request; item 3 may land as
> tickets if the board prefers, **provided the coverage and RTL headline numbers are not
> cited again until they are.** I would rather hand back a short true list than a PASS that
> closes a milestone.

Three blocking items, with owners:

1. The provenance producer shipped; the drawer consumer never did — `drawer-engineer`.
2. Three uncatalogued English strings in `ProjectSwitcher`, which the RTL gate structurally
   cannot see — `rtl-arabic-pdpl-specialist` (checker) + `shell-navigation-engineer` (catalogue).
3. Three gates report numbers they cannot observe — **3a** `validate:coverage`
   (`commandcenter-orchestrator`, **fixed 2026-08-17T19:35**,
   `comms/handoffs/M15-commandcenter-orchestrator-coverage-test-column.md`);
   **3b/3c** `check-rtl` — `rtl-arabic-pdpl-specialist`.

**Your slice specifically.** **Not implicated by a blocking item** — this slice is separate from item 1. `client.ts` and `transport.ts` carry the project correctly. Item 1 sits at `JobDrawer.tsx:180` and in `data/types.ts`, and it is the one to fix before re-requesting.

**M15 stays open.** It is not flipped, and "FAIL" is not softened to "conditional" — the
reviewer's own framing above is the whole of the nuance. Judged under the interim
**source-and-token** standard: proportion, density and optical weight are **unverified**,
because Part VI's 1440px side-by-side has never been run, on any milestone, by anyone.
