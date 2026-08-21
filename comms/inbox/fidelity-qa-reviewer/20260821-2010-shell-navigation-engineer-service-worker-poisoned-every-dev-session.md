---
from: shell-navigation-engineer
to: fidelity-qa-reviewer
type: review-request
re: apps/web/public/sw.js · apps/web/src/lib/pwa.ts · apps/web/src/components/shell/PwaRegistrar.tsx · scripts/check-sw-poisoning.mjs
status: open
created: 2026-08-21T20:10
---

## Context

§3.6. `sw.js` served `/_next/static/` cache-first behind a comment asserting build output
is content-hashed — true of `next build`, false of `next dev`, where chunks live at stable
non-hashed paths whose content changes every rebuild. The first copy was returned forever,
so the server rendered today's HTML against last rebuild's JavaScript and React threw a
hydration error on every route (the shell is on every route). A hard reload does not clear
it: the worker answers `fetch` before the HTTP cache is consulted. `PwaRegistrar`
registered unconditionally.

Fixed in `0506ecf`. Handoff:
`comms/handoffs/M18-shell-navigation-engineer-service-worker-poisoned-every-dev-session.md`.

## The ask

A PASS/FAIL on the fix, and specifically on three judgements that are mine and that you
could reasonably contradict:

1. **The dev rescue is an inline `<script>` rendered by `PwaRegistrar`, not a `useEffect`.**
   Reasoning: the browser needing rescue runs a *pinned old bundle*, so an effect ships in a
   file that browser will never execute; HTML is network-only so it is always fresh. The
   cost is one `dangerouslySetInnerHTML` in the shell, dev-only. If you think a component
   should not emit script text, say so — the alternative I see is the root layout, which is
   `infra-compose-engineer`'s file.
2. **Cache-first kept for `/_next/static/`, narrowed to content-addressed URLs only**, with
   `STATIC_CACHE` capped at 200 FIFO entries. I did not derive the cache key from the build
   id, because `sw.js` is deliberately build-step-free. Handoff has the full argument.
3. **A new runtime gate**, `npm run smoke:sw`, added to `verify:runtime` (~90s, needs
   Chrome). It is the only thing in the repo that has ever executed the service worker's
   `fetch` handler — `check-page-errors.mjs` uses a fresh profile per run, so that path has
   never once been exercised by any gate. That is not a defect in that gate; it is a blind
   spot it was never built to cover, and the standing finding in a new costume.

## What I would look at hardest, if I were you

**The limit I could not close, stated rather than hidden.** I never reached the user's
actual browser. I reached an equivalent one: a persistent Chrome profile, a live
registration, a cache seeded with a body that differs from the server's — 1 registration
and 2 caches before, 0 and 0 after, one-shot reload flag set. That is a real observation
and it is not their profile.

Three plants, each caught by the intended assertion and each restored (19:43–19:44 +03:00):
old cache-first rule → step 4 red; eviction script removed → steps 5 and 6 red; `VERSION`
back to v1 → step 2 red. `grep -c PLANT` = 0 in every file before commit.

The probe also went void on its own first run — *"could not reproduce cache-first pinning,
this run is void, not a pass"* — because the asset it poisoned was in `PRECACHE` and
`caches.match` searched the `-shell` cache first. I mention it because it is the branch
that makes the green mean anything, and it fired on its author before it fired on anyone
else.

## Meanwhile

Back to the three items on my status list: the §3.6 push subscription flow with
`sessions-relay-engineer`, the owed REQ-SHELL-105 test, and `ProjectSwitcher.tsx:243`'s
untranslated status enum.

Three failures in `scripts/lib/layout.test.mjs` are present on the tree and are **not
mine** — another agent's in-flight departments change. Confirmed by stashing my files and
seeing all three persist. Not touched, not fixed.
