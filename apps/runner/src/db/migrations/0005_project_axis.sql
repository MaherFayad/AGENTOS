-- 0005_project_axis.sql
--
-- The third plane (ADR-015, `AGENTOS-V2-PLAN.md` Plan §9–§11).
--
-- Until now every table in this database assumed exactly one library and one everything.
-- This migration adds the axis that nothing had, and it is written as an **audit** of the
-- four tables that already exist rather than as an addition to them (Plan §10, §21.1).
--
-- Read the three rules before changing anything here:
--
--  1. **`unknown` is not `zero`, and it is not `NULL` either.** Every place where a value
--     could be missing gets a *named* state next to it — `account_source`, `cost_source` —
--     so "nobody paid for this run" and "we do not know who paid" are different bytes. The
--     project axis multiplies these surfaces; retrofitting the distinction later is how a
--     dashboard starts lying.
--
--  2. **A comment is not a mechanism.** Every "must not" below is a CHECK, a FOREIGN KEY,
--     a row-level-security policy or an absent code path. Where the mechanism is weaker
--     than the claim, the claim is weakened — not the other way round. See
--     `ops.project_scope_enforced()`.
--
--  3. **Nothing here bakes in a department count.** `Plan §10` says seven departments in
--     one sentence and an eighth (`engineering`) in the next. Both are true and the eighth
--     is out of M15. There is no `CHECK (department IN (...))` and no `7` in this file.
--
-- PDPL (Part VII.4): the project axis is the boundary that keeps client A's rows away from
-- client B's. It is enforced by RLS below, not by a `WHERE` clause someone has to remember
-- (`project-scoping.md` invariant 8: *isolation is proved by a failing query, not a filter*).

-- ---------------------------------------------------------------------------
-- 0. Deterministic project ids
-- ---------------------------------------------------------------------------
--
-- A project id is derived from its slug at creation time, so the runner can compute the id
-- of the project it mounts without a round trip — which matters because the runner must
-- keep serving MAP, CHART and the drawer with no Postgres at all (`--profile dev`).
--
-- Derived, then **stored**: the column is authoritative from the moment the row exists.
-- Renaming a slug therefore keeps the id, and every ledger row it owns.
--
-- md5(text)::uuid needs no extension. This is an identifier, not a security primitive.

CREATE OR REPLACE FUNCTION ops.project_id_for(slug text)
RETURNS uuid LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
  SELECT md5('agnetos.project:' || slug)::uuid
$$;

COMMENT ON FUNCTION ops.project_id_for(text) IS
  'Deterministic project id from a slug. Mirrored in apps/runner/src/lib/project.ts and asserted equal by a test — two implementations of one identifier is how a foreign key silently stops matching.';

-- ---------------------------------------------------------------------------
-- 1. ops.project — the mount, never a capability
-- ---------------------------------------------------------------------------
--
-- ADR-009's rule, load-bearing at N projects: the Operations plane may reference
-- `agents/sales/account-enrichment`; it may never define it (Plan §9). There is
-- deliberately no column here that describes what an agent *is*.

