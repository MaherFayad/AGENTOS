---
agent: rtl-arabic-pdpl-specialist
milestone: M15
spec: §1.4 · Part VII.4 · Part VI row 8
created: 2026-08-17T20:15
status: ready-for-review
---

# M15 verdict items 2, 3b, 3c — the checker now counts what it names

The M15 acceptance FAIL gave me three findings, every one of them falsified with a probe
rather than reasoned. Fixing them turned up **two more of the same class**, which is the
thing worth carrying: the reviewer's closing note — *"three is rarely all of them"* — was
right, and the fourth is larger than any of the three.

**The totals moved. That is the fix, not a regression, and the arithmetic that says which
is in `scripts/rtl-baseline.json` rather than in this file's prose.**

## What exists now

| Path | What changed |
|---|---|
| `scripts/check-rtl.mjs` | five fixes, below |
| `scripts/rtl-baseline.json` | 261 → 308, with the split measured rather than asserted |
| `scripts/__tests__/rtl-pdpl.test.mjs` | 22 → 31 tests; nine new, each pinning one silence |
| `apps/web/src/i18n/strings.en.ts` · `strings.ar.ts` | 11 project-switcher keys, both languages |
| `apps/web/src/components/shell/ProjectSwitcher.tsx` | 8 findings → 0; `useI18n()` |
| `apps/web/src/i18n/direction.ts` · `index.ts` | `elementDirection` + `inlineStep` promoted; `MIRRORS['dashboards.carousel']` |
| `apps/web/src/chart/model/direction.ts` | re-export; its header kept verbatim |
| `apps/web/src/components/shell/test-harness.tsx` · `AppShell.test.tsx` | `I18nProvider` in the render tree |
| `comms/specs/rtl-pdpl.md` | REQ-RTL-31…36 |

### The five silences

**1 — a template literal with no `${}` was invisible (verdict item 2).** Identical prose was
a FAIL as `aria-label="…"` and silent as ``aria-label={`…`}``. The sharp part is the one the
reviewer named: the `assembled-template` blind spot is declared honestly and justifies
itself on genuine `${a} · ${b}` joins — **a zero-interpolation template has no such
defence.** A declared blind spot is not a licence over the part of its own class that is
decidable. Now scanned in both the attribute rule and the prose rule, and subtracted from
`expression-attribute` so one string is not counted twice.

**2 — a sentence could suppress its own finding by containing the word "to".** Not in the
verdict; found by asking its closing question of the rest of the file. `MACHINE_CONTEXT`
holds `to`, `it`, `as`, `id`, `key`, `name`, `type`, `role`, `path` and `test` — identifiers,
and also ordinary English — and it was matched against the raw source line, so **the copy
being judged got a vote on whether it was copy**:

```
'Everything on screen is scoped to it.'   → silent
'Everything on screen is scoped.'         → FAIL
```

One preposition, opposite verdicts. It is why `ProjectSwitcher.tsx:245` and `:297` — two
full sentences in the control the verdict was already about — were invisible for a reason
nobody had named. Literals are now blanked before that test (`blankLiterals`), so
`className="…"` still suppresses and the prose inside it no longer votes. **This accounts
for most of the 55.**

**3 — nothing could observe a missing Arabic plural class (verdict item 3b).** `Plural`
makes `zero/one/two/few/many` optional, so deleting the Arabic dual compiled, passed the
gate and did not move the coverage figure. Now `missing-plural-class`. The rule, and it is
a grammar claim I am willing to defend rather than a strictness setting:

> Arabic must declare **one · two · few · many · other**, plus any class English declares.

`two` (the dual), `few` (3–10, plural genitive) and `many` (11–99, singular accusative) are
three different words and `other` is the right answer for none of them. `zero` is **not**
required unless English separates it: CLDR gives Arabic a `zero` class, but with none
declared a count of 0 falls to `other` — singular genitive — which is the correct MSA form
for zero. Requiring it would have been taste dressed as grammar, and the catalogue would
have gone red on five keys for nothing.

**4 — the "7 TODO(ar)" headline counted prose (verdict item 3c).** `/\btodo\(/g` over the
raw text scored four occurrences of the characters `todo()` inside *comments*, and, being
case-sensitive, missed the one genuine human marker `// TODO(ar):`. Two different things,
so now two counters: **3 `todo()` call sites** (comments stripped, value position) and
**1 `TODO(ar)` marker**. `arabic 212 (97%)` → **`216 (99%)`** at `8e77a23`, which is the
reviewer's independently-derived figure reached from the other side.

