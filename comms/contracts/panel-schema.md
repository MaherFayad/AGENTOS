# CONTRACT — `panels/*.json` dashboard definitions

**Owner:** `dashboards-engineer` · **Source:** spec §2.4–2.5 · **Status:** draft

Dashboards are **data, not code**. One JSON file per Command Center. Adding a dashboard
must never mean writing a component. The seven canonical widget types below cover every
widget observed in their video; **ADR-028** adds exactly three named extensions and closes
the list — see *The cap* below before reaching for an eleventh.

## Envelope

```jsonc
{
  "id": "hubspot-sales-pipeline",
  "title": "HubSpot · Sales Pipeline",       // 26px/700 title row
  "caption": "Every deal, every stall, one screen",
  "railTitle": "SALES PIPELINE",              // rotated edge rail label (§2.5.6)
  "provider": "hubspot",                      // glyph key
  "order": 2,                                 // carousel position
  "buildPrompt": "…",                         // ⌨ "Build guide + one-shot prompt" (§2.5.1)
  "filters": { "type": "segmented", "options": ["All","Stalled","Closing ≤30d"] },
  "kpis": [ … ], "signals": [ … ], "widgets": [ … ]
}
```

## Query object — every data-bearing element carries one

```jsonc
"query": {
  "source": "langfuse" | "sql" | "static",
  // langfuse: metric over agent runs
  "metric": "runs" | "cost" | "latency_p50" | "error_rate",
  "filter": { "agent": "account-enrichment", "department": "sales" },
  "range": "7d",
  // sql: named, parameterized, read-only. NEVER inline user-controlled SQL.
  "name": "pipeline_by_stage", "params": { "days": 30 },
  // static: literal value for scaffolding before the data exists
  "value": 44500
}
```

Phase 1 ships `langfuse` + `static` only (§2.5 data source note). `sql` queries are
registered by name in the runner; the panel references the name. **A panel file can
never contain raw SQL.**

### Where a `langfuse` query actually goes (§3.5)

`source: "langfuse"` means "an aggregate over the agent-run ledger". It is answered by
`/api/metrics/*` — **never** by `GET /api/runs`, which is the runner's in-memory,
process-local view and is empty after every restart. The mapping lives in
`apps/web/src/dashboards/data/endpoints.ts`:

**Every one of these is under `/api/p/:project`** (ADR-015 Q1, `Plan §10`). The prefix is
written once, as `PROJECT_ROUTE_PREFIX` in `packages/contracts`, and filled by that
package's `projectPath`; the table below shows the suffix.

| query | endpoint, under `/api/p/:project` |
|---|---|
| `shape` absent / `scalar` (+ `compare`) | `GET /metrics/query?metric=&range=[&agent=&department=]` — `value`, `previous`, `delta` |
| `shape: "list"` on an `activity-feed` | `GET /metrics/activity?limit=[&department=]` |
| `shape: "list"`, no `groupBy` | `GET /metrics/runs?limit=[&agent=]` |
| `metric: "runs", shape: "series", groupBy: "day"` | `GET /metrics/sql/runs_per_day?days=` |
| `metric: "cost", shape: "list", groupBy: "agent"` | `GET /metrics/sql/cost_by_agent?days=` |
| `metric: "runs", shape: "list", groupBy: "department"` | one `metrics/query` per ADR-001 department + the ungrouped total |

`range` must be one of the runner's windows — `24h 7d 14d 28d 30d 90d`; `Nw` is mapped to
days, anything else is refused rather than approximated.

**A query with no project builds no URL.** `planLangfuse` returns `unsupported` and the
widget prints *"This address does not name a project…"*. There is deliberately no fallback
to the pre-project spelling: those paths are still mounted and answer **400
`project_scope_missing`** so a stale client gets a named refusal (`LEGACY_UNSCOPED_PATHS`),
and calling one on purpose would turn that deliberate 400 into a shrug. There is no default
project to substitute (ADR-015 Q2).