CREATE TABLE IF NOT EXISTS ops.project (
  id                uuid PRIMARY KEY,
  slug              text NOT NULL UNIQUE,
  name              text NOT NULL,

  -- The git repo holding `agents/`, `panels/`, `company/`. A path on a host this
  -- coordinator can read.
  library_path      text NOT NULL,

  -- A git remote is an egress event of the same class as a `deliver:` target that leaves
  -- the tailnet (BOARD open question, Part VII.4) — a `git push` sends a project library
  -- to a third party. The CHECK is the mechanism, not this comment: until that ADR lands
  -- and a later migration drops the constraint, a remote **cannot be stored**, so no code
  -- path can act on one. Dropping a constraint is a reviewable act; ignoring a comment is
  -- not. (ADR-015 Q5.)
  library_remote    text,
  CONSTRAINT library_remote_needs_egress_adr CHECK (library_remote IS NULL),

  -- Where runs get their scratch space. Confined per run by `isPathInsideScratch`.
  workspace_root    text NOT NULL,

  -- Which execution hosts may run this project (Plan §9). Declared, and **read by
  -- nothing** in M15: there is one host and Tailscale is not installed, so any value here
  -- is unverifiable. Built now because the alternative is a migration on a live ledger
  -- later, and the column is free. `GET /api/projects` reports it next to
  -- `hostAffinityEnforced: false` so no UI can render it as though it did something.
  host_affinity     text[] NOT NULL DEFAULT '{}',

  -- Which billing account pays, by default. Composite FK below pins the referenced row to
  -- kind='anthropic', so `default_account_id` cannot point at a connector secret.
  default_account_id uuid,

  -- Hard cap in USD (Plan §9). Declared; **not enforced in M15** — see ADR-015 Q6. Spend
  -- per project can only be computed from ledger rows, and zero runs have ever executed,
  -- so a cap derived from it would be either a false refusal or a silent pass. The one
  -- enforced ceiling today is Part V's workspace cap in the runner.
  budget_monthly    numeric(12,2),
  CONSTRAINT budget_monthly_positive CHECK (budget_monthly IS NULL OR budget_monthly > 0),

  status            text NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','paused','archived')),

  created_at        timestamptz NOT NULL DEFAULT now(),
  -- Deleting a project detaches a library; it never deletes one, and it never deletes
  -- history either (Plan §9, ADR-015 Q4). Archiving is the only removal there is: every
  -- foreign key into this table is ON DELETE RESTRICT, so a `DELETE FROM ops.project` with
  -- one ledger row behind it fails in the database.
  archived_at       timestamptz,
  CONSTRAINT archived_has_a_date CHECK (
    (status = 'archived') = (archived_at IS NOT NULL)
  ),

  CONSTRAINT slug_is_a_slug CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  -- `all` is the cross-project route namespace (`/api/all/...`) and `p` is the project
  -- namespace itself. A project called either would make a URL ambiguous.
  CONSTRAINT slug_is_not_reserved CHECK (slug NOT IN ('all','p','api'))
);

COMMENT ON TABLE ops.project IS
  'A mount, never a capability (Plan §9). Deleting a row detaches a library and is blocked by RESTRICT while history exists; archiving is the removal path. Owner: runner-engineer (ADR-015).';
COMMENT ON COLUMN ops.project.budget_monthly IS
  'Declared, not enforced in M15. The enforced ceiling is Part V''s workspace cap in the runner. See ADR-015 Q6.';
COMMENT ON COLUMN ops.project.host_affinity IS
  'Declared, read by nothing in M15. One host exists and Tailscale is not installed, so no value here is verifiable.';

-- ---------------------------------------------------------------------------
-- 2. ops.billing_account and ops.credential — two tables, because they scope oppositely
-- ---------------------------------------------------------------------------
--
-- `Plan §11` names a single `ops.credential` holding "work vs personal Claude accounts".
-- ADR-014 §3.1 needs `ops.credential` keyed `(project_id, connector)` so that a resolved
-- `wired_into: [hubspot]` means *this project's* HubSpot and can never fall back to
-- another project's. Those two are not one table: a billing account is deliberately
-- **cross-project** (one work account pays for four clients) and a connector credential is
-- deliberately **project-only**. One table would force a nullable `project_id`, which is
-- invariant 8's failure mode with the safety off. So: two tables, split in ADR-015, routed
-- to ADR-016 for the naming.
--
-- Neither table stores secret material. `secret_ref` is the *name* of a secret — an env
-- var, a file on a mounted volume — resolved at dispatch. "The key is outside Postgres"
-- (Plan §11) is then structurally true rather than a claim about an encryption routine we
-- have not written: there is no ciphertext column to decrypt and no key to lose. A
-- `secret_ref` that resolves to nothing fails the run with `connector_uncredentialed` and
-- names the ref in the hint. (ADR-015 Q18.)

CREATE TABLE IF NOT EXISTS ops.billing_account (
  id            uuid PRIMARY KEY,
  slug          text NOT NULL UNIQUE,
  label         text NOT NULL,
  -- 'anthropic' — the runner's capped API-key workspace (Part V). Left open as text with a
  -- CHECK rather than an enum so a second provider is a migration, not a type change.
  kind          text NOT NULL CHECK (kind IN ('anthropic')),
  secret_ref    text NOT NULL,
  monthly_cap_usd numeric(12,2),
  created_at    timestamptz NOT NULL DEFAULT now(),
  revoked_at    timestamptz,

  -- Referenced by ops.project.default_account_id together with kind, so a project's
  -- default account is provably an Anthropic account and not something else.
  UNIQUE (id, kind)
);

COMMENT ON TABLE ops.billing_account IS
  'Who pays (Plan §11). Cross-project on purpose: one you, N devices, M paying accounts. Holds a secret_ref (a name), never a secret.';

