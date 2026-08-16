# AgentOS v2 — from "a map of agents" to "a place I run my company from"

**Status:** proposal. Nothing here is committed until the ADRs listed in §3 and §18 are accepted.
**Spec of record today:** [skilltree-clone-spec.md](skilltree-clone-spec.md). This document
does not replace it — it extends it with Parts VIII–XII, and it explicitly amends two
standing constraints on [comms/BOARD.md](comms/BOARD.md).
**Written:** 2026-08-16.

> **This document has two halves.**
> **Part One (§1–§8)** is the original v2 proposal: six asks, three ADRs, five phases,
> single-project, single-device, one you.
> **Part Two (§9–§24)** is the platform pass, added the same day. It takes AgentOS from
> *one repo that is your company* to *a coordinator that mounts many projects, reachable from
> every device you own.* It **supersedes §5's sequencing** and **amends four of Part One's
> milestones** — both are stated explicitly in §19 and §20. Everything else in Part One
> stands.

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

---
---

# PART TWO — AgentOS as a platform

*Added 2026-08-16. Part One assumed one project, one machine, one you. Every path in the repo
encodes that assumption: `agents/`, `panels/`, `company/COMPANY.md` are singular nouns. This
half removes that assumption, and it is a change to what AgentOS **is**, not a feature bolted
onto what it already does.*

---

## 9. The reframe — AgentOS stops being a repo and becomes a thing that mounts repos

Today this repository *contains* your company. That was the right call at 12 agents and it is
the wrong call at 4 projects.

**Proposal:** AgentOS is a **coordinator** you point at N project libraries. This repository
becomes `project: AgentOS` — the dogfood project, not the universe. Its `agents/**` become one
project's library among several, and `.claude/agents/**` become that project's engineering
department (Part One §3 already proposed making them visible; this is why it matters).

ADR-009 named two planes. The platform needs a third, and the third one is the unlock.

| Plane | What it holds | Where it lives | Who writes it |
|---|---|---|---|
| **Library** | What an agent *is* — identity, capability, skill body, dashboards, schedules-as-identity | N git repos + one global library | Humans and the Foundry, via commits |
| **Operations** | What happened and what is pending — runs, threads, tasks, memory, index, schedules, fires, accounts | One Postgres, on the coordinator | The runner and the scheduler, at runtime |
| **Execution** | Machines that can actually *do work* | Host daemons — home server, MacBook, desktop, later a cloud box | Nothing; they are workers |

### The rule that makes "from anywhere" easy

> **Your phone is never an execution host. It is a control surface.**

A run therefore carries a **placement decision**: which host is allowed and able to execute it.
A project whose code only exists on the desktop routes there. A repo-less research project runs
on the server. The phone never needs the code, the credentials, or the disk — which is why
controlling a build from a hotel is a routing problem, not a security problem.

The corollary reshapes the desktop app: **its real job is to be an execution host with a UI
attached**, not a second window onto the web app. That is the reason to build it at all.

### What this does to the Library plane

