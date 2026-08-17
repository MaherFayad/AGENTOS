# CONTRACT — Runner & relay HTTP surface

**Owner:** `runner-engineer` (§3.2 routes) with `sessions-relay-engineer` (§3.1 routes)
**Source:** spec §3.1–3.3, Part V · **Status:** agreed (§3.2/§3.3 half), draft (§3.1 half)
**Code half:** `packages/contracts/src/api.ts` — hand-derived from this file. When the two
disagree, **this file wins and the TypeScript is the bug** (ADR-002).

All routes are tailnet-only (§3.6). No auth in v1 **by design** — the day a public port
opens, Authelia/Cloudflare Access goes in front first. Any route that would still be
safe on the public internet is not a reason to relax this.

---

## The project axis — read this before any route below

**Added by [ADR-015](../decisions/ADR-015-project-scoping.md), 2026-08-17.** Every path in
this document that reads or writes a project's data is now prefixed. The rule, and it has no
exceptions:

> **A request names its project in its path, and there is no default.**

```
/api/p/:project/…     project-scoped. The great majority.
/api/all/…            deliberately cross-project. Exactly two routes.
/api/…                the coordinator itself, not a project's data. /api/status, /api/projects.
```

There is no `currentProject`, no cookie, no header and no fallback. A header is invisible in
a log and in a bug report; a server-side "current project" is an **ambient default**, and an
ambient default is the mechanism by which one project's data gets served under another
project's name. A path segment is greppable, cacheable, and impossible to forget — the route
does not exist without it.

**Four refusals, deliberately distinct.** Collapsing any two of them sends different people
to look in the same wrong place:

| Code | Status | What it actually means to the person reading it |
|---|---|---|
| `project_scope_missing` | 400 | *You did not say which project.* The hint names the scoped path to use. |
| `project_not_found` | 404 | *That is a typo* — not a slug, or a reserved one (`all`, `p`, `api`). |
| `project_not_mounted` | 503 | *Right name, wrong machine.* The project may exist perfectly well on another host (`host_affinity`). Never `404`, which would send someone hunting a typo in a correct name. |
| `project_not_active` | 409 | Paused or archived. It keeps all its history and its whole library; it just does not start runs. |

### A route that resolves a project reads that project's library — nothing else

**Added 2026-08-17, after `rtl-arabic-pdpl-specialist`'s isolation sign-off, second pass.**
Resolving `:project` and then reading a coordinator-level path is not scoping; it is scoping
that happens to agree. Five read handlers did exactly that — `graph`, `agentsIndex`, `agent`,
`panels`, `panel` called `resolveProject` and then read the runner's own `agentsDir`,
`panelsDir` and `graphFile`, while `POST /run` derived every root from the project. With one
library mounted the two agree **by coincidence between two variables, not by derivation from
one**, which is indistinguishable from correct until the day it is not.

> **Every library read behind `/api/p/:project/…` takes the resolved project, and the
> coordinator's config is not reachable from it.**

The mechanism is a type, not a review: those readers take `MountedProject`, which has no
`RunnerConfig` shape, so a handler that reaches for config **fails to compile**. Asserted
both ways in `apps/runner/src/routes/__tests__/project-derived-reads.test.ts` — behaviourally,
by handing the readers a project whose library is *not* the coordinator's and requiring every
answer to come from it, which is the only test that can tell derivation from coincidence.

Three consequences that are visible in the API rather than only in the code:

| Route | What it now reads | The refusal, when the project has none |
|---|---|---|
| `GET /api/p/:project/graph` | that project's stored layout artifact | **`graph_not_built` (503), naming the project.** The payload carries no project field, so an artifact cannot be *checked* against the URL it is served under — which is precisely why one is never substituted for another |
| `GET /api/p/:project/agents[/:slug]` | the **resolved set** — the cascade's winner per `(department, slug)`, ceiling-checked (ADR-014) | `agent_not_found` (404), or the same refusal a run would give |
| `GET /api/p/:project/panels[/:id]` | that project's `panels/` | an **empty list**. Never the coordinator's — see Q8 in `project-scoping.md` |

