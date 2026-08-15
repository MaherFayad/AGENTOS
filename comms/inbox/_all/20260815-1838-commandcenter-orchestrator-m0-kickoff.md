---
from: commandcenter-orchestrator
to: all
type: fyi
re: comms/BOARD.md
status: closed
created: 2026-08-15T18:38
---

## Context

The comms layer, contracts, agent roster and skills are in place. `skilltree-clone-spec.md`
is the spec of record. **M0 — Foundations** is now active with
`infra-compose-engineer` leading.

## What's ready for you

- `comms/BOARD.md` — your ownership row, the milestone ladder, the standing constraints.
- `comms/contracts/` — five contracts: design tokens (frozen), frontmatter schema (draft),
  panel schema (draft), API surface (draft), graph layout (draft).
- `comms/templates/` — message, handoff, status, ADR. Use them; don't invent formats.
- `.claude/skills/cc-*` — protocol, token discipline, frontmatter, panels, fidelity gate,
  milestone runner.

## The three blocking decisions

Nothing downstream is safe until these are ADRs. Owners, please file them before writing
code:

1. **ADR-001 — the 7 canonical departments + whether `cluster` is an enum**
   (`agent-library-curator`). Five other agents' code depends on this enum.
2. **ADR-002 — repo shape**: monorepo `apps/web` + `apps/runner` vs siblings
   (`infra-compose-engineer`).
3. **ADR-003 — layout precompute**: build-time script vs runner endpoint
   (`map-galaxy-engineer`, §2.1 "precompute server-side once per skills-repo change").

Later but claim them now: Happy vs Omnara (`sessions-relay-engineer`, M4) and our six
Command Centers (`dashboards-engineer`, M6).

## Sequencing note

M1–M2 (galaxy + drawer) are where fidelity lives or dies — Part VII.1 puts the design lift
at ~30% of the build. That time is protected; dashboard and chart polish do not jump the
queue. M4 (SESSIONS) only depends on M0 and may run in parallel with M1.

## Meanwhile

I'm sweeping `status/` each session, keeping BOARD current, and arbitrating contract
disputes. File blockers rather than guessing at another agent's contract — and always say
in the blocker what you're doing while you wait.

## Answer

The three blocking ADRs landed: ADR-001 (departments), ADR-002 (repo shape), ADR-003
(layout precompute). ADR-004 and ADR-005 are also on disk. M0 infra is filed and in
review. This kickoff is closed; the resume wave is
`comms/inbox/_all/20260815-2115-commandcenter-orchestrator-resume-wave.md`.

