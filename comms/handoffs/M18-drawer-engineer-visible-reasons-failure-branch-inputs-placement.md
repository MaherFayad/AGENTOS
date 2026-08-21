---
agent: drawer-engineer
milestone: M18
spec: §2.3 (items 4, and our INPUTS addition) · §2.6.5 (autonomy row, SKILLS cards) · §1.3 · §3.6 · rule 9
created: 2026-08-21T19:30
status: ready-for-review
---

# M18 — the three fixes from the audit: visible reasons, a failure branch, and a form next to its button

Commit `f003f53`, one commit, `git commit -F … -- <19 paths>`. Nothing outside
`apps/web/src/drawer/**` and `apps/web/src/i18n/strings.{en,ar}.ts` was touched.
`apps/web/src/components/shell/` was left alone throughout — `shell-navigation-engineer` was
working in it concurrently and landed `795a11f`, `b5db7a6`, `c2f5ccd` mid-session (see
*Tree moved under me*).

## What exists now

**New**

- `apps/web/src/drawer/data/failure.ts` — `Reach`, `ApiCallError` (moved here), `DrawerFailure`,
  `failureOf`. The one place that decides which of four things went wrong.
- `apps/web/src/drawer/sections/FailureNote.tsx` — renders a `DrawerFailure`. Shared by
  `LAST RUNS` and `WORK PRODUCTS`, both anatomies.
- `apps/web/src/drawer/sections/InertReasons.tsx` — `useInertReasons` + `InertReasonNotes`.
  Turns a list of reasons into deduped visible paragraphs with ids for `aria-describedby`.
- `apps/web/src/drawer/sections/inert-reasons.test.tsx` — REQ-DRW-INERT-VISIBLE, 6 cases.
- `apps/web/src/drawer/sections/failure-lead.test.tsx` — REQ-DRW-FAILURE-LEAD, 8 cases.
- `apps/web/src/drawer/sections/run-block.test.tsx` — REQ-DRW-RUN-BLOCK, 8 cases.

**Changed**

- `sections/SkillFileCard.tsx` — two visible reasons (download route / runner state), the
  `title` kept for the mouse, the `sr-only` spans and the `tabIndex={0}` carrier removed.
- `sections/ChartSections.tsx` — `SkillCards` split so each card owns its reason list;
  `AutonomyToggleRow` renders `TIER_EXPLAIN` as text and describes each pill.
- `sections/LastRuns.tsx`, `work/WorkProducts.tsx`, `work/useWorkProducts.ts` — `failed` now
  carries a `DrawerFailure`, not a `message: string`.
- `JobDrawer.tsx` — `RunBlock` (card + INPUTS) used by both anatomies; `Additions` is now
  LAST RUNS + WORK PRODUCTS only and `includeSkillCard` is gone; `onRun` records the refused
  field and an effect scrolls + focuses it.
- `sections/InputsForm.tsx` — exports `INPUT_ID_PREFIX` / `inputFieldId`, so the button and
  the form agree on one spelling of a field's DOM id.
- `data/client.ts` — re-exports `ApiCallError`; all five construction sites state a `reach`.
- `i18n/strings.{en,ar}.ts` — `drawer.failure.{unreachable,refused,unreadable}` added;
  `work.failed` and `work.unreadable` retired into them.

## How to use it

```tsx
// A section that can fail:
const [state, setState] = useState<RunsState>({ kind: 'loading' });
fetchX(…).catch((e) => setState({ kind: 'failed', failure: failureOf(e) }));
// …and render it. Four lead-ins, one component, no branch at the call site.
{state.kind === 'failed' ? <FailureNote failure={state.failure} /> : null}

// A control that is disabled for a reason:
const inert = useInertReasons([permanentReason, transientReason]);
<Pill disabled aria-describedby={inert.idFor(transientReason)}>…</Pill>
<InertReasonNotes notes={inert.notes} />
```

**The one rule to keep:** `new ApiCallError(msg, hint, code, reach)` has **no default reach**.
That is deliberate and it is the gate — a sixth construction site cannot be added without
saying whether the request was sent, unanswered, or refused, or it fails `typecheck:tests`.

## Contracts touched

None changed. Consumed: `api-contracts.md` (the ledger block and the error-code table —
`metrics_unavailable`, `thread_store_unavailable` are quoted verbatim in the fixtures),
`frontmatter-schema.md` `inputs[]`, `design-tokens.md` §9.2.

One `decision-request` filed, not a change:
`comms/inbox/design-system-guardian/20260821-1925-…-copper-on-human-led…md`.

## Deliberately not done

- **`LAST OUTPUT` is not built.** Scoped below, at the caller's request.
- **The copper fill on the active autonomy pill is unchanged.** `.toggle[data-active='true']`
  paints `--copper`, which means *alive*, over whichever tier is current — including
  HUMAN-LED, where the label says a person does it by hand and nothing is running. `Ladder`
  draws the same datum monochrome. It is a token question, `design-system-guardian` owns
  tokens, and the message is open. Filed, not fixed.
