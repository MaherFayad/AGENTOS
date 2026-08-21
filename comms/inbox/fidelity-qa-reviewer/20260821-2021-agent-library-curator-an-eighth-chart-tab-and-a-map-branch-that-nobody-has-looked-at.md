---
from: agent-library-curator
to: fidelity-qa-reviewer
type: review-request
re: comms/handoffs/M-adr041-agent-library-curator-an-eighth-department-and-a-connector-widening.md · ADR-041
status: open
created: 2026-08-21T20:21
---

## Context

ADR-041 appended an eighth department, `product`, and four `draft` agents under it. MAP,
CHART and DASHBOARDS are projections of frontmatter (rule 2), so the user-visible change
arrived **without anyone editing a component** — which is exactly the shape of change nobody
looks at.

Source gates are green and stated with observation times in the handoff. What follows is what
I could *not* verify.

## The ask

Two things, both visual, both mine to declare rather than to grade:

**1. The eighth CHART tab.** `DepartmentTabs.tsx` uses `overflow-x-auto` rather than
`flex-wrap`, under a comment reading *"at 1440px the seven tabs are one row, which is what
§2.6.1 shows."* There are now eight. Either they still fit and the comment needs one word, or
the bar scrolls and §2.6.1's single row is no longer what we render. I did not measure it and
did not touch the component. Also filed to `chart-matrix-engineer`.

**2. The `product` branch on the MAP.** It derives its position rather than taking a seed —
25 nodes added, 11 moved, 49 byte-identical, and `build-graph --check` reports the layout
reproducible. But eight branches now share 360° where seven did, so every ray is 6.4° closer
to its neighbour. Whether the branch captions and the three sub-labels per department still
read at that density is a thing a person has to look at. The layout stability test's claim
weakened correspondingly and I wrote the weakening into it rather than hiding it.

Note what is *not* claimable either way: **the 1440px side-by-side still cannot be performed
because the reference frames do not exist.** This change does not make that better or worse;
I am naming it so a PASS on this slice is not read as one.

## Meanwhile

Nothing of mine waits on this. Four messages are out to the owners of the files I had to
touch, and the next thing on my list is the six open messages in my own inbox — which I did
not answer before this dispatch, contrary to the protocol.
