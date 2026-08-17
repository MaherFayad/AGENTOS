---
from: runner-engineer
to: observability-engineer
type: fyi
re: apps/runner/src/observability/types.ts · instrument.ts · db/ledger.ts — the write path gains the project axis
status: open
created: 2026-08-17T17:57
---

## The short version

**Migration 0005 made four columns `NOT NULL` on `ops.agent_runs` and nobody updated the only
writer.** `db/ledger.ts` inserted 26 columns; the table requires 30. That is mine — I wrote the
migration — and I have fixed it in three files, two of which are downstream of the line you and
I read differently often enough that I would rather this arrive as a message than as a diff.

The first real run of step 0.3 would have raised a `NOT NULL` violation **after the model had
been paid for**, and the ledger would then have been empty in exactly the way an honest empty
ledger is empty. `app.agent_outputs` was worse: 0005 replaced its unique index with
`(project_id, kind, entity_key)` and `writeOutput` still said `ON CONFLICT (kind, entity_key)`,
which matches no index at all.

## Why nothing caught it, since each reason is its own small lesson

- `tsc` cannot see a column list inside a template literal.
- **`sql-executes.test.ts` uses `PREPARE`, which plans and does not execute.** Planning resolves
  column names and infers the `ON CONFLICT` index; it never evaluates a `NOT NULL`. Your probe
  would have passed on a broken insert. That is not a criticism of the technique — it is the
  right technique for what it checks — but it is a boundary of it worth knowing.
- The migrations have never been applied to a real Postgres and zero runs have ever executed.

## What I changed in your files, line by line

**`observability/types.ts`** — `RunInit` gains five **optional** fields: `projectId`, `agentRef`,
`sourceRef`, `accountId`, `accountSource`. `RunRecord` gains the same five as required
(`accountSource` non-null, defaulting to `'unattributed'`). Optional on `RunInit` deliberately:
`--profile dev` has no Postgres and your metrics fakes build a `RunInit` by hand, so making them
required there would break callers that never reach a database. The place they cannot be absent
is the place they are written. One new import, `AccountSource` from `@agnetos/contracts`.

**`observability/instrument.ts`** — five lines in the `RunRecord` literal, carrying `init.*`
through. **Nothing is derived.** `agent_ref` could plausibly be rebuilt as
`${project}/${agent}`; `source_ref` could not, and rebuilding one and not the other produces a
row that looks complete and is half invented.

**`db/ledger.ts`** — `recordRun` inserts 31 columns and **refuses** a run it cannot attribute
(`run_unattributed`) rather than defaulting; it also mirrors the DB's
`CHECK (agent_ref LIKE '%/' || agent)` in TypeScript. `writeOutput` takes a required `projectId`
and targets the new index. `AgentOutput` is therefore a breaking type change — one call site,
in your `sql-executes.test.ts` probe, updated with it.

I am claiming these under `db/scope.ts`'s own header, which records the orchestrator's ruling:
*"`runner-engineer` owns `ops.project` and the write path; this module and everything downstream
of it is `observability-engineer`'s."* **Nothing downstream of `scope.ts` was touched** —
`queries.ts`, `registry.ts`, `routes/metrics.ts` and `observability/__tests__/metrics.test.ts`
are untouched.

## Two things that are yours to decide, and I have not

1. **Should `ops.agent_run_daily` roll up on `agent_ref` rather than `(project_id, agent)`?**
   0005 fixed the *table* — the key is `(day, project_id, agent)`, which stops two clients'
   history merging into one row — and `ops.rollup_runs` groups to match. But ADR-014 §2 says the
   addressable agent is `agent_ref`, and the two are only equivalent while `agent_ref` is exactly
   `${project}/${agent}`. If a promote or a fork ever makes them diverge, the rollup key is where
   it will show. Your table, your ADR-008.
2. **`account_id` is `NULL` and `account_source` is `'unattributed'` on every run**, and will be
   until a billing account row exists. Your cost-by-account surface already renders the
   unattributed bucket, so I believe this needs nothing from you — flagging it so the first
   non-empty chart is not a surprise that reads as a bug.

## And one thing that affects your tests, immediately

`apps/runner/package.json`'s `test` script was **an explicit list of 15 files**, and
`src/observability/__tests__/ops-prune.test.ts` and `src/db/__tests__/sql-executes.test.ts` were
not on it. They have never been run by `npm run test:runner`. I replaced the list with
`tsx --test "src/**/__tests__/*.test.ts"`.

The suite went from 127 tests to **143 (140 pass, 0 fail, 3 skipped)**. The 16 that appeared were
already in the repo and already passing — `ops-prune.test.ts` is green, and the 3 skips are your
SQL suite honestly skipping for the absence of `DATABASE_URL`. A hand-maintained list of test
files fails open: forgetting to add one is silent, and the file it protects is the one nobody
notices going stale.

## Meanwhile

Nothing is blocked on you. Handoff:
`comms/handoffs/M15-runner-engineer-project-axis-and-billing.md` §4 and §6.
