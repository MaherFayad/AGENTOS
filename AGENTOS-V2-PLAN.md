# AgentOS v2 — from "a map of agents" to "a place I run my company from"

**Status:** proposal. Nothing here is committed until the ADRs listed in §3 are accepted.
**Spec of record today:** [skilltree-clone-spec.md](skilltree-clone-spec.md). This document
does not replace it — it extends it with Parts VIII–XII, and it explicitly amends two
standing constraints on [comms/BOARD.md](comms/BOARD.md).
**Written:** 2026-08-16.

---

## 1. What is actually here today (the honest scan)

~42k lines across an npm-workspaces monorepo. This is not a prototype; it is a
well-disciplined, heavily-commented build that is roughly 70% of the way through its own
stated ladder. The comms protocol is real, the contracts are real, and the validators
actually fail on lies.

### Built and running

| Layer | State |
|---|---|
| `apps/web` — Next.js 15, MAP / DASHBOARDS / CHART / SESSIONS | ~298 files. All four views exist. M1/M2/M5/M6 code landed, most sitting in `review` with `fidelity-qa-reviewer`. |
| `apps/runner` — Fastify + Claude Agent SDK | ~59 files. `POST /api/run` with SSE, tool allowlisting, per-run scratch workspace, artifacts, `deliver:`, schedule-via-git-commit, approvals gate, durable run ledger in `ops.run_ledger`. |
| `packages/contracts` | Shared route table + zod-ish schemas for frontmatter, graph, panels, api. The code half of `comms/contracts/`. |
| Observability | Langfuse instrumentation, cost ticker, `/api/metrics/{runs,live,query,activity,sql}`, redaction rules, retention/prune. |
| Data plane | `postgres` + `langfuse` containers **up and healthy right now** (3h uptime). |
| `agents/**` | 12 agents across the 7 canonical departments. Frontmatter validates. 13 connectors registered. |
| `panels/*.json` | 6 dashboards, all 7 widget types exercised, no raw SQL, validator green. |
| Governance | 9 ADRs, 5 contracts, 21 handoffs, 108 inbox messages, 7 validators wired into `npm run verify`. |

### Declared but not running

`runner`, `web`, `happy`, `ofelia`, `caddy`, `tailscale` are all defined in
`infra/compose.yaml` but not up. So today the product is reachable only as `next dev` on
localhost — **not from anywhere**, which is ask #1.

### The three things the scan says out loud

1. **Every agent is `status: draft`.** By design (Part VII.3 — only a real run promotes an
   agent to `live`). But it means no agent in this repo has ever actually run end-to-end
   against a real API key. The LIVE counter is honestly zero.
2. **Connectors are a fiction.** `agents/_registry/connectors.json` declares 13 connectors
   and `allowlist.ts` mirrors them, and a test asserts the two agree. But
   `grep -rn "mcpServers" apps/runner/src` returns **nothing**. No MCP server is ever
   started or passed to the SDK. An agent with `wired_into: [exa, firecrawl]` gets an
   allowlist naming `mcp__exa__*` and then finds no such tool at runtime. The registry is a
   contract with no counterparty.
3. **There are two different agent populations and the product only knows about one.**
   `agents/**` (12 business agents, projected onto MAP/CHART/DASHBOARDS) and
   `.claude/agents/**` (14 engineering specialists that *build this repo* and never appear
   anywhere in the product). Ask #1 — "check my agents" — almost certainly means both.

---

## 2. Your six asks, mapped against reality

