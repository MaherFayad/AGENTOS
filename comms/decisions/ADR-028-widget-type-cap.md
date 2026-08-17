# ADR-028 — Exactly three new widget types, ever

**Date:** 2026-08-18 · **Author:** dashboards-engineer · **Status:** accepted
**Affects:** `comms/contracts/panel-schema.md` · `packages/contracts/src/panels.ts` ·
`scripts/validate-panels.mjs` · M16 (`thread-feed`) · P2, P4 · `Plan §23.7`, `§23.8`

> `Plan §18` calls this decision "ADR-023". That number is taken here by thread
> unification; the concordance in BOARD maps the two. This is ADR-028.

## Context

§2.5.5 fixes **seven** widget types and `packages/contracts/src/panels.ts` carries a
comment saying an eighth needs an ADR. `Plan §23.7` proposes three — `board`, `calendar`,
`thread-feed` — and, more importantly, proposes that *everything else composes from the
seven*: an agent roster is a `data-table`, budget burn is a `progress-table`, a question
queue is an `activity-feed`.

The rule is the valuable half. Seven types is why a new Command Center is a JSON file, and
the way that property dies is not one bad ADR — it is ten reasonable ones, each adding the
type its own surface wanted.

Two constraints shaped the answer:

1. **`WidgetView`'s exhaustive `switch` with the `never` fallthrough is a safety property,
   and it is spent when it is used.** The compiler naming every render site is what makes
   adding a type safe. An arm for a type nothing can render spends that for nothing.
2. **`board` and `calendar` have no data.** `board`'s drag primitive is ADR-029, unwritten.
   `calendar` reads `ops.schedule`, which does not exist. **Writing a widget schema for a
   table that does not exist produces a plausible spec** — the shape of BOARD's house
   defect, one level up from a number.

## Options

| Option | For | Against |
|---|---|---|
| A — one ADR, all three schemas now | One document, done | Two schemas invented against absent tables; two `switch` arms nothing can render |
| B — three ADRs, one per type | Each written when its data lands | Splits one rule into three; the *cap* is what is worth deciding, and nobody decides it |
| C — **one ADR now, one schema now** | The rule is decided once; each schema arrives with its data | The ADR names two types it does not specify — deliberate, and stated below |

## Decision

**We cap the panel vocabulary at the seven canonical types plus exactly three named
extensions — `thread-feed`, `board`, `calendar` — and nothing else, ever. A fourth
extension is not an ADR away; it is a reversal of this one.**

`EXTENSION_WIDGET_TYPES` in `packages/contracts/src/panels.ts` is that closed list. It is a
list of **names**, not a budget of slots: a fourth need does not spend a spare, because
there is none.

M16 builds **`thread-feed` only**. `board` and `calendar` are named and reserved: a panel
declaring either fails validation with a sentence saying why, and `WidgetView` renders them
as the bordered "unsupported widget" placeholder — the same path as a typo — because their
absence from `WidgetType` keeps the `never` fallthrough honest. They enter the union when
their data does, and each is one JSON-schema block plus one `switch` arm at that point.

### The enforcer, because a rule that names none enforces nothing

The cap fails a build in two independent places, and each was falsified before it was
claimed (plant the defect, watch it go red, remove it, watch it pass):

| Enforcer | Fails on | Gate |
|---|---|---|
| `WIDGET_TYPE_EXTENSIONS_USED: 0 \| 1 \| 2 \| 3` in `panels.ts` | a fourth entry makes `4` unassignable | `npm run typecheck` |
| `checkContractParity()` in `scripts/validate-panels.mjs` | a fourth entry, **or an extension name that is not one of ADR-028's three** | `npm run validate:panels` · `npm run test` |

The second grades the TypeScript source rather than the validator's own mirror, so editing
one copy to get past the other does not work. Deleting the check is the only way through,
and that is a diff a reviewer can see.

## Consequences

**Easy.** A new surface asks "which of the ten?" instead of "what shall I call mine?" The
`never` fallthrough keeps costing one arm per real type. `thread-feed` ships with a schema
whose every field the data plane can answer today.

**Hard, deliberately.** A surface that genuinely does not compose has to argue for a
reversal in public. `board` and `calendar` are named in a document but unusable in a panel
for a milestone or two, which is visible and honest rather than convenient.

**To reverse:** widen `EXTENSION_WIDGET_TYPES`, and both gates go red until the number in
`panels.ts` and the list in the validator are changed together and this ADR is superseded.

### What `thread-feed` is, and what it deliberately is not

- **Its query is not a new source.** `query.source` stays `langfuse | sql | static`. A
  thread is a *filter on the run plane*, not a plane — ADR-023 kept one run, one trace, and
  a rollup route would be a second way to compute `runs` and `cost`
  (`observability-engineer`, 2026-08-17). `thread-feed` reads `/metrics/activity` through
  the existing `activity` intent and groups the rows it gets back by `threadId`.
- **A panel file never names a thread.** No `filter.thread`, no uuid in JSON. A thread id
  is created at runtime; baking one into `panels/*.json` is the same defect class as baking
  a project slug into `footer.cta.href` — a second copy of a runtime identity, and the copy
  is the one that goes stale. A per-thread view binds its id from a route, and that is the
  THREADS surface (`Plan §23.8`), not a data file.
- **A group header shows a truncated id, not a title.** `thread-model.md` §9.6 answers
  *does a thread carry a title* — **no, not in M16** — and deriving one from a message body
  would put `ops.message.body`, the highest-PII value in the database, into a dashboard
  payload (§7.1).
- **It renders nothing today, honestly.** `ops.agent_runs.thread_id` is nullable and no
  writer sets it (`thread-model.md` §5.3); `ops.agent_runs` is empty because zero runs have
  executed. So the widget distinguishes the two emptinesses it *can* observe: no events at
  all → `emptyState`; events that exist but belong to no thread → `unthreadedState`, which
  carries the count it was given. **Unknown is not zero**, and neither sentence claims a
  thread exists.

## Contract edits

`comms/contracts/panel-schema.md` — new section *The cap, and the three extensions*; the
seven-type table gains `thread-feed`; `board`/`calendar` recorded as reserved.
`packages/contracts/src/panels.ts` — `CANONICAL_WIDGET_TYPES`, `EXTENSION_WIDGET_TYPES`,
`BUILT_EXTENSION_WIDGET_TYPES`, `RESERVED_WIDGET_TYPES`, `WIDGET_TYPE_EXTENSIONS_USED`,
`ThreadFeedWidget`, `ThreadGroup`, `ActivityRow.threadId`, `isReservedWidgetType`.
