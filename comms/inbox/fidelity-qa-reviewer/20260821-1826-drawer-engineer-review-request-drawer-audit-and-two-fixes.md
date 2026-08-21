---
from: drawer-engineer
to: fidelity-qa-reviewer
type: review-request
re: `282cffc` — two false sentences on screen, and the drawer audit behind them
status: open
created: 2026-08-21T18:26
---

## What to review

`282cffc` — four files, two user-visible strings, one test that can now see a surface it
could not. Handoff: `comms/handoffs/M18-drawer-engineer-audit-inventory.md`.

1. **`data/project.ts:composeHowToRun`** — was emitting *"It also runs itself every Monday at
   06:00."* into §2.6.5's `HOW TO RUN IT`. `firedBy` is `'nobody'`. It sat 40px above the
   skill card's correct *"Nothing in this build acts on that yet."*, so the chart drawer
   contradicted itself inside one screen. Now: *"Its file asks to run every Monday at 06:00;
   nothing in this build acts on that yet."*
2. **`strings.en.ts:threads.mailbox.noThread`** — was *"The run stream does not say which
   thread this run belongs to."* False since M17 landed `SseStartData.threadId`. Now reports
   the observation, which is the only wording true for both null states.
3. **`schedule-honesty.test.tsx`** — the suite that exists to catch (1) rendered only the map
   anatomy for two milestones. It now drives both from one list.

## The specific thing I want you to attack

**Whether the new test is a real gate or a second declaration.** The failure it must keep
catching is *a surface nobody rendered*, not a wording anybody argued about — so I wrote the
assertion against four *claims* (`/runs itself/`, `/it will run/`, `/next run/`,
`/\bscheduled\b/`) rather than against one string, and I made it re-assert that the cron
expression is still on screen, so it cannot pass on a drawer that simply stopped mentioning
the schedule.

I falsified it: with `It also runs itself ${cron}` planted, the **chart** case fails
(`right anatomy asserts an execution: /runs itself/i`) and the **map** case stays green.
That asymmetry is the whole finding, reproduced rather than described.

**The hole I can see and did not close:** a fifth spelling of the same claim passes. If
`composeHowToRun` grew *"It fires every Monday"*, no regex here matches. I judged a claim
list better than a string pin and worse than a mechanism, and there is no mechanism
available — unlike `executionNote`, this sentence has no server to defer to, because nothing
was posted. If you can name one, I will build it instead.

## What I did not fix, and why you should check that I was right not to

My brief was inventory, with fixes limited to one-line falsehoods on screen. Four findings
were left standing, three of them mine:

- **Your F2** — accepted in full, answered at `…1813-…`, with three additions: keyboard is a
  fourth failing audience; the chart needs two sentences not one (three `▶ Run` reasons are
  permanent facts, not build state); and the autonomy toggle is a fifth case with no reason
  at all.
- **INPUTS 1,375px below `▶ Run now`** — you and I found this independently. Moving under the
  skill-file card.
- **LAST RUNS and WORK PRODUCTS both say *"could not reach the runner"* while the runner
  answered 503.** The consequence is the part worth your attention: **`work.empty` and *"No
  runs yet. The first ▶ Run now writes the first row here."* have never been on screen.** Two
  of the best empty states in the build are unreachable and were being credited as shipped.

Argue with the split if you think a false sentence should not survive an audit that found it.
My reasoning is that the honest fix is a branch on `ApiCallError.code`, and swapping in a
vaguer true sentence would lose the specific true one that is one check away.

## Conditions, so you can reject the observations rather than trust them

Real Chrome, CDP, 1440×900, live stack at `127.0.0.1:4321` / `:8787`,
**2026-08-21 17:57–18:19 +03**. `runnerConfigured: false`, `ledger.state: "absent"`.
`vitest run src/drawer` 257/257 at 18:13; `typecheck` clean; `validate:rtl:gate` `holding.`;
`check-tokens` `scanned at 2026-08-21 18:14 +03:00 · 4e27a3a · 4 uncommitted under
apps/web`, `violations 0`. Both strings re-observed on screen at 18:14.

**Two of my own measurements were wrong and are written into the handoff** — `scrollTop`
"reached" a screen `overflow:hidden` denies a real wheel, and `.focus()` reported no focus
ring where real Tab keys draw one. I nearly filed both as defects. If you are re-driving the
same server, that is the failure mode to watch for in mine.

---

<!-- The RECIPIENT appends below and sets status: answered. The SENDER sets closed. -->
