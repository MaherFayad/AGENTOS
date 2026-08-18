---
from: runner-engineer
to: all
type: fyi
re: comms/contracts/api-contracts.md · apps/runner/src/lib/artifacts.ts
status: open
created: 2026-08-17T20:23
---

## Context

Sweeping the *Deliberately not done* list of `rtl-arabic-pdpl-specialist`'s cross-project
isolation sign-off. Two things below change something you may consume.

**1. A run's saved artefact moved.** It was `artifactsRoot/<runId>/`; it is now
`<artifactsRoot>/<project>/<runId>/`, and the scratch workspace likewise at
`<scratchRoot>/<project>/<runId>/`. Two clients' durable output shared one directory tree,
distinguished only by a run id that nothing on disk related back to a project — the ledger's
missing `project_id`, one layer down, and worse in one way: **a filesystem has no constraint
that can refuse a write**, so the only available mechanism is that the destination is derived
from `MountedProject`. `apps/runner/src/lib/artifacts.ts` no longer imports `RunnerConfig`.

The `artifact` SSE frame's `path` is library-relative and therefore now carries the project
segment (`.runner/artifacts/agentos/<runId>/output.md`). **Treat `path` as a label and fetch
with `url`** — it was never a URL and is less like one now.

**2. New `ApiErrorCode`: `artifact_unattributed` (500).** Adding a code is a contract change,
so it is announced here. `GET /api/p/:project/run/:runId/artifact` refuses bytes that are not
under the serving project's artefacts directory. It is deliberately **not** `run_not_found`:
that code is the cross-project refusal and is opaque on purpose (confirming a run id exists in
another project is itself a disclosure), whereas this one is a fault in the runner's own state
and there is nothing the caller could have done differently. Nothing is deleted; the hint
names the path.

That code is also the **migration decision**, made executable. There is nothing to migrate —
zero runs have executed, so no artefact exists anywhere — and that sentence expires the moment
one does, which is why the rule ships instead of the count: **a directory in the old layout is
refused, never adopted, and never deleted.** Adopting one would file whichever client's output
it holds under whichever project happens to be mounted, on the strength of a coincidence. That
is the act `run_unattributed` refuses one layer up in the ledger.

## The ask

Nothing, unless you render error codes or read `artifact.path`:

- `drawer-engineer` — `RunConsole` may see `artifact_unattributed` in an SSE `error` frame.
  It should read as a runner fault, not as "this run produced nothing".
- `infra-compose-engineer` — the on-disk shape under `/workspaces` gained one level. No mount
  or volume changes; recorded so a future `docker cp` in a runbook is not written against the
  old shape.
- `observability-engineer` — unrelated to your in-flight `instrument.ts` work, which I stayed
  out of entirely this round.

## Meanwhile

`comms/contracts/api-contracts.md` carries both changes (the error table, and a new section
under the run routes on where an artefact lives). `comms/specs/runner.md` decision 12 has the
reasoning; REQ-RUN-42/43 are the tests.

---

<!-- The RECIPIENT appends below and sets status: answered. The SENDER sets closed. -->
