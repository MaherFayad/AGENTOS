# status — fidelity-qa-reviewer

**Updated:** 2026-08-21T18:16 +03:00
**Milestone:** none — a user-requested **frontend audit**, not a gate
**State:** idle

## Now

**No verdict issued and none was asked for.** The user asked whether the frontend covers
what the panel opens, whether it is well designed and structured, and whether it is useful.
The report is `comms/audits/20260821-frontend-audit-works-empty-inert.md`.

Method: headless Chrome at exactly 1440×900 over CDP against the stack the user was already
running (`127.0.0.1:4321` + runner `:8787`, no key, no Postgres). The probe stayed in the
session scratchpad — never `apps/`, `packages/` or `scripts/`. Thirteen routes plus every
drawer section, both drawer flavours, reduced motion, RTL and four not-found paths.

**The 1440px side-by-side was again not performed. The reference frames still do not exist.**
I measured against the spec's *written* numbers — every one matched — and said in the report
that this is conformance to the text, not fidelity to the video.

## The three-way inventory, in one line each

- **Works:** both MAP views, both drawers, CHART matrix + expand + detail drawer, the
  carousel and detail, the four-tab shell, reduced motion (canvas verified still by pixel
  comparison), RTL mirroring, and search — **for the 12 real agents only**.
- **Honestly empty:** every ledger-, Langfuse-, thread- and run-backed surface, each naming
  what would fill it. This is the build's best quality and it holds on every route.
- **Inert:** `▶ Run now`, `⏰ Schedule`, `Take it ↓`, 16 of 18 chart-drawer controls, the
  Build guide, and the whole Arabic/RTL half (`layout.tsx:32`, M8, reason in a comment).

## Filed, with diagnosis, to owners — none fixed by me

| # | Finding | Owner |
|---|---|---|
| F1 | Search dead-ends on **48 of 60** nodes; `useSearchIndex.ts` drops the `kind` the graph sends | `shell-navigation-engineer` |
| F2 | Every disabled control's reason is `title`/`sr-only` only — invisible to sighted and touch users; 16 at once in the chart drawer. Plus `INPUTS` 1,375px below the button it feeds | `drawer-engineer` |
| F3 | `⌨ Build guide` is a silent no-op off `localhost` (secure-context + empty `catch`); Mission Control states one fact 13× | `dashboards-engineer` |
| F6 | House focus ring measures **1.60:1** on `--bg`; no global `:focus-visible`; two map elements fall through to the UA ring. **`cc-fidelity-check` §5 blesses the failing token** — sent as a `decision-request` | `design-system-guardian` |

F4, F5, F7–F10 and the minors are in the audit file, unassigned — they are single-line
judgement calls the orchestrator should route or drop.

## Next

Nothing queued. Inbox is empty of open mail. Available for the M17/M18 follow-ups or for the
1440px comparison the day the frames land — `Page.captureScreenshot` is one CDP call away
and I have the harness.
