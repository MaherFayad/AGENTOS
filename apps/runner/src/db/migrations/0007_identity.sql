-- 0007_identity.sql
--
-- `ops.identity` — who is asking (ADR-016, `AGENTOS-V2-PLAN.md` Plan §11).
--
-- ## Why this is 0007 and not 0006
--
-- It was written as `0006_identity.sql` and renamed within the hour, because
-- `0006_ops_device.sql` was created by `sessions-relay-engineer` in the same session, from
-- the same directory listing, at the same moment. **That is the ADR-012 collision again, in
-- a namespace BOARD says is the only one that cannot be raced.** BOARD's own rule anticipates
-- this exactly: *"if a second shared-integer namespace is ever introduced, it inherits this
-- rule on day one."* Migration filenames are that second namespace — a flat integer sequence
-- with no author in the key — and it has now been raced.
--
-- Mine moved rather than theirs, on the ADR-013 principle: **allocate against the side with
-- no dependents.** `0006_ops_device.sql` was already cited by its own handoff and its test;
-- this file was cited by nothing. `scripts/__tests__/repo-conformance.test.mjs` now fails on
-- any duplicate migration number, so the third occurrence is a red gate rather than a
-- discovery.
--
-- Applying identity *after* device is safe and is not a dependency inversion: `ops.device`
-- deliberately ships with no foreign key to this table (their §0). The column that closes
-- that seam is a later migration, after the written handover — see §2.
--
-- ## The one idea this file exists to protect
--
-- Part One's Phase 4 treats "accounts" as a single concept. It is **three**, and conflating
-- them produces a schema you have to unpick later:
--
--   identity        who is asking?                    ops.identity        (this file)
--   device          from what, with what powers?      ops.device          (NOT created here)
--   billing account who *pays* for this run?          ops.billing_account (created in 0005)
--
-- They are orthogonal: **one you, N devices, M paying accounts.** The working test, and it
-- resolves most arguments in this area in one step: *sort the question into which of the
-- three it is about, first.* Most confusion here is a question that was answered against the
-- wrong table — including one in the plan itself, see §3 below.
--
-- ## What this migration deliberately does NOT create or ALTER
--
--   ops.device          — exists, in `0006_ops_device.sql`, built by `sessions-relay-engineer`.
--                         Theirs on loan during M15: per-device keypairs, push subscriptions
--                         and the E2E envelope allowlist are already theirs.
--   ops.billing_account — exists, in `0005_project_axis.sql`, `runner-engineer`'s, because
--                         Part V's billing split and the hard monthly cap are already theirs.
--
-- Both are on loan under the M15 interim split (BOARD, `contracts/project-scoping.md` §5.3).
-- An ownership change is a written exchange, not a file edit (ADR-000) — so this migration
-- adds **no column to either table**, including the two it would like:
-- `ops.device.identity_id` (§2) and `ops.billing_account.identity_id` (§3). Both are proposed
-- to their owners by message; neither is taken. Until those exchanges exist in writing the
-- interim owner is the owner and this file is a consumer.
--
-- ## Scopes are NOT in this file, and that is the load-bearing part
--
-- **Scopes live on the device, not the identity.** The phone that answers approvals at 23:00
-- gets `read · run · approve`; it does not get `admin`. That is what makes losing a phone a
-- revocation rather than an incident. If `scopes` were a column here, revoking a phone would
-- mean editing *you*, and the whole split would have bought nothing.
--
-- The mechanism for that is **not this comment.** It is
-- `scripts/__tests__/identity-model.test.mjs`, which fails if a `scopes` column ever appears
-- on `ops.identity`, and fails if any source file starts *reading* a scopes value while
-- enforcement is deferred (ADR-016 §6). This repo has already paid for the difference once:
-- `workspace` confinement was a docstring until a test proved a run could escape it and
-- overwrite `.env`. A comment is not a mechanism.
--
-- ## PDPL (Part VII.4)
--
-- The seeded row holds a slug and a display name and nothing else. No email, no phone, no
-- external account id — so this table is not personal data at rest, and a future one would
-- have to make that change deliberately rather than by filling in a column that was waiting.

