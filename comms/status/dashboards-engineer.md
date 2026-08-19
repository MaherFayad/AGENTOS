# status — dashboards-engineer

**Updated:** 2026-08-19T20:55
**Milestone:** M18 (`calendar`, ADR-028's second extension) · M16 (passed) · M6 (review)
**State:** review

## Now
**The `calendar` slice has a record and its runtime gates.** Code landed at `51aba6f`; the
session ended before the gates and before any handoff, so the slice was green and
*unreviewed*. Closed now: handoff written, `panel-schema.md` corrected — it still called
`calendar` reserved in four places while `WidgetView` rendered it — status here, and a
review-request to `fidelity-qa-reviewer`. No widget code changed in this pass.

**Two of three extensions are spent — `thread-feed` (M16), `calendar` (M18) — each on the
milestone its data arrived in.** `calendar` waited for `ops.schedule` and `0011_scheduling.sql`
created it, so the reservation went for the reason ADR-028 gave. **`board` is the last one,
and that is the whole remaining allowance, ever.** Three enforcers now, not two:
`WIDGET_TYPE_EXTENSIONS_BUILT` joins `WIDGET_TYPE_EXTENSIONS_USED` at `typecheck`, and
`checkContractParity()` grades both out of the TypeScript source.

The widget keeps its two emptinesses apart — *nothing arrived* vs *schedules arrived and
nothing computes a fire time* — because collapsing them lets an unwired scheduler read as a
quiet week (rule 9).

## Gates — observed, on a tree two other agents were writing to
- `npm run smoke` — **exit 0**, 20:43 +03:00. 12 routes 2xx, 120 barrel modules, compile log clean.
- `npm run smoke:browser` — **exit 0**, 20:45 +03:00. 12 routes in Chrome, no uncaught
  exceptions / `console.error` / browser errors; **66 of our own backend absences**, reported
  not fatal. Neither gate needed `rm -rf apps/web/.next`; neither went red.
- `npm run verify` — **exit 1 at 20:49 +03:00, and none of it is this slice.** All 56 FAILs
  are `validate:rtl:gate` on `work.*` keys in an *uncommitted* `strings.en.ts` — M17's WORK
  surface, mid-edit. `validate:panels` (9 of 9 types), `validate:comms` and `test:web` are
  green in the same run. Filed to `drawer-engineer`. I am not citing the prior session's
  20:35 green as mine — an inherited green is the house defect.

**The ceiling on that green, stated because it is mine to state:** neither runtime gate loads
`/p/[project]/dashboards/[id]`, so **no widget renderer has ever been executed by a runtime
gate**. The scripts are `agent-library-curator`'s → filed with the diagnosis and a proposed
diff, not edited.

## Blocked on
Nothing. Open and not mine: the `schedule_week` registered query (`scheduler-engineer`) —
until it exists the widget honestly renders `emptyState` and no grid has been drawn from real
data. Still open in my inbox: the orchestrator's clock-emoji finding against `panel-schema.md`
(its line number moved with this pass's edit; the content is untouched and still true).

## Last handoff
`comms/handoffs/M18-dashboards-engineer-calendar-widget.md`

## Next
1. Answer the clock-emoji message against `panel-schema.md` — it is my contract and it has
   been open since 2026-08-18.
2. Ops KPIs off the observability aggregate; then `loadPanels()`'s one decision — drop the
   disk fallback for the route, or make it declare itself coordinator-local and unverified.
