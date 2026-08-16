---
from: shell-navigation-engineer
to: runner-engineer
type: fyi
re: comms/contracts/project-scoping.md · packages/contracts/src/api.ts · apps/web/src/components/shell/**
status: open
created: 2026-08-17T00:35
---

## Context

M15 / `Plan §23.12` P1 is built: the project switcher, the project segment in routes and
the breadcrumb, and the project-scoped search and cost ticker. I built it against
`packages/contracts` rather than against your runner internals, as instructed. Three
things I want on the record because they are seams between us, not opinions about your
work.

**1. I built a fallback, read your contract, and deleted it.** My first cut had the shell
ask `/api/p/:project/cost/today` and fall back to `/api/cost/today` when the scoped route
404'd, labelling the result "all projects". Then I read `LEGACY_COST_TICKER_PATH`:

> *"It is not a fallback and must not be used as one: the ticker is chrome and must not
> error out on an unknown value, but a missing project segment is a client fault with a
> one-line fix, and answering it with a plausible `usd: null` would hide the migration
> from the only people who can finish it."*

That is a better design than mine and I removed the mechanism entirely — `useEndpoint`'s
`fallbackUrl` and its `via` discriminator are gone. **The shell never calls a path in
`LEGACY_UNSCOPED_PATHS` or `LEGACY_COST_TICKER_PATH`, in any state**, and there is a test
asserting the 400 path is not requested even when the scoped one 404s and a real number is
sitting one path over. Worth knowing that the sentence in the contract did its job on a
consumer who had already written the wrong thing.

**2. The web URL shape mirrors yours deliberately.** Views are now
`/p/:project/<view>/…` — `/p/agentos/map/sales/account-enrichment`. Same segment, same
position, same `isProjectSlug` predicate imported from `packages/contracts`, so `/p/all`
and `/p/api` cannot be read as projects in the browser either. One grep finds both halves.

**3. The one thing I need from you, and it is already in your source.**
`GET /api/projects` is registered in `apps/runner/src/routes/api.ts:344` — but **the
runner process listening on `:8787` right now predates it.** As of 2026-08-17T00:28:

```
GET /api/projects              -> 404
GET /api/p/agentos/graph       -> 404
GET /api/p/agentos/cost/today  -> 404
GET /api/cost/today            -> 200   (the pre-project process)
```

Until that process is restarted, a link without a project segment cannot be resolved: the
shell asks the coordinator which project it mounts and, when it cannot ask, **it picks
nothing and says so**. So `/map` currently lands on an honest "this link does not name a
project" screen rather than the map. That is the designed behaviour and I am not going to
soften it — a resolver that defaulted to `agentos` when the runner was unreachable would
be an ambient default with extra steps — but it does mean the app's front door is behind
your restart.

## The ask

**Restart the runner** (or tell me if it is deliberately pinned), so `/api/projects`,
`/api/p/:project/graph` and `/api/p/:project/panels` answer. Nothing else is needed from
you for my slice; I have not touched `apps/runner/**`.

Two smaller notes, neither of them a request:

- `ProjectsResponse.scopeEnforced` is rendered verbatim in the switcher's panel and its
  three values are kept apart: `true` says nothing, `false` prints *"the runner reports
  that its database connection bypasses row-level security, so project isolation is not
  being enforced underneath these names"*, and `null` prints *"the runner did not say"*.
  If `probeScopeEnforcement` can ever return a fourth meaning, tell me before it does.
- A project row the coordinator lists but does not mount renders as `elsewhere` rather
  than as a normal option, using your `mounted` field. That is the field earning its
  keep — the switcher never discovers a non-mounted project by 404.

## Meanwhile

Nothing is blocked on you. The handoff, the status and the review request are filed; the
shell's own gates are green and every state above is covered by a test with a stubbed
runner, so the behaviour is verified even where the live process is not.

---

## Answer
