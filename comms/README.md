# comms/ — the agent communication layer

Every subagent working on Command Center reads and writes here. This folder is the
**only** channel between agents. Nothing is passed verbally; if it isn't written here,
it didn't happen.

## Layout

```
comms/
├── README.md              you are here — the protocol
├── BRIEF.md               (READ FIRST) capped at 150 lines: milestone, rules, findings
├── BOARD.md               the full record — consult the section you need, don't ingest it
├── contracts/             authoritative shared interfaces (one owner each)
│   ├── design-tokens.md       Part I — colors, type, shape, motion
│   ├── frontmatter-schema.md  Part IV — the agent SKILL.md contract
│   ├── panel-schema.md        §2.5 — panels/*.json widget contract
│   ├── api-contracts.md       §3.1–3.2 — runner/relay HTTP + SSE surface
│   └── graph-layout.md        §2.1 — precomputed node/edge layout payload
├── decisions/             ADR-NNN-slug.md — one file per irreversible decision
├── inbox/<agent-slug>/    OPEN messages addressed TO that agent
├── inbox/_archive/        answered and closed mail — kept, not read (rule 6)
├── handoffs/              "this is done, here is how to use it" notes
├── status/<agent-slug>.md each agent's current state, updated every session
└── templates/             copy these, don't invent formats
```

## The five rules

1. **Read narrowly before you write.** Start every task with **`BRIEF.md`** (capped at
   150 lines — current milestone, the rules that don't bend, and the findings that cost a
   session each), your own `status/<you>.md`, your **open** `inbox/<you>/`, and the
   **sections** of the contracts you actually consume.

   Not the whole of `BOARD.md`: it is the full record, over 1,300 lines, and it is there
   to be *consulted*, not ingested. When every dispatch read it end to end, the reading
   cost exceeded the work — one session spent roughly 4,000 lines of mandatory reading per
   agent before any work began. Answered mail lives in `inbox/_archive/` and is not read.
2. **Contracts have one owner.** Only the owner edits a contract file. Anyone else
   who needs a change files a `decision-request` message to the owner. Owners are
   named at the top of each contract.
3. **Decisions are files.** Anything another agent could reasonably contradict later
   — a library choice, a route shape, a token deviation — becomes
   `decisions/ADR-NNN-slug.md` before code depends on it.
4. **Handoff when someone consumes it — scale the paperwork to the work.** A milestone
   slice, or anything another agent builds against, needs
   `handoffs/<milestone>-<agent>-<topic>.md`: what exists, where, how to call it, and what
   you deliberately left out. **A single understood file with no contract change does
   not** — the code, its test and one status line are the whole deliverable. No handoff,
   no `_all` broadcast, no FYIs that change nobody's work.

   Prose is not the deliverable. One session produced 28k lines of markdown against 12k
   lines of product code, and the largest single category was agents writing to each
   other. Prefer a gate to a paragraph: a finding written into a test keeps working for
   free, and a finding written into a handoff is read once.
5. **Status is a heartbeat, not a diary.** `status/<you>.md` is overwritten each
   session with: current task, blocked-on, last handoff, next step. Keep it under
   30 lines.
6. **Close your messages.** When you answer one, set `status: answered`, write the
   `## Answer`, and move the file to `inbox/_archive/<agent>/`. Nothing is deleted; the
   record moves so the reading cost stops growing with it. An inbox that only grows is a
   tax every later dispatch pays — 137 messages sat open at once before this rule existed.

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
