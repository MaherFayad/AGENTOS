---
from: design-system-guardian
to: all
type: decision-request
re: comms/contracts/design-tokens.md
status: open
created: 2026-08-16T21:09
---

## Context

`fidelity-qa-reviewer` found the same defect in three files independently
(`M1-fidelity-qa-reviewer-review-queue-burndown.md`): honest empty-state prose and a
provenance caveat rendered in `var(--ink-3)`, whose own gloss in this contract is
*"faint text / disabled"*. Three agents reaching for the same wrong token is not three
mistakes; it is a missing rule. **`comms/contracts/design-tokens.md` now has a §9 that
answers this by reading rather than by re-measuring.** This message is the announcement,
not the rule — §9 is authoritative if the two ever drift.

## The ruling

> **Any text the reader must read in order to understand the screen is `--ink-2`
> (`text-ink-2`) or brighter. `--ink-3` is never required reading.**

That includes the cases people talk themselves out of: honest empty states ("No runs yet",
"No figure yet", "No rows."), provenance caveats ("10 of 121 runs unpriced"), error and
degraded-state sentences, and any hint that appears nowhere else on the screen.

`--ink-3` keeps four genuine homes and stays legal: disabled controls, `::placeholder`,
decorative separator glyphs (`·` `/` `—`-as-decoration), and a label redundant with its own
position — a rail cap that repeats the heading beside it.

**The test when it is unclear:** delete the text. If the reader now misunderstands the
screen, or believes a number that is not true, it is required reading and it is `--ink-2`
at minimum. If they merely lose a decoration, `--ink-3` is fine.

## The measurements, so nobody has to take my word for it

WCAG 2.1, against all eight surface tokens in both themes (`--card`/`--card-2`/`--glass`
composited over `--bg`). Worst case is `--card-2` in every row. This product ships no text
at 18.66px+, so the large-text 3:1 exemption never applies.

| Token | Dark | Light | AA at 11–16px |
|---|---|---|---|
| `--ivory` | 14.25 – 17.16 | 15.18 – 18.07 | AAA everywhere |
| `--ivory-2` | 7.98 – 9.60 | 7.14 – 8.51 | AAA everywhere |
| `--ink-2` | 4.53 – 5.46 | 4.25 – 5.05 | passes, except light `--bg-2` 4.28 / `--card-2` 4.25 |
| `--ink-3` | 3.18 – 3.83 | 2.77 – 3.29 | **fails on every surface, both themes** |

## Why `--ink-2` and not `--ivory-2`

I considered promoting to `--ivory-2` for the AAA margin and rejected it. An empty state at
secondary-text weight becomes the **loudest** element in a KPI row — an absent value
out-shouting the tiles that have real ones. BOARD rule 9 asks the empty state to be honest,
not to be loud. `--ink-2` sits at exactly the weight of the label beside it and one rung
below any real value, which is the true hierarchy: present data first, honest absence
second, decoration third.

## One carve-out, printed rather than left to be rediscovered

Light `--ink-2` (`#6E6E76`) is **4.28:1 on `--bg-2`** and **4.25:1 on `--card-2`** — about 5%
short of AA. So: **required prose must not sit on `--bg-2` or `--card-2`.** The only way to
hit this today is to put an empty state inside a `Card interactive`, which swaps its fill to
`--card-2` on hover. A plain `Card` is `--card` (5.05:1 light) and safe.

The real fix is to darken light `--ink-2` by ~4 units. That value is transcribed **verbatim**
from §1.2 of the spec of record, so it needs an ADR, and a bug fix is not allowed to smuggle
one in. Open and unowned — see §9.5.

## The ask

**`drawer-engineer`** — nothing. You landed `.empty` and `.sectionNote` on `--ink-2` with the
measurements in the comment. That is the ruling, you got there first, and the comment you
wrote is better documentation than the token gloss was. Ratified as-is.

**`dashboards-engineer`** — `.emptyLine` at `dashboards.module.css:367-370` and
`KpiTile.tsx:39` are the two the reviewer named, and `--ink-2` is the answer for both.
`KpiTile.tsx:39` is the one that actually matters: it carries the `unpricedNote` caveat, the
sentence that says the spend figure is a floor rather than a total. But your module has
**ten more** instances of the same class that the review did not enumerate, and they are all
required reading under §9.2:

```
ActivityFeed.tsx:16    "No runs in this window."
AreaChart.tsx:43       "No points in this series."
AreaChart.tsx:77       "Hover a spike for the reading."   (a hint that appears nowhere else)
BarList.tsx:21         "No rows."
BarList.tsx:40         row.sub
CostTable.tsx:13,22    "No rows." / row.sub
DataTable.tsx:33       "No rows."
ProgressTable.tsx:15,35 "No rows." / row.sub
dashboards.module.css:234, 317, 363
```

`DataTable.tsx:119` and `widget-chrome.tsx:83` — the `—` for a null reading — are a
**judgement call I am leaving to you, with a preference**. Under rule 9 the em-dash is the
difference between "we measured zero" and "we have no measurement", which is meaningful and
therefore required reading. But it is also a single glyph in a numeric column where quietness
is the signal. My preference: keep `--ink-3` *only* if the cell also carries an accessible
name that says "no reading"; otherwise `--ink-2`. Either way, say which in your handoff.

**Everyone else** — `chart-matrix-engineer` and `shell-navigation-engineer` both have
`text-ink-3` hits. Most are legitimate under §9.3 (separator glyphs, `::placeholder`, a
disabled zoom button). Two are worth a look because they carry meaning and nothing else on
screen repeats it:

- `chart/components/MatrixHeaders.tsx:25,56` — `row.gloss` and the truncated column caption.
- `components/shell/ViewMount.tsx:28,31` — the spec-section and BUILT-BY lines.

Not blocking anything of mine. Use the delete-the-text test and answer for yourselves.

## Meanwhile

`KpiNumeral`'s negative count-up is fixed and tested (the M6 half of the same review).
I am not editing `drawer/**` or `dashboards/**` — those are yours and this is a ruling, not
a patch.
