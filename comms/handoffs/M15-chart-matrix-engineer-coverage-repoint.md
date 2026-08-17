---
agent: chart-matrix-engineer
milestone: M15
spec: §2.6
created: 2026-08-17T17:57
status: ready-for-review
---

# M15 — CHART's coverage rows repointed at the project-scoped routes

## What exists now

`comms/specs/chart-matrix.md` only. No code changed; nothing under `apps/web` was touched.

- **REQ-CHT-42** now cites `apps/web/src/app/(views)/p/[project]/chart/page.tsx` ·
  `…/chart/[department]/page.tsx` · `…/chart/ChartRoute.tsx` · `…/chart/mount.tsx`, and its
  *text* now reads `/p/:project/chart` and `/p/:project/chart/:department`. The old text
  named URLs that no longer exist, so a path-only rename would have left the row half false.
- **REQ-CHT-43** (new) — an unknown `:department` redirects to that project's own chart, so
  the project segment survives the redirect.
- **REQ-CHT-44** (new) — CHART writes no project prefix itself: `ChartRoute` takes the
  project from `useShell()` and builds destinations with the shell's `withProject`.
- **Decision 10** (new) records why 43/44 are behaviour rather than path bookkeeping.
  Decision 7 was corrected: it still described the pre-M15 route tree in prose.
- `Interfaces we consume` gained the shell row (`useShell` / `withProject`); the closing
  "all five couplings" sentence said five and would have been wrong at six.
- Test plan: REQ-CHT-42's manual step re-worded, and 43/44 added to the not-automatable
  list with the exact walk that checks them.

## How to use it

`npm run validate:coverage` — `chart-matrix.md` contributes zero FAILs and zero warnings.

## Contracts touched

None. No contract file was edited and no ADR was needed: `frontmatter-schema.md` and
ADR-001 are unchanged, and the project segment is `shell-navigation-engineer`'s shape,
consumed here, not defined here.

## Deliberately not done

- **No code changed, including no test for REQ-CHT-43/44.** The dispatch scoped this to
  `comms/specs/chart-matrix.md`. Both new rows are honestly marked manual, and the reason
  they are hard to unit-test is real, not an excuse: one is a server-component `redirect()`
  and the other a `useRouter().push`, so neither is visible to the `renderToStaticMarkup`
  harness the rest of this spec uses. **This is a genuine hole and I am flagging it as
  one** — a regression that silently reverted a chart link to the default project would
  today be caught only by a human walking the URL.
- **No new requirement for `<DrawerHost />` being a sibling on both chart routes.** It is
  true and asserted nowhere, but it predates M15; adding it here would smuggle unrelated
  coverage into an M15 PASS-condition fix.
- **The other five failing specs.** Their owners are working them concurrently.
- **The eighth department.** Not priced here; see the note to the orchestrator below.

## Verification

`npm run validate:coverage`, same tree (`1e5b5d7` + this file):

- **Before** — 617 requirements, 20 FAILs, four of them `chart-matrix.md: REQ-CHT-42`.
- **After** — 622 requirements, 13 FAILs, **none in `chart-matrix.md`**. The delta beyond
  my two rows is other owners landing their fixes during this session (`dashboards.md` and
  `drawer.md` went green between my two runs). Remaining: `map.md` ×4, `sessions.md` ×3,
  `shell-navigation.md` ×6.

I opened all four files at their new paths before editing rather than renaming blind, and
REQ-CHT-42's claim (both mount `<ChartPage />`, not `ViewMount`) is still true of them —
via `ChartMount` → `ChartRoute` → `<ChartPage />`, unchanged by M15.

## Next agent

`commandcenter-orchestrator` — two corrections to the M15 section of BOARD.md, in
"Verification" and "Scope note" below. Then `fidelity-qa-reviewer` for the doc-level pass.
