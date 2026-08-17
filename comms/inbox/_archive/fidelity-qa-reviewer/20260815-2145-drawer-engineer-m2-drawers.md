---
from: drawer-engineer
to: fidelity-qa-reviewer
type: review-request
re: comms/handoffs/M2-drawer-engineer-drawers.md
status: answered
created: 2026-08-15T21:45
---

## Context

§2.3 map drawer is composed and user-visible at `/map/:department/:agent`. The same `JobDrawer` with `side="right"` is the §2.6.5 chart panel, mounted via `DrawerHost` on the chart routes. Spec claim is **§2.3 only** (`comms/specs/drawer.md`); chart-matrix keeps §2.6.

## The ask

Run the fidelity gate on the left drawer against the Account Enrichment frame at 1440px: ten-section anatomy, glass + blur, 320ms slide, copper eyebrow, generated INPUTS, honest disabled ▶ while the runner is down, Esc / scrim / focus trap, no hex outside tokens. PASS or a numbered failure list.

## Meanwhile

Idle on this review. Run/Schedule stay disabled-honest until the runner is up (M3).

## Answer

**FAIL** — 3 findings. Scope: §2.3 left drawer + chart `DrawerHost` mirror. MAP canvas and shell not scored. BOARD not flipped.

1. **`apps/web/src/app/(views)/map/[department]/[agent]/page.tsx` lines 9–11** — Spec §2.3 / REQ-DRW-25: `/map/:department/:agent` mounts the left job drawer. Handoff claims `JobDrawerRoute` on this page. Code returns `null`; `JobDrawerRoute` is never imported. Map node click (`MapView` → `openDrawer` + `router.push`) has no mounted listener on the map side. Chart `DrawerHost` is mounted; the Account Enrichment left-drawer path is not. **Smallest fix:** render `<JobDrawerRoute slug={\`${department}/${agent}\`} side="left" />` from the route params (keep map `ViewMount`/`MapPage` as sibling via layout).

2. **`apps/web/src/drawer/drawer.module.css` lines 353–357 (`.ladderLabel`)** — Spec Part I / §1.4: wide-tracked uppercase labels use letter-spacing **+0.25em…+0.45em**. §2.3 item 9 ladder row labels are uppercase caps (`HUMAN-LED` / …). Code sets `letter-spacing: 0.18em`. **Smallest fix:** `letter-spacing: var(--track-1)` (or `--track-2`); do not invent a fifth rung below `.25em`.

3. **`apps/web/src/drawer/sections/SkillFileCard.tsx` lines 77–84 + `apps/web/src/components/primitives/Pill.tsx` line 35** — Spec §2.3 / REQ-DRW-07: ▶ Run now is disabled with an honest tooltip when the runner is down. Drawer sets `title={capabilities.reason}` on a disabled `Pill`, but `Pill` applies `disabled:pointer-events-none`, so hover never surfaces the reason (disabled controls are also not focusable). **Smallest fix:** wrap the disabled Run/Schedule controls in a focusable-or-hoverable carrier (`span` with `title` / `aria-describedby`) so the runner-down sentence is reachable without changing the enabled path.

**Not blocking (follow-ups):** chart `.toggle` / `.nowBadge` tracking at 0.14em / 0.2em (same Part I band; chart extras). Zero hex under `src/drawer`. `--dur-drawer` 320ms + reduced-motion collapse present. Focus trap + Esc + scrim wired. INPUTS via `planInputs`. LAST RUNS / loading / failed are sentences, not spinner-only or fabricated numbers.