| # | Ask | Today | Gap |
|---|---|---|---|
| 1 | Check my agents, start them from anywhere, see what they can do | MAP + drawer + `POST /api/run` + SSE + PWA all exist | Stack isn't up past localhost; no identity; the drawer shows connector *names*, not resolved tools, health, or track record. `.claude/agents/**` invisible. |
| 2 | Build new agents + skills professionally (research-driven) | `agent-library-curator` is a build-time Claude Code subagent that normalizes imports | **Nothing** of the research → prior-art → reference-ingestion → decomposition → token-budget pipeline exists. Biggest greenfield item. |
| 3 | Department activity dashboard: overview, agent table, what they're doing, add instructions, keep chatting | panels + metrics API + run ledger + SSE console | No department-scoped dashboard, no agent-roster widget, no "currently doing", no steering a live *run* (steering exists only for Happy *sessions*), no run→conversation continuation. |
| 4 | Kanban with scheduling, agent questions, notifications | Adjacent primitives: approvals gate, web push, ofelia cron, `POST /api/schedule` | **Nothing.** No task entity, no board, no question channel beyond the binary approve/deny gate. |
| 5 | Sessions across 2 Claude accounts, OAuth/access key, see + continue local-PC sessions | Happy relay adapter + E2E envelope allowlist + `happy` service defined | Happy not running; no account model at all; no host daemon on your PCs; no OAuth. |
| 6 | MCP access, file access + indexing, memory (per agent / per department / per company) | `company/COMPANY.md` (company tier, 0/20 answered) | MCP not wired (see §1.2). No file index. No agent-tier or department-tier memory. |

**Score: two asks are ~80% done and blocked on operations. Four are greenfield.**

---

## 3. The three decisions that have to happen before any code

These are not implementation details. Each one either breaks a standing constraint on the
BOARD or determines the shape of four milestones.

### ADR-009 — Two planes: the Library (git) and the Operations plane (Postgres)

The repo's load-bearing invariant is BOARD constraint #4: *frontmatter is the single source
of truth; views are projections.* Four of your six asks introduce **mutable runtime state
that does not belong in git**: tasks moving across a board, an agent's question waiting for
your answer, memory written mid-run, session cursors, account tokens.

Trying to keep those in frontmatter would destroy the invariant (every board drag becomes a
git commit; two agents writing memory becomes a merge conflict). Trying to keep agents in
Postgres would destroy the product.

**Proposal — a hard line, stated once:**

| Plane | Store | Holds | Written by |
|---|---|---|---|
| **Library** | git (`agents/`, `panels/`, `company/`, `.claude/`) | What an agent *is*: identity, capability, schedule, approval policy, skill body, dashboard definitions | Humans and the Foundry, via commits |
| **Operations** | Postgres (`ops.*`, `app.*`) | What happened and what is pending: runs, ledger, tasks, questions, memory, sessions, index, accounts | The runner, at runtime |

Rule: **the Operations plane may never be the only place a capability is described.** A task
can reference `agents/sales/account-enrichment`; it can never *define* an agent. If you
`rm -rf` the Postgres volume you lose your history and your board — you do not lose your
company.

`ops.run_ledger` already exists and already follows this shape. This ADR just names the
pattern and stops the next four milestones from each re-litigating it.

### ADR-013 — Auth exists in v2 (amends BOARD constraints #5 and #6)

BOARD constraint #5: *"No public ports. Tailnet-only, no auth in v1 by design."*
Spec §3.6: *"the day you expose it, put Authelia/Cloudflare Access in front first."*

Ask #1 ("from anywhere") and ask #5 (OAuth, two Claude accounts) are a deliberate request to
move past that. This is a spec amendment, not a feature — write it down or the constraint
will be violated quietly by whoever ships the login screen.

**Proposal:** keep tailnet as the default and *only* transport for v2.0. Add identity
*inside* the tailnet first (so the two-account model and per-account billing work), and treat
public exposure as a separate, later ADR that requires Authelia in front of Caddy. That gets
you "from my phone in a hotel" via Tailscale — which is what "from anywhere" actually means —
without ever opening a port.

### ADR-010 — MCP runtime and credential custody

Wiring MCP is not "pass a config object". It decides:

- where credentials live (env → runner process → per-run MCP server) and whether a per-run
  scratch workspace can ever read them (**no**);
- whether MCP servers are long-lived in the runner or spawned per run (**per run**, so a
  crashed server can't poison the next run, and so the allowlist is enforced by
  *absence*, not just by policy);
- what happens when a connector is registered but its credential is missing —
  today's `unknown_connector` needs a sibling `unhealthy_connector`, surfaced in the drawer
  *before* you press Run, not as a mid-run tool error.

**Rule to preserve:** BOARD constraint — *the runner's tool allowlist is exactly
`wired_into`, never a superset.* Adding MCP must not smuggle in a default tool set.

Three more ADRs follow from the milestones and can be written just-in-time: **ADR-011**
memory tiering and write authority, **ADR-012** task-board semantics (what a task is allowed
to command), **ADR-014** Foundry token-budget policy.

