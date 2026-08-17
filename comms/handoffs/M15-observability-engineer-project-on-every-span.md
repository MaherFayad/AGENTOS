---
agent: observability-engineer
milestone: M15
spec: §3.5 · Part VII.4 · Plan §22 · Plan §21.8 · project-scoping.md §6
created: 2026-08-17T20:20
status: ready-for-review
---

# M15 — the project axis on the trace plane, and the erasure question it makes askable

Provenance for everything mechanical below: **scanned at 2026-08-17 20:16 +03:00 ·
`8722334` · 18 uncommitted (all mine; the tree was clean when I started).**

## The sentence, first, because it is the part that gets quoted

> **The trace plane now has a project axis and it is structural: a span that cannot name
> its project does not compile. That is a *selector*. It is not erasure. There is still no
> delete verb for the trace store anywhere in this repo, artefacts still have no project
> segment, and subject-level erasure does not reduce to a search at all. Nothing here has
> been observed working, because zero runs have executed and no span has ever been
> emitted, with or without this attribute. This is structural, and the word "empirical"
> does not apply to any claim in this file.**

Quote that whole paragraph or none of it.

## What exists now

- `apps/runner/src/observability/langfuse.ts` — `SpanScope` (`agnetos.run.id` ·
  `agnetos.project.id` · `agnetos.agent.ref`) and `SpanAttributes = SpanScope &
  Record<string, AttrValue>`. `OtelSpan.attributes` is `SpanAttributes`, so **a span
  without a project is a type error at the site that wrote it.**
- `apps/runner/src/observability/types.ts` — `RunAttribution` (`projectId`, `agentRef`,
  `sourceRef` **required**; `accountId` / `accountSource` still optional) and
  `RunInit = RunAttribution & {…}`.
- `apps/runner/src/observability/instrument.ts` — the scope computed once per run and
  spread into every span (root, tool, generation, event); `langfuse.trace.metadata.project`
  / `.agent_ref` / `.source_ref` on the root; the activity line redacted before the ledger.
- `apps/runner/src/observability/redact.ts` — `redactKeysInString`, applying the
  **unchanged** `KEY_DENYLIST` to `key: value` inside strings.
- `apps/runner/src/observability/__tests__/instrument.test.ts` — 6 new tests.
- `apps/runner/src/observability/__tests__/redaction.test.ts` — 3 new tests.
- `comms/specs/observability.md` — decisions 11–14, REQ-OBS-29…35, a new **`## Erasure`**
  section, and one stale line corrected (ADR-008 was described as *proposed, pending the
  human*; its own status field has said `accepted` since 2026-08-15).

## How to use it

There is nothing to call. The change is that two things stopped compiling:

```ts
// was fine yesterday, is a compile error now
obs.startRun({ agent: 'sales/a', department: 'sales', trigger: 'api' });
//   error TS2345: … is missing the following properties from type
//   'RunAttribution': projectId, agentRef, sourceRef

spans.push({ traceId, spanId, name, startTime, endTime, attributes: { 'x': 1 } });
//   error TS2322: … is missing the following properties from type 'SpanScope':
//   'agnetos.run.id', 'agnetos.project.id', 'agnetos.agent.ref'
```

`runService.ts` needed **no change**: it already passed all three ids to `startRun`. The
compiler named exactly the eight sites that did not (all in tests), which is the point.

## Why structural, and why this shape

`rtl-arabic-pdpl-specialist` proposed two attributes on the root span. I took the finding
and not the shape, for one reason: **an attribute somebody adds is an attribute somebody
else forgets.** The pattern this repo converged on is `lib/graph.ts` / `lib/panels.ts`
dropping their `RunnerConfig` import so that reaching for the coordinator's path stopped
compiling. The equivalent here is a required member on the span type. A span added next
year gets the project because the compiler names the site, not because whoever adds it
reads a comment.

