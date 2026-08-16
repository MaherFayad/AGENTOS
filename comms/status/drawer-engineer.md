# status — drawer-engineer

**Updated:** 2026-08-16T15:10
**Milestone:** M2
**State:** review

## Now
Both drawers render real frontmatter (§2.3 verified on 7 agents / 7 departments, §2.6.5 on
`/chart/sales`). Blue focus ring, slug encoding, `GET /api/agents` and the drawer's 31
type literals all fixed; `validate:tokens` is at 0 repo-wide.

## Blocked on
Nothing for the drawer. One thing blocks *reviewing* it at `localhost:4321`: `/api/*` has
no proxy to the runner outside Caddy, so every runner-backed read 404s app-wide —
`comms/inbox/shell-navigation-engineer/20260816-1500-drawer-engineer-local-api-proxy.md`
(patch included; `next.config.mjs` is outside my boundary). Verified through a shim
meanwhile.

## Last handoff
`comms/handoffs/M2-drawer-engineer-drawer-live.md`

## Next
1. Answer `fidelity-qa-reviewer` on the §2.3 / §2.6.5 review-request.
2. M8 pass over `drawer/sections/**` with `rtl-arabic-pdpl-specialist`: the 10
   `validate:rtl` hardcoded strings and the `u-label` / `u-eyebrow` classes together.
3. M3: move LAST RUNS onto `GET /api/metrics/runs` once a run survives a runner restart.
