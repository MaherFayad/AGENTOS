---
agent: shell-navigation-engineer
milestone: M18
spec: §3.6 (PWA), §2.0 (the shell, as the surface that showed the symptom)
created: 2026-08-21T20:05
status: ready-for-review
---

# M18 — the service worker pinned every `next dev` chunk, and no gate could have seen it

## What was wrong

`apps/web/public/sw.js` served `/_next/static/` **cache-first** into a cache keyed by a
hardcoded `VERSION`, behind a comment that asserted build output is content-hashed. That is
true of `next build` and false of `next dev`: dev chunks live at stable, non-hashed paths
(`/_next/static/chunks/app/layout.js`) whose content changes on every rebuild. The first
copy was therefore returned forever.

The symptom the user reported as "hydration errors everywhere" is exactly that: the server
renders today's HTML, the worker serves last rebuild's JavaScript, and React reports the
mismatch — **on every route, because the shell is on every route**. `SegmentedControl`
rendering `THREADS` server-side against a pinned bundle rendering `SESSIONS` is the visible
form. A hard reload does not help: it bypasses the HTTP cache, and the worker answers
`fetch` before the HTTP cache is consulted. `PwaRegistrar` registered unconditionally —
there was no `NODE_ENV` guard anywhere in `pwa.ts` or `sw.js`.

## What exists now

- `apps/web/public/sw.js` — `VERSION` `cc-shell-v1` → `cc-shell-v2`; `isImmutableAsset()`
  replaces the comment; `STATIC_MAX_ENTRIES` + `trimStatic()`; header rewritten.
- `apps/web/src/lib/pwa.ts` — `isDevelopment()`, a dev guard **inside**
  `registerServiceWorker()`, and `DEV_SERVICE_WORKER_EVICTION` (the rescue snippet).
- `apps/web/src/components/shell/PwaRegistrar.tsx` — renders the eviction script in
  development, `null` in production; still registers in production.
- `scripts/check-sw-poisoning.mjs` — the probe. `npm run smoke:sw`, in `verify:runtime`.
- `scripts/__tests__/shell-pwa.test.mjs` — rewritten to **execute** `sw.js` in a fake
  `ServiceWorkerGlobalScope` rather than grep it.
- `apps/web/src/components/shell/PwaRegistrar.test.tsx` — new.
- `apps/web/tsconfig.json`, `.gitignore` — register `.next-swprobe` alongside the other
  three dist dirs, so Next never rewrites `tsconfig.json` mid-run.

Commit `0506ecf`, staged by path.

## The four changes, and why the third is the one that matters

1. **`registerServiceWorker` is a no-op in development.** The guard is inside the function,
   not at its one call site, so a second caller cannot reintroduce it.
2. **`PwaRegistrar` renders an inline eviction script in development** — unregister every
   worker, delete every cache, reload **once** behind a `sessionStorage` flag.
   **Deliberately not a `useEffect`.** The browser that needs rescuing is running a *pinned
   old bundle*: code added to the bundle today does not exist in the copy that browser is
   being served, so an effect-based unregister reaches only the browsers that never needed
   it. Navigations are network-only, so the HTML is always current — an inline script is
   the one thing on the page guaranteed to be today's code. The reload is not decoration:
   unregistering does not re-fetch the chunks this page already took from the cache.
3. **`isImmutableAsset()` replaces the comment.** Cache-first now applies only to URLs a
   rebuild cannot reuse — a content hash in the filename, or a build-id directory — and
   *everything else under `/_next/static/` is left to the browser entirely* (no
   `respondWith`, no cache read, no cache write). This is the change that makes the class
   structurally impossible rather than merely guarded: a dev chunk is uncacheable even if a
   registration somehow survives. It is also "a comment is not a mechanism" applied to the
   exact comment that caused this.
4. **`VERSION` bumped**, so `activate` purges every `cc-shell-v1-*` cache on the next load.

## The `/_next/static/` cache-first decision (asked for explicitly)

**Kept, and narrowed.** Content hashing does make cache-first correct, and it is what makes
the PWA open instantly on a phone — so it stays for URLs that carry a hash. Two hazards
were real and both are now closed:

- *"any non-hashed asset is pinned permanently"* — no longer reachable. Non-hashed is
  network-only.
- *"`STATIC_CACHE` grows without bound because `VERSION` is a constant no deploy changes"* —
  true, and now capped at **200 FIFO entries**. Every entry is content-addressed and
  therefore disposable; eviction costs one re-fetch. A build-id-derived cache key would be
  the tidier answer and is **not** taken: `sw.js` is plain JS with no build step by design,
  and giving it one is how a service worker silently stops matching the app it caches.

Stale-while-revalidate was considered and rejected: it would still serve one stale copy per
load, which in dev is one broken page per rebuild — it treats the symptom.

## Contracts touched

None. No API shape, no panel schema, no frontmatter field. `verify:runtime` gained a step.

## Deliberately not done

- **No production behaviour change beyond the cache-key narrowing and the cap.** Production
  still registers, still precaches `/offline` + manifest + two icons, still network-only for
  `/api/*` and `/ws/*`.
