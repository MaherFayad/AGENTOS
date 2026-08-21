---
agent: shell-navigation-engineer
milestone: M18
spec: §2.0 · §3.6 · §2.2 · Plan §9 · Plan §23.10
created: 2026-08-21T16:20
status: ready-for-review
---

# Audit fixes — the redirect loop, the search index, and the fact that was three levels deep

Five fixes off the user-requested frontend audit
(`comms/audits/20260821-frontend-audit-works-empty-inert.md`) and
`dashboards-engineer`'s 2026-08-17 finding. Not a milestone slice; filed under M18 to match
`M18-drawer-engineer-audit-inventory.md`.

**Nothing here makes a runner run.** `runnerConfigured` is still `false`, the ledger is
still empty, zero agent runs have ever executed. What changed is that the shell now says
so, and that the two navigation paths that were broken are not.

## What exists now

| path | what changed |
|---|---|
| `apps/web/src/components/shell/route.ts` | `legacyRewriteTarget()` — new. `viewHasZoom()` → MAP only. `viewHasYourTreeFilter()` — new, `false` |
| `apps/web/src/components/shell/LegacyRouteResolver.tsx` | consumes `legacyRewriteTarget`; new "Nothing at this address" screen |
| `apps/web/src/components/shell/useSearchIndex.ts` | `kind` required on `GraphNodeLike`; `nodeHref()`; panel envelope unwrapped; `allDropped()` |
| `apps/web/src/components/shell/ConnectionStatus.tsx` | reads `runnerConfigured`; `NOT CONFIGURED` label |
| `apps/web/src/components/shell/ZoomControls.tsx` | the readout's two sentences name only MAP |
| `apps/web/src/components/shell/BreadcrumbStrip.tsx` | `YOUR TREE` hidden while nothing subscribes |
| `apps/web/src/components/shell/test-harness.tsx` | `GRAPH_FIXTURE` carries `kind`, plus a leaf and an anchor |
| `apps/web/src/components/shell/useSearchIndex.test.ts` | new — the href/route assertion |
| `apps/web/src/components/shell/__fixtures__/api-payloads.json` | new — payload captured from the live runner, `_observed` stamped |
| `scripts/check-page-errors.mjs` | `visit()` returns `finalPath`; four loop routes; the `/p/`-segment property |
| `scripts/rtl-baseline.json` | ratchet 308 → 312, itemised |

Commits: `145eda3`, `795a11f`, `b5db7a6`, `c2f5ccd`.

## The five, and what each cost

**1. The unbounded redirect loop.** `/approvals/abc123` → `/p/agentos/p/agentos/…`, without
terminating, with `replace` so the back button could not recover. Two of §3.6's three push
notification types deep-link straight into it. Diagnosed by `dashboards-engineer` on
2026-08-17; **it sat unread in my inbox for four days.** The mechanism is the part worth
keeping: an inbox that only grows is a system problem, and four days of two-thirds of push
being dead is what it costs. The fix is their narrow property verbatim — rewrite only when
`splitProject(pathname).project === null`.

**2 & 3. `useSearchIndex`, both bugs.** `parsePanels` read `entry.title` where the runner
sends `{id, panel:{title}}`, dropping all six panels. `parseGraph` dropped `kind` and
`.pop()`ed every id, dead-ending 48 of 60 nodes. Between them the index resolved **12 of 66
indexable things** — in the one control that makes a canvas galaxy reachable without a
mouse.

**4. `runnerConfigured` in the status pill.** `● UNKNOWN · 0 QUEUED` is pixel-identical to a
healthy idle runner. Now `NOT CONFIGURED`, monochrome, in words, on every screen.

**5. Two inert controls, corrected rather than explained.** The zoom readout promised CHART
a level that was never coming; `YOUR TREE` reported success into a bus with no subscriber.

## The three findings worth not rediscovering

**An empty parse is not a successful parse.** `parsePanels` returned `[]`, `useEndpoint`
read that as success, `usePanelIndex` reported `ready`, `message` stayed `null` — and every
piece of honest-empty machinery in the shell was correct and silent, because it said exactly
what it would say about a project with no dashboards. A parse handed entries that yields
none has not found an empty list; it has failed to understand the list. **A checker that
cannot distinguish "nothing matched" from "nothing was indexed" is blind in the way that
matters.** Now `malformedMessage`'s case, gated.

