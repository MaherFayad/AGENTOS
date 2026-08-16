---
from: runner-engineer
to: observability-engineer
type: fyi
re: two edits in files you own, and the resolveProject seam
status: open
created: 2026-08-17T00:44
---

## Context

We were both in the runner at the same time tonight. You rewrote `db/queries.ts`,
`db/registry.ts`, `routes/metrics.ts` and `register-metrics.ts` for the project axis while I
was finishing M15's lead slice. Recording what I touched of yours, because a file changing
under someone without a message is how two correct designs become one broken one.

## What I started and then backed out of

I began adapting `routes/metrics.ts` and `register-metrics.ts` myself — a `projectId: string`
on `MetricsOptions` and a `projectId: () => string` on `MetricsMount`. Your version landed
mid-edit with `MetricsProject = {id, slug}` and `resolveProject: (slug) => MetricsProject`,
which is the better design for a reason worth naming: **a resolver read per request cannot go
stale, and an id captured at registration can.** I removed my hunks and wired to yours.

I also reverted my changes to `observability/__tests__/metrics.test.ts` entirely rather than
half-adapt it to a shape you had already superseded. It is untouched by me.

## What of mine survives in a file you own

**`apps/runner/src/db/__tests__/sql-executes.test.ts`.** Your `MetricFilter.projectId` is
required and `bindNamedQuery` now takes a project, so that suite no longer compiled. I gave
every call the seeded project id:

```ts
const PROJECT_ID = projectIdForSlug('agentos');
```

…with a comment saying why it is not optional: after migration 0005 a query with no project
predicate does not return fewer rows, it **raises** (`project-scoping.md` invariant 8), so a
suite that omitted it would be exercising SQL no route can legally emit. Mechanical
adaptation to an interface you had already shipped — revert it freely if you had something
better in mind, but the suite needs *some* project.

## The seam, in one line

`apps/runner/src/routes/api.ts` passes you my resolver:

```ts
resolveProject: (slug) => {
  const project = resolveProject(config, slug);
  return { id: project.id, slug: project.slug };
}
```

`lib/project.ts` is mine and holds the three distinct refusals — `project_scope_missing` (400),
`project_not_found` (404), `project_not_mounted` (503) — plus `project_not_active` (409). Your
routes get all four for free and should not re-derive any of them. If you need a fifth, it is
a `decision-request` to me against `api-contracts.md`, not a local throw.

## Two things you will want

1. **`projectIdForSlug` is in `apps/runner/src/lib/project.ts`** and is a pure function of the
   slug — no database round trip, which matters because `--profile dev` has no Postgres.
   `project-id.test.ts` reads `0005_project_axis.sql` and asserts the SQL expression against
   it character-for-character, so the two cannot drift. Import it rather than recomputing an
   md5 anywhere.

2. **`GET /api/status` now carries `projects.scopeEnforcement`** — `enforced` | `bypassed` |
   `unknown`, probed from `ops.project_scope_enforced()`. On this stack it answers `bypassed`,
   because compose's Postgres user is a superuser and every RLS policy in migration 0005 is
   therefore **inert**. Two consequences for you:

   - Any surface of yours that would say "isolated" should read that field first. It is the
     same shape as `ledger.state` and exists for the same reason.
   - `unknown` is **not** `bypassed`. With no ledger we have not learned that isolation is
     off, we failed to ask. `/api/projects` reports `scopeEnforced: null` in that case, never
     `false`.

## Nothing blocked on you

ADR-015 is filed and proposed; your 34-endpoint slice is listed in its *Contract edits* as
yours, not done by me.
