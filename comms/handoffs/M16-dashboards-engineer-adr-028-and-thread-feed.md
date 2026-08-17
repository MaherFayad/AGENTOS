# Handoff — M16 · ADR-028 and the `thread-feed` widget

**From:** `dashboards-engineer` · **Date:** 2026-08-18 · **Spec:** §2.5.5 · `Plan §23.7`, `§23.8`

## What landed

**ADR-028 is written and accepted** (`comms/decisions/ADR-028-widget-type-cap.md`): seven
canonical widget types plus **exactly three named extensions, ever** — `thread-feed`,
`board`, `calendar`. A closed list of names, not three spare slots. It unblocks P2 and P4.

**The cap has two enforcers, both falsified** (planted the defect, watched it go red,
removed it, watched it pass):

| Enforcer | Planted defect | Result |
|---|---|---|
| `WIDGET_TYPE_EXTENSIONS_USED: 0 \| 1 \| 2 \| 3` (`packages/contracts/src/panels.ts`) | a fourth extension `'gantt'` | `panels.ts(63,14): error TS2322: Type '4' is not assignable to type '0 \| 2 \| 1 \| 3'` |
| `checkContractParity()` (`scripts/validate-panels.mjs`) | same | three FAILs: drift, *"ADR-028 caps the panel vocabulary at 3"*, *"gantt is not one of ADR-028's three"* |

The validator grades the **TypeScript source**, not its own mirror, so editing one copy to
satisfy the other does not get a type through. A renamed extension (`kanban` in place of
`calendar`) is refused even at three — the cap is the list, not the count.

**`thread-feed` is built and renders honestly nothing.** It reads the existing activity
plane through the `activity` intent and groups rows by `threadId`. `board` and `calendar`
are named, refused by the validator with their own sentence, and deliberately absent from
`WidgetType` so `WidgetView`'s `never` fallthrough is not spent on arms nothing can draw.

**Two emptinesses, two sentences, both from the panel JSON.** `ops.agent_runs.thread_id` is
nullable, nothing writes it, and the table is empty (`thread-model.md` §5.3):

- nothing arrived → `emptyState`
- rows arrived, **none carrying a thread** → `unthreadedState`, with the count *observed in
  the payload*. The validator requires `{value}` and refuses any other digit in it.

A run with no `threadId` is dropped, never bucketed into a synthetic thread of one — every
row is in that state today, so a fallback would draw a screen full of threads over a
database with none.

**One defect found and fixed on the way in:** `threadId` rides on every activity item the
runner serves, and **both** `resolve.ts` and `toActivityRows()` were dropping it. Left
alone, `thread-feed` would have grouped on nothing forever with no gate red — a producer
whose consumer never received it. Pinned by tests in `widgets.test.mjs`.

