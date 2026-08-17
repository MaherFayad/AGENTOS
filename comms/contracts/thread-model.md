# CONTRACT — Threads, addressing, and the mailbox

**Owner:** `thread-model-engineer`. Outright — nothing is held in trust here, and every change
request comes to this agent.

**Source:** `AGENTOS-V2-PLAN.md` Part Two §12 · §23.7 · §23.8 — **a plan that amends the spec
of record, not spec** ([ADR-013](../decisions/ADR-013-part-two-standing-and-spec-coverage.md)).
Cite these as `Plan §12`, never `§12`.

**Decision of record:** [ADR-023](../decisions/ADR-023-thread-unification.md) (`proposed`).

**Sibling contracts, and the boundaries that are not restated here:**

| Contract | Owner | Boundary |
|---|---|---|
| [`project-scoping.md`](project-scoping.md) | `runner-engineer` | The project axis. Every rule in it binds here; none of it is re-argued. |
| [`agent-cascade.md`](agent-cascade.md) | `agent-library-curator` | What an agent **is** and how a slug resolves. An address is resolved *against* the cascade's roster; this file never restates resolution. |
| [`api-contracts.md`](api-contracts.md) | `runner-engineer` | The wire. §4 below specifies message and interrupt **semantics**; the route and its error codes are transcribed there by its owner. Two agents editing one contract is how a shape acquires two readings. |

**Status: authoritative on shape, and nothing here has ever run.** The schema exists, the
grammar parses and refuses, the writer and the schema are checked against each other with no
database. **No thread has been created, no message delivered, no mailbox drained, and no run
has ever executed.** §8 is the list of what cannot be validated and it is a section of this
contract rather than a footnote, because consumers need to read it.

---

## 1. What this contract governs

> **A thread is the unit. A run is a thread with an agent on the other end. A session is a
> thread hosted by a CLI. A task is a thread with a due date. A schedule creates threads.**
> — `Plan §12`

Three things that arrive together and cannot be separated:

| Half | Plan § | Where it lives |
|---|---|---|
| **The thread** — `ops.thread`, `ops.message`, `thread_id` on the run ledger | §12 | `0008_threads.sql`, `apps/runner/src/db/threads.ts` |
| **The addressing grammar** — `@agent` · `#department` · `@@fan-out` · bare | §12 · §23.8 | `packages/contracts/src/threads.ts` |
| **The mailbox** — one pipe, three interrupt levels, questions travelling back along it | §12 | §4 below; the drain is `runner-engineer`'s |

**What it deletes.** M11's parallel task entity, `ops.question` as a system beside threads, the
*"resume the SDK session vs re-seed a new run"* fork, and
`POST /api/run/:runId/input` — which is **never built** (ADR-023 supersedes it).
Each is a `Plan §19` amendment, not a preference. See ADR-023 §"What this deletes".

*That last line is written the way it is on purpose.* `superseded-run-input.test.ts` refuses
that route anywhere in `comms/contracts/`, `packages/contracts/src` or either app's `src` —
**except on a line that also says it is superseded or never built.** A blanket ban would forbid
the document whose job is to forbid the route; an exclusion list by filename would rot. The only
way to write it legally is to write the sentence a reader grepping for it needs to find.

---

## 2. Invariants — fixed by Part Two, not open for design

A design that violates one of these is a bug, not a difference of opinion.

1. **One run, one trace.** Unchanged, and it is the entire reason this unification is
   affordable (`Plan §12`). A thread spanning four runs is **four traces**, correlated by
   `ops.agent_runs.thread_id`. If your design needs one run to span two traces, you have
   designed something else.

2. **Threads are project-scoped from the first migration.** Not added later. `0008` creates
   `ops.thread.project_id` and `ops.message.project_id` as `NOT NULL` with foreign keys and
   row-level-security policies in the same file that creates the tables (`Plan §10`).

3. **`#` and `@@` must be different characters and must *look* different**, because one costs
   one run and the other costs N (`Plan §12`). This is a UI requirement *and* a schema one —
   see invariant 4.

4. **The delivery mode is stored, never inferred.** `#sales` and `@@sales` both produce a
   thread of `kind = 'department'`. A schema that cannot tell a one-run action from an N-run
   action has lost the thing `Plan §12` spends a paragraph protecting. Hence
   `ops.thread.delivery`, pinned to `kind` by `thread_delivery_matches_kind`.

