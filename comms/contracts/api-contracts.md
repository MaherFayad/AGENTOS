# CONTRACT — Runner & relay HTTP surface

**Owner:** `runner-engineer` (§3.2 routes) with `sessions-relay-engineer` (§3.1 routes)
**Source:** spec §3.1–3.3, Part V · **Status:** agreed (§3.2/§3.3 half), draft (§3.1 half)
**Code half:** `packages/contracts/src/api.ts` — hand-derived from this file. When the two
disagree, **this file wins and the TypeScript is the bug** (ADR-002).

All routes are tailnet-only (§3.6). No auth in v1 **by design** — the day a public port
opens, Authelia/Cloudflare Access goes in front first. Any route that would still be
safe on the public internet is not a reason to relax this.

---

## `POST /api/run` → SSE

```jsonc
// request
{ "agent": "sales/account-enrichment", "inputs": { "account_url": "https://…" },
  "dryRun": false }
```

Runner behavior (§3.2):
1. Load `SKILL.md` + `company/COMPANY.md` → system prompt. **Every** invocation injects
   COMPANY.md (§3.3) — that is what makes outputs sound like this company.
2. Tool allowlist = `wired_into` frontmatter **only**. Not a superset. Reject unknown.
   **Two gates, both required:** the tool's *name* must be in `wired_into`, **and** any
   path in its *arguments* must resolve inside the run's scratch workspace. The second is
   not optional decoration — `workspace` grants `Read/Write/Edit/Glob/Grep`, those tools
   accept absolute paths, and cwd only decides where a *relative* path resolves. While the
   confinement was a code comment rather than a check, a run could and did overwrite the
   repo-root `.env`. A tool call carrying no path is not a filesystem access and passes.
3. cwd = fresh per-run scratch workspace, destroyed after artifact extraction.
4. Spawn headless `@anthropic-ai/claude-agent-sdk` session.
5. Stream SSE to the drawer console; write trace + cost to Langfuse.
6. Save artifact (md/pdf/json); deliver per `deliver:` frontmatter.

SSE event names — the drawer console renders these and nothing else:

| event | data |
|---|---|
| `start` | `{runId, agent, traceUrl, startedAt, tools[], approvalRequired}` |
| `token` | `{text}` — a fragment; append to console |
| `tool` | `{name, input, status:"start"\|"ok"\|"error", durationMs?, error?}` |
| `plan` | `{summary, awaitingApproval}` — when `approval: required` the run pauses here |
| `artifact` | `{path, kind:"md"\|"pdf"\|"json"\|"txt", url, bytes}` |
| `done` | `{status:"ok"\|"error"\|"denied"\|"canceled", costUsd, durationMs, traceUrl, denialNote?}` |
| `error` | `{message, retryable, code?, hint?}` |

`tools[]` on `start` is the resolved allowlist, echoed so the console can show what the
run was permitted to touch. `done.status` carries `denied` because **a denied run is
data, not a discard** — the queue and LAST RUNS both show it.

**Replay.** SSE `id:` is the run's event sequence number (base-10, from 1), unique per
run. Reconnect with `Last-Event-ID: <n>` to receive `n+1` onward then live events; the
buffer holds 5 minutes past the run's end, so a phone that slept doesn't lose a run.
Because `EventSource` cannot POST, the reconnect path is a **GET**:

| route | purpose |
|---|---|
| `GET /api/run/:runId/stream` | re-attach to a live or just-finished run; honours `Last-Event-ID` (header or `?lastEventId=`) |
| `GET /api/run/:runId/artifact` | download the saved artifact |

## `POST /api/schedule`

```jsonc
{ "agent": "sales/account-enrichment", "cron": "0 6 * * 1" }   // cron:null unschedules
```
Writes `schedule:` into the agent's frontmatter via a git commit, then triggers ofelia
sync. Response `{ok, agent, cron, commitSha, nextRunAt, ofeliaSynced}`. The map adds the
clock badge from the frontmatter, not from this response — one source of truth. A job
that exists in ofelia but not in frontmatter is a bug, never a state to reconcile.

`ofeliaSynced:false` means the commit landed but the reload did not: the schedule is
still true, it is just not firing yet. The runner's git writes are confined to
`agents/**` (ADR-002) — a path outside it is refused with `git_write_refused`, so a
prompt-injected agent cannot commit to `apps/`.

## Approvals (§3.2)

