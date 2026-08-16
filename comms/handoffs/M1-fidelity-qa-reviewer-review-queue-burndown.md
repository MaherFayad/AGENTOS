---
agent: fidelity-qa-reviewer
milestone: M1
spec: PART VI (acceptance), §1.3, §1.4, §1.6, §2.1, §2.2, §2.3, §2.4, §2.5, §2.6, §3.3, §3.5, Part VII.3
created: 2026-08-16T20:47
status: ready-for-review
---

# Phase 0 step 0.1 — the review queue, burned down

`AGENTOS-V2-PLAN.md` §4 step 0.1. Nine specialists sat in `State: review` with 26 items in
`comms/inbox/fidelity-qa-reviewer/`, six of them `open`. Every one now carries a verdict.
Ordered by milestone dependency (M1 → M2 → M5 → M6), not by arrival.

## Verdicts

| Milestone | Surface | Verdict | Findings | Owner of the fix |
|---|---|---|---|---|
| **M1** | shell + MAP | **FAIL** | 1 | `map-galaxy-engineer` |
| **M2** | drawer §2.3 / §2.6.5 | **FAIL** | 2 | `drawer-engineer` |
| **M5** | CHART matrix §2.6 | **PASS** | 0 | — |
| **M6** | DASHBOARDS §2.4–2.5 | **FAIL** | 2 | `dashboards-engineer` (1) · `design-system-guardian` (1) |
| M3 | observability §3.5 | **PASS** | 0 | — |
| M8 | RTL/Arabic — SESSIONS slice | **PASS** | 0 | — |
| M1 | shell §2.0 / §3.6 (both messages) | **PASS** | 0 | — |
| M0 | infra — full stack up (0.2 / 0.6) | **PASS** on 0.6, **PARTIAL** on 0.2 | 0 | needs a human with Tailscale |

**Two of the four gated milestones are one token change away from clearing.** M2's finding 2
and M6's finding 1 are the same defect in two files. M1's finding and the parallel
`runner-engineer` item are the same defect in two implementations.

## What exists now

Review answers, appended as `## Answer` to the original messages and flipped to
`status: answered`:

- `comms/inbox/fidelity-qa-reviewer/20260816-1555-shell-navigation-engineer-shell-review.md`
- `comms/inbox/fidelity-qa-reviewer/20260816-1525-shell-navigation-engineer-review-barheight.md`
- `comms/inbox/fidelity-qa-reviewer/20260816-1510-drawer-engineer-m2-drawers-live.md`
- `comms/inbox/fidelity-qa-reviewer/20260816-1720-drawer-engineer-last-runs-durable-ledger.md`
- `comms/inbox/fidelity-qa-reviewer/20260816-1236-observability-engineer-m3-review.md`
- `comms/inbox/fidelity-qa-reviewer/20260816-1453-rtl-arabic-pdpl-specialist-m8-sessions-review.md`
- `comms/inbox/fidelity-qa-reviewer/20260816-2053-infra-compose-engineer-review-full-stack-up.md` (arrived mid-review)

New `review-request` messages routed to owners who had nothing open:

- `comms/inbox/map-galaxy-engineer/20260816-2047-fidelity-qa-reviewer-m1-fail-brain-completeness.md`
- `comms/inbox/dashboards-engineer/20260816-2047-fidelity-qa-reviewer-m6-fail.md`
- `comms/inbox/chart-matrix-engineer/20260816-2047-fidelity-qa-reviewer-m5-pass.md`
- `comms/inbox/runner-engineer/20260816-2047-fidelity-qa-reviewer-brain-completeness-fabricated.md`
- `comms/inbox/design-system-guardian/20260816-2047-fidelity-qa-reviewer-kpinumeral-negative-countup.md`

## The findings, in one place

### The one fabricated number in the system — M1

`company/COMPANY.md` is 0 of 20 answered and says so at line 18. Two independent producers
report it 45% complete:

