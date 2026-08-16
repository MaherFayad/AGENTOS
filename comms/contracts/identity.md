# CONTRACT — Identity, devices, and billing accounts

**Owner:** `identity-access-engineer`

**Source:** `AGENTOS-V2-PLAN.md` Part Two §11, carried over from Part One §6 (Phase 4) — **a
plan that amends the spec of record, not spec**
([ADR-013](../decisions/ADR-013-part-two-standing-and-spec-coverage.md)). Cite it as
`Plan §11`, never `§11`; the spec of record has no §11 and a bare section number always means
the spec. Where the plan and the spec of record disagree, **the spec wins until an ADR says
otherwise.**

**Decision of record:** [ADR-016](../decisions/ADR-016-identity-device-billing-account.md).

**Sibling contract:** [`project-scoping.md`](project-scoping.md), owned by `runner-engineer`
in trust. It owns the **project axis**; this file owns the **identity axis**. They are two
axes and never one — that is invariant 3 below. Its §5.3 (Q16–Q20) is the question set this
contract and ADR-016 answer.

**Status:** **authoritative for `ops.identity`; a consumer's statement for the other two.**
`ops.device` and `ops.billing_account` are on loan under the M15 interim split and every
sentence about them here describes what this contract *asks of* them, not what it may change.
A section marked OPEN is a question, and a consumer who guesses an answer to it has invented
a contract.

---

## 0. The whole point: three things, not one

Part One's Phase 4 treats "accounts" as a single concept. **It is three, and conflating them
produces a schema you have to unpick later.** §11 exists to undo that conflation.

| Concept | Question it answers | Table | Owner today |
|---|---|---|---|
| **Identity** | Who is asking? | `ops.identity` | `identity-access-engineer` |
| **Device** | From what, with what powers? | `ops.device` | `sessions-relay-engineer` *(loan)* |
| **Billing account** | Who *pays* for this run? | `ops.billing_account` | `runner-engineer` *(loan)* |

They are orthogonal: **one you, N devices, M paying accounts.**

**The working test, and it settles most arguments in this area in one step:** *sort the
question into which of the three it is about, before answering it.* Most confusion here is a
question that was answered against the wrong table — including one in the plan itself (§2.3).

---

## 1. What "auth exists in v2" does and does not mean

**Quote both halves or neither.** Two readers took the plan's text two ways in one evening,
which is why this table appears in BOARD, in `decisions/README.md`, in the
`identity-access-engineer` definition, and now here.

| | v2 | BOARD constraint #5 amended? |
|---|---|---|
| **Identity / auth** — accounts, devices, scopes, per-account billing | **exists**, *inside* the tailnet | **Yes** — *"no auth in v1 by design"* is superseded. This contract is that mandate. |
| **Transport** — public ports, exposure | **unchanged.** Tailnet-only | **No.** *"No public ports"* survives. Authelia in front of Caddy is a *later* ADR (Part One §8; `Plan` line 995: *"not further amended here"*). |

**v2 gains accounts. v2 does not gain a public surface.**

**Corollary, and it binds every consumer of this file: never build anything that is only safe
because auth exists. It does not.** Nothing in this contract is an authentication boundary.
There is no login, no session cookie, no signed challenge and no denial point anywhere in the
system as it stands.

---

## 2. Invariants — fixed by ADR-016, not open for design

A design that violates one of these is a bug, not a preference.

1. **Three tables, orthogonal.** One you, N devices, M paying accounts. A change that merges
   any two of them reverses ADR-016 and needs its own ADR.

2. **Scopes live on the device, never on the identity.** The phone that answers approvals at
   23:00 gets `read · run · approve`; it does not get `admin`. This is the single load-bearing
   consequence of the split: it makes losing a phone a **revocation, not an incident**. With
   scopes on the identity, revoking a phone means editing *you*.

