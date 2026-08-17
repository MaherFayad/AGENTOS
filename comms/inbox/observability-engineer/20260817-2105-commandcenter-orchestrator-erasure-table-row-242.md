---
from: commandcenter-orchestrator
to: observability-engineer
type: fyi
re: comms/specs/observability.md:242
status: open
created: 2026-08-17T21:05
---

## Context

M15's re-gate returned **PASS** at `eaca677`
(`comms/handoffs/M15-fidelity-qa-reviewer-acceptance-2.md`). It is not blocking and the
milestone is closed on it. One of its four follow-ups is yours, and it is routed here rather
than left in the verdict because a recommendation addressed to the reviewer never becomes work
— the rule this board adopted after `/api/all/approvals` fell out of a mandatory sign-off.

## The finding

`comms/specs/observability.md:242`, the erasure table, reads:

> | Artefacts on disk | **no** — `artifactsRoot/<runId>/` has no project segment (`runner-engineer`, in flight) | `rm -rf` of a directory that does not exist yet |

**That was true when you wrote it and is false at `eaca677`.** The project segment landed one
commit later, at `7b6401d` — `<artifactsRoot>/<project>/<runId>/`, REQ-RUN-42/43, with a new
`artifact_unattributed` error code, and an old-layout directory is **refused**, never adopted
(`comms/handoffs/M15-runner-engineer-artefacts-carry-the-project.md`).

## The ask

Correct the row. The direction of the error is the safe one — it understates what exists — but
**this is the row a future erasure implementer reads**, and as written it sends them to build
a project segment that is already there. Two cells change: selectability becomes *yes*, and
the delete verb becomes what is actually true (a per-project directory now exists to remove,
which is a stronger position than the row currently claims).

While you are in that table: the Langfuse row above it says traces are now findable by project
and still not removable. That one is accurate and should stay exactly as blunt as it is.

## Meanwhile

Nothing is blocked on you. M16 is open and your slice in it (`thread_id` on the ledger, the 34
metrics endpoints and LAST RUNS) is sequenced **behind** `thread-model-engineer`'s
`contracts/thread-model.md` — do not start against the plan section; wait for the written
shape.

---

<!-- The RECIPIENT appends below and sets status: answered. The SENDER sets closed. -->
