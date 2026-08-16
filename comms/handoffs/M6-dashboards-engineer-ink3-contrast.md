---
agent: dashboards-engineer
milestone: M6
spec: §2.4, §2.5, §2.5.5, §2.5.6, Part VII.3
created: 2026-08-16T22:08
status: ready-for-review
---

# M6 — the honest empty states stop being rendered as disabled text

`fidelity-qa-reviewer` named 2 sites. `design-system-guardian` counted 14 while ruling.
**There were 20.** All twenty are fixed, every one is judged individually against tokens
contract §9, and a test now makes the twenty-first cost someone a written sentence.

## The headline result: 20 of 20 were required reading. None was decorative.

I went in expecting a split and expecting to defend two or three keepers. There are none.
Not one site survived §9.2's delete-the-text test. That is itself the finding: **a module
that is 0-for-20 was not making twenty judgement calls — it was using `--ink-3` to mean
"small".** `--ink-3` is glossed *"faint text / disabled"*, and the four legitimate homes in
§9.3 (disabled controls, `::placeholder`, decorative separators, a label redundant with its
own position) simply do not occur in `dashboards/**`. The empty allowlist in the regression
test is not laziness; it is the measurement.

## Where the twenty came from — and why three counts disagreed

| Count | Whose | What it saw |
|---|---|---|
| 2 | `fidelity-qa-reviewer` | the two it read |
| 14 / 15 | `design-system-guardian` | 11 `.tsx` + 3 CSS in the broadcast; the direct message's table adds a 4th CSS row, so the two versions say 14 and 15 |
| **20** | this handoff | 14 `text-ink-3` in `.tsx` + 4 `color: var(--ink-3)` in CSS + **2 with no matchable token string at all** |

The last two are the interesting ones and they are why the guard exists. `RailLabel`'s
default prop is `tone="faint"` = `text-ink-3` (`RailLabel.tsx:25,28`), so
`<RailLabel>{title}</RailLabel>` renders required reading in the disabled colour while
containing nothing any grep for `ink-3` can match. Both §2.5.6 rails were in that state. Two
careful readers enumerated this module and neither could see them, **because reading is the
wrong instrument for a default value.**

## Every site, and what it landed on

### `--ink-2` — required reading on a static surface (16 sites)

| Site | Text | Why it is required |
|---|---|---|
| `ActivityFeed.tsx:19` | "No runs in this window." | appears *instead of* a run count |
| `ActivityFeed.tsx:24` | the `09:41` clock | **found here, on nobody's list.** A feed whose stamps cannot be read is a list, not a feed — and the ordering datum is the only thing distinguishing two identical runs |
| `AreaChart.tsx:43` | "No points in this series." | empty state |
| `AreaChart.tsx:80` | "Hover a spike for the reading." | §9.2's last bullet — the *only* statement that the chart is interactive |
| `BarList.tsx:21` · `CostTable.tsx:13` · `DataTable.tsx:33` · `ProgressTable.tsx:15` | "No rows." | empty state ×4 |
| `BarList.tsx:43` · `CostTable.tsx:22` · `ProgressTable.tsx:35` | `row.sub` | a sub-label is usually the only place its qualifier appears; one rung under the `--ivory-2` label it hangs off |
| `KpiTile.tsx:57` | `kpi.caption` | the panel's descriptive label, at the tile's own meta weight |
| `.emptyLine` (css) | every "No figure yet." / "Nothing in this window." | the BOARD-rule-9 sentence itself |
| `.unsupported` (css) | "Unsupported widget …" | the failure sentence **is** the box |
| `.hint` (css) | `DRAG TO SPIN · CLICK THE FRONT CARD TO ENTER` | the ‹ › pills make "drag to spin" partly redundant; **nothing** else says the front card is clickable, and that is the carousel's primary action (§2.4) |
| `DashboardDetail.tsx:57,66` | the two rail labels | `tone="muted"` — see below |

### `--ivory-2` — required reading that needs more than the floor (3 sites)

| Site | Rule | Why |
|---|---|---|
| `widget-chrome.tsx:110` | §9.5 **and** §9.4a | the `—` for a null reading |
| `DataTable.tsx:121` | — | now delegates to the above; was a second, quieter copy |
| `KpiTile.tsx:60` | §9.4a | the `unpricedNote` caveat |

### Deleted (1 site)

`.rail`'s `color: var(--ink-3)` painted **nothing**. Its only children are `.railDot` (own
background) and a `<RailLabel>` (own colour class), so the declaration was inherited by no
text at all. Removed rather than recoloured: a dead declaration naming the disabled token is
worse than none, because it is the first thing the next reader greps and it answers wrongly.

## The two calls that went above `--ink-2`, and one that did not

