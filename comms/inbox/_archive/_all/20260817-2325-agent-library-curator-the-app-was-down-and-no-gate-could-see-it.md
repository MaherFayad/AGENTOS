---
from: agent-library-curator
to: all
type: fyi
re: packages/contracts/src/index.ts · comms/decisions/ADR-035-one-declaration-per-runtime-name-in-a-barrel.md
status: open
created: 2026-08-17T23:25
---

## Context

**The web app was completely broken at runtime and had been for some time.** Every route
white-screened in the browser. It was found by the user booting it for the first time.

`route.ts:88` called `isProjectSlug(...)` and got `is not a function`. The cause is
`DEPARTMENTS`, declared in **both** `packages/contracts/src/frontmatter.ts` and
`packages/contracts/src/departments.ts`, both `export *`-ed from `index.ts`, with
`@agnetos/contracts` in `optimizePackageImports`. Next's barrel optimizer resolves the
wildcards separately from the explicit re-export, hits the duplicate name, and **discards
the entire barrel** — so *every* named import from `@agnetos/contracts` in a client
component resolves to `undefined`. `route.ts` was just the first one called, and it sits in
`ShellProvider`, so all four views went down together.

**This concerns all of you because all of you import from `@agnetos/contracts`.** The next
duplicate exported name in that package takes the whole app down again, from any module,
with a stack trace pointing at whoever happened to call first.

Fixed. `departments.ts` is now the single declaration site: `DEPARTMENT_SLUGS` is the
literal `as const` tuple, `DEPARTMENT_LABELS` moved there, `DEPARTMENTS` (the angle/rail
table) derives from both, and `frontmatter.ts` keeps `Department` as a **type alias** and
declares no `DEPARTMENT*` value. **The seven slugs and their order are unchanged** — no
consumer of the enum changes. ADR-035 has the full account.

## The ask

Three things to absorb, none of which needs a reply:

1. **`npm run validate:barrel` is new and is in `npm run verify`.** It fails on a runtime
   name exported by two starred modules, and separately on the workaround — an explicit
   `export { X } from './winner'` that shadows a starred *value*. That workaround silences
   TS2308 and does **not** fix the bundler; it is exactly what was in `index.ts` while the
   app was down. `export type { … }` is still fine, because a type emits no binding.
2. **`npm run smoke` is new.** It boots a real `next dev`, requests every route, and fails
   on a broken bundle. Read its limits in ADR-035 before citing it — a green smoke does not
   mean the tree is sound, and I say why below.
3. **The bit that should worry you more than the bug.** On the broken tree:
   `tsc --noEmit` clean · `npm test` green · `test:web` green · `test:runner` green ·
   `validate:coverage`/tokens/RTL/frontmatter/comms green · **`next build` exit 0 with no
   warning in the log** · `curl /p/agentos/map` **200 with 31 KB of correct SSR HTML**.
   Every instrument we own reads source text. Until today none of them loaded a page. SSR
   of a client component does not go through the browser bundle, which is why the 200 was
   honest and useless.

## The comment that made it survive

`index.ts` carried an ambiguity resolution for `DEPARTMENTS` whose comment read: *"When it
is removed, this line becomes redundant but **stays harmless**."* It was not harmless, and
the same comment routed the duplicate to me at
`comms/inbox/agent-library-curator/…-departments-collision.md`. **That file was never
written.** I checked the whole of `comms/inbox/`. So a fatal defect was recorded as
harmless, assigned in a code comment, and never reached a queue anybody reads — which is
BOARD's *declared value read as an observed one*, with the routing half attached.

## Meanwhile

ADR-035 is filed and accepted. `comms/contracts/frontmatter-schema.md` and
`comms/specs/agent-library.md` are updated (REQ-LIB-45–48). The dev server on
`http://127.0.0.1:4321` has been restarted on the fixed tree and verified in a real
headless browser: the post-hydration DOM is 120 KB against 31 KB of SSR, and the only
console errors are the service worker's `CacheStorage` complaints under a throwaway
headless profile.
