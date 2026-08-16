---
agent: drawer-engineer
milestone: M3
spec: §2.3, §2.6.5, §1.3, Part VII.3
created: 2026-08-16T17:20
status: ready-for-review
---

# M3 — LAST RUNS was reading the wrong runs

`LAST RUNS` (§2.3, and its mirror in §2.6.5) was bound to `GET /api/runs`. That route reads
`services.store.list()` — the runner's **in-memory** store, holding only what the current
runner process executed. It is empty after every restart. So the section could never show
history, and would have gone blank on every deploy even after a real API key was set.

The durable ledger is `ops.agent_runs` in Postgres, served by `GET /api/metrics/runs`.
`observability-engineer` proposed exactly this move on 2026-08-15 and I deferred it, on the
grounds that with both lists empty the choice was invisible. That reasoning was wrong and is
worth writing down: **an empty list is precisely the state in which a wrong binding is
invisible.** The binding was already broken; deferring only delayed finding out.

The fix is four lines of URL and rather more care about what a missing number means.

## What exists now

- `apps/web/src/drawer/data/client.ts:98` — `fetchRuns()` now calls
  `GET /api/metrics/runs?agent=<slug>&limit=<n>`. The `agent=` filter is applied
  **server-side** (`lastRuns(db, {agent}, limit)` in `apps/runner/src/routes/metrics.ts:115`),
  verified before rebinding, so this asks for five rows and receives five rows. No
  client-side filtering of a wide page — that would silently render four rows for a busy
  agent and look entirely plausible.
- `apps/web/src/drawer/data/types.ts` — `RunRow` gains `costSource?: 'sdk'|'derived'|'unpriced'`.
- `apps/web/src/drawer/data/normalize.ts` — carries `costSource` through untouched (never
  inferred); accepts the ledger's `cancelled` spelling as `canceled`.
- `apps/web/src/drawer/sections/LastRuns.tsx` — a `CostCell` that renders an unpriced run
  honestly.
- `apps/web/src/drawer/drawer.module.css:503` — `.runMetaAbsent`, one step dimmer
  (`--ink-3`), non-tabular, so a word in a column of numbers does not pretend to be one.
- `apps/web/src/drawer/data/client.test.ts` — 7 new tests pinning all of the above.
- `apps/web/src/drawer/sections/SkillFileCard.tsx:110,123` — `⏰` → lucide `Clock`.

Both drawers share one `LastRuns`; there is one component set and a `side` prop, so the
§2.6.5 chart drawer got every one of these changes for free. Verified in both.

### The three things that needed judgment, not typing

**1. A null cost is not a zero cost.** 16 of the seeded runs carry
`costSource: 'unpriced'`, which the ledger's CHECK constraint ties to `cost_usd IS NULL`
(`0001_ops_run_ledger.sql:58`). `formatCost(undefined)` returns `null`, so before this
change those rows simply showed no cost — no `$0.00`, no `NaN`, which was the easy half.
But a blank cell in a column of dollar amounts reads as *cheap*, and "nobody priced this
run" is not "this run was cheap". The cell now says `unpriced`, dimmed, with
"This run was never priced — no token usage was recorded for it. Not the same as costing
nothing." on hover.

The discipline that matters: it says that **only when the ledger said `costSource:
'unpriced'`**. A missing cost with no `costSource` at all — a row from a source that does
not report one — still renders nothing, because there we genuinely have not been told
anything. Inferring "unpriced" from "no number" would manufacture the exact distinction the
field exists to preserve.

**2. The ledger and the API contract spell `cancelled` differently.** The ledger's CHECK is
`status IN ('ok','error','cancelled','awaiting-approval')`; `packages/contracts/src/api.ts:117`
and the SSE `done` event say `canceled`. `normalizeRuns` drops rows whose status it does not
recognise — deliberately, because an unknown outcome painted as a grey dot is an outcome we
invented — so reading the ledger unaliased would have made a cancelled run **vanish from its
own history**, quietly shortening the list to four rows. `normalize.ts` now maps
`cancelled → canceled`, with both file:line references in the comment and a test. That is an
alias between two spellings of one word, not a guess; anything genuinely unrecognised is
still dropped.

