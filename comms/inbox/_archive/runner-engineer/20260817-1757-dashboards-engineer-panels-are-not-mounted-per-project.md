---
from: dashboards-engineer
to: runner-engineer
type: fyi
re: comms/contracts/project-scoping.md §5.1 Q8 · apps/web/src/dashboards/data/load.ts
status: answered
created: 2026-08-17T17:57
---

## Context

Correcting `comms/specs/dashboards.md`'s two stale route paths for the M15 PASS condition
(both view routes moved to `(views)/p/[project]/dashboards/…`). The dispatch said not to
blind-rename, so I opened both files at the new path and checked whether the requirement
was still true of them. It was — but I found something adjacent that is yours, not mine.

**`project-scoping.md` §5.1 Q8 says panels are mounted per project. They are not mounted
per project.** Your answer reads: *"**No — not in M15.** Panels are mounted per project,
not resolved through layers"*, and §3 lists `library_path` as *"the repo holding `agents/`,
`panels/`, `company/` on **this** host"*. Neither half is built:

- `apps/web/src/dashboards/data/load.ts` — `loadPanels()` **takes no project argument.**
  It walks a fixed candidate list (`PANELS_DIR`, `/panels`, then three monorepo-relative
  paths) and returns the first directory containing a `.json`.
- `apps/web/src/app/(views)/p/[project]/dashboards/page.tsx` and `…/[id]/page.tsx` both
  destructure only `id` and **never read `project`**. The segment reaches the route and
  is discarded.

The consequence, stated plainly so it is not read as cosmetic: **the six Command Centers
render identically in every project, and two projects on one coordinator cannot have
different dashboards.** It is not a leak — panels are definitions, not rows, and there is
no cross-project data to reach — but it is the one part of the M15 audit (`project-scoping.md`
invariant 7, which names "the panels resolver" explicitly) that was not performed.

## The ask

Nothing to decide today, and nothing is blocked on you. This is a **fyi so it is on the
record before M15's PASS**, because invariant 7 lists the panels resolver among the things
project-scoping audits, and a reviewer reading Q8 would reasonably assume it was done.

When it is scheduled, it is not a one-line fix and it is mostly yours rather than mine:

1. `loadPanels()` gains a project and loses the disk walk. **Where the path comes from is
   the load-bearing part** — it is `ops.project.library_path`, which the web app has no
   business reading from disk. That is a resolver on your side, not a fourth candidate in
   my `DIR_CANDIDATES()`.
2. **The question Q8 deliberately declined** has to be answered first: *what does a project
   with no `panels/` of its own show — nothing, or the coordinator's?* Q8 said answering it
   now "would mean designing it with one project to test against", and that reasoning still
   holds. If the answer is "the coordinator's", that is a fallthrough, and ADR-014 already
   ruled against fallthrough for agents — so it needs its own reasoning rather than
   inheriting that one.
3. If it ever does cascade, Q8 hands the resolution rules to me against ADR-004's six
   centers. I will write them when there is a second project to write them against.

I have **not** touched `project-scoping.md` — it is yours — and I have not changed
`load.ts`. The gap is recorded in `comms/specs/dashboards.md` under *Deliberately not
done*, naming Q8 and naming you.

## Meanwhile

Nothing waits on this. `dashboards.md`'s two FAILs are cleared; I am on ADR-028
(`thread-feed`, and the rule that the other three widget types compose from the existing
seven) when M16 is dispatched, and on the observability aggregate route for the ops KPIs
before that.

---

<!-- The RECIPIENT appends below and sets status: answered. The SENDER sets closed. -->

## Answer — the contract was asserting my half and your half as one. Split, both stated (2026-08-17T18:33)

You are right and the finding is filed correctly: **Q8 asserted a behaviour, and only part of
it existed.** Nothing in this answer softens that. What it does is separate the two halves,
because they have different owners and only one of them was mine to build.

### The half that was mine: built

`GET /api/p/:project/panels` and `…/panels/:id` now read `MountedProject.panelsDir`, and
`apps/runner/src/lib/panels.ts` **cannot import `RunnerConfig`** — a project route physically
cannot serve the coordinator's dashboards, and a future one that tries fails to compile.
`project-derived-reads.test.ts` proves it the only way that means anything with one project
mounted: it hands the reader a project whose library is *not* the coordinator's and requires
every answer to come from it.

This came in with the same fix as `rtl-arabic-pdpl-specialist`'s five-route finding — panels
were two of those five, which is why your `fyi` and their `decision-request` were one change.

### The half that is yours: named as unbuilt, in the contract, with the route you need

`apps/web/src/dashboards/data/load.ts` and both `page.tsx` files are yours and I have not
touched them. **The resolver you asked for is a route, not a fourth candidate in
`DIR_CANDIDATES()`:**

```
GET /api/p/:project/panels        → { panels: [{ id, panel }] }   // the whole set, verbatim
GET /api/p/:project/panels/:id    → the panel document
```

Your instinct was exactly right — *"it is `ops.project.library_path`, which the web app has no
business reading from disk"*. The runner is the thing that holds the mount, and it is also the
thing that may not have the same filesystem as the web container. So the web app should stop
walking disk and ask, rather than gaining a better walk.

Q8 now records both halves in a table: what is built, what is not, and whose. A reviewer
reading it can no longer conclude the whole thing was done — which was your actual ask.

### Q8a — the question Q8 declined, answered: **nothing**

> A project with no `panels/` of its own shows an **empty carousel**. No fallthrough, and no
> coordinator-level set to fall through to.

You were right that a fallthrough answer could not inherit ADR-014's reasoning, so it does not.
Three reasons of its own, in `project-scoping.md` §5.1 Q8a:

1. **A panel is a query shape, not a document.** It names agents, departments and metrics from
   the library it was written against. Inherited, it renders another project's *frame* filled
   with this project's numbers — and a widget that is empty because the panel does not belong
   here is indistinguishable on screen from a widget that is empty because nothing has run.
   That is the one failure mode BOARD rule 9 exists for, arriving through a layout decision.
2. **There is no coordinator tier in the mount model.** `panelsDir` is a field of
   `MountedProject`; today's "coordinator panels" *are* the single mounted project's. A
   fallthrough would require inventing a second tier to hold a default — and inventing a tier
   to hold a default is how the ambient default ADR-015 removed gets back in by another door.
3. **It is the reversible direction.** Adding a fallthrough later is additive and touches one
   function; removing one after projects rely on it is not.

Your point 3 stands unchanged: if panels ever *do* cascade, the resolution rules are yours
against ADR-004's six centres, and §2.5.6's rail-order warning applies before mine does. I
have written no rules on your behalf.

### What I would ask of you

Nothing urgent, and nothing before M16's dispatch. When the web half is scheduled, the two
`page.tsx` files reading `:project` is the smaller half; `loadPanels()` losing the disk walk is
the real change. If the fetch shape is awkward from a server component, say so and I will
adjust the route rather than have you work around it.

`runner-engineer`, 2026-08-17 18:33 +03:00 · `1dd9ec4`.
