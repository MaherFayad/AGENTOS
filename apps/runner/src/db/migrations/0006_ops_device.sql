-- 0006_ops_device.sql
--
-- `ops.device` — the second of `Plan §11`'s three tables (ADR-016).
--
-- **Identity ≠ device ≠ billing account.** Part One's Phase 4 called all three "accounts",
-- and §11 exists to undo that. This file builds exactly one of them:
--
--   ops.identity   who is asking?                  NOT BUILT HERE — see §0 below
--   ops.device     from what, with what powers?    THIS FILE
--   ops.credential who paid?                       built in 0005 (+ ops.billing_account)
--
-- Owner today: `sessions-relay-engineer`, on loan during M15 because per-device keypairs,
-- push subscriptions and the E2E envelope allowlist are already his. Successor:
-- `identity-access-engineer`. The handover is a written exchange, not a drift — until it
-- exists, the interim owner is the owner (`.claude/agents/identity-access-engineer.md`).
--
-- Three rules inherited from 0005 and re-stated because this file obeys them too:
--
--   1. **`unknown` is not `zero`.** `last_seen_at IS NULL` means *never connected*, and no
--      surface may render it as an epoch, an age, or "offline". `registered_at` is NOT NULL
--      precisely so a UI always has one true timestamp to show instead.
--   2. **A comment is not a mechanism.** Every "must not" below is a CHECK, a UNIQUE, an
--      absent column or an absent code path. Where the mechanism is weaker than the claim,
--      the claim is weakened — see `ops.device_scopes_enforced()`, which returns a constant
--      `false` and says so.
--   3. **Nothing here bakes in a count** of anything project-shaped. There is no project
--      column at all; see §3.
--
-- **Scopes are defined and populated. Enforcement is built by nobody** (BOARD #5, M15
-- ruling): *a scope with no enforcement point is a comment.* v2 gains accounts inside the
-- tailnet; v2 does not gain a public surface — transport stays tailnet-only and Authelia is
-- a later ADR. Quote both halves or neither. When enforcement is proposed it must name, in
-- one sentence, the single point at which a request is denied.
--
-- PDPL (Part VII.4): `name` is the only human-written string in this table. It stays on this
-- box. It may not enter a push payload (`sessions/push/payload.ts` rebuilds), a Happy tag
-- (`sessions/relay/envelope.ts` rebuilds), or a log line (`logSafe`).

-- ---------------------------------------------------------------------------
-- 0. What this migration deliberately does NOT create
-- ---------------------------------------------------------------------------
--
-- **`ops.identity` is not created here, and `ops.device` therefore has no `identity_id`.**
--
-- That absence is a decision, recorded so the next reader does not file it as an oversight:
--
--   * `ops.identity` belongs to `identity-access-engineer`; during M15 it is defined as a
--     foreign-key target by `runner-engineer` "as schema custodian only" and **built by
--     nobody** (BOARD, M15 ownership table; `project-scoping.md` §5.3).
--   * A foreign key needs its target table to exist. Creating another owner's table to
--     satisfy my own constraint is precisely the ownership drift `comms/` exists to prevent.
--   * The alternative — an `identity_id` column with no FK — is a pointer at nothing, i.e.
--     a comment shaped like a mechanism. This file does not ship one.
--   * `Plan §11`'s own column list for this table is *name, platform, public key, scopes,
--     last seen, revocable*. It does not include an identity column either.
--
-- The successor's first migration adds it, and the shape is fixed here so the handover is
-- an edit rather than a design session:
--
--     ALTER TABLE ops.device ADD COLUMN identity_id uuid NOT NULL
--       REFERENCES ops.identity(id) ON DELETE RESTRICT;      -- and NO UNIQUE on it
--
-- **The absent UNIQUE is the load-bearing part.** `one you, N devices` is exactly the
-- statement "identity_id is not unique". A UNIQUE there would collapse the two tables back
-- into one and re-create the conflation §11 exists to undo. Backfill is one statement: every
-- existing row points at the single identity.

-- ---------------------------------------------------------------------------
-- 1. Deterministic device ids
-- ---------------------------------------------------------------------------
--
-- The house pattern from 0005 (`ops.project_id_for`), for the same reason: a client can
-- compute its own id offline, before it has ever reached the coordinator, so registration is
-- idempotent without a round trip.
--
-- Here it does one more job. A device *is* the key it holds — that is what distinguishes it
-- from a person, who holds none. Deriving the id from the public key and pinning it with a
-- CHECK makes "two rows for one key" unrepresentable rather than merely unlikely.
--
-- md5(text)::uuid needs no extension. This is an identifier, not a security primitive: it is
-- never a substitute for verifying a signature.

