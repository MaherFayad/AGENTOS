# status — dashboards-engineer

**Updated:** 2026-08-18T02:00
**Milestone:** M16 (ADR-028 · `thread-feed`) · M6 (review) · M15 (passed)
**State:** review

## Now
**ADR-028 is written and accepted; P2 and P4 are unblocked.** Seven canonical widget types
plus **exactly three named extensions, ever** — `thread-feed`, `board`, `calendar` — a closed
list of names, not three spare slots. **The cap can fail a build in two places**, both
falsified with a planted `gantt`: `WIDGET_TYPE_EXTENSIONS_USED: 0|1|2|3` stops `typecheck`
(`Type '4' is not assignable`), and the validator's parity gate — which grades `panels.ts`,
not its own mirror — prints three FAILs. A renamed extension is refused even at three.

`thread-feed` is built: the existing activity plane grouped by `threadId`, no new
`query.source`, no thread id in a panel file, no derived title (§9.6). `board` and `calendar`
are named, refused by the validator with their own sentence, and kept out of `WidgetType` so
`WidgetView`'s `never` fallthrough is not spent on arms nothing can draw.

## Finding — a producer whose consumer never received it
`threadId` rides on every activity item the runner serves, and **both `resolve.ts` and
`toActivityRows()` were dropping it**. `thread-feed` would have grouped on nothing forever
with nothing red. Fixed and pinned. Separately, the one-shot build prompt held a **third**
copy of the widget vocabulary ("exactly the seven widget types: …") pinned by nothing; it is
now a mirror asserted against the enums.

## Honest state of the widget
It renders one of two sentences and cannot render anything else today: *nothing arrived*
(`emptyState`) or *rows arrived, none carrying a thread* (`unthreadedState`, with the count
**observed** in the payload). `ops.agent_runs.thread_id` is nullable, nothing writes it, and
zero runs have executed. Unthreaded rows are dropped, never bucketed into a thread of one.

## Blocked on
Nothing. Observed on someone else's files while gating a tree five agents were writing to —
both reported, neither mine to fix:
- `apps/runner/src/observability/__tests__/zz-probe.test.ts` (untracked) breaks repo-level
  `typecheck` → messaged `observability-engineer`.
- `check-comms` FAILs on a `fidelity-qa-reviewer` inbox message with `status: answered` and no
  `## Answer`; `i18n.test.ts` fails only in a full vitest run while the catalogues are being
  edited concurrently.
- M3 / `RUNNER_ANTHROPIC_API_KEY` (the user's) — widgets stay honestly empty until then.

## Last handoff
`comms/handoffs/M16-dashboards-engineer-adr-028-and-thread-feed.md`

## Next
1. Ops KPIs off the observability aggregate — with `ledger.state` on 200 and the project half
   of the receipt check, both still owed.
2. `loadPanels()`'s one decision: drop the disk fallback for the route, or make it declare
   itself coordinator-local and unverified.
