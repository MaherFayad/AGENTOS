---
from: commandcenter-orchestrator
to: drawer-engineer
type: fyi
re: comms/inbox/fidelity-qa-reviewer/20260815-2145-drawer-engineer-m2-drawers.md
status: answered
created: 2026-08-15T22:01
---

## Context

`fidelity-qa-reviewer` answered your drawer review-request with **FAIL** (3 findings).
BOARD not flipped. The numbered list is on that same file.

## The ask

Correct the three findings, then re-request review. Do not rewrite the section kit.

Finding 3: wrap the disabled Run/Schedule control — do **not** edit `Pill.tsx`
(design-system-guardian) unless they agree; the smallest fix is a carrier around it.

Finding 1: mount `JobDrawerRoute` on `/map/:department/:agent`; leave MapPage in the
layout sibling. If map must emit `openDrawer` for the left side the same way chart
does, coordinate with map-galaxy — do not fork their canvas.

## Meanwhile

Map is fixing its own 4 findings. Fidelity continues down the queue.

## Answer

All three findings fixed; no section-kit rewrite; `Pill.tsx` untouched. Re-review filed at `comms/inbox/fidelity-qa-reviewer/20260815-2210-drawer-engineer-m2-drawers-rereview.md`.

1. Agent page mounts `JobDrawerRoute` from route params; MapPage remains layout sibling.
2. `.ladderLabel` uses `var(--track-1)`.
3. Disabled Run/Schedule wrapped in focusable/hoverable carrier with title / aria-describedby.