- **`sw.js` has no dev detection of its own** and deliberately gets none. It cannot know
  `NODE_ENV`, and every trick for guessing it is a heuristic in the one file that must not
  guess. `isImmutableAsset` gets the same outcome by asking a question the URL can answer.
- **The probe does not verify the *original* worker's behaviour**, because that would mean
  committing a deliberately-poisoning `sw.js` into `public/`. Step 3 anchors on the current
  worker instead, on a URL it still legitimately cache-firsts.
- **The probe does not assert the page renders correctly after rescue**, only that the
  registration and caches are gone and the reload fired. Asserting rendered content would
  duplicate `smoke:browser` and couple this probe to view markup.
- **No `--falsify` flag.** The three plants below were run by hand. A built-in falsify mode
  would have to ship a broken worker to flip to, which is the same objection as above.
- **Not attempted: proving this fixes the user's specific browser.** I cannot reach it. The
  evidence is that an equivalently poisoned Chrome recovers.

## Verification — what was run, and when

All times +03:00 on 2026-08-21, on a tree still enough for the reading.

| Gate | Result |
| --- | --- |
| `npm run smoke:sw` (19:50, again 19:42) | **clean** — 6 observations in real Chrome |
| `npm run smoke:browser` (19:55) | 17 routes, no uncaught exceptions, no `console.error`, 23 backend absences |
| `npm run typecheck` / `typecheck:tests` (19:51) | green — `typecheck:tests` caught two real errors in the new test first |
| `npm run test:web` (19:52) | 104 node + 18 vitest, both halves green |
| `npm run lint --workspace=apps/web` | no warnings or errors |
| `npm run validate:barrel` | 133 names, 0 collisions |
| `npm run validate:tokens` (19:55) | see banner below |

`check-tokens` provenance banner, verbatim (contract §8b):

```
  scanned at        2026-08-21 19:55 +03:00 · 74aea50 · 7 uncommitted under apps/web · checker modified under scripts
  files scanned     373
  violations        0
```

The probe's own output at 19:50:

```
  1. seeded the previous version's caches: cc-shell-v1-shell, cc-shell-v1-static
  2. registered /sw.js — worker activated at http://127.0.0.1:61755/, controlling=true
     activate purged them; caches now: cc-shell-v2-shell
  3. anchor: /icons/icon-512.png returned the seeded body, not the server's — pinning is real here
  4. /_next/static/chunks/app/layout.js ignored the seeded entry and returned 300+ bytes from the server
  5. rescued: 1 registration(s) and 2 cache(s) before, 0 and 0 after; one-shot reload flag = 1
  6. a second development load registered nothing
```

Line 2 is the answer to *"verify that chain actually runs rather than assuming it"*: the
worker installed, skipped waiting, activated, deleted both seeded v1 caches, and claimed the
document. Observed, not read off the source.

## Falsification — three plants, each caught by the intended assertion

| Plant | Expected red | Observed |
| --- | --- | --- |
| the original `startsWith('/_next/static/')` cache-first rule restored | step 4 | **red at 19:43**, exit 1, and the node suite's dev-chunk test went red under the same plant |
| the eviction script removed from `PwaRegistrar` | steps 5 and 6 | **red at 19:43**, exit 1; the vitest case went red too |
| `VERSION` back to `cc-shell-v1` | step 2 | **red at 19:44**, exit 1 |

Every plant was restored and `grep -c PLANT` returned 0 in each file before the commit.

**And the probe falsified itself before I did.** Its first run exited 2 with *"could not
reproduce cache-first pinning — this run is void, not a pass"*, because the asset it was
poisoning (`icon-192`) is in `PRECACHE`, and `caches.match` searches the `-shell` cache
first. The void-not-pass branch worked on its own author, which is the only reason I trust
it. Re-aimed at `icon-512`. The header-describes-the-file test failed on its first run too,
having sliced the header to the nine characters of the eslint pragma.

## What this still cannot see — the honest limit

**I could not reach the user's actual browser.** What I reached is an equivalently poisoned
one: a persistent Chrome profile with a live registration and a cache seeded with a body
that differs from the server's. That is the closest observation available, and it is a real
one — but it is not their profile, and there is one path I cannot exercise: a browser whose
pinned bundle predates `PwaRegistrar` **entirely** (an app version with no registrar at all
would still have no registration, so this is bounded, but I have not proved that).

The two rescue mechanisms are independent, which is why both are here: the inline script
runs from fresh HTML regardless of how stale the chunks are, and the `VERSION` bump fires
through the update check that the *old* bundle's own `register()` call still triggers. Under
the new worker even a hostile race is benign — dev chunks are network-only, so re-registering
mid-rescue cannot re-poison anything. That composition is reasoned, not observed.

The node suite is a fake `caches` and a fake `fetch`. It proves routing logic and nothing
about Chrome. Its header says so.

## For the person who is blocked right now

Reload `localhost` once. The dev server recompiles `AppShell`, the fresh HTML carries the
eviction script, it unregisters the worker, deletes the caches and reloads once. Nothing to
do by hand. If a worker was already unregistered manually, nothing happens.
