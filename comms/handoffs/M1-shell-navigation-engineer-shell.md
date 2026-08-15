---
agent: shell-navigation-engineer
milestone: M1
spec: PART II · §2.0 · §2.7 · §3.6
created: 2026-08-15T21:22
status: ready-for-review
---

# M1 — the app shell, search, routing, and the PWA

The chrome that is identical on MAP / DASHBOARDS / CHART / SESSIONS (§2.0), plus the
phone story (§3.6). Neighbour views stay as `ViewMount` placeholders. Do not review
those empty pages as if they were this work.

## What exists now

```
apps/web/src/components/shell/          AppShell overlay, top/bottom bars, search,
                                        tabs, zoom, help, status, cost ticker,
                                        breadcrumbs, PWA registrar, ViewMount
apps/web/src/lib/search.ts              fuzzy subsequence rank + highlight ranges
apps/web/src/lib/shell-bus.ts           five typed events (shell ↔ canvas)
apps/web/src/lib/pwa.ts                 SW register, install prompt, push handshake
apps/web/src/app/(views)/layout.tsx     mounts AppShell once; viewport-fit: cover
apps/web/src/app/page.tsx               `/` → `/map`
apps/web/public/manifest.webmanifest    standalone, dark `--bg`
apps/web/public/sw.js                   shell cache; importScripts('/sw-push.js')
apps/web/public/sw-push.js              sessions-owned push handlers (untouched)
apps/web/public/icons/*.png             placeholder 192 / 512 / maskable 512 / badge-72
comms/specs/shell-navigation.md         88 REQ-SHELL rows; §2.7 is `—`
```

Route files under `app/(views)/map`, `chart`, `dashboards` are still `ViewMount`.
`/sessions` is already `SessionsTab` — `sessions-relay-engineer` owns it.

## How to use it

The shell is already on every `(views)` route. Views must **not** mount `<AppShell>`
again. Swap a placeholder:

```tsx
// apps/web/src/app/(views)/map/page.tsx — map-galaxy-engineer
export default function MapPage() {
  return <GalaxyCanvas />;
}
```

Listen on the bus from the canvas (`apps/web/src/lib/shell-bus.ts`):

- inbound: `shell:flyTo`, `shell:zoom`, `shell:yourTree`
- outbound: `shell:zoomChanged` `{level}`, `shell:liveCount` `{department, live, total}`

Search: `/` focuses, arrows walk, Enter opens (fly-to then navigate), Esc dismisses.
`+ New session` routes to `/sessions?new=1` — the relay owns what happens there.

Regenerate placeholder icons: `node scripts/generate-pwa-icons.mjs`.

## Contracts touched

None changed.

- `comms/contracts/design-tokens.md` — primitives via `components/shell/ui.ts`
- `comms/contracts/api-contracts.md` — `GET /api/status`, `GET /api/panels`, `POST /api/push/subscribe`
- `GET /api/cost/today` `{usd}` — observability, read directly
- `comms/contracts/graph-layout.md` — search index + live counts, read defensively

## Deliberately not done

- **§2.7 in full.** Optional Phase 4 marketing landing. Eleven rows in the spec are `—`.
- **A login screen.** §3.6: no auth in v1. Tailnet only.
- **Offline data.** The shell caches; `/api/*` and `/ws/*` do not. Honest "no tailnet"
  page instead of stale KPIs.
- **Push handlers in `sw.js`.** Owned by `sessions-relay-engineer` in `/sw-push.js`.
  The shell only `importScripts`s it, ships `badge-72.png`, and exposes
  `enablePushNotifications` for the SESSIONS button to call.
- **Neighbour views.** `/map`, `/chart`, `/dashboards` stay `ViewMount`. `/sessions` stays
  the relay's. Do not take them over.
- **Real icon artwork.** Generated monochrome placeholders (`public/icons/README.md`).
- **A visible install banner.** Affordance is in the `?` sheet so it does not disturb §2.0.
- **Vitest in `apps/web` package.json / CI.** DOM tests exist next to the components;
  `npm test` runs the node:test PWA asset checks. Wiring vitest would also execute
  chart and primitive tests this agent does not own.
- **Keyboard `1`–`4` tab accelerators.** Not in §2.0; would collide with canvas number keys.
- **Command palette / recent searches.** Search finds a job, department or panel. No
  per-user persistence (there is no user).

## Verification

```
$ node scripts/generate-pwa-icons.mjs
    wrote icon-192.png / icon-512.png / icon-maskable-512.png / badge-72.png

$ node --check apps/web/public/sw.js          → ok
$ node --check apps/web/public/sw-push.js     → ok
$ node --test scripts/__tests__/shell-pwa.test.mjs
    4 pass (manifest, PNGs, sw.js cache rules, sw-push.js still at the import path)

$ node scripts/check-spec-coverage.mjs
    PART II · §2.0 · §2.7 · §3.6 claimed; every REQ-SHELL Implemented-in path
    resolves or is honest `—`. Remaining FAILs are unclaimed sections other agents own.
```

`npm test` is 70 pass / 3 fail, none of them this slice (ADR-000 Owner line,
`tokens.test.ts` hex, rtl empty-state copy).

Zero hex in `components/shell/**` or `src/lib/{search,shell-bus,pwa}.ts`.

## Next agent

`fidelity-qa-reviewer` — review **§2.0 chrome and §3.6 PWA**, not the empty map/chart
pages. Then `map-galaxy-engineer` should subscribe to `shell:flyTo` / `shell:zoom` /
`shell:yourTree` and emit `shell:zoomChanged` + `shell:liveCount`.