-- ---------------------------------------------------------------------------
-- 1. ops.identity
-- ---------------------------------------------------------------------------
--
-- Deterministic id from the slug, exactly as `ops.project_id_for` does and for a weaker
-- reason: nothing needs to compute an identity id without a round trip today. It is here so
-- that whoever adds `ops.device.identity_id` writes `ops.identity_id_for('owner')` instead
-- of pasting a uuid literal into a second file. It has exactly one caller — the seed below.
--
-- **There is deliberately no TypeScript mirror.** 0005's own comment is the reason: two
-- implementations of one identifier is how a foreign key silently stops matching. `project.ts`
-- earns its mirror because the runner must resolve a project with no Postgres at all; nothing
-- resolves an identity at all yet, so a second implementation would be a second thing to keep
-- in sync in exchange for nothing.

CREATE OR REPLACE FUNCTION ops.identity_id_for(slug text)
RETURNS uuid LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
  SELECT md5('agnetos.identity:' || slug)::uuid
$$;

COMMENT ON FUNCTION ops.identity_id_for(text) IS
  'Deterministic identity id from a slug. An identifier, not a security primitive. One caller today: the seed at the end of migration 0007.';

CREATE TABLE IF NOT EXISTS ops.identity (
  id            uuid PRIMARY KEY,

  -- Stable, greppable, and the thing a future device row is keyed against in a log.
  slug          text NOT NULL UNIQUE,
  CONSTRAINT identity_slug_is_a_slug CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),

  -- The only human-authored string in the table. It is a label, and PDPL (Part VII.4) is the
  -- reason it is not an email: an address here would make this row personal data at rest, in
  -- a table that is deliberately not project-scoped and therefore not covered by 0005's
  -- row-level isolation. The CHECK is the mechanism — an address cannot be stored, so no
  -- later convenience can quietly turn this column into a contact field.
  display_name  text NOT NULL,
  CONSTRAINT display_name_is_not_an_address CHECK (display_name !~ '@'),

  created_at    timestamptz NOT NULL DEFAULT now()

  -- **No `scopes`.** See the header. Enforced by identity-model.test.mjs, not by this line.
  --
  -- **No `disabled_at`, on purpose.** Revocation is first-class for *devices*, where it is
  -- the whole point of the split. On identity it would be a column that nothing reads and
  -- that makes a claim nothing honours — "identities can be disabled" — which is the same
  -- defect as a scopes column with no enforcement point, one table over. With one row, adding
  -- it later is a migration on a table with one row. It is cheap exactly when it is needed.
  --
  -- **No `project_id`.** Account and project are two axes, never one (`Plan §11`, §9). One
  -- you, across every project. This is also why the table gets no RLS policy in §4.
);

COMMENT ON TABLE ops.identity IS
  'Who is asking (Plan §11, ADR-016). One row today; the shape allows N and nothing enforces a count. Deliberately holds no scopes (those live on ops.device) and no project_id (identity is cross-project). Owner: identity-access-engineer.';
COMMENT ON COLUMN ops.identity.display_name IS
  'A label, never an address. The CHECK is what keeps this table out of PDPL scope (Part VII.4).';

-- ---------------------------------------------------------------------------
-- 2. The seam to ops.device — agreed on both sides, and one column short
-- ---------------------------------------------------------------------------
--
-- `ops.device` is `sessions-relay-engineer`'s, and it already satisfies every clause
-- `identity.md` §4 asks of it: `scopes` lives there and nowhere else, revocation is
-- `revoked_at` + `revoked_reason` with no DELETE path, and a revoked device is forbidden by
-- CHECK from holding any scope at all — which is better than what was asked for, because it
-- closes the case where a future enforcement point reads `scopes` and forgets `revoked_at`.
--
-- The one column not there is the foreign key to this table, and its absence was correct:
-- `ops.identity` did not exist when that migration was written, and an `identity_id` with no
-- FK is a pointer at nothing, i.e. a comment shaped like a mechanism. Their §0 wrote the
-- closing statement in advance:
--
--     ALTER TABLE ops.device ADD COLUMN identity_id uuid NOT NULL
--       REFERENCES ops.identity(id) ON DELETE RESTRICT;      -- and NO UNIQUE on it
--
-- **The absent UNIQUE is theirs and it is the sharpest sentence either of us wrote about
-- this seam:** *"one you, N devices" is exactly the statement "identity_id is not unique".*
-- A UNIQUE there would collapse the two tables back into one and re-create the conflation
-- §11 exists to undo.
--
-- That ALTER is **not in this file.** Their table, their migration, after the written
-- handover — `comms/inbox/sessions-relay-engineer/20260817-0006-identity-access-engineer-device-seam-and-transfer.md`.
-- Two agents specifying the same seam independently is the evidence the seam is right; one
-- of them reaching into the other's file anyway is the drift `comms/` exists to prevent.
--
-- `scripts/__tests__/identity-model.test.mjs` therefore asserts the FK **when it is present**
-- — NOT NULL, ON DELETE RESTRICT, no UNIQUE — and does not assert its presence. A test that
-- goes red for work another agent has correctly not done yet is a test that gets deleted.

