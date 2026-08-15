# comms/ — the agent communication layer

Every subagent working on Command Center reads and writes here. This folder is the
**only** channel between agents. Nothing is passed verbally; if it isn't written here,
it didn't happen.

## Layout

```
comms/
├── README.md              you are here — the protocol
├── BOARD.md               who owns what, current milestone, live status  (READ FIRST)
├── contracts/             authoritative shared interfaces (one owner each)
│   ├── design-tokens.md       Part I — colors, type, shape, motion
│   ├── frontmatter-schema.md  Part IV — the agent SKILL.md contract
│   ├── panel-schema.md        §2.5 — panels/*.json widget contract
│   ├── api-contracts.md       §3.1–3.2 — runner/relay HTTP + SSE surface
│   └── graph-layout.md        §2.1 — precomputed node/edge layout payload
├── decisions/             ADR-NNN-slug.md — one file per irreversible decision
├── inbox/<agent-slug>/    messages addressed TO that agent
├── handoffs/              "this is done, here is how to use it" notes
├── status/<agent-slug>.md each agent's current state, updated every session
└── templates/             copy these, don't invent formats
```

## The five rules

1. **Read before write.** Start every task with `BOARD.md`, your own
   `status/<you>.md`, your `inbox/<you>/` (open messages only), and every contract
   listed under your name in BOARD.md. No exceptions.
2. **Contracts have one owner.** Only the owner edits a contract file. Anyone else
   who needs a change files a `decision-request` message to the owner. Owners are
   named at the top of each contract.
3. **Decisions are files.** Anything another agent could reasonably contradict later
   — a library choice, a route shape, a token deviation — becomes
   `decisions/ADR-NNN-slug.md` before code depends on it.
4. **Handoff or it's not done.** Finishing work means writing
   `handoffs/<milestone>-<agent>-<topic>.md` describing what exists, where, how to
   call it, and what you deliberately left out.
5. **Status is a heartbeat, not a diary.** `status/<you>.md` is overwritten each
   session with: current task, blocked-on, last handoff, next step. Keep it under
   30 lines.

## Message protocol

Filename: `comms/inbox/<recipient-slug>/<YYYYMMDD-HHmm>-<sender-slug>-<topic-slug>.md`

Get the timestamp from the shell, never from memory:
```powershell
Get-Date -Format 'yyyyMMdd-HHmm'
```

Every message carries this frontmatter (template in `templates/message.md`):

```yaml
---
from: map-galaxy-engineer
to: design-system-guardian          # one agent, or a list, or "all"
type: question | decision-request | blocker | handoff-notice | review-request | fyi
re: contracts/design-tokens.md      # the artifact under discussion, or "-"
status: open                        # open | answered | closed
created: 2026-08-15T18:40
---
```

Answering = appending an `## Answer` section to the *same file* and flipping
`status: answered`. The sender flips it to `closed` once acted on. Never delete a
message; closed messages are the project's reasoning history.

Broadcast: write once to `inbox/_all/` and set `to: all`. Use sparingly — contract
changes, milestone flips, breaking API edits.

## Blocked-on etiquette

A `blocker` message must state: what you tried, the smallest decision that unblocks
you, and **what you will do in the meantime**. Never idle-wait on a reply. If a
blocker sits `open` past your session, record it in `status/<you>.md` and pick up
unblocked work from BOARD.md.

## What does NOT go here

Source code, screenshots, node_modules, build output, secrets. `comms/` is prose and
schemas only. Artifacts live in the repo; comms points at them by path.