---

## 4. The plan

Five phases. Phase 0 is not optional and not negotiable — every new feature below reads from
`/api/metrics/*` and the run ledger, and both are currently reporting an empty, honest zero.

---

### Phase 0 · Make it true — close the existing ladder

**Why first:** you cannot build a department activity dashboard on top of zero runs, and you
cannot judge whether the Foundry produces good agents when no agent has ever executed. This
phase adds no features. It converts a well-built repo into a running system.

| Step | Owner | Deliverable |
|---|---|---|
| 0.1 | `fidelity-qa-reviewer` | Clear the review queue. Nine specialists sit in `State: review`. M1/M2/M5/M6 flip to done or produce a numbered FAIL list. |
| 0.2 | `infra-compose-engineer` | Full stack up: `runner`, `web`, `caddy`, `tailscale`, `ofelia`. MagicDNS TLS working. Verify from the phone PWA over the tailnet. |
| 0.3 | `runner-engineer` | First real run. `RUNNER_ANTHROPIC_API_KEY` in a capped workspace; run `intelligence/company-interview`; confirm trace → Langfuse, cost → ticker, artifact → disk, row → `ops.run_ledger`. |
| 0.4 | you (30–60 min, not an agent) | Answer the 20 interview questions. `COMPANY.md` is 0/20 and it is injected into *every* run — right now every agent is reasoning about a company it knows nothing about. **This is the single highest-leverage hour in the whole plan.** |
| 0.5 | `agent-library-curator` | Run each of the 12 agents once. Promote the ones that succeed to `status: live`. The LIVE counter becomes true for the first time. |
| 0.6 | `infra-compose-engineer` | Fix the `.next` collision reported in `comms/inbox/_all/20260816-1355`: give `next build` its own `distDir` (or a separate container) so a build can never 500 the dev server again. |

**Acceptance:** you open the PWA on your phone, off your home wifi, over Tailscale; the map
shows ≥8 live halos; you tap one, press Run, and watch tokens stream in.

**Effort:** 2–4 days, mostly review-queue burn-down.

---

### Phase 1 · Make agents capable — connectors, memory, index

Answers **ask #6**, and quietly makes asks #2 and #3 possible.

#### M9 — Connectors become real (MCP runtime)

Owner: `runner-engineer` · Supporting: `infra-compose-engineer` · New contract:
`comms/contracts/connector-runtime.md`

- Extend `connectors.json` from `{label, tools, note}` to include `transport`
  (`stdio | http | sse`), `command`/`url`, `env` (names only, never values), and
  `health` (a probe command or endpoint).
- `agentSession.ts` builds `mcpServers` from the resolved `wired_into` set, per run, and
  passes it alongside the existing `allowedTools`. Servers die with the run.
- Credential custody: values live in `.env` → runner process only. A per-run scratch
  workspace never sees them. Add a test that asserts a scratch dir contains no secret.
- New failure mode `unhealthy_connector`, distinct from `unknown_connector`. Surfaced as a
  connector health dot in the drawer's WIRED INTO section **before** the Run button.
- Wire the first four for real: `exa`, `firecrawl`, `slack`, `postgres`. Leave the rest
  declared-and-unhealthy — that is honest, and the dot says so.

**Acceptance:** `sales/account-enrichment` runs against a real URL, calls `mcp__firecrawl__*`,
and a tool call outside its allowlist is refused in the trace. Deliberately not done: the
remaining 9 connectors.

**Effort:** 2–3 days.

#### M10 — Memory & file index

Owner: new specialist `memory-index-engineer` · New contract: `comms/contracts/memory-schema.md`
· ADR-011

Three tiers, exactly as you asked, each with a different write authority:

| Tier | Scope | Store | Who writes | Injected into |
|---|---|---|---|---|
| **Company** | Everything | `company/COMPANY.md` + `company/sources/*` — **git** | `company-interview` only, via commit (ADR-007 already covers this) | Every run |
| **Department** | One of the 7 | `ops.memory` rows, `scope='department'` | Any agent in that department, append-only, with a `confidence` and a `run_id` provenance | Every run in that department |
| **Agent** | One agent | `ops.memory` rows, `scope='agent'` | That agent only | That agent's runs |

Non-negotiables, because this is where a system like this rots:

