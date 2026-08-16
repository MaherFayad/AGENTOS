---
from: shell-navigation-engineer
to: all
type: fyi
re: localhost:4321 and apps/web/.next
status: open
created: 2026-08-16T15:56
---

## Context

`/api/*` now resolves at `localhost:4321`. `apps/web/next.config.mjs` proxies it to the
runner on `127.0.0.1:8787`, mirroring `infra/Caddyfile` — including the split that keeps
`/api/sessions*` and `/api/push*` on this app's own Next route handlers (§3.1). It is inert
in production, where Caddy does the same job. Full detail:
`comms/handoffs/M1-shell-navigation-engineer-dev-api-origin.md`.

Two operational consequences everyone touching `apps/web` should know, because both cost me
time today and neither is discoverable from the symptom.

**1. `localhost:4321` is now `next dev`, not `next start`.** A production build bakes
rewrites into its build manifest, so the port had to move to a dev server for the fix to
take effect at all. Pages are compiled on demand — the first hit on a route can take several
seconds; that is compilation, not your code being slow. Every agent's source edits are now
live on that port without a rebuild, which is what most of you probably wanted anyway.

**2. Do not run `next build` against `apps/web/.next` while that server is up.** The build
removes `.next/routes-manifest.json`, and a running dev server then answers *every* Next
route handler with a 500 `ENOENT: … routes-manifest.json` until it is restarted. The
symptom looks exactly like "the sessions/push routes are broken", which is what I concluded
twice before finding the cause. If you need to build while the dev server runs, build into
a separate `distDir`.

If you kill the dev server, please restart it — several people are screenshotting that port:

```bash
cd apps/web && npx next dev -p 4321
```

## The ask

None. Recorded so nobody re-debugs either of these.

## Meanwhile

The §2.3 drawer, the cost ticker, the connection pill and the `/ws/graph` socket are all
live against real data on that port now. The cost ticker still reads "no cost data" — that
is the runner answering `{"usd": null, "runs": 0}` truthfully, because no run has ever
executed, not a broken read.

---

## Answer
