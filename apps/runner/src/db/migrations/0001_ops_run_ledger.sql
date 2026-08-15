-- 0001_ops_run_ledger.sql
--
-- The run ledger: one row per runner invocation (§3.2 → §3.5).
--
-- This table is the source of truth for every number the product renders — the cost
-- ticker (§2.0), the LIVE counter (§2.0/§2.2), LAST RUNS (§2.3), the KPI tiles and the
-- activity feed (§2.5). Langfuse holds the narrative trace for drill-down; it does not
-- hold anything a dashboard reads, so a Langfuse outage degrades exactly one feature
-- (the trace link) instead of blanking the product.
--
-- PDPL (Part VII.4): every text column here has already been through the redaction
-- layer. Nothing in this schema is a place to put client PII, and there is no column
-- for run inputs — inputs live only in the trace, redacted.

CREATE SCHEMA IF NOT EXISTS ops;

CREATE TABLE IF NOT EXISTS ops.agent_runs (
  run_id            text PRIMARY KEY,
  trace_id          text NOT NULL,
  trace_url         text NOT NULL,

  agent             text NOT NULL,          -- 'sales/account-enrichment'
  agent_name        text,                   -- display name, for the activity feed
  department        text NOT NULL,          -- ADR-001 slug, denormalised on purpose
  model             text,

  trigger           text NOT NULL CHECK (trigger IN ('manual','schedule','api','audit')),
  session_id        text,
  dry_run           boolean NOT NULL DEFAULT false,

  status            text NOT NULL CHECK (status IN ('ok','error','cancelled','awaiting-approval')),
  started_at        timestamptz NOT NULL,
  ended_at          timestamptz,
  duration_ms       integer,

  input_tokens        integer NOT NULL DEFAULT 0,
  output_tokens       integer NOT NULL DEFAULT 0,
  cache_read_tokens   integer NOT NULL DEFAULT 0,
  cache_write_tokens  integer NOT NULL DEFAULT 0,

  -- NULL means "we do not know what this cost", never "it was free" (Part VII.3).
  cost_usd          numeric(12,6),
  cost_source       text NOT NULL CHECK (cost_source IN ('sdk','derived','unpriced')),

  tool_call_count   integer NOT NULL DEFAULT 0,
  error_count       integer NOT NULL DEFAULT 0,
  redaction_count   integer NOT NULL DEFAULT 0,

  activity_event    text,                   -- bold clause of the feed row (§2.5)
  activity_detail   text,                   -- --ink-2 continuation
  error             text,                   -- redacted message when status='error'

  created_at        timestamptz NOT NULL DEFAULT now(),

  -- A costed run must say where the number came from, and an unpriced run must not
  -- carry a number. This constraint is the schema-level form of standing rule 9.
  CONSTRAINT cost_provenance CHECK (
    (cost_source = 'unpriced' AND cost_usd IS NULL) OR
    (cost_source <> 'unpriced' AND cost_usd IS NOT NULL)
  )
);

-- Cost ticker and time-window metrics: every metric query filters on started_at.
CREATE INDEX IF NOT EXISTS agent_runs_started_at_idx ON ops.agent_runs (started_at DESC);
-- LAST RUNS and per-agent KPI filters.
CREATE INDEX IF NOT EXISTS agent_runs_agent_started_idx ON ops.agent_runs (agent, started_at DESC);
-- Per-department LIVE counts and department-scoped panels.
CREATE INDEX IF NOT EXISTS agent_runs_department_started_idx ON ops.agent_runs (department, started_at DESC);
-- Status derivation walks successful runs per agent.
CREATE INDEX IF NOT EXISTS agent_runs_status_idx ON ops.agent_runs (status, agent);

-- One row per tool call, so a drawer row can expand into what the run actually did.
CREATE TABLE IF NOT EXISTS ops.agent_run_tools (
  run_id      text NOT NULL REFERENCES ops.agent_runs(run_id) ON DELETE CASCADE,
  span_id     text NOT NULL,
  seq         integer NOT NULL,
  name        text NOT NULL,
  status      text NOT NULL CHECK (status IN ('ok','error')),
  started_at  timestamptz NOT NULL,
  duration_ms integer NOT NULL,
  error       text,
  PRIMARY KEY (run_id, seq)
);

CREATE INDEX IF NOT EXISTS agent_run_tools_name_idx ON ops.agent_run_tools (name, started_at DESC);

COMMENT ON TABLE ops.agent_runs IS
  'Run ledger. Source of truth for cost ticker, LIVE counter, LAST RUNS, KPI tiles and activity feed. Owner: observability-engineer (spec 3.5).';
COMMENT ON COLUMN ops.agent_runs.cost_usd IS
  'NULL = unknown cost. Never substitute 0; an honest empty state beats a plausible fake one (Part VII.3).';
COMMENT ON COLUMN ops.agent_runs.dry_run IS
  'Dry runs are traced but excluded from cost, LIVE and status derivation.';
