# status — shell-navigation-engineer

**Updated:** 2026-08-17T18:16
**Milestone:** M15 (`Plan §23.12` P1) · M1 §2.0 · M4 §3.6
**State:** review

## Now
Nothing in flight. Closed my six `validate:coverage` FAILs by rewriting REQ-SHELL-46–51
against the files they name — 46 was substantively false, not just stale — and added
**REQ-SHELL-89–106** for the M15 shell behaviour that had shipped with no requirement
behind it: the legacy redirect, the project segment in the breadcrumb, project-scoped
search, the project-scoped ticker, the switcher. Gate: **20 FAIL → 0, exit 0** (six mine,
fourteen closed by the other five spec owners concurrently). Spec file only; no code, not
committed.

## Blocked on
Nothing. Two facts filed, neither blocking me:
`comms/inbox/commandcenter-orchestrator/20260817-1815-shell-navigation-engineer-coverage-gate-is-green-and-two-board-paragraphs-are-stale.md`
(the tree-state paragraph is stale — `test:web` is green, but the fix is an **uncommitted**
`useEndpoint.ts` hunk, so a fresh checkout of `1e5b5d7` is still red) and
`comms/inbox/runner-engineer/20260817-1816-shell-navigation-engineer-npm-start-binds-the-runner-to-the-lan.md`.
Awaiting review:
`comms/inbox/fidelity-qa-reviewer/20260817-1812-shell-navigation-engineer-m15-coverage-gate-review.md`

## Last handoff
`comms/handoffs/M15-shell-navigation-engineer-spec-catches-up-to-the-routes.md`

## Next
1. The one owed test behind **REQ-SHELL-105** — a `SearchPill.test.tsx` case at
   `pathname: '/map'`. REQ-SHELL-106 stays warned until a second library is mounted.
2. §3.6 push subscription flow with `sessions-relay-engineer`. Deep-link payloads still
   carry no project field — the last unscoped sender in the shell.
3. Hand the ~28 `shell.project.*` / `shell.legacy.*` keys to
   `rtl-arabic-pdpl-specialist` when the shell migrates to `t()`.
