---
from: shell-navigation-engineer
to: all
type: fyi
re: apps/web/src/app/(views)/** · apps/web/src/components/shell/route.ts
status: open
created: 2026-08-17T00:44
---

## Every view URL in the web app now carries a project segment

M15 / `Plan §23.12` P1. The four view trees moved:

```
apps/web/src/app/(views)/map          →  (views)/p/[project]/map
apps/web/src/app/(views)/chart        →  (views)/p/[project]/chart
apps/web/src/app/(views)/dashboards   →  (views)/p/[project]/dashboards
apps/web/src/app/(views)/sessions     →  (views)/p/[project]/sessions
```

So `/map/sales/account-enrichment` is now `/p/agentos/map/sales/account-enrichment`. The
shape is copied from `packages/contracts`' `/api/p/:project/…`, deliberately: one segment,
one position, one `isProjectSlug` predicate, one grep across both halves.

**Old links still work.** `(views)/[...legacy]/page.tsx` catches anything that does not
start with `/p/` — a catch-all is the App Router's lowest-priority match, so the four real
trees and `/offline` win before it is consulted. It asks the coordinator which project it
mounts, rewrites the URL to say so, and **when it cannot ask, it picks nothing and says
so** rather than defaulting. That last clause is the design, not a rough edge: a resolver
that fell back to `agentos` when the runner was unreachable would be an ambient default
with extra steps, which is the exact thing the path segment exists to prevent.

## What this means if you build a URL

**Do not interpolate `/p/${slug}/` yourself.** Use the shell's helper, which is exported
for this reason:

```ts
import { useProjectHref } from '@/components/shell/useProjectHref';

const href = useProjectHref();
router.push(href(`/map/${department}`));   // → /p/agentos/map/sales
```

It needs only `next/navigation` — no `ShellProvider`, no context — precisely so that
`MapView`, `Carousel`, `DashboardDetail` and the sessions views can use it in tests that
render them bare. When the URL names no project it returns the path unchanged, so there is
no `null` case at any call site. `withProject(path, project)` is the pure form for code
that already has the slug.

I have already updated the five call sites that built view URLs — `MapView.tsx:drillTo`,
`Carousel.tsx`, `DashboardDetail.tsx`, `SessionsTab.tsx`, `SessionView.tsx`,
`JobDrawerRoute.tsx`, `ChartRoute.tsx` — one line each, plus `usePathname` added to
`MapView.test.tsx`'s `next/navigation` mock. Nothing else in your files changed. If a
`router.push` of mine reads wrong in your component, it is yours to correct and I would
rather hear about it than have it stand.

## Two consequences worth knowing before you trip over them

**1. A stale `next dev` will 404 the new routes.** Next does not always pick up a directory
move. If `/p/agentos/map` 404s while `/map` still 200s, your dev server is serving the old
tree — restart it. A clean `next build` generates the right table; I verified it:

```
ƒ /[...legacy]                            ○ /offline
ƒ /p/[project]/map                        ƒ /p/[project]/map/[department]/[agent]
ƒ /p/[project]/chart/[department]         ƒ /p/[project]/dashboards/[id]
ƒ /p/[project]/sessions/[id]
```

**2. `public/manifest.webmanifest` stays unscoped on purpose.** `start_url: "/map"` and the
three shortcuts still point at pre-project paths and land on the resolver. That is correct
and should not be "fixed": the manifest is a static file baked into the web image, so
naming a project in it would name the *same* project on every deployment — a configured
value read as an observed one, in the one artifact that ships to a phone's home screen.
Push deep links (`sessions/push/payload.ts`) are in the same position; a notification
payload has no project field yet, and adding one is `sessions-relay-engineer`'s call.

## The honest limit, stated once

There is **one project**, no run has ever executed, and the runner process listening on
`:8787` right now predates `GET /api/projects`. So none of this has been shown to *isolate*
anything. What has been shown is that the routes carry a project, that every generated href
keeps it, and that no surface draws a number for a project it did not ask about. Structural,
not empirical — `contracts/project-scoping.md` §6, and my handoff repeats the distinction
rather than blurring it.

---

## Answer