**Is anything on an interactive/hover surface? Yes — exactly one thing, and it is real.**
`DataTable`'s `rowAction: "peek"` rows are `hover:bg-card-2` (`DataTable.tsx:84`). Nothing
else in `dashboards/**` has a hover fill: no `Card interactive`, no `:hover` rule anywhere in
`dashboards.module.css`. So §9.5 bites in one place — and it bites on the honest-absence
glyph, since an unpriced run's cost cell renders `—` inside a hovered row. Light `--ink-2` on
`--card-2` is 4.25:1. `--ivory-2` is 7.14:1 worst case.

**The em-dash question, answered as asked.** `--ivory-2` **and** an accessible name — I went
past the owner's either/or in both directions. It is not a §9.3 decorative separator: a
separator sits *between* two things, whereas this is the cell's whole content and carries
*"we have no measurement"* against *"we measured zero"*. It also gets `aria-hidden` on the
glyph plus `sr-only` "No reading", because `—` is announced as "dash", "em dash" or silence
depending on the AT's punctuation setting — the one cell whose job is to say *no reading* was
the cell that said nothing. Decided in **one** place now.

**The KPI caveat is `--ivory-2` and this is a deliberate departure from the owner's ruling.**
`design-system-guardian` said `--ink-2` for `KpiTile.tsx:39` twice. 9.4a says a caveat sits
one rung below the value it qualifies, "one rung, not two"; the value is `KpiNumeral`
`tone="default"` = `text-ivory`, so one rung is `--ivory-2` and `--ink-2` is two — the same
shape they landed in the drawer (`.runMeta` `--ivory` / `.runMetaAbsent` `--ivory-2`). §9.4's
"an empty state at secondary weight out-shouts its peers" argument is scoped to **absence in
a grid of peers**; that case is `.emptyLine`, and it *is* `--ink-2`. A caveat rides a figure
that is present and cannot out-shout it. Filed as a `decision-request`, not smuggled:
`comms/inbox/design-system-guardian/20260816-2208-dashboards-engineer-s9-applied-two-calls-and-a-primitive-default.md`.
Both options clear AA, so a reversal is one token and one assertion.

## A latent bug found while changing that line

`Formatted`'s absent branch was `cx('text-ink-3', className)`, and two of its four call sites
passed `className="text-ivory"`. **Two `color` utilities on one span** — the winner was
decided by the Tailwind stylesheet's own ordering, not by this branch, so the em-dash's colour
was never actually being chosen here. `Formatted` now owns the colour of both the value and
its absence and the call sites pass size only.

## What exists now

```
apps/web/src/dashboards/components/ActivityFeed.tsx     empty state + clock
apps/web/src/dashboards/components/AreaChart.tsx        empty state + the interactivity hint
apps/web/src/dashboards/components/BarList.tsx          empty state + row.sub; Formatted call site
apps/web/src/dashboards/components/CostTable.tsx        empty state + row.sub
apps/web/src/dashboards/components/ProgressTable.tsx    empty state + row.sub
apps/web/src/dashboards/components/DataTable.tsx        empty state; null cell delegates to Formatted
apps/web/src/dashboards/components/widget-chrome.tsx    the one absent-reading treatment
apps/web/src/dashboards/components/KpiTile.tsx          caption --ink-2 / caveat --ivory-2, one <p>
apps/web/src/dashboards/components/DashboardDetail.tsx  both rails tone="muted"
apps/web/src/dashboards/dashboards.module.css           .emptyLine .unsupported .hint; .rail decl deleted
apps/web/src/dashboards/dashboards-contrast.test.ts     NEW — the guard
comms/contracts/panel-schema.md                         rule 2 corrected; rule 3 extended
```

## How to use it

Nothing to call. The rule for the next widget: **prose is `--ink-2`; prose inside a hoverable
row, or a caveat under an `--ivory` value, is `--ivory-2`; `--ink-3` is for nothing this
module currently renders.** `dashboards-contrast.test.ts` will tell you if you forget.

## Contracts touched

- **`comms/contracts/panel-schema.md` — mine, corrected.** Rule 2 said *"empty state
  (`--ink-3`, one line)"*. **My contract prescribed the defect the review filed against me**,
  and it is a plausible source for at least one of the three authors who independently reached
  for that token. Now `--ink-2`, with a visible correction note rather than a silent edit, and
  rule 3 states the null-reading treatment so nobody re-derives it. No schema field changed,
  no `panels/*.json` touched, `schemaVersion` still 1.
- `comms/contracts/design-tokens.md` §9 — consumed, not edited. Two departures filed as a
  `decision-request` to its owner.

## Deliberately not done

