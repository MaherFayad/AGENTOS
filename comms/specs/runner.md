# Spec — Runner (run / schedule / approvals / Second Brain)

> The implementation spec for one owned slice of `skilltree-clone-spec.md`.
> It is checked by `npm run validate:coverage`. Every heading below is required.

## Owner

`runner-engineer`

## Spec sections covered

PART III · §3.2 · §3.3

## Boundaries — sections this spec cites but does not own

PART III is claimed only as the parent of the extra-features chapter. The sibling
sections inside it stay with the agents BOARD.md names: sessions (3.1), audit
library (3.4), observability (3.5), phone/PWA (3.6). They are listed below so
the coverage checker does not steal them from the heading above.

| Section | Owner | What is mine | What is theirs |
|---|---|---|---|
| §3.1 | `sessions-relay-engineer` | nothing — Caddy sends `/api/sessions*` and `/api/push*` to web | Happy relay, E2E decryption, push |
| §3.4 | `agent-library-curator` | scheduling the auditor when its frontmatter has `schedule:` | the agent-auditor SKILL.md itself |
| §3.5 | `observability-engineer` | calling `obs.startRun` / `finish` so a run writes a ledger row | Langfuse, `GET /api/cost/today`, LIVE, activity feed |
| §3.6 | `shell-navigation-engineer` | SSE replay for a phone that slept (`Last-Event-ID`) | the PWA, service worker, tailnet-only access model |
| PART V | `infra-compose-engineer` | ofelia job *contents* generated from frontmatter; the runner process's own **default** bind address | compose, Caddy, the ofelia container, `/repo` mounts, every published port |
| PART IV | `agent-library-curator` | `wired_into` → allowlist, `connectors.json` keys | SKILL.md schema, seeding, the validator |
| §2.1–§2.2 | `map-galaxy-engineer` | overlaying `core.brainCompleteness` on the stored artifact | the layout engine, positions, the canvas |
| §2.3 | `drawer-engineer` | the SSE event names the console renders | the drawer UI |
| §2.5 | `dashboards-engineer` | serving `panels/*.json` verbatim | the panel schema and the carousel |

## Decisions

1. **Tool allowlist = `wired_into`, exactly.** Enforced in `allowlist.ts` (`isToolAllowed`)
   as the third of three layers (SDK `allowedTools` + `permissionMode: 'dontAsk'` +
   `canUseTool`). A base set of "harmless" tools would be a superset, and a superset would
   make the drawer's WIRED INTO list a lie. Schema invariant 5: unknown connector names
   are `unknown_connector` (422), never silently dropped.
2. **Two write roots, not one wide one** — [ADR-007](../decisions/ADR-007-brain-write-back.md).
   `agents/**` for schedule commits, `company/**` for the interview write-back. Gated on
   the constant `intelligence/company-interview`, not a frontmatter flag.
3. **Frontmatter is the schedule.** `POST /api/schedule` edits `schedule:` via a git
   commit, then `scripts/sync-ofelia.mjs` regenerates `infra/ofelia/config.ini`. A job in
   ofelia but not in frontmatter is a bug. `ofeliaSynced: false` means the commit landed
   and the file was rewritten but the running daemon was not HUPed.
4. **`GET /api/graph` never simulates** (ADR-003). It serves the stored artifact and
   overlays exactly two live fields: `core.brainCompleteness` (honest, from `company/`)
   and `nodes[].approvalPending`. The open `brainCompleteness` decision-request to
   map-galaxy is theirs; the overlay stays until they answer.
5. **`GET /api/cost/today` is not a runner route.** It is `COST_TICKER_ROUTE`, owned by
   observability-engineer. This process forwards it to their handler when Postgres is up
   and does not invent a number when it is not.
6. **In-memory run store at this milestone.** The durable record is the observability
   ledger (when Postgres is up) plus the saved artifact. `GET /api/runs` is the live view
   of this process. A restart empties it; that is an honest empty state, not a fake history.