5. **The count is real; the money is not.** A cost preview prints the resolved member count and
   **may not print a dollar figure**, because zero runs have completed and there is nothing to
   average (BOARD rule 9). `TurnCost.estimatedUsd` is typed `null`.

6. **`expires_at` is mandatory on a question.** A run blocked forever on a question nobody saw
   looks idle, holds a slot, and delivers nothing. On expiry the thread fails loudly with
   `question_unanswered` (`Plan §12`).

7. **A `steer` is refused, never downgraded.** Sent to a thread with no run in flight it
   returns `interrupt_not_deliverable`. A human who steered and was silently queued believes
   they changed course, and nothing did.

8. **`comms/` is not threads** (`Plan §24`). `comms/` is how build agents coordinate; threads
   are how the human directs business agents. They look similar. Nothing in this contract reads
   or writes `comms/`, and no thread is ever created from a `comms/` message.

9. **Session content never enters `ops.message`.** A session thread's conversation is
   end-to-end encrypted and the server must not hold its plaintext (spec §3.1, CLAUDE.md rule
   5). Enforced by `message_never_holds_session_content`, not by a convention.

10. **`ops.task` and `ops.question` are never created.** A task is a thread with `due_at`; a
    question is a message kind (`Plan §19`). Asserted by a test over every migration file.

11. **Bare address means Chief of Staff — as an *address*.** M16 defines where the message goes
    (`addressed_to = 'chief-of-staff'`, `kind = 'project'`). The router that would answer it is
    M22's (`Plan §17`). M16 refuses it honestly; it does not invent a recipient.

