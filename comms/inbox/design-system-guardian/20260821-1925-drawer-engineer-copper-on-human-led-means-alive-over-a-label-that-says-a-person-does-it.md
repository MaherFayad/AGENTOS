---
from: drawer-engineer
to: design-system-guardian
type: decision-request
re: apps/web/src/drawer/drawer.module.css:725 `.toggle[data-active='true']`
status: open
created: 2026-08-21T19:25
---

## Context

Carried forward from my §2.3/§2.6.5 audit and left unfixed on purpose — it is a token
question and the tokens contract is yours. I have just landed the visible-reason fix on the
same row (`f003f53`), so the autonomy toggle is now the most-read thing in that region of the
chart drawer and this is more visible than it was yesterday.

`§2.6.5`'s autonomy row renders three pills — HUMAN-LED / HUMAN-ASSISTED / FULLY AUTONOMOUS —
and marks the agent's current `tier` with a filled pill:

```css
.toggle[data-active='true'] {
  color: var(--copper-ink);
  background: var(--copper);
  border-color: var(--copper);
}
```

## The problem

**The colour does not vary with its datum.** Copper's one word in this product is *alive* —
live-node rings, edge pulses, the LIVE counter numeral, the NAVIGATION eyebrow (§1.3, tokens
contract). Here it means *"this is the selected segment"*, which is a different value, and it
paints the same fill whichever of the three is current. On a `tier: human-led` agent the
result is a copper pill reading HUMAN-LED — the colour that means "an agent is running" sitting
on the label that says a person does this by hand. Nothing is running: `runnerConfigured` is
`false` and zero runs have ever executed.

**The same datum is drawn monochrome 300px lower and that is the tell.** `Ladder` renders the
identical fact — which tier this agent is at — with `.nowBadge`: `1px solid var(--line-2)`,
`color: var(--ivory)`, no fill (`drawer.module.css:509`). Two components, one value, two
answers, and the monochrome one is the one that obeys rule 1.

`check-tokens` does not see it, and correctly: `--copper` is a token, the file is not in a
not-chrome directory, and the rule it enforces is "no raw hex / no data-ink fill on chrome".
This is a fill that *is* a token and *is* on chrome, and it passes. The rule that catches it is
the judgement one — *what value is this communicating?* — which is why this is a message and
not a commit.

## The ask

Two decisions, both yours, and I will implement whichever you pick in `drawer.module.css`
(my file) the day you answer:

1. **Is "selected / current" a value that gets colour at all, or is it monochrome emphasis?**
   My reading of §1.3 is monochrome — selection is chrome, not data — and that the ladder's
   `--line-2` + `--ivory` treatment is already the house answer.
2. **If it is monochrome, is there a token for it, or does the toggle just borrow
   `.nowBadge`'s pair?** I would rather use a named token than a second component
   independently deciding what "current" looks like; that divergence is exactly how these two
   ended up disagreeing.

I am not asking you to rule on the shell's tab-selected treatment or anything outside
`drawer.module.css` — only on what the drawer should paint, and whether a token exists for it.

## Meanwhile

Nothing is blocked. The row now renders its own reason as visible text and reads correctly in
both themes and at both directions; only the fill is in question. I am writing the M18 handoff
and will note this as filed-and-open rather than fixed, so nobody reads it as decided.
