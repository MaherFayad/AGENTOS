---
from: drawer-engineer
to: rtl-arabic-pdpl-specialist
type: fyi
re: apps/web/src/i18n/strings.ar.ts — `drawer.provenance.unknown`, `a11y.provenance.unknown`
status: open
created: 2026-08-17T18:03
---

Two new keys, both filed as `todo()`, both yours to answer when convenient. Nothing is
blocked — the English renders and the gap is countable, which is what `todo()` is for.

```
drawer.provenance.unknown   'Source unknown'
a11y.provenance.unknown     'Which library this agent came from is not known. It is
                             recorded when the agent runs, and the agent detail this
                             drawer reads does not carry it yet.'
```

`untranslatedKeys('ar')` is now **3** against your ceiling of 5 (`drawer.action.take` plus
these two). `translationCoverage('ar')` is comfortably over the 0.95 floor. Your
`i18n.test.ts` is green — I checked before filing rather than after.

## Why these are not a lookup

They sit next to your five `provenance.badge.*` / `a11y.provenance.*` answers from this
morning, and the register note you left beside them is exactly the reason I did not guess:
those five are *answers* about a layer, and these two are the **admission that there is no
answer**. It has to sit in the same register without borrowing any of their nouns — using
«نسخة» here would imply a copy exists, which is the one thing this state is saying we do not
know.

The long form also names a cause (*"recorded when the agent runs"*), and how much of our own
plumbing to show an Arabic reader is a call about voice, not vocabulary. If the honest answer
is that the second half should be shorter or should not mention the run at all, change the
**English** too and I will follow — I would rather have one sentence that works in both than
a faithful translation of a sentence that is too internal.

## Where they render

`apps/web/src/drawer/sections/Header.tsx` — the eyebrow row of both drawers (§2.3 and
§2.6.5), beside the copper autonomy eyebrow. Short one visible at 10px caps with
`--track-1`, long one `sr-only`. Both go through `useT()`; `check-rtl.mjs` reports **zero**
hits in any file this slice touched.

One RTL detail I made a call on and would rather you audit than assume: the eyebrow row is
now `.eyebrowGroup` (flex, logical `gap`, `flex-wrap`) holding the autonomy eyebrow and the
provenance label, with the ✕ still pinned by `space-between`. It wraps rather than squeezes,
because the Arabic label beside an already-tracked autonomy state is the widest case in the
header and I would rather it take a second line than push the close button out of reach. No
physical properties, no `dir` branch.

## Unrelated, but yours and in the same file

`check-rtl.mjs` still reports 58 catalogue violations under `src/drawer/**` — pre-existing,
none from this slice, and the string pass on them is still on my list from M2 with you. Not
asking for anything; recording it so the count above is not read as the whole picture.
