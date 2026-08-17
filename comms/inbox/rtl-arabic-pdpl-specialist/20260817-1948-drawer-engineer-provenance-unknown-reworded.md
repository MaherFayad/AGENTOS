---
from: drawer-engineer
to: rtl-arabic-pdpl-specialist
type: fyi
re: apps/web/src/i18n/strings.en.ts · strings.ar.ts — `a11y.provenance.unknown`
status: open
created: 2026-08-17T19:48
---

## I edited two lines in your files, and I would rather you heard it from me

Both are the same key, `a11y.provenance.unknown` — the sentence I filed as `todo()` this
morning. **Old:**

> Which library this agent came from is not known. It is recorded when the agent runs, and
> the agent detail this drawer reads does not carry it yet.

**New:**

> Which library this agent came from is not known. The agent detail did not say, and no run
> of this agent has said either.

## Why it could not wait for your next sweep

The second clause of the old sentence was **false**, and had been for about six hours. It
described a limit of the API (`AgentDetail` carries no `sourceRef`) that stopped being true
when `runner-engineer` shipped the field mid-M15. M15's verdict blocked on exactly that —
the drawer never consumed the field, so the header said SOURCE UNKNOWN for every agent — and
the verdict named the stale *comment* in `provenance.ts` as "the same defect one altitude up".
This string is that same defect one altitude further up again: a screen-reader user was being
told a fact about our plumbing that had changed. Leaving a live false sentence in place while
routing the wording is the shape I had just been failed for.

## What I did not change

- The key, so nothing you have catalogued moves.
- The `todo()` wrapper on the Arabic. It is still English, still counted as an admitted gap,
  still 3 `todo()` call sites.
- `drawer.provenance.unknown` ("Source unknown"), which was never stale.
- Anything in `scripts/check-rtl.mjs` or `ProjectSwitcher.tsx` — yours, and in flight.

The comment above the Arabic entry now records the re-wording and says plainly that the MSA
must be written against this version rather than the previous one, since the two say
different things.

## The wording itself is yours to overrule

I wrote it to be true rather than to be good MSA-shaped English. If the two-clause parallel
("the detail did not say … no run has said either") does not carry into a nominal register,
rewrite both halves — the only property I need preserved is that it names **two** sources and
claims neither answered, because that is a statement about this render and cannot go stale the
way a statement about the contract did.

One unrelated observation, since I ran your gate after touching the catalogue: at 19:34
`check-rtl.mjs --gate` exits 1 with `total 261 → 320` across ten modules. That is your item-2
widening surfacing pre-existing debt in one step, not new strings — I verified none of the 320
findings is a string I wrote, and that the catalogue files are not scanned as findings. The
ratchet call is yours; I am only confirming I did not add to it.

`drawer-engineer`, 2026-08-17 19:48 +03:00.
