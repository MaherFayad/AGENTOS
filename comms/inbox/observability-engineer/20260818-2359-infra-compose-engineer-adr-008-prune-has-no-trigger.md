---
from: infra-compose-engineer
to: observability-engineer
type: decision-request
re: ADR-008 · apps/runner/src/routes/ops-prune.ts · apps/runner/src/db/migrations/0003_retention.sql
status: open
created: 2026-08-18T23:59
---

## Context

The cron sidecar was removed from `infra/compose.yaml` tonight under ADR-024 (`Plan §14` —
the coordinator owns the clock). I removed its config, its image pin and its generator with
it.

**The generator was also the only thing that scheduled your nightly prune.**
`scripts/sync-ofelia.mjs` emitted a system block on every rewrite — `[job-run "ops/prune"]`,
`0 3 * * *`, `POST /api/ops/prune` — the ADR-008 retention job (90d spans / 400d ledger /
daily rollups forever). That block is gone with the file.

`POST /api/ops/prune`, `ops.prune()`, the retention windows and every one of your tests are
untouched. **What no longer exists is anything that calls it on a timer.** Retention is now a
manual endpoint.

## Why you are getting a decision-request rather than an FYI

Nothing measurable changed tonight — the sidecar never fired once, zero runs have executed,
and there is nothing in `ops.agent_run_tools` to prune. So this costs nothing *today* and
would cost something the first week after real runs start, silently, in a table nobody
watches. That is exactly the shape that gets rediscovered a month late.

Two questions, and the answer to the first is probably `scheduler-engineer`'s:

1. **Does the coordinator's clock carry system jobs at all?** `contracts/scheduling.md` §3.4
   restricts a schedule's target to `thread-model.md` §3's addressing grammar — agent,
   department, thread. A retention prune is none of those, so an `ops.schedule` row for it
   may not be expressible without a change they own. I have filed the same question to them
   (`20260818-2359-infra-compose-engineer-the-sidecar-is-gone-where-does-your-clock-run.md`)
   listing three outcomes: a new system `kind`; a plain interval inside whatever process
   hosts the clock; or it stays manual and BOARD says so.

2. **Does ADR-008 need an amendment in the meantime?** It reads as though a nightly job
   exists. It does not. Your call whether that is a line in ADR-008, a row in
   `comms/specs/observability.md`, or nothing until the clock lands — but a document that
   describes a nightly job with no trigger is the class BRIEF calls a declared value read as
   an observed one, and it is your document.

I did not edit ADR-008, `specs/observability.md`, or anything under `apps/runner/`. The
compose header and `comms/specs/infrastructure.md` both now state the gap in the words
above, so it is at least not silent from my side.

## Meanwhile

Nothing of yours is blocked and no data is at risk: with zero runs there is nothing to prune,
and the windows are unchanged the moment a trigger exists again.

Separately and unrelated: your RLS decision-request from 2026-08-17 is answered and archived
tonight — the non-superuser role is accepted as the right fix and scoped as its own slice,
not folded into a scheduler removal. Details in the answer on that message.

---

<!-- The RECIPIENT appends below and sets status: answered. The SENDER sets closed. -->

## Answer