**The `RunInit` reversal is recorded rather than done quietly.** Those fields shipped
optional with a comment defending the split: the ledger's `assertAttributed` refuses an
unattributed row at runtime, so requiring them here was said to break `--profile dev` and
the metrics fakes. That was wrong in one specific way. `assertAttributed` guards
**Postgres**, which is one of the three places a run's data lands; the **trace store** and
the **artefact directory** are not behind it. A trace shipped without a project is a leak
that has already happened by the time the ledger refuses. And the dev-profile argument
does not survive contact: naming your project has never needed a database — every real
caller resolves a `MountedProject` first, in every profile. What optionality bought was
that a *test* could omit them, which is the caller that should least be allowed to.

`assertAttributed` **stays**. Two mechanisms, deliberately redundant, the same way the read
path has two: the type stops the mistake being written, the runtime check catches an `as`
cast, a JSON boundary, or a value that is present and empty.

**Span-level and trace-level are different facts and both are set.** `agnetos.project.id`
on every span is what survives an observation export and what makes a span self-describing.
`langfuse.trace.metadata.project` on the root is what a *trace list* filters on, which is
the operation a deletion request actually needs. Neither stands in for the other.

## Is erasure executable now? **No — and here is the shape of the no**

The question the attribute makes askable, answered rather than deflected. Full version:
`comms/specs/observability.md` § *Erasure*.

| Plane | Select by project? | Delete verb? |
|---|---|---|
| `ops.agent_runs` · `ops.agent_run_tools` | yes — `project_id` NOT NULL, FK'd | prune is by **age**. `DELETE … WHERE project_id = $1` is one statement and is not written |
| `app.agent_outputs` | yes — in the unique index | same |
| Langfuse traces | **yes, as of this change** | **no.** Nothing in this repo calls a Langfuse delete endpoint |
| Artefacts on disk | **no** — `artifactsRoot/<runId>/`, no project segment (`runner-engineer`, in flight) | — |

**At project granularity it nearly terminates**: bounded by one project's traces, one
`DELETE` per table and one directory — except that the trace store has no verb and the
artefact directory has no handle.

**At subject granularity it does not reduce to a search, and that is structural rather
than a missing feature.** Redaction runs at instrumentation with no unredact path, so a
subject's name is *not in the trace* — which is excellent minimisation and is exactly what
makes *"find John Smith's spans"* unanswerable. Two outcomes, and they are opposite:

- for every field the rules catch, erasure is satisfied **by construction** — there is
  nothing there to erase, which is the strongest possible answer;
- for any field that slipped through, erasure is **impossible by search**, because the
  handle we would have searched on is the thing we removed.

So **the only erasure unit this architecture can execute is the project**: erase everything
for that client, or demonstrate the subject's data was never in the trace store. No
attribute added later fixes the subject case without un-minimising the traces, which would
be the wrong trade.

**Missing, in landing order:** (1) a delete verb for Langfuse; (2) artefacts under
`artifactsRoot/<project>/<runId>/`; (3) one named project-scoped `DELETE` across the three
tables; (4) what `app.agent_outputs.payload` erasure means per `kind`; (5) whether a trace
deleted through Langfuse's API is actually gone from its ClickHouse and blob storage, or
only from its list. **1, 3 and 4 are mine and none is in M15.** They are destructive
operations, and the first destructive operation in this product should not land in the same
change as the attribute that makes it possible. ADR number requested from the orchestrator,
not claimed.

## The two redaction items from the same sign-off

**Item A — does any span carry the approvals payload under a different name?** Yes, and it
is literally the same function. `buildPlanSummary` is traced twice
(`lib/runService.ts:303,309`) and is `renderInputs(inputs)` flattened into prose plus the
Slack channel and the email — the payload `runner-engineer` removed from
`/api/all/approvals` last night, arriving at the trace plane.

**Flattening defeated the key pass.** The key pass walks object keys; a string has none.
Demonstrated, not asserted:

```
inputs as an object:  client_name → [REDACTED:clientname]   address → [REDACTED:address]
                      date_of_birth → [REDACTED:dateofbirth]  salary → [REDACTED:salary]
the same, flattened:  - client_name: Fatima Al-Harbi · - address: 12 King Fahd Road, Riyadh
                      · - date_of_birth: 1990-04-12 · - salary: 45000 SAR
                      · - contact_email: [REDACTED:email]
```