| route | purpose |
|---|---|
| `GET /api/approvals` | pending gates → the approvals queue (Mission Control footer links here, §2.5.7) |
| `POST /api/approvals/:runId` | `{decision:"approve"\|"deny", note?}` — resumes or aborts the paused run |

A pending approval pulses the MAP node amber and fires a push notification. Denial aborts
cleanly and records the note; the run ends `done{status:"denied", denialNote}`.

## Reads

| route | returns |
|---|---|
| `GET /api/graph` | the **stored** layout artifact — see `contracts/graph-layout.md`. Never simulated (ADR-003) |
| `GET /api/agents` | `{agents:[{slug, path, frontmatter}], skipped:[{slug, reason}]}` — the list projection CHART's matrix draws from (§2.6) |
| `GET /api/agents/:slug` | `{slug, path, frontmatter, body, runnable:{tools[], missingConnectors[], approvalRequired, scheduled}}` |
| `GET /api/runs?agent=&limit=5` | `{runs:[{runId, agent, status, startedAt, durationMs, costUsd, traceUrl}]}` — **this process only**, see below |
| `GET /api/cost/today` | `{usd}` — **`observability-engineer`'s route**, not the runner's |
| `GET /api/panels` / `GET /api/panels/:id` | panel definitions (`contracts/panel-schema.md`) |
| `GET /api/status` | `{tailscale, queueDepth, activeRuns, pendingApprovals, runnerConfigured, budget, brain, ledger, graphBuilt, startedAt}` |

`:slug` is `department/agent-slug` and contains a slash — the route is a wildcard match
on everything after `/api/agents/`. **Callers must not `encodeURIComponent` the whole
slug**: the separator is part of the path, not a value inside a segment. Encode each
segment and join with `/`, so a folder name that ever grows a `%`, `?` or `#` still
arrives intact (the runner decodes each segment, and a stray `%` would otherwise throw
before any handler ran). Rows carry `startedAt` as ISO 8601, not a pre-rendered "3m ago",
so relative time stays live without polling.

### `GET /api/runs` is the queue, not the history

`/api/runs` reads the runner's **in-memory** run store (`services.store.list()`). It holds
what *this* runner process executed and nothing else, so it is empty after every restart —
including every deploy, and including a restart that happens mid-demo. It is the right read
for the live queue, for a run that has not been flushed to the ledger yet, and for anything
whose question is "what is this process doing".

It is **not** the right read for history. The durable ledger is `ops.agent_runs` in
Postgres, served by **`GET /api/metrics/runs?agent=&limit=`** (owner:
`observability-engineer`; shape in `comms/specs/observability.md`, not duplicated here —
one contract, one owner). Same row shape plus `agentName`, `costSource` and `traceUrl`;
`agent=` filters server-side; `limit` defaults to 5 and clamps to 50.

Consumers that answer "what has this agent done lately" read the ledger:

| consumer | reads |
|---|---|
| §2.3 / §2.6.5 drawer — `LAST RUNS` | `GET /api/metrics/runs` |
| §2.5 dashboards — activity feed, data tables, KPI derivation | `GET /api/metrics/*` |

This was written down after LAST RUNS shipped bound to `/api/runs` and could therefore
never show a row: the two routes have nearly the same name and nearly the same payload, and
nothing in this file said which one forgets. `done.status: "denied"` above is a row both
routes are expected to carry — note that the ledger's own CHECK constraint does not yet
accept it (`0001_ops_run_ledger.sql:31`), which is filed with `observability-engineer`.

The list form omits `body` and `runnable` on purpose: a twelve-tile matrix does not need
twelve system prompts, and the cheapest read in the app must not become the most
expensive. An agent whose frontmatter fails the schema is **absent** from `agents[]` and
named in `skipped[]` — the same rule the map follows, so the two views cannot disagree
about which agents exist. `GET /api/agents/` (trailing slash) is the collection too; it
used to answer 400 `bad_request`, which read like the caller's mistake when the route was
simply missing.

The one field the runner overlays onto the stored graph payload is
`core.brainCompleteness` (§3.3), which it computes from `company/`. Positions are served
exactly as stored.

### Ledger reachability — `unknown` is not `zero`

Every `/api/metrics/*` and `/api/cost/today` response, success or failure, carries a
sibling `ledger` object. `GET /api/status` carries the same object.