- **Every memory row carries the `run_id` that wrote it.** A memory you cannot trace to a run
  is a rumour, and rumours compound.
- **Append-only with supersession**, never in-place edit. `superseded_by` points forward.
  Git history is COMPANY.md's version control; this column is the ops plane's equivalent.
- **A token budget per tier, enforced at prompt assembly.** Department memory capped at
  ~2k tokens injected, agent memory ~1k, ranked by recency × confidence. Without a cap,
  every run gets more expensive forever and nobody notices until the bill.
- **PDPL redaction happens at write time, not read time** (Part VII.4). The same
  `redaction-rules.ts` the observability plane already uses.

File access + indexing:

- A `files` connector granting scoped read over declared roots (`company/sources`,
  `audit/`, and any path you register). Not the whole disk — a registered root list, because
  BOARD constraint #6 means there is no auth boundary to fall back on.
- Index: chunk + embed into Postgres (`pgvector`), incremental via the existing chokidar
  watcher pattern. Exposed as an MCP server so it arrives through the *same* allowlist door
  as everything else — no special-case capability.
- Show it: index freshness and doc count become a KPI tile on the Intelligence dashboard.

**Acceptance:** an agent cites a sentence from a PDF in `company/sources/` with a file+page
reference; the memory it writes shows up in the drawer with its originating run linked.

**Effort:** 4–6 days. This is the largest infrastructure item in the plan.

---

### Phase 2 · Make it operable — the control plane

Answers **asks #3 and #4**. This is where AgentOS stops being a viewer and becomes a place
you work.

#### M11 — Tasks (Kanban), questions, notifications

Owner: new specialist `control-plane-engineer` · New contract: `comms/contracts/task-schema.md`
· ADR-012

