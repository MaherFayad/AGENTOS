-- 0002_app_agent_outputs.sql
--
-- The business-widget data plane (§2.5: "business widgets read Postgres rows agents
-- write"). Phase 1 dashboards are Langfuse-backed; these tables are what makes the
-- other six widget types light up as agents start producing structured output.
--
-- One generic table rather than a table per agent, because Part IV says frontmatter is
-- the single source of truth: a new agent must not require a migration. The shape of a
-- payload is the agent's business; the columns here are only what a panel needs to
-- filter, sort and attribute a row.
--
-- PDPL (Part VII.4): `payload` is written through the same redaction layer as traces.
-- An agent that needs to persist client PII needs an ADR and a lawful basis first —
-- not a JSONB column and a shrug.

CREATE SCHEMA IF NOT EXISTS app;

CREATE TABLE IF NOT EXISTS app.agent_outputs (
  id           bigserial PRIMARY KEY,
  -- Provenance: every business row traces to the run that produced it, and through
  -- run_id to a Langfuse trace. This is the join that makes a dashboard number
  -- answerable ("which run wrote this?").
  run_id       text REFERENCES ops.agent_runs(run_id) ON DELETE SET NULL,
  agent        text NOT NULL,
  department   text NOT NULL,
  -- Logical row type, e.g. 'deal', 'engagement', 'spend_line', 'content_item'.
  -- Named queries filter on this; panels never see it directly.
  kind         text NOT NULL,
  -- Business identity, so a re-run updates a row instead of duplicating it.
  entity_key   text,
  occurred_at  timestamptz NOT NULL DEFAULT now(),
  payload      jsonb NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Upsert target: one row per (kind, entity_key) when the agent supplies a key.
CREATE UNIQUE INDEX IF NOT EXISTS agent_outputs_identity_idx
  ON app.agent_outputs (kind, entity_key)
  WHERE entity_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS agent_outputs_kind_time_idx ON app.agent_outputs (kind, occurred_at DESC);
CREATE INDEX IF NOT EXISTS agent_outputs_department_idx ON app.agent_outputs (department, occurred_at DESC);
CREATE INDEX IF NOT EXISTS agent_outputs_payload_idx ON app.agent_outputs USING gin (payload jsonb_path_ops);

CREATE OR REPLACE FUNCTION app.touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS agent_outputs_touch ON app.agent_outputs;
CREATE TRIGGER agent_outputs_touch
  BEFORE UPDATE ON app.agent_outputs
  FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

COMMENT ON TABLE app.agent_outputs IS
  'Structured agent output. Read only through the named-query registry in apps/runner/src/db/registry.ts — a panel can never carry raw SQL (panel-schema contract).';
COMMENT ON COLUMN app.agent_outputs.run_id IS
  'The run that wrote this row. Every business number is traceable back to a real run.';