```jsonc
{ "state": "connected" | "unreachable" | "absent",
  "since": "2026-08-16T18:16:23.791Z",   // when this state began
  "attempts": 4,                          // consecutive failed reconnects; 0 when connected
  "lastError": "getaddrinfo ENOTFOUND postgres",   // message only — never a DSN or password
  "nextRetryAt": "2026-08-16T18:17:17.739Z",
  "hint": "…" }                           // written for a human on a phone; always present
```

**The rule: a count the runner cannot read is `null`, never `0`.** When the ledger is not
`connected`, `GET /api/cost/today` still answers **200** — the ticker is chrome and must not
error out — but with `{usd:null, runs:null, unpricedRuns:null}`. Every other metrics route
answers **503 `metrics_unavailable`**.

This exists because these two used to be the same bytes:

| | payload |
|---|---|
| the ledger is unreachable, so we do not know | `{usd:null, runs:0}` · `{runs:[]}` |
| the ledger is fine and nothing has run yet | `{usd:null, runs:0}` · `{runs:[]}` |

The runner lost a boot race with `initdb`, probed Postgres once, latched, and reported the
second when the truth was the first — for a whole session, while `docker compose ps` said
*healthy*. A broken state wearing the honest empty state's clothes is worse than a visible
outage, because nobody goes looking (BOARD rule 9 / Part VII.3). Consumers that render a
zero **must** read `ledger.state` first; `state: "connected"` is the only licence to draw
one.

`absent` is not a failure and must not be rendered as one: `--profile dev` runs with no
Postgres by design, which is why compose's `depends_on` carries `required: false`. The
runner reconnects on its own — a `docker restart postgres` no longer needs a runner
restart, and `state` goes `connected → unreachable → connected` without one.

### The brain write-back is not "any markdown this agent produced"

`intelligence/company-interview` is the one agent whose artifact the runner copies into
`company/COMPANY.md` and commits. That write requires **all** of:

| check | why |
|---|---|
| slug is `intelligence/company-interview` | a constant in the runner, not a frontmatter flag — an imported SKILL.md cannot grant itself brain-write |
| artifact is `md`, ≥40 chars | an empty artifact would erase the brain and commit the erasure |
| `inputs.mode` is `first-run` or `update-section` | **`review-gaps` reports on the brain; it never replaces it** |
| the artifact carries the brain's structure | `## ` headings / the `<!-- UNANSWERED` namespace, so "a document this agent produced" and "a replacement for the company's memory" are different tests |

The mode and shape checks live in the runner, not in the agent's prompt. ADR-007: a
boundary held by a sentence in a prompt is not a boundary.

## Second Brain (§3.3)

`brain` in `/api/status` is `{value, answered, total, sources, updatedAt, missing[]}` —
the fraction of the interview's twenty questions that `company/COMPANY.md` actually
answers. `missing[]` is **question labels** (`["Q7","Q8"]`), not topic keys, so a person
can find the exact lines in the file.

