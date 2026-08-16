# ADR-016 — Identity vs device vs billing account: three tables, orthogonal

**Date:** 2026-08-17 · **Author:** `identity-access-engineer` · **Status:** proposed
**Affects:** `comms/contracts/identity.md` (new, this agent) · `comms/contracts/project-scoping.md` §5.3 Q16–Q20 (`runner-engineer`) · `apps/runner/src/db/migrations/0007_identity.sql` · `0006_ops_device.sql` (`sessions-relay-engineer`) · `0005_project_axis.sql` (`runner-engineer`) · BOARD M15 ownership table

**Number provenance:** taken from **BOARD's ADR register**, where row 016 reads *"Identity vs
device vs billing account · `identity-access-engineer` · claimed, unwritten"*. Not computed by
listing `comms/decisions/` — that method has now failed twice and ADR-012 is permanently vacant
as the record of it. `Plan §18`'s "ADR-017" is this decision; `Plan §3`'s "ADR-013" is this
repo's **ADR-021** and is still reserved (see §8).

---

## Context

`Plan §11` exists to undo a conflation in Part One's Phase 4, which treats "accounts" as one
concept. It is three:

| Concept | Question it answers | Table |
|---|---|---|
| Identity | Who is asking? | `ops.identity` |
| Device | From what, with what powers? | `ops.device` |
| Billing account | Who *pays* for this run? | `ops.billing_account` |

`project-scoping.md` §5.3 posed five questions (Q16–Q20) and recorded that **§11 had no
owner** — `Plan §22` creates five specialists and none of them owns it. The
`identity-access-engineer` definition was written on 2026-08-16 and dispatched on 2026-08-17;
this is its first decision.

Three constraints shape it, and each rules out an otherwise obvious option:

- **BOARD constraint #5 is amended in one half only.** Identity, devices, scopes and
  per-account billing **exist** in v2, inside the tailnet — *"no auth in v1 by design"* is
  superseded. Transport is **unchanged**: tailnet-only, no public ports, Authelia a later ADR.
  **v2 gains accounts; v2 does not gain a public surface.**
- **Part One §8 stands.** One identity. Design for more, build one.
- **Session E2E is untouchable** (spec §3.1, CLAUDE.md rule 5).

---

## Options

| Option | For | Against |
|---|---|---|
| **A. One `ops.account` table**, as Part One Phase 4 implies | One table, one join, one concept to explain | Scopes end up on the person, so **losing a phone becomes an incident rather than a revocation**. Billing and device lifetime get the same row: revoking a phone touches the row that pays for runs. This is the schema §11 exists to prevent. |
| **B. Three tables, scopes on the device** *(chosen)* | Orthogonal — one you, N devices, M paying accounts. Revocation is local to a device. Billing splits by account *and* project without touching identity. | Three tables and two joins where the plan's prose implies one. Two of the three are owned by other agents during M15, so this ADR must ask rather than write. |
| **C. Three tables, and build scopes enforcement now** | The column would mean something the day it ships | There is **no authentication**, therefore no principal to check a scope against. It would be built against no threat model and rewritten when the auth ADR lands. |
| **D. Three tables, defer scopes, and say so in a comment** | Cheapest | **A comment is not a mechanism.** `workspace` confinement was a docstring until a test proved a run could escape it and overwrite `.env`. A decorative column is worse than no column: the next reader assumes it is enforced. |

---

## Decision

**We keep identity, device and billing account as three orthogonal tables, we put scopes on
the device, and we defer scopes enforcement behind mechanisms rather than behind a promise.**

Concretely, answering `project-scoping.md` §5.3:

**Q16 — which tables does M15 build?** All three exist. `ops.identity` is built by this
decision (0007). `ops.device` was built by `sessions-relay-engineer` (0006).
`ops.billing_account` + `ops.credential` were built by `runner-engineer` (0005). No scopes
enforcement is built.

**Q17 — scopes enforced at what point?** **Nowhere. Deferred.** Defined, populated with an
empty default, and read by nothing. Three mechanisms hold the deferral:
`ops.device_scopes_enforced()` returns constant `false` and is reported on `GET /api/status`;
`identity-model.test.mjs` fails if any source file starts reading a scopes value; a CHECK makes
"revoked but still powerful" unrepresentable. **When enforcement is proposed it must name the
single point at which a request is denied, in one sentence** — if it cannot, it is not ready.

**Q18 — the credential key is outside Postgres; outside where?** Answered *structurally* and
better than asked: no table stores secret material at all. They store a `secret_ref` — the
name of an env var or a file — resolved at dispatch. **There is no ciphertext column to decrypt
and no key to lose**, so "a dump of the Operations volume is not a dump of the credentials" is
a property of the schema rather than a claim about an encryption routine nobody has written.
`identity-model.test.mjs` is the gate. **The residual is `runner-engineer`'s and stays open**
(`identity.md` §5 O2): where a ref resolves, and what the recovery path is when a container is
recreated without it.

**Q19 — does `account_id` join the E2E envelope allowlist?** **No.** Not settled by this ADR —
it is `sessions-relay-engineer`'s file and their ruling, and they made it while this was being
written. `SESSION_ENVELOPE_KEYS` stays at exactly five keys, pinned by an exact-equality
assertion plus a test that feeds `sanitizeSessionRow` a row volunteering
`account_id` / `accountId` / `accountLabel` and asserts none of it survives. Reasoning in the
`## Answer` of
`comms/inbox/sessions-relay-engineer/20260816-2236-commandcenter-orchestrator-m15-ops-device.md`
— **cited by path deliberately, because that ruling has no ADR number yet and nobody may
allocate one by counting files.** When the register grants it a number this citation becomes a
number in one edit.

