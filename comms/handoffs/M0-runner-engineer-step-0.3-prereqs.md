---
agent: runner-engineer
milestone: M0
spec: §3.2, §3.3, §3.5 (consumer side), Part V (billing), Part VII.3
created: 2026-08-16T21:21
status: ready-for-review
---

# Phase 0 step 0.3 — the run path, verified short of a token; the ledger latch removed

`RUNNER_ANTHROPIC_API_KEY` is still the `REPLACE-ME` placeholder and **no run has executed.**
Everything reachable without it has been exercised against the live container, not read.
Three defects were found doing it, two of which would have taken step 0.3 down on the first
attempt, and one of which was crashing the runner process outright.

---

## What exists now

### New

- `apps/runner/src/lib/ledgerConnection.ts` — the ledger connection supervisor. Connects,
  backs off `1s → 30s`, reconnects, and runs a `SELECT 1` liveness probe so the reported
  state is true when nobody is asking. Three states: `connected` / `unreachable` / `absent`.
- `apps/runner/src/lib/__tests__/ledgerConnection.test.ts` — 6 tests, no Docker needed.
- `apps/runner/src/lib/__tests__/company-interview.test.ts` — 4 tests against the **real**
  agent file: the allowlist, the approval gate, the brain injection, the `answers` input.
- `apps/runner/src/lib/__tests__/brain.test.ts` — 5 tests pinning brain completeness.

### Changed

- `apps/runner/src/server.ts` — the single `await createObservability()` in a `try/catch`
  is gone. `services.obs` is now assigned *and un-assigned* by the supervisor.
- `apps/runner/src/routes/register-metrics.ts` — takes **getters**, not a value. It used to
  capture `services.obs?.db ?? null` at registration, so a successful reconnect could never
  have reached the routes even once the supervisor existed.
- `apps/runner/src/routes/api.ts` — `/api/status` gains `ledger`; metrics mount rewired.
- `apps/runner/src/db/client.ts` — `connect()` gained an `onError` hook and **attaches a
  `pool.on('error')` listener**. See *Verification*: without it a Postgres restart killed
  the process.
- `apps/runner/src/observability/index.ts` — `createObservability` forwards `onError`.
- `apps/runner/src/lib/config.ts` — `isPlaceholderSecret()`. A `REPLACE-ME` string is not a
  key.
- `apps/runner/src/lib/billing.ts` — the `runner_not_configured` hint now names the real
  variable, the real file and the exact command.