**The pre-project paths stay mounted and answer `400 project_scope_missing`.** This is the
only visible surface of the migration and it is not decoration. A `404` reads as a deleted
feature; a redirect to a default project would serve one client's rows under another client's
name, silently, and look like it worked. Delete a legacy path only when no client can still
send it — and never replace one with a redirect.

The list of legacy paths lives in `LEGACY_UNSCOPED_PATHS` in the code half, so the contract
decides which exist; `apps/runner/src/routes/__tests__/api.test.ts` walks that list and
asserts each one refuses, names its replacement, and **does not also carry a result set**.

### `GET /api/projects` *(coordinator-scoped)*

What the switcher lists. A mount registry describes this process, not a project's data.

```jsonc
{
  "projects": [{
    "id": "…uuid…", "slug": "agentos", "name": "AgentOS", "status": "active",
    "libraryPath": "/repo",
    "libraryRemote": null,        // always null — a git remote is an egress decision (ADR-015 Q5)
    "hostAffinity": [], "hostAffinityEnforced": false,
    "budgetMonthlyUsd": null,     // declared; NOT enforced in M15
    "budgetEnforced": false,
    "defaultAccountId": null
  }],
  "mounted": "agentos",
  "scopeEnforced": null           // null = we could not ask. Not false.
}
```

**Every field that is declared and read by nothing carries a sibling boolean saying so.** A
cap rendered next to no enforcement is a UI telling a lie it was handed; the flag is what
makes that a decision rather than an accident. `scopeEnforced` is `null` — not `false` — when
there is no ledger to ask: with no database we have not *learned* that isolation is bypassed,
we have failed to ask, and those are different facts.

**The four empty fields are typed as the only value they may hold, and that is load-bearing.**
This route is `coordinator`-scoped and is the *other* route that returns one row per client.
`budgetMonthlyUsd` is `null`, `defaultAccountId` is `null`, `hostAffinity` is `readonly []`,
`libraryRemote` is `null` — literal types, not "currently empty". The day ADR-015 Q6 makes a
budget real, this route would hand **every client's monthly budget to any caller**, which is
the `/api/all/approvals` defect arriving through a field that already exists rather than a
route someone adds. So: **producing a real value here does not compile.** Whoever makes the
field real narrows this row in the same commit and serves the figure from
`/api/p/:project/…`, or widens the type in a reviewable diff and says why every caller may
see it. A consumer must not read these fields as "the budget is unset" — they mean *this
route does not carry budgets*.

---

## `POST /api/p/:project/run` → SSE

```jsonc
// request
{ "agent": "sales/account-enrichment", "inputs": { "account_url": "https://…" },
  "dryRun": false,
  "threadId": null }   // supplied ⇒ continue that thread, seeded with its history (Plan §12)
```

**Step 0, before anything in the list below: the agent is resolved through the cascade for
this project, and its capability ceiling is re-derived and enforced** (ADR-014 §3, §7.3;
ADR-015 decision 5). A resolved `wired_into` that exceeds the introducing layer's is
`capability_widened` (403); an introducing layer that cannot be **read** is
`cascade_unresolved` (422) and the run is refused rather than trusted. A global library that
is simply **not configured** is not an error — the cascade has two real levels until a global
library exists.

Resolution and enforcement are one call (`resolveForDispatch`), so no future caller can
obtain a runnable agent without the check. That is the difference between a boundary and a
step a reviewer has to notice.

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
| `start` | `{runId, agent, agentRef, sourceRef, traceUrl, startedAt, tools[], approvalRequired}` |
| `token` | `{text}` — a fragment; append to console |
| `tool` | `{name, input, status:"start"\|"ok"\|"error", durationMs?, error?}` |
| `plan` | `{summary, awaitingApproval}` — when `approval: required` the run pauses here |
| `artifact` | `{path, kind:"md"\|"pdf"\|"json"\|"txt", url, bytes}` |
| `done` | `{status:"ok"\|"error"\|"denied"\|"canceled", costUsd, durationMs, traceUrl, denialNote?}` |
| `error` | `{message, retryable, code?, hint?}` |

