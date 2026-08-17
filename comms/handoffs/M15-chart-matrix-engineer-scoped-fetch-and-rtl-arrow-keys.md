---
agent: chart-matrix-engineer
milestone: M15
spec: §2.6, §2.6.1 (plus §1.4 direction, consumed not owned)
created: 2026-08-17T18:36
status: ready-for-review
---

# M15 — CHART stops calling a route that refuses, and its tab bar stops running backwards in Arabic

Two fixes, both fallout from §2.6 work, both with the test that would have caught them.

## What exists now

| Path | What changed |
|---|---|
| `apps/web/src/chart/data/agents.ts` | `url = '/api/agents'` **deleted**. `agentsIndexUrl(project)` builds from `RUNNER_ROUTES.agentsIndex` via `projectApiUrl`. `loadChartAgents(project, fetchImpl)` — `project` first and non-optional. |
| `apps/web/src/chart/data/agents.test.ts` | **new.** The built URL is asserted against `LEGACY_UNSCOPED_PATHS`, and no-project asserts `fetch` was **not called**. |
| `apps/web/src/chart/ChartPage.tsx` | Reads `useProjectSegment()`; the fetch effect depends on it. |
| `apps/web/src/chart/model/direction.ts` | **new.** `elementDirection(el)` + pure `inlineStep(key, dir)`. ~10 lines of code, and a header that is mostly the argument. |
| `apps/web/src/chart/model/direction.test.ts` | **new.** Both directions, `dir` inheritance, LTR-island-inside-RTL, and a test pinning that the *matrix grid* stays direction-blind. |
| `apps/web/src/chart/components/DepartmentTabs.tsx` | Arrow keys go through `inlineStep(key, elementDirection(currentTarget))`. |
| `apps/web/src/chart/components/DepartmentTabs.test.tsx` | **new.** jsdom + real `keyDown`, rendered under `dir="ltr"` **and** `dir="rtl"`. This is REQ-CHT-04's verification now. |
| `apps/web/src/chart/components/ChartView.tsx` | `counts` is withheld when `error` is set — the finding below. |
| `comms/specs/chart-matrix.md` | Decisions 11–13; REQ-CHT-45…50; REQ-CHT-04 manual → automated; REQ-CHT-05 reworded; two `Deliberately not done` entries. |

## The finding, which is worth more than either fix

**CHART's failure state was honest in the middle of the screen and dishonest at the top.**

Ask for an unreadable library and `ChartEmptyState` says so plainly, `TitleBlock` suppresses
the stat line rather than printing `0 of 0`, and no fake grid is drawn. All correct. But
`ChartView` also derived per-department job counts from the same empty array and handed them
to the tab bar — which dims a department at zero. **A failed load therefore dimmed all seven
departments**, and dimming is not decoration: REQ-CHT-05 makes it mean *"no jobs are mapped
here."* So the view stated seven specific falsehoods about the library on the same screen as
the sentence saying the library could not be read.

It is the same shape as the bug that motivated the first fix — the map's 400 counted as "not
built" — one component along, and it is the shape worth naming: **an aggregate computed from
a failed read is not zero, it is unknown, and every renderer downstream of it will happily
draw the zero.** The fix is one expression (`counts={error ? undefined : counts}`) plus a
prop contract saying absent means unknown; the reason it was there at all is that `counts`
had no way to express "I don't know", so the caller had to.

The 400-as-empty-matrix failure the brief asked me to look for **did not happen** here, and
the reason is not to CHART's credit: `ChartMount` projects `agents/**/SKILL.md` from disk
server-side and passes `agents`, so `<ChartPage />` sets `skipFetch` and **the broken fetch
never ran on any normal render**. The unscoped URL survived a whole milestone with no symptom
because the broken path was the one nobody was on. That is now written into the spec's
`Deliberately not done` rather than left as a comfortable silence.

## How to use it

```ts
import { loadChartAgents } from '@/chart';

// `project` is first and required — an omitted scope is a compile error, not a 400.
const { agents, error } = await loadChartAgents(useProjectSegment());
// project === null  → nothing is sent, `error` is the shell's NO_PROJECT_SENTENCE.
```

Nothing else changes: `<ChartPage />` still takes no project prop, `<ChartView />` is
unchanged for callers, and the disk projection still supplies the real board.

## Contracts touched

**None changed.** Consumed: `api-contracts.md` / ADR-015 (`RUNNER_ROUTES.agentsIndex`,
`LEGACY_UNSCOPED_PATHS`), `frontmatter-schema.md` (unchanged — the grid needed no new field,
so `agent-library-curator` had nothing to rule on), `design-tokens.md`, and
`rtl-arabic-pdpl-specialist`'s `i18n/direction.ts`, which CHART appears in **twice** and in
opposite tables — `MIRRORS['shell.segmentedControl']` for the tab bar,
`DOES_NOT_MIRROR['chart.phaseColumns']` for the grid. That contract is the whole reason the
fix has a boundary; without it "make the arrows RTL-aware" would have been applied to the
grid too.

One spec **amendment of my own**, flagged because it retracts something I wrote: this spec
used to say the shell is consumed *only* in the route adapter and `src/chart` knows nothing
about projects. That held while CHART's only project-shaped act was building a link and
stopped holding when it made a `fetch`. `useProjectSegment()` is now used in
`ChartPage.tsx`. The narrower rule survives and is the one that mattered — **CHART never
spells the segment**, so REQ-CHT-44 is untouched. A `project` prop was the alternative and
was rejected: a prop can be forgotten, a hook cannot, and forgetting is the failure being
repaired.

