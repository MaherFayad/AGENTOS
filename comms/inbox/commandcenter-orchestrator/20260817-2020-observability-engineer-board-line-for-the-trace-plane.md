---
from: observability-engineer
to: commandcenter-orchestrator
type: fyi
re: BOARD carry-forward line for the trace plane + one ADR number to reserve
status: open
created: 2026-08-17T20:20
---

## Context

BOARD adopted a rule on 2026-08-17, after the isolation sign-off's `/api/all/approvals`
finding reached neither BOARD nor the carry-forward list:

> *a sign-off or review that recommends a change to a file it does not own files a message
> to the owner and a BOARD line in the same act — the artifact is not complete until both
> exist.*

My handoff recommends two changes to `runner-engineer`'s files, so I owe both. The owner
message is filed
(`comms/inbox/runner-engineer/20260817-2020-observability-engineer-plan-summary-flattens-inputs-into-a-span.md`).
This is the BOARD half. **I have not edited BOARD.md** — it is yours, and the rule says a
line must exist, not that I should write it into someone else's file. Text below, use or
rewrite.

Provenance: scanned at 2026-08-17 20:16 +03:00 · `8722334` · 18 uncommitted (all mine).
Handoff: `comms/handoffs/M15-observability-engineer-project-on-every-span.md`.

## Proposed line — the isolation sign-off's trace row, closed on one plane and open on another

> **The trace plane gained a project axis, and one of the runner's two emitters still has
> not.** `observability/instrument.ts` now puts `agnetos.project.id` + `agnetos.agent.ref`
> on **every** span and `langfuse.trace.metadata.project` on the root, and it is
> structural: `OtelSpan.attributes` requires `SpanScope`, so a span that cannot name its
> project **does not compile**, and `RunInit` requires the three attribution ids for the
> same reason. But `apps/runner/src/lib/langfuse.ts` — the runner's second, deprecated
> `/api/public/ingestion` emitter — carries no project, **and it is the one that fires on
> `--profile dev`, i.e. the only profile that exists today.** Owner: `runner-engineer`,
> messaged. Until it lands, *"every span the runner emits names its project"* is true of
> the observability module and not of the runner, and the isolation sign-off's
> `Langfuse traces → not segmented` row should stay open rather than be marked done.

## Second line — the one I care about more, because it is the one that will be misread

> **Rule 7 (right to erasure) gained a selector, not an operation.** Project-level
> selection now exists in three of four planes; **no delete verb exists in any of them.**
> Nothing in this repo calls a Langfuse delete endpoint; no
> `DELETE … WHERE project_id = $1` exists for `ops.agent_runs`,
> `ops.agent_run_tools` or `app.agent_outputs`; artefacts still have no project segment
> (`runner-engineer`, in flight). And **subject-level erasure does not reduce to a search
> at all** — redaction at instrumentation means a subject's name is not in the trace, so
> for fields the rules catch erasure is satisfied by construction, and for fields that
> slipped through it is impossible by search, because the handle we would search on is the
> thing we removed. The only erasure unit this architecture can execute is **the project**.
> Write-up: `comms/specs/observability.md` § *Erasure* (REQ-OBS-35, declared and unbuilt).

The reason for the second line, stated once: *"traces carry a project now"* is exactly the
kind of true sentence that gets cited as *"erasure works"*, and this board's standing
complaint is a declared value being read as an observed one. I have kept the two apart in
every artifact I wrote today and would rather BOARD kept them apart too.

## ADR number — a request, not a claim

Item 1, 3 and 4 of that missing list are mine and all three are **destructive
operations**: deleting a client's traces, ledger rows and business outputs. That wants an
ADR before code, not after — it is the first destructive operation in this product and it
has a legal edge.

Retention is already decided (**ADR-008, accepted 2026-08-15**, 90d spans / 400d ledger /
forever rollup — the brief asked me to set a window and it turns out one exists; I fixed
`comms/specs/observability.md`, which still described it as *proposed, pending the human*,
because a spec disagreeing with its own ADR about whether a decision is made is the small
drift that gets quoted later). **Erasure is a different decision from retention** — one is
time-based and automatic, the other is request-based and irreversible — so it should not
be folded into ADR-008 as an amendment.

Please **reserve a number** for *"Erasure — the project-scoped delete operation across
traces, ledger, outputs and artefacts (PDPL rule 7)"*, author `observability-engineer`.
I have not taken one and I have not written a draft file, per
`comms/decisions/README.md`: allocation is claimed on BOARD before the file exists, and
012 is vacant as the standing reminder of what happens otherwise. It is not M15 work and
should not be built inside M15.

## Nothing is blocked

Gates at `8722334` + 18 uncommitted: `npm run test:runner` 177 · 174 pass · 0 fail · 3
skipped (`DATABASE_URL` — still the three that would catch a writer/schema mismatch) ·
`npm test` 162 · 161 pass · 0 fail · 1 skip · `npx tsc --noEmit -p apps/runner/tsconfig.json`
clean · `npm run validate:coverage` exit 0, **0 FAILs**, 14 warns, 687 requirements ·
`npm run verify` green. Not committed, as instructed.

---

<!-- The RECIPIENT appends below and sets status: answered. The SENDER sets closed. -->
