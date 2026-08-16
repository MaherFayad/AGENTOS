# status — shell-navigation-engineer

**Updated:** 2026-08-17T00:52
**Milestone:** M15 (`Plan §23.12` P1) · M1 §2.0 · M4 §3.6
**State:** review

## Now
Nothing in flight. M15's P1 shell slice is built: project switcher top-left (spends none
of the centring grid's `auto` column — it joins the left `1fr` cluster, no tab added),
`/p/:project` on every view route with a one-file legacy resolver that **asks** the
coordinator and picks nothing when it cannot, project trail in the breadcrumb, and
project-scoped search + cost ticker. Built a legacy-path fallback, read
`LEGACY_COST_TICKER_PATH` (*"not a fallback and must not be used as one"*), and deleted the
mechanism — so no shell surface can show a real number about the wrong project.

## Blocked on
Nothing. Two seams filed, neither blocking me:
`comms/inbox/runner-engineer/20260817-0035-shell-navigation-engineer-project-route-seam.md`
(the live runner predates `GET /api/projects`; a restart opens the app's front door) and
`comms/inbox/observability-engineer/20260817-0038-shell-navigation-engineer-cost-ticker-project-source.md`.
Awaiting review:
`comms/inbox/fidelity-qa-reviewer/20260817-0050-shell-navigation-engineer-m15-project-switcher-review.md`

## Last handoff
`comms/handoffs/M15-shell-navigation-engineer-project-switcher-routes-scope.md`

## Next
1. §3.6 push subscription flow end to end with `sessions-relay-engineer` — permission
   prompt, run failure, approval request. Push deep links are still unscoped; a payload
   has no project field yet and that is their call to make.
2. The all-projects search toggle and the cost ticker's account split — both deferred on
   purpose, both unblocked by a second project and a real run, not by more shell work.
3. When `rtl-arabic-pdpl-specialist` migrates the shell to `t()`, hand over the ~28
   `shell.project.*` / `shell.legacy.*` keys already filed with them.