`tools[]` on `start` is the resolved allowlist, echoed so the console can show what the
run was permitted to touch. `done.status` carries `denied` because **a denied run is
data, not a discard** — the queue and LAST RUNS both show it.

`agentRef` and `sourceRef` on `start` are the cascade's provenance (ADR-014 §2), and they are
on the **first** frame, before any token, for a specific reason: *"I ran the wrong
code-reviewer"* is a bug class with **no error message** (`Plan §21.9`), and the console is
where a human is already looking.

- **`agentRef` = `{project}/{department}/{slug}`** — the addressable agent, and the foreign
  key every ledger row hangs off. Distinct from `agent`, and the distinction is the point:
  two projects' `sales/database-mining` are two agents, two histories, two halos. Run history
  never follows a fork or a promotion.
- **`sourceRef` = `{layer}:{path}@sha256:…`** — which file actually won, at what content.
  Recorded on the **run**, never on the agent. `drawer-engineer` renders the layer half as
  the provenance badge (`⌂` global · `▣` project) in the drawer header.

**Replay.** SSE `id:` is the run's event sequence number (base-10, from 1), unique per
run. Reconnect with `Last-Event-ID: <n>` to receive `n+1` onward then live events; the
buffer holds 5 minutes past the run's end, so a phone that slept doesn't lose a run.
Because `EventSource` cannot POST, the reconnect path is a **GET**:

| route | purpose |
|---|---|
| `GET /api/run/:runId/stream` | re-attach to a live or just-finished run; honours `Last-Event-ID` (header or `?lastEventId=`) |
| `GET /api/run/:runId/artifact` | download the saved artifact |

*(Both carry the project segment: `/api/p/:project/run/:runId/…`. The table names the tail so
it reads next to the SSE frames above.)*

### Where a saved artefact lives, and what happens to bytes that cannot say whose they are

**`<artifactsRoot>/<project>/<runId>/<file>`**, and the scratch workspace alongside it at
`<scratchRoot>/<project>/<runId>/`. The `artifact` frame's `path` is library-relative and
therefore carries the project segment; consumers must treat it as an opaque label and use
`url` to fetch.

It was `artifactsRoot/<runId>/` until 2026-08-17 — two clients' durable output in one
directory tree, distinguished only by a run id that nothing on disk relates back to a
project. The download's isolation was then a property of the **in-memory run store** (bounded
at 200, gone on restart) rather than of the store on disk. A filesystem has no constraint
that can refuse a write, so the mechanism is that the destination is *derived* from
`MountedProject`; `apps/runner/src/lib/artifacts.ts` cannot name `RunnerConfig`.

Two refusals on the download, and they are deliberately different:

| situation | code | why |
|---|---|---|
| the run belongs to another project | `run_not_found` (404) | a run id is opaque; confirming it exists elsewhere is itself a cross-project disclosure. From outside its project the run does not exist |
| the bytes are not under this project's artefacts directory | `artifact_unattributed` (500) | not about the caller at all — the runner's own state is inconsistent. **Nothing is deleted**, and the hint names the path |

`artifact_unattributed` is the migration decision made executable. There is nothing to
migrate today (no run has ever executed, so no artefact exists), and the rule outlives that
fact: **a directory in the old layout is refused, never adopted, never deleted.** Adopting
one files a client's output under whichever project happens to be mounted — the act
`run_unattributed` refuses one layer up in the ledger.

## Threads, addressing and the mailbox (`Plan §12`, ADR-023)

**The semantics are [`thread-model.md`](thread-model.md)'s and are not restated here.** That
contract has one owner — `thread-model-engineer` — and two agents editing one shape is how a
shape acquires two readings. What this file owns is the **wire**: the spelling, the bodies,
the statuses. Where the two disagree about meaning, theirs wins; where they disagree about a
path or a status code, this one does.

### The route spelling, and the one correction to the plan

| route | purpose |
|---|---|
| `POST /api/p/:project/thread` | open a thread from a typed line (`@sales/x …`, `#sales …`, `@@sales …`, or no sigil) |
| `POST /api/p/:project/thread/:id/message` | **the one pipe** — a turn, with its interrupt level |
| `GET /api/p/:project/thread/:id` | the thread and its turns. **Built and tested; no caller yet** |