-- The composite FK. `default_account_kind` is a generated constant column whose only job
-- is to give the foreign key something to pin the kind against — the standard way to say
-- "this reference must point at a row of this kind" in SQL.
ALTER TABLE ops.project
  ADD COLUMN IF NOT EXISTS default_account_kind text
    GENERATED ALWAYS AS ('anthropic') STORED;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'project_default_account_is_anthropic'
  ) THEN
    ALTER TABLE ops.project
      ADD CONSTRAINT project_default_account_is_anthropic
      FOREIGN KEY (default_account_id, default_account_kind)
      REFERENCES ops.billing_account (id, kind)
      ON DELETE RESTRICT;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS ops.credential (
  project_id    uuid NOT NULL REFERENCES ops.project(id) ON DELETE RESTRICT,
  -- Connector name from the runner's registry (`wired_into` vocabulary).
  connector     text NOT NULL,
  secret_ref    text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  revoked_at    timestamptz,
  PRIMARY KEY (project_id, connector)
);

COMMENT ON TABLE ops.credential IS
  'This project''s credential for this connector (ADR-014 §3.1). Names cascade; secrets never do. There is NO global fallback and the mechanism is the absence of one: the primary key has no nullable project_id to fall through to, and the lookup has no second branch. A project that declares a connector it holds no credential for fails with connector_uncredentialed.';

-- ---------------------------------------------------------------------------
-- 3. Seed the project that already exists
-- ---------------------------------------------------------------------------
--
-- Plan §24: nothing moves on disk. This repository becomes `project: AgentOS` in place.
--
-- This is a configuration row describing a mount that genuinely exists, not seeded demo
-- data — standing rule 9 is about *numbers*, and there is not a metric in this row. The
-- ledger stays empty, because zero runs have executed.
--
-- `library_path` and `workspace_root` are placeholders the runner overwrites from its own
-- resolved config on boot; they are NOT NULL so the row cannot exist without an answer.

INSERT INTO ops.project (id, slug, name, library_path, workspace_root)
VALUES (ops.project_id_for('agentos'), 'agentos', 'AgentOS', '/repo', '/workspaces')
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. The audit — the project axis on tables that already exist
-- ---------------------------------------------------------------------------
--
-- ops.agent_runs      → project_id, agent_ref, source_ref, account_id + account_source
-- ops.agent_run_daily → project_id in the PRIMARY KEY  (the sharp one; see below)
-- app.agent_outputs   → project_id
-- ops.agent_run_tools → deliberately NOT scoped; see the note at its policy
-- ops_migrations      → deliberately NOT scoped; it describes this database, not a project

-- 4a. The run ledger.
ALTER TABLE ops.agent_runs
  ADD COLUMN IF NOT EXISTS project_id uuid,
  -- `{project}/{department}/{slug}` — the addressable agent (ADR-014 §2). This, and not
  -- `agent`, is the identity every operations row hangs off: a project fork of
  -- sales/database-mining is a *different agent* with its own run history, its own ledger
  -- and its own halo. Run history never follows a fork or a promotion.
  ADD COLUMN IF NOT EXISTS agent_ref text,
  -- `{layer}:{path}@sha256:…` — which file actually won the cascade, at what content
  -- (ADR-014 §2). Recorded on the run, never on the agent. This is what makes "which
  -- code-reviewer did I just run?" answerable after the fact, and §21 risk 9 is the bug
  -- class with no error message.
  ADD COLUMN IF NOT EXISTS source_ref text,
  ADD COLUMN IF NOT EXISTS account_id uuid,
  ADD COLUMN IF NOT EXISTS account_source text;

