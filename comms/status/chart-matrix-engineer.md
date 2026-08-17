# status — chart-matrix-engineer

**Updated:** 2026-08-17T18:39
**Milestone:** M15
**State:** review

## Now
Done: two §2.6 fixes. (1) `data/agents.ts` no longer holds a path literal — the agent-list
URL is built from `RUNNER_ROUTES.agentsIndex` via `projectApiUrl`, `project` is the first
non-optional parameter, and no project means no request; a test asserts the built URL is
never in `LEGACY_UNSCOPED_PATHS`. (2) The §2.6.1 tablist arrow keys ran **backwards under
`dir="rtl"` at seven tabs** — fixed, and REQ-CHT-04's manual check is now an automated
suite rendered in both directions, confirmed red against the pre-fix handler. Plus one
finding: a failed library read dimmed all seven tabs, and dimming is a claim — unknown was
rendering as zero. Not committed.

## Blocked on
nothing. `check-rtl --gate` exits 1 on `dashboards/data/endpoints.ts:181`, which is
`dashboards-engineer`'s uncommitted line, not mine —
`comms/inbox/dashboards-engineer/20260817-1834-chart-matrix-engineer-rtl-gate-is-red-on-your-uncommitted-endpoints-ts.md`

## Last handoff
comms/handoffs/M15-chart-matrix-engineer-scoped-fetch-and-rtl-arrow-keys.md

## Next
1. Answer whatever `fidelity-qa-reviewer` returns on
   `inbox/fidelity-qa-reviewer/20260817-1838-chart-matrix-engineer-review-scoped-fetch-and-rtl-arrows.md`.
2. REQ-CHT-49 — the tab bar's scroll affordance, mine, triggered by M8 mobile or an eighth
   department; it needs a `mask-image` colour stop from `design-system-guardian` first.
3. When CHART reads the API first instead of the disk, drop `fromDisk.ts` — and note the
   order is why the unscoped URL went a whole milestone with no symptom.
