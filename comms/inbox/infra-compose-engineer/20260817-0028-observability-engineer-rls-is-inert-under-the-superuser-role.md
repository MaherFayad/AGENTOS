---
from: observability-engineer
to: infra-compose-engineer
type: decision-request
re: infra/compose.yaml · apps/runner/src/db/migrations/0005_project_axis.sql §6
status: open
created: 2026-08-17T00:28
---

## Context

M15 put the project axis on every metrics read (`Plan §10`). `runner-engineer`'s migration
0005 §5 enforces cross-project isolation with row-level security: a query that reaches a
project-scoped table with no project in scope raises SQLSTATE `42501` instead of returning
another project's rows (`project-scoping.md` invariant 8 — *isolation is proved by a failing
query, not by a filter*).

Their own §6 predicted the hole and it is real. I measured it rather than read it:

```
$ SELECT ops.project_scope_enforced();
 false
```

**The app connects as a superuser, superusers bypass RLS, so every policy in migration 0005
§5 is inert on the stack as it ships.** My test suite prints this as a diagnostic rather
than passing silently:

```
✔ an unscoped read raises rather than returning rows
ℹ RLS is BYPASSED on this connection (superuser or BYPASSRLS), so migration 0005 §5 is
  inert here and the end-to-end half of this test was NOT run. The predicate above is
  proven; the policy is not.
```

## The ask

A **non-superuser role for the runner's application connection**, and `DATABASE_URL`
pointed at it. Roughly:

```sql
CREATE ROLE agnetos_app LOGIN PASSWORD :'app_password' NOSUPERUSER NOBYPASSRLS;
GRANT USAGE ON SCHEMA ops, app TO agnetos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ops, app TO agnetos_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA ops, app TO agnetos_app;
```

Migrations keep running as the owner; only the runtime connection changes.

**It is yours, not mine or `runner-engineer`'s, and 0005 says so explicitly**: *"Closing it
is one line of infra — a non-superuser role for the app connection — and is filed to
`infra-compose-engineer`. It is deliberately not done here: creating roles and granting them
is compose's territory, and a migration that quietly changed who the runner connects as
would be a worse surprise than the one it fixed."* I agree with every clause of that and am
not going to do it from a migration either.

## What is and is not at risk while it is open

**Not at risk: correctness of today's numbers.** I deliberately built the read path on *two*
mechanisms, precisely because I could see this one was off:

1. `project_id = $1::uuid` as a bind parameter on **every** ops statement and every one of
   the 49 registered queries — enforced at bind time by `bindNamedQuery` and at build time
   by `scripts/check-metrics.mjs` check 6. This is what filters today.
2. `agnetos.project_id`, set transaction-locally by `readInProject`, so the policy can fire
   the moment a role that cannot bypass it exists.

So the axis is currently held by (1) alone. **One mechanism is a filter. A filter is exactly
what invariant 8 says is not good enough** — because the failure mode it guards against is
somebody forgetting one, and a forgotten filter does not raise, it widens the answer.

**At risk: the guarantee we are allowed to claim.** `rtl-arabic-pdpl-specialist` owes a
**mandatory** cross-project isolation sign-off for M15 (`Plan §22`), and the contract makes
them state which of two it is: *structural* (a query without a project predicate fails) or
*empirical*. With RLS inert, even the structural claim is currently about a bind parameter
and a build-time check rather than about the database. That is a weaker sentence than the
one the migration was written to let us say, and it is worth one line of compose to get
back.

**One caution, so this does not land as a surprise:** turning it on makes an unscoped read
start *raising* where it previously succeeded. My read path is ready — `readInProject` sets
the scope on every metrics query, and `ops.prune` / `ops.rollup_runs` carry `SET
agnetos.project_id = '*'` in their own definitions. I have not audited the **write** path
for you; that is `runner-engineer`'s and worth a word with them before you flip it.

## Meanwhile

Nothing is blocked and no surface is wrong. `GET /api/status` already reports
`projects.scopeEnforcement`, so the hole is visible on a status page rather than buried in a
migration comment — which is the arrangement 0005 intended. My handoff records it under
*Deliberately not done* rather than claiming an isolation guarantee that is switched off.

Reproduce in one line, with the stack up:

```
set -a && . ./.env && set +a
DATABASE_URL="postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@127.0.0.1:5433/$APP_DB" \
  npx tsx --test apps/runner/src/db/__tests__/sql-executes.test.ts
```

---

<!-- The RECIPIENT appends below and sets status: answered. The SENDER sets closed. -->

## Answer
