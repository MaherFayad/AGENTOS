---
name: cc-comms
description: The Command Center agent communication protocol. Use at the START of any Command Center task (reading BOARD/contracts/inbox before work) and at the END (status, handoff, closing messages). Also use when one agent needs to ask another a question, request a contract change, report a blocker, or request review.
---

# cc-comms — how Command Center agents talk

All coordination happens in `comms/` (see `comms/README.md` for the full protocol and
`ADR-000` for why). This skill is the operational checklist.

## Opening ritual — run this before any code

```powershell
Get-Content comms/BRIEF.md
Get-Content comms/status/<your-slug>.md
Get-ChildItem comms/inbox/<your-slug>, comms/inbox/_all -File
```

`BRIEF.md` is capped at 150 lines and `check-comms.mjs` fails the build if it grows past
that. **Do not read `BOARD.md` end to end** — it is over 1,300 lines and it is a record to
consult, not a briefing. Grep it for your slug or the milestone you are on.

Then read the **sections** of any contract you *consume* — a contract you consume is not
optional, because most cross-agent bugs are a consumer who guessed, but the contracts
total 4,400 lines and no dispatch needs all of them.

Why this is worded so tightly: one session ran ~30 dispatches, each ingesting ~4,000 lines
before doing any work, and produced 28k lines of markdown against 12k lines of product
code. The reading cost exceeded the work. Read narrowly, write narrowly.

Open messages (`status: open`) addressed to you are answered **before** you start new
work. Answering is cheap; a blocked peer is not.

## While working

- Discovered a fact another agent will need? → `fyi` message, one paragraph, now.
- Need a contract changed? → `decision-request` to the owner, quoting current and
  proposed lines verbatim. Do **not** edit a contract you don't own.
- Genuinely stuck? → `blocker` message that names the smallest unblocking decision **and
  what you'll do meanwhile**. Then go do that. Never idle.
- Made a call another agent could contradict? → ADR from `comms/templates/adr.md`,
  next free number, before code depends on it.

## Writing a message

```powershell
$ts = Get-Date -Format 'yyyyMMdd-HHmm'
# comms/inbox/<recipient>/$ts-<you>-<topic>.md   — body from comms/templates/message.md
```

Answering: append `## Answer` to the *same file*, set `status: answered`. The sender
sets `closed` after acting. Never delete a message.

## Closing ritual — scaled to the size of the work

**Small work: one file you understood, no contract change, nothing another agent builds
against.** Overwrite `comms/status/<you>.md` and stop. The code and its test are the
deliverable. **No handoff, no `_all` broadcast, no FYIs.**

**A milestone slice, or anything another agent consumes:**

1. `comms/handoffs/M<n>-<you>-<topic>.md` from `templates/handoff.md`. The
   **"Deliberately not done"** section is mandatory and is the point of the file.
2. Overwrite `comms/status/<you>.md` from `templates/status.md`. Under 30 lines.
3. `review-request` message to `fidelity-qa-reviewer` if the work is user-visible.
4. Close any of your own messages that this work resolved: `status: answered`, write the
   `## Answer`, then **move the file to `comms/inbox/_archive/<agent>/`** (rule 6). Nothing
   is deleted — the record moves, so open mail stays small enough to be read.

Either way: **prefer a gate to a paragraph.** A finding written into a test keeps working
for free; a finding written into a handoff is read once. Before you describe a defect, ask
whether it can fail a build instead. `validate:barrel`, the allowlist-the-session-received
test and the writer/schema agreement check all came from findings that would otherwise
have been prose.

And do not send an FYI that changes nobody's work. If it changes someone's work it is a
`decision-request` or a finding with an owner — send that, to their inbox. A defect
assigned inside a code comment reached nobody for a week and took the whole app down.

## Hard rules

- Contracts have exactly one owner. Ownership is in BOARD.md.
- `comms/` holds prose and schemas only — no code, no images, no secrets, no build output.
- Cite spec sections by number (`§2.3`, `Part IV`) so claims are checkable.
- If it isn't written in `comms/`, it didn't happen — a decision explained only in a chat
  reply is lost the moment the session ends.
