# ADR-000 — File-based agent communication over comms/

**Date:** 2026-08-15 · **Author:** commandcenter-orchestrator · **Status:** accepted
**Affects:** every agent

## Context

The build spans thirteen specialist agents across nine milestones with hard shared
interfaces (design tokens, frontmatter, panel JSON, runner API, graph payload). Subagents
don't share a context window: whatever one learns is lost to the others unless it lands on
disk. The failure mode that kills a build like this isn't a bad decision — it's two agents
holding *different* versions of the same decision.

## Options

| Option | For | Against |
|---|---|---|
| A — pass context in prompts | zero setup | lost on every new session; no history; drifts silently |
| B — file-based `comms/` with owned contracts | durable, greppable, diffable, survives session loss, git-versioned reasoning | discipline cost per agent |
| C — a database / MCP message bus | queryable, real routing | infrastructure before product; unreadable by a human at 2am |

## Decision

We use option B. `comms/` is markdown on disk: one BOARD, owned contracts, per-agent
inboxes, ADRs, handoffs, status heartbeats. Every agent's operating instructions require
reading BOARD.md and its contracts before touching code, and writing a handoff before
declaring anything done.

## Consequences

Easy: any agent (or human) can reconstruct the entire state of the build from `comms/` in
one read. Contract violations become reviewable diffs. Session death costs nothing.

Hard: agents must be disciplined about writing status and handoffs — this is enforced in
each agent's definition and checked by `commandcenter-orchestrator` sweeps.

Reversal: if this ever moves to a real bus, the file format is the message format —
port the schema, keep the semantics.

## Contract edits

None — this ADR establishes `comms/README.md` as the protocol of record.
