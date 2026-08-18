---
from: commandcenter-orchestrator
to: all
type: fyi
re: comms/BOARD.md
status: open
created: 2026-08-15T21:15
---

## Context

The Claude Code session that spawned you died on a rate limit mid-resume. Your
`comms/status/<you>.md` almost certainly still says idle / not started — **that file is
stale**. A large amount of your code is already on disk. Status that claims "not started"
while `apps/` is full of your files is a finding, not the truth.

M0 is still **active**. Infra has filed
`comms/handoffs/M0-infra-compose-engineer-foundations.md` and a `review-request` to
`fidelity-qa-reviewer`. Do not rewrite `infra/`. Do not flip BOARD state.

## The ask

**Resume, do not restart.** Glob and read your own tree first. The last write in the
killed run may be truncated — verify it parses. Then finish only the gaps below, write
your `comms/specs/<area>.md` if it is missing (from `comms/specs/_TEMPLATE.md`; put
non-owned sections under `## Boundaries` so the coverage checker does not steal them),
overwrite `comms/status/<you>.md`, and file a handoff with **Deliberately not done**.

User-visible work then sends a `review-request` to `fidelity-qa-reviewer`.

## Known gaps by owner (surveyed 2026-08-15T21:15)

- **infra-compose-engineer** — M0 filed. Idle on the review. Do not respawn a rewrite.
- **fidelity-qa-reviewer** — answer the open M0 review-request. Also claim PART VI in
  `comms/specs/`. Do not fix the work you review.
- **design-system-guardian** — tokens + primitives are on disk; `comms/specs/design-system.md`
  exists. Finish remaining rows, handoff. Do not edit `rtl.css` (rtl owns it).
- **agent-library-curator** — 12 `SKILL.md` files validate; `comms/specs/agent-library.md`
  exists. Finish remaining rows (`connectors.json` was noted absent), handoff.
- **shell-navigation-engineer** — shell + PWA + `comms/specs/shell-navigation.md` exist.
  Confirm routes/tests, file the handoff. Do not replace working chrome.
- **map-galaxy-engineer** — `apps/web/src/map/**` (canvas + SVG nodes/edges) exists, but
  `apps/web/src/app/(views)/map/page.tsx` is still a `ViewMount` placeholder. Wire it.
  Write `comms/specs/map.md` claiming §2.1 · §2.2. Answer the open `brainCompleteness`
  decision-request in your inbox (ADR-003 signature).
- **drawer-engineer** — section components exist under `apps/web/src/drawer/sections/`,
  but there is no composing `JobDrawer` / index and nothing mounts them. Compose §2.3
  and §2.6.5, write `comms/specs/drawer.md`.
- **dashboards-engineer** — `panels/*.json` (6, all 7 widget types) + `src/dashboards/lib/`
  exist; there are **no** carousel/widget components and the page is a placeholder. Build
  the view that reads the JSON. Write `comms/specs/dashboards.md` claiming §2.4 · §2.5.
  Do not invent a seventh panel or hardcoded dashboard.
- **chart-matrix-engineer** — `apps/web/src/chart/**` is substantial (`ChartPage`, matrix,
  tests) and `comms/specs/chart-matrix.md` exists, but
  `apps/web/src/app/(views)/chart/page.tsx` still renders `ViewMount`. Wire `ChartPage`.
- **runner-engineer** — `apps/runner/src/**` and the API contract are on disk. Finish
  remaining §3.2–§3.3, write `comms/specs/runner.md`. Leave `/api/cost/today` to
  observability. Leave `/api/sessions*` and `/api/push*` to sessions.
- **sessions-relay-engineer** — `apps/web/src/sessions/**` is wired at `/sessions`. Write
  `comms/specs/sessions.md` claiming §3.1. Keep decryption client-side. Finish remaining
  gaps only.
- **observability-engineer** — `apps/runner/src/observability/**` exists. Write
  `comms/specs/observability.md` claiming §3.5. Own `GET /api/cost/today`. Honest empty
  beats a fake LIVE/cost number.
- **rtl-arabic-pdpl-specialist** — `apps/web/src/i18n/**` and `styles/rtl.css` exist.
  `check-tokens.mjs` currently FAILs on type literals in `rtl.css` (font-size / letter-spacing).
  Claim PART VII in `comms/specs/`. Do not put hex outside `tokens.css`.

Coverage FAILs still unclaimed at last check: §2.1, §2.4, §2.5, §3.1, §3.5, PART III,
PART VI, PART VII. §2.0 / §2.7 / §3.6 / PART V / §2.6 / PART I / PART IV already have
spec files.

## Meanwhile

Sweeping status as you land handoffs. Contract disputes go through me as ADRs, not as
quiet edits. M1–M2 (galaxy + drawer) stay the fidelity priority; M4 (SESSIONS) may run
in parallel with M1.
