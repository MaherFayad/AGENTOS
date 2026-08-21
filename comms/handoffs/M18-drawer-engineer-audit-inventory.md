---
agent: drawer-engineer
milestone: M18
spec: §2.3 (map drawer) · §2.6.5 (chart drawer) · rule 1 · rule 9
created: 2026-08-21T18:24
status: ready-for-review
---

# Drawer audit — what works, what is honestly empty, what is inert

User-requested inventory of every control and section the drawer opens, on the live dev
stack, in real Chrome. **Not a build.** Two one-line falsehoods on screen were fixed
(`282cffc`); everything else is filed.

## Observation conditions — state these before believing any line below

Real Chrome via CDP at 1440×900, `--headless=new`, against the running stack
(`127.0.0.1:4321` web, `127.0.0.1:8787` runner, **no API key, no Postgres**), on
**2026-08-21 between 17:57 and 18:19 +03**, at `4e27a3a` (+ my four files after 18:12).
`GET /api/status` observed: `runnerConfigured: false`, `ledger.state: "absent"`,
`tailscale: "unknown"`, `brain 0/20`. Probes are throwaway and live in the session
scratchpad, not in the repo. `fidelity-qa-reviewer` was auditing the same server
concurrently; **the tree did move** — their finding
`comms/inbox/drawer-engineer/20260821-1813-…` landed at 18:13, mid-audit, and is answered.

## The three-way inventory

**Works — a user can do it and see a real result (11):** close ✕ · Esc · scrim click · focus
trap (10 stops, cycles, monochrome `solid 2px rgb(236,236,238)` ring on all ten, verified
with real `Input.dispatchKeyEvent` Tab) · `BREAKS INTO` chips (3, fly to leaf) · `BUILDS ON`
chip (opens the prerequisite) · all frontmatter prose and the ladder with its `Now` badge ·
the generated INPUTS form (url / select / textarea / number / date all render and validate) ·
`All` / `Awaiting review` filters (re-request, honestly) · the chart matrix → `More detail →`
→ right-hand drawer · RTL flip (forced `dir="rtl"`: panel moves x=0 → x=1140, mirrors clean).

**Honestly empty — wired, empty for a named reason (4):** LAST RUNS (needs `DATABASE_URL`) ·
WORK PRODUCTS (needs a run *and* a checked-out repo) · the run console's *"Nothing has come
back from the runner yet"* · provenance `SOURCE UNKNOWN` when neither the doc nor a run says.
**Two of these four announce the wrong reason** — see F4 below.

**Inert — renders but cannot act (18 controls + 4 whole surfaces).** Reason **visible on
screen**: none. Reason **on hover + screen reader only**: 16 (`Take it ↓`, `▶ Run now`,
`Schedule`, 3× autonomy toggle, 3× `Read →`, 3× `Download ⬇`, 3× `▶ Run`). Reason **visible
as text**: 2 (`Approve`, `Request changes` — the pattern the other sixteen should follow).
Reason **in a comment only**: none found. Unreachable surfaces: the SSE console, the
approval Allow/Deny cards, the diff review screen, and the ⏰ Schedule cron editor — all
structurally complete, none reachable by any gesture while `runnerConfigured` is false.

## Findings, by damage to usefulness

- **F1 — 16 of 18 disabled controls hide their reason** (`fidelity-qa-reviewer`'s F2,
  accepted). `title` + `sr-only`: no touch, no glance, and no keyboard either — `title` does
  not open on focus, so a sighted keyboard user gets a ring around a grey pill and no words.
  Converts *"the API key is not set"* into *"this app is broken"*.
- **F2 — `INPUTS` is 1,375px below the `▶ Run now` it feeds**, and `onRun`'s validation
  errors land off-screen with no scroll-into-view. Sections 1–10 are the spec's order and do
  not move; INPUTS is ours and goes under the skill-file card.
- **F3 — FIXED (`282cffc`) — `HOW TO RUN IT` asserted an execution.** *"It also runs itself
  every Monday at 06:00."* while `firedBy` is `'nobody'`, 40px above the card that correctly
  said *"Nothing in this build acts on that yet."* Survived two prior fixes because that
  paragraph exists **only in the chart anatomy** and its own guard suite rendered only the
  map one.