Four of five survived; only the email, and only because its *value* had a shape a regex
knows. Closed at my boundary — `redactString` applies the **unchanged** `KEY_DENYLIST` to
`key: value` inside strings. No rule added, removed or loosened; an existing rule reaching
a surface it could not see, and it can only ever redact **more** than before, never less.
Disclosed to `rtl-arabic-pdpl-specialist` as a decision-request (they co-own the list) with
the three judgement calls spelled out — chiefly that a value runs to the next `·`, `;`, `|`
or newline and **not** to the next comma, because `address: 12 King Fahd Road, Riyadh` must
not leave `Riyadh` behind. The upstream fix — don't flatten before tracing; send
`inputKeys`, not prose — is `runner-engineer`'s and is filed.

**Item B — anything else the runner writes that redaction should have removed?** Yes, and
it is the one I did not expect. **`activity_event` / `activity_detail` had no redaction
pass at all.** They are composed from an agent-chosen `summary` and an agent-chosen
artefact *filename*, and they go into `ops.agent_runs` and onto the §2.5 activity feed —
the most-read widget on the dashboard. Every other payload in the module passes through
`redact`; this one did not, because it is *derived* rather than *received* and so did not
look like an input. An agent that writes `fatima.alharbi@acme.sa-proposal.md` was putting
a person's address on the dashboard. Fixed, composed-then-redacted (the redactor has to see
the finished sentence, since a leak can straddle the join), still at instrumentation, still
before the sink and before Postgres.

## Contracts touched

**None changed.** `contracts/panel-schema.md` and `contracts/api-contracts.md` are
unaffected: no route shape, response body or widget contract moved. `RunInit` and
`OtelSpan` are `observability/`-internal types — `runner-engineer` imports
`createObservability` from `observability/index.ts` and nothing else, and their call site
already satisfied the new requirement.

`redaction-rules.ts` is **not** edited. Its co-ownership header demands a decision-request
for adding or loosening a rule; this is neither, and it is filed anyway.

## Deliberately not done

- **`apps/runner/src/lib/langfuse.ts` — the runner's second emitter — still carries no
  project.** It posts the deprecated `/api/public/ingestion` payload and fires whenever
  `services.obs` is absent, **which is every `--profile dev` run, i.e. the only profile
  that exists today.** So *"every span the runner emits names its project"* is true of
  `observability/` and **not yet true of the runner**, and I have written it that way
  everywhere rather than claiming the wider version. Their file; two options with the diff
  written out are in their inbox. The sign-off's `Langfuse traces → not segmented` row
  should stay open until it lands.
- **No erasure operation, and no draft of one.** Above. Destructive, ADR-first, not M15.
- **No ADR number taken.** Requested from `commandcenter-orchestrator`, per
  `decisions/README.md` — 012 is vacant as the standing reminder of what taking one costs.
- **`runService.ts` / `prompt.ts` not touched.** The better fix for item A is upstream and
  is `runner-engineer`'s, and they are mid-flight on artefacts. Filed, not half-done.
- **`lib/artifacts*` untouched**, per the brief. Noted only that with traces and Postgres
  both project-selectable, artefacts are now the **only** plane with no handle at all.
- **`KEY_ALLOWLIST` unchanged.** `rtl-arabic-pdpl-specialist` floated adding `project` and
  `agent_ref`. I argued against `project`: allowlisting a key makes its string value skip
  **every** value rule, and a project slug is a string a human types — fine as
  `acme-holding`, not fine the day a project is named after its owner. Both live as span
  attributes, which never touch `redact`.
- **`createNullSink`'s fabricated URL** — already fixed and unrelated; still on my list is
  the `denied` CHECK migration and running the literal Postgres-down acceptance case.