## Deliberately not done

- **The eighth department.** Priced and filed already
  (`inbox/chart-matrix-engineer/20260817-1810-…-eighth-department-price.md`, answered); the
  ADR-001 amendment is outside M15 by BOARD. Nothing here bakes `7` into anything: the tab
  list is still a prop and still comes from `packages/contracts`.
- **The tab bar's scroll affordance.** `overflow-x-auto` means overflow becomes a horizontal
  scroll. I reported this as a REQ-CHT-05 violation; on inspection it is **not** one, and I
  have said so rather than leaving a wrong finding standing: nothing is filtered, reordered
  or truncated, and roving focus scrolls a tab into view, so all seven stay reachable.
  REQ-CHT-05 is reworded to claim exactly that and no more. What is genuinely missing is any
  *signal that the bar continues* — a `mask-image` fade, which needs a colour stop and is
  therefore `design-system-guardian`'s file under BOARD rule 8. Filed as REQ-CHT-49 +
  a `Deliberately not done` entry, **owner me, trigger: M8 mobile or an eighth department.**
- **CHART under `dir="rtl"`, beyond the keyboard.** One specific thing, named so it is not
  rediscovered: the matrix is a CSS grid, so RTL will reverse its **columns**, and
  `DOES_NOT_MIRROR['chart.phaseColumns']` says phases 1→4 must not reverse — nothing in
  `Matrix.tsx` pins them. The fix is *not* a blanket `dir="ltr"` on the grid, because the
  same contract says row headers and cell text do mirror. That is a real design question on
  `rtl-arabic-pdpl-specialist`'s pass, not a drive-by, so it is filed and not guessed at.
- **Promoting `direction.ts` to a shared primitive**, though `SegmentedControl` and probably
  `Carousel` have the identical bug. `components/primitives/` is `design-system-guardian`'s;
  a second owner should not create a shared primitive by moving a file into someone else's
  directory. FYI sent to `_all` with the two call sites and the ten lines.
- **API-first, disk-second.** See the finding above. Reordering the two reads is a real
  change (the disk read is what makes CHART work with no runner at all) and not an M15 one.
- **Cataloguing CHART's 36 RTL-baseline entries.** Untouched; that migration has named
  owners in `M8-rtl-arabic-pdpl-checker-blind-spot.md`. My changes added **zero** new debt —
  deliberately, which is why the no-project copy reuses the shell's exported
  `NO_PROJECT_SENTENCE` instead of a new string.

## Verification

Tree is **moving** — 30 modified / 10 untracked files across runner, drawer and dashboards
from four agents working concurrently. Figures below are what I actually saw.

| Command | Result |
|---|---|
| `npm run test:web` | **green — 69 files, 565 tests, 0 failed**, both halves (`vitest`, `node:test`). Baseline at 18:22 was 8 failed in `dashboards/data/resolve.test.ts`; those were `dashboards-engineer`'s and went green under me without my touching them. My 28 new tests are in the 565. |
| `npx tsc --noEmit -p apps/web/tsconfig.json` | **exit 0**, no output. |
| `node scripts/check-tokens.mjs` | **0 violations.** Provenance banner, verbatim: `scanned at        2026-08-17 18:26 +03:00 · 1dd9ec4 · 22 uncommitted under apps/web` — and a second run at 18:34 read `23 uncommitted`, still 0 violations. Two readings rather than one because the uncommitted count moved *between my own runs* while other agents wrote; that is what the banner is for, and quoting only one of them would have made a moving tree look still. |
| `node scripts/check-rtl.mjs --gate` | **exit 1, and not from this work.** `total 261 → 262 · rule:hardcoded-string 236 → 237 · module:dashboards/data 3 → 4` — one line, `dashboards/data/endpoints.ts:181`, uncommitted, `dashboards-engineer`'s. `chart/data` is still 3 and `chart/components` still 18, i.e. unchanged from the recorded baseline. FYI sent. **I have not raised the baseline**; that file's rule is that only a person writing down why may raise it. |
| `npm run validate:coverage` | **0 FAILs, exit 0.** 651 → 662 requirements (6 mine, the rest concurrent). No new warnings from `chart-matrix.md`. |

**The one verification worth more than the rest:** the RTL suite was run against the *pre-fix*
handler before the fix was kept. Four tests go red — both arrow directions, the edge case,
and the roving tab stop — which is what makes it a regression test rather than a description.
A test that has never been red proves nothing, and this whole item exists because REQ-CHT-04
was checked in only one of the two directions the product ships in.

**Not committed**, per instruction.

## Next agent

`fidelity-qa-reviewer` — `review-request` filed. Start with `comms/specs/chart-matrix.md`
Decisions 11–13; they carry the reasoning the code comments only summarise, and Decision 12
is the one with a boundary that is easy to over-apply.

`rtl-arabic-pdpl-specialist` — the grid-column question in `Deliberately not done` is the
first real thing on CHART for the M8 pass, and it is a design question, not a lint.

`design-system-guardian` — `inbox/_all/20260817-1832-…-tablist-arrow-keys-run-backwards-in-rtl.md`.
`SegmentedControl.tsx:49–50` is the §2.0 tab bar with the same three lines and an LTR-only
test.
