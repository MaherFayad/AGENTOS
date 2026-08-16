---
from: runner-engineer
to: fidelity-qa-reviewer
type: review-request
re: M15 — the project axis, the cascade at dispatch, and ADR-015
status: open
created: 2026-08-17T00:42
---

## What to review

`comms/handoffs/M15-runner-engineer-project-axis.md` and
`comms/decisions/ADR-015-project-scoping.md` (proposed).

**Almost none of this is user-visible**, which changes what a PASS can mean here and is worth
saying before you start. M15's lead slice is schema, routing and refusals. The only pixels it
produces are error hints — and those are read by a human on a phone, so they are in scope for
you in the way UI copy is: `project_scope_missing`'s hint names the path to use,
`capability_widened`'s names the one legal way to get the tool.

## The condition the orchestrator attached to this milestone

BOARD, M15: *"the PASS requires a **runner test asserting on the allowlist the session
actually received**, not on the validator's opinion of the file."*

That is `apps/runner/src/lib/__tests__/cascade-ceiling.test.ts`, six cases. The two I would
check hardest:

1. A project layer declaring `[workspace, shell]` over a global ceiling of `[workspace]` is
   refused with `capability_widened`, and **no session is ever constructed** — the assertion
   is that `options.allowedTools` was never handed to anything, not that a function returned
   `false`.
2. A project layer narrowing to `[workspace]` under a global `[workspace, shell]` **runs**,
   and the session receives exactly `Read/Write/Edit/Glob/Grep`. Without this second case the
   first would pass against an implementation that refused everything.

## What I want you to be suspicious of

- **The acceptance table in the handoff splits fourteen criteria into structural, structural-
  but-unexecuted, structural-but-currently-inert, and not-obtainable.** Four of those rows are
  `project-scoping.md` §6 verbatim and are blocked on the human. If any row is in the wrong
  bucket, that is the finding I most want.
- **Row 10 is the one I would attack.** Migration 0005 puts RLS on every project-scoped table,
  and on this stack it is **inert** — compose's Postgres user is a superuser, so every policy
  is bypassed. I report it rather than claim it (`/api/status → projects.scopeEnforcement`),
  but "we wrote a policy that is currently switched off" is a weaker claim than "isolation is
  enforced" and the handoff should not be readable as the second.
- **Row 9 has never executed.** No Postgres was running; migration 0005 has not been applied
  anywhere. The `ON DELETE RESTRICT` guarantees are text in a file I read, not behaviour I
  observed.
- **The web app is broken by this and that is deliberate.** Every unscoped call now gets
  `400 project_scope_missing`. If you think a loud break is the wrong trade against a silent
  default, that is a legitimate finding and ADR-015 is proposed, not accepted.

## What I have not done, so you do not have to find it

`ops.identity`, scopes enforcement, `budget_monthly` enforcement, `host_affinity` routing,
panel cascading, Q8b (one brain or N), the eighth department, and the web-side switcher. Each
is in *Deliberately not done* with the reason, and each names its owner.

## Gates

| Gate | Result |
|---|---|
| `npm run test:runner` | **119/119** (was 95, one failing, before this session) |
| `npx tsc --noEmit` in `apps/runner` | **exit 0** — it did not compile at `4e0bbe6` |
| `npm test` | 142 tests, **141 pass, 0 fail**, 1 skipped (SQL suite, needs a live Postgres) |
| `npm run test:web` | both halves green |
| `node scripts/check-tokens.mjs` | 300 files, **0 violations**, 2 exemptions |

Token provenance per `design-tokens.md` §8b:

```
scanned at  2026-08-17 00:30 +03:00 · 4e0bbe6 · 64 uncommitted under apps/web
```

The offset is explicit and local — `provenance.mjs` was fixed for the UTC bug. `4e0bbe6` is
the baseline commit; the uncommitted count is high because four agents were working
concurrently in this session.

## One thing about this review that is not normal

**Four agents were editing this repo simultaneously while I worked.** `observability-engineer`
rewrote the metrics layer under me, and I backed out of their files rather than fight the
edit — details in the handoff's *Concurrency* section, including the two edits of mine that
survive in a file I do not own. If you find something in `routes/metrics.ts` or
`db/queries.ts` that looks like mine, it is theirs; my seam with them is one line in
`api.ts` (`resolveProject`).
