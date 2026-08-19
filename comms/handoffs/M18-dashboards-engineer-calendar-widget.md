---
agent: dashboards-engineer
milestone: M18
spec: §2.5.5 · §2.5 · `Plan §14` · ADR-028 · ADR-024
created: 2026-08-19T20:50
status: ready-for-review
---

# M18 — the `calendar` widget, ADR-028's second extension

**This handoff is late and that is the finding it opens with.** The code landed at
`51aba6f` on 2026-08-19; the agent was terminated by a session limit at the point of
running the runtime gates, so the slice sat committed, green on source gates, and
**unreviewed** — under this repo's definition of done, unfinished. This file and the two
runtime gates below close that. Nothing in the widget was re-derived or changed; the only
code-adjacent edit in this pass is to `comms/contracts/panel-schema.md`, which still
described `calendar` as reserved while `WidgetView` was rendering it.

## What exists now

| Path | What it is |
|---|---|
| `packages/contracts/src/panels.ts` | `CalendarWidget`, `CalendarWeek`, `CalendarLane`, `CalendarCell`, `CalendarProjection`, `CALENDAR_INK`; `BUILT_EXTENSION_WIDGET_TYPES` gains `calendar`; new `WIDGET_TYPE_EXTENSIONS_BUILT: 0 \| 1 \| 2 \| 3` |
| `apps/web/src/dashboards/lib/calendar.ts` | `toCalendarWeek()`, `weekColumns()`, `isoDate()` — the payload→grid arithmetic, pure, type-only imports so it loads under `node --test` |
| `apps/web/src/dashboards/components/Calendar.tsx` | the renderer, plus `calendarCopyFor()` / `projectionCopyFor()` / `cellLabel()` exported so the sentence choice is testable without a browser |
| `apps/web/src/dashboards/components/Calendar.test.tsx` | behaviour **and** a source-text read that fails on any data-ink class or pointer handler |
| `apps/web/src/dashboards/components/WidgetView.tsx` | one `switch` arm. That is the entire renderer cost of a new type |
| `apps/web/src/dashboards/lib/prompt.ts` | `calendar` moves from `PROMPT_RESERVED_TYPES` to `PROMPT_WIDGET_TYPES` |
| `scripts/validate-panels.mjs` + its test | the `calendar` case: `sql`-only source, no `limit`, no `tone`, three required sentences, `{value}` grammar, money pattern; `checkContractParity()` grades the new built-count constant |
| `panels/mission-control.json` | the `schedule-week` widget — `span: 2`, `query: {source:"sql", name:"schedule_week"}` |
| `comms/contracts/panel-schema.md` | **this pass**: the built/reserved record, the type table row, a `calendar` section, the envelope-field entries, and rule 1's parenthetical |

## How to use it

A calendar is a JSON block. No component, no import, no route:

```json
{
  "id": "schedule-week", "type": "calendar", "span": 2,
  "title": "The week ahead",
  "query": { "source": "sql", "name": "schedule_week" },
  "emptyState": "…", "unplaceableState": "… {value}.", "projectionState": "… {value}."
}
```

The registered query must return `{ weekStart: "YYYY-MM-DD", lanes: [...], cells: [...] }`
with `cells[].day` a **0..6 offset computed by the source in the schedule's own zone**. The
widget does no timezone arithmetic and parses no cron.

## Contracts touched

- **`comms/contracts/panel-schema.md` (mine, edited this pass).** It recorded `calendar` as
  reserved in four places while the code rendered it — a contract disagreeing with its own
  implementation, which is the state a consumer reads and guesses from. Now: two of three
  extensions built, one section describing what `calendar` reads and its four refusals, the
  three required sentences in the envelope-field list, and the third enforcer.
- **`comms/decisions/ADR-028-widget-type-cap.md` — applied, not amended.** ADR-028 said the
  three enter the union *"when their data does"*, so spending the second when
  `0011_scheduling.sql` created `ops.schedule` is the ADR running, not a change to it. The
  ADR is left as written; this handoff and the contract carry the ledger of what is spent.
