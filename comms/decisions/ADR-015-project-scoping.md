# ADR-015 — Project scoping: the third plane, `ops.project`, and how a request names its project

**Date:** 2026-08-17 · **Author:** `runner-engineer` · **Status:** proposed
**Affects:** `contracts/project-scoping.md` (mine, in trust) · `contracts/api-contracts.md` (mine) ·
`contracts/agent-cascade.md` + [ADR-014](ADR-014-agent-cascade-resolution.md) (`agent-library-curator`) ·
[ADR-016](ADR-016-identity-device-billing-account.md) (`identity-access-engineer`) ·
M15 · every route in the runner · all 34 metrics endpoints (`observability-engineer`) ·
the shell's switcher and breadcrumb (`shell-navigation-engineer`)

**Number:** allocated on BOARD before this file was written, per the numbering rule. The
plan's `§18` calls part of this content "ADR-016"; translate through
[`decisions/README.md`](README.md) before citing anything from `AGENTOS-V2-PLAN.md`.

---

## Context

Everything in this repo assumes exactly one library, one ledger, one brain and one of
everything else. `Plan §9`–§11 adds a third plane — **projects** — under a system that has
no axis for it, and `Plan §10` is explicit that this is *an audit of every table and route
that already exists*, not an addition to them.

The forcing constraint, from `project-scoping.md` invariant 8 and `Plan §21.8`:

> **Isolation is proved by a failing query, not by a filter.** A query that reaches a
> project-scoped table without a project predicate **fails**, rather than returning another
> project's rows.

That single sentence is what makes the obvious options wrong. A nullable `project_id` plus
a forgotten `WHERE` is the exact mechanism by which client A's data reaches client B, and it
does not announce itself — it looks like a working feature until the day it does not. Two
further constraints narrow the field before any design starts:

- **BOARD #5.** Tailnet-only, no auth in v1. Nothing here may be safe *because* auth exists.
  Project scoping is therefore a correctness boundary, not a security boundary, and it must
  be honest about that distinction rather than borrowing credibility from an authentication
  layer that is not there.
