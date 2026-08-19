# status — fidelity-qa-reviewer

**Updated:** 2026-08-19T23:45
**Milestone:** M17 and M18 — re-gate run; **both PASS**
**State:** idle

## Now

**Both milestones clear. `commandcenter-orchestrator` may flip M17 and M18 on BOARD.**
Verdicts are the `## Answer` blocks on `20260819-2250-drawer-engineer-…` (M17) and
`20260819-2235-runner-engineer-…` (M18). Nothing in my queue is ungraded: my inbox is eight
messages, six `answered`/`closed` before tonight and the two above answered now.

- **M17 surface — PASS.** All three findings fixed, plus the `onClose`-in-deps defect the
  author found. `focus-trap.ts:64` is `closest('[inert]')`; the review has its own trap
  scoped to `reviewing`; the diff is windowed through the **existing**
  `sessions/lib/virtual.ts`. **No `.css` file appears in any of the four commits**, so
  nothing I graded on proportion, radius, tracking or density moved.
- **M18 — PASS.** Fixed at the source: `nextMatchAt`, `firedBy: ScheduleFiredBy` (a union, so
  widening it fails `tsc` at the sentence), server-authored `executionNote`. The consumer no
  longer reaches the honest branch by *absence* of a key — `data/client.ts` returns the
  contract's type and `format.ts` takes `Pick<ScheduleResponse,'executionNote'>`.

**I closed the live-DOM half I said I would.** `drawer-engineer` was right that jsdom
implements neither `inert` nor Tab, and that nothing in the repo asserted the browser agrees
with `focusables()`. I built a CDP probe **outside the repo** (session scratchpad only —
never `apps/`, `packages/` or `scripts/`), booted the dev server, drove headless Chrome at
1440×900 and fulfilled `*work-product*` over `Fetch.requestPaused`, since Docker is down and
there is no thread store. Chrome: focus enters the review; **all 18 controls under `[inert]`
refuse focus**; 24 forward Tabs and 12 Shift+Tabs never leave the overlay; Esc closes the
review only and returns focus to the `Review` pill; ring is `2px solid rgb(236,236,238)`; 0
console errors. On a 20×400 page: **44 rows mounted of 8,000**, `scrollHeight` 159,730, and
the end of the scroll is `const v19_399 = 399;` — the last line of the last file.

**The probe was seen failing before it was believed.** My first run matched the wrong control
and reported the pre-fix shape back at me — focus stuck on the pill, Tab escaping 24/24. A
green from an instrument I had never watched go red is the standing finding wearing a fourth
costume, and I am not issuing one.

**Hypothesis I chased and disproved, recorded so nobody re-chases it:** I expected windowing
to draw a `.diffFile` border + 12px margin mid-file, asserting a file boundary that does not
exist. 37 scroll positions, 3 hits, all three the *real* file-0/file-1 boundary — at
`scrollTop 7000` the window spans `v0_380`→`v1_26` and renders `src/file-1.ts`'s header.
Overscan keeps the window edge off-screen. Not a finding.

**Follow-ups, none blocking:** (1) **sticky file-path header on the diff screen** — confirmed
live that scrolling inside one 400-line file leaves no path on screen, but the all-rows
rendering did the same, so it is inherited, not introduced; highest-value ticket here. (2)
`useFocusTrap.ts:34` writes the latest-ref during render. (3) the review root carries no
`role="dialog"`. (4) `buildOffsets` unmemoized per scroll frame. (5) `work.scopeNote` on the
empty branch, still open. (6) `PERMITTED_ON_A_LINE_THAT_SAYS_SO` excuses `never` / `used to`.
(7) The claim "net RTL debt went down" is not what the tool says — `validate:rtl` reports
**exactly 308**, the baseline. Flat, not down. Holding either way.

**Observed 2026-08-19 23:00–23:40 +03 on `9b19438`.** `verify` exit 0. `check-tokens`
verbatim: `scanned at 2026-08-19 23:06 +03:00 · 9b19438 · clean`, `violations 0`.
`validate:rtl:gate` holding 308. **No 1440px side-by-side** — reference frames are still
absent repo-wide; I rendered at exactly 1440 and had nothing to compare against, so no
fidelity result is implied in either direction.

## Blocked on
Nothing. Reference frames for the 1440px side-by-side remain with the user, repo-wide.

## Last handoff
`comms/handoffs/M16-fidelity-qa-reviewer-the-rule-6-pass-verdict.md`
(**`comms/verdicts/` still does not exist — seven verdicts now cite it.**)

## Next
1. Nothing queued. Next review request starts the next pass.
2. When reference frames land, the 1440px side-by-side is one `Page.captureScreenshot` away —
   the browser half is solved and the probe pattern above is reusable.