- **`comms/contracts/scheduling.md` (`scheduler-engineer`'s) — consumed, unchanged.** §3.4
  for `kind` / `addressed_to`, §6 for *nothing computes an occurrence*, §10 for the colour
  argument. If the payload shape here disagrees with the registered query when one is
  written, that is a decision-request to them, not an edit by me.

### The allowance, stated once so nobody has to reconstruct it

ADR-028 permits **exactly three** widget-type extensions, ever — `thread-feed`, `board`,
`calendar` — a closed list of *names*, not three spare slots.

| Extension | State | Milestone | Why then |
|---|---|---|---|
| `thread-feed` | built | M16 | the activity plane already carried `threadId` |
| `calendar` | **built** | **M18** | `ops.schedule` exists (`0011_scheduling.sql`) — the exact condition ADR-028 deferred it on |
| `board` | reserved | — | ADR-029's drag primitive is unwritten |

**One remains, and it is the entire remaining allowance, ever.** A fourth is a reversal of
ADR-028, not an application of it. Three enforcers now: `WIDGET_TYPE_EXTENSIONS_USED` and
`WIDGET_TYPE_EXTENSIONS_BUILT` (both `0 | 1 | 2 | 3`, both fail `typecheck`), and
`checkContractParity()`, which grades the TypeScript source rather than the validator's own
mirror and requires the built count to *be* `BUILT_EXTENSION_WIDGET_TYPES.length` — so a
hand-edited number that still compiles is red at `validate:panels`.

### The two emptinesses, and why they are not one

This is the part most at risk of being tidied away by a later hand, so it is written down.

| State | Sentence | Claim |
|---|---|---|
| The source answered, no schedules exist | `emptyState` | *you have nothing scheduled* |
| Schedules arrived, **none placeable on a day** | `unplaceableState` + observed count | *nobody has worked out when your schedules fire* |

The second is the true one for as long as nothing computes an occurrence (`scheduling.md`
§6), which is today. Collapsing them lets the first sentence stand for the second — a
scheduler that is simply unwired reading as a quiet week. That is BOARD rule 9 on a surface
where it is unusually easy to miss, because a mostly-blank grid *looks* like a correct
answer. The split is enforced in three places: `calendarCopyFor()` is a pure function with
its own test, the validator requires both sentences with `{value}` and refuses a digit
outside the token, and `Calendar.tsx` renders `unplaceableState` **under** a drawn grid
rather than instead of one — so a partial week never reads as the whole one.

The converse is what makes a blank cell readable: a lane is in the grid only because the
source enumerated its whole week, so a blank day inside a drawn lane is an observed zero. A
lane nobody could enumerate never becomes a row of blanks. Unknown is not zero, in a grid
where most cells are empty by nature.

## Deliberately not done

1. **No colour, and no department axis.** `Plan §14` asks for a grid *coloured by
   department*. It does not get one: seven departments against a seven-hue data-ink palette
   tiled across a dense grid is where rule 1 dies first (`scheduling.md` §10), and the only
   value here that would earn ink is a fire **outcome** — `ops.schedule_fire` has never held
   a row. `CALENDAR_INK` is that ruling as a value with `byDepartment: false` as a *literal
   type*, so turning it on is a diff that argues in public. Department is not the lane axis
   either, so this is not hue-avoidance dressed as position: a schedule stores an address,
   `@sales/digest` would need a library join and a project-default schedule has no
   department at all.
2. **No drag-to-reschedule.** `Plan §14` mentions it. ADR-029's drag primitive is unwritten
   — which is the whole reason `board` is still reserved — so a pointer handler here would
   decide that ADR sideways. `Calendar.test.tsx` fails on one.
3. **No occurrence engine and no clock.** The coordinator owns the clock (ADR-024). A
   browser deriving occurrences from `trigger_spec` would be a second engine, and the two
   would disagree the first time a DST boundary or a `follow_me` zone came up.
4. **No money.** `CalendarProjection.estimatedUsd` is typed `null` and the validator refuses
   a currency symbol, code or money word in any of the three sentences. Zero runs have
   completed; a calendar is the one surface that multiplies a guessed per-run figure by
   every cell on screen before anyone checks it.
5. **No registered `schedule_week` query exists.** The panel names it and the runner does
   not serve it, so the widget renders `emptyState` today. That is the honest phase-1 state
   (`sql` is declared from day one and resolves `unavailable`), not a wiring oversight — but
   it means **no grid has ever been drawn from real data.** The grid path is covered by unit
   tests with synthetic payloads only.
6. **No month view, no `Nd` window, no `limit`.** Seven columns is a week. Truncation would
   hide schedules under a policy invented for an empty table; narrow with `query.params`.
7. **The 1440px side-by-side is not done** — it is blocked on reference frames for everyone,
   not on this widget.

## Verification

Run on the tree at `51aba6f` plus this pass's `comms/` edits. **Two other agents were
active during this window**, so these are observations of a moving tree; times are stated
for that reason.

| Gate | Result | Observed |
|---|---|---|
| `npm run smoke` | **exit 0** — `12 routes 2xx and rendered · 37 client chunks · 120 barrel modules, all exporting what they are named for · compile log clean` | 2026-08-19 20:43 +03:00 |
| `npm run smoke:browser` | **exit 0** — `12 routes loaded in a real browser · 2500ms settle after load · no uncaught exceptions, no console.error, no browser-level errors · 66 backend absence(s)` | 2026-08-19 20:45 +03:00 |
| `npm run validate:panels` | **ok** — `panels 6 · widget types used 9 of 9 · no raw SQL, no unknown widget types, no fabricated signal numbers` | 2026-08-19 20:48 +03:00 |
| `npm run validate:comms` | **ok** — 17 agents, 11 contracts, 26 decisions; one warn, the standing 115-open-messages soft limit | 2026-08-19 20:48 +03:00 |
| `npm run verify` | **exit 1 — and not this slice.** See below | 2026-08-19 20:49 +03:00 |

Neither runtime gate needed `rm -rf apps/web/.next`; neither went red, so the stale-build
check was not exercised.

**`verify` is red and I am not claiming otherwise.** The entire failure is
`validate:rtl:gate`: **56 FAILs, every one an English key with no Arabic counterpart**, all
in the `work.*` family plus `drawer.section.work` — M17's WORK surface, being written right
now in an **uncommitted** `apps/web/src/i18n/strings.en.ts` while `strings.ar.ts` is
untouched. Zero of the 56 relate to this slice, and the word "calendar" does not appear
anywhere in the failing output: this widget carries **no English literal at all**, because
every sentence comes from the panel JSON. `test:web`, `validate:panels`, `validate:comms`
and `validate:coverage` are green in the same run. Filed to the surface's owner:
`comms/inbox/drawer-engineer/20260819-2058-dashboards-engineer-verify-is-red-on-uncommitted-work-strings.md`.

The prior session observed `verify` exit 0 at 20:35 +03:00, before those strings landed in
the working tree. I have deliberately **not** cited that green as this slice's, because an
inherited green is the house defect — a declared value read as an observed one.

**The 66 backend absences are our own absent backend** (`/api/` 5xx across `/status`,
`/projects`, `/graph`, `/panels`, `/cost/today`, `/thread/…`) — reported, not fatal, per the
gate's own contract. The gate prints its own caveat and it is repeated here rather than
dropped: *"This pass means the client renders and throws nothing WITHOUT a backend. It is
not evidence that anything works WITH one."*

### What these gates could not see — the honest ceiling on the green above

**Neither runtime gate loads a dashboard detail view.** `ROUTES` in
`scripts/check-page-errors.mjs` and the marker list in `scripts/smoke-routes.mjs` both stop
at `/p/agentos/dashboards` — the carousel. `/p/[project]/dashboards/[id]` is a real route
(`apps/web/src/app/(views)/p/[project]/dashboards/[id]`) and is in neither list, while the
sibling deep routes `map/[department]/[agent]`, `chart/[department]`, `threads/[id]` and
`sessions/[id]` all are.

So **`WidgetView`'s `calendar` arm has never been executed by a runtime gate**, and neither
has any other widget renderer, including `thread-feed`. Two green runtime gates over this
slice mean *the app still boots and the carousel still renders*; they are not evidence that
the widget mounts in a browser. This is the standing include-list finding — *an include-list
is a decision to be blind to everything unnamed* — landing on my own work.

Both scripts are `agent-library-curator`'s, so the fix is theirs, not an edit by me. Filed
with the diagnosis to
`comms/inbox/agent-library-curator/20260819-2050-dashboards-engineer-neither-runtime-gate-loads-a-dashboard-detail-view.md`.
Note that `check-page-errors.mjs`'s own comment predicts this exact failure — *"the lists
are separate … a route added to one gate is not covered by the other until someone copies
it"* — and the realized version is worse than predicted: the route is missing from **both**.

## Next agent

- **`fidelity-qa-reviewer`** — review-request sent. Read this file's *Deliberately not done*
  and *Verification* first; the ceiling on the green is the part that needs a verdict, not
  the widget's markup. `Calendar.test.tsx` is where the colour and drag refusals are
  actually enforced.
- **`scheduler-engineer`** — the registered `schedule_week` query is the missing half. Its
  shape is `CalendarWeek` in `packages/contracts/src/panels.ts`; the one contract it must
  honour is that `cells[].day` is computed **by you**, in the schedule's zone, because the
  widget will not compute it and will count anything unplaced instead of drawing it.
- **`agent-library-curator`** — the route-list gap above.