7. **The safe bind is the default; the wide bind is written down.** `RUNNER_HOST` defaults to
   `127.0.0.1`, and `infra/compose.yaml` + `infra/runner.Dockerfile` set `0.0.0.0`
   explicitly, so the container is unchanged. It was the other way round, and a bare
   `npm start` on the host therefore put an unauthenticated API on the LAN and on a Hyper-V
   bridge. BOARD constraint 5 is *no public ports, and nothing may be built that is only safe
   because auth exists* — there is no auth in v1 **by design**, and the other half of that
   design is that nothing off the tailnet can reach the process. A default that is safe only
   because the host happens to sit on a trusted network is the same defect shape, and on a
   tailnet system the exposure is real without any port being published, because a LAN is not
   a tailnet.
8. **A route that resolves a project reads that project's library — enforced by a type.**
   Every library read takes `MountedProject`, never `RunnerConfig`. Five reads used to resolve
   `:project` and then read `config.agentsDir` / `config.panelsDir` / `config.graphFile`,
   agreeing with the run path only because one library is mounted — *coincidence between two
   variables, not derivation from one* (`project-scoping.md` invariant 8). `MountedProject`
   has no config shape, so a handler that reaches for config fails to compile.
9. **The agent reads go through the cascade — the drawer shows what would run.**
   `GET /api/agents` and `GET /api/agents/:slug` resolve through `resolveForDispatch`, the
   same call `POST /run` uses, so an `agents/_overrides/**` winner is what both render and
   `AgentDetail.sourceRef` is a real resolver output rather than an inference from a path. The
   previous single-layer read meant an override could win a run while every view showed the
   project layer's file: BOARD rule 4 defeated with no wrong line of code, and no error
   message anywhere. An agent whose resolved capability would be refused at dispatch is a
   named `skipped[]` exclusion, never a tile whose WIRED INTO list cannot run.
10. **Panels are mounted per project and there is no fallthrough** (`project-scoping.md` §5.1
    Q8a). A project with no `panels/` shows an empty carousel, not the coordinator's six. A
    panel is a query shape naming agents and metrics from the library it was written against,
    so an inherited one renders another project's frame filled with this project's numbers —
    and that is indistinguishable on screen from a dashboard someone meant to build.
11. **A cross-project route is scoped *and* narrowed — the second is a separate decision, and
    only the first had been made.** `GET /api/all/approvals` is the one route on this surface
    declared `scope: 'cross-project'`, and the scope is right: a queue that shows one client's
    pending approvals is not an approvals queue. But it served `PendingApproval` — including
    `inputs`, the form data a human typed, which is the highest-PII surface the runner has.
    Everywhere else on this API, PDPL rule 4 (*client data does not cross clients*) is
    discharged by the scope; **here it has to be argued field by field, and nobody had.**
    The row is now `PendingApprovalRef`: ids, frontmatter, a timestamp, and `inputCount` —
    how many inputs there were, never which and never what.

    Two things a future reader should not have to rediscover. First, **`summary` had to go
    too, and dropping only `inputs` would have changed nothing**: `buildPlanSummary` renders
    the inputs into an `Inputs: …` line and appends the `deliver:` Slack channel and email
    address, so the summary is the same payload flattened into prose. The label is
    `agentName`. Second, **a consumer that needs to show what is being approved fetches it
    project-scoped**, and that is not a hop it would otherwise have avoided — deciding is
    `POST /api/p/:project/approvals/:runId`, so acting on a row already means entering its
    project. One click is the right price for crossing a client boundary.

    Structurally: `pendingApprovals(project)` no longer takes a `'*'` sentinel. One argument
    deciding both *which* rows come back and *whose boundary they cross* is how the fat row
    became expressible cross-project in the first place. `pendingApprovalRefs()` constructs a
    narrow row field by field, so a field added to `RunState` cannot arrive here by
    inheritance — a subtraction can be forgotten, a construction cannot.