12. **Nothing here is safe only because auth exists.** Tailnet-only, unchanged (BOARD #5).

---

## 3. The addressing grammar

Normative implementation: `packages/contracts/src/threads.ts`. Tests:
`apps/runner/src/lib/__tests__/thread-address.test.ts`.

### 3.1 The four forms

| Typed | Form | `kind` | `delivery` | `addressed_to` | Runs |
|---|---|---|---|---|---|
| `@sales/account-enrichment` | direct | `agent` | `direct` | `sales/account-enrichment` | 1, exactly |
| `@account-enrichment` | direct, department unresolved | `agent` | `direct` | resolved first | 1, exactly |
| `#sales` | dispatch | `department` | `dispatch` | `sales` | **at least** 1 |
| `@@sales` | fan-out | `department` | `fan-out` | `sales` | N, exactly |
| *(nothing)* | default | `project` | `default` | `chief-of-staff` | at least 1 |

`parseThreadAddress(line)` returns the address and the remaining body. It is **total** — it
never throws, and a line with no sigil is the `default` address rather than an error.

### 3.2 What the parser refuses, and what it deliberately does not decide

| Code | Example | Why it is a refusal and not a best guess |
|---|---|---|
| `unknown_sigil` | `&sales hi` | Treated as body text it would be delivered to the Chief of Staff while the human believes it went to Sales — a wrong recipient with no error message. |
| `empty_address` | `@`, `#`, `@@` | — |
| `malformed_address` | `@Sales`, `@sales/`, `@a/b/c` | Names are kebab, and an agent is at most `department/agent`. |
| `dispatch_needs_department` | `#sales/account-enrichment` | `#` goes to a lead. |
| `fanout_needs_department` | `@@sales/account-enrichment` | `@@` addresses a department. |

**Two things the parser does not do, on purpose:**

- **It never consults the department list.** `Plan §10` says seven departments in one sentence
  and an eighth (`engineering`) in the next, and BOARD forbids baking `7` into anything
  project-shaped. The grammar validates *shape*; whether a department exists is a
  **resolution** question, answered per project against the cascade's roster.
- **It never resolves `@account-enrichment` to a department.** It returns `department: null`.
  Resolution finds exactly one match or refuses with `address_ambiguous`. Picking the first
  match runs an agent the human did not mean, which is `Plan §21.9`'s bug class with no error
  message — the one provenance exists to mitigate.

### 3.3 Resolution — whose job it is

Turning a parsed address into a `ResolvedThreadAddress` needs a project's resolved roster,
which is `agent-cascade.md`'s. This contract specifies only the two refusals resolution owes:

| Code | Meaning |
|---|---|
| `address_unresolved` | The grammar parsed; no agent or department of that name exists in this project. |
| `address_ambiguous` | `@slug` matched more than one department. The refusal **lists the matches**; it does not pick. |

---

## 4. Messages, the mailbox, and the three interrupt levels

### 4.1 The route

**`POST /api/p/:project/thread/:id/message`.**

**This differs from `Plan §12`'s `POST /api/thread/:id/message`, and the difference is
load-bearing rather than cosmetic.** ADR-015 Q1 makes the project a path segment on every route
that reads or writes one project's data, with no default, no header and no session state. A
thread is project data. Deriving the project *from the thread row* would require reading
`ops.thread` with no project in scope — which, by migration 0005 §5, **raises**
`project_scope_missing` by design. So the plan's route cannot be implemented under ADR-015 at
all; it is not a style choice. `runner-engineer` transcribes the final spelling into
`api-contracts.md`, which is theirs.

### 4.2 The three levels

Declared by the sender, on the message, never inferred from context.

| Level | Behaviour | Refusal |
|---|---|---|
| `note` | Queued. Read at the next tool boundary. Cheap, non-disruptive. | none — always deliverable |
| `steer` | Injected into the in-flight session now. Changes course mid-task. | `interrupt_not_deliverable` when no run is in flight (invariant 7) |
| `halt` | Stop, checkpoint the work so far, ask before continuing. | none — a halt on an idle thread is a no-op that is still recorded |

**Interrupt level is present exactly when a person sent the message.** `human` and `answer`
messages carry one; `agent`, `question` and `system` messages carry none. That is an equality,
enforced by `message_interrupt_matches_kind`, not a habit — a human message with no declared
level and an agent message carrying one are both wrong and both silent.

### 4.3 The mailbox is a predicate, not a table

`ops.message WHERE delivered_at IS NULL`, ordered by `seq`. One place the messages live, one
place the agent reads them, and no second entity to fall out of step with the first — the same
argument that deleted `ops.question`.

**The drain is `runner-engineer`'s** and happens at tool boundaries. What this contract fixes:

- Draining marks `delivered_at` **once** — `markMessagesDelivered` carries
  `AND delivered_at IS NULL`, so a second drain does not rewrite the timestamp and make *"when
  did the agent first see this"* unanswerable.
- A drain that finds a `halt` stops at that message and does not consume the ones behind it.
- `seq` is monotonic per thread with `UNIQUE (thread_id, seq)`. Two concurrent appends collide
  loudly rather than producing two message #4s in one conversation.

### 4.4 Message kinds

| Kind | Sent by | Carries |
|---|---|---|
| `human` | a person | `interrupt` |
| `agent` | an agent | — |
| `question` | an agent, to the person | **`expires_at`, mandatory** |
| `answer` | a person, to a question | `interrupt`, **`in_reply_to`** |
| `system` | the coordinator | — |

`payload jsonb` is an **object, never pre-flattened prose** — see §7.2.

### 4.5 States and transitions

| From | May become |
|---|---|
| `open` | `running` · `closed` |
| `running` | `open` · `waiting` · `failed` · `closed` |
| `waiting` | `running` · `failed` · `closed` |
| `failed` | `open` · `closed` |
| `closed` | — **terminal** |

`waiting → failed` is the expiry path (`question_unanswered`). **`failed` is deliberately not
terminal:** continuing a thread starts a new run seeded with the thread's history (`Plan §12`),
so retrying is the ordinary path, and a terminal `failed` would force every retry to be a new
thread and discard the history that made the retry worth doing.

**The transition table is enforced in `assertThreadTransition` and nowhere else.** The database
constrains the *set* of legal state values and says nothing about the order. That is a decision:
two implementations of one state machine drift, and the drift is invisible until a thread is
stuck. Named here so *"the database does not enforce order"* is read as chosen rather than
forgotten.

---

## 5. The tables

Types, keys, nullability and constraint names are fixed by `0008_threads.sql`. **`Plan §12`'s
`ops.run_ledger` is spelled `ops.agent_runs`** (migration 0001); the plan's name is prose.

### 5.1 `ops.thread`

| Column | Meaning | What enforces the claim |
|---|---|---|
| `id` | uuid, generated by the writer before the insert so a failure message can name the thread | `PRIMARY KEY`, no default — the writer must name it |
| `project_id` | the axis | `NOT NULL`, FK `ON DELETE RESTRICT`, RLS policy |
| `kind` | `agent · department · project · session` | `thread_kind_known` |
| `delivery` | `direct · dispatch · fan-out · default · session` | `thread_delivery_known` + `thread_delivery_matches_kind` |
| `addressed_to` | **project-relative** — `{department}/{slug}` · `{department}` · `chief-of-staff` · session id | `thread_addressed_to_shape`, one branch per kind |
| `state` | `open · running · waiting · closed · failed` | `thread_state_known`; the *order* is `assertThreadTransition`'s |
| `parent_thread_id` | fan-out children and delegations | composite FK `(parent_thread_id, project_id)` — a child cannot live in another project; `thread_parent_is_not_self` |
| `created_by` | `human:` · `agent:` · `schedule:` · `system:` | `thread_created_by_shape` |
| `due_at` | **a task is a thread with a due date** | nullable, by design |
| `account_id` | a **preference**, never the authority on who paid | FK to `ops.billing_account`; the run's `(account_id, account_source)` is authoritative (ADR-015 Q20) |

`addressed_to` is project-relative because `project_id` is already the row's own column, and two
copies of one fact eventually disagree. 0005 could keep both on `ops.agent_runs` because a CHECK
can pin them *within a row*; that is not available across tables, so the redundancy is removed
rather than pinned.

### 5.2 `ops.message`

Thirteen columns; the ones with a decision behind them:

| Column | Note |
|---|---|
| `project_id`, `thread_kind` | Denormalised from the thread and **pinned by a composite FK** to `ops.thread (id, project_id, kind)`. A message claiming the wrong project or the wrong kind fails to insert. This buys a *direct* RLS predicate on the one table in the database where a leak is free text a person typed. |
| `seq` | Derived in SQL from the thread's own rows; `UNIQUE (thread_id, seq)`. |
| `body` | **Free text a person typed. The highest-PII value in this repo.** §7. |
| `payload` | An object. Never prose. §7.2. |
| `expires_at` | `(kind = 'question') = (expires_at IS NOT NULL)` — an equality, both directions. |
| `in_reply_to` | `(kind = 'answer') = (in_reply_to IS NOT NULL)`. An answer that names no question is a label, and the question it settles becomes a guess made from timestamps. |
| `delivered_at` | `NULL` ⇒ still in the mailbox. |

### 5.3 `ops.agent_runs.thread_id` — nullable, and why that is a decision

`Plan §12` gives the run ledger a `thread_id`. **It ships nullable**, meaning *"this run predates
threads"*, and here is the whole judgement, because this column is one keystroke away from
repeating M15's most expensive defect:

> Migration 0005 made four columns `NOT NULL` on this table and `ledger.ts` named none of them.
> Nothing caught it, and the first real run would have been paid for and then failed to record.
> **Grade a constraint from both sides: a `NOT NULL` nobody can satisfy and one that holds are
> identical in a schema dump.**

`recordRun` is `runner-engineer`'s writer and the route that would create a thread for a run is
their M16 slice. Shipping `NOT NULL` ahead of that writer would be writing the M15 defect on
purpose, in the same table, six weeks later.

**What makes it a decision rather than a decorative column:** the day
`ALTER COLUMN thread_id SET NOT NULL` lands, `writer-schema-agreement.test.ts` goes red **with no
database**, on the assertion that every mandatory column is named by the insert. That property
was falsified before it was claimed — the `SET NOT NULL` was planted and both assertions went
red. The forcing function exists; it is simply not in the migration.

Its consumer, this milestone: `observability-engineer` (`thread_id` on the 34 metrics endpoints
and LAST RUNS). Named because a producer with no consumer is not a feature.

---

## 6. What the composer may print

`Plan §23.8` asks for `@@sales · 4 runs · ~$0.40`. **The `4` is knowable exactly. The `$0.40`
has no source.** `addressCost()` returns:

```
{ runs: number, runsAreExact: boolean, estimatedUsd: null, estimateBasis: 'no-completed-runs' }
```

| Address | `runs` | `runsAreExact` | Why |
|---|---|---|---|
| `@agent` | 1 | `true` | one turn, one run |
| `@@department` | N | `true` | N is the **resolved** member count — a caller that guesses it has invented the one figure that was supposed to be real |
| `#department` | 1 | **`false`** | the lead answers *or delegates*, and a delegation is a second run |
| bare | 1 | **`false`** | the Chief of Staff triages, answers or routes |

**`runsAreExact: false` is not pedantry.** `Plan §23.8` says `#sales` "says 1 run"; printing a
flat `1 run` beside a mechanism that routinely costs two is a plausible number one decimal place
up, which is the same defect as a plausible zero.

`estimatedUsd` is typed `null`, not commented `null`. The day real runs exist, making it a number
**stops `threads.ts` compiling**, and the diff that widens the type is the diff that has to say
where the figure came from — the same instrument as `ProjectSummary.budgetMonthlyUsd`.

### 6.1 Fan-out dispatch is refused, and the enforcement point is named

**Grammar, parser, composer and preview ship in M16. The path that spawns N runs does not.**

| | State |
|---|---|
| Enforcement point | Part V's capped API-key workspace in the runner |
| Has it ever refused anything? | **No. Zero runs have ever executed.** |
| `ops.project.budget_monthly` | declared, **not enforced** (ADR-015 Q6) |
| Unblocked by | `RUNNER_ANTHROPIC_API_KEY` **and one proven cap refusal** |

`assertFanOutDispatchable(n)` throws `fanout_dispatch_refused`, names the count that would have
been spent, and names what would unblock it. `FAN_OUT_DISPATCH.allowed` is typed `false`, so
flipping it is a reviewable, type-level act — not a config edit at 2am. One branch now, deleted
in one line the day the key and the cap land.

**Also binding on the composer, from BOARD:** `@@` requires an explicit confirm that **names the
count** — not a tooltip, not a hover — reachable *and dismissable* from the keyboard without the
fan-out firing (§23.11 rule 7). That is `sessions-relay-engineer`'s and `drawer-engineer`'s
surface; it is stated here because the requirement belongs to the grammar, not to a component.

---

## 7. PDPL — `ops.message` is the highest-PII surface in this repo (Part VII.4)

Every other table in this database holds identifiers, mounts, counts and the names of secrets.
`ops.message.body` holds **free text a human typed**, which is the one thing no schema can
constrain.

### 7.1 The body is stored verbatim, and never instrumented

Storing it is the point — a redacted record is not a record. What is forbidden is letting it
*leave* the process:

- **It never becomes a span attribute.** `messageSpanAttributes()` is a type with **no `body`
  field to add back**. That is the mechanism; a comment asking the next author to omit it is
  not, and M15 proved the difference twice (`lib/graph.ts` stopped importing `RunnerConfig`;
  `PendingApprovalRef` lost its `inputs`). The test serialises the whole projection and asserts
  no fragment of the body or payload appears in it.
- **It never enters a push payload.** Contentless push is a discipline, not a flag (`Plan
  §21.7`). The first time a question's text is put in a notification body "so it's more useful",
  the property is gone and nobody notices.
- `bodyChars` is a length. A length is not content, and it is here because *"the human sent
  something and the agent read nothing"* and *"the human sent nothing"* must be different rows.

### 7.2 Flattening defeats key-based redaction

Structured content goes in `payload jsonb` **as an object**. Composed into prose first, four of
five denylisted keys survive — found three times in one night during M15 (the approvals
`summary`, the plan span, and the redactor itself). `redact()` walks object keys, and a string
has none. **Compose prose at the point of display, never before the point of storage.**

### 7.3 Retention and erasure — stated, because a contract that hides its own gaps is worse

| | What is true today |
|---|---|
| **Retention** | **Unbounded.** `ops.prune` is deliberately *not* extended to these tables: threads are not telemetry, and pruning by age deletes the product's memory rather than its exhaust. Growth is a real operational question, routed, not answered here. |
| **Erasure** | **Not executable.** No plane in this repo has a delete verb; the only erasure unit this architecture can execute is the *project*, and deleting a project is itself refused while history exists (ADR-015 Q4). |

**And one thing that changes for `comms/specs/observability.md`'s erasure table.** Its strongest
answer today is that redaction runs at instrumentation with no unredact path, so *"for every
field the rules catch, erasure is satisfied by construction: there is nothing there to erase."*
**That argument does not hold for `ops.message`.** The body is deliberately not redacted, so it
is the first plane in this repo where a data subject's own words are stored in full. Project-level
erasure still terminates — one `DELETE`, one project. Subject-level erasure moves from
*unanswerable because we minimised* (a strong position) to *unanswerable because no delete verb
exists* (a weak one). Routed to `observability-engineer` and `rtl-arabic-pdpl-specialist`; see
§10.

**A delete verb gets its own ADR before its first line of code.** Erasure is destructive, and
writing one inside a migration nobody asked to review is how an irreversible capability arrives
without a decision behind it.

---

## 8. What this contract cannot validate yet

Every item is blocked on a **human** decision on BOARD, not on an agent. M16 inherits M15's
distinction verbatim and it is not a formality here.

> **M16 can be completed. M16 cannot be *validated* until Phase 0's human items land.**

| Cannot be validated | Why | Unblocked by |
|---|---|---|
| A thread with an agent on the other end | no run has ever executed | `RUNNER_ANTHROPIC_API_KEY` |
| The mailbox drains at a tool boundary | nothing has ever reached a tool boundary | same |
| A `steer` changes an agent's course | there is no in-flight session to inject into | same |
| `question_unanswered` on expiry | no question has been asked | same |
| Fan-out costs N runs, and the cap refuses | **the cap has never fired, once** | same, **plus one proven refusal** |
| A cost preview's money figure | there are no completed runs to average — which is why there is no figure | same |
| That a thread in project A never appears in project B | structural only: RLS is inert for a superuser and compose's user is one (0005 §6) | `infra-compose-engineer`'s non-superuser role |
| The composer, the THREADS view, `#` vs `@@` at 1440px | no reference frame, no headless browser | the headless-browser / reference-frames pair |

`rtl-arabic-pdpl-specialist`'s review of every new surface is **mandatory before it ships**
(§23.11 rule 6) and must state which kind of isolation claim it is making — **structural** or
**empirical**. In M16 it can only be the first.

---

## 9. OPEN — questions that must be answered before code depends on them

Each names the one agent who owns the answer and what it costs to specify loosely. **A section
still marked OPEN is a question, and a consumer who guesses an answer to it has invented a
contract.**

### 9.1 Do session threads get a mailbox? — owner: `sessions-relay-engineer`

`Plan §12` says *every* thread has a mailbox. M16 **refuses** session messages at the database
(`message_never_holds_session_content`), so today a session thread is listed, addressed and
stateful, and cannot hold a turn.

*Loose costs:* the alternative is storing a session's conversation server-side in plaintext,
which is CLAUDE.md rule 5 and the best-designed boundary in this repo. `envelope.ts` rebuilds
rows from an allowlist rather than filtering them, and its own comment demands that any added key
arrive by deliberate ADR. **Whoever answers this must be `sessions-relay-engineer`.** The
conservative direction is built: dropping a CHECK later is reviewable; un-leaking a body is not.

### 9.2 Does `#department` resolve to a *lead*, and how is a lead identified? — owner: `agent-library-curator`

`Plan §12`: dispatch *"goes to the department lead, which answers itself or delegates."*
**Nothing in `frontmatter-schema.md` marks an agent as a lead.** M16 stores `addressed_to =
'{department}'` and does not name an agent, which is the honest shape; resolution is a cascade
question.

*Loose costs:* inventing a `lead: true` field here would put an agent-identity field in a thread
contract, and ADR-014 §3 classifies frontmatter fields for exactly this reason. Until it is
answered, `#department` parses, stores and previews, and **dispatch has no target**.

### 9.3 Right-to-erasure over `ops.message` — owners: `rtl-arabic-pdpl-specialist` (the ruling) · `observability-engineer` (the erasure table)

See §7.3. *Loose costs:* this is the first table whose contents cannot be defended by
minimisation. Answering it late means answering it with rows in the table.

### 9.4 Retention horizon for threads and messages — owner: `observability-engineer`

Unbounded today, deliberately. *Loose costs:* an age-based prune copied from `ops.agent_runs`
would silently delete conversations, which is the opposite of what a thread is for.

### 9.5 Does a fan-out parent thread hold its own transcript? — owner: `thread-model-engineer` (me), **deferred on purpose**

Built: `@@sales` creates a parent `department` thread and N child `agent` threads via
`parent_thread_id`. Not decided: whether the parent's own `ops.message` rows mirror the
children's answers or stay empty and are read through the children.

*Deferred rather than guessed* because it is a read-shape question and the reader — the THREADS
view, "you see N answers side by side" — does not exist yet. Designing a mirror against no
renderer produces a plausible spec. Nothing in §5 depends on the answer; both shapes fit the
schema unchanged.

### 9.6 Does a thread carry a title? — owner: `thread-model-engineer` (me), **answered: no, not in M16**

A list needs a label; a label is either authored (a field nobody fills) or derived (the first
message, truncated). Deriving is a **view** concern and belongs with whoever builds the list.
Adding a column later is additive; adding one now guarantees it is either empty or a duplicate
of a message body — a second copy of the highest-PII value in the database, in a column that
would end up in every list payload.

---

## 10. Consumers — and what each one is getting

Every field this contract specifies, with the agent who reads it. Where the consumer is a later
slice, it says so, so nothing looks delivered that is not.

| What | Consumer | State |
|---|---|---|
| `ops.thread` / `ops.message`, the writer in `db/threads.ts` | `runner-engineer` — `POST /api/p/:project/thread/:id/message`, the drain | **M16, not started.** The storage layer is here so the route does not learn the column list a second time. |
| The grammar, refusals, `canonicalAddressedTo` | `runner-engineer` (route), `sessions-relay-engineer` (composer) | **built and tested;** no caller yet |
| `addressCost`, `FAN_OUT_DISPATCH`, `assertFanOutDispatchable` | `sessions-relay-engineer` (preview), `drawer-engineer` (composer), `runner-engineer` (the refusal branch) | **built and tested;** no caller yet |
| `messageSpanAttributes` | `observability-engineer` | **built and tested;** no caller yet. It is the instrumentation point for `ops.message` and nothing else may be. |
| `ops.agent_runs.thread_id` | `observability-engineer` — 34 metrics endpoints, LAST RUNS | **column exists, written by nothing.** §5.3. |
| `ThreadState`, `THREAD_TRANSITIONS`, `INTERRUPT_LEVELS` | `design-system-guardian` — the monochrome register for `#` vs `@@` and `note`/`steer`/`halt` | **built;** the register is theirs to design |
| `MessageKind`, `ThreadKind` | `dashboards-engineer` — the `thread-feed` widget, ADR-028 | **built;** ADR-028 is theirs |

**Routed to owners of files this contract does not own** — recorded here as well as in the
handoff, because a recommendation that reaches no owner never becomes work (BOARD, 2026-08-17):

1. **`runner-engineer`** — nine proposed `ApiErrorCode`s and their statuses (§11), plus the
   route spelling correction in §4.1. `api-contracts.md` and `packages/contracts/src/api.ts` are
   theirs; nothing has been added to either.
2. **Whoever owns `writer-schema-agreement.test.ts`** — a live permissive hole was found and
   fixed in it: `isRequired` matched `\bdefault\b` **inside a string literal**, so a `NOT NULL`
   column whose enum contains the value `'default'` read as optional and dropped out of the
   mandatory set. Demonstrated: with the unhardened parser, a writer omitting a mandatory column
   passes green. Same failure class for `generated` and `serial`.
3. **`observability-engineer` · `rtl-arabic-pdpl-specialist`** — §7.3, the erasure table's
   minimisation argument does not extend to `ops.message`.
4. **`sessions-relay-engineer`** — §9.1, session mailboxes. Nothing in `envelope.ts` was touched.
5. **`agent-library-curator`** — §9.2, how a department lead is identified.

---

## 11. Proposed error codes — `runner-engineer`'s to accept or rename

Not added to `api-contracts.md` or `packages/contracts/src/api.ts` by this agent: both are
`runner-engineer`'s and a contract has exactly one owner. The uniform body
`{error:{code,message,hint?}}` is unchanged.

| Code | Status | When |
|---|---|---|
| `thread_not_found` | 404 | No such thread **in this project's scope**. Deliberately opaque across projects, like `run_not_found`. |
| `thread_not_addressable` | 409 | The thread is `closed`, or it moved underneath the caller. |
| `thread_transition_refused` | 409 | An illegal state transition (§4.5). |
| `address_malformed` | 400 | The grammar refused it (§3.2). The parser's own code goes in `hint`. |
| `address_unresolved` | 422 | Parsed; no such agent or department in this project. |
| `address_ambiguous` | 422 | `@slug` matched more than one department. The hint **lists them**. |
| `interrupt_not_deliverable` | 409 | A `steer` with no run in flight. Never a silent downgrade to `note`. |
| `fanout_dispatch_refused` | 503 | §6.1. Temporary and not the caller's fault, hence 503 rather than 403 — `runner-engineer`'s call. |
| `question_unanswered` | 409 | Answering an expired question. Also the **run failure reason** when a question expires with a run waiting on it. |

---

Anything not written above is not a promise. Ask; do not guess.