`Plan §12` writes the middle one as `POST /api/thread/:id/message`. **That route cannot be
implemented, and `thread-model.md` §4.1 is right that the difference is load-bearing rather
than cosmetic.** Confirmed here as this file's owner, with their second argument corrected
rather than inherited:

1. **The reason that holds.** ADR-015 Q1 puts the project in the path of every route that
   reads or writes one project's data — no default, no header, no session state. A thread
   *is* one project's data; `ops.thread.project_id` is `NOT NULL` with an RLS policy from the
   migration that creates it. The plan's path is missing a required part of itself.
2. **The reason that does not hold today, and is not what this rests on.** §4.1 adds that
   deriving the project *from the thread row* is impossible because an unscoped read of
   `ops.thread` **raises** (0005 §5). True of the schema and **inert on this stack**:
   compose's Postgres user is a superuser, RLS is bypassed, and `GET /api/status` reports it
   as `projects.scopeEnforcement: "bypassed"`. The unscoped read would currently *succeed*.
   A correction resting on that reason is one the first person to check would find hollow.
3. **A third reason, which needs no database at all.** A lookup-then-scope route is a route
   whose scope is chosen by its own caller-supplied `:id`. Every other route here resolves
   the project **first**, from the path, and only then touches a row — which is exactly what
   lets `run_not_found` be *opaque* across projects rather than merely quiet.

`thread-routes.test.ts` asserts all three thread paths carry `/api/p/:project/`, and that the
plan's spelling is neither mounted nor in `LEGACY_UNSCOPED_PATHS` — it is not a legacy path,
because there is no stale client to inform: these routes were born scoped.

```jsonc
// POST /api/p/:project/thread
{ "line": "@sales/account-enrichment enrich the ACME account", "interrupt": "note" }
// → { thread, message, cost, dispatchable }

// POST /api/p/:project/thread/:id/message
{ "body": "use the Q3 numbers instead", "interrupt": "note" }
// → { message, disposition: "queued" | "delivered-to-run", threadState }
```

### The three interrupt levels — what each one actually does in M16

Declared by the sender, never inferred. An absent level is a **refusal**, not a defaulted
`note`: a defaulted note on a message somebody meant as a halt is a run that keeps spending
after a human told it to stop.

| level | what happens | state in M16 |
|---|---|---|
| `note` | queued; the run's drain consumes it at the next settled tool call, shows it on the console and counts it on the trace. Its **text** reaches the agent on the thread's *next* run, through history seeding | **built** |
| `steer` | **refused, never downgraded** — `interrupt_not_deliverable` (409) | **refused, with the reason stated.** See below |
| `halt` | the drain stops at it, the session aborts, the work so far is extracted as the run's artifact, a `question` with a mandatory `expires_at` is appended, and the thread moves `running → waiting` | **built** |

**`steer` does not work, and the runner says so rather than pretending.** Two refusals with
different hints, because they send a person to two different actions: with no run in flight,
*"send it as a note, or start a run first"*; with a run in flight, *"this runner cannot inject
a turn into a session that is already running."* The second is the honest one. The Agent SDK
is driven here with a **string** prompt; pushing another user turn into a live `query()` needs
its streaming-input mode, which has never been exercised in this repo because **zero runs have
executed**. Writing that plumbing now would put unverifiable code on the one path no test can
reach, and the first thing to exercise it would be a paid run. `MID_RUN_STEER.supported` is
typed `false`, so lifting it is a reviewable, type-level act — the same instrument as
`FAN_OUT_DISPATCH.allowed`.

*Queueing a steer as a note instead would satisfy the route and defeat the point*: a human who
steered and was silently queued believes they changed course, and nothing did
(`thread-model.md` invariant 7).

### The mailbox drain

`ops.message WHERE delivered_at IS NULL`, ordered by `seq` — a predicate, not a table.
Drained at **settled** tool calls (`ok`/`error`), never at `start`: a tool that is still
running is the one moment where stopping leaves work half-done, which is what a checkpoint
exists to avoid. Three rules, each of which fails silently when it is wrong:

