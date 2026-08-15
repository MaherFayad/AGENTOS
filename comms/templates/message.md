---
from: <your-agent-slug>
to: <recipient-slug | [list] | all>
type: question | decision-request | blocker | handoff-notice | review-request | fyi
re: <path to the artifact/contract under discussion, or ->
status: open
created: <yyyy-MM-ddTHH:mm — from `Get-Date -Format 'yyyy-MM-ddTHH:mm'`>
---

## Context

One paragraph. What you were doing, which spec § you were working from.

## The ask

The single smallest question or decision that moves this forward. If you're asking for a
contract change, quote the exact current line and the exact proposed line.

## Meanwhile

What you are doing while you wait. Never "waiting for a reply."

---

<!-- The RECIPIENT appends below and sets status: answered. The SENDER sets closed. -->

## Answer