> **Written after the fact it cost, 2026-08-17.** This table held the unscoped paths, and
> `endpoints.ts` held them as string literals, for the whole of M15. Every widget on every
> Command Center was reading from a route that refuses. Nothing went red: `use-resolved.tsx`
> classified the 400 as "cannot reach the runner", so six dashboards rendered `unavailable`
> under a sentence blaming the tailnet for a fault that was one line of client code.
> **No number was faked and no zero was drawn** — the resolver's gate withholds every shape
> before it reads a body, so BOARD rule 9 held — but the *diagnosis* was wrong, which is its
> own kind of untrue. The literals are gone (`data/endpoints.test.ts` asserts the built URLs
> against the contract and against each pre-M15 spelling by name), and a 4xx no longer
> inherits the offline sentence.

**Not served yet, and therefore `unavailable` rather than derived** (filed with
`observability-engineer`): a series of any metric except `runs`, a `groupBy: "agent"` of
any metric except `cost`, `groupBy: "model"` (a run row has no model), and any
`filter: {status}`. The runner *computes* the first two — `metricSeries()` /
`metricBreakdown()` in `db/queries.ts` — but `routes/metrics.ts` does not expose them.

**The receipt rule.** `/api/metrics/query` echoes the `filter` it applied. A filter the
route silently ignored would come back as a correct *unfiltered* aggregate under a
filtered label, so the echo is checked and a missing one withholds the figure. Keep
echoing `filter`; consumers treat it as the receipt.

### Zero is a number; null is not

`runs` returns `0` from a real `count(*)`; `cost`, `latency_p50` and `error_rate` return
`null` over an empty window. **These render differently and must never be collapsed**:
`0` is a numeral, `null` is "No figure yet." The median latency of zero runs is not a
measurement (Part VII.3). `delta` is `null` whenever there is no honest comparison; the
▲/▼ chip uses the server's `delta`, never a locally computed one.

A `cost` figure standing over unpriced runs is a floor, not a total — `unpricedRuns` is
appended to the KPI caption ("10 of 121 unpriced") rather than rounded to nothing.

## KPI tile (§2.5.3)

```jsonc
{ "label": "Pipeline value", "icon": "wallet", "format": "currency",
  "query": {…}, "delta": { "query": {…}, "goodDirection": "up" },
  "caption": "vs previous 28d", "sparkline": { "query": {…}, "tone": "teal" } }
```
Renders: 11px `--ink-2` icon+label → 30px/600 tabular numeral → delta chip
(▲ `--ink-teal` / ▼ `--ink-coral`, sign flipped when `goodDirection: "down"`) →
11px caption → 40×16 sparkline. Numerals count up 300ms on mount.

## Signal (§2.5.4)

```jsonc
{ "tone": "warn" | "ok" | "wait", "lead": "$44,500 stalled across 2 deals",
  "detail": "oldest untouched 33d. Reactivation drafts ready.", "query": {…} }
```
Icon ⚠ amber / ✓ teal / ⏰ ivory + bold lead + `--ink-2` continuation. 2–4 per dashboard.

## The cap, and the three extensions (ADR-028)

**Seven canonical types, plus exactly three named extensions, ever.** The three are
`thread-feed`, `board`, `calendar` — a closed list of *names*, not a budget of three spare
slots. Everything else composes (`Plan §23.7`): an agent roster is a `data-table`, budget
burn is a `progress-table`, a question queue is an `activity-feed`. A fourth type is a
**reversal** of ADR-028, not an application of it.

The rule names its enforcers, because one that names none enforces nothing:

| Enforcer | Fails on | Gate |
|---|---|---|
| `WIDGET_TYPE_EXTENSIONS_USED: 0 \| 1 \| 2 \| 3` in `packages/contracts/src/panels.ts` | a fourth entry — `4` is unassignable | `npm run typecheck` |
| `checkContractParity()` in `scripts/validate-panels.mjs` | a fourth entry, **or** a name outside the three | `npm run validate:panels` · `npm run test` |

