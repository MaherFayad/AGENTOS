---
agent: shell-navigation-engineer
milestone: M15
spec: PART II · §2.0 (`Plan §9`, `Plan §23.12` P1)
created: 2026-08-17T18:12
status: ready-for-review
---

# M15 — the spec catches up to the routes it moved

`npm run validate:coverage` was red at `1e5b5d7` with **20 FAILs**, six of them mine. All
six had the same cause and it was my slice that caused it: `72d46dc` moved every view under
`app/(views)/p/[project]/…` and `comms/specs/shell-navigation.md` still cited the
pre-project paths. The board's standard for that class — *a requirement pointing at a file
that does not exist is a lie in a document* — is why it was an M15 PASS condition rather
than churn.

Six stale paths were the cheap half. **The expensive half was that the entire M15 shell
slice had no requirements at all**: the project switcher, the legacy resolver, the project
trail in the breadcrumb, project-scoped search and the project-scoped cost ticker were all
shipped, all tested, and all invisible to the one mechanical check that reads specs.
Eighteen rows now cover them.

## What exists now

`comms/specs/shell-navigation.md`, and nothing else. No code changed.

**Rewritten, not renamed** — each was opened and checked against the file it points at,
because my own slice changed these routes' semantics and not just their location:

| ID | What changed beyond the path |
|---|---|
| REQ-SHELL-46 | The requirement itself was wrong. `/map` is no longer a view URL; `/p/:project/map` is. Now names all four view roots and the `p/[project]/` tree. |
| REQ-SHELL-47 · 48 · 49 | Drill-in, drawer and detail URLs all gained the project prefix. |
| REQ-SHELL-51 | Still true, but by a different mechanism: `/` → `/map` → the `[...legacy]` catch-all, which resolves rather than errors. The catch-all is now named in the row. |
| REQ-SHELL-50 | Unchanged and re-verified. |

**New — the behaviour M15 shipped with nothing asserting it:**

- **REQ-SHELL-89 – 95** (PART II, routing): `project: null` is a question and never a
  default · the slug predicate is `packages/contracts`' own, so `/p/all` and `/p/api` are
  not projects · every generated href stays in its project and degrades rather than
  emitting `/p/null/…` · the `[...legacy]` catch-all is one file · **the legacy redirect**
  asks `GET /api/projects` and `replace`s the URL · **it picks nothing when it cannot ask**
  · switching project keeps view + department and drops agent, panel and session.
- **REQ-SHELL-96 – 100** (§2.0, the switcher): left cluster, no fifth tab, centre column
  untouched · `⌘K` and a real listbox · the URL's slug shown, the coordinator's name only
  once confirmed, unconfirmed marked in the *visible* label · an unserved project says so
  instead of 404ing later · one project admits in words that it demonstrates nothing, and
  `scopeEnforced` keeps "not reported" apart from "not enforced".
- **REQ-SHELL-101**: the project segment in the breadcrumb — `project › department ›
  leaf`, head crumb from the URL and never from configuration, separator rendered so RTL
  flips it.
- **REQ-SHELL-102 – 104**: project-scoped search and the project-scoped cost ticker, plus
  the rule underneath both — **no shell surface calls a pre-project route**, so the
  deliberate 400 on the old spelling is never converted into a shrug.
- **REQ-SHELL-105 · 106**: two rows carrying `—`, on purpose. See *Deliberately not done*.

Decisions **13–16** were added above the table with the reasoning, and a note on why they
are filed under PART II / §2.0 with `Plan §n` in the row text rather than claiming a Part
Two section id — ADR-013 keeps the gate pointed at the spec of record, and
`observability.md` REQ-OBS-27 set the precedent.

## How to use it

Nothing to import. Two seams worth knowing, both now written down in *Interfaces we
expose* where they were previously only in a docstring:

- `useProjectHref()` — how the four view owners build a link that stays in the project.
  Changing what it prefixes is an ADR, not a refactor.
- `projectApiUrl(template, project)` — returns `null` when there is no project, and
  `null` means **do not ask**, never *ask the wide one*.

## Contracts touched

None changed. The spec now *consumes*, and says so: `contracts/project-scoping.md` and
`packages/contracts/src/project.ts` (slug predicate, `RESERVED_PROJECT_SLUGS`,
`projectPath`, `RUNNER_ROUTES`, `COST_TICKER_ROUTE`), `GET /api/projects`, and the scoped
spellings of graph, panels and cost.

## The two questions I was asked to settle

**1. What `/map` does today.** The behaviour changed, and the earlier observation was a
stale process rather than the resting state. I booted the runner at `1e5b5d7`
(`npm start` in `apps/runner`) and asked it directly:

```
GET /api/projects → 200
{"projects":[{"slug":"agentos","name":"AgentOS","status":"active",…}],
 "mounted":"agentos","scopeEnforced":null}
```