12. **The durable bytes carry the project too, and a directory that cannot say whose it is is
    refused rather than adopted.** Artefacts were written to `artifactsRoot/<runId>/` — no
    project segment anywhere on disk. The download was safe *by cache*: `runInProject` reads an
    in-memory store bounded at 200 that dies with the process, while the files themselves knew
    nothing. It is now `<artifactsRoot>/<project>/<runId>/`, derived from `MountedProject`,
    and `artifacts.ts` does not import `RunnerConfig` — decision 8's mechanism, applied to the
    one plane that had escaped it. The scratch root moved the same way.

    The half worth writing down is the **migration**, because it is a decision and not a
    consequence. There is nothing to move: zero runs have executed, so no artefact exists
    anywhere — and that sentence expires the moment one does, which is why the rule is what
    ships. **A directory in the old layout is refused, never adopted, and never deleted**
    (`artifact_unattributed`, 500, naming the path). Adopting one would file whichever
    client's output it holds under whichever project happens to be mounted, on the strength of
    a coincidence — the same act `run_unattributed` refuses one layer up in the ledger, and a
    filesystem has no constraint that can refuse it on its own behalf. Ignoring it is that act
    with the evidence hidden; deleting it destroys a client's bytes to tidy a layout, which is
    not the runner's trade to make.

## Coverage