- **`--profile dev` has no Postgres** (M0 #3) and must still serve MAP, CHART and the
  drawer. So the coordinator cannot ask the database which project it is.

And one lesson, which this repo paid for twice in one evening and which governs the whole
document: **a comment is not a mechanism.** `workspace` confinement was a docstring claiming
a boundary that did not exist, and only a test asserting on the *filesystem* proved a run
could overwrite the repo-root `.env`. Every "must not" below therefore names the CHECK, the
foreign key, the RLS policy, the absent code path or the failing test that enforces it. Where
the mechanism is weaker than the claim, **the claim is weakened**, not the other way round.

---

## Options

The eight questions `project-scoping.md` §5.1 raised, and what each cost to specify loosely.

### Q1 · Q2 — how does a request name its project, and is there a "current" one?

| Option | For | Against |
|---|---|---|
| **A. Path segment** `/api/p/:project/…` | Greppable, cacheable, visible in every log line and bug report, impossible to forget — the route does not exist without it | Every client URL changes; a stale client breaks |
| B. Request header | No URL churn | Invisible in a log and in a bug report. A missing header is indistinguishable from a header nobody sent |
| C. Server-side "current project" | Fewest edits | **An ambient default**, and an ambient default is the mechanism by which one project's data gets served under another project's name. It also gives every route two ways to be scoped, only one of which appears in tests |

### Q3 — the project of a row that predates projects

| Option | For | Against |
|---|---|---|
| **A. Backfill, then `NOT NULL`** | The column can never be absent; invariant 8's failure mode is structurally unavailable | The migration must be correct on a populated database, not only on this empty one |
| B. Nullable with a default | Cheap now | A nullable `project_id` is invariant 8 with the safety off. The `NULL` rows are the ones a forgotten `WHERE` returns |

### Q4 — deleting a project

| Option | For | Against |
|---|---|---|
| **A. Refuse the delete while history exists; archive instead** | History you cannot read is history you have lost, and it is discovered exactly once | "Delete" does not delete, which must be said in the UI |
| B. Cascade-delete ops rows | Tidy | Silently destroys the only record of what was run for a client |
| C. Tombstone rows | Keeps history | Two truths about whether a row exists; every query needs a second predicate it will sometimes forget |

### Q6 — `budget_monthly`, enforced in two places

| Option | For | Against |
|---|---|---|
| **A. `ops.project.budget_monthly` declared, **not** enforced in M15; Part V's workspace cap remains the only enforced ceiling, and the API says which is which** | One enforced number. Spend-per-project can only be computed from ledger rows and **zero runs have ever executed**, so any cap derived from it is either a false refusal or a silent pass | A column nothing reads — mitigated by `budgetEnforced: false` travelling next to it |
| B. Enforce in the runner now | Feels complete | Two enforcement points reading one number *will* disagree, and the disagreement looks like a bug in whichever one you are watching |

### Q8 — are `panels/*.json` cascaded like agents?

| Option | For | Against |
|---|---|---|
| **A. Not in M15. Panels are mounted per project, not resolved through layers** | ADR-014's rules are written about `agents/**` and depend on properties panels do not have (a capability ceiling, a `status` derived from runs, an `agent_ref`). §2.5.6 says a seventh centre or a rename is a rail-order change in six files — multiply by N projects before choosing | A project cannot yet inherit a global dashboard |
| B. Cascade them now | Symmetry | Symmetry is not a reason. It would need its own resolution rules from `dashboards-engineer` against ADR-004's six Command Centers, and would be designed with one project to test it on |

### Q8b — one brain or N? **Not mine to answer, and not answered here.**

`COMPANY.md` is injected into **every** invocation (§3.3). Getting this wrong is not a
display bug — it is client A's company context reaching an agent running for client B, on
every single call. That is a PDPL boundary before it is a scoping preference, and
`rtl-arabic-pdpl-specialist` holds a mandatory sign-off on cross-project isolation
(`Plan §22`). Routed, not decided. What M15 implements is the mount that either answer needs:
`company/` is resolved **per project, with no global fallback**, which is the conservative
direction — if the ruling is "one brain", adding a fallback is additive; if the ruling had
been assumed and was wrong, the leak would already have happened on every run.

---

## Decision

### 1. A request names its project in its path, and there is no default.

`/api/p/:project/…`. **Option A everywhere.** There is no `currentProject`, no cookie, no
header and no fallback anywhere in the runner. Routes that describe the *coordinator itself*
(`/api/status`, `/api/projects`) are unscoped and marked `scope: 'coordinator'` in the route
table; routes that deliberately span projects live under `/api/all/` and are marked
`scope: 'cross-project'`. There are exactly two of the latter, which is a number a reviewer
can hold in their head — that is the point of giving them a namespace instead of letting them
look like ordinary routes.

**Three refusals, deliberately distinct**, because collapsing them sends three different
people to look in the same wrong place:

| Code | Status | Means |
|---|---|---|
| `project_scope_missing` | 400 | The segment is absent. *You did not say which project.* |
| `project_not_found` | 404 | Not a slug, or a reserved one. *That is a typo.* |
| `project_not_mounted` | 503 | A real project, whose library is not on this host. *Try the coordinator running there.* |
| `project_not_active` | 409 | Paused or archived. Keeps its history and its library; it just does not start runs. |

**The pre-project paths stay mounted and answer 400 with the scoped path in the hint.** Not a
404, which reads as a deleted feature and sends someone hunting; and above all **not a
redirect to a default project**, which would serve one client's rows under another client's
name, silently, and look like it worked.

*Enforced by:* `resolveProject` in `apps/runner/src/lib/project.ts`, called at the head of
every project-scoped handler — a function, not a Fastify hook, so a route that forgets it is
a **compile error** rather than a silently unguarded handler. The legacy refusals are
registered from `LEGACY_UNSCOPED_PATHS` in the contract, so deleting a row there deletes the
route. Both are asserted at the wire in
`apps/runner/src/routes/__tests__/api.test.ts` — every legacy path, every refusal code, and
an assertion that **a refusal never also carries a result set**.

### 2. `ops.project` describes a mount. The coordinator's own mount is configuration.

The runner must serve with no Postgres, so **which library this process has on disk** is
configuration (`AGNETOS_PROJECT_SLUG`, defaulting to `agentos` — the row migration 0005 seeds
and the value `Plan §24` fixes). `ops.project` is the operations plane's row for the same
project, keyed by the same slug and the **same deterministic id**:

```
ops.project.id = md5('agnetos.project:' || slug)::uuid
```

Two implementations of one identifier is how a foreign key silently stops matching — and it
would not look like a bug, it would look like an honest empty state for a project whose rows
were sitting right there under a different uuid. *Enforced by:*
`apps/runner/src/lib/__tests__/project-id.test.ts`, which **reads `0005_project_axis.sql` and
asserts the expression, the slug regex and the reserved-slug list character-for-character
against the TypeScript.** Editing either side alone fails in milliseconds, with no database.

Derived, then **stored**: the id is authoritative from the moment the row exists, so renaming
a slug later keeps the id and every ledger row hanging off it.

The table, and what enforces each claim:

| Column | Claim | Mechanism |
|---|---|---|
| `id`, `slug`, `name` | slug is kebab and not `all`/`p`/`api` | `CHECK slug_is_a_slug`, `CHECK slug_is_not_reserved`, mirrored by `isProjectSlug` and asserted equal |
| `library_path`, `workspace_root` | a mount that exists | `NOT NULL` |
| `library_remote` | **cannot be stored** until the egress ADR lands | `CHECK library_remote_needs_egress_adr (library_remote IS NULL)` — see decision 6 |
| `host_affinity[]` | declared, read by nothing | `hostAffinityEnforced: false` shipped beside it in `ProjectSummary` |
| `budget_monthly` | declared, not enforced | `budgetEnforced: false` shipped beside it; see decision 4 |
| `default_account_id` | provably an Anthropic account, not a connector secret | composite FK to `ops.billing_account (id, kind)` |
| `status` | archived rows carry a date | `CHECK archived_has_a_date` |

**There is deliberately no column describing what an agent *is*.** ADR-009's rule is unchanged
and now load-bearing at N projects: a project row may reference
`agents/sales/account-enrichment`; it may never define it.

### 3. Backfill, then `NOT NULL`, then a foreign key that refuses deletion.

Every project-scoped table gets `project_id NOT NULL REFERENCES ops.project(id) **ON DELETE
RESTRICT**`. Deleting a project detaches a library and **never** deletes one (`Plan §9`); this
decision extends the same promise to history, which `Plan §9` is silent about. `DELETE FROM
ops.project` with one ledger row behind it **fails in the database**. Archiving is the removal
path.

The backfill is written even though zero rows exist, because the migration will only ever be
applied again to a database that *does* have rows.

Two tables needed more than a column, and both would have been silent data corruption:

- **`ops.agent_run_daily` was keyed `(day, agent)`.** Under the cascade the same
  `(department, slug)` in two projects is two different agents (ADR-014 §2), so this table
  would have **merged two clients' history into one row** the first time retention ran —
  silently, months later, with the source rows already deleted. The key is now
  `(day, project_id, agent)`.
- **`app.agent_outputs` upserted on `(kind, entity_key)`.** Two clients with a deal keyed
  `ACME-1` would have overwritten each other through a unique index. That is a *write*, which
  is why it is named separately.

### 4. `agent_ref` is the foreign key of every operations row. `source_ref` is recorded per run.

Adopted from ADR-014 §2 without amendment, because it is `agent-library-curator`'s to decide
and this contract owns only the mount:

- **`agent_ref = {project}/{department}/{slug}`** — the addressable agent. Run history, ledger
  rows and liveness hang off this and **never follow a fork or a promotion**.
- **`source_ref = {layer}:{path}@sha256:…`** — which file actually won the cascade, at what
  content, recorded on the **run**.

*Enforced by:* `CHECK agent_ref_ends_with_agent`, so the two columns cannot drift into
disagreeing about which agent a row belongs to; and `source_ref NOT NULL`, so a run cannot be
recorded without saying what ran. `source_ref` is also emitted on the SSE `start` frame, before
any token, because *"I ran the wrong code-reviewer"* is a bug class with **no error message**
(`Plan §21.9`) and the console is where a human is already looking.

### 5. Capability narrows downward, re-derived by the runner at dispatch, failing closed.

ADR-014 §3 puts one enforcement point in the runner's court and this ADR implements it.
`apps/runner/src/lib/cascade.ts` reads the layers, derives the **capability ceiling** from the
*introducing* layer — the least-specific layer that defines this `(department, slug)` — and
refuses any resolved `wired_into` that exceeds it (`capability_widened`, 403) or any `approval`
that loosens it.

Three properties, each with a named mechanism rather than a rule:

1. **Resolution and enforcement are one call.** `resolveForDispatch` is the only way the run
   pipeline can obtain a runnable agent, and the `AgentRecord` does not exist until
   `assertNarrowsDownward` has returned. If they were two calls, a future caller could resolve
   without asserting and get a working run — the check would then be something a reviewer has
   to notice.
2. **Both sides of the comparison are parsed by the same function.** If the caller derived the
   resolved side itself, the two readings would eventually disagree about what a bare-string
   `wired_into` or a capitalised connector name means, and the check would pass a widening it
   could not see.
3. **Fail closed, and know the difference between two kinds of missing.** A global library that
   cannot be *read* is `cascade_unresolved` (422) — refusing rather than trusting the copy it
   can read, because treating an unreadable layer as "does not define this agent" silently
   promotes the local file to introducing layer and hands it its own ceiling. A global library
   that is simply **not configured** is *not* an error: the cascade has two real levels until a
   global library repo exists, and the project layer is then the introducing layer. Collapsing
   those two would either break every dev machine or silently trust a local file's tool list.
   Same disease as `unknown` vs `zero`, one plane up.

*Enforced by:* `apps/runner/src/lib/__tests__/cascade-ceiling.test.ts` — six cases, driving the
real pipeline and asserting on **the allowlist the session actually received**, never on the
validator's opinion of a file. This is the condition `commandcenter-orchestrator` attached to
M15's PASS, and its reasoning is `agent-library-curator`'s: *"CI is not a boundary."* The
validator runs on a repo; the thing that runs is a resolved agent on a host.

### 6. `budget_monthly` is declared and **not** enforced. `library_remote` cannot be stored.

The one enforced ceiling is Part V's capped API-key workspace in the runner, and it stays the
only one. `budget_monthly` and `host_affinity[]` ship with a sibling boolean —
`budgetEnforced: false`, `hostAffinityEnforced: false` — on every `ProjectSummary`. **A cap
rendered next to no enforcement is a UI telling a lie it was handed**; the flag is what makes
that a decision instead of an accident.

`library_remote` is different in kind and gets a stronger mechanism. A `git push` sends a
project's library to a third party, which is the same class of event as a `deliver:` target
leaving the tailnet — an open BOARD question under `rtl-arabic-pdpl-specialist` (Part VII.4).
So the column carries `CHECK (library_remote IS NULL)`: until that ADR lands and a later
migration drops the constraint, **a remote cannot be stored, so no code path can act on one.**
Dropping a constraint is a reviewable act; ignoring a comment is not.

### 7. Isolation is a failing query — and whether it is *in force* is reported, not assumed.

Migration 0005 puts row-level security on every project-scoped table, with a predicate that
distinguishes three states:

```
scope = a project   → that project's rows. Zero rows means zero runs. Honest.
scope = '*'         → every project. Deliberate, greppable, used by prune and /api/all/* only.
scope unset         → SQLSTATE 42501. Not empty. Not zero. It raises.
```

Returning zero rows would be the worse failure and is the one this repo has already been
bitten by twice: an unscoped read that quietly answers "nothing here" is indistinguishable
from an honest empty state.

**And now the part that matters more than the policy.** RLS is bypassed entirely by a
superuser or a `BYPASSRLS` role, and compose's default Postgres user is a superuser. **So on
the stack as it ships today, section 5 of that migration is inert.** That is stated here
rather than papered over, and it is reported rather than assumed:
`ops.project_scope_enforced()` is probed at request time and surfaced as
`GET /api/status → projects.scopeEnforcement` (`enforced` | `bypassed` | `unknown`) and as
`GET /api/projects → scopeEnforced`. `unknown` is its own answer and is not `bypassed`: with
no ledger we have not *learned* that isolation is off, we have failed to ask.

**A hole you can see on a status page is a task. A hole described in a migration comment is a
surprise.** Closing it is one line of infra — a non-superuser role for the app connection —
and is filed to `infra-compose-engineer`. It is deliberately not done in a migration, because
a migration that quietly changed who the runner connects as would be a worse surprise than the
one it fixed.

### 8. Nothing project-shaped bakes in a department count.

`Plan §10` says seven business departments in one sentence and an eighth, `engineering`, in
the next. The eighth is out of M15 (BOARD). The cheap half is bought now: there is no
`CHECK (department IN (...))` and no literal `7` anywhere in `0005_project_axis.sql`.
*Enforced by:* an assertion in `project-id.test.ts` that strips SQL comments first — the
migration's own header says it has no department enum, and a test that matched its own
documentation would be the purest form of the mistake this repo keeps auditing for.

### 9. `ops.identity` is defined and built by nobody. The seam is named and stopped at.

`identity-access-engineer` exists as a definition and now has this work. What M15 does is
split the one table `Plan §11` names into two, because they scope oppositely and one table
would have forced a nullable `project_id`:

- **`ops.billing_account`** — deliberately **cross-project**. One work account pays for four
  clients.
- **`ops.credential`** — deliberately **project-only**, keyed `(project_id, connector)`.

Neither stores secret material. `secret_ref` is the *name* of a secret, resolved at dispatch,
which makes "the key is outside Postgres" (`Plan §11`) **structurally true** rather than a
claim about an encryption routine nobody has written: there is no ciphertext column to decrypt
and no key to lose (Q18).

**There is no global credential fallback**, and the mechanism is the absence of one — the
primary key has no nullable `project_id` to fall through to, and the lookup has no second
branch (ADR-014 §3.1). This is worth stating as a rule precisely because *"fall back to the
global one"* is the convenience a future implementer adds at 2am to unblock one project.

**Scopes enforcement is deferred, not forgotten** (Q17). BOARD #5 says there is no auth
boundary in v1 by design, and **a scope with no enforcement point is a comment**. Building a
scopes model now means building it against no threat model and rewriting it when the auth ADR
lands. Q19 (does `account_id` join the E2E envelope allowlist) is `sessions-relay-engineer`'s
and is not answered here; Q20 (project default plus a per-run override, no frontmatter field —
because the same agent in two projects should be able to bill to two accounts) is recorded on
`ops.agent_runs.account_source` with `unattributed` as a **named** third state, so
"we do not know who paid" is different bytes from "nobody paid".

---

## Consequences

**What becomes easy.** Adding a project is a row and a mount. Every route says whose data it
is answering for, in a string a human can read in a log. A forgotten predicate raises instead
of returning a neighbour's rows. "Which file did this run actually execute?" is answerable
from the ledger and from the console. A project layer can take capability away from an agent
and provably cannot add any.

**What becomes hard, and should.** Widening an agent's `wired_into` in a project library now
requires a new slug — which means a new `agent_ref`, zero run history, and no inherited halo.
That is the intended cost: **the act that widens capability is the same act that discards the
trust.** You cannot inherit a halo and a new tool in one commit.

**What breaks today, visibly.** Every existing client URL. `apps/web` calls `/api/graph`,
`/api/agents`, `/api/runs`, `/api/panels` and `/api/status` unscoped, and all but the last now
answer **400 `project_scope_missing`** with the scoped path in the hint. This is the designed
migration signal and it is `shell-navigation-engineer`'s slice to consume (project switcher,
project segment in routes and breadcrumb). It is loud on purpose: the alternative was a
default, and a default here is the failure this ADR exists to prevent.