**Task entity** (`ops.task`): `id`, `title`, `body`, `column` (`inbox | scheduled | running |
blocked | review | done`), `assignee` (an agent slug, a department, or `me`), `priority`,
`start_at` (your "when I need to start working"), `due_at`, `inputs` (matching the target
agent's `inputs:` schema), `run_ids[]`, `created_by`, `parent_id`.

**Board view.** A fifth tab, or — better for the aesthetic — a dashboard whose widget type is
`board`, so it inherits the existing panel/token discipline rather than inventing chrome.
Drag between columns; drag onto an agent to assign. Keyboard-first.

**Task → run binding.** Moving a task to `running` (or `start_at` firing) calls the existing
`POST /api/run` with the task's inputs and stamps `task_id` into the run ledger. **Tasks do
not get a second execution path** — they are a queue in front of the runner you already have.

**Scheduling.** Two mechanisms already exist and must not be merged:
- *Recurring* → stays in frontmatter `schedule:` → git commit → ofelia. Unchanged.
- *One-shot, "start Tuesday 9am"* → `ops.task.start_at`, fired by a runner poller.
A one-shot appointment does not belong in an agent's identity file.

**Questions — the piece that makes this actually work.** Today a run can only pause on a
binary approve/deny gate. Generalize it into `ops.question`: `run_id`, `task_id`, `prompt`,
`kind` (`approval | choice | freeform | clarification`), `options[]`, `answer`,
`answered_by`, `answered_at`, `expires_at`.

- The runner exposes an `ask_human` tool, allowlisted per agent, that blocks the run and
  emits the question. This subsumes the approvals gate rather than sitting beside it.
- Answers arrive from the board, the drawer, or a push notification action button.
- **`expires_at` is mandatory.** A run blocked forever on a question nobody saw is the
  classic failure of every system like this — it looks idle, it holds a slot, and it silently
  costs nothing while delivering nothing. On expiry: fail loudly with `question_unanswered`.

**Notifications.** Extend the existing web-push plumbing (`sessions/push/*`) beyond session
permissions to: question raised, run failed, approval pending, task start time reached,
schedule missed. One preferences surface, per-category, with quiet hours — otherwise you turn
all of it off within a week and the system loses its only channel to you.

**Acceptance:** you drop a task in `inbox` from your phone at 23:00 with `start_at` Tuesday
09:00; Tuesday it runs; the agent hits an ambiguity, asks a three-option question, pushes it;
you tap an option on your phone; the run completes and the card lands in `review` with its
artifact attached.

**Effort:** 5–7 days. The highest day-to-day value in the plan.

#### M12 — Department operations dashboards, roster, and steering

Owner: `dashboards-engineer` · Supporting: `observability-engineer`, `drawer-engineer`

- **A generated department dashboard per department** (7 of them), from a template rather
  than 7 hand-written JSON files: KPI row (runs 7d, success rate, spend, p50 latency, live
  agents, open questions), an activity feed, and an **agent roster table**.
- **Roster table** — the "check what they can do" surface you asked for. Per agent:
  name · tier · phase · status halo · schedule · resolved tool count + connector health ·
  runs 30d · success rate · spend 30d · last run · **currently doing**. "Currently doing" is
  live from the run ledger + SSE, not a poll of a cache.
- **Capability card** in the drawer: today WIRED INTO shows connector *names*. Show the
  resolved tool list, each connector's health dot, the inputs schema, approval policy,
  schedule, and the 30-day track record. That is the honest answer to "what can this agent
  do" — including when the answer is "less than its frontmatter claims, because Slack has no
  credential".
- **Steering — "add instructions"**: a text input on a *live* run that injects a user turn
  into the in-flight SDK session. The SSE stream is currently one-directional; this needs a
  companion `POST /api/run/:runId/input`. The pattern already exists on the sessions side
  (`/api/sessions/[id]/input`) — mirror it, don't invent it.
- **"Keep chatting"** — continuing a *finished* run. Decide deliberately: either resume the
  SDK session (needs session persistence in the runner, which does not exist today) or open a
  **new** run seeded with the previous transcript as context. **Recommend the second.** It is
  a day of work instead of a week, it is honest about cost, and it fits the existing
  one-run-one-trace model that the whole observability plane assumes.

**Acceptance:** open the Sales dashboard, see 4 agents with real 30-day numbers, watch one
run live, type "focus on the pricing page instead" mid-run, see it change course in the
console.

**Effort:** 4–5 days.

---

### Phase 3 · Make it grow — the Agent Foundry

Answers **ask #2**, and it is the most interesting thing in this document. Owner: new
specialist `agent-foundry-architect` · Supporting: `agent-library-curator` · ADR-014

The Foundry is itself an agent on the map (Operations department, next to `agent-auditor`) —
which means it gets a drawer, a trace, a cost, and a track record like everything else. An
agent factory that is not itself audited is how libraries fill with slop.

**The pipeline, in seven stages. Each stage is a checkpoint you can reject.**

| # | Stage | What happens | Gate |
|---|---|---|---|
| 1 | **Intake** | Interviews you: what job, what "done" looks like, who consumes the output, what must never happen, what department and tier. | You confirm the job statement. |
| 2 | **Field research** | Web search: how do humans do this job *today* — the actual workflow, the tools, the artifacts they produce, the steps practitioners say get skipped. | A sourced brief. Every claim carries a URL, same rule as `account-enrichment`. |
| 3 | **Prior art** | Scans public skill/agent repos (`wshobson/agents`, `contains-studio/agents`, `gtmagents/gtm-agents`, anthropics/skills) for anyone who has built this. Reports what they got right and what they got wrong. | A comparison table — **not** a copy-paste. |
| 4 | **Reference intake** | Asks *you* for the things research can't supply: real examples of good output, your house style, the file formats, the inspiration artifact. Files land in `agents/<dept>/<slug>/references/`. | You supply ≥1 gold-standard output, or the Foundry says so and proceeds with a named quality risk. |
| 5 | **Decomposition** | Splits the job: what goes in the always-loaded SKILL.md body, what becomes an on-demand `references/*.md`, what becomes a script, what becomes a sub-agent in `breaks_into`. | The token budget (below). |
| 6 | **Authoring** | Writes frontmatter (validated against `frontmatter-schema.md`), the skill body, references, an `inputs:` schema, guardrails, and the `ladder:` / `the_human:` / `replaces:` narrative fields the map and CHART project. | `npm run validate:frontmatter` green. |
| 7 | **Evaluation** | Generates 3–5 eval cases from the references, runs the new agent against them, diffs output vs gold standard, iterates once, reports honestly. | You accept → commit + PR. Agent enters at `status: draft`. |

**The token-budget rule** — this is the part you specifically asked for, and it needs a number
so it is checkable rather than aspirational:

- **SKILL.md body ≤ 500 lines / ~5k tokens.** It is injected into every single run.
- **Anything conditional goes to `references/`**, loaded on demand — the progressive
  disclosure pattern Claude Code skills already use.
- **Anything deterministic goes to a script**, not to prose. Prose that describes an
  algorithm costs tokens on every run and gets it slightly wrong sometimes; a script costs
  nothing and is either right or visibly broken.
- **A new validator, `npm run validate:budget`**, computes the *assembled* prompt for each
  agent — COMPANY.md + department memory + agent memory + SKILL.md — and fails over a
  ceiling. Budget the whole prompt, not one file, or memory growth eats the savings.
- The Foundry reports its own trade-off explicitly at stage 5: *"moved the objection-handling
  matrix to references/objections.md — saves 1,800 tokens per run, costs one extra tool call
  on the ~30% of runs that need it."* That sentence is the deliverable.

**And: make `.claude/agents/**` visible.** Add an eighth department, `engineering`, projecting
the 14 build specialists onto the map with the same frontmatter shape. Then the Foundry can
build engineering agents too, and "check my agents" means all of them. Note this needs a
lightweight adapter — Claude Code agent frontmatter and Command Center frontmatter are not the
same schema, and forcing either to become the other would be a mistake.

**Acceptance:** you say "I need an agent that turns customer support transcripts into a weekly
product-defect digest." Ninety minutes later there is a PR with a validated SKILL.md, three
reference files, an inputs schema, five eval cases with recorded results, and a paragraph
explaining what it deliberately left out.

**Effort:** 5–8 days. The pipeline is mostly prompt engineering plus one new validator; the
expensive part is stage 7's eval harness.

---

### Phase 4 · Make it yours everywhere — identity, accounts, session hosts

Answers **asks #5 and the rest of #1.** Owner: new specialist `identity-access-engineer` ·
New contract: `comms/contracts/identity.md` · ADR-013, ADR-015

#### Identity

- A minimal account model in `ops.account`, inside the tailnet. Session cookie or a
  device-scoped access key. **Not** a public login page — that is a later ADR with Authelia
  in front of Caddy, and it should stay later.
- Scopes matter more than users here: `read`, `run`, `approve`, `admin`. The phone that
  answers approvals at 23:00 should not be able to delete an agent.

#### Two Claude accounts (work + personal)

This is a **billing and custody** problem before it is a UI problem, and the spec already
draws the line (Part V): *interactive sessions = your Claude subscription via Happy; runner =
a separate API-key workspace with a hard monthly cap.*

- `ops.credential` holds per-account credentials — work vs personal — encrypted at rest, with
  the key outside Postgres.
- **Every run records which account paid for it.** The cost ticker and the Finance dashboard
  split by account. Without this, work and personal spend merge into one number and the whole
  point of two accounts is lost.
- OAuth where the provider supports it, long-lived access key where it does not. Store the
  *refresh* path, not just the token, or you will re-pair every few weeks and stop using it.
- A default account per department (Sales → work, and so on) with a per-run override, so the
  common case needs no decision.

#### Sessions from your local PCs

- Bring up the `happy` service (already in compose) and settle ADR-005 (Happy vs Omnara) —
  it is still open on the BOARD and it blocks this whole item.
- **Host daemon on each PC.** This is the missing piece: Happy relays sessions, but something
  must *wrap the local Claude Code CLI* and publish to the relay. That is a small always-on
  agent per machine — packaged as a launchd plist on macOS, a service on Windows.
- The E2E boundary that `sessions/relay/envelope.ts` already enforces stays exactly as it is.
  It is one of the best-designed files in the repo: rows are **rebuilt** from an allowlist,
  not filtered. Do not weaken it for multi-account — add an `account_id` to the envelope key
  list via ADR, deliberately, as that file's comment demands.
- Session list groups by account and by machine; continuing a session on your phone works
  because decryption is client-side, which it already is.

**Acceptance:** two accounts paired; sessions from your MacBook and your desktop both listed;
you continue a work session from your phone; the Finance dashboard shows work and personal
spend as two separate lines.

**Effort:** 5–7 days, plus whatever Happy's reality costs. Highest external-dependency risk in
the plan.

---

## 5. Sequencing

```
Phase 0  Make it true            ██████                                  2–4d   ← blocks everything
Phase 1  M9  Connectors real         ████                                2–3d
         M10 Memory + index            ████████                          4–6d
Phase 2  M11 Tasks + questions              ██████████                   5–7d
         M12 Dept ops + steering                 ████████                4–5d
Phase 3  M13 Agent Foundry                            ███████████        5–8d
Phase 4  M14 Identity + accounts                             ██████████  5–7d
```

**Total: roughly 5–7 focused weeks.** M9 and M10 can run in parallel with M11's schema design.
M13 depends on M9 (a Foundry that can't test connectors ships broken agents) and benefits from
M12 (the eval harness reuses the run ledger).

**If you want value soonest, reorder to: Phase 0 → M11 (Kanban) → M9 → M12 → M10 → M13 → M14.**
The board is the thing you will touch every day; memory is the thing that makes agents good
six months from now. Both matter; only one of them you feel immediately.

---

## 6. New roster

Four new specialists in `.claude/agents/`, four new contracts, one amended BOARD.

| New agent | Owns | New contract |
|---|---|---|
| `memory-index-engineer` | Memory tiers, file index, embeddings, budget enforcement | `contracts/memory-schema.md` |
| `control-plane-engineer` | Tasks, questions, notifications, scheduling | `contracts/task-schema.md` |
| `agent-foundry-architect` | The 7-stage creation pipeline, eval harness, token budget | `contracts/foundry-pipeline.md` |
| `identity-access-engineer` | Accounts, credentials, scopes, session hosts | `contracts/identity.md` |

Existing owners pick up: `runner-engineer` → MCP runtime + steering endpoint;
`dashboards-engineer` → department dashboards + roster + board widget;
`observability-engineer` → per-account cost split, question metrics;
`rtl-arabic-pdpl-specialist` → PDPL review of memory and the index (**mandatory** — this is
the first time client data lands at rest in a searchable store).

---

## 7. Risks, stated plainly

1. **The BOARD's no-auth constraint is load-bearing in the code, not just in the doc.**
   Several components assume "if you can reach it, you may do it." Adding identity is not
   additive — it is an audit of every mutating endpoint. Budget for that.
2. **Memory + index is where the PDPL flag becomes real.** Traces are already redacted at
   instrumentation. An index of `company/sources/` is a *searchable copy* of client data with
   different retention behaviour. Redact at write time; encrypt the volume; get
   `rtl-arabic-pdpl-specialist` to sign it off before it holds anything real.
3. **Cost creep is invisible until it isn't.** COMPANY.md + department memory + agent memory +
   SKILL.md + task context, injected into every run, on two accounts, on schedules. The budget
   validator in M13 should land *earlier* than M13 — pull it forward to M10.
4. **Happy is an external dependency you have not validated yet.** ADR-005 has been open since
   M4. Spike it for half a day in Phase 0 before committing Phase 4's plan to it.
5. **The Foundry can produce plausible slop at scale.** Stage 7's eval gate is the only thing
   standing between you and 60 agents that read well and work badly. If effort has to be cut
   from M13, cut stages 3 and 5 before you cut 7.
6. **Twelve agents is not sixty.** The spec's Part IV target is ~60 curated agents. The Foundry
   is how you get there, but each one still needs your judgment at stages 1, 4, and 7. Plan for
   ~2 agents per week sustained, not a batch import.
7. **The review queue is a real bottleneck.** Nine of thirteen specialists are blocked in
   `review` on one reviewer. Before Phase 0, decide whether `fidelity-qa-reviewer` runs
   parallel reviews or whether some categories self-certify.

---

## 8. Deliberately not in this plan

- **Public internet exposure.** Tailscale plus the PWA is what "from anywhere" means. Opening
  a port is a separate decision with its own ADR and its own threat model.
- **Multi-user / team access.** The scopes model is designed to allow it later; nothing here
  builds it.
- **Resuming a finished SDK session verbatim.** M12 recommends a re-seeded new run instead. If
  true resumption turns out to matter, it is its own milestone with its own persistence story.
- **Replacing the comms protocol with the Kanban board.** `comms/` is how the *build* agents
  coordinate; the board is how *you* direct the business agents. They look similar and they are
  not the same thing. Merging them would be the most tempting mistake in this plan.