| ID | Spec § | Requirement | Implemented in | Verified by |
|---|---|---|---|---|
| REQ-RUN-01 | §3.2 | `POST /api/run` loads SKILL.md + COMPANY.md into the system prompt | `apps/runner/src/lib/prompt.ts` | `apps/runner/src/lib/__tests__/runService.test.ts` |
| REQ-RUN-02 | §3.3 | Every runner invocation injects COMPANY.md; a missing brain is said out loud, not invented | `apps/runner/src/lib/prompt.ts` | `apps/runner/src/lib/__tests__/runService.test.ts` |
| REQ-RUN-03 | §3.2 | Tool allowlist is exactly `wired_into` — never a superset, no implicit Bash | `apps/runner/src/lib/allowlist.ts` | `apps/runner/src/lib/__tests__/allowlist.test.ts` |
| REQ-RUN-04 | §3.2 | A mid-run tool outside `wired_into` is `tool_not_allowed` | `apps/runner/src/lib/allowlist.ts` | `apps/runner/src/lib/__tests__/allowlist.test.ts` |
| REQ-RUN-05 | PART IV | Unknown `wired_into` names are `unknown_connector` (422), never dropped | `apps/runner/src/lib/allowlist.ts` | `apps/runner/src/lib/__tests__/allowlist.test.ts` |
| REQ-RUN-06 | §3.2 | Connector registry data half (`connectors.json`) and code half have identical keys | `agents/_registry/connectors.json` | `apps/runner/src/lib/__tests__/allowlist.test.ts` |
| REQ-RUN-07 | §3.2 | cwd is a fresh per-run scratch workspace, destroyed after artifact extraction | `apps/runner/src/lib/artifacts.ts` | `apps/runner/src/lib/__tests__/workspace-confinement.test.ts` |
| REQ-RUN-08 | §3.2 | Headless session is `@anthropic-ai/claude-agent-sdk` with `permissionMode: dontAsk` and `canUseTool` | `apps/runner/src/lib/agentSession.ts` | — |
| REQ-RUN-09 | §3.2 | SSE events are only `start` `token` `tool` `plan` `artifact` `done` `error` | `apps/runner/src/lib/sse.ts` | `apps/runner/src/lib/__tests__/sse.test.ts` |
| REQ-RUN-10 | §3.2 | `start.tools[]` is the resolved allowlist | `apps/runner/src/lib/runService.ts` | `apps/runner/src/lib/__tests__/runService.test.ts` |
| REQ-RUN-11 | §3.2 | `GET /api/run/:runId/stream` honours `Last-Event-ID` (header or `?lastEventId=`) for 5 minutes past end | `apps/runner/src/lib/sse.ts` | `apps/runner/src/lib/__tests__/sse.test.ts` |
| REQ-RUN-12 | §3.2 | Artifact (md/pdf/json/txt) is saved and `GET /api/p/:project/run/:runId/artifact` serves it | `apps/runner/src/lib/artifacts.ts` | `apps/runner/src/routes/__tests__/artifact-isolation.test.ts` |
| REQ-RUN-13 | §3.2 | Delivery follows `deliver:` (Slack when webhook set; email declared unsupported) | `apps/runner/src/lib/deliver.ts` | — |
| REQ-RUN-14 | §3.2 | `approval: required` pauses at `plan`, listed on `GET /api/p/:project/approvals`, resumed or aborted by `POST /api/p/:project/approvals/:runId` | `apps/runner/src/lib/runStore.ts` | `apps/runner/src/routes/__tests__/approvals-payload.test.ts` · `apps/runner/src/lib/__tests__/company-interview.test.ts` |
| REQ-RUN-15 | §3.2 | A denied run ends `done{status:denied, denialNote}` — data, not a discard | `apps/runner/src/lib/runService.ts` | `apps/runner/src/lib/__tests__/company-interview.test.ts` |
| REQ-RUN-16 | §3.2 | `POST /api/schedule` writes `schedule:` via a git commit confined to `agents/**` | `apps/runner/src/lib/schedule.ts` · `apps/runner/src/lib/git.ts` | — |
| REQ-RUN-17 | §3.2 | ofelia config is regenerated from frontmatter after that commit | `scripts/sync-ofelia.mjs` | `scripts/__tests__/sync-ofelia.test.mjs` |
| REQ-RUN-18 | §3.2 | ofelia jobs POST the same `/api/run` the drawer uses | `scripts/sync-ofelia.mjs` | `scripts/__tests__/sync-ofelia.test.mjs` |
| REQ-RUN-19 | §3.2 | `GET /api/graph` serves the stored artifact and never simulates | `apps/runner/src/lib/graph.ts` | `apps/runner/src/routes/__tests__/project-derived-reads.test.ts` |
| REQ-RUN-20 | §3.3 | `GET /api/graph` overlays honest `core.brainCompleteness` from `company/` | `apps/runner/src/lib/graph.ts` | — |
| REQ-RUN-21 | §3.2 | `GET /api/agents/:slug` is a wildcard (`department/agent-slug`) and returns `runnable` | `apps/runner/src/routes/api.ts` | `apps/runner/src/routes/__tests__/api.test.ts` |
| REQ-RUN-22 | §3.2 | `GET /api/runs` returns live LAST RUNS rows with ISO `startedAt` | `apps/runner/src/routes/api.ts` | `apps/runner/src/routes/__tests__/api.test.ts` |
| REQ-RUN-23 | §3.2 | `GET /api/panels` / `:id` serve `panels/*.json` without re-validating the schema | `apps/runner/src/lib/panels.ts` | `apps/runner/src/routes/__tests__/project-derived-reads.test.ts` |
| REQ-RUN-24 | §3.3 | `GET /api/status.brain` is computed `{value, answered, total, sources, updatedAt, missing[]}` | `apps/runner/src/lib/brain.ts` | `apps/runner/src/routes/__tests__/api.test.ts` |
| REQ-RUN-25 | PART III | Uniform errors `{error:{code,message,hint?}}` with real HTTP status | `apps/runner/src/lib/errors.ts` | `apps/runner/src/routes/__tests__/api.test.ts` |
| REQ-RUN-26 | PART V | Monthly cap refuses `POST /api/run` with 402 `monthly_cap_reached` and a phone-written hint | `apps/runner/src/lib/billing.ts` | — |
| REQ-RUN-27 | PART V | Missing `ANTHROPIC_API_KEY` is 503 `runner_not_configured` (dryRun still allowed) | `apps/runner/src/lib/billing.ts` | `apps/runner/src/lib/__tests__/runService.test.ts` |
| REQ-RUN-28 | PART V | `WS /ws/graph` pushes layout deltas (or `{type:stale}` if the engine is missing) | `apps/runner/src/lib/watcher.ts` | — |
| REQ-RUN-29 | §3.3 | The interview is the map agent `intelligence/company-interview`; its artifact is committed as COMPANY.md | `apps/runner/src/lib/brain.ts` · `agents/intelligence/company-interview/SKILL.md` | — |
| REQ-RUN-30 | §3.3 | Interview topics are the ~20 questions (offers, ICP, pricing, Arabic/MSA, red lines, PDPL) | `apps/runner/src/lib/brain.ts` | `apps/runner/src/routes/__tests__/api.test.ts` |
| REQ-RUN-31 | §3.2 | Routes actually mount from `RUNNER_ROUTES` in `apps/runner/src/routes/api.ts` | `apps/runner/src/routes/api.ts` · `apps/runner/src/server.ts` | `apps/runner/src/routes/__tests__/api.test.ts` |
| REQ-RUN-32 | §3.2 | Git writes outside `agents/**` (and company write-back outside `company/**`) are `git_write_refused` | `apps/runner/src/lib/config.ts` | — |
| REQ-RUN-33 | PART V | `RUNNER_HOST` defaults to `127.0.0.1`; a wide bind must be declared, and compose + the Dockerfile declare it | `apps/runner/src/lib/bind.ts` · `apps/runner/src/index.ts` | `apps/runner/src/lib/__tests__/bind.test.ts` |
| REQ-RUN-34 | §3.2 | Every library read behind a project route derives from the resolved project; the coordinator's config is not reachable from `graph.ts` or `panels.ts` | `apps/runner/src/lib/project.ts` · `apps/runner/src/lib/graph.ts` · `apps/runner/src/lib/panels.ts` | `apps/runner/src/routes/__tests__/project-derived-reads.test.ts` |
| REQ-RUN-35 | §3.2 | `GET /api/agents/:slug` resolves through the cascade and carries `sourceRef` = `{layer}:{path}@sha256:…`, never inferred from the path | `apps/runner/src/lib/cascade.ts` · `apps/runner/src/lib/agents.ts` | `apps/runner/src/routes/__tests__/project-derived-reads.test.ts` |
| REQ-RUN-36 | §3.2 | `GET /api/agents` is the resolved set including `agents/_overrides/**`; an agent a run would refuse is named in `skipped[]`, never drawn | `apps/runner/src/lib/cascade.ts` · `apps/runner/src/routes/api.ts` | `apps/runner/src/routes/__tests__/project-derived-reads.test.ts` |
| REQ-RUN-37 | §2.5 | Panels are mounted per project with no coordinator fallthrough; no `panels/` is an empty carousel | `apps/runner/src/lib/panels.ts` | `apps/runner/src/routes/__tests__/project-derived-reads.test.ts` |
| REQ-RUN-38 | §3.2 | A project whose library holds no layout artifact gets `graph_not_built` naming it — never another project's graph | `apps/runner/src/lib/graph.ts` | `apps/runner/src/routes/__tests__/project-derived-reads.test.ts` |
| REQ-RUN-39 | §3.3 | A brain write-back aimed at the global tier throws `brain_write_refused` (403), not a silent `null` | `apps/runner/src/lib/brain.ts` | `apps/runner/src/lib/__tests__/brain.test.ts` |
| REQ-RUN-40 | §3.2 | `GET /api/all/approvals` carries no run `inputs` and no plan `summary` — a `scope: 'cross-project'` row is ids, frontmatter, a timestamp and `inputCount`; the values stay on the project-scoped route | `packages/contracts/src/api.ts` · `apps/runner/src/lib/runStore.ts` · `apps/runner/src/routes/api.ts` | `apps/runner/src/routes/__tests__/approvals-payload.test.ts` |
| REQ-RUN-41 | §3.5 | Every column and conflict target the ledger writer names exists in a migration, and every function it calls is defined by one — checked with no database, so the writer/schema class is caught on a laptop | `apps/runner/src/db/ledger.ts` · `apps/runner/src/db/migrations` | `apps/runner/src/db/__tests__/writer-schema-agreement.test.ts` |
| REQ-RUN-42 | §3.2 | A run's saved artefact is written to `<artifactsRoot>/<project>/<runId>/` and its scratch workspace to `<scratchRoot>/<project>/<runId>/` — both derived from `MountedProject`, which `artifacts.ts` cannot substitute with the coordinator's config | `apps/runner/src/lib/artifacts.ts` · `apps/runner/src/lib/project.ts` | `apps/runner/src/routes/__tests__/artifact-isolation.test.ts` |
| REQ-RUN-43 | §3.2 | The artifact download refuses bytes outside the serving project's artefacts directory with `artifact_unattributed` (500) and deletes nothing — a pre-M15 `artifactsRoot/<runId>/` directory is refused, never adopted | `apps/runner/src/lib/artifacts.ts` · `apps/runner/src/routes/api.ts` | `apps/runner/src/routes/__tests__/artifact-isolation.test.ts` |
| REQ-RUN-44 | PART VII.4 | `GET /api/projects` (coordinator scope) carries no client-shaped value: `budgetMonthlyUsd`, `defaultAccountId`, `hostAffinity` and `libraryRemote` are typed as the only value each may hold, so making one real stops the route compiling | `packages/contracts/src/project.ts` · `apps/runner/src/lib/project.ts` | `apps/runner/src/routes/__tests__/projects-payload.test.ts` |
| REQ-RUN-45 | §3.5 | Every `NOT NULL`-without-default column is *named* by the writer's insert, and every `ON CONFLICT` target is a unique index or constraint a migration declares, with matching partiality — still with no database | `apps/runner/src/db/ledger.ts` · `apps/runner/src/db/migrations` | `apps/runner/src/db/__tests__/writer-schema-agreement.test.ts` |
| REQ-RUN-46 | PART VII.4 | The `plan` and `approval-requested` spans carry the agent, the tools and the input **keys** — never `buildPlanSummary`'s flattened prose, which is the inputs plus the `deliver:` targets and defeats the redactor's key pass. The human-readable summary stays on the SSE frame, inside the project | `apps/runner/src/lib/runService.ts` | `apps/runner/src/lib/__tests__/plan-span-payload.test.ts` |