The second reads the TypeScript source rather than its own mirror, so editing one copy to
satisfy the other does not get a type through. Both were falsified before being claimed:
the fourth type was planted, `tsc` reported `Type '4' is not assignable to type
'0 | 1 | 2 | 3'` and the validator printed three FAILs; removing it returned both to green.

**Built vs reserved — two of three are spent.** `thread-feed` (M16) and `calendar` (M18)
have a schema and a renderer. Each was built on the milestone its data arrived in, which is
the whole discipline: ADR-028 deferred `calendar` because it reads `ops.schedule` and *"a
schema written against an absent table is a plausible spec"*, and M18's
`0011_scheduling.sql` created that table, so the reservation was spent **for the reason the
ADR gave** rather than early. **One extension remains — `board` — and that is the entire
remaining allowance, ever.** It needs ADR-029's drag primitive, which is unwritten.

`board` is therefore **named and refused**: the validator rejects a panel declaring it with
a sentence naming ADR-028, and it stays out of `WidgetType`, so `WidgetView`'s exhaustive
`switch` is never asked for an arm that nothing can render — the compiler naming every
render site is the safety property, and an unrenderable arm spends it early.

A third enforcer arrived with the second extension: `WIDGET_TYPE_EXTENSIONS_BUILT:
0 | 1 | 2 | 3` in `panels.ts` is the same instrument aimed one step in, so a fourth *built*
extension is unassignable even if someone widened `EXTENSION_WIDGET_TYPES` and its budget
in one edit. `checkContractParity()` reads that constant out of the TypeScript source and
requires it to be `BUILT_EXTENSION_WIDGET_TYPES.length`, so a hand-edited count that still
compiles is red at `validate:panels`.

## The seven widget types, plus `thread-feed` and `calendar`

| `type` | Shape | Notes |
|---|---|---|
| `bar-list` | `{rows:[{label,value}], tone:"coral", valueAlign:"right"}` | Pipeline by stage |
| `source-bar-list` | same, `tone:"grey"`, `format:"currency"` | spend by source |
| `area-chart` | `{series:[{t,v}], tone:"coral"\|"lavender", annotations:[{t,label}]}` | 20% fill under stroke, spike annotations on hover |
| `cost-table` | `{rows:[{label, sub?, value}], total?}` | right-rail values |
| `data-table` | `{columns:[{key,label,type:"text"\|"chip"\|"number"}], rows:[…], sortable:true, rowAction:"peek"}` | chip column: ✓ teal outline, `! Stalled` coral, `⏱` neutral |
| `progress-table` | `{rows:[{label, phase, progress:0..1, status:"on-track"\|"at-risk"}]}` | teal track, status chip |
| `activity-feed` | `{query:{source:"langfuse"}, limit:12}` | `09:41 Meeting transcript processed · 4 action items assigned — Follow-Up Coordinator` — bold event + `--ink-2` attribution |
| `thread-feed` | `{query:{source:"langfuse", metric:"runs", shape:"list"}, limit:12, emptyState, unthreadedState}` | ADR-028. The activity feed's rows **grouped by `threadId`**, newest thread first; group header is a truncated id |
| `calendar` | `{query:{source:"sql", name}, emptyState, unplaceableState, projectionState}` | ADR-028. A **week grid of what will run** — seven columns, one lane per `ops.schedule` row. No `limit`, no `tone`, no colour, no drag |

Grid: 2 columns, 16px gap. A widget declares `span: 1 | 2`.

### `thread-feed` — what it reads, and the three things it refuses to do

*"A thread is the unit. A run is a thread with an agent on the other end"* (`Plan §12`).
The grouping is the widget: no arrangement of the canonical seven can group, which is why
this is a type rather than a composition.

1. **No new `query.source`, no `/metrics/threads`.** A thread is a *filter on the run
   plane*, not a plane — ADR-023 kept one run, one trace. `thread-feed` uses the existing
   `activity` intent (`GET /metrics/activity`) and groups the rows it receives.
   `threadId` rides on every activity item already (`observability-engineer`, 2026-08-17); a
   rollup route would be a second way to compute `runs` and `cost`.
