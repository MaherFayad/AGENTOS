# status — shell-navigation-engineer

**Updated:** 2026-08-21T20:12
**Milestone:** M18 (audit fixes) · §3.6 · §2.0
**State:** review

## Now
Nothing in flight. `0506ecf` — the service worker pinned every `next dev` chunk cache-first
and made the app throw a hydration error on every route, surviving hard reloads. Four
changes: dev guard inside `registerServiceWorker`, an inline eviction script in
`PwaRegistrar` that rescues already-poisoned browsers, `isImmutableAsset` replacing the
comment that caused it, `VERSION` v1→v2. `STATIC_CACHE` capped at 200. New gate
`npm run smoke:sw` — the only thing here that has ever executed the worker's `fetch`
handler. Three plants, each caught, each restored, zero `PLANT` strings left.

## Blocked on
Nothing. Five open in my inbox, none blocking — the M15 pair (`ProjectSummary` narrowing,
`inlineStep`), the `ProjectSwitcher` enum, the cost-ticker 400, and the switcher/badge
dialect note. Two decision-requests still open: `PanelSummary` naming and the RTL ratchet
raise.

## Last handoff
`comms/handoffs/M18-shell-navigation-engineer-service-worker-poisoned-every-dev-session.md`

## The findings worth not rediscovering
**A fresh browser profile is an instrument that cannot see caching.** `check-page-errors`
spawns Chrome with `mkdtemp`, so no service worker has ever been registered under any gate
here and the worker's `fetch` handler had **never once executed** in CI. Not a broken gate —
a blind spot, and the most expensive costume of the standing finding yet, because it made
the app look broken to its own author on every route.

**A guard that only stops *new* registrations rescues nobody.** The poisoned browser is
running a pinned *old* bundle, so a `useEffect` unregister ships in a file that browser
never executes. The rescue has to come from server-rendered HTML, which is fresh because
navigations are network-only. Effect-based repair reaches exactly the browsers that did not
need it.

**A test that development does not register is a declaration check** — it would pass with
the bug fully live, because the bug is in what an *already registered* worker does. What
proves something is poison-then-recover, with a step that demands the poisoning be
reproducible first and reports **void, not pass** when it is not. That branch fired on its
own first run.

**A `content-hashed` assumption in a comment is a URL question the code can just ask.**
`isImmutableAsset` turns "cache-first is safe here" from a claim into a predicate, and that
is what makes the failure class impossible rather than guarded.

## Next
1. §3.6 push subscription flow with `sessions-relay-engineer`.
2. The owed **REQ-SHELL-105** test — a `SearchPill.test.tsx` case at `pathname: '/map'`.
3. `ProjectSwitcher.tsx:243`'s untranslated status enum, with an exhaustive check.
4. Audit **F9** — `ViewMount` ships `§3.6` and `BUILT BY SHELL-NAVIGATION-ENGINEER` to
   users on `/offline` and four resolver screens. Left for the reviewer's eye.

## Not mine, seen in passing
Three failures in `scripts/lib/layout.test.mjs` (seven-vs-eight branches) are another
agent's in-flight departments change. Confirmed by stashing my files and watching all three
persist. Untouched.
