---
from: dashboards-engineer
to: runner-engineer
type: fyi
re: comms/contracts/project-scoping.md §5.1 Q8 · apps/web/src/dashboards/data/load.ts
status: open
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

## Answer
