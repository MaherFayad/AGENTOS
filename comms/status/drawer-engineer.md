# status — drawer-engineer

**Updated:** 2026-08-17T18:44
**Milestone:** M15
**State:** review

## Now
Every drawer fetch is project-scoped (ADR-015). `data/client.ts` and `run/transport.ts`
hold **no path literal**: paths come from `RUNNER_ROUTES`, URLs from
`shell-navigation-engineer`'s shared `projectApiUrl`, the project from
`useProjectSegment()` — not `useShell()`, which throws in bare-render tests. `null` project
means *do not ask*: reads/writes raise the shell's sentence, `downloadUrl` returns `null`,
a run is refused **non-retryably before any POST**. `/api/status` stays coordinator-scoped
on purpose, with a test pinning its scope; `/api/sessions*` and `/api/push*` are not mine
and are untouched. Tests assert the URL at the wire, never a member of
`LEGACY_UNSCOPED_PATHS`, and the no-project cases assert `fetch` was **not called**.

One literal survives, named: `/metrics/runs` has no export in `@agnetos/contracts`, so the
prefix comes from `PROJECT_ROUTE_PREFIX` and only the suffix is local — spec decision 12,
`decision-request` open with `observability-engineer`.

**The `known` provenance branch is still not driveable, and the blocker moved.** Addressing
is fixed; the run still cannot execute (`runnerConfigured: false`, zero runs ever), so
`sourceRef` has never arrived and the header still says UNKNOWN.

## Blocked on
Nothing. Three open: `observability-engineer` (export the metrics route table),
`runner-engineer` (`AgentDetail.sourceRef` — in their working tree, not landed; not built
around), `rtl-arabic-pdpl-specialist` (2 `todo()` keys).

**Not mine, do not file against the drawer:** `npm run test:web` is red on 8 cases in
`dashboards/data/resolve.test.ts` + `dashboards/__tests__/runs.test.mjs`, and one `tsc`
error in `dashboards/data/use-resolved.tsx` — `dashboards-engineer`'s in-flight work, both
files dirty. All 12 drawer suites pass (78 cases). Nothing committed.

## Last handoff
`comms/handoffs/M15-drawer-engineer-scoped-fetches.md` — review-request filed.

## Next
1. M8 string pass — `check-rtl.mjs` reports 58 under `src/drawer/**`, unchanged by this slice.
2. Wire `GET /api/p/:project/runs/:runId/tools` onto a LAST RUNS row once the interaction
   is designed.
3. Delete `METRICS_RUNS_PATH` the day `observability-engineer` exports their route table.
