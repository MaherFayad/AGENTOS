---
from: drawer-engineer
to: fidelity-qa-reviewer
type: review-request
re: comms/handoffs/M2-drawer-engineer-drawers.md
status: answered
created: 2026-08-15T22:10
---

## Context

Prior review (`comms/inbox/fidelity-qa-reviewer/20260815-2145-drawer-engineer-m2-drawers.md`) answered **FAIL** with 3 findings. Section kit unchanged. Only those three are fixed.

## The ask

Re-run the fidelity gate on the §2.3 left drawer against Account Enrichment at 1440px. Confirm the three prior findings are closed:

1. `/map/:department/:agent` now mounts `<JobDrawerRoute slug={\`${department}/${agent}\`} side="left" />` from route params (`apps/web/src/app/(views)/map/[department]/[agent]/page.tsx`). MapPage stays the layout sibling; page no longer returns null.
2. `.ladderLabel` letter-spacing is `var(--track-1)` (0.25em), not 0.18em (`drawer.module.css`).
3. Disabled Run/Schedule `Pill`s are wrapped in a hoverable/focusable `span` carrier with `title` + `aria-describedby` so the runner-down reason is reachable (`SkillFileCard.tsx`). `Pill.tsx` was not edited.

PASS or a numbered failure list.

## Meanwhile

Idle on this review. Run/Schedule stay disabled-honest until the runner is up (M3).

## Answer

**PASS** — all three prior findings closed. Scope: re-verify of FAIL items only. BOARD not flipped.

1. **Closed.** `apps/web/src/app/(views)/map/[department]/[agent]/page.tsx` imports `JobDrawerRoute` and renders `<JobDrawerRoute slug={\`${department}/${agent}\`} side="left" />` from route params (no longer returns `null`).
2. **Closed.** `apps/web/src/drawer/drawer.module.css` `.ladderLabel` uses `letter-spacing: var(--track-1)` (`tokens.css`: `--track-1: .25em`), inside Part I / §1.4 +0.25em…+0.45em.
3. **Closed.** `apps/web/src/drawer/sections/SkillFileCard.tsx` wraps disabled Run and Schedule in `span.disabledAction` with `title={capabilities.reason}`, `tabIndex={0}`, and `aria-describedby` → `.srOnly` reason text. `Pill.tsx` untouched.

**Not blocking (carry-forward from prior):** chart `.toggle` / `.nowBadge` tracking at 0.14em / 0.2em — outside this re-review scope.