- **Marked delivered once.** `AND delivered_at IS NULL` is in the `UPDATE`, so a re-drain does
  not move the clock and *"when did the agent first see this"* stays answerable.
- **A halt stops the drain at that message, inclusive.** The agent read it; that is why it
  stopped. Everything behind it stays in the mailbox for the run that resumes the thread.
- **A steer is never consumed.** Refused at the route, so one in the mailbox means something
  bypassed the route — the drain leaves it undelivered and wedges, visibly, in `mailboxDepth`.
  A wedged mailbox can be seen; a downgraded steer cannot.

### Continuing a thread — and the fork that is not built

**`POST /api/p/:project/run` takes an optional `threadId`.** Supplied, the run is the thread's
next turn and its prompt is seeded with the thread's history (capped, oldest dropped first, in
the **user** turn — a conversation in the system prompt arrives with the authority of the
agent's own instructions). Omitted, the runner opens a fresh `agent` thread, so every run
belongs to one.

There is **no resume-the-SDK-session path**, and that is ADR-023 deleting a fork rather than
this file skipping one: continuing is a new run with the history in front of it, which is what
Part One recommended anyway.

One run per thread at a time — a second run against a running thread is
`thread_not_addressable` (409). Without that, two runs drain one mailbox and each consumes
messages the other will never see.

### Where an address stops being free, and the point that has never fired

**Creating a thread and messaging it are free. Starting a run is what costs money**, so the
enforcement point is on `POST /run` and there is exactly one branch (`assertRunnable`). Three
of the four address forms cannot be run today, each for a reason that is somebody's named open
question rather than an omission:

| address | runs | refusal | unblocked by |
|---|---|---|---|
| `@department/agent` | 1, exactly | — | — |
| `#department` | ≥1 | `address_unresolved` (422) | nothing marks an agent as a lead (`thread-model.md` §9.2, `agent-library-curator`) |
| `@@department` | N, exactly | `fanout_dispatch_refused` (503) | `RUNNER_ANTHROPIC_API_KEY` **plus one proven cap refusal** |
| *(bare)* | ≥1 | `address_unresolved` (422) | M22 — the Chief of Staff router (`Plan §17`) |

**The `@@` refusal is not caution, it is an unproven control.** `ops.project.budget_monthly`
is declared and unenforced; Part V's workspace cap is the only enforced ceiling and **it has
never refused anything, because zero runs have ever executed.** Fan-out would be the first
feature whose first validation run costs N× money against an enforcement point that has never
fired. 503 rather than 403 because the caller did nothing wrong and the refusal is temporary.

The cost preview on thread creation prints the **resolved member count** and **`estimatedUsd:
null`** — typed `null`, not commented. There are no completed runs to average, and a cost
preview is precisely the surface where a plausible number gets believed. `#department` and the
bare address carry `runsAreExact: false`, because a lead that delegates costs a second run.

### `POST /api/p/:project/run/:runId/input` — never built

ADR-023 supersedes it; steering is the message route above. `superseded-run-input.test.ts`
asserts its absence across both contracts directories and both apps' sources, and permits the
string only on a line that says it is superseded or never built — which is the sentence a
reader grepping for the route needs to find.

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
| `GET /api/p/:project/approvals` | one project's pending gates → `PendingApproval[]`: the ref fields **plus `summary` and `inputs`** |
| `POST /api/p/:project/approvals/:runId` | `{decision:"approve"\|"deny", note?}` — resumes or aborts the paused run |
| `GET /api/all/approvals` | every project's pending gates → `PendingApprovalRef[]`: **no `inputs`, no `summary`**. Backs the Mission Control footer badge (§2.5.7) |

A pending approval pulses the MAP node amber and fires a push notification. Denial aborts
cleanly and records the note; the run ends `done{status:"denied", denialNote}`.

### The two routes return two shapes, on purpose (PDPL rule 4)