**A test that supplies the missing consumer cannot see the consumer is missing.**
`BreadcrumbStrip.test.tsx` subscribed to `shell:yourTree` itself, clicked the button, and
watched its own listener fire. Every assertion true, feature absent, green for months. This
is *"a producer without a consumer is not a feature"* with the test standing in for the
consumer — a new costume, and a nasty one, because the test looks like exactly the right
test.

**A gate that only listens for complaints is deaf to a page that is quietly wrong.** All
three of `check-page-errors`' detectors were working correctly over the redirect loop for
four days. Nothing throws while it loops, and the loop paths were not in `ROUTES`. An
include-list plus a no-exception check is not a check that the page went where it said.

## Contracts touched

**None changed.** `graph-layout.md` §kind, `panel-schema.md` and `api-contracts.md`'s
`GET /api/status` row were all already correct — every one of these bugs was a *consumer*
failing to read what the contract already specified. That is the point: three contract-vs-
behaviour defects, zero contract edits.

One naming collision found and worth someone's decision, not mine: `apps/runner/src/lib/panels.ts`
exports `PanelSummary` as the envelope `{id, panel}`, and `packages/contracts/src/panels.ts`
exports `PanelSummary` as a **flat** type with a top-level `title`. Two shapes, one name.
That is what my code guessed wrong about. Filed to `dashboards-engineer` and `runner-engineer`.

## Deliberately not done

- **The segmented-control-to-links change.** Explicitly out of scope by instruction; it is a
  structural move and should be decided on its own.
- **`/p/agentos` (a project naming no view) now shows the not-found screen** rather than
  redirecting to `/p/agentos/map`. A second rewrite rule would contradict "rewrite only when
  `project === null`", which is the whole property. Recommended as a separate one-line
  decision, not taken here.
- **The four new strings are not catalogued.** `useI18n` is not wired into any shell
  component; doing it for two of them would leave the module inconsistent and is M8's job.
  Ratchet raised instead, itemised, and filed to its owner.
- **`notCounted` in `rtl-baseline.json` left stale.** Four blind-spot counts have moved but
  most of the movement is concurrent `drawer/` and `panels/` work. Re-measure on a still tree.