-- Backfill. Zero rows exist today, so this changes nothing here — it is written anyway so
-- the same migration is correct on a database that *does* have rows, which is the only
-- state it will ever be applied to again. (ADR-015 Q3: backfill, then NOT NULL. A nullable
-- project_id plus a forgotten WHERE is exactly how client A's data reaches client B.)
UPDATE ops.agent_runs
   SET project_id = ops.project_id_for('agentos')
 WHERE project_id IS NULL;
UPDATE ops.agent_runs
   SET agent_ref = 'agentos/' || agent
 WHERE agent_ref IS NULL;
UPDATE ops.agent_runs
   SET source_ref = 'project:agents/' || agent || '/SKILL.md@sha256:unknown'
 WHERE source_ref IS NULL;
UPDATE ops.agent_runs
   SET account_source = 'unattributed'
 WHERE account_source IS NULL;

ALTER TABLE ops.agent_runs
  ALTER COLUMN project_id SET NOT NULL,
  ALTER COLUMN agent_ref  SET NOT NULL,
  ALTER COLUMN source_ref SET NOT NULL,
  ALTER COLUMN account_source SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_runs_project_fk') THEN
    ALTER TABLE ops.agent_runs
      ADD CONSTRAINT agent_runs_project_fk
      FOREIGN KEY (project_id) REFERENCES ops.project(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_runs_account_fk') THEN
    ALTER TABLE ops.agent_runs
      ADD CONSTRAINT agent_runs_account_fk
      FOREIGN KEY (account_id) REFERENCES ops.billing_account(id) ON DELETE RESTRICT;
  END IF;

  -- agent_ref really is {project}/{agent}: the two columns cannot drift into disagreeing
  -- about which agent this row belongs to.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_ref_ends_with_agent') THEN
    ALTER TABLE ops.agent_runs
      ADD CONSTRAINT agent_ref_ends_with_agent CHECK (agent_ref LIKE '%/' || agent);
  END IF;

  -- The same shape as `cost_provenance` two columns up, for the same reason. A run whose
  -- payer we do not know says so in a value; it does not say it with a NULL that a
  -- cost-by-account chart would quietly drop. (ADR-015 Q20.)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'account_provenance') THEN
    ALTER TABLE ops.agent_runs
      ADD CONSTRAINT account_provenance CHECK (
        (account_source = 'unattributed' AND account_id IS NULL) OR
        (account_source IN ('project-default','run-override') AND account_id IS NOT NULL)
      );
  END IF;
END $$;

-- Every metric query filters by project first, then by its own axis. These indexes lead
-- with project_id so a project-scoped query never scans another project's rows — the
-- performance half of isolation, which matters at four clients and not at one.
CREATE INDEX IF NOT EXISTS agent_runs_project_started_idx
  ON ops.agent_runs (project_id, started_at DESC);
CREATE INDEX IF NOT EXISTS agent_runs_project_agent_started_idx
  ON ops.agent_runs (project_id, agent, started_at DESC);
CREATE INDEX IF NOT EXISTS agent_runs_agent_ref_started_idx
  ON ops.agent_runs (agent_ref, started_at DESC);
CREATE INDEX IF NOT EXISTS agent_runs_account_started_idx
  ON ops.agent_runs (account_id, started_at DESC);

COMMENT ON COLUMN ops.agent_runs.agent_ref IS
  '{project}/{department}/{slug} — the addressable agent (ADR-014 §2). Liveness, history and cost hang off this, never off `agent`, so a fork or a promotion starts at zero runs.';
COMMENT ON COLUMN ops.agent_runs.source_ref IS
  '{layer}:{path}@sha256:… — the file that actually won the cascade at dispatch. Provenance for a bug class that has no error message (Plan §21.9).';
COMMENT ON COLUMN ops.agent_runs.account_source IS
  'unattributed = we do not know who paid. Never inferred, never defaulted to a project account after the fact.';

-- 4b. The daily rollup — the sharp one.
--
-- `ops.agent_run_daily` was keyed `(day, agent)`. `agent` is `department/slug`, and under
-- the cascade the same `(department, slug)` in two projects is two different agents
-- (ADR-014 §2). Left alone, this table would **merge two clients' history into one row**
-- the first time retention ran — silently, months later, with the source rows already
-- deleted. Adding project_id to the primary key is the whole fix and it is why this table
-- could not be left for the read-path owner to pick up.
ALTER TABLE ops.agent_run_daily
  ADD COLUMN IF NOT EXISTS project_id uuid;

UPDATE ops.agent_run_daily
   SET project_id = ops.project_id_for('agentos')
 WHERE project_id IS NULL;

ALTER TABLE ops.agent_run_daily
  ALTER COLUMN project_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_run_daily_project_fk') THEN
    ALTER TABLE ops.agent_run_daily
      ADD CONSTRAINT agent_run_daily_project_fk
      FOREIGN KEY (project_id) REFERENCES ops.project(id) ON DELETE RESTRICT;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'agent_run_daily_pkey' AND conrelid = 'ops.agent_run_daily'::regclass
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_index i
      JOIN pg_class c ON c.oid = i.indexrelid
     WHERE i.indrelid = 'ops.agent_run_daily'::regclass
       AND i.indisprimary
       AND array_length(i.indkey::int[], 1) = 3
  ) THEN
    ALTER TABLE ops.agent_run_daily DROP CONSTRAINT agent_run_daily_pkey;
    ALTER TABLE ops.agent_run_daily ADD PRIMARY KEY (day, project_id, agent);
  END IF;
