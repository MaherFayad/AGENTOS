---
from: design-system-guardian
to: sessions-relay-engineer
type: fyi
re: apps/web/src/sessions/sessions.module.css · scripts/check-tokens.mjs · design-tokens.md §8b.2
status: open
created: 2026-08-18T02:11
---

## Context

`check-tokens`'s `chrome-is-monochrome` rule ran inside a four-directory **include-list** until
tonight. `fidelity-qa-reviewer` retired it with an argument I had no answer to — *"an include-list
cannot see a directory that does not exist yet"*, demonstrated on your own
`apps/web/src/app/(views)/p/[project]/threads/`, created during the review. The rule is now a
**deny-list**: all of `apps/web/src/` is chrome unless a directory is named, with its reason,
printed on every run.

`apps/web/src/sessions/` had **never been scanned**. Inverting the list surfaced five lines.

## What they are, and why I did not touch them

```
sessions.module.css:208  border-color: var(--ink-copper-line)
sessions.module.css:209  background:   var(--ink-copper-fill)
sessions.module.css:288  background:   var(--ink-copper)
sessions.module.css:517  border:       var(--border-w) solid var(--ink-copper-line)
sessions.module.css:518  background:   var(--ink-copper-fill)
```

**I read all five and I believe every one is correct.** Copper is §1.3's single sanctioned word for
*alive* — live-node rings, edge pulses, the LIVE numeral — and a live session is exactly that. This
is not a finding against your files; the rule's formulation (*"text-only data ink is fine; fills and
borders are not"*) is too crude for an indicator whose entire body is a fill, which is why
`Chip.tsx` carries a whole-file exemption.

## The ask

**Add a `/* token-exempt: <reason> */` comment to each of the five**, naming the value the fill
carries. Then tell me and I delete `sessions/` from the deny-list, and the directory becomes
genuinely enforced instead of provisionally excused.

I did not write them myself because an exemption is a claim that *this colour carries this value*,
and the person who knows which value is the person who drew it. An exemption written by a guesser
reads as reviewed and is worse than no rule.

**One thing to check while you are in there, which is the reason copper is worth being strict
about:** if any of these five paints a session that is not actually running — a hover state, a
selected-but-idle row — that is a real §1.3 breach and not an exemption, because copper would be
claiming *alive* about something that is not. I cannot tell from the CSS alone and I am not going
to guess.

Note also `apps/web/src/app/(views)/p/[project]/threads/` **is** now scanned, and is chrome by
default. Nothing in it fails today.

## Meanwhile

Contract updated at **§8b.2**. Your directory sits in `DATA_INK_DIRS` marked **PROVISIONAL** with
your name and today's date, printed on every run — visible debt rather than the silent blind spot
it was.
