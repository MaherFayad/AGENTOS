# status — drawer-engineer

**Updated:** 2026-08-21T18:22
**Milestone:** M17/M18 closed · user-requested drawer audit (§2.3 + §2.6.5) complete
**State:** review

## Now
**Audit, not a build.** Walked the full §2.3 anatomy and the §2.6.5 mirror in real Chrome
(CDP, 1440×900) against the live dev stack at `127.0.0.1:4321` + `:8787`, **17:57–18:19 +03**.
Inventory delivered to the caller. Two one-line falsehoods on screen found and fixed at
`282cffc`; everything else filed.

- **`composeHowToRun` said *"It also runs itself every Monday at 06:00."*** — the `nextRunAt`
  defect a third time, on the chart drawer, 40px above the card that correctly named the
  absent executor. It survived both earlier fixes because `HOW TO RUN IT` exists only in the
  **chart** anatomy and `schedule-honesty.test.tsx` rendered only the map one. **A `side` prop
  with one value tested is an include-list.** Suite now drives both; plant goes red on chart,
  green on map.
- **`threads.mailbox.noThread` still blamed the run stream** for a `threadId` M17 landed. It
  now reports the observation, which is the only wording true for *both* null states (no run
  started; runner with no thread store). Prop JSDoc carried the same dead claim.
- **`nextRunAt` phantom: closed.** `postSchedule` returns the contract's `ScheduleResponse`;
  `scheduleSentence` takes `Pick<…,'executionNote'>`. No dead field declared anywhere.
- **`blocked`: still unreachable.** `JobDrawer` never passes `threadStates`. Confirmed, not
  assumed.
- Three times an instrument lied and I caught two of them: `scrollTop=9999` "reached" the
  parked review screen (panel is `overflow:hidden`; a real wheel cannot), and `.focus()` read
  `outline: none` (programmatic focus does not match `:focus-visible`; real Tab draws the ring).

## Blocked on
Nothing blocking code. Blocking a *usefulness* verdict: `runnerConfigured: false` and no
ledger mean **the console, the approval cards, the diff review screen and the schedule save
sentence are all structurally complete and unreachable by any user gesture on this stack.**
The only paths a person can exercise today are chips, prose, the ladder, the INPUTS form and
the two roster filters.

## Last handoff
`comms/handoffs/M18-drawer-engineer-audit-inventory.md` — the three-way inventory, the
prioritised judgement, and *Deliberately not done*.

## Next — in order, and the first three are one slice
1. **`fidelity-qa-reviewer` F2** (answered 18:22, accepted): every disabled control's reason
   is hover-and-screen-reader only. 16 of 18 controls on the chart drawer are a wall of grey
   with no words. Render it as text. Chart skill cards need *two* sentences, not one — three
   `▶ Run` reasons are permanent facts, not build state.
2. **Move `INPUTS` under the skill-file card.** 1,375px below the `▶ Run now` it feeds, and
   `onRun`'s field errors land off-screen with no scroll-into-view. 1–10 are the spec's order;
   INPUTS is ours.
3. **The autonomy toggle row** — three disabled pills that look like a segmented control and
   carry no visible reason at all.
4. **LAST RUNS and WORK PRODUCTS stop blaming the runner for an absent Postgres.** Both render
   *"could not reach the runner"* while the runner answered 503 `metrics_unavailable` /
   `thread_store_unavailable`. `ApiCallError.code` is the seam and it already exists. **The
   consequence is that the good empty states — `work.empty`, "No runs yet" — have never been
   on screen.**
5. Remove `work.scopeNote` the day `runner-engineer` lands `agent=`.
