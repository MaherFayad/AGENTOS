---
name: cc-milestone
description: Run a Command Center build milestone end to end (spec Part VI, M0–M8) — scoping it, assigning the lead and supporting agents, sequencing the work, gating it through review, and flipping the BOARD. Use when starting, resuming, or closing a milestone.
---

# cc-milestone — how a milestone runs

Milestone table: `comms/BOARD.md` (mirrors spec Part VI). Leads are named there.

## Opening a milestone

1. Confirm the previous milestone is `done` in BOARD.md, or that this one is genuinely
   parallel (M4 SESSIONS only needs M0; M1 and M4 can run together).
2. Resolve the BOARD "open cross-cutting questions" tagged with this milestone — as ADRs,
   before code. An unresolved M-tagged question is a hard stop, because it's exactly the
   thing two agents will otherwise answer differently.
3. Lead writes a scope message to `inbox/_all/` — spec §s in scope, contracts touched,
   which supporting agents are needed for what.
4. Lead sets BOARD state to `active` and updates `status/<lead>.md`.

## During

- Contract-first: if the milestone introduces a shared shape, the contract owner writes it
  **before** the consumer builds against it. Consumers read; they don't guess.
- Supporting agents work from their own inbox message, write their own handoff, and stay
  inside their ownership boundary. Cross-boundary need → message, not a quiet edit.
- Vertical slices, not layers: one department rendering end-to-end beats seven half-built
  ones — it makes the fidelity test possible early, and M1–M2 are where fidelity lives or
  dies (Part VII.1).

## Milestone-specific traps (from the spec's own flags)

| M | Trap |
|---|---|
| 0 | Skipping the frontmatter schema to "get something on screen" — every later view then hardcodes data and Part IV's single-source-of-truth is dead |
| 1 | Treating the galaxy canvas as decoration. It's ~30% of the perceived build (Part VII.1). Budget it as a feature |
| 2 | Building the drawer against invented data instead of real frontmatter |
| 3 | Runner tool allowlist drifting wider than `wired_into` — a security regression, not a convenience |
| 4 | Any design that decrypts sessions server-side. E2E stays intact (§3.1) |
| 5 | Duplicating agent data for the matrix instead of projecting the same frontmatter (§2.6) |
| 6 | Hardcoding a dashboard. Panels are JSON (§2.5) |
| 7 | Schedule written anywhere but frontmatter + git commit → ofelia sync (§3.2) |
| 8 | Retrofitting RTL. It's a layout property, cheaper if the components were built direction-agnostic |

## Closing

1. Every participating agent files `comms/handoffs/M<n>-<agent>-<topic>.md`, including the
   **Deliberately not done** section.
2. Lead sends `review-request` to `fidelity-qa-reviewer` listing spec §s claimed complete.
3. Reviewer runs `cc-fidelity-check` and answers PASS or a numbered failure list.
4. On PASS: lead flips BOARD state to `done`, unblocks dependents, and posts an `fyi` to
   `inbox/_all/` with what's now available to build on.

## Reporting to the human

State what's done, what's deliberately deferred, and what the next milestone unblocks.
If part of the milestone is blocked, finish everything else and say precisely what was
left and why — scaling down the scope is the human's call, not the agent's.
