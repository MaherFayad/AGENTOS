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
| PART V | `infra-compose-engineer` | ofelia job *contents* generated from frontmatter | compose, Caddy, the ofelia container, `/repo` mounts |
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

## Coverage

| ID | Spec § | Requirement | Implemented in | Verified by |
|---|---|---|---|---|
| REQ-RUN-01 | §3.2 | `POST /api/run` loads SKILL.md + COMPANY.md into the system prompt | `apps/runner/src/lib/prompt.ts` | `apps/runner/src/lib/__tests__/runService.test.ts` |
| REQ-RUN-02 | §3.3 | Every runner invocation injects COMPANY.md; a missing brain is said out loud, not invented | `apps/runner/src/lib/prompt.ts` | `apps/runner/src/lib/__tests__/runService.test.ts` |
| REQ-RUN-03 | §3.2 | Tool allowlist is exactly `wired_into` — never a superset, no implicit Bash | `apps/runner/src/lib/allowlist.ts` | `apps/runner/src/lib/__tests__/allowlist.test.ts` |
| REQ-RUN-04 | §3.2 | A mid-run tool outside `wired_into` is `tool_not_allowed` | `apps/runner/src/lib/allowlist.ts` | `apps/runner/src/lib/__tests__/allowlist.test.ts` |
| REQ-RUN-05 | PART IV | Unknown `wired_into` names are `unknown_connector` (422), never dropped | `apps/runner/src/lib/allowlist.ts` | `apps/runner/src/lib/__tests__/allowlist.test.ts` |
| REQ-RUN-06 | §3.2 | Connector registry data half (`connectors.json`) and code half have identical keys | `agents/_registry/connectors.json` | `apps/runner/src/lib/__tests__/allowlist.test.ts` |
| REQ-RUN-07 | §3.2 | cwd is a fresh per-run scratch workspace, destroyed after artifact extraction | `apps/runner/src/lib/artifacts.ts` | — |
| REQ-RUN-08 | §3.2 | Headless session is `@anthropic-ai/claude-agent-sdk` with `permissionMode: dontAsk` and `canUseTool` | `apps/runner/src/lib/agentSession.ts` | — |
| REQ-RUN-09 | §3.2 | SSE events are only `start` `token` `tool` `plan` `artifact` `done` `error` | `apps/runner/src/lib/sse.ts` | `apps/runner/src/lib/__tests__/sse.test.ts` |
| REQ-RUN-10 | §3.2 | `start.tools[]` is the resolved allowlist | `apps/runner/src/lib/runService.ts` | `apps/runner/src/lib/__tests__/runService.test.ts` |
| REQ-RUN-11 | §3.2 | `GET /api/run/:runId/stream` honours `Last-Event-ID` (header or `?lastEventId=`) for 5 minutes past end | `apps/runner/src/lib/sse.ts` | `apps/runner/src/lib/__tests__/sse.test.ts` |
| REQ-RUN-12 | §3.2 | Artifact (md/pdf/json/txt) is saved and `GET /api/run/:runId/artifact` serves it | `apps/runner/src/lib/artifacts.ts` | — |
| REQ-RUN-13 | §3.2 | Delivery follows `deliver:` (Slack when webhook set; email declared unsupported) | `apps/runner/src/lib/deliver.ts` | — |
| REQ-RUN-14 | §3.2 | `approval: required` pauses at `plan`, listed on `GET /api/approvals`, resumed or aborted by `POST /api/approvals/:runId` | `apps/runner/src/lib/runStore.ts` | — |
| REQ-RUN-15 | §3.2 | A denied run ends `done{status:denied, denialNote}` — data, not a discard | `apps/runner/src/lib/runService.ts` | — |
| REQ-RUN-16 | §3.2 | `POST /api/schedule` writes `schedule:` via a git commit confined to `agents/**` | `apps/runner/src/lib/schedule.ts` · `apps/runner/src/lib/git.ts` | — |
| REQ-RUN-17 | §3.2 | ofelia config is regenerated from frontmatter after that commit | `scripts/sync-ofelia.mjs` | `scripts/__tests__/sync-ofelia.test.mjs` |
| REQ-RUN-18 | §3.2 | ofelia jobs POST the same `/api/run` the drawer uses | `scripts/sync-ofelia.mjs` | `scripts/__tests__/sync-ofelia.test.mjs` |
| REQ-RUN-19 | §3.2 | `GET /api/graph` serves the stored artifact and never simulates | `apps/runner/src/lib/graph.ts` | — |
| REQ-RUN-20 | §3.3 | `GET /api/graph` overlays honest `core.brainCompleteness` from `company/` | `apps/runner/src/lib/graph.ts` | — |
| REQ-RUN-21 | §3.2 | `GET /api/agents/:slug` is a wildcard (`department/agent-slug`) and returns `runnable` | `apps/runner/src/routes/api.ts` | `apps/runner/src/routes/__tests__/api.test.ts` |
| REQ-RUN-22 | §3.2 | `GET /api/runs` returns live LAST RUNS rows with ISO `startedAt` | `apps/runner/src/routes/api.ts` | `apps/runner/src/routes/__tests__/api.test.ts` |
| REQ-RUN-23 | §3.2 | `GET /api/panels` / `:id` serve `panels/*.json` without re-validating the schema | `apps/runner/src/lib/panels.ts` | — |
| REQ-RUN-24 | §3.3 | `GET /api/status.brain` is computed `{value, answered, total, sources, updatedAt, missing[]}` | `apps/runner/src/lib/brain.ts` | `apps/runner/src/routes/__tests__/api.test.ts` |
| REQ-RUN-25 | PART III | Uniform errors `{error:{code,message,hint?}}` with real HTTP status | `apps/runner/src/lib/errors.ts` | `apps/runner/src/routes/__tests__/api.test.ts` |
| REQ-RUN-26 | PART V | Monthly cap refuses `POST /api/run` with 402 `monthly_cap_reached` and a phone-written hint | `apps/runner/src/lib/billing.ts` | — |
| REQ-RUN-27 | PART V | Missing `ANTHROPIC_API_KEY` is 503 `runner_not_configured` (dryRun still allowed) | `apps/runner/src/lib/billing.ts` | `apps/runner/src/lib/__tests__/runService.test.ts` |
| REQ-RUN-28 | PART V | `WS /ws/graph` pushes layout deltas (or `{type:stale}` if the engine is missing) | `apps/runner/src/lib/watcher.ts` | — |
| REQ-RUN-29 | §3.3 | The interview is the map agent `intelligence/company-interview`; its artifact is committed as COMPANY.md | `apps/runner/src/lib/brain.ts` · `agents/intelligence/company-interview/SKILL.md` | — |
| REQ-RUN-30 | §3.3 | Interview topics are the ~20 questions (offers, ICP, pricing, Arabic/MSA, red lines, PDPL) | `apps/runner/src/lib/brain.ts` | `apps/runner/src/routes/__tests__/api.test.ts` |
| REQ-RUN-31 | §3.2 | Routes actually mount from `RUNNER_ROUTES` in `apps/runner/src/routes/api.ts` | `apps/runner/src/routes/api.ts` · `apps/runner/src/server.ts` | `apps/runner/src/routes/__tests__/api.test.ts` |
| REQ-RUN-32 | §3.2 | Git writes outside `agents/**` (and company write-back outside `company/**`) are `git_write_refused` | `apps/runner/src/lib/config.ts` | — |

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