1. **I did not change `RailLabel`'s default tone**, though I think it should invert. `faint`
   is the one tone §9 forbids for anything load-bearing and it is what you get by **not**
   deciding — a default that fails a rule when nobody thinks about it is backwards. It is
   `design-system-guardian`'s primitive; I passed `tone="muted"` at my two call sites and put
   the argument in their inbox. **The other rails in the repo have not been audited** — MAP
   and CHART both use `RailLabel` and I did not look, because they are not mine and a
   drive-by would be exactly the "asserting things about call sites I had not opened" mistake
   §9.4's drafting note was written about.
2. **I did not add "No reading" to the string catalogue,** so `check-rtl` goes 74 → 75 and
   `dashboards/**` 30 → 31. Zero of the other 30 dashboards strings are catalogued — the
   module does not call `t()` — so catalogaing one would leave a half-migrated module and
   touch `rtl-arabic-pdpl-specialist`'s file for a single key. Reported to them with an offer
   to take the whole 31-string migration as one piece of M8 work.
3. **No ADR-011 opinion.** If light `--ink-2` is darkened to `#6A6A72`, §9.5 disappears and my
   `--ivory-2` on the em-dash loses one of its two justifications — 9.4a still holds it there.
   Nothing here blocks or presumes that decision.
4. **The 1440px side-by-side was not run** and cannot be from this repo — no headless browser,
   no reference frame. Contrast here is *computed from `tokens.css`*, which is stronger than
   an eyeball but is not the Part VI comparison. Both awaiting-user decisions on the BOARD.
5. **`--ink-3` elsewhere is untouched.** `chart/components/MatrixHeaders.tsx:25,56` and
   `components/shell/ViewMount.tsx:28,31` were flagged in the same broadcast and belong to
   `chart-matrix-engineer` and `shell-navigation-engineer`.
6. **The widgets are still empty, and still honestly so.** Nothing here makes a number appear.
   Zero runs have ever executed; `/api/metrics/query` returns `null` (not `0`) where there is
   no honest comparison. Everything above is about making that emptiness *readable*, which is
   the half of BOARD rule 9 that had been quietly conceded.
7. **`KpiNumeral` not re-touched** — `design-system-guardian` fixed the negative count-up with
   `clamp01` and a skewed-clock regression test. I only assert its `default` tone is
   `--ivory`, because that is what 9.4a measures the caveat against.

## Verification

```
node scripts/check-tokens.mjs
  Token discipline
    scanned at        2026-08-16 19:07 · 56e93cf · 35 uncommitted under apps/web
    files scanned     289
    violations        0
    exemptions        2      (both Chip, both pre-existing and correct)

vitest run                          56 files, 406 tests, 406 pass, 0 fail
  └ dashboards-contrast.test.ts     9 tests, 9 pass (new)
  └ KpiNumeral.test.tsx             passes — the previously-red suite, fixed upstream
node --test src/dashboards/__tests__/*.mjs   36 pass
tsc --noEmit (apps/web)             clean
node scripts/check-rtl.mjs          75 catalogue violations (74 + the one above), 0 in sessions/**
Select-String 'ink-3' src/dashboards -Recurse
                                    every remaining hit is a comment or the guard itself
```

The provenance line is quoted verbatim per design-tokens §8b. Note `56e93cf` is HEAD and the
35 uncommitted files include this change — a clean-tree run will show a different count and
the same 0.

### What the guard actually checks, and why it is not the drawer's file

`drawer-contrast.test.ts` parses CSS. That instrument finds **4 of my 20**. So this one checks
three surfaces: `color: var(--ink-3)` in the CSS module, `text-ink-3` in every `.tsx` under
`src/dashboards/` (comments stripped, so a comment explaining a fix cannot fail the test), and
**`<RailLabel>` rendered without an explicit `tone`** — the class that no string match can
reach. It also pins the measurements from `tokens.css` with alpha surfaces composited over
`--bg` (dark `--card-2` is `rgba(255,255,255,.05)`; comparing against the literal token would
flatter every result), and asserts **both** that `--ivory-2` clears AA on `--card-2` and that
`--ink-2` does not — because the second is the entire reason the first was chosen and it will
not survive as a comment.

Both allowlists are empty. Twenty-one requires a written sentence longer than 40 characters.

## Next agent

`fidelity-qa-reviewer` — re-review request is
`comms/inbox/fidelity-qa-reviewer/20260816-2208-dashboards-engineer-m6-ink3-fixed.md`. Read
the 20-vs-14-vs-2 table first, then the two `--ivory-2` calls, which are the only places a
reviewer could reasonably disagree.

Then `design-system-guardian` on the `RailLabel` default — it is the cheapest available fix
for a defect class that is invisible to every instrument any of us currently runs.
