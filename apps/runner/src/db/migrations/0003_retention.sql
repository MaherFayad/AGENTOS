-- 0003_retention.sql
--
-- Retention (ADR-005). Traces are cheap until they aren't; the point of writing the
-- window down is that the volume never becomes the thing that forces the decision.
--
-- Defaults, pending the human's confirmation in ADR-005:
--   ops.agent_run_tools   90 days   — span detail; the expensive rows
--   ops.agent_runs       400 days   — the ledger; a year plus a comparison window
--   ops.agent_run_daily  forever    — the rollup, so history survives the prune
--   app.agent_outputs    not pruned — business rows are the agent's product, not telemetry
--
-- Langfuse has its own retention setting; it is configured to the same 90 days as the
-- span table so the two stores never disagree about what still exists.

-- Daily rollup, written before anything is pruned. Keeping this means the cost ticker's
-- history and the KPI deltas survive retention: we lose the ability to drill into an
-- old run, not the ability to say what last quarter cost.
CREATE TABLE IF NOT EXISTS ops.agent_run_daily (
  day               date NOT NULL,
  agent             text NOT NULL,
  department        text NOT NULL,
  runs              integer NOT NULL,
  errors            integer NOT NULL,
  cost_usd          numeric(12,6),
  unpriced_runs     integer NOT NULL,
  total_duration_ms bigint NOT NULL,
  PRIMARY KEY (day, agent)
);

CREATE OR REPLACE FUNCTION ops.rollup_runs(target_day date)
RETURNS integer AS $$
DECLARE
  affected integer;
BEGIN
  INSERT INTO ops.agent_run_daily AS d
    (day, agent, department, runs, errors, cost_usd, unpriced_runs, total_duration_ms)
  SELECT
    target_day,
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
  GROUP BY agent
  ON CONFLICT (day, agent) DO UPDATE SET
    department        = EXCLUDED.department,
    runs              = EXCLUDED.runs,
    errors            = EXCLUDED.errors,
    cost_usd          = EXCLUDED.cost_usd,
    unpriced_runs     = EXCLUDED.unpriced_runs,
    total_duration_ms = EXCLUDED.total_duration_ms;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$ LANGUAGE plpgsql;

-- Prune. Rolls up anything not yet rolled up before deleting, so a prune can never
-- silently drop a day of history that no aggregate covers.
CREATE OR REPLACE FUNCTION ops.prune(
  span_retention_days integer DEFAULT 90,
  run_retention_days  integer DEFAULT 400
) RETURNS TABLE (spans_deleted bigint, runs_deleted bigint) AS $$
DECLARE
  d date;
BEGIN
  FOR d IN
    SELECT DISTINCT started_at::date
    FROM ops.agent_runs
    WHERE started_at < now() - make_interval(days => span_retention_days)
  LOOP
    PERFORM ops.rollup_runs(d);
  END LOOP;

  WITH gone AS (
    DELETE FROM ops.agent_run_tools t
    USING ops.agent_runs r
    WHERE t.run_id = r.run_id
      AND r.started_at < now() - make_interval(days => span_retention_days)
    RETURNING 1
  )
  SELECT count(*) INTO spans_deleted FROM gone;

  WITH gone AS (
    DELETE FROM ops.agent_runs
    WHERE started_at < now() - make_interval(days => run_retention_days)
    RETURNING 1
  )
  SELECT count(*) INTO runs_deleted FROM gone;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION ops.prune IS
  'Retention per ADR-005. Called by the nightly ofelia job; never on the request path.';
