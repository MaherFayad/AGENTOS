---
agent: identity-access-engineer
milestone: M15
spec: Plan §11 (carried over from Part One §6, Phase 4) · spec §3.1 (E2E, untouched) · Part VII.4 (PDPL)
created: 2026-08-17T00:12
status: ready-for-review
---

# M15 — `ops.identity`, and the two seams that keep §11 three tables

**Read first if you read nothing else:** identity ≠ device ≠ billing account. Three tables,
orthogonal — **one you, N devices, M paying accounts.** Scopes live on the **device**. Part
One's Phase 4 calls all three "accounts", and `Plan §11` exists to undo that. The working test,
which settles most arguments here in one step: **sort the question into which of the three it is
about, before answering it.**

## What exists now

| Path | What it is |
|---|---|
| `apps/runner/src/db/migrations/0007_identity.sql` | `ops.identity` — the table, the id function, one seeded row, and the two seams stated in writing |
| `comms/contracts/identity.md` | The contract. **New; it did not exist.** Owner: `identity-access-engineer` |
| `comms/decisions/ADR-016-identity-device-billing-account.md` | The decision. Status **proposed**. Answers `project-scoping.md` §5.3 Q16–Q20 |
| `scripts/__tests__/identity-model.test.mjs` | 8 structural tests — the split, the deferral gate, the no-secrets gate |
| `scripts/__tests__/repo-conformance.test.mjs` | +1 test: *no two migrations share a number* (see Findings) |
| `comms/status/identity-access-engineer.md` | First real status. The previous file was an orchestrator placeholder and said so |

**Not written by me, and central to the same slice** — `0006_ops_device.sql`
(`sessions-relay-engineer`) and `0005_project_axis.sql`'s `ops.billing_account` +
`ops.credential` (`runner-engineer`). Both landed before or during this task and both are on
loan. I am a **consumer** of them.

### `ops.identity`

```sql
id uuid PK · slug text UNIQUE · display_name text · created_at timestamptz
```

One row seeded: `owner` / `Owner`. Three columns it deliberately lacks — `scopes` (they live on
the device), `project_id` (identity and project are two axes), `disabled_at` (nothing reads it,
and it would claim something nothing honours).

## How to use it

There is nothing to call. **That is accurate, not a gap**, and it is the most important thing
for the next reader to understand:

```
ops.identity is a foreign-key target. Its job is to exist, so that "who is asking",
"from what device with what powers" and "who pays" cannot collapse into one row.
No route reads it. No code path writes it. There is one row and it is seeded by the
migration.
```

Apply the migration the usual way — `node apps/runner/src/db/client.ts` applies pending
migrations in filename order and is idempotent.

## Contracts touched

- **Created:** `comms/contracts/identity.md` (mine).
- **Changed:** none. `project-scoping.md` §5.3 says *"owner unassigned"*, which is now false, and
  BOARD's M15 row names `ops.credential` as the billing table, which is now the wrong table.
  **Both edits were requested by message, not performed** — they are `runner-engineer`'s and
  `commandcenter-orchestrator`'s files.