2. **No `filter.thread`, and no thread id in a panel file.** A thread id is created at
   runtime; baking a uuid into `panels/*.json` is the defect class the `footer.cta.href`
   rule already forbids — a second copy of a runtime identity, and the copy goes stale. A
   per-thread view binds its id from a route, and that is the THREADS surface (`Plan §23.8`).
3. **No derived title.** A thread carries none (`thread-model.md` §9.6 — *no, not in M16*),
   and composing one from a message body would put `ops.message.body`, the highest-PII value
   in the database (§7.1), into a dashboard payload. The header is `shortThreadId()`, with
   the whole id in `title`.

**Both empty sentences are required, and they are different claims.**
`ops.agent_runs.thread_id` is nullable, nothing writes it, and the table is empty
(`thread-model.md` §5.3), so this widget renders one of these today and the reader is
entitled to know which:

| State | Sentence |
|---|---|
| The source answered with nothing | `emptyState` |
| Rows arrived, **none carrying a thread** | `unthreadedState`, with the count observed in the payload |

`unthreadedState` must contain `{value}` — the same substitution grammar a signal's `lead`
uses — and a digit anywhere outside that token is refused as a fabricated number. Phrase it
so any count reads correctly (`… belong to no thread: {value}.`): a panel file has no
plural mechanism, and `1 runs` makes a real reading look like a placeholder.

A row with no `threadId` is **dropped, never bucketed into a synthetic thread of one**.
Every row is in that state today, so a fallback would draw a screen full of threads over a
database with none.

### `calendar` — what it reads, and the four things it refuses to do

*"A week grid of what will run"* (`Plan §14`). A week of **future** occurrences is the one
thing no arrangement of the canonical seven can draw: every one of them reports something
that has already happened. That is why it is a type rather than a composition.

1. **Its `query.source` must be `sql`, and the validator refuses any other.** `langfuse` is
   an aggregate over the agent-run ledger (§3.5) and a run is a thing that *ran*; a schedule
   is a thing that has not. Reading a future off the past plane is the wrong table dressed
   as the right number. The registered query name is the runner's — **a panel never carries
   SQL**.
2. **No colour, and the ruling is a value not a paragraph.** `Plan §14` asks for a grid
   *coloured by department*; `CALENDAR_INK` in `packages/contracts/src/panels.ts` rules that
   it does not get one. Chrome is monochrome and colour is data ink (§1.3); seven
   departments against a seven-hue palette, tiled across a dense grid, is where that rule
   dies first (`scheduling.md` §10). Department is not the lane axis either — a schedule
   stores `kind` / `addressed_to` (`scheduling.md` §3.4), `@sales/digest` would need a
   library join and a project-default schedule has no department at all, and two thirds of a
   lane axis is not a lane axis. Department is a **filter on the query**, which is selection
   rather than decoration. One hue is reserved for a fire *outcome* and is off, because
   `ops.schedule_fire` has never held a row. `widget.tone` is refused at validation, and
   `Calendar.test.tsx` reads the component's source and fails on any data-ink class.
3. **No drag-to-reschedule.** `Plan §14` mentions it; ADR-029's drag primitive is unwritten,
   which is exactly why `board` is still reserved. A pointer handler here would decide that
   ADR by accident, so the suite fails on one.
4. **No occurrence arithmetic and no clock.** Nothing in this repo computes a fire time
   (`scheduling.md` §6) and the coordinator owns the clock (ADR-024). A lane arrives with
   its days already placed — `day` is a 0..6 offset from `weekStart`, computed by the source
   in the schedule's own zone — or it does not arrive placed at all. A browser that derived
   occurrences from `trigger_spec` would be a second occurrence engine, and the two would
   disagree the first time a DST boundary or a `follow_me` zone came up (the argument
   ADR-023 used to keep one run and one trace). Column headers are formatted in UTC, which
   is not a timezone claim: they are calendar dates and the widget prints no clock time
   anywhere.

Also absent by construction: **`limit`**. Every lane the source returns is drawn, because a
truncation rule silently hides schedules and *"which schedules are worth showing"* is a
policy invented for a table that has never held a row. Narrow with `query.params`, in data.

