---
agent: sessions-relay-engineer
milestone: M15
spec: Plan §11 (device) · Plan §16 · spec §3.1 · §3.6
created: 2026-08-17T00:06
status: ready-for-review
---

# M15 — `ops.device`, and the ruling that keeps `account_id` out of the E2E envelope

Two deliverables, one table and one refusal. The table is the smaller half.

---

## What exists now

| Path | What it is |
|---|---|
| `apps/runner/src/db/migrations/0006_ops_device.sql` | `ops.device` + `ops.device_id_for()` + `ops.device_scopes_enforced()`. Applied by `client.ts` in filename order; no registration step. |
| `scripts/__tests__/ops-device.test.mjs` | 12 **structural** assertions (always run) + 1 **empirical** suite (needs `DATABASE_URL`). |
| `apps/web/src/sessions/__tests__/no-plaintext-boundary.test.mjs` | Two added tests: the envelope allowlist is exactly five keys; a row volunteering `account_id` loses it. |
| `apps/web/src/sessions/relay/envelope.ts` | Header now records the refusal where the next reader of that file will hit it. No code change. |
| `comms/inbox/sessions-relay-engineer/20260816-2236-…-m15-ops-device.md` `## Answer` | **The binding record of the Q19 ruling**, with the full reasoning. See *ADR number* below. |

### The table

`id` · `public_key` · `key_use` · `name` · `platform` · `scopes` · `registered_at` ·
`last_seen_at` · `revoked_at` · `revoked_reason`

**Every column answers "from what, with what powers". Not one answers "who".** That sentence is
the deliverable; the columns are how it is spelled. It is asserted by an exact column-set test,
so adding a column fails a gate rather than passing a review — the same discipline as
`SESSION_ENVELOPE_KEYS`, which is rebuilt from an allowlist rather than filtered.

**Five mechanisms stop it collapsing into identity.** Each refuses a write, verified against a
real Postgres:

1. **The row is the key.** `id = ops.device_id_for(public_key)`, pinned by a CHECK;
   `public_key` UNIQUE. Two rows for one key is unrepresentable. A device *is* the key material
   it holds; a person holds none.
2. **No column answers "who"** — the column-set test, plus a forbidden-name list
   (`identity_id`, `account_id`, `project_id`, `email`, `user_id`, `private_key`, …).
3. **Revocation is expressible here and meaningless on an identity.** `revoked_at` +
   `revoked_reason` paired by CHECK; the row survives; and `revoked_at IS NULL OR
   cardinality(scopes) = 0` — **"revoked but still powerful" is not a representable state**, so
   the future enforcement point cannot be defeated by a caller who read `scopes` and forgot
   `revoked_at`.
4. **Scopes live here**, and this is the only table that has them.
5. **`key_use` has exactly one legal value, `'identify'`.** The device's public key identifies;
   no content is ever encrypted to it. A server-known per-device public key is what a
   well-meaning *"re-wrap this session key for the new phone"* feature reaches for, and that
   feature puts the coordinator inside the key exchange. Widening the CHECK is a migration, and
   a migration is a reviewable act.

**Scopes are defined, defaulted and enforced by nobody.** Vocabulary `read · run · approve ·
admin`, closed by a CHECK. **Default `'{}'`** — a device that registers without an explicit
grant holds no powers rather than all of them, which is the only thing "populate it" can
honestly mean while nothing reads the column. `ops.device_scopes_enforced()` returns a constant
`false` so a status route can be *told* no rather than assume yes — the mirror of 0005's
`ops.project_scope_enforced()`. When enforcement is proposed it must name, in one sentence, the
single point at which a request is denied.

### The ruling: `account_id` does **not** join the envelope allowlist

`SESSION_ENVELOPE_KEYS` stays `id · seq · updatedAt · active · encryptedMetadata`. Five
reasons, in the order that decided it; the first is the reusable one:

1. **Name the operation the server must perform on the field.** There is none. The list is
   already decrypted and **sorted in the browser** (ADR-005), so grouping by account is the
   same operation on the same already-decrypted object. The account belongs *inside*
   `encryptedMetadata`. The feature ships either way — so the plaintext requirement does not
   exist.
2. **In plaintext it is a partition, and the partition is the leak.** Opaque UUID or not, it is
   a stable correlation key saying "these forty sessions belong to one paying account", which
   with the timestamps the relay already holds is a per-client work-pattern profile.
3. **It would blur two different moneys.** Sessions bill the human's Claude subscription
   through Happy wrapping the CLI; runs bill the capped API-key workspace. And the `account_id`
   `Plan §11` actually wants already exists — on `ops.agent_runs` (0005), with `account_source`
   beside it so *unattributed* is a value rather than a guess. **A session is not a run.**
4. **Upstream would want it as a tag, and tags are plaintext.** ADR-005's named forward hazard,
   the same one that bars `Plan §12`'s `@agent` / `#department` grammar from a Happy tag.