- `scripts/build-graph.mjs:110-115` counts `## ` headings and divides by 20. Nine headings →
  `0.45`. Baked into `apps/web/public/graph.json` and served by `GET /api/graph`.
  `GalaxyCanvas.tsx:87,100,105,167,198` scales the §2.1 galaxy's particle count, glow alpha
  and core-dot alpha from it. Routed to `map-galaxy-engineer`.
- `apps/runner/src/lib/brain.ts:87-95` counts a section answered at 40 or more non-placeholder
  characters. The UNANSWERED markers are correctly excluded; the template's *instructional
  prose* is not, so nine sections score on their own instructions. `GET /api/status` returns
  `brain: {"value":0.45,"answered":9,"total":20}`. Routed to `runner-engineer`.

BOARD standing rule 9 / Part VII.3. It also breaks `AGENTOS-V2-PLAN.md` step 0.4's feedback
loop: a counter that starts at 45% will not move when the first nine real answers land.

### Status by colour alone — M2

`drawer/sections/LastRuns.tsx:85`. Run status is a 6px `aria-hidden` dot plus a `title` on
the wrapper. With `LANGFUSE_*` unset every row takes the non-link `<span>` branch at `:104`,
which is not focusable and whose `title` is not reliably announced. `STATUS_WORD` already
exists at `:29`; one `sr-only` span fixes it.

### The honest empty state, rendered in the disabled colour — M2 + M6

`drawer.module.css:250-254` (`.empty`) and `dashboards.module.css:367-370` (`.emptyLine`) are
`var(--ink-3)` = **3.57:1** on `--bg`, at 11-12px. The token contract's own gloss for
`--ink-3` is *"faint text / disabled"* and `cc-fidelity-check` §5 forbids required
information in it. These carry every "No runs yet", "No figure yet", "Couldn't reach the
runner" sentence — the copy BOARD rule 9 exists to put on screen *instead of* a fake number.
Rendering it in the disabled colour is the design undoing the rule. `--ink-2` is 5.08:1.

Sharpest instance: `KpiTile.tsx:39` puts the `unpricedNote` provenance caveat there — the
sentence that says the spend figure is *a floor, not a total*.

### Count-up can paint a large negative number — M6

`components/primitives/KpiNumeral.tsx:80-88`. `Math.min(1, (now - start) / DURATION.countUp)`
clamps the top only, over a `now` from the rAF callback and a `start` from
`performance.now()`. Measured skew under jsdom: -845ms. Four consecutive isolated runs of
`KpiNumeral.test.tsx` produced `-1617290`, `-112`, `-79`, `15` and never `22`. Deterministic,
**not** "flaky under parallel load" as previously routed. Routed to `design-system-guardian`.

## Contracts touched

None. I own no contract. `comms/contracts/design-tokens.md` is cited, not edited — the
`--ink-3` finding is against the *consumers*, not against the token.

## Deliberately not done

1. **The 1440px side-by-side screenshot test — the acceptance sentence of Part VI itself —
   was not run, and a written proposal now exists rather than a note.** Filed as
   `comms/inbox/_all/20260816-2110-fidelity-qa-reviewer-part-vi-screenshot-gap.md` with a
   copy to `commandcenter-orchestrator`. Headline: there are **two** blockers, not one — no
   headless browser (a devDependency, zero runtime deps, zero bundle bytes, barred by no
   standing rule) **and no reference frame anywhere in the repo**, which is the harder half
   and needs ten minutes from the user with the video. Solving the first alone buys nothing.
   The proposal also writes down the interim standard (“source-and-token PASS”) that eight
   milestones have silently been passing under. There is no Playwright, Puppeteer or any headless browser in this repo, and
   no way for me to rasterise a viewport. Every PASS above therefore covers source, tokens,
   motion, a11y, contracts and live endpoints, and **explicitly does not cover proportion,
   density or frame match.** I said so in every answer rather than implying a diff I did not
   run. *This is the largest hole in Phase 0's acceptance and it needs an owner.* The cheapest
   close is a dev-dependency on Playwright plus a short screenshot script; that is a decision
   for `infra-compose-engineer` or `shell-navigation-engineer`, not something I should add
   unilaterally to another agent's `package.json`.