## Interfaces we expose

- HTTP: every entry in `RUNNER_ROUTES` (`packages/contracts/src/api.ts`).
- SSE: `RunStreamEvent` union. Drawer console renders these and nothing else.
- WS: `GraphSocketMessage` frames on `/ws/graph`.
- Connector registry: `CONNECTOR_REGISTRY` / `agents/_registry/connectors.json`.
- Ofelia input: `scheduledAgents()` / `scripts/sync-ofelia.mjs`.
- Brain: `computeBrainCompleteness`, `INTERVIEW_TOPICS`, `GET /api/status.brain`.

## Interfaces we consume

- `comms/contracts/api-contracts.md` (ours; prose wins).
- `comms/contracts/frontmatter-schema.md` (`agent-library-curator`).
- `comms/contracts/graph-layout.md` (`map-galaxy-engineer`) — stored payload, overlay only.
- `comms/contracts/panel-schema.md` (`dashboards-engineer`) — served, not validated.
- `apps/runner/src/observability/` (`observability-engineer`) — `createObservability()`.
- `scripts/lib/layout.mjs` (`map-galaxy-engineer`) — watcher only; missing → `{type:stale}`.
- `infra/ofelia/config.ini` job shape (`infra-compose-engineer`).

## Test plan

- **Unit:** allowlist deny-by-default and registry-key parity; SSE replay and
  `Last-Event-ID`; dryRun prompt assembly without the SDK; ofelia job shape.