5. **`envelope.ts` rebuilds rather than filters** — that protects keys nobody added on purpose.
   It is not a licence to add one.

`identity-access-engineer` reached the same conclusion independently in ADR-016's Q19 note.
Two agents, two routes, one answer.

---

## How to use it

```bash
# The migration applies itself on the runner's next boot. To apply it by hand:
node apps/runner/src/db/client.ts

# Structural half only — no database needed, runs everywhere:
node --test scripts/__tests__/ops-device.test.mjs

# Both halves. Nine writes must be refused by the named constraint; ROLLBACK at the end:
docker compose -f infra/compose.yaml --env-file .env up -d postgres
DATABASE_URL="postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@127.0.0.1:5433/$APP_DB" \
  node --test scripts/__tests__/ops-device.test.mjs
```

Registering a device, once something writes one:

```sql
INSERT INTO ops.device (id, public_key, name, platform, scopes)
VALUES (ops.device_id_for($1), $1, 'the phone', 'ios', ARRAY['read','run','approve']);
```

Revoking one — both halves or the database refuses it:

```sql
UPDATE ops.device
   SET revoked_at = now(), revoked_reason = 'lost on a train', scopes = '{}'
 WHERE id = $1;
```

---

## Contracts touched

**None changed.** Three edits are **requested by message**, not performed:

- `comms/contracts/project-scoping.md` §5.3 **Q19** now has an answer → `runner-engineer`
  (`…/20260817-0006-sessions-relay-engineer-0006-ops-device-lands-in-your-migrations.md`).
- BOARD's M15 ownership row for `ops.device`, and the ADR-016 bullet that still says
  *"Interim: `sessions-relay-engineer` answers Q19"* → `commandcenter-orchestrator`.
- `comms/contracts/identity.md` is `identity-access-engineer`'s and does not need me.

**ADR number — stated plainly because it is the one loose end.** BOARD's register claims row
016 for *"Identity vs device vs billing account"* with author `identity-access-engineer`. We
were dispatched in parallel; they wrote ADR-016 and its Q19 section correctly defers the
envelope question back to me as *"their ADR"*. That ADR **has no register row**, and I am not
allocating one by listing `comms/decisions/` — that is the method that produced two ADR-012s.
A `decision-request` for a number is with `commandcenter-orchestrator`
(`…/20260817-0006-sessions-relay-engineer-adr-number-for-the-envelope-ruling.md`). Until it
lands, **cite the message path, not a number.** The ruling itself is not waiting on the
paperwork: it is enforced by two tests and written into `envelope.ts`'s header.

---

## Deliberately not done

- **`ops.identity`, and therefore `identity_id` on `ops.device`.** It is
  `identity-access-engineer`'s table; during M15 `runner-engineer` defines it as an FK target
  and stops. Creating another owner's table to satisfy my foreign key is the drift `comms/`
  exists to prevent, and an `identity_id` with no FK is a pointer at nothing. They created it
  in `0007_identity.sql` an hour later, so the column is now unblocked and is **their
  migration**. The shape is fixed in 0006's header, and the load-bearing part is the **absent
  UNIQUE**: *"one you, N devices"* is exactly the statement "identity_id is not unique".
- **Scopes enforcement.** Deferred, per M15's ruling and BOARD #5's unamended transport half.
  *v2 gains accounts; v2 does not gain a public surface.* There is no principal to check a
  scope against, so it would be built against no threat model and rewritten when ADR-021 lands.
- **Any route that writes a device.** No registration endpoint, no device list, no UI. The
  table will be empty until one exists, and **no row is seeded** — 0005 seeds `ops.project`
  because that mount genuinely exists on disk; no device has ever registered, so a seeded row
  would be a plausible fake (rule 9).
- **Joining `ops.device` to the Web Push subscription store.** They are two records of one
  thing: subscriptions live in a JSON file on the web app's volume keyed by endpoint
  (`PUSH_SUBSCRIPTIONS_PATH`), `ops.device` lives in the runner's Postgres, and `apps/web` has
  no `pg` dependency. Unifying them means either web gains a database or the runner gains the
  push store — a Part V decision, not a drive-by. **No join-key column was added in
  anticipation**, because a column nothing reads is the comment this whole slice spends its
  time refusing to write.
- **Retaining the pre-revocation scope grant.** The CHECK empties `scopes` on revocation, so
  the trail records *that* a device was revoked, when and why — not what it could once do.
  Flagged to the successor as a one-column change if they want it.
- **A `@`-ban on `ops.device.name`**, the constraint `identity-access-engineer` put on
  `ops.identity.display_name`. Argued as not applicable to a hardware label and routed to
  `rtl-arabic-pdpl-specialist` to sign or refuse while the table has zero rows.
- **`devices.scopeEnforcement` on `GET /api/status`.** One line, in `runner-engineer`'s route.
  Requested, not written.
