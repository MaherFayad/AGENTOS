---
agent: shell-navigation-engineer
milestone: M16
spec: §2.0 · §3.1 (routes only) · `Plan §23.5`, `Plan §23.8`, `Plan §23.11` rule 7 · ADR-015
created: 2026-08-18T02:05
status: ready-for-review
---

# M16 — THREADS replaces SESSIONS in the tab bar

The **slot**, not the view. `sessions-relay-engineer` builds what mounts in it.

## What exists now

- `apps/web/src/components/shell/route.ts` — `ShellView`'s fourth member is `threads`.
  New: `MAX_SEGMENTED_TABS = 4`, `SESSIONS_PATH`, and `ShellRoute.thread` **beside**
  `.session`.
- `apps/web/src/app/(views)/p/[project]/threads/page.tsx` · `threads/[id]/page.tsx` ·
  `threads/ThreadsMount.tsx` — the route and its `ViewMount` placeholder.
- `apps/web/src/components/shell/ViewTabs.keyboard.test.tsx` — new suite, the only one
  that renders the **real** `SegmentedControl` inside the **real** router.
- Touched: `ViewTabs.tsx`, `TopBar.tsx`, `index.ts`, `SegmentedControl.tsx` (**comments
  only** — verified with `git diff`), `app/layout.tsx`, `(views)/layout.tsx`,
  `manifest.webmanifest` (shortcut Sessions→Threads), `strings.en.ts`, `strings.ar.ts`,
  `scripts/smoke-routes.mjs`, `comms/specs/shell-navigation.md` (REQ-SHELL-109…112).

## The decision you came here for — what happened to the SESSIONS route

**Neither redirected nor removed. Both `/p/:project/sessions` and
`/p/:project/sessions/:id` stay live as paths *under* the THREADS tab.**
`parseShellRoute` maps them to `view: 'threads'`, so the tab bar lights THREADS while you
are on a session, and the breadcrumb says `ALL THREADS`.

Two reasons, and they are different reasons:

1. **`/sessions/:id` must not be rewritten, ever.** A relay session id is not an
   `ops.thread` uuid (`thread-model.md` §5.1), and §9.1 — *do session threads get a
   mailbox* — is **open**, so no mapping exists to rewrite through. `/threads/<session-id>`
   would resolve to a thread that does not exist: a dead route that still resolves, which
   is worse than one that 404s. It is also the target of every push notification already
   delivered to a home screen (`sessions/push/payload.ts:128`).
2. **`/sessions` is not redirected *yet*, and that is the weaker claim.** `/threads` is a
   `ViewMount` until the view is built. Redirecting the list would take a screen that
   works — decrypting and listing real relay sessions — and send it to a placeholder.
   Removing a working surface is not what "replaces" means while the replacement is empty.

`ShellRoute` therefore carries **two** id fields, `thread` and `session`, and a test
asserts neither ever holds the other's value.

## Why this is not a fifth tab, and why the count is a gate

`Plan §23.5`'s own answer is that the segmented control ends at **MAP · CHART ·
DASHBOARDS · BOARD**, with THREADS and CALENDAR in the top-right cluster. Neither BOARD
nor CALENDAR exists, so M16 spends the slot SESSIONS held; the count never moves. THREADS
is one glyph shorter than SESSIONS, so the strip is marginally narrower than the
arrangement §23.5 measured — nothing reflows, and `grid-cols-[1fr_auto_1fr]` is untouched.

`MAX_SEGMENTED_TABS` is a constant with a test behind it rather than a paragraph, because
**the day BOARD lands, THREADS leaves the array rather than BOARD joining it** — and that
is the moment a comment would be read past.

## Contracts touched

None changed. Consumed: `thread-model.md` §1, §3, §5.1, §9.1, §10 · `design-tokens.md` ·
ADR-015 (project segment).

## Deliberately not done

- **The THREADS view.** `sessions-relay-engineer`'s. Both routes are `ViewMount`
  placeholders naming them; swapping the element is the whole handover.
- **`/sessions` is not redirected.** Stated above as a *later* step, theirs, gated on the
  thread list being able to list session threads. Left as a comment in
  `sessions/page.tsx` where the person doing it will be standing.
- **No unread/next-up counts on the tab.** `SegmentedOption.badge` exists and is unused.
  §23.5 puts counts in the top-right pair, not on a tab; chrome is monochrome (§1.3), so a
  tinted dot was never available either.
- **`+ New session` still says "session" and still routes to `/sessions?new=1`.** It
  spawns a Claude CLI session, which is a real and different thing from composing a
  thread. `Plan §23.10` renames it to `+ New` when the composer exists — not before, and
  not by me.
- **`VIEW_LABELS` is still untranslated English caps**, as it was for SESSIONS. Net-zero
  RTL debt on the rename, but zero is not clean: `route.ts` has three findings
  (`THREADS`, `Search threads`, `ALL THREADS`) that were three findings before. Pre-existing,
  named here so it is not discovered as new.
- **`threads.mount.*` is scaffold copy.** Three keys, deleted with the placeholder.
- **Nothing observes a real thread.** No thread has ever been written. Every route here is
  *structural* — BRIEF's distinction, and it applies to all of it.

## Verification

Still tree at `e6aa537` + my uncommitted changes. All eight run, all green:

```
typecheck        web · runner · contracts clean
test:web         73 files · 631 vitest · 97 node:test · 0 fail
validate:barrel  7 export * modules · 102 runtime names · 0 collisions
validate:tokens  scanned 2026-08-18 01:59 +03:00 · e6aa537 · violations 0
validate:rtl:gate baseline 308 recorded 2026-08-17 19:45 +03:00 · 8e77a23 — holding.
validate:comms   ok (1 pre-existing warn: 134 open messages)
validate:coverage 731 reqs · 693 implemented · no new warns
smoke            12 routes 2xx and rendered · 38 chunks · 104 barrel modules · log clean
```

Also clean under the new `tsconfig.test.json` instrument: zero errors in
`components/shell`, including the new keyboard suite.

### Falsification — every gate was red before it was green

| Planted defect | Went red | Restored |
|---|---|---|
| A fifth view (`board`) in `VIEWS` | 3 cases: the array, `refuses a fifth view` (5 > 4), the width budget (30 > 27) | ✓ |
| `/sessions` alias removed | 6 cases across `route.test.ts` **and** the keyboard suite | ✓ |
| `/threads/:id` also fills `.session` | `never lets a session id arrive as a thread id` | ✓ |
| `inlineStep` → unconditional `+1` (the M15 bug) | 2 RTL cases; **both LTR cases stayed green** — the exact signature | ✓ |
| `VIEW_LABELS.threads = 'SESSIONS'` | `smoke` — **see below** | ✓ |

**The fifth one is the finding.** With marker `'THREADS'`, smoke **PASSED** against a tab
bar that still said SESSIONS. `app/layout.tsx` puts `MAP / DASHBOARDS / CHART / THREADS`
in every page's `<meta name="description">`, so the marker was satisfied by the document
rather than by the control. Marker tightened to `'>THREADS<'` — the tab's own text node —
and re-falsified in both directions. Routed to `agent-library-curator`: a substring marker
that any part of the document can satisfy is a weak instrument generally, not only here.

## Next agent

`sessions-relay-engineer`. Read this file's *"what happened to the SESSIONS route"*
section and `thread-model.md` §10 (your row), then replace `ThreadsMount` in the two
`threads/` page files. Message sent.
