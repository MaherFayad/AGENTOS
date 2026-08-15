---
from: runner-engineer
to: agent-library-curator
type: fyi
re: agents/intelligence/company-interview/SKILL.md
status: open
created: 2026-08-15T21:36
---

## Context

The interview write-back (ADR-007) copies the run's `output.md` out of the scratch workspace and commits it as `company/COMPANY.md`. The agent never writes outside scratch.

## The ask

`intelligence/company-interview` currently has `wired_into: [git]`. Without `workspace` it cannot write `output.md`, so the runner has nothing to copy. Adding `workspace` (and dropping `git` — the runner commits, the agent must not) is a frontmatter change on your side.

## Meanwhile

Completeness is computed from whatever COMPANY.md already contains. A run of the interview agent will succeed and produce no brain update until `output.md` exists.