- **HTTP inject:** `/healthz`, `/api/status`, `/api/agents/:slug`, `/api/approvals`,
  `/api/runs`, uniform 404 envelope.
- **Cross-project payload, asserted on the raw body.** `GET /api/all/approvals` with a real
  gate open, and a distinctive string planted in the inputs: the assertion is that the string
  does not appear **anywhere in `res.payload`**, not that a named key is absent. A key-absence
  test only sees the field it was told about; a body-substring test sees the field somebody
  adds next year. A *type* cannot do this job at all — TypeScript is structural, so
  `PendingApproval[]` is assignable to `PendingApprovalRef[]` and a fat row type-checks on
  the way out.
- **Writer/schema agreement, with no Postgres.** The three tests that would catch a
  writer/schema mismatch all skip on `DATABASE_URL is not set`, and the mismatch they would
  catch is silent: one bad column name in `recordRun`'s 31 and the first real run is never
  recorded, leaving the ledger empty in exactly the way an honest empty ledger is empty. The
  migrations are text and the writer's SQL is text, so the **column** half of the question is
  answerable with no database. `writer-schema-agreement.test.ts` does that, and falsifies its
  own parser: a name that does not exist must be absent, and `ops.device.identity_id` — which
  appears only inside a `--` comment in `0006` — must be absent too, because a parser that
  believed comments would invent a column and then pass a writer that used it.
  **Verified by planting `account_sourse` in the 31-column insert: FAIL, naming the column;
  reverted, tree clean.** It is a lower bound on agreement and not a substitute for
  `sql-executes.test.ts`. The three skipped tests stay owed.

  **The lower bound was raised on 2026-08-17, and two of the four things it "cannot see" it
  now can.** Both were text all along, and both are the *permissive* direction:

  - **`NOT NULL` by omission.** The columns-exist check only sees names the writer supplies,
    and the original defect was the opposite shape — 0005 made four columns mandatory and
    `recordRun` named none of them, so every name it *did* use was valid. Every `NOT NULL`
    column with no default must now be named. Serial and `GENERATED` columns are excluded on
    purpose (`app.agent_outputs.id` is `bigserial`); a checker that cries wolf gets loosened
    within a week. **Falsified:** dropping `project_id` from the insert FAILs, naming it.
  - **Whether an `ON CONFLICT` target exists at all.** The migrations declare their unique
    indexes and constraints, `DROP INDEX` is applied in file order, and partiality is
    tracked — so `writeOutput` targeting the index 0005 dropped, or omitting the predicate a
    partial index requires, both FAIL by name. **Falsified both ways**, and each reproduces a
    `42P10` this repo has actually shipped.

  What is left is genuinely not text, and the sentence stays: it cannot see **types** (the
  `make_interval(hours => $4::float8)` class), it cannot see **`CHECK`** (a legal insert every
  row violates), it reads migrations as *files* so it cannot see an index created by hand on a
  live database, and it compares column **sets**, so an expression index or a different
  operator class would satisfy it here and not in Postgres. **This is a lower bound on
  agreement, not a proof, and it is not the three skipped Postgres tests.**