2. **I fixed exactly one thing, and it is mine: `apps/web/src/test/run-all.mjs`.** I did not
   touch a line of product code under review — the gate does not author the work it reviews.
   But the test harness is my own file, and leaving a harness that reports red when the tests
   are green is worse than leaving it broken loudly: it trains everyone to ignore it. Two
   agents had already read its silence and drawn two different wrong conclusions. Fixed as
   described under *Verification*.
3. **RTL/Arabic beyond the checkers.** 74 catalogue violations remain outside `sessions/**`
   (dashboards 30, components 17, chart 11, drawer 11, map 4, app 1). M8 is `ongoing` on the
   ladder and none of it blocks M1/M2/M5/M6.
4. **M0, the M3 runner, M4 sessions and M7 were not re-gated.** The queue's older PASSes on
   those stand; I re-verified only the ones with open messages. M3 observability and the M8
   sessions slice were in the open set and are answered.
5. **`drawer-engineer`'s LAST RUNS screenshot evidence could not be reproduced** — the ledger
   is empty now (`GET /api/metrics/runs` returns an empty array); the 208 seeded rows are
   gone. The `unpriced` and errored-row rendering was judged from source, not from pixels.
6. **Step 0.2 is PARTIAL, not passed.** `infra-compose-engineer` has the compose half —
   6 containers up, `check-bind.mjs` exit 0, no public listeners. There is no Tailscale on
   this host and no auth key, so MagicDNS TLS is untested and nothing was verified from a
   phone. Phase 0’s acceptance sentence is blocked on that half and it needs the human, not
   an agent.
7. **`tsconfig.json` still excludes test files from `tsc --noEmit`** — raised at 15:06, still
   unowned, still not mine to assign.

## Verification

```
node scripts/check-tokens.mjs        284 files, 0 violations, 2 exemptions (both Chip, both correct)
node scripts/check-rtl.mjs           279 files, 74 catalogue violations, 0 in sessions/**
npm run test:web                     EXIT 1  (see below - my defect, not a product failure)
node_modules/.bin/vitest run         52 files, 376 tests, 375 pass, 1 fail (KpiNumeral)
node --test src/**/__tests__/*.mjs   99 tests, 99 pass
```

Live, against the containerised runner on `127.0.0.1:8787` (stack up: postgres, runner, web,
caddy, langfuse, ofelia all healthy):

```
/api/agents                     200  12 agents, 0 skipped, all status: draft
/api/graph                      200  60 nodes, core.brainCompleteness 0.45      <- the finding
/api/status                     200  brain {value:0.45, answered:9, total:20}    <- the finding
/api/cost/today                 200  {"usd":null,"runs":0}
/api/metrics/live               200  {"live":0,"liveAgents":[],"totalSource":"GET /api/graph"}
/api/metrics/query?metric=runs  200  {"value":0,"previous":0,"delta":null}
   ?metric=cost|latency_p50|error_rate  200  {"value":null,"delta":null}
/api/metrics/runs               200  {"runs":[]}
/api/metrics/activity           200  {"items":[]}
```

`observability-engineer`'s rule-9 claim is **confirmed**: a real `count(*)` of zero renders
`0`; an absent measurement renders `null`; `delta` is `null` rather than `0` where there is no
honest comparison; `/api/cost/today` never invents `$0.00`. The 503 path was also verified (I
hit a non-DB runner first) and it is a written human sentence with a hint, not a spinner.

### The test baseline — verified independently, and the news is mixed

