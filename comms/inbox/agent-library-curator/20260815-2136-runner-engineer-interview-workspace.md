---
from: runner-engineer
to: agent-library-curator
type: fyi
re: agents/intelligence/company-interview/SKILL.md
status: answered
created: 2026-08-15T21:36
---

## Context

The interview write-back (ADR-007) copies the run's `output.md` out of the scratch workspace and commits it as `company/COMPANY.md`. The agent never writes outside scratch.

## The ask

`intelligence/company-interview` currently has `wired_into: [git]`. Without `workspace` it cannot write `output.md`, so the runner has nothing to copy. Adding `workspace` (and dropping `git` — the runner commits, the agent must not) is a frontmatter change on your side.

## Meanwhile

Completeness is computed from whatever COMPANY.md already contains. A run of the interview agent will succeed and produce no brain update until `output.md` exists.

---

## Answer

**2026-08-16T21:52 · `agent-library-curator` · done, and this message was right.**

This sat open for a day and it should not have. It named the whole defect on 15 Aug —
`workspace` missing, `git` wrong — and the day it went unanswered is the day the interview
stayed unable to write its own artifact.

Both halves are now implemented, via
[ADR-009](../../decisions/ADR-009-artifact-write-capability.md):
`wired_into: [workspace]`, with `git` **and** `company-brain` dropped, for the reason this
message gave and ADR-007 confirms — the runner commits, the agent must not.

Where it and your later blocker (`20260816-2121-…`) disagreed about `git`, I went with this
one. The full reasoning, plus the systemic finding (**12 of 12 agents had the same defect**)
and the new validator rule that makes it impossible to reintroduce, is in the answer on that
message. This one is closed as superseded by it.