**3. The ledger cannot store `denied` at all.** `api-contracts.md:44` says "a denied run is
data, not a discard — the queue and LAST RUNS both show it", but `denied` is not in the CHECK
constraint. Today no run has ever been approved or denied so it cannot fire; the first
denial at an approval gate will either throw or record something that is not what happened.
Not mine to fix (`apps/runner/**`), filed with the one-line diff.

## How to use it

Nothing to wire. Any drawer that renders `<LastRuns state={runs} />` gets the ledger.

```
GET /api/metrics/runs?agent=operations%2Ffollow-up-coordinator&limit=5
→ {"runs":[{runId, agent, agentName, startedAt, status, durationMs, costUsd, costSource, traceUrl}]}
```

`startedAt` stays ISO 8601 and relative time is still rendered client-side, so the list ages
without polling. `limit` defaults to 5 and clamps to 50 upstream.

## Contracts touched

`comms/contracts/api-contracts.md` — **owned by `runner-engineer`, edited by me.** Two
changes: the `/api/runs` row is marked "this process only", and a new subsection
`### GET /api/runs is the queue, not the history` says which route forgets and lists which
consumer reads which. It deliberately does **not** restate the `/api/metrics/runs` payload —
that shape lives in `comms/specs/observability.md`, and copying it here would create the
second source of truth this whole bug is an instance of.

I edited rather than only asking because the contract was the reason the bug existed: two
routes, nearly the same name, nearly the same payload, and nothing in the file saying which
one is ephemeral. Leaving it stale while the code moved would have set up the next reader to
make the identical mistake. Ratification request, with both edits quoted verbatim, is in
`comms/inbox/runner-engineer/20260816-1655-drawer-engineer-runs-vs-metrics-runs-contract-note.md`
— revert or rewrite freely, no drawer code depends on the wording.

No other contract changed. `frontmatter-schema.md` untouched: every string in both drawers
still comes from frontmatter, and no per-agent copy was added.

## Deliberately not done

1. **`GET /api/runs/:runId/tools` still not wired.** `observability-engineer` offered it for
   per-row tool spans. §2.3 asks for one behaviour on a LAST RUNS row — open the trace — and
   that works. An expandable span list is a new interaction, not a fix, and it belongs in a
   pass that designs it rather than in a bug fix that smuggles it in.
2. **`/api/runs` not removed from the drawer's vocabulary, because it is still correct for
   what it is.** It is the live queue. The distinction is now written into `client.ts` and
   the contract instead of being deleted, because the next person to need "what is this
   process doing right now" should find the right route, not an absence.
3. **`costSource: 'sdk'` vs `'derived'` not surfaced.** A derived cost is tokens × published
   list rate — an estimate, not an invoice — and arguably the drawer should say so. But it
   is *a real number honestly computed*, unlike `unpriced`, and marking every row with its
   provenance would put a third column of chrome into a five-row list to distinguish two
   kinds of true. If a cost dispute ever happens, this is the first thing to add.
4. **The `⏰` swap was taken; `⬇` and `▶` were left.** Both are text-presentation glyphs that
   already inherit `currentColor`, which is the whole complaint against `⏰`. If
   `design-system-guardian` writes the rule as "no emoji in chrome" rather than "no *colour*
   emoji", they go too — two lines. Answered on the orchestrator's `_all` message.
5. **The drawer's `validate:rtl` debt went from 10 to 11.** The new `unpriced` tooltip is a
   hardcoded English string, like its ten neighbours. `apps/web/src/i18n/strings.en.ts` is
   outside my boundary, and adding one key there in a bug fix would split the M8 catalogue
   pass across two agents' commits for no benefit. It is the same pass, one item longer.
6. **No data seeded, invented, or corrected.** The 208 `demo_`-prefixed rows are the human's
   lamp; I read them and wrote nothing. I did not touch `scripts/seed-demo-data.mjs` even
   after finding a defect in its output (below).
7. **The seed's future timestamps not worked around.** The newest ledger rows are ~3h ahead
   of `now()` in UTC — `demo_00208` is `2026-08-16T16:52:20.000Z` against a `13:40Z` clock —
   which looks like local wall-clock time written with a `Z`. `relativeTime()` clamps a
   negative age to zero, so the top row reads "just now" rather than "in 3 hours". I left the
   clamp: it prints no invented number, and once real runs exist the case cannot arise.
   Reported to `observability-engineer`, because rolling-window arithmetic over the ledger is
   being handed rows from the future and that is a bigger problem than one label.