`/api/all/approvals` is the only route on this surface declared `scope: 'cross-project'`.
That scope is correct and stays — **an approvals queue that shows one project's pending
approvals is not an approvals queue.** What was wrong until 2026-08-17 is that it returned
the full `PendingApproval`, so `inputs` — the form data a human typed, the highest-PII thing
the runner holds — crossed every project boundary M15 was built to establish.

Everywhere else on this API, *client data does not cross clients* is discharged by the route
scope. **Here it has to be argued field by field**, and the cross-project row is now exactly
what survives that argument: `runId`, `project`, `agent`, `agentName`, `department`,
`requestedAt`, `inputCount`. Identifiers, frontmatter, a timestamp, and **how many** inputs
there were — never which, never what.

Two things a consumer should know rather than rediscover:

1. **`summary` is not a label.** `buildPlanSummary` renders the inputs into an `Inputs: …`
   line and appends the `deliver:` Slack channel and email address, so dropping `inputs`
   while keeping `summary` would have moved the payload from an object into a string. The
   label is `agentName`.
2. **Needing to show *what* is being approved is a project-scoped fetch**, and it is not a
   hop you would otherwise have avoided: deciding is `POST /api/p/:project/approvals/:runId`,
   so acting on a row already means entering its project. The cross-project queue's job is to
   say that something is waiting and where.

Asserted at the wire — on the raw response body, not on the type — in
`apps/runner/src/routes/__tests__/approvals-payload.test.ts`. A type cannot hold this line:
TypeScript is structural, so a `PendingApproval[]` is assignable to `PendingApprovalRef[]`
and a fat row would type-check on the way out.

## Reads

| route | returns |
|---|---|
| `GET /api/graph` | the **stored** layout artifact for this project's library — see `contracts/graph-layout.md`. Never simulated (ADR-003), never another project's |
| `GET /api/agents` | `{agents:[{slug, path, frontmatter}], skipped:[{slug, reason}]}` — the list projection CHART's matrix draws from (§2.6). The **resolved set**, so a winning `agents/_overrides/**` file is a row here |
| `GET /api/agents/:slug` | `{slug, path, sourceRef, frontmatter, body, runnable:{tools[], missingConnectors[], approvalRequired, scheduled}}` |
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

### The agent reads go through the cascade, so `sourceRef` is answerable before any run

**Added 2026-08-17, requested by `drawer-engineer`.** `GET /api/agents/:slug` carries
`sourceRef: string` — `{layer}:{path}@sha256:…`, the same grammar as the SSE `start` frame
(ADR-014 §2), produced by the resolver and **never synthesised from `path`**.

It is **required, not optional**, and that is the load-bearing half. The route resolves
through the same call `POST /run` uses, so there is no state in which the runner holds an
`AgentDetail` and does not know which file it came from. An optional field would have to be
rendered as `unknown` in a state that cannot occur — and `unknown` would then be
indistinguishable from the state that *can*, which is "no run has started yet". That is
exactly what the drawer header did: it said SOURCE UNKNOWN in the state the product spends
almost all of its time in, because the only available source of provenance was a run that had
not happened.

The reason this is a contract change rather than a field: **`loadAgent` read
`<repo>/agents/{slug}/SKILL.md` directly.** So an `_overrides/` file could win a run while
MAP, CHART, the drawer and the validator all kept rendering the project layer's copy — *what
you see is not what runs*, with no error message anywhere (`Plan §21.9`), and BOARD rule 4
defeated without a line of wrong code. Both reads now resolve, which is also why
`skipped[]` can now carry `capability_widened`: an agent whose resolved tool list would be
refused at dispatch is **excluded with its reason**, not drawn as a tile whose WIRED INTO list
cannot run.

