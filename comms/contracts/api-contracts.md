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
| `GET /api/agents/:slug` | `{slug, path, frontmatter, body, runnable:{tools[], missingConnectors[], approvalRequired, scheduled}}` |
| `GET /api/runs?agent=&limit=5` | `{runs:[{runId, agent, status, startedAt, durationMs, costUsd, traceUrl}]}` |
| `GET /api/cost/today` | `{usd}` — **`observability-engineer`'s route**, not the runner's |
| `GET /api/panels` / `GET /api/panels/:id` | panel definitions (`contracts/panel-schema.md`) |
| `GET /api/status` | `{tailscale, queueDepth, activeRuns, pendingApprovals, runnerConfigured, budget, brain, graphBuilt, startedAt}` |

`:slug` is `department/agent-slug` and contains a slash — the route is a wildcard match
on everything after `/api/agents/`. Rows carry `startedAt` as ISO 8601, not a
pre-rendered "3m ago", so relative time stays live without polling.

The one field the runner overlays onto the stored graph payload is
`core.brainCompleteness` (§3.3), which it computes from `company/`. Positions are served
exactly as stored.

## Second Brain (§3.3)

`brain` in `/api/status` is `{value, answered, total, sources, updatedAt, missing[]}` —
the fraction of the interview's topics that `company/COMPANY.md` actually answers, with
the unanswered topic keys listed. It is **computed, never a constant**: the galaxy's
particle count and brightness scale with it, so faking it upward would make the map lie.

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
credential) and `RUNNER_MONTHLY_CAP_USD`. The key is read from env, never logged, never
put in a trace, never written into `comms/`. At the cap, `POST /api/run` answers **402
`monthly_cap_reached`** before spawning anything, with a hint written for the phone:

> This month's runner budget ($40.00) is spent, so no new runs can start. Raise
> `RUNNER_MONTHLY_CAP_USD` in `infra/.env` and restart the runner, or wait for 1 Sep.
> Your interactive Claude sessions are on a different account and are unaffected.

`GET /api/status.budget` exposes `{capUsd, spentUsd, remainingUsd, blocked, period}` so
the shell can show the ceiling approaching instead of surprising someone at it.