- **Not automatable here:** a live SDK session against Anthropic (needs the runner's
  capped key); ofelia HUP inside compose (runner has no docker.sock — infra); push
  notifications on the approval gate (sessions-relay); the 1440px fidelity screenshot
  (this surface is an API).

## Deliberately not done

- **§3.1 sessions/push routes.** Caddy already sends them to web. Not mounted here.
- **`GET /api/cost/today` as a runner-owned route.** Forwarded to observability's
  handler when Postgres is up; absent from `RUNNER_ROUTES`.
- **Durable LAST RUNS across restarts.** `GET /api/runs` is this process's live view.
  The observability ledger is the durable store; widgets should prefer it once M3
  observability is wired. An empty list after a restart is honest.
- **Email delivery.** No SMTP in the compose stack. Slack is best-effort when
  `SLACK_WEBHOOK_URL` is set. Failures are console tokens, not failed runs.
- **Push on the approval gate.** `notifyApproval` is a hook; the payload belongs to
  sessions-relay (§3.1 / §3.6). The queue and the amber overlay still work without it.
- **ofelia HUP from this container.** The generator rewrites `config.ini`. Reload needs
  `OFELIA_SYNC_URL` or `OFELIA_HUP_COMMAND` (runner has no docker.sock). Until infra
  wires one, `ofeliaSynced` is false after a truthful rewrite — stale, not wrong.
- **Layout-engine signature change for `brainCompleteness`.** Open decision-request to
  map-galaxy. Overlay remains until they answer. The watcher already *passes* the value
  if the engine accepts `opts`; it does not fork the engine.
- **MCP servers themselves.** The registry names tools; wiring Exa/Firecrawl/Slack
  credentials is connector setup, not this milestone.
