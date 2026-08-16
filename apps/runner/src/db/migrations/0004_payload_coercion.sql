-- 0004_payload_coercion.sql
--
-- The two functions the named-query registry has always assumed existed.
--
-- `app.agent_outputs.payload` is JSONB written by an agent, so `payload->>'value'` is
-- `text` no matter what the agent meant. Every business query in
-- `apps/runner/src/db/registry.ts` that sums a number or windows on a timestamp goes
-- through `safe_num` / `safe_ts` to get from that text to a typed value. Roughly thirty
-- registered queries call them.
--
-- They were referenced by the registry from the day it was written and defined nowhere:
-- not in a migration, not in the database. Every one of those queries returned 503
-- (`function safe_num(text) does not exist`) the first time a real Postgres saw them,
-- which was months after they were written, because a stubbed DbClient never parses SQL.
-- Same root cause as the `make_interval` bug in `queries.ts`, found in the same hour.
--
-- Why "safe": an agent writes a payload; a payload is not validated SQL input. One
-- malformed timestamp in one row must not blank a whole dashboard with a cast error, so
-- an unparseable value becomes NULL and the row drops out of the aggregate. The widget
-- then shows a number that is short rather than an error that is total — and `rows` /
-- `unvalued` in the query results are how a caller sees that it was short.
--
-- IMMUTABLE and PARALLEL SAFE: both are pure text -> value coercions with no catalog
-- reads that vary, so the planner may fold them into index conditions. STRICT so NULL
-- in is NULL out without entering the block.

CREATE SCHEMA IF NOT EXISTS app;

-- text -> double precision, NULL when it is not a number.
CREATE OR REPLACE FUNCTION app.safe_num(value text)
RETURNS double precision
LANGUAGE plpgsql IMMUTABLE STRICT PARALLEL SAFE AS $$
BEGIN
  RETURN value::double precision;
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
  RETURN NULL;
END;
$$;

-- text -> timestamptz, NULL when it is not a timestamp.
--
-- A bare 'YYYY-MM-DD' or a timestamp with no zone is resolved against the server
-- TimeZone, which compose pins to UTC. An agent that means a specific instant should
-- write ISO 8601 with an offset; this is the documented expectation for every
-- timestamp field in the write contract (`needs.fields` in registry.ts).
CREATE OR REPLACE FUNCTION app.safe_ts(value text)
RETURNS timestamptz
LANGUAGE plpgsql IMMUTABLE STRICT PARALLEL SAFE AS $$
BEGIN
  RETURN value::timestamptz;
EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION app.safe_num(text) IS
  'JSONB payload text -> float8, NULL on garbage. One bad row must not error a whole widget.';
COMMENT ON FUNCTION app.safe_ts(text) IS
  'JSONB payload text -> timestamptz, NULL on garbage. One bad row must not error a whole widget.';
