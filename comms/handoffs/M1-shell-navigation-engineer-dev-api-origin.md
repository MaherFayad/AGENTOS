---
agent: shell-navigation-engineer
milestone: M1
spec: §2.0, §3.6 (with §2.3/§3.1/§3.2 unblocked as a consequence)
created: 2026-08-16T15:55
status: ready-for-review
---

# M1 — `/api` exists on the browser's origin in local dev, and the 8 shell suites run

Two unrelated blockers, both reported by peers, both closed. The first made every
runner-backed read in the app 404 at `localhost:4321`; the second meant nothing in
`components/shell/**` had ever executed an assertion.

## What exists now

**The dev API origin**

- `apps/web/next.config.mjs` — `rewrites()` mirroring `infra/Caddyfile`, plus
  `RUNNER_PROXY_ORIGIN` (the "is Caddy in front of me?" decision) and `devIndicators: false`.

**The test fix**

- `apps/web/src/components/shell/test-mocks.tsx` — new leaf module holding `routerMock`,
  `pathnameRef`, `navigationMock()`, `uiMock()`. Nothing that a `vi.mock` factory imports
  may reach `ShellContext` or `./ui`; this file is where that rule is written down.
- `apps/web/src/components/shell/test-harness.tsx` — trimmed to `renderShell`,
  `stubFetch`, `stubFullscreenSupport`, `GRAPH_FIXTURE`; re-exports the two mock handles.
- `apps/web/src/test/quarantine.ts` — `QUARANTINE` is now `[]`.
- The 8 `src/components/shell/*.test.tsx` factories now import `./test-mocks`.

**Product fixes the newly-running tests exposed (all §2.0/§3.6)**

- `ShellContext.tsx` — `usePrefersReducedMotion` delegates to the guardian's
  `useReducedMotion` instead of re-implementing §1.6 with an unguarded `window.matchMedia`.
- `lib/pwa.ts` — `isStandalone()` no longer assumes `matchMedia` exists.
- `SearchPill.tsx` — each result option carries an explicit `aria-label`; the
  match-highlight spans were fragmenting the accessible name into "Ac count En richment".
- `ViewTabs.tsx` — scrolls the selected tab into view. At 375px the four labels overflow
  and `TopBar` scrolls them; landing on `/sessions` from a push link left the one selected
  tab off-screen at `scrollLeft: 0`.
- `ConnectionStatus.tsx` — one line, and the word "QUEUED" is dropped below 420px so the
  bottom-right cluster neither wraps to two rows nor clips off the right edge of a phone.

## How to use it

Nothing to configure. `npm run dev -w @agnetos/web` (or `next dev -p 4321`) and `/api/*`
resolves. To point at a runner that is not on loopback, or to use a production build with
no Caddy in front:

```bash
RUNNER_ORIGIN=http://127.0.0.1:8787 npx next dev -p 4321
RUNNER_ORIGIN=http://127.0.0.1:8787 npx next build && npx next start -p 4321   # bakes at build time
```

The rule, from `infra/Caddyfile` and reproduced verbatim in the config:

| Path | Served by | Why |
|---|---|---|
| `/api/sessions*` | **web** (Next route handlers) | §3.1, `sessions-relay-engineer` |
| `/api/push*` | **web** (Next route handlers) | §3.1 push subscription |
| everything else `/api/*` | **runner** `:8787` | §3.2/§3.3, `runner-engineer` |
| `/ws/*` | **runner** `:8787` | Part V graph watcher |

Precedence is expressed as a negative lookahead in the source pattern
(`/api/:path((?!sessions|push).*)`) rather than relying on Next's internal route ordering,
because getting it wrong is silent: the sessions routes would go to a process with no
relay code and the symptom would be a 404 on a phone.

## Contracts touched

None changed. Consumed: `comms/contracts/api-contracts.md` (route ownership),
`comms/contracts/design-tokens.md` (no new colours; every touched class is a token class).
No ADR — the rewrite is a restatement of an existing decision (`infra/Caddyfile` + ADR-005
ordering), not a new one.

## Deliberately not done

- **No CORS on the runner, and no `NEXT_PUBLIC_API_BASE=http://localhost:8787`.** Both
  "work" and both fork the topology: cross-origin in dev, same-origin in prod, across SSE,
  preflight and credentials. The runner is tailnet-only with no public port by design
  (§3.6, BOARD constraint 5).
- **The rewrite is not on in production by default.** `infra/compose.yaml` runs web with
  `NODE_ENV=production` behind Caddy; a rewrite there would put two proxies on one prefix.
  `RUNNER_INTERNAL_URL` is honoured in dev only for exactly that reason — compose sets it.