- **F4 — LAST RUNS and WORK PRODUCTS blame the runner for an absent Postgres.** Both say
  *"could not reach the runner"*; the runner answered 503 `metrics_unavailable` /
  `thread_store_unavailable`, and its own hint renders immediately after, contradicting the
  lead-in. **Consequence: the two good empty states have never been on screen.**
  `ApiCallError.code` is the seam and already exists. Mine, not fixed here — the honest fix
  is a branch, and a vaguer true sentence in place of a specific false one is a downgrade
  when the specific true one is one `code` check away.
- **F5 — the autonomy toggle row** is three disabled pills shaped exactly like a working
  segmented control, with no visible reason at all.
- **F6 — copper does not vary with its datum.** `HUMAN-LED` renders the same
  `rgb(224,138,80)` as `FULLY AUTONOMOUS` (observed on `deals/proposal-drafter`), and the
  chart eyebrow spends the same copper on a cluster name. Otherwise **rule 1 is near-perfect**:
  a full computed-style sweep of the map drawer found exactly one non-monochrome value.
- **F7 — the drawer has a 15px unstyled native scrollbar** (`.body` clientWidth 284 vs
  offsetWidth 299) in the middle of glass chrome. `design-system-guardian`'s.
- **F8 — RTL is unreachable from the UI.** `DEFAULT_LOCALE` is fixed in `app/layout.tsx`, so
  §1.4 rests entirely on tests. Forced RTL also mangles `⬇ 1 runnable skill file` by bidi —
  `SkillFileCard`'s strings are uncatalogued English, so that would be real under `ar`.

## Contracts touched

None changed. Consumed: `api-contracts.md` (`ScheduleResponse`, `ApiErrorCode`,
`SseStartData.threadId`), `work-product.md` §4.1/§5.2/§7, `frontmatter-schema.md` `inputs:`.

## Deliberately not done

- **F1, F2, F4, F5 are not fixed.** The brief was inventory with fixes limited to one-line
  falsehoods on screen. F3 and the mailbox reason qualified; these do not — each is a layout
  or branching change, and doing them mid-audit would have put the thing being measured and
  the measurer in the same commit.
- **`strings.ar.ts` not touched.** It faithfully translates the English I changed and now
  diverges. Filed to `rtl-arabic-pdpl-specialist` with the property any replacement must
  keep, plus the mechanism note: **nothing in the repo notices an English value changing
  while its Arabic value does not.** A hash-per-entry would make that a build failure.
- **`blocked` is still a consumer with no producer** — `JobDrawer` never passes
  `threadStates`. Re-confirmed by reading the call site, not assumed from the last handoff.
- **No run was started, so the console, the reconnect (`Last-Event-ID`), the ~2k-line
  windowing and the approval gate remain proved only in vitest.** They have never met a
  live stream. Do not read their green suites as a working feature.
- **No screenshot comparison.** Part VI's 1440px side-by-side still has no reference frames;
  that is Phase 0 and it stays with the user.

## Verification

`vitest run src/drawer` — **257/257 in 25 files**, 18:13 +03. `typecheck` clean.
`schedule-honesty.test.tsx` **falsified**: planting `It also runs itself ${cron}` fails the
new chart case (`right anatomy asserts an execution: /runs itself/i`) with the map case
still green — the surface asymmetry demonstrated, not asserted. `validate:rtl:gate` →
`holding.` `check-tokens` → `scanned at 2026-08-21 18:14 +03:00 · 4e27a3a · 4 uncommitted
under apps/web`, `violations 0`. Both fixed strings then re-observed in real Chrome at
18:14 +03 on `/p/agentos/chart/sales`.

**Two things my instruments got wrong, kept because they are the lesson.** `panel.scrollTop
= 9999` appeared to scroll the parked review screen into view; the panel is
`overflow-y: hidden` and a real wheel gesture cannot reach it — JS can scroll what a user
cannot. And `.focus()` reported `outline: none`; programmatic focus does not match
`:focus-visible`, and real Tab keys draw the ring. I nearly filed both. **A probe that only
a script can perform is not an observation of a user.**

## Next agent

`fidelity-qa-reviewer` — read the answer appended to
`comms/inbox/drawer-engineer/20260821-1813-…` first; F1 and F2 are accepted and sequenced,
and F4/F5/F6 are three findings their audit did not carry.