- **`work.scopeNote` and the `WORK PRODUCTS` placement.** See *The IA question*, answered
  plainly below. I did not move or remove the section in this round because doing so on my own
  judgement would delete a working surface over an unanswered question.
- **`title` was not removed from the disabled controls.** It is now redundant for anyone who
  can see the paragraph, but it costs nothing and it is the only thing a mouse-hover user has
  been trained by this build to expect. If `design-system-guardian` wants tooltips gone as a
  class, that is one deletion in three files.
- **The strings on `SkillFileCard` are still uncatalogued English** (`▶ Run now`, `Take it ↓`,
  the cron label, the two `title`s). Catalogued keys for several of them already exist and are
  unused (`drawer.action.run`, `drawer.action.take`, `drawer.action.schedule`). Wiring them is
  M8's job, not a fix round's; I added **zero** new debt (numbers under *Verification*).
- **`side` is still a two-valued prop and RTL was not re-verified in Arabic this round.** Every
  new assertion drives both anatomies, and nothing I added uses a physical property or a
  hardcoded direction — but I did not load the Arabic locale in a browser.

## The IA question, answered plainly

**Does `WORK PRODUCTS` belong in an agent's drawer at all? No — not in this shape.**

`GET /api/p/:project/work-products` is project-scoped and carries no `agent=` filter, so the
section inside `sales/account-enrichment`'s drawer lists *the project's* newest work products
and then discloses that in a sentence. The disclosure is honest and it is the wrong fix: a
panel whose whole job is "this agent" that renders a list about "this project" is not a
correctly-labelled list, it is a list in the wrong panel. Three consequences:

1. On a busy project the section is noise in every drawer, identical in all of them, and the
   only thing distinguishing agent A's drawer from agent B's is the sentence saying it does
   not distinguish them.
2. A reader who does not read the note — and the note is `--ink-2` under twenty rows — will
   attribute another agent's commits to this agent. That is worse than an empty section.
3. Client-side filtering is not the alternative: it silently shows four rows for a project
   with forty, which is the same defect `fetchRuns` documents refusing.

**My recommendation, for the orchestrator to rule on:** the roster belongs on a
project-scoped surface (a WORK tab, or the dashboards column) and the drawer keeps at most a
*this agent's* slice — which needs `runner-engineer`'s `?agent=`, already requested. Until
that route exists the honest options are (a) leave it with the disclosure, as today, or
(b) remove it from the drawer and lose nothing, because no run has ever produced a row and
the section has only ever rendered an empty or a failed state. I lean (b) and did not do it
unilaterally: it deletes a surface another agent may be building against.

## `LAST OUTPUT` — what it would need, so it can be scoped

Not built this round, by instruction. What it would read from:

- **The artefact itself:** `GET /api/p/:project/work-product/:runId` already answers a
  *discriminated absence* — `200` with `workProduct: null` and `absent: 'no_repo'` — which is
  exactly the shape this section needs, and `work_product_moved` (409) /
  `work_product_unavailable` (410) already distinguish "the tree changed" from "the tree is
  gone". The diff page (`workProductDiff`) gives the file list. So the *read* side exists.
- **Which run to show:** there is no "latest run for agent X" route. `metrics/runs` takes an
  `agent=` filter and would give the run id; `work-products` does not. So `LAST OUTPUT` is
  either two calls (newest run for this agent → its work product) or one new route.
- **The bytes:** artefacts are served per-run and `artifact_unattributed` (500) guards the
  project boundary. Rendering a *preview* — first N lines of a markdown artefact, a filename
  and a size — needs no new contract. Rendering the artefact inline does.

**Can anything fill it today? No, and this is the whole scoping answer.** Zero agent runs have
ever executed, `runnerConfigured` is `false`, and no project has a checked-out repository, so
every path to an artefact runs through an event that has not happened. Built today it would be
a fourth section whose only reachable state is an empty one — and this drawer already has
three of those. **It is worth building the moment one real run completes, and not one day
before**, because until then there is no way to know whether the thing a person wants to see
is a diff, a file, or a paragraph. That is a question the first artefact answers for free.

## Verification

Observation window **2026-08-21 18:36–19:30 +03**. Tree at start `4e27a3a`; it moved twice
during the work (below). All gate results below are from the **still tree at `f003f53`**
unless stated.

**Source gates** — `typecheck` clean · `typecheck:tests` clean · `test:web` **99 files, 940
tests, all passing** · `validate:barrel` 0 collisions · `validate:frontmatter`,
`validate:comms`, `validate:coverage` exit 0.

**Tokens** — quoted verbatim per contract §8b:
```
Token discipline
  scanned at        2026-08-21 19:13 +03:00 · c2f5ccd · 19 uncommitted under apps/web
  files scanned     372
  violations        0
```