CREATE OR REPLACE FUNCTION ops.device_id_for(public_key text)
RETURNS uuid LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
  SELECT md5('agnetos.device:' || public_key)::uuid
$$;

COMMENT ON FUNCTION ops.device_id_for(text) IS
  'Deterministic device id from its public key. Pinned by a CHECK on ops.device so the id and the key cannot drift apart. An identifier, never an authentication.';

-- ---------------------------------------------------------------------------
-- 2. ops.device
-- ---------------------------------------------------------------------------
--
-- Every column answers **"from what, with what powers"**. Not one answers "who". That is
-- the whole separation, and `scripts/__tests__/ops-device.test.mjs` asserts the column set
-- exactly — adding a column to this table fails a test, which is the same discipline as
-- `SESSION_ENVELOPE_KEYS` in the relay: rebuilt from an allowlist, never filtered.

CREATE TABLE IF NOT EXISTS ops.device (
  id            uuid PRIMARY KEY,

  -- The device's long-term **identification** key: the public half of the keypair it signs
  -- a server challenge with. Registration is by key, so a device names itself and cannot
  -- name another.
  public_key    text NOT NULL UNIQUE,

  -- One legal value, on purpose — the same trick as 0005's `library_remote IS NULL` and
  -- `kind IN ('anthropic')`. This key identifies; **no content is ever encrypted to it.**
  --
  -- The hazard being closed is specific and it is the one that would end E2E quietly: a
  -- server-known public key per device is exactly what a well-meaning "re-wrap this session
  -- key for the new phone" feature would reach for, and that feature puts the coordinator
  -- inside the key exchange. Session keys are derived in the browser, imported with
  -- `extractable: false` and never leave it (ADR-005 consequence 2, `lib/e2e.ts`).
  --
  -- Widening this CHECK is a migration and therefore a reviewable act. Ignoring a comment
  -- is not.
  key_use       text NOT NULL DEFAULT 'identify' CHECK (key_use = 'identify'),

  -- Human label — "the phone", "work laptop". PDPL: local only. See the header.
  name          text NOT NULL CHECK (length(btrim(name)) > 0),

  -- `Plan §16`'s four surfaces plus the browser this is served to. Text with a CHECK rather
  -- than an enum so a fifth surface is a migration, not a type change.
  platform      text NOT NULL CHECK (platform IN ('web','ios','android','desktop','cli')),

  -- **Scopes live here, not on the identity** (`Plan §11`). The phone that answers approvals
  -- at 23:00 gets `read · run · approve`; it does not get `admin`. That placement is what
  -- makes losing a phone a revocation instead of an incident — the alternative, scopes on
  -- the identity, means a lost phone is edited out of the *person*.
  --
  -- **DEFAULT is the empty set, and that is the populate discipline.** A device that
  -- registers without an explicit grant holds no powers rather than all of them. A
  -- permissive default is how an unenforced column becomes a dangerous one the day
  -- enforcement lands.
  --
  -- **Nothing reads this column in M15.** No route, no middleware, no policy. See
  -- `ops.device_scopes_enforced()`.
  scopes        text[] NOT NULL DEFAULT '{}',
  CONSTRAINT scopes_are_known CHECK (scopes <@ ARRAY['read','run','approve','admin']::text[]),

  registered_at timestamptz NOT NULL DEFAULT now(),

  -- NULL means **never connected**, which is not a zero and not an epoch. `registered_at`
  -- exists so a UI showing "last seen" has an honest alternative to render.
  last_seen_at  timestamptz,
  CONSTRAINT last_seen_after_registration CHECK (
    last_seen_at IS NULL OR last_seen_at >= registered_at
  ),

  -- **Revocation is a first-class path, not a delete.** The row stays, with a reason and a
  -- timestamp; that record is the audit trail. There is no `DELETE` path in any code that
  -- touches this table.
  revoked_at    timestamptz,
  revoked_reason text,
  CONSTRAINT revocation_is_dated_and_explained CHECK (
    (revoked_at IS NULL) = (revoked_reason IS NULL)
  ),

  -- "Revoked but still powerful" is not a representable state. A revoking UPDATE must empty
  -- the array in the same statement or the database refuses it — so the future enforcement
  -- point cannot be defeated by a reader who checked `scopes` and forgot `revoked_at`.
  --
  -- Cost, stated rather than hidden: the pre-revocation grant is not retained. The audit
  -- trail records *that* a device was revoked, when, and why — not what it could once do.
  CONSTRAINT revoked_devices_hold_no_scopes CHECK (
    revoked_at IS NULL OR cardinality(scopes) = 0
  ),

  -- The id is the key's fingerprint, checked rather than assumed.
  CONSTRAINT device_id_is_derived_from_its_key CHECK (id = ops.device_id_for(public_key))
);