It is **computed, never a constant**: the galaxy's particle count and brightness scale with
it, so faking it upward would make the map lie. The measurement is the count of
`<!-- UNANSWERED: Qn -->` markers left in the file — the only signal in COMPANY.md a
template cannot fabricate — and it lives in **one** module,
`scripts/lib/brain-completeness.mjs` (`map-galaxy-engineer`'s), which both the runner and
`scripts/build-graph.mjs` import. There were two independent implementations; they scored a
file with all twenty markers still in place at 45%, and the map rendered that as brightness
for a milestone. If the module is unreachable the runner reports **zero** — never a guess,
and never a number that could be higher than the truth. `sources` is reported alongside and
is deliberately not blended in: dropping PDFs into `company/sources/` is not answering.

## WebSocket `/ws/graph`

Repo watcher (chokidar on read-only `/agents` mount) → re-parse frontmatter → call the
layout engine → push **layout deltas**, not a full payload. Frames:

| frame | meaning |
|---|---|
| `{type:"hello", version, brainCompleteness}` | sent on connect |
| `{type:"delta", delta:{version, computedAt, added[], changed[], removed[]}}` | existing nodes keep their coordinates; only new nodes settle |
| `{type:"stale", reason}` | the watcher saw a change it could not turn into a delta — refetch `/api/graph` |

`stale` exists so the watcher never pushes a plausible fake when the layout engine is
unavailable. The map animates new nodes in — their weekly-drop moment, live (Part V).

## Sessions relay (§3.1) — `sessions-relay-engineer`

Thin proxy over self-hosted happy-server. **E2E encryption stays intact: the server
never sees plaintext; decryption happens client-side with the user's key.** Any design
that decrypts server-side is rejected on sight.

| route | purpose |
|---|---|
| `GET /api/sessions` | list: name, repo, model, state (`working`\|`waiting-permission`\|`idle`), elapsed, cost |
| `GET /api/sessions/:id/stream` | SSE/WS transcript passthrough (ciphertext) |
| `POST /api/sessions/:id/input` | steer the session |
| `POST /api/sessions/:id/permission` | `{allow: bool}` — the copper Allow/Deny cards |
| `POST /api/push/subscribe` | Web Push subscription for permission prompts, failures, approvals |

## Errors

Uniform: `{error: {code, message, hint?}}` with real HTTP status. `hint` is shown to the
user verbatim, so write it for a human on a phone — an instruction they can act on, never
a stack trace. Codes and their statuses (`ApiErrorCode` / `API_ERROR_STATUS` in
`packages/contracts/src/api.ts`):

| code | status | when |
|---|---|---|
| `bad_request` | 400 | malformed body, missing required `inputs` key |
| `not_found` | 404 | no such route |
| `agent_not_found` | 404 | no `agents/<slug>/SKILL.md` |
| `invalid_frontmatter` | 422 | SKILL.md failed the schema contract — excluded from the map too |
| `tool_not_allowed` | 403 | a tool outside `wired_into` was requested mid-run |
| `unknown_connector` | 422 | a `wired_into` name has no connector wired (schema invariant 5) |
| `run_not_found` | 404 | unknown `runId`, or its buffer expired |
| `run_not_pending_approval` | 409 | decided a run that isn't at its gate |
| `approval_already_decided` | 409 | second decision on the same run |
| `invalid_cron` | 400 | not a 5-field cron |
| `git_write_refused` | 403 | write target outside `agents/**` (ADR-002) |
| `git_failed` | 500 | commit failed |
| `ofelia_sync_failed` | 502 | commit landed, reload did not |
| `graph_not_built` | 503 | no stored layout artifact yet — run `npm run graph:build` |
| `panel_not_found` | 404 | no such `panels/*.json` |
| `runner_not_configured` | 503 | no runner API key in env |
| `monthly_cap_reached` | 402 | Part V cap hit — see below |
| `layout_engine_missing` | 503 | watcher cannot reach `scripts/lib/layout.mjs` |
| `internal` | 500 | anything unclassified |

Errors that happen *after* the stream opens arrive as the SSE `error` event carrying the
same `code` and `hint`, then `done{status:"error"}`. HTTP status is only available before
the first byte, which is why the event carries both.

## Billing split (Part V) — enforce, don't just document

- Interactive sessions → the user's Claude subscription, via Happy wrapping the CLI.
- Runner → a **separate API-key workspace with a hard monthly cap**. The runner refuses
  to start a run when the cap is hit and says so in the `error` hint.

Config: `ANTHROPIC_API_KEY` (runner workspace only — never the human's subscription
credential) and `RUNNER_MONTHLY_CAP_USD`. Compose feeds the first from
`RUNNER_ANTHROPIC_API_KEY` in the **repo-root `.env`** (`--env-file .env`; there is no
`infra/.env`). The key is read from env, never logged, never put in a trace, never written
into `comms/`. At the cap, `POST /api/run` answers **402 `monthly_cap_reached`** before
spawning anything, with a hint written for the phone:

> This month's runner budget ($40.00) is spent, so no new runs can start. Raise
> `RUNNER_MONTHLY_CAP_USD` in the repo-root `.env` and restart the runner, or wait for
> 1 Sep. Your interactive Claude sessions are on a different account and are unaffected.

**A placeholder is not a key.** `.env.example` ships every secret as a `…-REPLACE-ME`
string, and a placeholder is a non-empty string — so `runnerConfigured` answered `true` on
a stack where no key had ever been supplied, and `POST /api/run` sailed past the
`runner_not_configured` gate to die inside the SDK on an upstream auth error. A value
matching `replace[-_ ]?me` or `change[-_ ]?me` counts as absent. Nothing else about a key's
shape is checked — guessing at key formats is how a valid key gets refused later.

`GET /api/status.budget` exposes `{capUsd, spentUsd, remainingUsd, blocked, period}` so
the shell can show the ceiling approaching instead of surprising someone at it.
