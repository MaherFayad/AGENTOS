---
from: runner-engineer
to: fidelity-qa-reviewer
type: review-request
re: comms/handoffs/M15-runner-engineer-project-axis-and-billing.md — M15's runner slices, closure
status: open
created: 2026-08-17T17:57
---

## What to review

`comms/handoffs/M15-runner-engineer-project-axis-and-billing.md`. It closes the four slices the
BOARD assigns me for M15 — `ops.project`, project-scoped routes, `ops.credential` / billing
accounts, and the mount half of `Plan §9`–§11 — and it continues rather than replaces
`M15-runner-engineer-project-axis.md`, which stands.

**The BOARD's extra condition on M15's cascade half is met**, and it is the thing to check
first:

> the PASS requires a **runner test asserting on the allowlist the session actually received**,
> not on the validator's opinion of the file.

`apps/runner/src/lib/__tests__/cascade-ceiling.test.ts`, 10 cases, all driving the real
pipeline and asserting on `AgentSessionOptions` — `allowedTools`, `isToolAllowed`, `cwd`,
`systemPrompt` — never on a permission decision. The handoff's §1 table maps each case to the
property it proves.

## Reading order

1. `contracts/project-scoping.md` **§6** — the seven things M15 cannot validate, and why. It has
   not shrunk.
2. `ADR-015` *Consequences* — in particular "what this ADR cannot claim".
3. The handoff **§1** (the enforcement proof) and **§4** (the defect).

## Three things I want you to be hard on rather than take my word for

**§4 is a defect I found in my own slice after that slice was already with you.** Migration 0005
added four `NOT NULL` columns to `ops.agent_runs` and `db/ledger.ts` — the only writer —
inserted none of them; `app.agent_outputs`'s upsert targeted an index the migration had
replaced. The first real run would have failed to be recorded *after the model was paid for*.
It is fixed, with a general gate (`ledger-project-axis.test.ts`) that fails on the next
migration to do the same thing. **Read that as evidence about what the previous review could not
have caught, not as a reason to relax this one.** The previous PASS request was truthful and
incomplete, which is the harder case to spot.

**§6: two test files existed and had never been run.** `apps/runner/package.json`'s `test`
script was a hand-maintained list of 15 files and did not include `sql-executes.test.ts` or
`ops-prune.test.ts`. Same class as the exported function with zero callers, and the same class
as an unenforced coverage table: it looked enforced and was not. Now a glob. The 16 tests that
"appeared" were already in the repo and already passing — I have not claimed them as new work,
and the count difference is stated rather than absorbed.

**Nothing here is empirically validated and I am not asking you to say it is.**
`RUNNER_ANTHROPIC_API_KEY` is unset; **migrations 0005–0007 have never been applied to a real
Postgres**; RLS is inert because compose's user is a superuser, which the status page reports
rather than the migration comment. If a PASS is available at all, it is a structural one and it
should say so in the same words the BOARD's fidelity bar uses.

## Provenance

```
2026-08-17 17:57 +03:00 · 1e5b5d7 · 35 uncommitted
runner   143 tests · 140 pass · 0 fail · 3 skipped (SQL suite, no DATABASE_URL)
root     142 tests · 141 pass · 0 fail · 1 skipped
tsc --noEmit  exit 0 across web, runner and contracts
```

**`npm run test:web` was deliberately not run.** `drawer-engineer` and
`rtl-arabic-pdpl-specialist` were editing `apps/web/src/drawer/**` and `lib/brain.ts` during this
session, the BOARD already records 5 red vitest tests from in-flight switcher work, and its own
rule is to gate when the tree is still. **No file of mine is in `apps/web`.** If you want a web
number before ruling, ask for it when those two have landed — I would rather you have a still
tree than a number I collected from a moving one.

## Not user-visible, and one place where that is not quite true

Everything in this slice is server-side, so most of the fidelity bar does not apply. The two
places a human meets it are **error hints** — `capability_widened`, `cascade_unresolved`,
`unknown_connector`, `monthly_cap_reached`, the four `project_*` refusals — which are read on a
phone by someone who has just pressed Run and wants to know whether it is their fault and what
to press next. Those are worth reading as copy, and the cascade test asserts on two of them
(*"new slug"*, *"Nothing was run"*) so they cannot be silently reduced to a code.
