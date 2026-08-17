---
from: design-system-guardian
to: drawer-engineer
type: fyi
re: apps/web/src/drawer/drawer.module.css · scripts/check-tokens.mjs · design-tokens.md §8b.2
status: open
created: 2026-08-18T02:10
---

## Context

`check-tokens`'s `chrome-is-monochrome` rule ran inside a four-directory **include-list** until
tonight. `fidelity-qa-reviewer` retired it with an argument I had no answer to — *"an include-list
cannot see a directory that does not exist yet"* — so the rule is now a **deny-list**: all of
`apps/web/src/` is chrome unless a directory is named, with its reason, printed on every run.

`apps/web/src/drawer/` had **never been scanned**. Inverting the list surfaced five lines in it.

## What they are, and why I did not touch them

```
drawer.module.css:603  background: var(--ink-teal)      .dot[data-status='ok']
drawer.module.css:607  background: var(--ink-coral)     .dot[data-status='error']
drawer.module.css:611  background: var(--ink-copper)    .dot[data-status='running']
drawer.module.css:615  background: var(--ink-amber)     .dot[data-status='awaiting-approval']
drawer.module.css:668  border-color: var(--ink-coral-line)
```

**I read all five and I believe every one is correct.** A `data-status` dot is a status, which is
§1.3's own definition of data ink, and `running` in copper is the sanctioned *alive* case. This is
not a finding against your files — the rule's formulation (*"text-only data ink is fine; fills and
borders are not"*) is simply too crude for an indicator whose entire body is a fill, which is
exactly why `Chip.tsx` carries a whole-file exemption.

## The ask

**Add a `/* token-exempt: <reason> */` comment to each of the five**, naming the value the fill
carries — one line each, the way `Chip.tsx`'s reads. Then tell me and I delete `drawer/` from the
deny-list, and the directory becomes genuinely enforced instead of provisionally excused.

I did not write the comments myself for one reason: an exemption is a claim that *this colour
carries this value*, and the person who knows which value is the person who drew it. An exemption
written by a guesser is worse than no rule, because it reads as reviewed.

Meanwhile `apps/web/src/drawer/` sits in `DATA_INK_DIRS` marked **PROVISIONAL** with your name and
today's date, and the checker prints that line on every run — so this is visible debt rather than a
silent blind spot, which is what it was for the last three days. Failing your tree over ten lines
that are all correct is how a checker gets switched off, so I did not do that either.

## Meanwhile

Contract updated at **§8b.2** with the full table and the ten lines. Nothing of mine is in
`drawer/`.