`ops.project` describes a mount, never a capability (ADR-009's rule holds):

| Column | Meaning |
|---|---|
| `id`, `slug`, `name` | identity |
| `library_path` / `library_remote` | the git repo holding `agents/`, `panels/`, `company/` |
| `workspace_root` | where runs get their scratch space |
| `host_affinity[]` | which execution hosts may run this project |
| `default_account_id` | which Claude account pays, by default |
| `budget_monthly` | hard cap, enforced by the scheduler and the runner |
| `status` | `active · paused · archived` |

**Non-negotiable:** deleting a project row detaches a library. It never deletes one. If you
`rm -rf` the Operations volume you lose history, board state and memory — you do not lose a
single agent, in any project. That is the same promise ADR-009 already makes, extended.

---

## 10. Projects and the agent cascade

Agents resolve through a cascade, the way CSS does and the way Claude Code's own user/project
settings already do. This is a pattern you already have muscle memory for.

```
global library          ~/agentos/global/agents/**      code-reviewer · researcher · writer
      ↓ overridden by
project library         <repo>/agents/**                sales/account-enrichment
      ↓ overridden by
project-local override  <repo>/agents/_overrides/**     "the global code-reviewer, Arabic-aware"
```

Resolution is by slug, most-specific wins, and the resolved set is what MAP / CHART /
DASHBOARDS project. **Frontmatter is still the single source of truth (BOARD #4) — the cascade
changes which files are read, never where the truth lives.**

Three moves make this feel alive rather than administrative:

- **Promote** — an agent proven in one project graduates to the global library. One button, one
  PR, and it appears in every project's map.
- **Fork** — take a global agent and specialize it here. The fork records `forked_from` and its
  parent's commit SHA, so drift is visible and a parent improvement can be offered downstream.
- **Provenance is always on screen.** `⌂ global` · `▣ project` · `⑂ forked from global@a1b2c3`.
  You must never have to wonder which one you just ran. A forked agent whose parent has moved
  on shows a staleness dot — the same honesty rule as connector health.

### Shape is shared, roster is not

Every project gets the same seven departments (ADR-001), so navigation transfers between
projects instantly. Sales-in-AgentOS and Sales-in-ClientX are different rosters inside an
identical frame. An eighth department, `engineering`, holds the build specialists per project.

### What becomes project-scoped

Effectively everything in the Operations plane: `ops.run_ledger`, `ops.memory`, `ops.task`,
`ops.question`, `ops.thread`, `ops.schedule`, the index, the metrics API, the panels resolver.
**This is an audit of every existing table and every existing route, not an addition to them**
(§7 risk 1, now realized). Budget for it as such — it is the reason this phase comes first.

---

## 11. Identity, devices, and billing accounts — three things, not one

Part One §4 (Phase 4) treats "accounts" as one concept. It is three, and conflating them will
produce a schema you have to unpick later.

| Concept | Question it answers | Table |
|---|---|---|
| **Identity** | Who is asking? | `ops.identity` — one row: you. Designed to allow more, building none (Part One §8 stands). |
| **Device** | From what, with what powers? | `ops.device` — name, platform, public key, scopes, last seen, revocable |
| **Billing account** | Who *pays* for this run? | `ops.credential` — work vs personal Claude accounts, encrypted at rest, key outside Postgres |

They are orthogonal: **one you, N devices, M paying accounts.**

- **Scopes live on the device, not the identity.** The phone that answers approvals at 23:00
  gets `read · run · approve`. It does not get `admin`. Losing a phone is then a revocation,
  not an incident.
- **Every run records the account that paid**, per project. The cost ticker and the Finance
  dashboard split by account *and* by project. Part One already requires this; the addition is
  that project is now a second axis.
- **Default account per project, override per run.** The common case needs no decision.
- **Store the refresh path, not just the token.** Part One says this and it remains the single
  most likely thing to be skipped and then regretted.

### Device handoff

Because identity is separate from device, continuity is nearly free and worth building
deliberately: a thread open on your phone reappears on the laptop with scroll position and
unsent draft intact; presence shows "open on 2 devices". Small feature, and it is most of the
difference between "four clients" and "one system".

**Transport stays as ADR-013 proposed:** tailnet-only for v2. Native mobile clients use the
Tailscale app like everything else. Public exposure remains a later ADR with Authelia in front
of Caddy (Part One §8 stands).

---

## 12. Threads — the unification, and the largest single idea in this document

AgentOS currently has three concepts that are the same shape wearing different clothes:

| Today | What it is |
|---|---|
| **Session** (Happy, §3.1) | A conversation with Claude Code on a machine |
| **Run** (`POST /api/run`, §3.2) | A one-shot conversation with an agent, streamed over SSE |
| **Task** (M11, proposed) | A conversation you want to happen later |

They all mean: *a conversation with something that does work.* Keeping them separate is why
Part One's M12 has to invent a steering endpoint that duplicates the sessions one, and why
"keep chatting after a run" is awkward enough to need a recommendation.

> **A thread is the unit. A run is a thread with an agent on the other end. A session is a
> thread hosted by a CLI. A task is a thread with a due date. A schedule creates threads.**

`ops.thread`: `id`, `project_id`, `addressed_to`, `kind` (`agent | department | project |
session`), `state`, `parent_thread_id`, `created_by`, `due_at`, `account_id`.
`ops.run_ledger` gains `thread_id`. Nothing about one-run-one-trace changes — the observability
plane's core assumption survives intact, which is why this unification is affordable.

### The addressing model — "talk to a department or an agent"

| You type | Semantics |
|---|---|
| `@account-enrichment` | **Direct.** One agent, one thread, one run per turn. |
| `#sales` | **Dispatch.** Goes to the department lead, which answers itself or delegates to the right member and reports back. |
| `@@sales` | **Fan-out.** Every member answers independently; you see N answers side by side. Expensive and explicit — for reviews and second opinions, not for asking a question. |
| *(no address)* | **Chief of Staff.** The project-level default recipient. Routes, triages, answers. |

`#sales` and `@@sales` must be different characters and must *look* different, because one costs
one run and the other costs six. A UI that makes broadcast easy to trigger accidentally will
cost real money on the first day.

### The mailbox — sending to agents mid-work

Steering stops being a special endpoint. **Every thread has a mailbox; every running agent
drains it at tool boundaries.** Three interrupt levels, declared by the sender:

| Level | Behaviour |
|---|---|
| `note` | Queued. Read at the next natural boundary. Cheap, non-disruptive. |
| `steer` | Injected into the in-flight session now. Changes course mid-task. |
| `halt` | Stop, checkpoint the work so far, ask me before continuing. |

The same pipe carries the agent's questions back to you, so `ops.question` (M11) becomes a
*message kind* inside a thread rather than a parallel system. `expires_at` stays mandatory —
Part One's reasoning is unchanged and correct.

**This supersedes M12's `POST /api/run/:runId/input`** with `POST /api/thread/:id/message`, and
it deletes the awkward "resume the SDK session vs. re-seed a new run" fork: continuing a thread
starts a new run seeded with the thread's history. Part One recommended exactly that; the thread
model is what makes it the *natural* implementation rather than a compromise.

---

## 13. Presence and work products — "what is it doing, and did it push?"

The anxiety this answers deserves its own first-class entity rather than being inferred from
logs. Every run that touches a repo produces a `ops.work_product` row.

| Field | Why |
|---|---|
| `branch`, `base_sha`, `head_sha` | where the work is |
| `commits`, `files_changed`, `insertions`, `deletions` | how much |
| `push_state` | `none · local · pushed` — **the question you actually asked** |
| `pr_url`, `pr_state`, `ci_state` | did it land, is it green |
| `tests_run`, `tests_passed` | did it check itself |
| `worktree_path` | where to find it |

Rendered as a roster line you can read in two seconds on a phone:

```
● research-agent       running · 4m · reading 3 sources
● code-reviewer        done    · fix/auth · 3 commits · ⚠ UNPUSHED
● account-enrichment   done    · ↑ pushed · PR #42 · CI green · awaiting review
● weekly-digest        blocked · asked you something · 12m ago
```

Two supporting requirements, both load-bearing:

- **Worktree isolation per run.** Parallel agents in one project must not share a working tree.
  Git worktrees, one per run, cleaned when unchanged. Without this, "run three agents at once"
  corrupts all three.
- **Review the diff from the phone, and approve.** This closes the loop completely: three agents
  finish while you are out, you swipe through three diffs in a taxi, merge two. It is the single
  most valuable screen on mobile and it should be designed before the rest of the app.

`push_state: local` on a finished run is a **notification-worthy state**, not a detail. Work
that exists only in a worktree on a machine that might get wiped is work that does not exist.

---

## 14. Time and triggers — the scheduling plane

Part One keeps two mechanisms deliberately separate (recurring in frontmatter → ofelia;
one-shot in `ops.task.start_at`) and that distinction is right. The platform breaks the
*implementation*, not the distinction.

### Ofelia has to go

Ofelia reads Docker labels on one host. It cannot express: N projects, N execution hosts,
catch-up after a sleeping laptop, timezone intent, budget refusal, or a UI. **The coordinator
owns the clock.** `ops.schedule` + `ops.schedule_fire`, one scheduler process, ofelia removed
from `infra/compose.yaml`.

The frontmatter/ops split is *preserved*: `schedule:` in frontmatter is still an agent's
identity and still arrives by commit — the coordinator reads it on library sync and materializes
`ops.schedule` rows marked `source: library` (read-only in the UI, edited by PR). Ad-hoc
schedules you create in the app are `source: ops`. One table, two authorities, no ambiguity.

### Cron is one of six trigger types

A swarm that only reacts to the clock is half a swarm.

| Trigger | Fires on | Example |
|---|---|---|
| `cron` | wall-clock expression | weekdays 08:00 |
| `interval` | elapsed time | every 4h |
| `event` | an external signal | PR opened · git push · Gmail matching a filter · Jira transition · file changed under an indexed root |
| `condition` | a polled predicate | open questions > 5 · spend > 80% of budget · index staleness > 24h |
| `chain` | another run's outcome | `research` succeeds → `draft`; anything fails → `triage` |
| `manual` | you | — |

One object, one fire ledger, one UI. Event triggers arrive through the **same MCP allowlist
door** as everything else (M9's rule) — a connector that can be read can be subscribed to. No
special-case capability.

### The eight details that separate a real scheduler from a toy

Each of these is a bug you would otherwise ship, and each has cost someone a weekend.

1. **Record the fire before running it.** `ops.schedule_fire` gets a row at the occurrence time,
   then transitions `pending → running → done|failed|missed|skipped`. Fire-then-record makes
   "never fired" invisible, which is precisely the failure you most need to see.
2. **Idempotency key = `(schedule_id, occurrence_time)`.** A coordinator restart double-fires
   otherwise. This is the single most common scheduler bug in existence.
3. **Missed-run policy is mandatory and has no default.** `skip` (yesterday's briefing is
   worthless) · `catch_up_once` · `catch_up_all` (data pipelines only) · `ask` (push: "missed
   the 08:00 digest — run it now?"). The host *will* be asleep. Choosing per schedule is the
   difference between a system you trust and one you stop reading.
4. **Overlap policy is mandatory.** If 08:00 is still running at 09:00: `skip · queue ·
   kill_previous · allow_parallel`.
5. **Jitter and a concurrency cap.** Fourteen schedules at 09:00 is a rate-limit spike and a
   cost spike. Auto-jitter ±N minutes, plus a per-host concurrency ceiling.
6. **Timezone with declared intent.** `tz: Asia/Riyadh` *and* `follow_me: true|false` — should
   the 07:00 briefing track the timezone you are standing in, or stay on home time? Both are
   correct answers; only one is correct per job, and the system cannot guess.
7. **Failure escalation ladder:** retry with backoff → notify → **auto-disable after N
   consecutive failures**, loudly. A job that has failed thirty nights running while nobody
   looked is how a system like this rots without anyone noticing.
8. **Expiry and review.** Every schedule carries `until:` and a review date. Schedules that have
   never produced a used artifact get flagged in a quarterly sweep. Experiments must not run
   forever.

### The three that make it feel like running a company

- **Budget-aware scheduling.** Before you save, the dialog shows *projected monthly spend for
  this schedule* and the project's total scheduled burn against `budget_monthly`. **A fire that
  would exceed the project cap does not run — it raises a question.** This is the mechanism that
  prevents waking up to a four-figure bill, and it is why the budget validator pulled forward in
  §7 risk 3 matters even more here.
- **A calendar surface, not a list.** A week grid of what *will* run, coloured by department,
  annotated with projected cost, drag-to-reschedule — plus a "next up: `sales/digest` in 42m"
  strip in the shell. Existing panel/token discipline applies; this is a new widget type
  (`calendar`), not new chrome.
- **Wake-on-LAN.** The coordinator wakes the desktop at 05:55 so the 06:00 job has a host. Small,
  cheap, and it is the moment the system stops feeling like a website.

Two more that fall out of earlier sections:

- **Schedules target threads, not only agents.** `#sales standup, Mondays 09:00` fires the
  department dispatcher. Scheduling composes with addressing (§12) for free.
- **Never save an unpreviewed cron expression.** Natural language in ("every weekday at 8"),
  expression plus the next ten fire times out, confirm. Cron expressions are famously,
  quietly wrong.

### Interaction with notifications

A 03:00 job's result does not wake you. Results produced inside quiet hours are held and land in
the morning briefing; only `halt`-level questions and hard failures escalate immediately. One
preferences surface, per-category, as M11 already specifies.

---

## 15. Memory and knowledge, at five tiers

M10's three tiers become five once there are projects and threads. Write authority per tier is
unchanged in spirit — ADR-011 is amended, not replaced.

| Tier | Scope | Store | Written by | Injected into |
|---|---|---|---|---|
| **Global** | Follows you across every project — who you are, how you write, standing preferences | global library, git | you + the interview agent | every run, every project |
| **Project** | One project's `COMPANY.md` + sources | project library, git | `company-interview` via commit | every run in the project |
| **Department** | One of the seven, within a project | `ops.memory` | any agent in that department | that department's runs |
| **Agent** | One agent, within a project | `ops.memory` | that agent only | that agent's runs |
| **Thread** | Working context | `ops.thread_memory` | the thread | that thread; dies with it |

M10's non-negotiables all still hold: `run_id` provenance on every row, append-only with
`superseded_by`, per-tier token budgets enforced at assembly, PDPL redaction at write time.
Three additions, all aimed at the same failure — memory systems rot at month six:

1. **Retrieval counters.** Every row records how often it was retrieved *and* how often the run
   that retrieved it succeeded. Rows never retrieved in 90 days are garbage-collected with a
   notification, not silently.
2. **A memory review surface.** A weekly card: *"Sales wrote 14 memories. 3 contradict earlier
   rows. 6 have never been retrieved. Review?"* Memory you cannot audit is a liability that
   compounds.
3. **Conflict detection at write time.** Two agents writing contradictory facts raises a
   question (§12) rather than silently persisting both. Contradictory memory is worse than no
   memory, because it is confidently wrong.

**Knowledge base.** Per-project index plus a global index, both `pgvector` + BM25 — **hybrid,
not pure vector.** Pure embedding search is materially worse at names, IDs, SKUs and error
codes, which is most of what you will actually search for. Citations with file + page are
mandatory, the same rule `account-enrichment` already lives under.

Sources are connectors, and several are already connected to this workspace: Google Drive,
Gmail, Atlassian/Confluence/Jira, Figma, Amplitude, Miro (Slack requires authorization before
its tools can be used). Each indexed source is an object with a **freshness SLA** and a KPI tile
that states it honestly: `Confluence · 412 docs · 6h stale`. An index that silently goes stale
is a system that lies to every agent reading it.

---

## 16. Clients — one brain, four surfaces

Do not build the same application four times. Build one API, and let each surface be excellent
at one job.

| Surface | Its job | Tech | Status |
|---|---|---|---|
| **Web / PWA** | The full workbench — map, dashboards, chart, board, calendar | Next.js 15 | exists |
| **Mobile — iOS + Android** | Awareness and decisions. Answer questions, approve diffs, steer, read. **Not authoring.** | **Expo / React Native** — one codebase, real APNs + FCM | new |
| **Desktop** | **Execution host daemon** + local session bridge, with the workbench in a window | **Tauri** — wraps the existing web app in ~10 MB with a Rust daemon underneath | new |
| **CLI / Claude Code** | Where agents actually get built | exists | exists |

**Tauri over Electron, decided.** You already have the web app; Tauri wraps it at roughly a
tenth the size, and the daemon half — the part that actually matters — wants to be a native
service on Windows and a launchd job on macOS regardless. Electron would mean shipping a browser
to get a background process.

**Why native mobile rather than leaning on the PWA:** iOS Web Push is second-class and fails
quietly, and the entire premise of this system is *an agent asked me something at 23:00 and I
answered from bed.* If the notification is unreliable, nothing else in this document matters.
That single requirement justifies the app.

### The push design that keeps BOARD #5's spirit

The notification payload carries **no content** — only `wake: thread_42`. The app then fetches
the actual content over the tailnet. Apple and Google learn that something happened; they never
learn what. Outbound-only to APNs/FCM, no inbound port, no public exposure. This is the honest
way to have real notifications without amending the transport constraint.

### Offline is a requirement, not a polish item

Hotel wifi is the environment this was designed for. Mobile keeps a local SQLite replica of
threads, agents, tasks and schedules; writes are optimistic; sync runs off a change feed with
last-write-wins per field and a visible conflict banner. A control surface that is useless
without a good connection is not a control surface.

---

## 17. The Chief of Staff and swarm behaviours

*Its own phase, by decision — §21 risk 5 is why.*

The difference between sixty agents and a swarm is that a swarm has someone in front of it. The
**Chief of Staff** is a project-scoped agent that is the default recipient when you type without
addressing anyone (§12). It is an agent on the map like everything else — drawer, trace, cost,
track record — because an orchestrator that is not itself audited is how these systems become
unaccountable.

Its jobs, in dependency order:

1. **Route.** Read the request, pick the agent or department, or answer directly. Cheap model,
   fast, always.
2. **Triage.** Sweep open questions, failed runs, unpushed work, stale schedules, budget burn.
3. **Standups.** Each department reports on a schedule; the Chief synthesizes one card.
4. **The Morning Briefing.** The capstone artifact: one scheduled run at 07:00 producing one
   screen — what ran overnight, what failed, what is waiting on you, what is scheduled today,
   budget burn, unpushed work. **Everything else in this document exists to make that screen
   true.**

Around it, the behaviours that make the fleet act like an organization:

- **Delegation with a leash.** An agent may spawn subordinates, bounded by depth, token budget
  and wall clock, all three declared. Rendered as a live tree on the MAP.
- **A blackboard.** Per-project shared scratch state agents read and write, so they coordinate
  without routing everything through you.
- **Adversarial pairs.** Nothing significant lands without a critic. You already have this
  pattern in `fidelity-qa-reviewer`; generalize it from a role into a rule.
- **Trust ladder, per agent per project:** `observe → suggest → act-with-approval → autonomous`.
  Promotion is *earned* from track record and **demotion is automatic** after N failures. The
  CHART view's autonomy axis stops being a label someone typed and becomes a live number.
- **Replay and eval.** Re-run a past run against an edited SKILL.md and diff the outputs. This
  is the only real defence against sixty agents that read beautifully and work badly, and it is
  what M13's stage 7 needs anyway.

**The risk, stated where it belongs:** routing quality *is* perceived system quality. If the
Chief of Staff routes badly, everything downstream feels broken even when it works. It needs a
larger eval suite than any other agent in the fleet, built before it ships, not after.

---

## 18. New ADRs this forces

| ADR | Decision | Blocks |
|---|---|---|
| **ADR-016** | Project scoping — projects mount libraries; the cascade and its resolution order; what "delete a project" means | everything in Part Two |
| **ADR-017** | Identity vs device vs billing account — three tables, scopes on the device, **amends ADR-013** | P1 |
| **ADR-018** | Thread unification — runs, sessions and tasks become threads; the addressing grammar; mailbox and interrupt levels; **supersedes M12's steering endpoint** | P2 |
| **ADR-019** | Scheduler ownership — coordinator owns the clock, ofelia removed, frontmatter `schedule:` materializes into `ops.schedule`, the six trigger types, missed/overlap policy as required fields | P4 |
| **ADR-020** | Client strategy — Expo for mobile, Tauri for desktop, contentless push payloads, offline replica and conflict policy | P5, P7 |
| **ADR-011** *(amended)* | Memory tiers become five; retrieval counters, GC policy, write-time conflict detection | P6 |
| **ADR-021** | Work products and worktree isolation — one worktree per run, push-state as a first-class notifiable state | P3 |
| **ADR-022** | Chief of Staff — routing authority, delegation limits, the trust ladder's promotion and demotion rules | P8 |
| **ADR-023** | Three new widget types — `board`, `calendar`, `thread-feed` — and the rule that everything else composes from the existing seven (§23.7) | P2, P4 |
| **ADR-024** | Drag without a dependency — the shared Pointer Events primitive, keyboard-first movement, and "no new runtime dependency without an ADR" (§23.4, §23.11) | BOARD, CHART |
| **ADR-025** *(optional)* | Renaming the CHART tab to ROLLOUT — a deviation from spec §2.6 naming, recommended but not assumed (§23.3) | — |

ADR-005 (Happy vs Omnara) remains open on the BOARD and now blocks P7 as well as Part One's
Phase 4. §7 risk 4 stands: spike it for half a day during Phase 0.

---

## 19. What this amends in Part One

Stated explicitly so no milestone gets built twice.

| Part One item | Fate |
|---|---|
| **M9 — Connectors real** | **Unchanged**, and now also the door event-triggers arrive through (§14). |
| **M10 — Memory & index** | **Amended.** Three tiers → five; everything project-scoped; retrieval counters, GC, conflict detection added (§15). |
| **M11 — Tasks, questions, notifications** | **Absorbed.** A task is a thread with a due date; a question is a message kind (§12). The board and the notification ladder survive intact; the parallel entity model does not. |
| **M12 — Dept dashboards, roster, steering** | **Partly superseded.** Dashboards and the roster stand and get richer (work products, §13). Steering is replaced by the mailbox; `POST /api/run/:runId/input` is never built. |
| **M13 — Agent Foundry** | **Deferred and rescoped.** Moves last, and becomes project-aware: it must ask which library an agent belongs in and whether it should be born global. |
| **M14 — Identity + accounts** | **Split and pulled forward.** Identity/device → P1 (it re-scopes every route, so it cannot come last). Billing accounts and session hosts → P1 and P7. |
| **§5 sequencing** | **Superseded by §20.** |
| **BOARD constraint #5** | Amended by ADR-013 as Part One proposed; **not** further amended here. Tailnet-only survives, because contentless push (§16) does not require exposure. |

---

## 20. Revised sequencing

Phase 0 is unchanged and still blocks everything: no feature below can be judged on top of zero
real runs and a `COMPANY.md` that is 0/20.

```
Phase 0   Make it true (unchanged)              ███                              2–4d   ← blocks all
P1  M15   Projects · cascade · identity            ████████████                  8–12d  ← re-scopes everything
P2  M16   Threads · addressing · mailbox                       ██████████████   10–14d
P3  M17   Presence · work products · diff review                    ███████      5–7d
P4  M18   Time & triggers · the scheduler                            ██████████  7–10d
P5  M19   Mobile (Expo) · real push · offline                          ████████████  10–14d
P6  M20   Memory 5-tier · KB index                                       ████████████  10–14d
P7  M21   Tauri desktop · host daemon · sessions                            ██████████  8–12d
P8  M22   Chief of Staff · swarm behaviours                                    ██████████████  12–18d
P9  M23   Foundry, project-aware (was M13)                                          ████████████  8–12d
    M9    Connectors real — anywhere after Phase 0                                    2–3d
```

**Roughly 4–6 months** at a sustainable pace, on top of Part One's Phase 0.

### Why this order and not another

- **P1 first, non-negotiable.** Projects and identity re-scope every table and every route.
  Anything built before them gets rebuilt after them. Building the mobile app first would be the
  most expensive possible mistake.
- **P2 second** because threads collapse three concepts into one. Every later phase — presence,
  scheduling, mobile, the Chief of Staff — either reads from threads or writes to them.
- **P3 before P5** so that when the mobile app arrives, the diff-review screen (the best screen
  on the phone) already has data to render.
- **P4 before P5** so the first notification the phone ever receives is a real scheduled result,
  not a test.
- **P6 after P5** deliberately: memory makes agents good in six months; the phone makes the
  system usable next week. Part One made the same call for the same reason.
- **P8 late** because the Chief of Staff can only route well over a system that exists — it needs
  threads, schedules, presence and memory to route *across*. Given its own phase because §21
  risk 5 makes it the highest-variance component in the plan.
- **M9 floats.** Connectors are independent of the platform work and can land in any gap.

**Parallelism:** P3 and P4 can overlap (different tables, different owners). P5 and P6 can
overlap. P1 and P2 cannot overlap with anything, including each other.

---

## 21. Risks, restated for the platform

Part One's seven risks all still apply. Five more, and the ones you have already accepted are
marked so.

1. **Three orthogonal axes — projects × devices × accounts — multiply the test surface.**
   *Accepted.* Every existing route becomes project-scoped and identity-scoped, which is an audit
   of everything already built, not an extension of it. This is the entire justification for
   P1 coming first.
2. **Three client codebases is a lot for one person.** *Accepted, with Tauri chosen.* PWA → Expo
   (iOS and Android share ~90%) → Tauri is the cheapest path that still yields reliable push.
   Electron is ruled out.
3. **Phase 0 still blocks everything.** *Accepted — Phase 0 runs immediately after this plan is
   finalized.* Dreaming is free; the dream runs on real data, and today the LIVE counter is
   honestly zero.
4. **This is 4–6 months, not 6 weeks.** *Accepted.* Part One alone was 5–7 weeks and did not
   include any of Part Two.
5. **The Chief of Staff is a single point of judgment.** *Accepted, and given its own phase (P8).*
   Bad routing makes a working system feel broken. Its eval suite must exist before it ships.
6. **The scheduler is the component most likely to fail silently.** Everything else fails in
   front of you; a schedule fails at 03:00 into a log nobody reads. §14's eight details are not
   polish — items 1, 3 and 7 in particular are the difference between a system you trust and one
   you quietly stop believing.
7. **Contentless push is a discipline, not a config flag.** The first time someone puts a
   question's text into a notification body "so it's more useful", the privacy property is gone
   and nobody notices. Assert it in a test against the push payload builder.
8. **The KB index is where PDPL becomes real, now across projects.** §7 risk 2 is worse at N
   projects with a shared global index: client A's data must never surface in client B's
   retrieval. Index isolation is a hard boundary, tested, and `rtl-arabic-pdpl-specialist` signs
   it off before the index holds anything real.
9. **The cascade can produce silent surprises.** Running "the code-reviewer" and getting the
   global one when you meant the fork is a class of bug with no error message. Provenance on
   screen at all times (§10) is the mitigation and it is not optional.

---

## 22. New roster — Part Two

| New agent | Owns | New contract |
|---|---|---|
| `platform-projects-engineer` | `ops.project`, the agent cascade, library sync, project switching | `contracts/project-scoping.md` |
| `thread-model-engineer` | Threads, addressing grammar, mailbox, interrupt levels | `contracts/thread-model.md` |
| `scheduler-engineer` | The coordinator clock, six trigger types, fire ledger, calendar widget | `contracts/scheduling.md` |
| `client-platform-engineer` | Expo mobile, Tauri desktop, push, offline replica and sync | `contracts/client-sync.md` |
| `chief-of-staff-architect` | Routing, delegation limits, standups, trust ladder, the Morning Briefing | `contracts/orchestration.md` |

Carried over from Part One §6: `memory-index-engineer` (now five tiers), `identity-access-engineer`
(now three tables), `agent-foundry-architect` (now project-aware). `control-plane-engineer` is
**dissolved** — its scope splits between `thread-model-engineer` and `scheduler-engineer`, which
is the honest consequence of M11 being absorbed.

Existing owners pick up: `runner-engineer` → placement decisions and host daemons;
`observability-engineer` → per-project and per-account cost split, schedule-fire metrics;
`dashboards-engineer` → calendar and board widget types, roster with work products;
`rtl-arabic-pdpl-specialist` → **mandatory** sign-off on cross-project index isolation.

---

## 23. The UI, rescanned — what has to change

*Written after a full scan of `apps/web/src`. Part Two adds projects, threads, schedules,
presence and a swarm; almost none of that has a surface today. This section is the UI half of
the plan, and it starts from what is actually built rather than from what would be nice.*

### 23.1 What exists today

| Area | Files | State |
|---|---|---|
| **Shell** | `components/shell/**` — `TopBar`, `BottomBar`, `ViewTabs`, `SearchPill`, `CostTicker`, `ConnectionStatus`, `BreadcrumbStrip`, `ZoomControls`, `HelpSheet`, `PwaRegistrar` | Complete for four views. `grid-cols-[1fr_auto_1fr]` keeps tabs optically centred; already reflows to two rows below `sm`. |
| **Primitives** | `components/primitives/**` — `Card`, `Chip`, `Eyebrow`, `GlassPanel`, `KpiNumeral`, `Pill`, `RailLabel`, `SegmentedControl`, `motion.ts`, `theme.ts` | Small, disciplined, fully tested. This is the healthiest part of the codebase. |
| **MAP** | `map/**` — `svg/{Nodes,Edges,ClusterLabels,BranchLabels,Watermark}`, `canvas/`, `chrome/{DepartmentRails,EmptyState,FocusRotator}` | Built. |
| **CHART** | `chart/components/**` — `Matrix`, `MatrixCell`, `MatrixHeaders`, `JobCard`, `PhaseDots`, `ProgressDashes`, `TierLegend`, `EmptyCell`, `DepartmentTabs`, `StatLine` | Built. A real `role="grid"` with roving tabindex and arrow-key navigation. |
| **DASHBOARDS** | `dashboards/components/**` — `Carousel`, `DashboardDetail`, `KpiTile`, `SignalsStrip`, + 6 widget renderers behind `WidgetView` | Built. Seven canonical widget types; an eighth requires an ADR. |
| **SESSIONS** | `sessions/components/**` — `SessionsTab`, `SessionView`, `Transcript`, `PermissionCard`, `KeyGate`, `PushSettings` | Built. E2E gate and push settings live here. |
| **Drawer** | `drawer/**` — one `JobDrawer`, two anatomies (`MapAnatomy` left, `ChartAnatomy` right), ten sections, `RunConsole` | Built. |
| **Tokens** | `styles/tokens.css` | Complete: monochrome chrome, seven data-ink hues, full light theme, RTL sheet. |

**The dependency finding, because it governs everything below.** `apps/web` ships with exactly
one runtime UI dependency: `lucide-react`. No D3, no Framer Motion — both are *permitted* by
BOARD #2 and neither was needed. The galaxy is hand-rolled SVG + canvas; every duration lives in
`motion.ts` and `check-tokens.mjs` fails the build on a hardcoded `320ms`.

That is a stronger position than the constraint asks for, and it should be defended. **Every new
surface below is buildable with zero new dependencies**, and where one is tempting (drag) the
answer is stated in §23.4.

### 23.2 The gap, function by function

| Part Two function | Surface that should serve it | Today |
|---|---|---|
| Projects (§10) | Project switcher in the shell; project segment in every route | **nothing** — routes are `/map`, `/chart`; the shell has no project concept |
| Agent cascade (§10) | Provenance badge on node, job card, roster row, drawer | **nothing** |
| Threads + addressing (§12) | THREADS view; `@ # @@` composer with autocomplete | SESSIONS is a session list, not a thread surface |
| Mailbox / steering (§12) | Composer on a live run with three interrupt levels | `RunConsole` streams one-directionally; approve/deny only |
| Work products (§13) | Roster column, drawer tab, **diff review screen** | **nothing** — no branch, no push state, no PR anywhere |
| Scheduling (§14) | CALENDAR view; schedule editor with fire preview; "next up" strip | `SkillFileCard` has a cron field and a one-line result string |
| Memory (§15) | Memory tab in drawer; weekly review card | **nothing** |
| Kanban board (§19) | BOARD view | **nothing** — and §23.3 is why CHART is not it |
| Budgets (§14) | Budget meter per project; pre-run cost estimate | `CostTicker` shows one global number |
| Hosts (§9) | Host status in the shell | `ConnectionStatus` is binary online/offline |
| Accounts (§11) | Account split in cost surfaces; account chip on a run | **nothing** |
| Chief of Staff (§17) | Morning Briefing screen | **nothing** |

Eleven of twelve are greenfield UI. That is the honest scale of this section.

### 23.3 CHART is not a Kanban — and that is why it feels wrong

You said the CHART doesn't feel like a Kanban. The diagnosis is right and the fix is not the
obvious one.

`Matrix.tsx` renders a `role="grid"` of three autonomy tiers × four rollout phases, with job
cards stacked inside each cell and hatching where a cell is empty. **Structurally that is a
board with swimlanes.** It reads as one, so the eye expects board affordances — drag, WIP
counts, movement, aging — and gets none of them. Nothing on the CHART has ever moved, because
tier and phase are projected from frontmatter.

So there are two different problems wearing one complaint:

**(a) CHART should not become a Kanban.** Its columns are *rollout phases* — how mature a
capability is. A Kanban's columns are *work states* — where a piece of work is right now. An
agent sits in `phase: pilot` for months; a task crosses `running → review` in an afternoon.
Merging them produces a board where half the cards never move and the other half never settle,
which is worse than either.

**(b) CHART should nonetheless be alive.** What it is missing is not Kanban-ness, it is
*motion and truth*:

- **Drag to promote.** Dragging a card from `pilot` to `scaled` is a real decision you make.
  It should open a confirm sheet and land as a **frontmatter change via PR** — which keeps
  BOARD #4 intact (git is still the source of truth; the drag is just a nicer editor than vim).
  This single change is most of what makes it feel like a board.
- **Counts in the headers.** `MatrixHeaders` shows phase progress dashes; it should also show
  how many agents sit in each column and how many moved this quarter. A board without counts
  reads as a diagram.
- **Aging.** An agent that has been in `pilot` for 90 days with a green track record is a
  decision you are not making. A faint aging dot on the card says so.
- **Live status on the card.** `JobCard` shows identity. It should show the halo — running,
  failing, idle — so the CHART and the MAP agree at a glance.

**And then build the actual Kanban as its own view, with a deliberately different grammar**, so
the two are never confused:

| | CHART (rollout) | BOARD (work) |
|---|---|---|
| Columns | 4 rollout phases, fixed | 6 work states, fixed |
| Rows | 3 autonomy tiers, always visible | none by default; optional swimlane by department |
| Card | an agent | a thread with a due date |
| Motion | rare, deliberate, writes git | constant, cheap, writes ops |
| Empty cell | hatched — "nothing at this tier yet" | plain — "nothing here right now" |
| Density | dense grid, fits one screen | tall scrolling columns |

Hatching is the strongest signal available: **hatching means CHART, plain means BOARD.** Keep it
exclusive to CHART and the two views stay legible from across the room.

*Renaming the tab CHART → ROLLOUT would remove the ambiguity at the source. It is a deviation
from spec §2.6's naming and therefore needs an ADR; recommended, not assumed.*

### 23.4 Drag, and the dependency question

BOARD and CHART both need drag. `apps/web` has no drag library and no component library, and
`dnd-kit` would be the first real UI dependency in the app.

**Recommendation: build it, do not install it.** A single-axis card drag over fixed columns is
Pointer Events plus a CSS transform — on the order of 150 lines, shared by BOARD, CHART and the
calendar. `dnd-kit` is ~40 KB, brings its own sensors and accessibility model, and would sit
oddly next to a hand-rolled force-directed galaxy.

**Non-negotiable either way: drag is never the only way to move a card.** A card menu with
"Move to…" and a keyboard path (`Matrix.tsx` already has roving tabindex and arrow keys — extend
it with `Ctrl+Arrow` to move) must exist first, because drag is unusable on a phone in a taxi and
inaccessible to a screen reader. Build the keyboard path, then add drag on top.

### 23.5 The shell cannot hold six tabs

`ViewTabs` renders wide-tracked 11px caps at `+0.25em`. Its own comment measures four labels at
~400px, and `TopBar` already reflows to two rows below `sm` to fit them. Part Two adds **BOARD**
and **CALENDAR**, and turns SESSIONS into **THREADS** — six labels, ~600px. The current bar
breaks.

Three options, and the third is right:

1. *Overflow menu.* Cheap, and it buries whichever view you use least — usually the board.
2. *Icons instead of labels.* Saves the width, costs the typographic voice that is 90% of the
   look. Rejected.
3. **Two-level navigation.** The segmented control keeps the four **spatial** views — MAP ·
   CHART · DASHBOARDS · BOARD — because those are places you *look at the org*. THREADS and
   CALENDAR are **temporal**, always-available surfaces and belong in the right cluster of the
   top bar as a persistent pair with unread/next-up counts, next to `+ New`.

That split is honest — one is "where is my company", the other is "what is happening right now" —
and it keeps the segmented control at four labels, exactly the width `TopBar` was designed
around. **No change to the `grid-cols-[1fr_auto_1fr]` mechanism**, which is the load-bearing part.

### 23.6 The drawer has to become tabbed

`JobDrawer` already renders ten sections through two anatomies. Part Two wants to add: work
product, connector health, resolved tool list, provenance, memory, thread history, live "currently
doing", account and budget. Appending them produces a drawer nobody scrolls to the bottom of.

**Four tabs, one drawer:**

| Tab | Holds | Mostly |
|---|---|---|
| **ABOUT** | today's ten sections — identity, ladder, replaces, the human | existing |
| **WORK** | currently doing · work product (branch, commits, **push state**, PR, CI) · last runs · artifacts | new |
| **MEMORY** | agent-tier memory with provenance, retrieval counts, supersession | new |
| **WIRING** | resolved tools with **connector health dots**, inputs schema, approval policy, schedules, account | half exists |

Two details that matter more than the tabs:

- **Connector health before the Run button, not after the failure.** §3's ADR-010 already
  requires `unhealthy_connector`; the drawer is where it has to appear. `WIRED INTO` currently
  lists connector *names* — a name is not a capability.
- **Provenance in the header.** `⌂ global` · `▣ project` · `⑂ forked from global@a1b2c3`,
  beside the eyebrow. §21 risk 9 has no other mitigation.

Both anatomies keep their existing shape; `Section` and `Chips` are reused unchanged.

### 23.7 Three new widget types, not nine

`packages/contracts/src/panels.ts` locks seven types with a comment that an eighth requires an
ADR. That discipline is worth keeping, so most new surfaces should be *compositions* rather than
new types:

| Need | Answer |
|---|---|
| Agent roster with live state | `data-table` + a live cell renderer — **no new type** |
| Budget burn vs cap | `progress-table` — **no new type** |
| Index freshness per source | `data-table` — **no new type** |
| Question queue | `activity-feed` — **no new type** |
| Kanban | **`board`** — new |
| Week of scheduled fires | **`calendar`** — new |
| Thread stream on a dashboard | **`thread-feed`** — new |

Three new types, one ADR, and the dashboards layer keeps its property that a new Command Center
is a JSON file. `WidgetView`'s exhaustive `switch` with the `never` fallthrough makes adding them
safe — the compiler names every site that needs updating.

### 23.8 New surfaces, in the order they earn their place

1. **BOARD** — six columns, cards are threads, WIP counts, keyboard-first, drag second. Rendered
   as a `board` widget inside the panel system so it inherits token discipline instead of
   inventing chrome (Part One M11 already recommended this and it still holds).
2. **THREADS** — replaces SESSIONS. Thread list grouped by project and kind, with the addressing
   composer. `@` / `#` / `@@` need an autocomplete that makes the **cost difference visible**:
   `#sales` says "1 run", `@@sales` says "4 runs · ~$0.40". §12 warns that easy accidental
   broadcast costs real money; this is where that is prevented.
3. **Work review** — the diff screen. Files changed, hunks, approve/request-changes, push. The
   most valuable screen on mobile and the one to design first (§13).
4. **CALENDAR** — week grid of scheduled fires, coloured by department, annotated with projected
   cost, drag to reschedule. Plus the `next up: sales/digest in 42m` strip in the bottom bar,
   beside the cost ticker.
5. **Morning Briefing** — the Chief of Staff's one screen. Overnight results, failures, waiting
   on you, today's schedule, budget burn, unpushed work. On the phone it is the launch screen.
6. **Schedule editor** — natural language in, cron plus **next ten fire times** out, missed-run
   and overlap policy as required selects, projected monthly cost before save (§14).
7. **Memory review card** — weekly: what was written, what conflicts, what was never retrieved.

### 23.9 Mobile is different, not smaller

`BottomBar` currently carries zoom controls — a desktop affordance. The PWA scales the desktop
layout; Part Two's mobile client (§16) needs its own information architecture:

- **Bottom tab bar** — Briefing · Threads · Board · Map. Not six tabs, not the segmented control.
- **Zoom controls hidden**; pinch is the gesture.
- **The three actions that must be reachable in one tap from a notification:** answer a question,
  approve a diff, steer a run. Everything else can be two.
- **Swipe through work products** — three agents finished, three diffs, swipe and merge.
- **`env(safe-area-inset-*)` is already handled** throughout `TopBar` and `BottomBar`; the native
  shell inherits it rather than redoing it.

The Expo app reuses **tokens and copy, not components** — `tokens.css` becomes a generated JS
token module so both clients read one source. Attempting to share React DOM components with React
Native is the trap here.

### 23.10 Chrome additions

| Slot | Change |
|---|---|
| Top-left | **Project switcher** before the fullscreen toggle — the project name as a pill, `⌘K`-style picker, recent projects. This is the highest-frequency control in the app and it does not exist. |
| Top-right | THREADS + CALENDAR pair with counts (§23.5), then `+ New`. |
| Bottom-right | `CostTicker` gains **project scope and account split** (`work $12.40 · personal $3.10`); `ConnectionStatus` becomes **host status** — which execution hosts are online, since a sleeping host is why a schedule missed. |
| Bottom-left | `next up: …` strip beside zoom. |
| Breadcrumb | gains the project segment: `AgentOS › Sales › account-enrichment`. |
| Search | `useSearchIndex` indexes departments and agents only. Extend to threads, tasks, runs, schedules, memory and indexed files, with a **project-scoped vs all-projects** toggle. |

### 23.11 The rules that must not bend while doing this

1. **Chrome stays monochrome (BOARD #1).** Board columns are monochrome; only a card's status
   dot is coloured. A calendar coloured by department is the single most likely place this rule
   dies — cap it at the existing seven data-ink hues and use weight and position for the rest.
2. **No hex outside `tokens.css` (BOARD #3).** Every new surface is new colour temptation.
   `check-tokens.mjs` already fails the build; keep it pointed at the new directories.
3. **Every duration through `motion.ts` (§1.6).** Drag springs and column reflow are exactly
   where a stray `0.3s` gets typed.
4. **No component library (BOARD #2), and now: no new runtime dependency without an ADR.**
   The app is at one. Ship the board without making it two.
5. **Honest empty states (BOARD #9).** Every new surface needs its zero state designed at the
   same time as its full state — `ChartEmptyState` and `EmptyCell`'s hatching are the standard
   to match. An empty board says "nothing is running", never a skeleton that implies loading.
6. **Light theme and RTL on every new surface.** Both exist and both are cheap to break —
   a board's column order and drag direction are the first things RTL breaks, and
   `rtl-arabic-pdpl-specialist` should see the board before it ships, not after.
7. **Keyboard before pointer.** `Matrix.tsx` set this standard with roving tabindex and arrow
   keys. Board, calendar and the composer meet it or they do not ship.

### 23.12 UI work, mapped onto the phases

| Phase | UI deliverable | Owner |
|---|---|---|
| **P1** Projects | Project switcher · project in routes and breadcrumb · provenance badges · project-scoped cost ticker and search | `shell-navigation-engineer` |
| **P2** Threads | THREADS view · addressing composer with cost preview · mailbox composer with three interrupt levels (replaces `RunConsole`'s one-way stream) | `sessions-relay-engineer` → renamed, + `drawer-engineer` |
| **P3** Presence | Drawer tabs · WORK tab · work-product roster column · **diff review screen** · live "currently doing" | `drawer-engineer`, `dashboards-engineer` |
| **P4** Scheduler | CALENDAR view + `calendar` widget · schedule editor with fire preview and cost projection · `next up` strip | `scheduler-engineer` + `dashboards-engineer` |
| **P5** Mobile | Expo IA · bottom tab bar · notification-to-action paths · generated token module | `client-platform-engineer` |
| **P6** Memory | MEMORY drawer tab · weekly review card · index freshness tiles | `memory-index-engineer` |
| **P8** Swarm | Morning Briefing screen · delegation tree on the MAP · trust-ladder state on CHART cards | `chief-of-staff-architect` |
| **Any** | **CHART enhancements** (§23.3): drag-to-promote via PR, header counts, aging dots, live halo on `JobCard` — small, independent, and the fastest way to make an existing view feel alive | `chart-matrix-engineer` |
| **Any** | **BOARD view** + `board` widget type + the shared pointer-drag primitive | `dashboards-engineer` |

The CHART enhancements are the cheapest visible win in this entire document — four contained
changes to files that already exist, no new routes, no new schema. Worth doing in Phase 0's slack
time while the review queue burns down.

---

## 24. Deliberately not in Part Two

- **Public internet exposure.** Still a separate ADR with its own threat model. Contentless push
  is specifically designed so that wanting notifications does not force this decision.
- **Multi-user teams.** Identity and scopes are shaped to allow it; nothing here builds it.
- **A cloud execution host.** The placement model has room for one. Adding it is a billing and
  data-egress decision, not an engineering one, and it needs the egress ADR the BOARD already
  has open.
- **Real-time collaborative editing of threads across devices.** Handoff and presence, yes.
  CRDTs, no.
- **Replacing `comms/` with threads.** Part One §8's warning gets *stronger* here, because
  threads now look even more like the comms protocol than the Kanban board did. `comms/` is how
  build agents coordinate; threads are how you direct business agents. Merging them remains the
  most tempting mistake available.
- **Migrating this repo's `agents/**` out.** AgentOS becomes `project: AgentOS` in place. Nothing
  moves on disk in P1 — the coordinator mounts what is already there.