-- ---------------------------------------------------------------------------
-- 3. The billing account — where `Plan §11` answered against the wrong table
-- ---------------------------------------------------------------------------
--
-- `Plan §11` names one `ops.credential` holding "work vs personal Claude accounts". Migration
-- 0005 split that in two, and ADR-016 ratifies the split rather than reversing it:
--
--   ops.billing_account   who pays. **Cross-project** — one work account pays for four
--                         clients. This is `Plan §11`'s billing-account concept.
--   ops.credential        this project's secret for this connector, keyed
--                         `(project_id, connector)`. **Project-only** (ADR-014 §3.1).
--
-- Apply the sorting test and the split is obvious: *"which HubSpot key does this project
-- use?"* is not a question about who pays. It was answered against the wrong table in the
-- plan. One table would have forced a nullable `project_id`, which is
-- `project-scoping.md` invariant 8's failure mode with the safety off.
--
-- **`ops.identity` adds no column to either table.** `billing_account.identity_id` is the
-- obvious next seam and it is deliberately not taken: with one identity every account belongs
-- to the same one, so the column would be a constant, and a constant column is the same defect
-- as a scopes column nothing reads. Designing for N and building 1 is legal; building N
-- because it might be needed is not. It is proposed to `runner-engineer` in
-- `comms/inbox/runner-engineer/20260817-0007-identity-access-engineer-credential-split-and-the-identity-seam.md`
-- and belongs to them either way.

-- ---------------------------------------------------------------------------
-- 4. Isolation — why this table gets no RLS policy
-- ---------------------------------------------------------------------------
--
-- 0005 §5 puts every project-scoped table behind `ops.project_visible(project_id)`, so that a
-- query with no project in scope **raises** rather than returning another project's rows.
-- `ops.identity` is not in that set, for the same reason `ops.project` and
-- `ops.billing_account` are not: it holds no client's data and it has no project axis to be
-- scoped by. One you, across every project.
--
-- Stated here rather than left to inference, because "this table has no RLS" and "someone
-- forgot the RLS on this table" look identical in a schema dump, and the second one is the
-- mechanism by which client A's rows reach client B.

-- ---------------------------------------------------------------------------
-- 5. Seed — one row, and no constraint pinning it to one
-- ---------------------------------------------------------------------------
--
-- Part One §8 stands: **design for more than one, build one.** Both halves are real work.
--
--   Designing for N is why there is a real primary key, a unique slug, and no `CHECK
--   ((SELECT count(*) FROM ops.identity) = 1)`. A constraint pinning the count would be the
--   un-design: it would make the second identity a migration instead of an INSERT.
--
--   Building one is why exactly one row is inserted and nothing generates more.
--
-- So: nothing enforces the count, and that is the design rather than a gap.
--
-- `owner` / `Owner` carries no personal data (§1). This is a configuration row describing a
-- fact that is true — this coordinator has one operator — and not seeded demo data: standing
-- rule 9 is about numbers, and there is not a metric in this row.

INSERT INTO ops.identity (id, slug, display_name)
VALUES (ops.identity_id_for('owner'), 'owner', 'Owner')
ON CONFLICT (slug) DO NOTHING;