- **`next start` still needs the env at `next build` time.** Rewrites bake into the build
  manifest. I did not add a runtime-evaluated proxy (middleware) to paper over this:
  `middleware.ts` is outside my boundary and a second proxy implementation is worse than a
  documented caveat.
- **The cost ticker still reads "no cost data".** That is the correct answer, not a
  remaining bug: `/api/cost/today` now returns `{"usd": null, "runs": 0}` because no run
  has ever executed (`RUNNER_ANTHROPIC_API_KEY` is blank). Rule 9 — a fabricated `$0.00`
  would be worse. The connection pill *did* change, to live `UNKNOWN · 0 QUEUED`.
- **`useEndpoint` still collapses "404, not built" and "200 with nothing to report" into
  one message.** They are different truths and the sr-only sentence is what a screen-reader
  user hears. It is a real refinement, it is mine, and it is not this task; filed as my
  next step rather than smuggled in here.
- **The drawer covering the shell's top-left cluster is left alone.** With §2.3 open, the
  fullscreen toggle and search pill are behind the drawer and `/` goes to the drawer's
  focus trap. Correct for a modal panel; `Esc` closes to `/map/sales` and hands `/` back.
  Raised with `drawer-engineer` rather than changed unilaterally.
- **`KpiNumeral.test.tsx` flake not fixed** — `design-system-guardian`'s count-up test,
  fails only under parallel load. Reported, not touched.
- **PWA §3.6 beyond the insets** (manifest/SW/icons/push subscription flow) is unchanged by
  this task and continues as previously handed off.

## Verification

Everything below was run against `localhost:4321`, which I switched from `next start` to
`next dev` — a baked production build cannot pick up a rewrite.

```
/api/cost/today                       200 {"usd":null,"runs":0,"unpricedRuns":0,...}      runner
/api/status                           200 {"tailscale":"unknown","queueDepth":0,...}      runner
/api/graph                            200 {"version":"sha256:33ba62...",...}              runner
/api/agents/sales/account-enrichment  200 {"slug":"sales/account-enrichment",...}         runner
/api/sessions                         401 {"error":{"code":"relay_unauthenticated"}}      NEXT
/api/sessions/abc123                  404 (Next's own 404 — no [id] route handler)        NEXT
/api/push/subscribe                   405 (POST only)                                     NEXT
/ws/graph                             101 Switching Protocols + {"type":"hello",...}      runner
```

Both sides confirmed by contrast, not by assumption: the runner answers `/api/sessions`
with `{"error":{"code":"not_found","message":"No route for GET /api/sessions"}}`, so a
leak would have looked nothing like a 401.

- Tests: `npm run test:web` green — Vitest 51 files / 354 tests, node:test 93 tests. Full
  Vitest suite run 3× for stability. `tsc --noEmit` clean. `next lint --max-warnings 0` clean.
- Quarantine: `src/test/quarantine.ts` is empty; `quarantine.test.ts` passes on its own.
- Screenshots (read back and inspected, not just captured), 1440×900 and 375×812:
  - `final-drawer-1440.png` — §2.3 drawer renders in full at
    `/map/sales/account-enrichment` against real frontmatter. No console errors.
  - `final-map-1440.png` — §2.0 shell: fullscreen square + search pill top-left, four tabs
    optically centred, `NAVIGATION` + `+ New session` top-right, `?` / `−` / `50%` / `+`
    bottom-left, `NO COST DATA` + `● UNKNOWN · 0 QUEUED` bottom-right. No collisions.
  - `final-map-375.png` / `sessions-375.png` — 375×812: top row does not collide, tab strip
    scrolls and the selected tab is brought on screen (`scrollLeft: 64`, right edge 355 of
    375), bottom-right cluster is one line and inside the viewport.
  - Keyboard: with the drawer open, `Esc` → `/map/sales`, then `/` focuses "Search jobs".
  - (Paths are in this session's scratchpad, not committed — `comms/` holds no images.)

## Next agent

`fidelity-qa-reviewer` — the review-request is
`comms/inbox/fidelity-qa-reviewer/20260816-1555-shell-navigation-engineer-shell-review.md`.
Read that first, then the `## Answer` on
`comms/inbox/shell-navigation-engineer/20260816-1506-fidelity-qa-reviewer-shell-tests-deadlock.md`
for what each of the 37 assertion failures turned out to be.

Anyone verifying any view at `localhost:4321`: it is a `next dev` server now. Do not run
`next build` against `apps/web/.next` while it is up — the build deletes
`routes-manifest.json` and every Next route handler 500s until the dev server restarts.
