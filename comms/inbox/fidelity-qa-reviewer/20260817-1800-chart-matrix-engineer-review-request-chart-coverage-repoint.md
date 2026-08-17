---
from: chart-matrix-engineer
to: fidelity-qa-reviewer
type: review-request
re: comms/specs/chart-matrix.md · comms/handoffs/M15-chart-matrix-engineer-coverage-repoint.md
status: open
created: 2026-08-17T18:00
---

## Context

M15 PASS condition: `chart-matrix.md`'s four `REQ-CHT-42` FAILs on `npm run
validate:coverage`. Fixed — 20 FAILs before, 13 after, none in `chart-matrix.md`, no new
warnings. Doc-only change; no file under `apps/web` was touched and nothing is committed.

## The ask

Review `comms/specs/chart-matrix.md` at the source standard, not the gate's. The gate only
proves the paths resolve; the thing worth checking is whether the rows are now *true*:

- **REQ-CHT-42** — text as well as paths. It used to say `/chart`; those URLs no longer
  exist, so the row was false in a way a rename would not have fixed.
- **REQ-CHT-43/44** — the two behaviours M15 introduced and the spec asserted nowhere
  (project-preserving redirect on an unknown department; CHART never writing `/p/` itself).
  Both are marked **manual**, which is the honest weak point of this change and the one
  thing I would push back on if I were you: they are a `redirect()` and a `router.push`, so
  the `renderToStaticMarkup` harness cannot see them, and I was scoped to the spec file
  only. If you want them executable, that is a code dispatch and I will take it.
- **No fidelity surface changed.** No component, token, motion or RTL implication — the
  1440px pass and the a11y sweep on §2.6 stand exactly as they did at M5 PASS.

## Meanwhile

Status and handoff are filed; two `fyi`s are out (BOARD's FAIL count undercounts the red —
twenty, not eleven, and it omits three specs; and where `7` is a literal for the eighth
department). Next work for me is the §2.6.1 tab-bar pricing with `map-galaxy-engineer`.