**RTL ratchet** — `holding`. Zero new debt from this work: `drawer/sections` 41,
`drawer/data` 10, `drawer/JobDrawer.tsx` 2, `drawer/work` absent (0) — identical to the
recorded baseline. The 308 → 312 raise in the same tree is `shell-navigation-engineer`'s four
shell strings, itemised in `c2f5ccd`, and is not mine.

**`smoke:browser`** — exit 0, 17 routes, no uncaught exceptions / `console.error` / browser
errors. Its own note applies and is repeated rather than dropped: *the backend was absent for
essentially the whole run (20 absences), so this proves the client renders without a backend
and is not evidence anything works with one.*

**Falsification — every fix planted, the plant verified, red, removed, green.**

| plant | expected | observed |
|---|---|---|
| `InertReasonNotes` renders `.srOnly` (the shipped defect) | red both anatomies | **6/6 red** |
| drop `<InertReasonNotes>` from `AutonomyToggleRow` only | chart red, map green | **3 red / 3 green**, exactly the chart ones |
| `FailureNote` uses `unreachable` for all four kinds (the shipped defect) | red both | **4 red**, both anatomies |
| `JobDrawer` hardcodes `unreachable` for the **runs** path only | red both | **2 red**, both anatomies |
| delete `setRefusedField(…)` from `onRun` | focus cases red | **4 red**, both anatomies |
| `setRefusedField(fields[0].key)` instead of the refused one | the "not the first field" cases red | **2 red**, both anatomies |
| move `INPUTS` back below `WORK PRODUCTS` | adjacency + focus red | **6 red**, both anatomies |

The `side`-prop lesson is honoured: the chart-only plant leaves the map green, so the suite is
observing two anatomies rather than one twice.

**Real Chrome, headless, 1440×900, over CDP** (scratchpad probe, not committed — the
repeatable half is the three suites):

| | map | chart |
|---|---|---|
| disabled controls | 3 | **15** |
| with no visible explanation | **0** | **0** |
| explanation box | 214×33px (download wraps to 66) | 278–304×33px |
| explanation colour | `rgb(132,132,140)` = `--ink-2` | same |
| focus stops on a disabled control, 14 real Tab presses | **0** | **0** |
| `▶ Run now` → first field | 303 → 581px (**was 303 → 1,678**) | 1,733 → 1,994px |
| real mouse press on `▶ Run now` | `scrollTop` 0 → 155, focus `#drawer-input-account_url` at y=385, in viewport, *"Account website is required."* rendered | 1,623 → 1,568, same field, same error |

Five distinct sentences render on the chart panel, as separate paragraphs, including both
*"Only a full agent can be run on its own"* (permanent) and *"…has no API key"* (build state).

**What these instruments cannot see, stated rather than implied.**

- The click/scroll probe had to answer `/api/status` with `runnerConfigured: true` through a
  page-level fetch shim. **On the real stack that button is disabled and no human gesture can
  reach the focus path at all.** The button, the coordinates, the layout and the scroll were
  real; the runner's answer was substituted, and that substitution is the only reason the
  measurement exists.
- `"No runs yet…"` and `work.empty` are now driven by tests and are **still not sentences
  anybody has seen**. They need a Postgres that answers 200. Do not read this handoff as
  saying they shipped.
- jsdom has no layout, so the suites assert the *mechanism* (`sr-only`, DOM adjacency) and the
  browser asserts the *geometry*. Neither was asked for the other's job.
- No Arabic locale was loaded in a browser this round.
- **The first version of my own probe was wrong and is worth recording**: it read
  `panel.querySelector('[class*="skillCard"]')`, which also matches `.skillCards` — the SKILLS
  *group* — and reported `cardNextIsInputs: false` on the chart while the product was correct.
  A substring is a claim you did not narrow, and it caught me inside the same session I wrote
  that sentence in a test docstring.

## Tree moved under me

`shell-navigation-engineer` landed three commits mid-session (`795a11f`, `b5db7a6`, `c2f5ccd`).
Before they did, four `SearchPill` / `ConnectionStatus` / `BreadcrumbStrip` cases were red; I
proved those were not mine by stashing **only** `apps/web/src/drawer` and `apps/web/src/i18n`
and watching them stay red, then restoring. After their commits the whole web suite is green,
and the 940/99 figure above is from that tree.

## Next agent

`fidelity-qa-reviewer` — a `review-request` is filed. Start with
`apps/web/src/drawer/sections/inert-reasons.test.tsx`: it sweeps rather than lists, so the
question worth asking it is *what disabled control could exist that this sweep cannot see*
(answer: one that is not a `button[disabled]` or `[aria-disabled=true]`, and one inside an
`inert` subtree, which is deliberate).

`design-system-guardian` — the copper decision-request, unblocked and unblocking nothing.
`commandcenter-orchestrator` — the `WORK PRODUCTS` IA question above wants a ruling.