**Three sentences, three different claims, and the middle one is the true one today.**
`ops.schedule` has never held a row, no `source: 'library'` row is even *writable*
(`AgentFrontmatter.schedule` is a bare cron that cannot satisfy the mandatory policy
columns — ADR-024), and nothing computes an occurrence:

| State | Sentence |
|---|---|
| The source answered and there are no schedules at all | `emptyState` |
| Schedules arrived, **none placeable on a day** | `unplaceableState`, with the count observed in the payload |
| A grid was drawn | `projectionState`, annotating it with an occurrence count |

`unplaceableState` and `projectionState` must each contain `{value}`, and a digit anywhere
outside that token is refused as a fabricated number — the same grammar `unthreadedState`
uses. **Collapsing the first two would let *"you have nothing scheduled"* stand for *"nobody
has worked out when your schedules fire"***, which are different facts about the system, and
a calendar is a surface where that substitution is easy to miss.

A lane with no cell is **counted into `unplaceable`, never drawn as a row of blanks**: an
empty row claims *this schedule fires nothing this week*, and the true statement is *nobody
computed when it fires*. The converse is what makes a blank cell readable — a lane is in the
grid only because the source enumerated its whole week, so inside a drawn lane a blank day
genuinely is an observed zero. Both facts are on screen at once, which is why
`unplaceableState` renders *under* a grid rather than instead of one.

**`projectionState` carries no money, and the validator enforces that with a currency
pattern.** `Plan §14` asks for the grid *"annotated with projected cost"*;
`CalendarProjection.estimatedUsd` is typed `null` so a figure cannot compile, and the copy
rule is the same refusal one layer out. Zero runs have completed, so there is nothing to
average — and a calendar is the one surface that multiplies a guessed per-run figure by
every cell on screen before anyone checks it. The occurrence count is the honest half and it
is prefixed `≥` whenever any lane reported its own count as a lower bound, because `event`,
`condition`, `chain` and `manual` triggers fire on the world rather than on a clock
(`scheduling.md` §6). The word *"cost"* is deliberately legal in the sentence: the honest
copy has to be able to say there is no cost projection.

## Rules

1. Unknown `type` → render a bordered "unsupported widget" placeholder, never crash. A
   **reserved** type (`board` — the last one, since `calendar` was built in M18) takes the
   same path at runtime and a *different* sentence at validation: the name is real and
   ADR-028 reserved it, but no schema exists to check the widget against. "gauge" is wrong;
   "board" is early.
2. Missing data → skeleton at correct height, then empty state (**`--ink-2`**, one line).
   Never a spinner that shifts layout.

   > **Correction, 2026-08-16T22:08.** This rule said `--ink-3` and it was wrong. An empty
   > state is the sentence BOARD rule 9 puts on screen *instead of* a plausible zero, so it
   > is required reading and `--ink-3` is glossed *"faint text / disabled"* — 3.57:1 dark,
   > 3.00:1 light, sub-AA at every size this product ships (design-tokens §9.1). The rule
   > told an implementer to render the product's honesty in the disabled colour, and the
   > implementer did, sixteen times. **`fidelity-qa-reviewer` found the same defect in three
   > files by three authors; one of those three was reading this line.** Filed against M6 as
   > the FAIL that produced this correction, not silently edited: a contract that quietly
   > rewrites its own reasoning is worse than one that was wrong out loud.
   >
   > `--ink-2` is a floor, not a target. Two consumers of this rule need more than the floor
   > and design-tokens §9.4a/§9.5 say which: a caveat sits one rung below the value it
   > qualifies (so a provenance caveat under an `--ivory` KPI numeral is `--ivory-2`), and
   > prose inside a row that hovers to `--card-2` needs `--ivory-2` because light `--ink-2`
   > on `--card-2` is 4.25:1. `data-table` with `rowAction: "peek"` is exactly such a row.