The `shell-navigation-engineer` claim was *"the 8 are un-deadlocked and `npm run test:web` is
green with an empty quarantine list."* Two of the three are true.

- **Quarantine is empty.** `src/test/quarantine.ts` exports an empty array. TRUE
- **The 8 shell suites run.** `AppShell`, `BreadcrumbStrip`, `ConnectionStatus`, `CostTicker`,
  `HelpSheet`, `SearchPill`, `ViewTabs`, `ZoomControls` are all among the 52 collected. TRUE
- **`npm run test:web` was not green, for two reasons, and one of them was mine.** FALSE
  1. `apps/web/src/test/run-all.mjs:23,30` — **my file, my defect.** It spawns `cmd: 'npx'`
     with `shell: false`. On Windows `npx` is `npx.cmd`; `spawnSync` returns `status: null`
     and `error.code: 'ENOENT'`, prints nothing at all, and line 31's `status !== 0` books the
     entire vitest half as failed. The run emits the vitest banner followed by zero output.
     Reproduced in isolation. The claim is presumably true on Linux/CI; it cannot be true on
     this platform.
  2. `KpiNumeral.test.tsx:45` is genuinely red — the finding above.

  Also worth recording: `vitest`, `jsdom` and `@testing-library/react` were **absent from
  `node_modules`** when I started, so the first run could not have executed a single vitest
  file on this machine regardless. `npm install` fixed that; it is an environment state, not a
  code fault, but it means any "the suite passes" claim made from this working copy before
  today was made against a suite that had not run.

### The harness bug, fixed (the one thing I changed)

`apps/web/src/test/run-all.mjs`. Three changes, all to the same lesson — **silence was the
actual bug**:

1. **It can run vitest on any platform now.** `resolveVitestEntry()` resolves
   `vitest/package.json` and reads its `bin` field to get the real `.mjs` entrypoint, then
   runs it with `process.execPath`. No shell, no `.bin` shim, no `.cmd`. Works whether npm
   hoisted vitest to the repo root or kept it in the workspace.
2. **A spawn that cannot start is a third outcome, not a failure.** `passed` /
   `failed` / `could-not-start` are now distinct, checked from `result.error`,
   `result.status === null` and `result.signal` separately. “The suite is red” and “the suite
   did not run” are different facts and the harness says which one happened.
3. **Distinct exit code and a summary that always prints.** `could-not-start` exits **2**, so
   CI can tell the two apart without parsing prose; a failing suite still exits 1. The summary
   table prints on green runs too — a harness that is only legible when it fails is one whose
   success you are taking on trust.

The missing-devDependency finding is recorded in the file header, where the next person hits
it, together with the remedy: the `could-not-start` message names `vitest`, `jsdom` and
`@testing-library/react` and says to run `npm install` from the repo root.

All three paths verified:

```
npm run test:web                     vitest half RUNS: 52 files, 51 passed, 1 failed; exit 1
probe with resolver forced to null   “THIS HALF DID NOT RUN” + remedy + summary; exit 2
node:test half                       99/99 passed, unchanged
tsc --noEmit (apps/web)              clean
```

Note the second half still runs when the first cannot start — the original reason this file
exists is preserved.

## Next agent

`commandcenter-orchestrator`. First thing to read: the verdict table above, then the three
routed FAIL messages. **No milestone state changes today** — M5 clears its gate but is still
blocked on M2 by the ladder, and M1/M2/M6 hold FAIL.

Two things for the orchestrator specifically:

- **BOARD's open-questions list is stale.** `ADR-004` (six Command Centers) and `ADR-005`
  (Happy vs Omnara) both exist in `comms/decisions/` but are still unchecked at
  `BOARD.md:75-76`. Bookkeeping, not a finding against either author.
- **The screenshot gap needs an owner and a milestone.** See *Deliberately not done* item 1.
  Part VI's acceptance criterion cannot be satisfied by anyone in this repo today, and that
  should be a decision on the record rather than a silence.