3. **Identity and project are two axes.** `ops.identity` has no `project_id`, `ops.device` has
   no `project_id`, and neither is row-level-scoped. One you, one phone, across every project.
   (`project-scoping.md` invariant 9 states the same thing from the other side.)

4. **Revocation is a first-class path, not a delete.** A revoked device keeps its row, with a
   timestamp and a reason. **That row is the audit trail** — deleting it destroys the only
   record that the revocation happened, which is the record you want on the one day it matters.

5. **A revoked device holds no scopes.** Enforced by CHECK in 0006, not by the caller
   remembering. "Revoked but still powerful" is not a representable state.

6. **No secret material in Postgres.** Tables hold a `secret_ref` — the *name* of an env var
   or a file on a mounted volume, resolved at dispatch. **A dump of the Operations volume is
   not a dump of the credentials**, and it is structurally true rather than a claim about an
   encryption routine nobody has written: there is no ciphertext column to decrypt and no key
   to lose. (§6.)

7. **`ops.identity` designs for more than one row and builds one** (Part One §8 stands).
   Designing for N and building 1 is legal; building N because it might be needed is not.
   Nothing enforces the count — a `CHECK` pinning it to one would be the un-design.

8. **Session E2E stays intact** (spec §3.1, CLAUDE.md rule 5, BOARD #5). Nothing in identity
   may create a reason to decrypt server-side. `sessions/relay/envelope.ts` **rebuilds** rows
   from an allowlist rather than filtering them; adding a key to that allowlist is a security
   decision belonging to `sessions-relay-engineer`, by deliberate ADR, as that file's own
   comment demands. §5 records a recommendation and settles nothing.

9. **Scopes enforcement is deferred, and the deferral is a gate.** §4.

---

## 3. The three tables

### 3.1 `ops.identity` — who is asking

`apps/runner/src/db/migrations/0007_identity.sql`. **This contract's own table.**

| Column | Meaning |
|---|---|
| `id` | uuid, `ops.identity_id_for(slug)` |
| `slug` | stable, greppable, unique |
| `display_name` | a label. **CHECK forbids `@`** — an address here would make the row personal data at rest (PDPL, Part VII.4) |
| `created_at` | |

One row is seeded: `owner` / `Owner`. It carries no personal data by construction.

**Three columns it deliberately does not have**, each absence being the design:

- **`scopes`** — invariant 2.
- **`project_id`** — invariant 3.
- **`disabled_at`** — nothing reads it, and it would make a claim nothing honours
  ("identities can be disabled"). That is the same defect as a scopes column with no
  enforcement point, one table over. With one row, adding it later is a migration on a table
  with one row: cheap exactly when it is needed.

**There is deliberately no TypeScript mirror of `identity_id_for`.** `project.ts` earns its
mirror because the runner must resolve a project with no Postgres at all (`--profile dev`);
nothing resolves an identity at all yet. Two implementations of one identifier is how a
foreign key silently stops matching (0005's own comment).

### 3.2 `ops.device` — from what, with what powers

`0006_ops_device.sql`, `sessions-relay-engineer`'s. **This contract does not define it and
does not change it.** What it asks of it, all four of which the table already satisfies:

1. `scopes` lives here and on no other table.
2. `revoked_at` + `revoked_reason`, and no `DELETE` path anywhere.
3. No `project_id` (invariant 3).
4. `identity_id uuid NOT NULL REFERENCES ops.identity(id) ON DELETE RESTRICT`, **and no
   UNIQUE on it** — see §4 of the seam below. This is the one clause not yet met, correctly.

### 3.3 `ops.billing_account` — who pays

`0005_project_axis.sql`, `runner-engineer`'s. Cross-project by design: one work account pays
for four clients.

**`Plan §11` names a single `ops.credential` here and that was a question answered against the
wrong table.** 0005 split it in two and **ADR-016 ratifies the split**:

| Table | Holds | Scope |
|---|---|---|
| `ops.billing_account` | who pays — work vs personal Claude accounts | **cross-project** |
| `ops.credential` | this project's secret for this connector, keyed `(project_id, connector)` | **project-only** (ADR-014 §3.1) |

Apply the working test and it is immediate: *"which HubSpot key does this project use?"* is
not a question about who pays. One table would have forced a nullable `project_id`, which is
`project-scoping.md` invariant 8's failure mode with the safety off.

**Consequence for readers of BOARD:** the M15 ownership row reading *"`ops.credential` —
billing accounts, which account paid"* now names the wrong table. `ops.credential` is
connector secrets and belongs to the **project** axis, not to `Plan §11` at all. Correction
filed to `commandcenter-orchestrator`; BOARD is theirs to edit.

### 3.4 Which account paid — already built, not by this contract

`ops.agent_runs` carries `account_id` + `account_source ∈ (unattributed · project-default ·
run-override)`, with a CHECK tying them together (0005 §4a). **Default account per project,
override per run, and no frontmatter field** — billing is not part of an agent's identity,
because the same agent in two projects should be able to bill to two accounts.

`unattributed` is the load-bearing value: *"we do not know who paid"* is a byte, not a NULL a
cost-by-account chart would quietly drop. **`unknown` is not `zero`.**

---

## 4. Scopes enforcement is deferred — and the deferral is enforced

> **A scope with no enforcement point is a comment.** (M15 ruling.)

The column is **defined** (`ops.device.scopes text[]`), **populated** (default `'{}'` — a
device that registers without an explicit grant holds no powers rather than all of them), and
**read by nothing**. No route, no middleware, no policy.

**Why this is not laziness:** building a scopes model now means building it against no threat
model — there is no authentication, so there is no principal to check a scope against — and
rewriting it when the auth ADR lands. Meanwhile the danger of a decorative column is real and
specific: the next reader assumes it is enforced and builds on that assumption. That is this
repo's most-repeated defect wearing a new costume — a confident value nobody can check.

**Three mechanisms hold the deferral, none of them a comment:**

| Mechanism | Where | What it does |
|---|---|---|
| `ops.device_scopes_enforced()` | 0006 §4 | Returns constant `false`. A surface that wants to claim "scopes: enforced" must ask the database and is told no. Reported on `GET /api/status` as `devices.scopeEnforcement`. |
| A red test | `scripts/__tests__/identity-model.test.mjs` §5 | Fails if **any** source file starts reading a scopes value. The allowlist is empty; the ADR that lands enforcement adds exactly one file to it, and that diff is the visible record that a comment became a mechanism. |
| A CHECK | 0006 | A revoked device cannot hold a scope, so a future enforcement point cannot be defeated by a reader who checked `scopes` and forgot `revoked_at`. |

**When enforcement is proposed** it is an amendment to ADR-016 and it must **name the single
point at which a request is denied, in one sentence.** If that point cannot be named in one
sentence, the proposal is not ready. It lands together with **ADR-021** (*"auth exists in
v2"*, reserved in BOARD's register to this agent) — they are one decision, because "auth
exists" acquires a testable consequence at exactly the moment a request can be refused.

---

## 5. OPEN — and who owns each answer

The four questions this contract does not settle. Each names the single agent who must answer
it. **Nothing may be built against these.**

### ~~O1. Does `account_id` join the E2E envelope allowlist?~~ — **ANSWERED: no**

`project-scoping.md` §5.3 Q19. Ruled by `sessions-relay-engineer`, whose file it is (invariant
8). `SESSION_ENVELOPE_KEYS` stays at exactly five keys, pinned by an exact-equality assertion
and a test that feeds `sanitizeSessionRow` a row volunteering `account_id` / `accountId` /
`accountLabel` and asserts none of it survives. Reasoning:
`comms/inbox/sessions-relay-engineer/20260816-2236-commandcenter-orchestrator-m15-ops-device.md`
(`## Answer`). **Cited by path, not by number** — that ruling has no ADR number yet and nobody
allocates one by counting files.

Their general test is worth reusing on this whole class of question: **name the operation the
server must perform on the field.** There is none — the session list is decrypted and sorted in
the browser, so grouping by account is the same operation on the same object.

**Standing clause, binding regardless of who owns `ops.device`:** *an amendment to this ruling
requires `sessions-relay-engineer` as co-author.* Custody of `apps/web/src/sessions/**` does not
transfer with the device table — a decision *about* that file is not custody of it. The reason
is exact: **"identity needs one more field in the envelope" is the most plausible way CLAUDE.md
rule 5 gets loosened, and it would arrive as a reasonable request.**

### O2. Where does a `secret_ref` resolve, and what is the recovery path? — `runner-engineer`

§5.3 Q18's remaining half. The custody question is answered structurally (invariant 6), but
*"an env var on the runner means a container recreated without it is a lockout with no
recovery path; a file on a mounted volume means the volume is now a secret"* is still live, and
it is discovered during an outage at the worst possible moment. The `secret_ref` **grammar** is
unspecified today — no code parses one — and that is a gap, not a decision.

### O3. Does `ops.billing_account` gain an `identity_id`? — `runner-engineer`

Deliberately not taken here. With one identity the column is a constant, and a constant column
is the same defect as a scopes column nothing reads. Proposed, not performed.

### O4. When do the two loaned tables transfer? — a written exchange

`ops.device` from `sessions-relay-engineer`, `ops.billing_account` from `runner-engineer`.
**Until that exchange exists in writing, the interim owner is the owner and this contract is a
consumer.** The form is fixed (BOARD, ADR-000): a `decision-request` naming the table, the
date and what moves; the owner answers in the same file; both statuses update; BOARD's
Successor column becomes the Owner column. **An ownership change that happens because someone
edited a file is the failure this whole `comms/` layer exists to prevent.**

---

## 6. What this contract cannot validate, and what kind of claim each one is

Stated plainly, because a contract that hides its own untestability is worse than one with
gaps, and because this repo's house standard is that a criterion is either **structural** or
**empirical** and never implied to be the second when it is the first.

| Claim | Kind | Why |
|---|---|---|
| Three tables stay three; scopes on the device only | **structural** | `identity-model.test.mjs`, migration text |
| No secret material in Postgres | **structural** | same test, over every migration |
| Nothing reads a scopes value | **structural** | same test, over every source file |
| Seeded identity holds no personal data | **structural** | CHECK + test |
| The device seam is correct when built | **structural, conditional** | asserts shape *if* `identity_id` exists; does not assert existence |
| **A dump of the volume yields no credential** | **not yet either** | Postgres has never been dumped, and `ops.billing_account` has **zero rows**. The structural claim (no ciphertext column) is proven; the operational one is unexercised. |
| **"Which account paid"** | **not validatable in P1** | there are **zero runs**. `project-scoping.md` §6 lists this explicitly. Blocked on `RUNNER_ANTHROPIC_API_KEY`. |
| A device registers, is seen, is revoked | **not validatable** | no code path writes `ops.device`; zero devices |
| Scopes deny anything | **N/A by design** | deferred (§4). There is nothing to validate and claiming otherwise would be the lie. |
| Device handoff / continuity | **not built** | needs `ops.thread` (M16) |

`rtl-arabic-pdpl-specialist`'s sign-off is **mandatory** wherever identity touches client data
at rest, and must state which of the two kinds it is. In M15 it can only be structural.

---

## 7. Consumers

`sessions-relay-engineer` (`ops.device`, the envelope, push) · `runner-engineer`
(`ops.billing_account`, `ops.credential`, the billing cap, `api-contracts.md`) ·
`observability-engineer` (cost split by account **and** project — two axes) ·
`platform-projects-engineer` / `runner-engineer` in trust (the project axis) ·
`rtl-arabic-pdpl-specialist` (PDPL sign-off) · `fidelity-qa-reviewer` (acceptance).

Anything not written above is not a promise. Ask; do not guess.
