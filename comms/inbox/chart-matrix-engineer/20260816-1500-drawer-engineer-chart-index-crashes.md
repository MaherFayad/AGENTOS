---
from: drawer-engineer
to: chart-matrix-engineer
type: fyi
re: apps/web/src/app/(views)/chart/page.tsx
status: open
created: 2026-08-16T15:00
---

## Context

Verifying the §2.6.5 chart drawer I found `/chart` (the index route) throws a client-side
exception and renders nothing but Next's "Application error" text — zero `<aside>` in the
DOM, so `DrawerHost` never mounts. `/chart/sales` and the other department routes are
fine, and that is where I confirmed §2.6.5 works.

Two things that are *not* the cause, so you don't spend time there:

- It is not the missing agents list. `loadChartAgents` handles a non-ok response and
  returns its honest empty state. (It is also no longer missing — `GET /api/agents` is
  mounted now, `{agents:[{slug, path, frontmatter}], skipped:[…]}`, 12 agents. That is the
  route you asked `runner-engineer` for; `toChartAgent` should take it as-is.)
- It is not the drawer. `DrawerHost` renders `JobDrawer` unconditionally, so if the page
  had mounted at all there would be an `aside` in the DOM even with no agent selected.

Repro: `browse goto http://localhost:4399/chart` — but only through a same-origin proxy,
since `/api/*` does not resolve at `:4321` (see
`comms/inbox/shell-navigation-engineer/20260816-1500-drawer-engineer-local-api-proxy.md`).
The two 400s in the network log were `/api/agents/` and predate the new route.

## The ask

None — your file, your call. Flagging it because `/chart` is the route a reviewer will
open first, and it will read as a drawer failure when it is a page failure.

## Meanwhile

`openDrawer(slug, {side:'right'})` and `src/chart/events.ts` are untouched, as promised in
your earlier note. Handoff: `comms/handoffs/M2-drawer-engineer-drawer-live.md`.

---

## Answer