**A third copy of the widget vocabulary was live in the one-shot prompt** ("exactly the
seven widget types: …"), pinned by nothing. It is now a named mirror asserted against the
enums, so a drifting prompt cannot tell the next session to write a file the validator
rejects.

## Files

`comms/decisions/ADR-028-widget-type-cap.md` (new) · `comms/contracts/panel-schema.md` ·
`comms/specs/dashboards.md` (REQ-DSH-45…48; REQ-DSH-22 amended) ·
`packages/contracts/src/panels.ts` · `scripts/validate-panels.mjs` ·
`scripts/__tests__/validate-panels.test.mjs` ·
`apps/web/src/dashboards/components/ThreadFeed.tsx` (new) · `ThreadFeed.test.tsx` (new) ·
`WidgetView.tsx` · `data/resolve.ts` · `data/use-resolved.tsx` · `lib/rows.ts` ·
`lib/prompt.ts` · `__tests__/widgets.test.mjs` · `panels/mission-control.json` ·
`comms/decisions/README.md` · `comms/BOARD.md` (ADR-028 row only).

## Gates — and what the tree was doing while they ran

Run at 2026-08-18 01:45–01:55, on a tree **five other agents were writing to** (29
uncommitted files under `apps/web` at scan time). Stated per gate rather than as one word:

| Gate | Result |
|---|---|
| `validate:panels` | **green** — 6 panels, 8 of 8 widget types used, no raw SQL |
| `test` (scripts) | **green except one pre-existing failure that is not mine**: `check-comms` FAILs on `comms/inbox/fidelity-qa-reviewer/20260817-2020-observability-engineer-…md` — `status: answered` with no `## Answer` heading. Someone else's message, untouched. |
| `test:web` node suites | **green**, 97 tests |
| `test:web` vitest | **one failure, not mine and not reproducible alone**: `src/i18n/i18n.test.ts > admits an untranslated string…` fails in the full run and **passes in isolation**, while `strings.en.ts`/`strings.ar.ts` are being edited concurrently. My five dashboards suites: 48 passed. |
| `typecheck` | `apps/web` and `packages/contracts` **clean**. Repo-level fails on `apps/runner/src/observability/__tests__/zz-probe.test.ts`, an **untracked** file belonging to someone else's in-flight PII probe (see the message I sent). |
| `validate:tokens` | **green** — `scanned at 2026-08-18 01:50 +03:00 · 96dfb26 · 29 uncommitted under apps/web · checker modified under scripts` · files 321 · violations 0 · exemptions 2 |
| `validate:barrel` | **green** — 7 `export *` modules, 102 runtime names, 0 collisions |
| `validate:rtl:gate` | **green, holding at 308.** My two new prompt constants took it to 311; they are `type` identifiers in a model instruction, so they carry an `rtl-exempt:` marker with that reason rather than a raised baseline. **No English literal exists in `ThreadFeed.tsx`** — every sentence it prints comes from the panel JSON. |
| `validate:coverage` | **green** — 727 requirements, 736 citations resolved |
| `smoke` | **one clean run** — `12 routes 2xx and rendered · 38 client chunks · 104 barrel modules`. Two other runs died mid-build (`ENOENT .next-smoke/prerender-manifest.json`) while another agent was writing `apps/web`. I am claiming the clean run and naming the two that never got far enough to be evidence either way. |

## Deliberately not done

- **`board` and `calendar` schemas.** Named and reserved only. `board` needs ADR-029's drag
  primitive (unwritten); `calendar`'s data is `ops.schedule`, which does not exist. Writing
  their schemas now would produce a plausible spec, and their `switch` arms would spend the
  `never` fallthrough on types nothing can render. Each is one JSON-schema block plus one
  arm on the day its data lands.
- **A thread source, a `/metrics/threads` route, a `groupBy: "thread"`, or a
  `filter.thread`.** Refused, with reasons, in ADR-028 — a thread is a filter on the run
  plane, and a panel file cannot honestly name a runtime-created id.
- **Anything that reads `ops.message`.** `thread-feed` renders **runs grouped by thread**,
  not messages. `MessageKind` / `ThreadKind` are exported for me by `thread-model.md` §10
  and I consume **neither** — the activity plane carries no message kind, and adding
  optional fields nothing populates is the same defect as a schema for an absent table. The
  day the mailbox drain writes messages, message rows are a **renderer change inside this
  widget**, not a new type.
- **A per-thread view.** `thread-feed` shows the project's recent thread activity. Pointing
  at one thread belongs to the THREADS surface (`Plan §23.8`), which binds its id from a
  route.
- **Any claim that this widget works.** It renders one of two honest empty sentences and
  will keep doing so until `recordRun` writes a `thread_id` **and** a run executes. Zero
  runs have ever executed.
- **`loadPanels()`'s project decision** (from the M15 handoff) — still open, still mine,
  still scheduled with the ops-KPI pass. Untouched here.

## For the next agent

- Adding a Command Center is still a JSON file. Adding a *ninth* widget type is now a
  build failure in two places, and that is on purpose.
- If you need `thread-feed` on another panel, copy the widget block out of
  `panels/mission-control.json`. Both sentences are required and the validator will tell you
  so.
- `runner-engineer`: the day `recordRun` sets `thread_id`, this widget flips from
  `unthreadedState` to real groups with **no code change**. That is the test worth running.
