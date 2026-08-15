---
name: cc-comms
description: The Command Center agent communication protocol. Use at the START of any Command Center task (reading BOARD/contracts/inbox before work) and at the END (status, handoff, closing messages). Also use when one agent needs to ask another a question, request a contract change, report a blocker, or request review.
---

# cc-comms — how Command Center agents talk

All coordination happens in `comms/` (see `comms/README.md` for the full protocol and
`ADR-000` for why). This skill is the operational checklist.

## Opening ritual — run this before any code

```powershell
Get-Content comms/BOARD.md
Get-Content comms/status/<your-slug>.md
Get-ChildItem comms/inbox/<your-slug>, comms/inbox/_all -File
```

Then read every contract listed under your name in BOARD.md, plus any contract you are
about to *consume*. Reading a contract you consume is not optional — most cross-agent
bugs are a consumer who guessed.

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

## Closing ritual — before you report done

1. `comms/handoffs/M<n>-<you>-<topic>.md` from `templates/handoff.md`. The
   **"Deliberately not done"** section is mandatory and is the point of the file.
2. Overwrite `comms/status/<you>.md` from `templates/status.md`. Under 30 lines.
3. `review-request` message to `fidelity-qa-reviewer` if the work is user-visible.
4. Close any of your own messages that this work resolved.

## Hard rules

- Contracts have exactly one owner. Ownership is in BOARD.md.
- `comms/` holds prose and schemas only — no code, no images, no secrets, no build output.
- Cite spec sections by number (`§2.3`, `Part IV`) so claims are checkable.
- If it isn't written in `comms/`, it didn't happen — a decision explained only in a chat
  reply is lost the moment the session ends.