One thing a consumer may not do, and it is worth stating because it is the obvious shortcut:
**do not infer a layer from `path`.** An L0 path and an L1 path are indistinguishable from
outside the coordinator the moment a global library exists, and a badge that starts lying does
so without anyone editing it.

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
| the target is **this project's** tier | the permitted `agent_ref` is derived from the project being written to, so the agent named and the file written cannot disagree about which project they are in. A write aimed at the **global** tier throws `brain_write_refused` (403) rather than returning `null` — the legitimate refusals are silent, this one never is |

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
| `project_scope_missing` | 400 | a pre-project path was used. The hint names the `/api/p/:project/…` form |
| `project_not_found` | 404 | not a slug, or a reserved one (`all`, `p`, `api`) |
| `project_not_mounted` | 503 | a real project whose library is not on this host — **not** 404 |
| `project_not_active` | 409 | paused or archived: keeps its history and library, does not start runs |
| `agent_not_found` | 404 | no `agents/<slug>/SKILL.md` in any layer of this project's cascade |
| `invalid_frontmatter` | 422 | SKILL.md failed the schema contract — excluded from the map too |
| `tool_not_allowed` | 403 | a tool outside `wired_into` was requested mid-run |
| `unknown_connector` | 422 | a `wired_into` name has no connector wired (schema invariant 5) |
| `cascade_unresolved` | 422 | the introducing layer could not be **read**, so the capability ceiling is unknown. Fails closed rather than trusting the copy it can read (ADR-014 §3) |
| `capability_widened` | 403 | a lower layer grants a connector, or loosens `approval`, beyond the layer that introduced the agent. The hint names the one legal route: a new slug |
| `connector_uncredentialed` | 422 | this project declares a connector it holds no `ops.credential` row for. **There is no global fallback**, and the mechanism is the absence of one |
| `run_not_found` | 404 | unknown `runId`, or its buffer expired |
| `run_not_pending_approval` | 409 | decided a run that isn't at its gate |
| `approval_already_decided` | 409 | second decision on the same run |
| `thread_not_found` | 404 | no such thread **in this project's scope**. Deliberately opaque across projects, like `run_not_found` |
| `thread_not_addressable` | 409 | the thread is `closed`, already has a run in flight, is addressed to a different agent, or moved underneath the caller |
| `thread_transition_refused` | 409 | an illegal thread state transition (`thread-model.md` §4.5) |
| `address_malformed` | 400 | the addressing grammar refused the line. The parser's own code and its sentence go in `hint`, because this is the one refusal a human reads while typing |
| `address_unresolved` | 422 | parsed, but no agent or department of that name in **this project's resolved roster** — or an address form that cannot be dispatched yet (`#`, bare). The hint names what would unblock it |
| `address_ambiguous` | 422 | `@slug` matched more than one department. The hint **lists the matches**; resolution never picks, because picking runs an agent the human did not mean, which is `Plan §21.9`'s bug class with no error message |
| `interrupt_not_deliverable` | 409 | a `steer` — with no run in flight, or with one this runner cannot inject into. **Never a silent downgrade to a note** |
| `fanout_dispatch_refused` | 503 | `@@` would spawn N runs against a cap that has never fired. 503, not 403: the caller did nothing wrong and the refusal lifts the day the cap proves it can refuse |
| `question_unanswered` | 409 | answering a question past its `expires_at`. Also the run-failure reason when a question expires with a run waiting — **and nothing sweeps expiries in M16**, so this code is reachable only by the first path today |
| `thread_store_unavailable` | 503 | threads live in Postgres and this runner has none (`--profile dev`, by design). A refusal, not a fallback: an in-memory thread is a conversation that vanishes on the next deploy while looking exactly like one that persisted |
| `artifact_unattributed` | 500 | the saved bytes are not under the serving project's artefacts directory — a pre-project-axis `artifactsRoot/<runId>/` directory, or a future writer that escaped the derivation. **Refused, never adopted, nothing deleted**; the hint names the path. Not `run_not_found`: that code is the cross-project refusal and is deliberately opaque, whereas this is a fault in the runner's own state and there is nothing for the caller to have done differently |
| `invalid_cron` | 400 | not a 5-field cron |
| `git_write_refused` | 403 | write target outside `agents/**` (ADR-002) |
| `brain_write_refused` | 403 | the Second Brain write-back was refused **before git was reached** — the tier being written is not this project's (ADR-007, `COMPANY.md` rule 9). Same status as the row above and deliberately a different code: a person reading a log needs to know which file to open |
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