END $$;

-- The rollup writer has to group by the new key or it re-creates the merge it was just
-- fixed for. `ops.prune` / `ops.rollup_runs` are `observability-engineer`'s under ADR-008;
-- this is the minimum change that keeps them correct against the new shape, and it is
-- filed to them rather than adopted.
--
-- `SET agnetos.project_id = '*'` is the deliberate cross-project scope (§5). The rollup
-- runs for the whole coordinator by design; saying so in the function definition is how
-- that stays a decision instead of an accident.
CREATE OR REPLACE FUNCTION ops.rollup_runs(target_day date)
RETURNS integer
LANGUAGE plpgsql
SET agnetos.project_id = '*'
AS $$
DECLARE
  affected integer;
BEGIN
  INSERT INTO ops.agent_run_daily AS d
    (day, project_id, agent, department, runs, errors, cost_usd, unpriced_runs, total_duration_ms)
  SELECT
    target_day,
    project_id,
    agent,
    min(department),
    count(*),
    count(*) FILTER (WHERE status = 'error'),
    sum(cost_usd),
    count(*) FILTER (WHERE cost_usd IS NULL),
    coalesce(sum(duration_ms), 0)
  FROM ops.agent_runs
  WHERE dry_run = false
    AND started_at >= target_day::timestamptz
    AND started_at <  (target_day + 1)::timestamptz
  GROUP BY project_id, agent
  ON CONFLICT (day, project_id, agent) DO UPDATE SET
    department        = EXCLUDED.department,
    runs              = EXCLUDED.runs,
    errors            = EXCLUDED.errors,
    cost_usd          = EXCLUDED.cost_usd,
    unpriced_runs     = EXCLUDED.unpriced_runs,
    total_duration_ms = EXCLUDED.total_duration_ms;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

-- 4c. Business rows written by agents — the PDPL-sharpest table in the database.
ALTER TABLE app.agent_outputs
  ADD COLUMN IF NOT EXISTS project_id uuid;

UPDATE app.agent_outputs
   SET project_id = ops.project_id_for('agentos')
 WHERE project_id IS NULL;