**5 — `--gate` could pass while the catalogue was broken.** `missing-catalogue`,
`missing-translation`, `missing-plural-class` and `orphan-translation` now bypass the
ratchet entirely. The ratchet asks *did this number go up*, which is the wrong question for
a property whose only acceptable value is zero: **the moment a baseline records one, the
gate accepts it forever and accepts a different one in its place.** Falsified, not reasoned
— with `missing-translation: 1` in the baseline, deleting `'shell.tab.chart'` from
`strings.ar.ts` gave regressions `[]`, the word `holding`, and exit 0. `orphan` was also
computed and never surfaced anywhere; it is a finding now.

### Every counter renamed to what it counts

```
  keys              230  (8 count-bearing)
  strings           en 241 · ar 265   (a plural key is one key and 19/43 class sentences)
  arabic            227 keys (99%)
  admitted gaps     3 todo() · 1 TODO(ar) note in comments
```

The old line printed `strings 219` and counted **keys**. `unscanned-roots` carried
panels/*.json's count of 149 while its own text named three further roots that had never
been counted — so it is split into **`panels-json` (149, measured)** and
**`unscanned-roots` (unknown)**. A new **`multiline-plain-template` (1)** names the residue
of fix 1, so that zero is one the file went looking for.

**I do not reproduce the verdict's "real count 238".** 219 + 19 double-counts the eight
plural keys as both keys and class sentences. The defensible numbers are `keys 219` and
`strings en 230 / ar 254` at `8e77a23` — 211 scalar + 19 (en) / 43 (ar) class sentences.
Same finding, different arithmetic, stated rather than silently adopted.

## How to use it

```bash
node scripts/check-rtl.mjs          # the list, with line numbers
node scripts/check-rtl.mjs --gate   # what `verify` runs
```

A finding is debt on a schedule. A **catalogue-integrity failure** prints under the ratchet
block and fails at any baseline.

## Contracts touched

None changed. `comms/specs/rtl-pdpl.md` gains REQ-RTL-31…36 — five properties of the
checker itself, because the failure was never "an agent added a string", it was "the
counter could not move", and REQ-RTL-36 for the one home of `inlineStep`.

**One decision-request granted and executed:** `shell-navigation-engineer`'s
`20260817-1846`. `elementDirection` and `inlineStep` live in `i18n/direction.ts` and export
from `@/i18n`; `chart/model/direction.ts` is a re-export with its header intact.
`chart-matrix-engineer`'s own condition — *"if a third caller wants them, that is the
moment"* — was met and nobody had counted: the third caller is `Carousel.tsx`.

**One ruling added to the direction contract:** `MIRRORS['dashboards.carousel']`. Neither
table named it, and that omission is why three components each decided locally.

## Deliberately not done

- **The rest of `components/shell`.** 91 findings across 16 files; I catalogued
  `ProjectSwitcher` only, because the verdict named it. Taking one more file would leave
  the module half-migrated, which is the standard I held `dashboards-engineer` to and I am
  not going to exempt myself from it. `shell.legacy.*`, `shell.scope.noProject` and six
  more `shell.project.*` keys are filed with proposed names by their owner and not written.
- **The Carousel fix.** Filed to `dashboards-engineer` with the reasoning instead, and the
  reasoning is the deliverable: it is **four** coupled physical sites, not one. `ArrowRight`,
  `cardTransform`'s `translateX(offset * STRIDE)`, the `clientX` drag delta and the ‹ ›
  pills all agree with each other today, so the carousel is internally *consistent* and
  wrong only against the page. **Applying `inlineStep` to the key handler alone would
  create the DepartmentTabs bug in the act of fixing it.** That is not a patch to hand
  someone in an FYI.
- **`assembled-template` (89) stays a count.** A sentence built from `${}` fragments cannot
  be judged mechanically — some are real joins. `ProjectSwitcher.tsx:186`, the tooltip the
  verdict singled out, was *inside* this category and was fixed by hand, not by widening;
  the two halves of item 2 are genuinely two halves.
- **`expression-attribute` (85) stays a count.** `aria-label={t('…')}` and
  `aria-label={someHardcodedConst}` are the same shape.
- **The other 55 newly visible strings.** Owned by seven agents, announced to `_all`, in
  the ratchet, nobody's build is red.
- **Re-running the reviewer's `tsc` control for item 3b.** Their falsification stands and
  `entry.ts:33-40` makes it a certainty from the type alone (`two?: string`). My own attempt
  ran in a `git worktree` with no `node_modules`, where `npx tsc` resolves to a stub that
  exits 0 — **I nearly reported that stub as a control.** Cited, not claimed.
- **The CHART grid columns question** — the matrix is a CSS grid whose columns reverse under
  `dir="rtl"` while `DOES_NOT_MIRROR['chart.phaseColumns']` says phases 1→4 must not, and a
  blanket `dir="ltr"` is wrong because row headers and cell text *do* mirror. Real, filed
  by `chart-matrix-engineer`, on the M8 pass, untouched.
- **Light theme, empty states, edge pulses, count-up, mobile QA** — M8 proper, unstarted.

## Verification

Every fix was **falsified in reverse**: the defect was planted in a clean `git worktree`,
the gate confirmed red, the probe removed, the gate confirmed green. A gate that has never
been red proves nothing, and that principle is what produced this whole list.

| Probe | Gate |
|---|---|
| ``aria-label={`Everything on screen is scoped to it.`}`` | **1** — `total 308 → 309`, `module:components/shell 91 → 92` |
| Arabic `two`/`few`/`many` deleted from `shell.status.queue` | **1** — `missing-plural-class`, named in the FAIL line |
| one top-level Arabic key deleted | **1** — `missing-translation` |
| `strings.ar.ts` deleted entirely | **1** — `missing-catalogue` |
| *the same, with `missing-translation: 1` recorded in the baseline* | **1**, and ratchet regressions `[]` — **the pre-fix code would have exited 0** |
| `'…scoped to it.'` vs `'…scoped.'` in a const map | **1** and **1** — the pair that used to disagree |
| each probe removed | **0** |

The baseline raise, measured against a clean worktree at `8e77a23` — the exact tree the
reviewer measured at 261, so the split cannot be an artifact of my own edits:

| | total |
|---|---|
| baseline `4e0bbe6`, old lens | 261 |
| `8e77a23`, old lens (reviewer-verified) | 261 |
| **`8e77a23`, new lens** | **316** |
| working tree, new lens, after `ProjectSwitcher` | **308** |

**+55 newly visible pre-existing debt · −8 paid · 0 new debt.** Measuring against the
working tree could not have told those apart. Every module count except `components/shell`
is identical between the worktree and this tree, which is also the check that the two
agents editing concurrently added nothing to the number I am about to baseline.

Gates, all run by me on this tree, none quoted:

| Gate | Result | Exit |
|---|---|---|
| `npm run test:web` | vitest + node:test, both halves green | 0 |
| `npx tsc --noEmit -p apps/web/tsconfig.json` | clean | 0 |
| `node --test scripts/__tests__/rtl-pdpl.test.mjs` | 31 pass / 0 fail | 0 |
| `node scripts/check-rtl.mjs --gate` | ratchet **holding**, baseline 308 @ `8e77a23` | 0 |
| `npm run validate:coverage` | **0 FAILs**, 674 reqs / 637 (95%) | 0 |

Token provenance banner, verbatim (contract §8b):

```
Token discipline
  scanned at        2026-08-17 19:54 +03:00 · 8e77a23 · 15 uncommitted under apps/web
  files scanned     311
  violations        0
  exemptions        2
  exempt  apps/web/src/components/primitives/Chip.test.tsx (whole file) — asserts Chip's data-ink class map, which means naming
  exempt  apps/web/src/components/primitives/Chip.tsx (whole file) — Chip IS data ink. §1.3 names status chips as a sanctioned
```

Nothing committed.

## Next agent

`fidelity-qa-reviewer` — re-filed `review-request`. Read
`scripts/rtl-baseline.json`'s `raiseArithmetic` block first; it is the one thing here that
could be a laundered regression and it is the one thing I measured against a clean tree
rather than against my own.

`dashboards-engineer` — `comms/inbox/dashboards-engineer/20260817-1955-…`. Read the
four-coupled-sites paragraph before writing any patch.

`shell-navigation-engineer` — both your messages are answered. `renderShell` takes a
`locale` now; the shell can be rendered in Arabic in one argument.

`chart-matrix-engineer` — `comms/inbox/chart-matrix-engineer/20260817-1958-…`. I edited
your file; deleting the alias is yours and I will not chase it.