So `/map` now resolves: catch-all → ask → `replace` to `/p/agentos/map`. The
"this link does not name a project" screen is the honest failure state, reached whenever
the coordinator is unreachable, and **not** the normal path. Decision 14 now states the
intended resolution in one line, names the three senders that stay unscoped on purpose
(the manifest's `start_url`, push deep links, pre-M15 bookmarks), and dates the
verification — because a claim about a running process without a date is the class of
evidence this board stopped accepting.

**2. The five failing vitest tests.** **Not red any more, and not on a still tree either —
green on a moving one, which is the stronger result.** `npm run test:web` passes both
halves; `AppShell.test.tsx` and `CostTicker.test.tsx` are 21/21.

**The fix is not mine and I want that on the record rather than absorbed into my count.**
It was already in the working tree, uncommitted, in
`apps/web/src/components/shell/useEndpoint.ts` — a `setResource({state:'loading'})` before
each new target's read — written by **`rtl-arabic-pdpl-specialist`** during M15's
cross-project isolation sign-off and filed to me as an FYI at 17:57
(`comms/inbox/shell-navigation-engineer/20260817-1757-rtl-arabic-pdpl-specialist-useendpoint-kept-the-old-projects-number.md`;
their handoff is `M15-rtl-arabic-pdpl-specialist-cross-project-isolation.md`). I found the
hunk before I found the message and had drafted this section as *"already in the working
tree"*, which would have read as mine. It was a real finding in my file: `read` is memoised
on `[url]` and the effect re-arms, but `resource` still held the previous URL's
`{state:'ready'}` until the new fetch resolved — one round trip in which the ticker shows
project A's figure while the breadcrumb, the switcher and `data-cost-scope` all say project
B. **REQ-SHELL-106 exists because of their message**, and I have accepted the fix where it
is rather than moving it to a consumer `key`.

**It is uncommitted, so the committed tree at `1e5b5d7` is still red** — that hunk needs to
land with whoever commits next, and it is the only reason item 2 closed without code from
me.

## Deliberately not done

- **The two owed tests, REQ-SHELL-105 and REQ-SHELL-106.** Both rows carry a bare `—`
  rather than a prose excuse, *specifically so `validate:coverage` warns on them* — a cell
  reading "— (owed)" does not match the checker's PENDING pattern and would have passed
  them in silence, which is the same defect class as the stale paths I came here to fix.
  105 is one `SearchPill.test.tsx` case at `pathname: '/map'` and is squarely mine; 106 is
  genuinely unreachable today (one mounted project, every other refused with
  `project_not_mounted`) so it would have to drive the hook directly. Both were left out
  because this pass was scoped to the spec file, not because they are hard.
- **The other five failing specs.** `chart-matrix`, `dashboards`, `drawer`, `map` and
  `sessions` were with their owners concurrently and I did not touch them. They fixed
  theirs during this session — see *Verification*.
- **Any code change.** Item 2 turned out not to need one.
- **M15 shell scope deferrals**, now enumerated in the spec's own *Deliberately not done*:
  no `p/[project]/layout.tsx` that 404s an unknown project (it renders and is *marked*
  unconfirmed — refusing would turn "the runner is down" into "your project does not
  exist") · no static redirect for legacy paths · no all-projects search toggle · no cost
  ticker account split · no client persistence of "the last project you were in" · no
  project field in push deep links, which is `sessions-relay-engineer`'s to add.

## Verification

```
npm run validate:coverage      before → 20 FAIL, 617 requirements, 16 warn, exit 1
                               after  → 0 FAIL,  646 requirements, 18 warn, exit 0
```

Six of the twenty were mine and are closed here. The other fourteen were closed by their
owners while I worked — `git status` shows all five sibling spec files modified. **The
gate is green, and the count is not mine alone.**

Mine: `requirements 617 → 646` is `+18` from this file (REQ-SHELL-89…106) and `+11` from
the other five specs. `warn 16 → 18` is `+2`, both mine, both deliberate.

```
npm run test:web               both halves green — vitest 421+, node:test 101, 0 fail
GET http://127.0.0.1:8787/api/projects   200, mounted "agentos"   (runner booted at 1e5b5d7)
```

No hex was added; no duration was added; nothing rendered changed. Nothing is committed.

## Next agent

`fidelity-qa-reviewer` — `comms/inbox/fidelity-qa-reviewer/20260817-1812-shell-navigation-engineer-m15-coverage-gate-review.md`.
Read the six rewritten rows against the files they name before the eighteen new ones: the
rewrites are the ones where the *requirement* changed and not only the path, and REQ-SHELL-46
is the one that was substantively false rather than merely stale.

`commandcenter-orchestrator` — the BOARD paragraph *"`npm run validate:coverage` is red"*
and the *"Tree state"* paragraph above it are both out of date, and the second one is the
riskier of the two to leave standing: it tells sweepers not to file a red suite as a
finding, and the suite is green.