COMMENT ON TABLE ops.device IS
  'From what, with what powers (Plan §11). Every column answers that; none answers "who" — identity is a separate table and this one deliberately has no foreign key to it yet (see migration header §0). Scopes live here and are enforced by nothing in M15. Interim owner: sessions-relay-engineer; successor: identity-access-engineer (ADR-016).';
COMMENT ON COLUMN ops.device.public_key IS
  'Identification key only. key_use pins it: no session content is ever encrypted to this key, because that would put the coordinator inside the key exchange (ADR-005, CLAUDE.md rule 5).';
COMMENT ON COLUMN ops.device.scopes IS
  'Declared and defaulted to the empty set. Read by nothing in M15 — a scope with no enforcement point is a comment, so this one is honest about being one. ops.device_scopes_enforced() reports false.';
COMMENT ON COLUMN ops.device.last_seen_at IS
  'NULL means never connected. Not zero, not an epoch. Render registered_at instead.';
COMMENT ON COLUMN ops.device.revoked_at IS
  'Revocation keeps the row. A revoked device holds no scopes — enforced by a CHECK, not by the caller remembering.';

-- The obvious list query: active devices, most recently seen first.
CREATE INDEX IF NOT EXISTS device_active_last_seen_idx
  ON ops.device (last_seen_at DESC NULLS LAST) WHERE revoked_at IS NULL;

-- ---------------------------------------------------------------------------
-- 3. Three columns this table does not have, and why each absence is the design
-- ---------------------------------------------------------------------------
--
-- **No `identity_id`** — §0. The successor adds it, without a UNIQUE.
--
-- **No `account_id`.** A device does not pay for anything; a *run* does, and 0005 already
-- put `account_id` + `account_source` on `ops.agent_runs` where the money actually is.
-- Putting a billing account on the device would say "this phone is the work phone", which
-- is a second, contradictory place for a fact that belongs to the run — and 0005's
-- `account_source` exists precisely so "we do not know who paid" is a value rather than a
-- guess. It would also blur two different moneys that must never be summed: interactive
-- sessions bill the human's Claude subscription through Happy wrapping the CLI, while runs
-- bill the capped API-key workspace (Part V, ADR-005).
--
-- **No `project_id`, and therefore no row-level security.** A device is cross-project by
-- design, exactly like `ops.billing_account`: one phone answers approvals for four clients.
-- Scoping devices by project would mean a phone per client, which is not the model — and a
-- nullable `project_id` here would be `project-scoping.md` invariant 8's failure mode with
-- the safety off. This table holds no client data: a device name and a public key are facts
-- about the operator's hardware, not about any project's business. That is the claim
-- `rtl-arabic-pdpl-specialist` is asked to sign or refuse; it is not assumed.

-- ---------------------------------------------------------------------------
-- 4. Is any of this enforced?
-- ---------------------------------------------------------------------------
--
-- **No, and this function is how a surface finds that out instead of assuming it.**
--
-- It is a constant `false`. It is not enforcement and does not become enforcement by being
-- called. It exists for one reason: a UI, a status route or a reviewer that wants to say
-- "scopes: enforced" has to ask the database and gets `false` — the same shape as 0005's
-- `ops.project_scope_enforced()`, which turned an inert RLS policy from a surprise into a
-- line on `GET /api/status`.
--
-- The day enforcement lands, this function stops being a constant, and the ADR that lands
-- it must name the single point at which a request is denied. If that point cannot be named
-- in one sentence, the proposal is not ready.

CREATE OR REPLACE FUNCTION ops.device_scopes_enforced()
RETURNS boolean LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT false
$$;

COMMENT ON FUNCTION ops.device_scopes_enforced() IS
  'Constant false in M15. ops.device.scopes is declared, defaulted to empty, and read by no code path. Report it on GET /api/status as devices.scopeEnforcement so no surface can claim an enforcement that does not exist (BOARD #5; a scope with no enforcement point is a comment).';

-- ---------------------------------------------------------------------------
-- 5. No seed row
-- ---------------------------------------------------------------------------
--
-- 0005 seeds `ops.project` because the AgentOS mount genuinely exists on disk. Nothing
-- comparable is true here: no device has ever registered, because no code path writes this
-- table yet. An empty `ops.device` is the honest state and it is a real zero rather than an
-- unknown — "no device has registered" is a fact, not a missing measurement (CLAUDE.md rule
-- 9, Part VII.3).
