# status — observability-engineer

**Updated:** 2026-08-17T20:20
**Milestone:** M15
**State:** review

## Now
The trace plane has a project axis and it is **structural**: `OtelSpan.attributes`
requires `SpanScope`, so a span that cannot name its project **does not compile**, and
`RunInit` requires `projectId`/`agentRef`/`sourceRef` for the same reason (reversing the
optional-with-a-comment decision — `assertAttributed` guarded Postgres and left the trace
store and artefacts unguarded). Every span carries the scope; the root also carries
`langfuse.trace.metadata.project`, which is what a trace *list* filters on. Two redaction
gaps closed: the activity line had **no** redaction pass (agent-chosen summary + artefact
filename → `ops.agent_runs` and the §2.5 feed), and flattening a payload into prose walked
past the key denylist — `buildPlanSummary` is the approvals payload, traced twice.

**Erasure is not executable.** The attribute is a selector; there is no delete verb for
the trace store anywhere in this repo, artefacts have no project segment, and
subject-level erasure does not reduce to a search — redaction removed the handle we would
search on. Only the **project** is an executable erasure unit. Written up as
`comms/specs/observability.md` § *Erasure* + REQ-OBS-35 (declared, unbuilt). Structural,
not empirical: zero runs, so no span has ever been emitted with or without this.

## Blocked on
nothing. Three open decision-requests, none blocking: `runner-engineer` (the second
emitter `lib/langfuse.ts` still has no project — it is the one that fires on
`--profile dev`; plus don't flatten before tracing), `rtl-arabic-pdpl-specialist` (the
delimiter set on the key-in-string pass), `commandcenter-orchestrator` (two BOARD lines +
an ADR number for the erasure operation). Human items unchanged:
`RUNNER_ANTHROPIC_API_KEY` unset, so zero runs and every surface legitimately empty.

## Last handoff
`comms/handoffs/M15-observability-engineer-project-on-every-span.md`

## Next
1. `fidelity-qa-reviewer` on the re-request — and what I asked them to check is whether
   any claim is wider than its evidence, not a fidelity PASS.
2. The **erasure operation** — a Langfuse delete verb, one named project-scoped `DELETE`
   across the three tables, and what `app.agent_outputs.payload` erasure means per `kind`.
   ADR first: these are the product's first destructive operations.
3. Migration for the `denied` CHECK on `ops.agent_runs` — a denied run lands as
   `cancelled` today. Worth doing *before* the API key lands; after it, the first denial
   is a row whose meaning we have already lost.
4. Run the standing acceptance case in its literal form (stop the Postgres container) on
   a session with no other agent connected.
5. Push the PDPL redaction rules into COMPANY.md with `rtl-arabic-pdpl-specialist` —
   now including *"do not flatten a structured payload before tracing or logging"*, which
   is a rule an agent can follow and a redactor cannot enforce.