- **Consumed:** `project-scoping.md` (Q16–Q20, invariants 8–10), `api-contracts.md`,
  ADR-013 (Part Two's standing), ADR-014 (`ops.credential` keyed by project).

## Three findings

**1. A migration number was raced, exactly like ADR-012.** `sessions-relay-engineer` and I both
read the migrations directory, both computed *next free = 0006*, both wrote a `0006_` file
within a minute. BOARD says `decisions/` is *"the only shared allocation namespace in the
repo"* and adds *"if a second shared-integer namespace is ever introduced, it inherits this rule
on day one."* Migration filenames **are** that second namespace — a flat integer sequence with
no author in the key. Worse than the ADR case: `client.ts` applies in filename order, so both
files run, ordered by whatever follows the digits.

Resolved by the same principle that resolved ADR-012 — *allocate against the side with no
dependents.* Theirs was cited by a handoff and a test; mine by nothing, so mine became `0007`.
Gated in `repo-conformance.test.mjs`, verified to fail on a planted duplicate.

**2. `Plan §11` answered a question against the wrong table, and `runner-engineer` caught it.**
The plan's single `ops.credential` conflates *who pays* (cross-project) with *this project's
connector secret* (project-only). 0005 split them; ADR-016 ratifies the split. **`ops.credential`
is not a `Plan §11` table** — it is the project axis. This is the §11 conflation reappearing one
level down, and it is the best available demonstration of why the sorting test earns its keep.

**3. The seam was specified identically by two agents who could not see each other's work.**
I wrote the required `ops.device` shape into 0007 §2; `sessions-relay-engineer` had already
written the closing `ALTER` into 0006 §0, including the clause I would have missed the reason
for — **no UNIQUE on `identity_id`**, because *"one you, N devices is exactly the statement
identity_id is not unique."* Their sentence, quoted in ADR-016 and in the test.

## Deliberately not done

The point of this file. Each item says *why*, and none of them is "ran out of time".

- **No scopes enforcement.** `ops.device.scopes` is defined and defaults to empty; **nothing
  reads it.** M15's ruling is that *a scope with no enforcement point is a comment*, and
  building one now means building against no threat model — there is no authentication, so
  there is no principal to check a scope against. **The deferral is a gate, not a promise:**
  `ops.device_scopes_enforced()` returns constant `false`; `identity-model.test.mjs` fails the
  build if any source file starts reading a scopes value; a CHECK makes "revoked but still
  powerful" unrepresentable. When enforcement is proposed it must **name the single point at
  which a request is denied, in one sentence** — if it cannot, it is not ready.
- **No public surface, and nothing that assumes one.** BOARD constraint #5 has two halves and
  Part Two amends **one**. Identity, devices and per-account billing exist inside the tailnet —
  *"no auth in v1 by design"* is superseded. Transport is **unchanged**: tailnet-only, no
  public ports, Authelia in front of Caddy a later ADR. **v2 gains accounts; v2 does not gain a
  public surface.** Quote both halves or neither. **Nothing here is safe because auth exists,
  because it does not.**
- **ADR-021 not written**, deliberately, with a trigger so it does not drift: it lands
  **together with the first proposed enforcement point**, because that is when *"auth exists"*
  gains a testable consequence. Writing it tonight would file an ADR containing no decision —
  its substance is already ruled in BOARD, `decisions/README.md` and ADR-013's amendment.
  (ADR-016 §8.)
- **`ops.device.identity_id` not added.** Their table, their migration, after the written
  handover. `identity-model.test.mjs` asserts the column's **shape if present** and deliberately
  **not its presence** — a test that goes red for work another agent has correctly not done yet
  is a test that gets deleted.
- **`ops.billing_account.identity_id` not added.** With one identity it is a **constant column**,
  which is the same defect as a scopes column nothing reads. Part One §8 cuts both ways:
  designing for N and building 1 is legal; building N because it might be needed is not.
- **Neither loaned table transferred.** `ops.device`'s transfer is now **agreed in writing with
  a fixed trigger** — effective on `fidelity-qa-reviewer`'s PASS of `sessions-relay-engineer`'s
  `ops.device` review, not on a date and not on my say-so. They offered it tonight and **I
  declined**: their review-request is open, and a table whose owner changes mid-review is the
  moving tree the reviewer already refused to gate once (*"`GET /api/status` reported three
  different brain numbers in one session; the reviewer will not gate a moving tree"*, BOARD M3).
  `ops.billing_account`'s transfer is proposed to `runner-engineer` and unanswered. **Until each
  answers in its own file, the interim owner is the owner.**
- **No TypeScript mirror of `identity_id_for`.** `project.ts` earns its mirror because the
  runner must resolve a project with no Postgres at all; nothing resolves an identity at all.
  Two implementations of one identifier is how a foreign key silently stops matching.
- **No `disabled_at` on identity, and no run-level `requested_by`.** Both would be columns
  nothing reads, on a table with one row. The trigger for each is a second identity.
- **Device handoff / continuity not built** (`Plan §11`'s "most of the difference between four
  clients and one system"). It is a property of **a thread open on N devices**, and `ops.thread`
  is M16. What this slice contributes is the precondition — identity separate from device — that
  makes it nearly free later. Building a continuity mechanism with no thread table would be
  building the feature twice.
- **Q19 (envelope `account_id`) — no longer mine to leave open: `sessions-relay-engineer`
  answered it *no* during this task**, and enforced it with an exact-equality assertion on
  `SESSION_ENVELOPE_KEYS` plus a test feeding `sanitizeSessionRow` a row volunteering
  `account_id`/`accountId`/`accountLabel`. Two agents reached that answer by different routes.
  Their general test is the better one and is now quoted in ADR-016: **name the operation the
  server must perform on the field.** There is none. **A standing clause is now in
  `identity.md` §5 O1: amending that ruling requires them as co-author regardless of who owns
  `ops.device`** — because *"identity needs one more field in the envelope"* is the most
  plausible way rule 5 gets loosened, and it would arrive as a reasonable request.
- **The `identity_id` ALTER is agreed to be mine and still did not land.** Both of us now say
  it is my migration to write. It cannot land today for a reason neither of us had written down:
  `ops-device.test.mjs` pins an **exact ten-column list**, so adding the column turns their
  green test red, and fixing their test is editing their file. **The ALTER and that list are one
  commit, after the transfer.** "Leave gates green" and "do not annex" both point the same way.
- **Q18's residual not answered.** *Where* a `secret_ref` resolves and what the recovery path is
  when a container is recreated without it. `runner-engineer`'s. There is also no `secret_ref`
  **grammar** — nothing parses one. Recorded as a gap, not a decision.
- **No UI.** No surface renders an identity, a device or an account. Nothing user-visible ships
  in this slice, which is why the reviewer's Part VI fidelity comparison does not apply to it.

## Verification

**Provenance:** `checked at 2026-08-17 00:11 +03:00 · 4e0bbe6 · 24 uncommitted under comms`
(`check-comms`), tokens `scanned at 2026-08-17 00:11 +03:00 · 4e0bbe6`, per `design-tokens.md`
§8b. A count with no identity is a sentence, not evidence — and note the uncommitted count is
climbing while this is written, because **four agents are editing this tree concurrently.**

| Gate | At my start | Now | Mine? |
|---|---|---|---|
| `npm test` | 108 pass / 0 fail | **131 tests · 130 pass · 1 skipped · 0 fail** | **+10 mine** (9 `identity-model`, 1 `repo-conformance`). The other +13 and the 1 skip are `sessions-relay-engineer`'s `ops-device.test.mjs`, landed concurrently |
| `npm run validate:tokens` | 291 files / 0 violations | **300 files / 0 violations** | 0 mine — no UI in this slice. The file count rose because other agents added nine web files while I worked; **the violation count is what my slice can move, and it did not** |
| `npm run validate:comms` | clean · 1 filename warning | clean · **same** 1 pre-existing warning | — |
| `npm run test:web` | **not measured** | **RED — 15 failures in the vitest half** | **not mine** — see below |

**I did not run `test:web` at my start, so I cannot claim it was green and I am not going to
imply it.** What I can show is scope: **my change set touches zero files under `apps/web/`** —
it is one `.sql` migration, two files in `scripts/__tests__/`, and markdown in `comms/`.

The 15 failures are concurrent in-flight M15 UI work by other agents, and they name themselves:
missing Arabic for `provenance.badge.*` (the provenance badge, `design-system-guardian`), a
missing `usePathname` export on the `next/navigation` mock (the new project routes —
`ProjectSwitcher.tsx`, `LegacyRouteResolver.tsx`, `useProjectHref.ts`, all untracked and
appearing in the tree during this task), and the shell/CostTicker/MapView renders downstream of
both.

**Reported, not fixed, and not adopted.** They are other agents' files mid-edit; a drive-by fix
would be the annexation this protocol exists to prevent, and would also collide with whatever
they are typing. Flagged to `fidelity-qa-reviewer` in the review-request so the red is attributed
rather than discovered — **a stale FAIL gets investigated; a stale PASS gets cited**, and an
unattributed FAIL gets blamed on whoever files next.

**Both new gates were verified to bite, not just to pass.** A gate nobody has seen fail is a
gate nobody has tested:

- planted `0007_collision_probe.sql` → *"0007: 0007_collision_probe.sql + 0007_identity.sql"*, removed.
- planted `const x = { scopes: [] }` → the deferral test named the file and line, removed.

### What is *not* verified, stated in the house format

Every criterion above is **structural** — migration text, source text, constraints. **None is
empirical.** There is one identity, one device (zero rows), one billing account (zero rows) and
**zero runs**. Specifically:

| Claim | Kind |
|---|---|
| Three tables stay three; scopes only on the device; no secret columns; nothing reads scopes | **structural** |
| The device FK is correct **when built** | **structural, conditional** — asserts shape if present, not presence |
| A dump of the volume yields no credential | **neither yet** — the schema claim is proven; Postgres has never been dumped and `ops.billing_account` has zero rows |
| "Which account paid" | **not validatable in P1** — zero runs (`project-scoping.md` §6). Blocked on `RUNNER_ANTHROPIC_API_KEY` |
| A device registers / is seen / is revoked | **not validatable** — no code path writes `ops.device` |
| Scopes deny anything | **N/A by design** — deferred |

**No SQL in this slice has been executed against a real Postgres.** `sql-executes.test.ts`
skips without `DATABASE_URL` and is not in the runner's `npm test` script. 0007 is short,
uses only constructs 0005 already exercises, and is `CREATE ... IF NOT EXISTS` + one
`ON CONFLICT DO NOTHING` insert — but *"it looks fine"* is exactly what was said about
`make_interval(hours => $4::float8)`. **Treat "0007 applies cleanly" as unverified** until
someone runs it with the data plane up.

## Messages filed

| To | Type | About |
|---|---|---|
| `sessions-relay-engineer` | decision-request | the seam, the number collision, Q19, transfer at M15 close |
| `runner-engineer` | decision-request | ratifying the credential split, `identity_id` proposed-not-taken, Q18 residual, two contract edits requested, transfer at M15 close |
| `rtl-arabic-pdpl-specialist` | review-request | **mandatory** PDPL sign-off; states the claim and both weak points |
| `commandcenter-orchestrator` | decision-request | BOARD: the second shared namespace, the wrong table name, register 016 → proposed, ADR-021's trigger |
| `fidelity-qa-reviewer` | review-request | this handoff |

**Received and answered** (it crossed mine in flight, same minute, opposite direction):
`inbox/identity-access-engineer/20260817-0006-sessions-relay-engineer-ops-device-is-built-and-here-is-how-it-transfers.md`.
It answered Q19, fixed the transfer trigger, and caught a stale cross-reference in
`0007_identity.sql` (a comment citing "migration 0006" — corrected). **My outbound message to
them is `closed` with a pointer**, because two records of one exchange is one exchange with two
readings.

## Next agent

**`fidelity-qa-reviewer`** — start with the *Deliberately not done* section, then ADR-016 §Q17
and `identity.md` §4. The acceptance question for this slice is not "does it look right at
1440px" (nothing is user-visible) but **"is every deferral held by a mechanism rather than by a
sentence, and is every criterion labelled the kind it actually is."**

Then `sessions-relay-engineer` and `runner-engineer` — one open `decision-request` each, both
answerable in a few minutes, neither blocking me.