ALTER TABLE app.agent_outputs
  ALTER COLUMN project_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_outputs_project_fk') THEN
    ALTER TABLE app.agent_outputs
      ADD CONSTRAINT agent_outputs_project_fk
      FOREIGN KEY (project_id) REFERENCES ops.project(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- The upsert target was `(kind, entity_key)`. Two clients with a deal keyed 'ACME-1' would
-- have overwritten each other's row — one client's data replaced by another's, through a
-- unique index. Same class as 4b and worth naming separately because it is a *write*.
DROP INDEX IF EXISTS app.agent_outputs_identity_idx;
CREATE UNIQUE INDEX IF NOT EXISTS agent_outputs_identity_idx
  ON app.agent_outputs (project_id, kind, entity_key)
  WHERE entity_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS agent_outputs_project_kind_time_idx
  ON app.agent_outputs (project_id, kind, occurred_at DESC);

-- ---------------------------------------------------------------------------
-- 5. Isolation — a failing query, not a filter
-- ---------------------------------------------------------------------------
--
-- `project-scoping.md` invariant 8: *a query that reaches a project-scoped table without a
-- project predicate **fails**, in a test, rather than returning another project's rows.*
--
-- Returning zero rows would be the worse failure and is the one this repo has already been
-- bitten by twice: an unscoped read that silently answers "nothing here" is indistinguish-
-- able from an honest empty state. So the predicate **raises**.
--
-- Three states, three different outcomes, on purpose:
--
--   scope set to a project  → that project's rows; zero rows means zero runs. Honest.
--   scope set to '*'        → every project's row. Deliberate, greppable, used by prune
--                             and by the `/api/all/*` routes and nothing else.
--   scope not set at all    → SQLSTATE 42501, `project_scope_missing`. Not empty. Not zero.

CREATE OR REPLACE FUNCTION ops.project_visible(row_project uuid)
RETURNS boolean LANGUAGE plpgsql STABLE AS $$
DECLARE
  raw text;
BEGIN
  raw := current_setting('agnetos.project_id', true);

  IF raw = '*' THEN
    RETURN true;
  END IF;

  IF raw IS NULL OR raw = '' THEN
    RAISE EXCEPTION 'project_scope_missing: a query reached a project-scoped table with no project in scope'
      USING ERRCODE = '42501',
            HINT = 'Wrap it in withProject(db, projectId, …), or set agnetos.project_id = ''*'' for a deliberate cross-project read. There is no default project, by design (ADR-015 Q2).';
  END IF;

  RETURN row_project = raw::uuid;
END;
$$;

COMMENT ON FUNCTION ops.project_visible(uuid) IS
  'RLS predicate for every project-scoped table. Raises rather than returning no rows when the scope is unset — an unscoped read must look like a fault, not like an empty state (BOARD rule 9).';

-- ops.agent_runs
ALTER TABLE ops.agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.agent_runs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agent_runs_project_scope ON ops.agent_runs;
CREATE POLICY agent_runs_project_scope ON ops.agent_runs
  USING (ops.project_visible(project_id))
  WITH CHECK (ops.project_visible(project_id));

-- ops.agent_run_daily
ALTER TABLE ops.agent_run_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.agent_run_daily FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agent_run_daily_project_scope ON ops.agent_run_daily;
CREATE POLICY agent_run_daily_project_scope ON ops.agent_run_daily
  USING (ops.project_visible(project_id))
  WITH CHECK (ops.project_visible(project_id));

-- app.agent_outputs
ALTER TABLE app.agent_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.agent_outputs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agent_outputs_project_scope ON app.agent_outputs;
CREATE POLICY agent_outputs_project_scope ON app.agent_outputs
  USING (ops.project_visible(project_id))
  WITH CHECK (ops.project_visible(project_id));

-- ops.credential
ALTER TABLE ops.credential ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.credential FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS credential_project_scope ON ops.credential;
CREATE POLICY credential_project_scope ON ops.credential
  USING (ops.project_visible(project_id))
  WITH CHECK (ops.project_visible(project_id));

-- ops.agent_run_tools — deliberately **not** given a project_id.
--
-- Its identity is (run_id, seq) with a cascading FK to ops.agent_runs. A second copy of
-- the project would be a second place for the answer to live, and two copies of one fact
-- eventually disagree — here that disagreement would be a tool span attributed to the
-- wrong client. Instead its policy borrows the parent's, which is already RLS-filtered:
-- the subquery below sees only the rows the current scope may see, so an unscoped read of
-- the spans raises through `ops.agent_runs`'s own predicate. Same guarantee, one source.
ALTER TABLE ops.agent_run_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.agent_run_tools FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agent_run_tools_project_scope ON ops.agent_run_tools;
CREATE POLICY agent_run_tools_project_scope ON ops.agent_run_tools
  USING (EXISTS (SELECT 1 FROM ops.agent_runs r WHERE r.run_id = ops.agent_run_tools.run_id))
  WITH CHECK (EXISTS (SELECT 1 FROM ops.agent_runs r WHERE r.run_id = ops.agent_run_tools.run_id));

-- ops.project and ops.billing_account are NOT row-level-scoped. A project row *is* the
-- description of a scope, so scoping it by itself is circular, and the project switcher
-- must be able to list what exists. Billing accounts are cross-project by design (§2).
-- Neither table holds a client's data — they hold mounts and the names of secrets.

-- Prune runs coordinator-wide; say so in the definition rather than in a runbook.
ALTER FUNCTION ops.prune(integer, integer) SET agnetos.project_id = '*';

-- ---------------------------------------------------------------------------
-- 6. Is any of the above actually in force?
-- ---------------------------------------------------------------------------
--
-- RLS is bypassed entirely by a superuser and by any role with BYPASSRLS, and compose's
-- default Postgres user is a superuser. **So on the stack as it ships today, section 5 is
-- inert.** That sentence is the honest one and it is why this function exists instead of a
-- paragraph claiming isolation: the runner probes it at boot, logs it loudly, and reports
-- it on `GET /api/status` as `projects.scopeEnforcement`. A hole you can see on a status
-- page is a task; a hole described in a migration comment is a surprise.
--
-- Closing it is one line of infra — a non-superuser role for the app connection — and is
-- filed to `infra-compose-engineer`. It is deliberately not done here: creating roles and
-- granting them is compose's territory, and a migration that quietly changed who the
-- runner connects as would be a worse surprise than the one it fixed.

CREATE OR REPLACE FUNCTION ops.project_scope_enforced()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT NOT (rolsuper OR rolbypassrls)
    FROM pg_roles WHERE rolname = current_user
$$;

COMMENT ON FUNCTION ops.project_scope_enforced() IS
  'False when this connection bypasses row-level security (superuser or BYPASSRLS), which makes every policy in migration 0005 inert. Reported on GET /api/status as projects.scopeEnforcement.';