- **Distinguishing schedule vs manual trigger** on `POST /api/run`. Ofelia posts the
  same body the drawer does (one code path). A `trigger` field would be a contract
  change.
- **Auth.** Tailnet-only, none in v1 (§3.6).
- **The web app's own panel loader.** `apps/web/src/dashboards/data/load.ts` still walks a
  fixed candidate list and takes no project, and both dashboard routes discard the `:project`
  segment. The runner half is done and the resolver they need is a route
  (`GET /api/p/:project/panels`), not a fourth disk candidate — `dashboards-engineer`'s to
  switch. Six Command Centers therefore still render identically in every project, which is
  true of exactly one project today. `project-scoping.md` §5.1 Q8a.
- **The stored layout artifact does not know which project it is.** Nothing inside
  `graph.json` names a project; `MountedProject.graphFile` is the only binding. That is why a
  missing artifact is a refusal rather than a substitution — but it means a *misplaced*
  artifact could not be detected. Adding a project field is `map-galaxy-engineer`'s
  (`graph-layout.md`, ADR-003) and is filed, not assumed.
- **MAP does not yet see `agents/_overrides/**`.** `GET /api/agents` and the drawer read the
  resolved set now; the map reads the stored artifact, which `scripts/build-graph.mjs` builds
  by enumerating the project layer and skipping `_`-prefixed folders. So CHART and the drawer
  would show a winning override that MAP would not. **Latent, not live** —
  `agents/_overrides/` does not exist in any project — and the remaining half is the layout
  engine's, filed with `map-galaxy-engineer` and `agent-library-curator`
  (`agent-cascade.md` §11, "one resolver, N callers").
- **`POST /api/schedule` still writes through the single-layer loader.** It needs the project
  layer's *file path*, not the cascade's winner, and ADR-014 §3.2's rule — refuse when the
  layer written to is not the winner, naming the winning file — is specified and unbuilt. It
  is now the only shipped caller of `loadAgent`, which `one-door.test.ts` asserts exhaustively
  so the list cannot grow by accident.
- **No run-detail route was added when `inputs` left the cross-project row.** The question
  was asked, because "delete a field and leave the next person to rediscover the requirement"
  is the failure mode here. It was not needed: `GET /api/p/:project/approvals` already carries
  `summary` and `inputs`, and a consumer that wants them is already going to that project to
  press the button. Adding `GET /api/p/:project/run/:runId` for a need no consumer has stated
  would be a route invented to justify a deletion.
- **`GET /api/projects` is no longer only a comment — but it is not narrowed either.**
  Last night's note said the route is clean today *for a reason that expires*: the day
  ADR-015 Q6 makes `budgetMonthlyUsd` real, a coordinator-scoped route hands every client's
  monthly budget to any caller. The judgement asked for, and taken: **a comment asking the
  next author to remember is the weakest instrument here**, so the four declared-but-unread
  fields are now typed as the only value each may hold (`null`, `readonly []`, `false`) and
  `projects-payload.test.ts` asserts the served row key by key. Making the budget real now
  stops `toProjectSummary` compiling *on the line that leaks*, and the key-set assertion
  catches the other shape of the same mistake — a new client-shaped field on the row.
  **What is still not done is the narrowing itself**: deleting those four fields from
  `ProjectSummary` is the eventual fix, and it edits `apps/web/src/components/shell/test-harness.tsx`,
  which is `shell-navigation-engineer`'s and mid-review under M15 blocking item 2. Filed to
  them rather than taken. The type makes the deferral safe; it does not end it.
- **Nothing was proven empirically.** No second project is mounted, so "project A's inputs do
  not reach a caller in project B" is still argued from one project's row not carrying inputs
  *at all*, which is stronger than a filter but is not the same as two projects on one box.
  `project-scoping.md` §6 is unchanged by this work.
- **Ceiling enforcement on the reads is per agent, not a pass-2 validator.** A widened
  override is excluded from `/api/agents` with its reason; the other invariants in
  `agent-cascade.md` §7.2 (Class A match, `deliver` at L0, `status` from the ledger) are still
  `agent-library-curator`'s and still unbuilt.