**What has to change if we reverse this later.** The path segment is the reversible choice —
it can be made optional by adding a default, and that is exactly the change nobody should
make. The two decisions that are genuinely expensive to reverse are the **deterministic id**
(a stored uuid, now a foreign key) and the **`(day, project_id, agent)` rollup key** (changing
it back merges history). Both were chosen to be correct on a populated database rather than a
convenient one, because this migration will only ever be applied again to a populated one.

**What this ADR cannot claim.** `project-scoping.md` §6 lists seven things M15 cannot
validate, and this decision does not shrink that list. In particular: cross-project isolation
here is proved **structurally** (a query without a predicate raises; a policy exists) and
**not empirically** (there are no rows to leak, and RLS is currently inert on this stack). The
mandatory sign-off from `rtl-arabic-pdpl-specialist` must say which of the two it is. Signing
it off as the second would be the lie this whole project is organised to avoid.

---

## Contract edits

**`comms/contracts/project-scoping.md`** (mine, in trust for `platform-projects-engineer`) —
§5.1 Q1–Q8 move from OPEN to answered, citing this ADR. Q8b stays open and stays routed to
`rtl-arabic-pdpl-specialist`. §5.3 Q16, Q17, Q18, Q20 are answered as above and Q19 stays with
`sessions-relay-engineer`; §5.3's owner line changes from "unassigned" to
`identity-access-engineer`. §3's column table gains the mechanism column. §6 is unchanged and
is the section consumers must still read.

**`comms/contracts/api-contracts.md`** (mine) — the project axis on every route: the
`/api/p/:project` prefix, the `/api/all/` namespace, the four `project_*` error codes with
their statuses, `LEGACY_UNSCOPED_PATHS` and what they answer, `GET /api/projects`,
`StatusResponse.projects`, `PendingApproval.project`, and `agentRef` + `sourceRef` on the SSE
`start` frame.

**`packages/contracts/src/project.ts`** — new, the code half.
**`packages/contracts/src/api.ts`** — as above.

**`comms/contracts/agent-cascade.md`** (`agent-library-curator`'s) — **no edits.** Decision 5
implements ADR-014 §3 and §7.3 and re-defines nothing. If ADR-014 changes, `cascade.ts`
follows it.

**`comms/contracts/design-tokens.md`**, **`frontmatter-schema.md`**, **`panel-schema.md`**,
**`graph-layout.md`** — none.