- **The audit's other seven findings are not mine and were not touched** — F2 (invisible
  disabled reasons), F3, F4 (unknown project renders another's library), F5, F6 (focus ring),
  F7, F8, F9 (`ViewMount` leaking `BUILT BY …` to users), F10. F9 is in my files and I left
  it: it is a copy decision that wants the reviewer's eye, not a fix bundled into this round.
- **Nothing about search's keyboard model changed.** `/` to focus, arrows, Enter, Esc all
  behave as before; only the destinations were wrong.

## Verification

Everything below on the tree at `c2f5ccd`, against the user's live stack
(`next dev` 127.0.0.1:4321, runner 127.0.0.1:8787, no API key, no Postgres).
**The tree moved under me throughout** — `drawer-engineer` landed ~20 files in
`apps/web/src/drawer/` and `i18n/` concurrently. All commits used `git commit -F <msg> -- <paths>`;
none of their work is in mine.

| gate | result |
|---|---|
| `typecheck` · `typecheck:tests` | clean |
| `test` (node scripts) · `test:runner` | `fail 0` |
| `test:web` | **99 files, 940 tests, all pass** |
| `validate:{frontmatter,panels,tokens,barrel,comms,coverage}` | PASS |
| `validate:rtl:gate` | `holding` at 312 |
| `smoke:browser --base :4321` | **17 routes, no uncaught exceptions, no console.error**, 20 backend absences (honest — no Postgres) |
| `smoke:browser --falsify` | uncaught exception YES · console.error YES |

**Observed in Chrome at 1440×900, 2026-08-21T16:05–16:12Z** (probe kept in the session
scratchpad, never in `apps/`, `packages/` or `scripts/`):

```
/approvals/abc123 → /p/agentos/approvals/abc123   1 "/p/" segment   "Nothing at this address"
/runs/abc123      → /p/agentos/runs/abc123        1                 "Nothing at this address"
/p/agentos/nope   → /p/agentos/nope               1                 "Nothing at this address"
/calendar         → /p/agentos/calendar           1                 "Nothing at this address"
                                        (was 16–18 segments, unbounded, empty <title>)

status pill: "NOT CONFIGURED"        (was "UNKNOWN · 0 QUEUED")
search "growth"   → first option growth-signal-scorer (a leaf)
                  → Enter → /p/agentos/map/sales/account-enrichment, drawer loads
                                        (was /map/sales/growth-signal-scorer, not-found drawer)
search "delivery" → Client Delivery · Engagements (a panel)
                  → Enter → /p/agentos/dashboards/client-delivery
                                        (was: no panel results existed at all)
```

**Every fix falsified, and every plant verified present in the file before the run:**

| plant | red | restored |
|---|---|---|
| unconditional rewrite (unit) | 3 of 5 red, naming the loop | ✓ |
| unconditional rewrite (browser) | 4 routes, 16–18 `/p/` segments | ✓ |
| `.pop()` restored | 3 red | ✓ |
| panel envelope not unwrapped | 6 red | ✓ |
| `allDropped` guard removed | 1 red | ✓ |
| `unconfigured = false` | 3 red | ✓ |
| a `chart/` file subscribing to `shell:zoom` | 1 red, naming the fix | ✓ |
| a `map/` file subscribing to `shell:yourTree` | 1 red, naming the fix | ✓ |

`grep -c PLANT` over every touched file returns 0, and both probe files were deleted.

**What this does not prove:** the 1440px side-by-side is still not runnable — the reference
frames do not exist. Everything above is conformance to written spec plus real browser
behaviour, not fidelity to the video.

## Environment finding — the scratchpad is not session-isolated

Its banner says *"session-specific, isolated from the user's project"*. It is not. My
session directory `…/a003bc86-…/scratchpad/` holds ~170 files spanning **2026-08-17 to
2026-08-21** from at least five agents — `fidelity-qa-reviewer`'s audit screenshots
(`chart-*.png`, `focus.png`, `rtl-map.png`), `rtl-arabic-pdpl-specialist`'s
`old316.json`/`new308.json`, `scheduler-engineer`'s `cron.ts.orig`, `drawer-engineer`'s
`JobDrawer.orig` and `drawer-probe.mjs` **written at 19:03 local while I was working**.
Forty-eight sibling session directories exist, so per-session directories are created — this
one is simply shared.

The sharp version, because it is a hazard and not a curiosity: **`plant.mjs` and
`restore.mjs` sit there, written by another agent on 2026-08-19, and both are live
file-mutating scripts targeting `apps/web/src/drawer/JobDrawer.tsx`.** Those are exactly the
filenames an agent following this repo's plant-verify-red-restore discipline would choose. A
`node plant.mjs` typed in good faith would silently rewrite another agent's file while they
are editing it. The only thing that would have stopped it is that both scripts assert before
writing — luck, not design.

`COMPANY.bak` is also there: 10KB of the user's second brain, in a shared temp directory.

**Until this is fixed, name scratchpad files with your agent slug and the date** — mine are
`shellnav-20260821-*`. Do not assume a file you find there is yours, and do not assume one
you write will not be read by someone else.

## Next agent

- **`fidelity-qa-reviewer`** — review-request filed. Start with `useSearchIndex.test.ts`:
  the assertion you asked for is there, and the interesting part is that the route-shape half
  of it **passes with the bug live**. Only payload membership catches it.
- **`sessions-relay-engineer`** — your push deep links work now. `/approvals/:id` and
  `/runs/:id` land on an honest "Nothing at this address" screen rather than looping; they
  still do not reach a view, because neither view exists. The project field in the payload is
  still yours and still worth adding.
- **`map-galaxy-engineer`** — `YOUR TREE` is hidden until something subscribes to
  `shell:yourTree`. Subscribe on the canvas and `route.test.ts` will fail and tell you to
  flip `viewHasYourTreeFilter`. Same shape for `shell:zoom` if CHART ever grows a camera.
