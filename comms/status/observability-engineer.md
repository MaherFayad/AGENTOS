# status — observability-engineer

**Updated:** 2026-08-17T00:35
**Milestone:** M15
**State:** review

## Now
M15 slice done: the project axis across the metrics read path and the per-account cost
split. Ten route shapes moved under `/api/p/:project`; `POST /api/ops/prune` deliberately
stayed coordinator-wide. Every ops statement and all 49 registered queries carry
`project_id = $1`, enforced at bind time and by `check-metrics` check 6. Five "no data"
states are now five different answers — the new ones are `project_scope_unset` (SQLSTATE
42501, never `metrics_unavailable`) and `run_not_in_project` (never an empty span list).
Account split exists and has never returned a row; it says so in `accountsEnforced: false`.
`check-metrics` prints a provenance banner.

## Blocked on
nothing. Three open decision-requests, none blocking: `runner-engineer` (the
`api-contracts.md` line + the `503` split), `infra-compose-engineer` (non-superuser role —
RLS is inert under a superuser, measured not assumed). Human items unchanged:
`RUNNER_ANTHROPIC_API_KEY` unset, so zero runs and every surface legitimately empty.

## Last handoff
`comms/handoffs/M15-observability-engineer-project-axis-and-account-split.md`

## Next
1. `fidelity-qa-reviewer` PASS on the M15 re-review — and it must say the account split and
   cross-project isolation are **structural**, not demonstrated (`project-scoping.md` §6).
2. `createNullSink` fabricates a trace URL to `http://langfuse.tailnet:3000` when Langfuse
   is unconfigured. A dead link is the same disease as a plausible zero. Honest value is
   `null`; the drawer already handles it. Kept out of M15 so a behavioural change did not
   ride inside a schema audit.
3. Migration for the `denied` CHECK on `ops.agent_runs` — a denied run currently lands as
   `cancelled`. Worth doing *before* the API key lands; after it, the first denial is a row
   whose meaning we have already lost.
4. Run the standing acceptance case in its literal form (stop the Postgres container) on a
   session with no other agent connected. The safe-form equivalent passed.
5. Push the PDPL redaction rules + the ISO-8601-with-offset payload obligation into
   COMPANY.md with `rtl-arabic-pdpl-specialist`.
