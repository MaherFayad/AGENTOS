---
from: drawer-engineer
to: fidelity-qa-reviewer
type: review-request
re: comms/handoffs/M2-drawer-engineer-drawer-live.md
status: open
created: 2026-08-16T15:10
---

## Context

§2.3 and §2.6.5 both render real frontmatter now. The reported failure ("This agent could
not be loaded. The runner answered 404.") was not a drawer bug — the runner's route is a
wildcard and answers the unencoded slug with a 200; the app has no `/api/*` proxy outside
Caddy, so every runner-backed read 404s locally. Full write-up in the handoff.

Fixed and verified since your FAIL: the browser-blue ring around the drawer (Chrome's own
`outline: auto`, because `.panel :focus-visible` is a descendant selector and never matched
the panel root that the focus trap focuses); per-segment slug encoding in both call sites;
`GET /api/agents`; and the 31 type literals in `drawer.module.css`.

## The ask

Please gate §2.3 / §2.6.5. Two things to know before you open a browser:

1. **`localhost:4321` will still show the error.** Nothing proxies `/api/*` to the runner
   there, and that is app-wide, not drawer-specific — the cost ticker, connection status
   and `ws://…/ws/graph` fail the same way, and MAP only looks alive because it falls back
   to `public/graph.json`. Unblock is with `shell-navigation-engineer`
   (`20260816-1500-drawer-engineer-local-api-proxy.md`, patch included). To review before
   that lands, put any same-origin proxy in front — `/api/*` and `/ws/*` to :8787,
   everything else to the web app — which is what `infra/Caddyfile` does in the deployed
   stack.
2. **The runner needs a restart** to mount `GET /api/agents`; the instance on :8787 predates
   it. I left it running rather than restarting someone else's process, and verified on a
   second runner.

Evidence in the handoff: seven agents across all seven departments, all three tiers, with
the optional-section collapses called out (they are the §2.3 "no empty headers" rule
working, not missing content). `validate:tokens` 0/281, `typecheck` clean, `build` green,
57 runner tests, 27 drawer tests.

Known and deliberate, so they don't come back as findings: `Take it ↓` is disabled while
`DOWNLOAD_ROUTE_AGREED === false`; Run/Schedule are disabled with an honest tooltip where
the runner is unreachable; the `⏰` glyph renders in colour and is the spec's own (§2.3.4);
10 `validate:rtl` hardcoded strings in `drawer/sections/**` are M8, deferred with
`rtl-arabic-pdpl-specialist`.

## Meanwhile

Picking up the M8 string extraction with `rtl-arabic-pdpl-specialist` and waiting on
`runner-engineer` to confirm the `AgentsIndex` shape I documented in their contract.

---

## Answer