- **Nothing empirical.** No run executed, no trace shipped, no Langfuse queried, no second
  project mounted. Whether Langfuse promotes `langfuse.trace.metadata.*` from the root span
  into a filterable trace field is **documented behaviour we have not observed**, because
  nothing has ever been indexed.
- **No commit.** As instructed.

## Verification

**Run twice, seven minutes apart, and both readings are printed** — `runner-engineer`
landed the artefact-isolation slice between them (`lib/artifacts.ts`, `lib/project.ts`,
`routes/api.ts`, `packages/contracts`, two new test files), so the second column includes
their work as well as mine. A single number off a moving tree is the thing this board keeps
asking people to stop quoting. `git status` was clean at start (`8722334`).

```
                                            20:16 (mine only)      20:23 (+ runner's slice)
npx tsc --noEmit -p …/runner/tsconfig.json  clean                  clean
npm run test:runner                         177 · 174 pass ·       178 · 175 pass ·
                                            0 fail · 3 skipped     0 fail · 3 skipped
npm test                                    162 · 161 pass ·       162 · 161 pass ·
                                            0 fail · 1 skip        0 fail · 1 skip
npm run validate:coverage                   exit 0 · 0 FAILs ·     exit 0 · 0 FAILs ·
                                            14 warns · 687 reqs ·  12 warns · 691 reqs ·
                                            649 (94%)              653 (95%)
npm run verify                              green                  green
node scripts/check-metrics.mjs              20:16 · 8722334 ·      20:23 · 8722334 ·
                                            18 uncommitted · green 29 uncommitted · green
```

Three things about that table, because the numbers alone would mislead:

- **The typecheck is load-bearing, not decorative.** The `@ts-expect-error` test is only a
  test because this command runs in CI. Verified in both directions rather than assumed:
  weakening `SpanAttributes` to `Record<string, AttrValue>` produces
  `instrument.test.ts(330,9): error TS2578: Unused '@ts-expect-error' directive` — so
  deleting the constraint breaks the build instead of silently re-opening the hole. I ran
  that, restored the file, and re-ran clean.
- **The 3 runner skips are still exactly the three BOARD names** as the ones that would
  catch a writer/schema mismatch, still on `DATABASE_URL`. My change touches the writer's
  *type*, not its SQL, so **nothing about that window improved today** and `175 / 178`
  must not be read as if it did.
- **`validate:coverage`'s +11 requirements are 7 of mine and 4 of theirs**, and the two
  warns that disappeared are theirs. My rows all resolve — and the Test column is now
  resolved too, so REQ-OBS-29…34's test paths are checked rather than decorative.

The intermediate red is worth recording because it is the finding in miniature: the first
draft of `redactKeysInString` used `String.replace`, and `replace` consumes the region it
matched — so a permitted outer key (`notes:`) swallowed a denylisted inner one
(`address:`) and never tested it. A redactor with a hole shaped like the hole it was
written to close. Caught by writing the test first; there is now a test named
*"a permitted key does not shield a denylisted one behind it"*.

## Next agent

1. **`runner-engineer`** —
   `comms/inbox/runner-engineer/20260817-2020-observability-engineer-plan-summary-flattens-inputs-into-a-span.md`.
   Read item 2 first (the second emitter): it is the one that makes my headline claim
   narrower than it sounds, and it is a ten-minute fix or a deletion.
2. **`rtl-arabic-pdpl-specialist`** —
   `comms/inbox/rtl-arabic-pdpl-specialist/20260817-2020-observability-engineer-key-denylist-now-applies-inside-strings.md`,
   plus the full answer appended to their own message in my inbox. The only decision I need
   is the delimiter set.
3. **`commandcenter-orchestrator`** —
   `comms/inbox/commandcenter-orchestrator/20260817-2020-observability-engineer-board-line-for-the-trace-plane.md`.
   Two BOARD lines and one ADR number to reserve. The second line is the one that matters:
   *"traces carry a project now"* is a true sentence that will be read as *"erasure works"*.
4. **`fidelity-qa-reviewer`** — `review-request` filed. It is source-level and not
   user-visible; the thing to check is whether any claim in this file is wider than its
   evidence.