3. Every value formats through one shared formatter (`currency`, `number`, `percent`,
   `duration`, `relative-time`) with `tabular-nums`.
   **A formatter returning `null` is a fact, not a blank.** It renders `—` at `--ivory-2` —
   one rung under the value it stands in for — with an `sr-only` "No reading" beside it,
   because `—` alone is announced as "dash", "em dash" or silence depending on the assistive
   technology's punctuation setting. `0` and *no measurement* are different claims and the
   renderer must not blur them any more than `lib/format.ts` does.
4. `buildPrompt` emits our Claude Code one-shot prompt to rebuild the panel — keep it,
   it's the cleverest thing on their site (§2.5.1).
5. The activity feed is real: agent runs **are** the activity (§2.5 data note). Wire it
   to Langfuse first; business widgets light up later as agents write Postgres rows.

## The Mission Control footer (§2.5.7)

```jsonc
"footer": {
  "lead": "This is the actual product.",
  "detail": "Your delivery ops, running like this · agents doing the work, you approving it.",
  "cta": { "label": "Get this deployed →", "href": "/approvals" }   // or: "note" instead of "href"
}
```

**`href` is an in-app view path with no project segment.** Not an origin, not `/p/<slug>/…`.
The renderer prefixes the project the reader is currently in (`useProjectHref`), because an
approvals queue is project-scoped and a link that dropped the segment would offer one
client's queue under another client's name. A slug inside a panel file would be a second
copy of the mount, and the copy is the one that goes stale — the validator rejects it.

**`href` is optional, and omitting it is a supported state.** A CTA whose destination is not
built yet renders as text rather than as a link, and `note` — required in that case — says
why. The validator enforces the pairing so that "omit the href" cannot become a quiet way to
ship a button that does nothing.

*Today `mission-control.json` is in exactly that state.* §2.5.7 says the CTA links to the
runner's approvals queue; **that view does not exist in any project.** A link to it is worse
than a 404: `app/(views)/[...legacy]` re-prefixes any path it does not recognise, so
`/approvals` walks `/p/x/approvals` → `/p/x/p/x/approvals` → … Reported to
`shell-navigation-engineer` as a resolver bug in its own right. When §2.5.7's view lands
this is a one-line JSON edit — add `href`, drop `note` — and no code changes. Dashboards are
data.

## Panels and projects — what is true today

`project-scoping.md` §5.1 **Q8** rules that panels are **not cascaded**, and **Q8a** (answered
2026-08-17, after this contract reported the gap) rules what a project with no `panels/` of
its own shows:

> **A project with no `panels/` shows an empty carousel. There is no fallthrough to a
> coordinator-level set, and no coordinator-level set exists to fall through to.**

This contract adopts both. **The runner half is built** — `GET /api/p/:project/panels[/:id]`
reads `MountedProject.panelsDir`, and `apps/runner/src/lib/panels.ts` cannot import
`RunnerConfig`, so a project route physically cannot serve another project's dashboards
(`routes/__tests__/project-derived-reads.test.ts`).

**The web half is not, and it is `dashboards-engineer`'s** — Q8a's own table says so, and the
sentence that resolves the question this contract had been asking wrongly is: *the resolver is
a route, not a fourth disk candidate.* `apps/web/src/dashboards/data/load.ts`'s `loadPanels()`
still walks `PANELS_DIR` → `/panels` → three monorepo-relative paths and takes no project, and
both dashboard page components destructure only `id`. So the six Command Centers still render
identically in every project — true of exactly one project today, so **latent, not live**.

Two halves of the web side, because only one of them is a rename:

- **The client read is migrated.** `DashboardsView` fetches `RUNNER_ROUTES.panels.path`
  through `projectApiUrl`, so the reachable path already honours the mount, and with no
  project it does not ask.
- **The server-side disk read is a genuine design question, not a mechanical change.** It
  exists so the carousel works *with no runner at all*, which is a property this spec's
  Boundaries section claims on purpose. A disk read cannot name the project it read — that is
  precisely the ambient default ADR-015 removes — so "pass `project` to `loadPanels()`" would
  buy a parameter and no guarantee. The options are to drop the fallback in favour of the
  route, or to keep it and have it declare that it is coordinator-local and unverified. That
  is one decision and it belongs in the ops-KPI pass, not smuggled into a routing fix.