Two agents reached that answer by different routes, which is the strongest evidence either had:
this ADR argued the account label can live inside `encryptedMetadata` and be grouped after
client-side decryption; they applied a sharper general test — **name the operation the server
must perform on the field.** There is none. That test is worth reusing on the whole class.

**A standing clause, requested by them and accepted here:** *a future amendment to the envelope
ruling requires `sessions-relay-engineer` as co-author, regardless of who owns `ops.device` by
then.* The reason is exact — *"identity needs one more field in the envelope"* is the most
plausible way CLAUDE.md rule 5 gets loosened, and **it would arrive as a reasonable request.**
Custody of `apps/web/src/sessions/**` does not transfer with `ops.device`; a decision *about*
that file is not custody of it.

**Q20 — how is the paying account chosen per run?** **Project default, per-run override, no
frontmatter field** — billing is not part of an agent's identity, because the same agent in two
projects must be able to bill to two accounts. Already implemented as `account_source ∈
(unattributed · project-default · run-override)` on `ops.agent_runs`, with `unattributed` as a
value rather than a NULL, because **`unknown` is not `zero`**.

### And one thing the plan got wrong, ratified in the direction 0005 took it

`Plan §11` names a single `ops.credential` holding "work vs personal Claude accounts". 0005
split it into `ops.billing_account` (cross-project — who pays) and `ops.credential`
(project-scoped — this project's secret for this connector) and routed the naming here.
**The split is ratified.** Apply this ADR's own working test — *sort the question into which of
the three it is about, first* — and *"which HubSpot key does this project use?"* is plainly not
a question about who pays. It was answered against the wrong table in the plan. One table would
have forced a nullable `project_id`, which is `project-scoping.md` invariant 8's failure mode
with the safety off. The catch is `runner-engineer`'s.

---

## Consequences

**Becomes easy.** Losing a phone is a revocation, not an incident: one row, a timestamp and a
reason, and the audit trail is the row that stays. Cost splits by account *and* project without
identity being involved at all. Device handoff becomes nearly free later, because continuity is
a property of a thread open on N devices and identity is already separate from device. A second
identity is an `INSERT`, not a migration.

**Becomes hard.** Two joins where the plan's prose implies none. Three owners must agree on two
seams, and during M15 two of the three tables are on loan — so this ADR asks and does not write.
`ops.identity` is a table nothing reads yet, which is a real cost, accepted for a specific
reason: its purpose is to be the foreign-key target that keeps the three concepts from
collapsing, and that purpose is satisfied by existing.

**What has to change if we reverse this.** Merging any two tables means rewriting
`ops.agent_runs.account_id` semantics, moving `scopes` onto a row that also pays for things,
and re-opening Q19 — because an identity that is also a device is an identity the envelope has
a reason to know about. Reversal is an ADR, not a migration.

**What this ADR explicitly does not authorize.** No login, no session cookie, no signed
challenge, no denial point. **Nothing in the system is safe because auth exists, because it does
not.** Any work that would only be safe under authentication remains out of scope.

---

## Contract edits

- **New:** `comms/contracts/identity.md`, owned by `identity-access-engineer`. Its §2 carries
  the nine invariants; §4 the deferral; §5 the four open questions with their owners.
- **`comms/contracts/project-scoping.md` §5.3** — Q16–Q20 are answered above. The section
  should point here rather than restate it: *a question asked in two contracts is one contract
  with two readings, and the second reading is the one that gets built* (that file's own §5.2).
  `runner-engineer` owns the edit; requested by message, not performed.
- **BOARD M15 ownership table** — the row *"`ops.credential` — billing accounts, which account
  paid"* names the wrong table after 0005's split; it is `ops.billing_account`.
  `commandcenter-orchestrator` owns the edit; requested by message, not performed.

## Open, and deliberately not decided here

- Envelope `account_id` — `sessions-relay-engineer` (Q19).
- `secret_ref` resolution and lockout recovery — `runner-engineer` (Q18 residual).
- `ops.billing_account.identity_id` — `runner-engineer`. Not taken: with one identity it is a
  constant column, and a constant column is the same defect as a scopes column nothing reads.
- Transfer of the two loaned tables — a written exchange, not this ADR.

## §8. ADR-021 stays reserved, and now has a trigger

**ADR-021** (*"auth exists in v2 — accounts inside the tailnet"*, `Plan §3`'s "ADR-013",
reserved in BOARD's register to this agent) is **deliberately not written today.** Its
substance is already ruled and recorded in three places — BOARD's *"Auth exists in v2 does not
mean the tailnet boundary moves"*, `decisions/README.md`, and ADR-013's amendment — so filing
it now would produce an ADR containing no decision, and a fourth copy of a rule that already
has a canonical statement is how one identifier acquires two readings.

**Its trigger, so it does not drift:** ADR-021 is written **together with the first proposed
enforcement point**, because that is the moment "auth exists" acquires a testable consequence —
a request that can be refused. Until then this ADR cites the BOARD ruling for its mandate.