8. **No honest-empty LAST RUNS observed live.** All 12 agents have seeded rows, so the
   "No runs yet." state could only be exercised in unit tests, not on screen. Worth a look
   when the next agent lands with no history.

## Verification

Servers as found: web `next dev` on `:4321`, runner on `127.0.0.1:8787` with `DATABASE_URL`,
Postgres in Docker. 208 rows in the ledger.

The bug, before:

```
GET /api/runs?agent=sales/account-enrichment&limit=5   → {"runs":[]}
GET /api/metrics/runs?limit=2                          → 2 real rows
GET /api/metrics/runs?limit=3&agent=customer/support-triage → 3 rows, all that agent
GET /api/metrics/runs?limit=3&agent=zzz/nope           → {"runs":[]}    (filter is real)
```

Live, at 1440×900. `/tmp/drawer-lastruns.png` — `sales/account-enrichment`, five priced rows.
`/tmp/drawer-lastruns-followup.png` — `operations/follow-up-coordinator`, chosen because its
top five contains **both** an unpriced run and an errored one:

```
LAST RUNS
28m ago   $0.63     27.5s     · teal dot
5h ago    $0.66     27.4s     · teal dot
2d ago    unpriced  55.2s     · teal dot     ← ledger says costSource:'unpriced'
2d ago    $0.53     33.5s     · CORAL dot    ← a failed run that still cost money
3d ago    $0.52     19.7s     · teal dot
```

Every row is an `<a target="_blank">` on its real Langfuse trace, confirmed by reading the
DOM rather than by looking at it:

```
{tag:"A", href:"http://127.0.0.1:3001/project/demo/traces/demo_trace_00180",
 title:"Run 2d ago — finished · open the trace",
 absent:["unpriced :: This run was never priced — no token usage was recorded for it. …"]}
```

Network on a warm load — the new route, and only the new route:

```
GET /api/metrics/runs?agent=operations%2Ffollow-up-coordinator&limit=5 → 200 (98ms, 1433B)
(no GET /api/runs)          (no console errors)          (no 5xx)
```

§2.6.5 mirror: `/chart/operations` → Follow-Up Coordinator → `More detail →`. Same five rows,
same `unpriced`, same coral dot, on the right-hand side. One component, two projections.

Checks:

```
vitest run src/drawer                8 files, 34 tests pass  (7 new)
npm run build                        ✓ compiled, 18 routes, 0 errors
npm run validate:tokens              0 failures under drawer/**
npm run validate:comms               104 messages, 5 contracts, 9 decisions — ok
grep -n '⏰' apps/web/src/drawer/     empty
```

**Two build hazards, both worth knowing.** `npm run build` against a live `next dev` on the
same `.next` fails at "Collecting page data" with `Cannot find module './383.js'` — the
mirror image of the failure `shell-navigation-engineer` documented in
`20260816-1556-…-dev-server-is-next-dev.md`, and it also leaves the dev server 500-ing
app-wide. I stopped the dev server, built clean, and **restarted it**; `/`, `/map/*`,
`/chart`, `/dashboards/*` and `/api/*` all verified 200 afterwards. Separately, the dev
server was already 500-ing app-wide when I arrived, from a parallel build — the symptom is a
missing `.next/routes-manifest.json` and it recovers on its own when the build finishes.

Not mine, pre-existing, unfixed: `src/components/primitives/KpiNumeral.test.tsx` fails one
count-up timing assertion (`design-system-guardian`), and `validate:tokens` reports two
`text-[11px]` literals in `dashboards/components/SignalsStrip.tsx` (`dashboards-engineer`,
actively editing). `apps/web/src/dashboards/**` untouched throughout — the identical binding
bug there is theirs and was being fixed in parallel.

## Next agent

- `runner-engineer` — ratify or rewrite the `api-contracts.md` subsection:
  `comms/inbox/runner-engineer/20260816-1655-drawer-engineer-runs-vs-metrics-runs-contract-note.md`.
  Nothing blocks on it.
- `observability-engineer` —
  `comms/inbox/observability-engineer/20260816-1700-drawer-engineer-ledger-cannot-store-denied.md`.
  Two vocabulary defects in `ops.agent_runs.status` plus the seed's future timestamps.
- `fidelity-qa-reviewer` — review-request filed. The two screenshots above are the evidence;
  the thing to judge is whether `unpriced` in `--ink-3` reads as a fact rather than as an
  error state.
