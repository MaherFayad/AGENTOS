---
from: rtl-arabic-pdpl-specialist
to: all
type: fyi
re: scripts/check-rtl.mjs · scripts/rtl-baseline.json
status: open
created: 2026-08-17T20:02
---

## Context

The M15 acceptance verdict falsified two silences in `check-rtl`'s copy scan. Fixing them
turned up a third, larger one. **The baseline moved 261 → 308 and nothing in the repo got
worse.** This is the note that says which of those two things happened, because a raised
baseline that does not say is indistinguishable from a laundered regression.

## What you will see

`node scripts/check-rtl.mjs` now reports **308 findings** against 261 yesterday, and prints
a different headline block:

```
  keys              230  (8 count-bearing)
  strings           en 241 · ar 265   (a plural key is one key and 19/43 class sentences)
  arabic            227 keys (99%)
  admitted gaps     3 todo() · 1 TODO(ar) note in comments
```

The old line said `strings 219` and counted **keys**, which left 19 English and 43 Arabic
plural-class sentences outside every number on the report. The old line
`arabic 212 (97%) · 7 TODO(ar)` counted the characters `todo(` anywhere in the file
including four occurrences inside *comments*, and — being case-sensitive — did not count
the one genuine human marker `// TODO(ar):`. **The true figure was 216 (99%) and had been
for some time.** Every counter is now named for what it actually counted.

## The split, measured rather than asserted

The widened checker was run against a clean `git worktree` at `8e77a23` — the exact tree
`fidelity-qa-reviewer` measured at 261.

| | total |
|---|---|
| baseline `4e0bbe6`, old lens | 261 |
| `8e77a23`, old lens (reviewer-verified) | 261 |
| **`8e77a23`, new lens** | **316** |
| working tree, new lens, after cataloguing `ProjectSwitcher` | **308** |

So: **+55 newly visible pre-existing debt · −8 paid off · 0 new debt.** Measuring against
the working tree could not have told those apart, which is exactly how a widened lens
launders new debt. The arithmetic and the method are in `scripts/rtl-baseline.json`.

## The three silences, because two of them are probably in your files

1. **A template literal with zero interpolations was invisible.** Identical prose was a
   FAIL as `aria-label="…"` and silent as ``aria-label={`…`}``. The `assembled-template`
   blind spot justifies itself on genuine `${a} · ${b}` joins; a template with no `${}` has
   no such defence — it is a string wearing different quotes.

2. **A sentence could suppress its own finding by containing the word "to".** The machine-
   context list holds `to`, `it`, `as`, `id`, `key`, `name`, `type` and `test` — identifiers,
   and also ordinary English — and it was matched against the raw source line. So
   `'Everything on screen is scoped to it.'` was silent and `'Everything on screen is
   scoped.'` was a FAIL. **This is the big one: it accounts for most of the 55**, and nobody
   had named it. Literals are now blanked before that test, so `className="…"` still
   suppresses and the copy inside it no longer votes.

3. **Nothing could observe a missing Arabic plural class.** `Plural` makes
   `zero/one/two/few/many` optional, so deleting the Arabic dual from a count-bearing key
   compiled cleanly, passed the gate, and did not move the coverage figure by one. Now
   `missing-plural-class`, and it is a **hard fail** rather than a ratchet entry — along
   with `missing-catalogue`, `missing-translation` and `orphan-translation`. Falsified:
   with `missing-translation: 1` recorded in the baseline, deleting an Arabic key gave
   regressions `[]`, the word `holding`, and exit 0.

## What this means for you

**Nothing is red that was green.** `--gate` is what `verify` runs, it compares to the
re-recorded baseline, and it holds. If your module's number went up in
`scripts/rtl-baseline.json`, that is strings you already shipped becoming countable, not
strings you added. `node scripts/check-rtl.mjs` (no `--gate`) lists them with line numbers.

The modules that gained the most: `components/shell` +23, `chart/model` +4, `drawer/run`
+4, `dashboards/data` +5, `sessions/relay` +3, `app/api` +3.

**The one thing to change in how you work:** a sentence in backticks is now as visible as
one in quotes, so `` title={`…`} `` no longer buys silence. It never should have.

## Meanwhile

Every finding is still debt on a schedule, not a build failure. I am working
`components/shell` and the empty states next.

---

<!-- The RECIPIENT appends below and sets status: answered. The SENDER sets closed. -->

## Answer
