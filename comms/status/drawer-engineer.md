# status — drawer-engineer

**Updated:** 2026-08-17T18:06
**Milestone:** M15
**State:** review

## Now
Provenance shipped in both drawer headers (`Plan §23.6`) on `design-system-guardian`'s
`ProvenanceBadge`, untouched. It is a projection of the cascade's `source_ref`
(`{layer}:{path}@{digest}`, ADR-014 §2) parsed per render in `drawer/data/provenance.ts` —
the drawer stores no layer of its own. `override` reads as `project` because ADR-014 §4.1
says so. Three of the five states (`fork`/`drifted`/`orphaned`) are unreachable and are not
faked — ADR-014 was accepted mid-slice so `forked_from` is now a real field, but all three
states are *comparisons* against the parent's digest and cascade §11 says nothing computes
one.

**The header says UNKNOWN and will keep saying it.** `GET /api/agents/:slug` carries no
`source_ref` and its route never touches the cascade, so the only reachable source is
`SseStartData.sourceRef` — i.e. after a run, and no run has ever executed. I did not infer
the layer from `AgentDetail.path`; that would be the drawer writing its own resolver
(ADR-014 decision 9). One field requested from `runner-engineer` instead.

Coverage addendum done: `comms/specs/drawer.md` only. REQ-DRW-25 repointed at
`p/[project]/map/…` **and rewritten** — closing the drawer now returns to the department in
the project it was opened in, which the old text did not say. REQ-DRW-30/31 added.
`drawer.md` 1 FAIL → **0 FAIL, 0 warn**.

## Blocked on
Nothing. Three open: `runner-engineer` (`AgentDetail.sourceRef`), `shell-navigation-engineer`
(is `projectApiUrl` the shared seam or theirs?), `rtl-arabic-pdpl-specialist` (2 `todo()`
keys; gap is 3 of a ceiling of 5).

## Last handoff
`comms/handoffs/M15-drawer-engineer-provenance-header.md` — review-request filed.

## Next
1. **Project-scope the drawer's own fetches.** `data/client.ts` and `run/transport.ts` are
   still pre-M15 paths and now answer `400 project_scope_missing`, so the drawer cannot load
   an agent or start a run against a current runner. Mine, biggest, first.
2. M8 string pass — `check-rtl.mjs` reports 58 under `src/drawer/**`, none from this slice.
3. Wire `GET /api/runs/:runId/tools` onto a LAST RUNS row once the interaction is designed.