- **Any change to `apps/runner/package.json`.** The runner's test script names its files
  explicitly; adding mine would have been an edit to another owner's file. The tests live under
  `scripts/__tests__/` instead.

---

## Verification — structural or empirical, never implied

`project-scoping.md` §6 is the house pattern and this table follows it: no row below implies a
check that was not run.

| Claim | Kind | Evidence |
|---|---|---|
| Column set is exactly ten; no forbidden name | **structural** | `ops-device.test.mjs`, always runs |
| The `identity_id` sketch says "no UNIQUE" | **structural** | same file |
| Scopes default `'{}'`, vocabulary closed | **structural** | same file |
| No seed row; no `DELETE FROM ops.device` | **structural** | same file |
| RLS absent **and argued**, not forgotten | **structural** | same file — asserts the migration contains the argument |
| **Every CHECK actually fires** | **empirical** | same file, `EMPIRICAL:` suite — 0006 applied in a transaction against the live Postgres; **9 writes refused, each by the named constraint**; revocation keeps the row and its reason; `ROLLBACK`; asserts `ops.device` was **not** left behind |
| The migration applies, and applies twice | **empirical** | same suite |
| `ops.device_scopes_enforced()` is `false` | **empirical** | same suite |
| An unscoped read of `ops.device` does **not** raise (unlike every 0005 table) | **empirical** | same suite |
| Envelope allowlist is five keys; a volunteered `account_id` is dropped | **structural** | `no-plaintext-boundary.test.mjs` |
| A device row is not PDPL-relevant client data | **neither — asserted, unreviewed** | routed to `rtl-arabic-pdpl-specialist` |
| The scopes on a device are the *right* scopes | **unvalidatable in M15** | one identity, one device row possible, **zero runs**, and `--profile full` still cannot boot: there is no Happy container image |
| `account_id` inside `encryptedMetadata` renders correctly | **unvalidatable in M15** | needs a bootable Happy; the session list has never run against a live relay |
| The device row matches a real registered device | **unvalidatable in M15** | nothing writes the table |

### What I ran, and what it printed

```
npm test                    131 tests · 130 pass · 0 fail · 1 skipped   (the skip is the
                            EMPIRICAL suite, which reports why it skipped)
                            with DATABASE_URL set:  131 pass · 0 skipped
node --test scripts/__tests__/ops-device.test.mjs  (with DATABASE_URL)
                            13 pass · diagnostic: "9 CHECKs refused a write; revocation kept
                            the row; no RLS on this table"
apps/web sessions suite      65 pass · 0 fail
npm run validate:tokens      Token discipline
                             scanned at 2026-08-17 00:12 +03:00 · 4e0bbe6 · 51 uncommitted under apps/web
                             files scanned 298 · violations 0 · exemptions 2
npm run validate:comms       checked at 2026-08-17 00:11 +03:00 · 4e0bbe6 · 25 uncommitted under comms
                             clean, bar one pre-existing filename warning that is not mine
```

**Read the two provenance lines as a pair, because they disagree by design.** An earlier run of
the same instrument nine minutes before printed `293 files · 11 uncommitted`; this one prints
`298 · 51`. Nothing regressed and nothing was fixed — **three other agents are editing this
tree right now** (the shell project switcher, `0007_identity.sql`, `identity.md`). That is
exactly the ambiguity §8b was written to remove, so the line above is the one I actually ran
last, and the count differences belong to other people's files. Quote it with its `4e0bbe6`
and its clock or not at all.

**`npm run test:web` is RED and it is not mine.** The `node:test` half passes; the **vitest
half fails 5 of 421** — `AppShell.test.tsx` (1) and `CostTicker.test.tsx` (4), all from the
in-flight project-switcher work in `apps/web/src/components/shell/` (`ProjectSwitcher.tsx` and
`useProjects.ts` are untracked, `CostTicker.tsx` modified). The visible symptom is a cost
string that now reads *"This address does not name a project, so there is nothing to scope this
figure to…"* prepended to the expected copy. **Reported, not fixed** — it is
`shell-navigation-engineer`'s M15 slice and their file. My slice touches `apps/web` in exactly
two places, both under `sessions/`, and both are green.

I did not add a hex value, a duration, or any UI. The token result above is quoted because
BOARD requires evidence to be datable, not because this slice could have moved it.

---

## Next agent

`identity-access-engineer` — read
`comms/inbox/identity-access-engineer/20260817-0006-sessions-relay-engineer-ops-device-is-built-and-here-is-how-it-transfers.md`
first. It names the table, what moves on the handover date, and the one clause worth agreeing
in writing: **`apps/web/src/sessions/**` does not move, and a future amendment to the envelope
ruling needs `sessions-relay-engineer` as co-author regardless of who owns `ops.device` by
then.** That is the most plausible way rule 5 gets loosened, and it would arrive as a
reasonable request.

Then `0006_ops_device.sql`'s header §0 — the `identity_id` migration, already unblocked by
their own `0007_identity.sql`.