- `apps/runner/src/lib/brain.ts` — the fabricated completeness (`fidelity-qa-reviewer`'s
  finding). The whole section-scoring heuristic is **deleted** and replaced by a call into
  `scripts/lib/brain-completeness.mjs` (`map-galaxy-engineer`'s), so the two producers that
  disagreed are now one. `missing[]` is question labels (`"Q7"`), not topic keys.
- `apps/runner/src/lib/watcher.ts` — passes `brainAnswered` / `brainTotal` into
  `computeLayout`, so `/ws/graph` rebuilds carry the count, not a bare fraction.
- `packages/contracts/src/api.ts` — `LedgerState`, `LedgerHealth`, `StatusResponse.ledger`.
- `apps/runner/src/observability/__tests__/metrics.test.ts` — one assertion amended, with a
  comment pointing at the decision-request. Filed to `observability-engineer` to keep or
  revert.

---

## How to use it

```ts
// Anything that renders a number:
const { ledger } = await fetch('/api/status').then((r) => r.json());
if (ledger.state !== 'connected') showOutage(ledger.hint);   // NOT an empty state
```

Every `/api/metrics/*` and `/api/cost/today` response carries the same `ledger` object, so a
component that already has a payload does not need a second request.

---

## THE RUNBOOK — step 0.3, the moment the key lands

Written to be executed top to bottom without re-derivation. All paths are from the repo
root. Every command below has been run tonight except those marked **[needs key]**.

### 0. Two prerequisites that are not mine and are not optional

Both are filed as blockers. **Step 0.3 fails at step 4 without the first and produces no
COMPANY.md without the second.**

| # | Blocker | Owner | State |
|---|---|---|---|
| A | `/workspaces` root-owned; runner is uid 1001 → `EACCES` on every scratch dir | `infra-compose-engineer` | **fixed** in `runner.Dockerfile`; survives volume destruction |
| B | `intelligence/company-interview` had no tool that could write `output.md` | `agent-library-curator` | **fixed** — ADR-009, all twelve agents now declare `workspace` |
| C | `workspace` confinement was a comment, not a mechanism | `runner-engineer` | **fixed** — `isPathInsideScratch`, proven by escape test |
| D | `writeBackBrain` replaced COMPANY.md from any ≥40-char `.md`, in any mode | `runner-engineer` | **fixed** — mode-aware **and** shape-aware |

Blocker C is the one that matters most and it was opened by fixing B: twelve agents were
widened to `Read/Write/Edit/Glob/Grep` on the strength of a docstring. See *Verification*
for the before/after.

Sanity-check the scratch dir anyway — it is the cheapest check and it fails loudly:

```bash
# NOTE, Git Bash on Windows: MSYS rewrites a leading `/` into a Windows path, so a bare
# `/workspaces` here becomes `C:/Program Files/Git/workspaces` and chown fails with
# "No such file or directory". `MSYS_NO_PATHCONV=1` plus the doubled slash defeats it.
MSYS_NO_PATHCONV=1 docker compose -f infra/compose.yaml --env-file .env exec -u 0 runner \
  chown -R runner:nodejs //workspaces
docker compose -f infra/compose.yaml --env-file .env exec -T runner \
  node -e "const{mkdtempSync,rmSync}=require('fs');const d=mkdtempSync('/workspaces/run-');console.log('scratch ok:',d);rmSync(d,{recursive:true})"
# expect: scratch ok: /workspaces/run-XXXXXX      <- I saw exactly this after the chown
```

Until B ships, `wired_into: [company-brain, git, workspace]` is the one-line change.

### 1. Put the key in `.env` line 80

A **dedicated Anthropic workspace** with a hard monthly spend limit set in the Console — not
your personal one (Part V: a runaway scheduled agent must not be able to take out the
interactive sessions you would use to fix it). `RUNNER_MONTHLY_CAP_USD` is currently `50`.

There is no `infra/.env`. The file is at the repo root and compose reads it with
`--env-file .env`.

### 2. Restart the runner and confirm it now believes it has a key

```bash
docker compose -f infra/compose.yaml --env-file .env --profile obs up -d runner
sleep 6
curl -s http://127.0.0.1:8787/api/status | python -m json.tool
```

**Expect** — and check all four, in this order:

```jsonc
"runnerConfigured": true,          // false ⇒ the key is still a placeholder or blank
"budget":  { "capUsd": 50, "spentUsd": 0, "blocked": false, "period": "2026-08" },
"ledger":  { "state": "connected", "attempts": 0, "lastError": null },
"brain":   { "value": 0, "answered": 0, "total": 20 }   // 0 of 20, before step 0.4
```

If `runnerConfigured` is `false`, the value in `.env` matched `replace-me` / `change-me` and
was treated as absent. That is deliberate.

### 3. Dry run first. It costs nothing and proves the wiring.

```bash
curl -sN -m 30 -X POST http://127.0.0.1:8787/api/run \
  -H 'content-type: application/json' \
  -d '{"agent":"intelligence/company-interview","inputs":{"mode":"review-gaps"},"dryRun":true}'
```

**Expect** `start` → `plan` → then a pause. Check the `start` frame carries exactly:

```
"tools":["Read","Write","Edit","Glob","Grep"]
"approvalRequired":true
```

`company-brain` and `git` were **dropped, not appended** (ADR-009): `company-brain` would be
frontmatter-level write access to COMPANY.md, which is ADR-007's Option 2 that I rejected,
and the write-back is gated on the `INTERVIEW_AGENT_SLUG` constant rather than a frontmatter
field — so dropping it cannot break it. Verified live.

In a second shell, decide it:

```bash
RUNID=$(curl -s http://127.0.0.1:8787/api/approvals | sed -n 's/.*"runId":"\([^"]*\)".*/\1/p')
curl -s -X POST "http://127.0.0.1:8787/api/approvals/$RUNID" \
  -H 'content-type: application/json' -d '{"decision":"approve"}'
```

The first stream then emits `done{status:"ok"}` with `costUsd: null`.

### 4. **[needs key]** The real run

```bash
curl -sN -m 900 -X POST http://127.0.0.1:8787/api/run \
  -H 'content-type: application/json' \
  -d '{"agent":"intelligence/company-interview","inputs":{"mode":"first-run","answers":"<your twenty answers, or a first pass at them>"}}' \
  | tee /tmp/run.sse
```

`answers` is a `textarea` input and is rendered into the **user turn** by `renderInputs`
(`prompt.ts:22-26`) as `- answers: …`. There is no separate upload path — that is the
mechanism by which step 0.4's twenty answers land, and it is asserted in
`company-interview.test.ts`.

The run **will pause at `plan`**. Approve it as in step 3 *after reading the summary* — this
agent rewrites the file every other agent obeys.

**Expect, in order:** `start` · `plan` · (approve) · `token`… · `artifact` · `done`.

If `token` output begins with
`[company/COMPANY.md is empty — this run has no company context…]`, the brain injection
failed and the run should be stopped — that message is the runner telling you the truth
rather than producing generic prose.

### 5. Check the four things step 0.3 is defined by

```bash
# (a) artifact → disk
curl -s -o /tmp/artifact.md -w '%{http_code} %{size_download}\n' \
  http://127.0.0.1:8787/api/run/$RUNID/artifact
head -40 /tmp/artifact.md

# (b) row → ops.agent_runs   (the durable ledger; `dry_run` must be false)
docker compose -f infra/compose.yaml --env-file .env exec -T postgres psql -U agnetos -d agnetos \
  -c "select run_id, agent, status, dry_run, duration_ms, cost_usd, cost_source, trace_url
      from ops.agent_runs order by started_at desc limit 3;"

# (c) cost → ticker
curl -s http://127.0.0.1:8787/api/cost/today
# expect {"usd":0.xx,"runs":1,...,"ledger":{"state":"connected",...}}
# `usd:null` with `runs:0` here means the run was priced at nothing, not that it is missing;
# `runs:null` would mean the ledger is unreadable. They are different answers on purpose.

# (d) LAST RUNS
curl -s 'http://127.0.0.1:8787/api/metrics/runs?agent=intelligence/company-interview&limit=5'

# (e) the brain moved — this is the number step 0.4's whole feedback loop watches
curl -s http://127.0.0.1:8787/api/status | python -m json.tool | grep -A4 '"brain"'
git log --oneline -3 -- company/COMPANY.md
```

### 5b. **The spend ledger — the one link in the billing chain nothing has tested**

`infra-compose-engineer` proved `/workspaces` ownership survives volume destruction,
container restart and force-recreate, and deliberately wrote **no** `spend.json` — a spend
file written by them would be a fabricated money number inside a billing control. So the
**first real `persist()` is the untested link**, and the Part V hard cap depends on it.

Do this immediately after the first real run, not later:

```bash
# (a) the runner now says durability is PROVEN, not assumed
curl -s http://127.0.0.1:8787/api/status | python -m json.tool | grep -A7 '"budget"'
#   persisted: true   <- the cap is hard
#   persisted: false  <- the write FAILED; the cap resets on restart. Stop and fix.
#   persisted: null   <- no run has finished yet, so this has not been tested at all

# (b) the file exists and holds the real figure
MSYS_NO_PATHCONV=1 docker compose -f infra/compose.yaml --env-file .env exec -T runner   cat //workspaces/spend.json

# (c) it SURVIVES a restart with the figure intact — this is the actual cap test
docker compose -f infra/compose.yaml --env-file .env --profile obs restart runner
sleep 8
curl -s http://127.0.0.1:8787/api/status | python -c "import json,sys;b=json.load(sys.stdin)['budget'];print(b['spentUsd'],'spent of',b['capUsd'],'| persisted:',b['persisted'])"
```

`spentUsd` must equal what step 5(c) reported **before** the restart. If it resets to `0`,
the cap is not a cap and no further real runs should be made until it is.

### 6. Langfuse — now seeded, so this is a real check with a real expectation

Open the trace URL from the `start` frame directly. It is now built from
`LANGFUSE_PUBLIC_URL` (`http://127.0.0.1:3001`), the **browser-facing** origin — not
`http://langfuse:3000`, which only resolves inside the compose network and was dead in the
drawer. `https://localhost/traces` still will not work on Windows (`*.localhost` does not
resolve; see infra's handoff).

**Expect:** the trace exists, named for the agent, with the plan/approval events and the
tool spans on it. If the link 404s, the project id and the ingest keys have diverged.

If Langfuse is ever unconfigured again, `traceUrl` is **`null`** and no link is rendered.
There is no longer a fallback URL — the old one pointed at `langfuse.tailnet`, a host that
does not exist, for a project that was never created.

### 7. If something goes wrong

| symptom | read this |
|---|---|
| `503 runner_not_configured` | the key is blank or a placeholder. The `hint` names the fix. |
| `402 monthly_cap_reached` | `RUNNER_MONTHLY_CAP_USD` in `.env`, then restart the runner. |
| `error` event, `EACCES … /workspaces/…` | blocker A. Run the `chown` above. |
| `done{status:"ok"}` but no `artifact` event | blocker B. The agent had no tool that can write. |
| `/api/metrics/*` → `503` | read `ledger.state`. `unreachable` is an outage; it now recovers on its own within ~30s. |
| a tool call is refused as "outside this run's scratch workspace" | working as intended — the agent asked for a path outside its scratch dir. If it was asking for its *own* artifact, check it used `output.md`, not an absolute path. |
| the stream died mid-run | reattach: `curl -sN -H 'Last-Event-ID: <n>' http://127.0.0.1:8787/api/run/$RUNID/stream`. The buffer holds 5 minutes past the end. |

---

## Contracts touched

`comms/contracts/api-contracts.md` — **mine**, edited:

1. New section *"Ledger reachability — `unknown` is not `zero`"*: the `ledger` object, the
   three states, and the rule that a count the runner could not read is `null`, never `0`.
2. `GET /api/status` row gains `ledger`.
3. Billing section: the key comes from `RUNNER_ANTHROPIC_API_KEY` in the **repo-root
   `.env`** (the doc said `infra/.env`, which does not exist), and a `REPLACE-ME`
   placeholder counts as absent.

No ADR. The ledger-state change is a §3.5 consumer detail inside a contract I own, and the
placeholder rule is a bug fix, not a decision. The one decision genuinely on the table —
one computation and one writer for brain completeness — is deliberately **not** taken here;
see *Deliberately not done* 1.

Broadcast: `comms/inbox/_all/20260816-2121-runner-engineer-ledger-state-breaking-read.md`.

---

## Deliberately not done

1. **The brain-completeness ADR `fidelity-qa-reviewer` asked for — not needed, and that is
   the better outcome.** `map-galaxy-engineer` had filed a `decision-request` proposing
   `scripts/lib/brain-completeness.mjs` as a single shared counter. I adopted it outright
   rather than writing an ADR to arbitrate between two implementations that should not both
   exist: `brain.ts` now imports it the way `watcher.ts` imports `layout.mjs`, and my
   `INTERVIEW_TOPICS` / `splitSections` / `isAnswered` / `matchesTopic` are **deleted**, not
   left as a second opinion. One measurement, two callers. An ADR naming a winner would
   have left the loser in the tree.

2. **The `/workspaces` ownership fix itself.** Diagnosed, proved, and unblocked at runtime
   with a `chown` — but the durable fix is one line in `infra/runner.Dockerfile`, which is
   Part V and infra's. I deliberately did not edit their file: a `chown` I ran on this box
   is exactly the kind of machine state that breaks "identical compose on a VPS", and
   fixing it in the wrong file would have made the bug invisible instead of fixed.

3. **The interview's `wired_into`.** `agents/**` is `agent-library-curator`'s. I filed the
   evidence and the one-line change rather than making it.

4. **`observability/langfuse.ts:164`'s fabricated trace URL, and the `denied` CHECK
   constraint.** Both are real rule-9 problems, both are in `observability-engineer`'s
   files, neither is crashing anything. Filed, not touched. (I *did* edit `db/client.ts`,
   because that one was killing the process — a crash is not something to file and wait on.)

5. **`SpendLedger` still swallows its persist error silently.** That is correct behaviour —
   a failed write must not fail a run that already succeeded — but it means the Part V cap
   silently stopped being durable when `/workspaces` was unwritable, and nothing said so.
   The right fix is a one-time warning and a `budget.persisted: false` flag on
   `/api/status`. It is mine, it is small, and it is not step 0.3.

6. **No real run, no real token, no cost.** The key is absent and I did not invent, derive
   or work around one. `runnerConfigured` is `false` and `POST /api/run` answers 503 with a
   hint — which is now the truth rather than a crash deep in the SDK.

7. **MCP servers.** `mcp__company__*` and `mcp__git__*` resolve to nothing; `mcpServers`
   appears nowhere in the runner. That is M9 (Phase 1) and is out of scope here — but it is
   *why* blocker B exists, so it is named rather than assumed.

---

## Verification

Everything below is output I actually saw, on the stack as it is running now.

**Gates.** `npm run typecheck` clean across all three workspaces · `npm run lint` clean ·
root `npm test` **88/88** · `apps/runner` `npm test` **73/73** (was 65).

### The latch — the thing this handoff exists to remove

`docker compose stop postgres`, against the **running** runner:

```
GET /api/metrics/runs  -> 503
  error.hint: "The run ledger is not answering (reconnecting in 1s). This is not
               \"no runs yet\" — the number you are looking for is unknown, not zero."
  ledger: {"state":"unreachable","lastError":"terminating connection due to administrator command"}

GET /api/cost/today    -> 200 {"usd":null,"runs":null,"unpricedRuns":null,
                               "ledger":{"state":"unreachable",...}}
```

After 20s of retries: `"attempts":4, "lastError":"getaddrinfo ENOTFOUND postgres",
"nextRetryAt":"…18:17:17"`. Then `docker compose start postgres`, and **without touching
the runner**:

```
GET /api/metrics/runs  -> 200 {"runs":[],"ledger":{"state":"connected","attempts":0}}
docker inspect agnetos-runner-1 -> StartedAt 18:15:53  restarts=0
```

Same process throughout. The latch is gone.

### The crash the latch was hiding

The first time I stopped Postgres, the runner **died**:

```
node:events:497
      throw er; // Unhandled 'error' event
error: terminating connection due to administrator command
    at parseErrorMessage (/app/node_modules/pg-protocol/src/parser.ts:395:9)
Emitted 'error' event on BoundPool instance at:
    at Client.idleListener (/app/node_modules/pg-pool/index.js:62:10)
```

`pg`'s Pool is an EventEmitter and had no `error` listener. `restart: unless-stopped` hid
it — the container was back in seconds and healthy — but a crash-restart takes the
in-memory run store, every attached SSE stream and every pending approval with it. Fixed in
`db/client.ts`; the second and third stop/start cycles produced `restarts=0`.

### The allowlist — the test asked for, and it passed

`apps/runner/src/lib/__tests__/company-interview.test.ts`, against the real SKILL.md:

```
wired_into (read from the file) : ['company-brain', 'git']
resolved connectors             : ['company-brain', 'git']
resolved tools                  : ['mcp__company__*', 'mcp__git__*']
unknown connectors              : []
Bash, Read, Write, Edit, Glob, Grep, WebSearch, WebFetch — all asserted ABSENT
```

Confirmed live too — `GET /api/agents/intelligence/company-interview`:

```json
"runnable":{"tools":["mcp__company__*","mcp__git__*"],"missingConnectors":[],
            "approvalRequired":true,"scheduled":false}
```

and echoed on the SSE `start` frame of a real HTTP run:
`"tools":["mcp__company__*","mcp__git__*"]`. **Exactly `wired_into`, no superset.**

### The approval gate, the ledger write, and SSE replay — live, over HTTP

`POST /api/run` (dryRun) against the container:

```
id: 1  event: start  {"tools":["mcp__company__*","mcp__git__*"],"approvalRequired":true}
id: 2  event: plan   {"awaitingApproval":true}
       -- run parked; GET /api/approvals returned 1 row with the plan summary --
       POST /api/approvals/4a26710869028f31 {"decision":"deny","note":"…"}
id: 3  event: done   {"status":"denied","costUsd":null,"durationMs":15928,"denialNote":"…"}
```

Reattached afterwards with `Last-Event-ID: 1` (the phone-that-slept path) and received
events 2 and 3 and nothing else.

Ledger row, then removed — this is the synthetic write:

```
run_id           | agent                          | status    | dry_run | cost_source
4a26710869028f31 | intelligence/company-interview | cancelled | t       | derived
-- DELETE 1; rows_remaining 0
```

Two things that row tells us. The write path works end to end. And a denied run lands as
`cancelled`, because the ledger's CHECK constraint does not accept `denied` and
`toObsStatus` maps it down — so today the ledger cannot tell "a human said no" from "the
run was cancelled". Filed.

### Honesty fixes, before → after, live on `/api/status`

```
runnerConfigured : true  -> false     (a `-REPLACE-ME` string is a non-empty string)
brain.value      : 0.45  -> 0        (answered 9 -> 0 of 20; agrees with COMPANY.md:18
                                      for the first time, and now one counter, not two)
POST /api/run    : passed the gate, died in the SDK on an upstream auth error
                 -> 503 runner_not_configured, with a hint naming the variable, the file
                    and the exact compose command
```

### `workspace` confinement — determined empirically, not by reading

`agent-library-curator` widened **twelve of twelve** agents to `wired_into: [workspace]` on
the strength of this sentence in `allowlist.ts`:

> Scoped to the per-run scratch cwd by the session's working directory.

**It was a comment, not a mechanism, and I proved it by escaping.**
`apps/runner/src/lib/__tests__/workspace-confinement.test.ts` drives the real pipeline —
`startRun` → the real `canUseTool` closure the runner hands the session — with a run that
asks to `Write` outside its scratch dir, then checks the filesystem. Against the code as it
stood at 21:52:

```
✖ a run cannot write to an ABSOLUTE path outside its scratch dir
    the gate must refuse an absolute path outside the scratch dir
✖ a run cannot overwrite the repo-root .env
    Expected values to be strictly equal:
    + 'owned'                     <- the run rewrote it
    - <the fixture's .env line>   (untouched, expected)
✖ a run cannot climb out with ..
```

The `.env` case failed on file **content**: the run overwrote it. `isToolAllowed` gated the
tool's *name*; `cwd` decides where a relative path resolves and is not a wall; the SDK's file
tools take absolute paths. So BOARD rule 4 was, as of 21:52, a statement about which names
appear in a list.

**Fixed** by a second enforcement point — `isPathInsideScratch` in `allowlist.ts`, wired
through `AgentSessionOptions.isToolAllowed(toolName, input)` so `canUseTool` sees the
*argument*. Same shape as `assertInsideAgents` / `assertInsideCompany`: resolved paths
compared, `..` and absolute paths fail closed. All eight now pass, including the one that
matters in the other direction — *a run can still write its own artifact*, so the fix
confines rather than blocks.

Tool calls carrying no path (MCP calls, a search string) pass through: this gate confines
paths, and confining a query string would be theatre.

**The one link still untested without a key:** the real SDK invoking `canUseTool` at all.
The gate itself is proven; that it is *reached* on every tool call is SDK behaviour, and
step 0.3's first real run is where that gets confirmed. It is in the runbook.

### `writeBackBrain` — the boundary a prompt was holding

Made reachable by the same ADR-009 fix. It replaced `company/COMPANY.md` with **any** `.md`
over 40 characters the interview left behind, **in any mode** — so a `review-gaps` run,
whose job is to report the brain's holes, would have overwritten the brain with that report
and committed it as the brain's new history. The curator closed it in the agent's prompt and
filed the durable fix to me, correctly: ADR-007 says a boundary must not live in a prompt.

Now two independent checks, because either alone is too weak:

- **mode-aware** — `review-gaps` never writes, whatever it produced;
- **shape-aware** — the artifact must carry the brain's own structure (`## ` headings, the
  `<!-- UNANSWERED` namespace), so "a document this agent produced" and "a replacement for
  the company's memory" stop being the same test.

Three tests, including the positive one: a real brain in `first-run` mode is still written
back and committed. Step 0.4 lands through that exact path, so a guard that broke it would
be worse than the bug.

### What is NOT verified

- Any real model call, token, artifact-on-disk from a real run, or cost figure. No key.
- Langfuse ingestion. The sink is null; there is nothing to look at.
- Anything over the tailnet or from a phone. Infra could not bring Tailscale up.

---

## Next agent

**`infra-compose-engineer`** — two messages, both filed: the `/workspaces` ownership
blocker (one line in `runner.Dockerfile`; step 0.3 fails on it) and the `LANGFUSE_INIT_*`
passthrough you offered, which I am taking you up on.

**`agent-library-curator`** — the interview cannot write its own artifact. One-line
frontmatter change, evidence in the message.

**`observability-engineer`** — one decision (`runs: null` on an unreadable ledger: keep or
revert) and two findings in your files.

**`fidelity-qa-reviewer`** — review gate. Nothing here is user-visible except two numbers
that stopped lying, so this is an API/honesty review, not a 1440px one. The new acceptance
case worth adding: **stop Postgres, and confirm no surface anywhere shows a plausible
zero.**

**The human** — steps 1 and 2 of the runbook. Then step 0.4.