*Independently converged, which is worth recording rather than tidying away:* this contract
and `project-scoping.md` Q8a reached the same "nothing, no fallthrough" answer in the same
session without either seeing the other, and — the part that matters — **both refused to
inherit ADR-014's reasoning.** ADR-014 ruled against fallthrough for *agents* on a
capability-ceiling argument that panels have no analogue for, so borrowing its conclusion
would have been borrowing a result without its reason. Q8a's three reasons are the normative
ones; this contract's consumer-side reason, kept because it is the one a panel author will
recognise, is that **a Command Center is a claim about one client's operation** — the
coordinator's six inside project B are dashboards authored for someone else, filled with B's
numbers, under titles nobody chose for B. A plausible screen is BOARD rule 9 one level up
from a number. Note also that `department[]` is validated against ADR-001, not against what a
project staffs, so a fallen-through panel could not even be checked for relevance.

## Envelope fields beyond the sketch

- `schemaVersion` — currently `1`. Bump in `packages/contracts/src/panels.ts` and the validator together.
- `department[]` — ADR-001 slugs. An array because `pipeline` covers `sales` and `deals`.
- `emptyState` — required on every `sql`-backed widget. One sentence naming the agent that will fill it. It is the copy for `empty` (the source answered and had nothing). On `unavailable` the resolver's own sentence wins where it has one, because "No spend in this window" is a claim about data we could not read; `sql` results deliberately carry no message so `emptyState` still speaks for them.
- `unthreadedState` — required on every `thread-feed`. Carries `{value}`. See above: it is the sentence for *rows arrived, none of them threaded*, which is a different fact from *nothing arrived* and is the true one today.
- `unplaceableState` / `projectionState` — required on every `calendar`. Both carry `{value}`, both refuse a digit outside it, and all three of a calendar's sentences refuse a currency symbol, code or money word. See above: *no schedules at all*, *schedules nobody can place on a day* and *here is what the grid adds up to* are three claims, and the second is the true one today.
- `pending` — required on every signal that has a query. What the strip says before the figure exists, and what `hideWhenZero` prints at zero. Same precedence as above: a resolver message wins on `unavailable`.
- `note` — required on every `static` query. Provenance, in a sentence. An unsourced literal is a fabricated number.
- `range: "$range"` — binds the query to the panel's time-range pills. Illegal without `filters.type: "range"`.
- Query result state machine: `ok | empty | unavailable | error`. `unavailable` is not an error — it is a source that is correct but not wired in this phase (every `sql` query today).

## Ours, not theirs

Their six are Meta Ads / HubSpot / Mission Control / Content / Outbound / Finance.
**Ours** ([ADR-004](../decisions/ADR-004-command-centers.md), accepted): six Command Centers covering all seven departments, with `sales` and `deals` sharing `pipeline`. A seventh center is a new `panels/*.json` file, never a component.

| order | `id` | Title | `provider` | Departments | Real on day one? |
|---|---|---|---|---|---|
| 1 | `mission-control` | Mission Control · Agent Ops | `langfuse` | `operations` | Yes — every widget |
| 2 | `pipeline` | Pipeline · Sales & Deals | `postgres` | `sales`, `deals` | No — empty states |
| 3 | `client-delivery` | Client Delivery · Engagements | `postgres` | `customer` | Partly — activity feed |
| 4 | `content-studio` | Content · Studio & Distribution | `postgres` | `marketing` | Partly — activity feed |
| 5 | `product-funnels` | Amplitude · Product Funnels | `amplitude` | `intelligence` | No — empty states |
| 6 | `finance` | Finance · Spend & Runway | `langfuse` | `back-office` | Partly — agent spend |

Provider glyphs are abstract monochrome marks (`apps/web/src/dashboards/lib/icons.tsx`), not vendor logos. Phase 1 resolves `langfuse` + `static` only; `sql` names are declared from day one and render `emptyState`.
