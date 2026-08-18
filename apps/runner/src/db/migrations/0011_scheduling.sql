-- 0011_scheduling.sql
--
-- The scheduling plane (ADR-024, `AGENTOS-V2-PLAN.md` Plan §14).
--
--   > Ofelia reads Docker labels on one host. It cannot express N projects, N execution hosts,
--   > catch-up after a sleeping laptop, timezone intent, budget refusal, or a UI. The
--   > coordinator owns the clock.
--
-- ## Why this is 0011 and not 0010, which is what the dispatch assigned
--
-- `apps/runner/src/db/migrations/` is the second shared-integer namespace in this repo
-- (`comms/decisions/README.md`) and it has been raced once already: `0006_ops_device.sql` and
-- `0006_identity.sql` were written from the same directory listing in the same minute.
--
-- M18's dispatch said *"`0010_` is yours and is assigned; `0009_` belongs to M17."* **BOARD.md
-- says otherwise, in writing:** M17's frame rules `0009_` to the `ops.agent_runs.thread_id`
-- `SET NOT NULL`, then *"M17's migration is therefore `0010_work_products.sql`, single author
-- `runner-engineer`"* and *"No second migration. `0010_` only."* Two claimants, one integer.
--
-- BOARD is the allocation authority for both namespaces, so this file took the number that is
-- above **every** claim written there. That is deliberately not the forbidden method — computing
-- next-free from a directory listing yields `0009_`, which is the one number that is definitely
-- someone else's. A gap at `0010_` costs nothing: `client.ts` applies in filename order and
-- records by filename, and nothing requires the integers be dense. Filed to
-- `commandcenter-orchestrator`; if the ruling comes back the other way this is a `git mv`,
-- because no migration in this repo has ever been applied to a live Postgres.
--
-- ## What this migration deliberately does NOT create
--
--   a clock          — **nothing here fires anything.** No occurrence is computed, no fire row
--                      is written, no run is started. These are two tables and a set of
--                      refusals. `Plan §14`'s scheduler process is a later slice.
--   ops.question     — **never.** A question is `ops.message.kind = 'question'` (ADR-023). The
--                      budget refusal below points at one by id; it does not invent a table.
--   ops.task         — **never.** A task is a thread with a due date (0008).
--   a second address — `kind` / `delivery` / `addressed_to` below are `thread-model.md` §3's
--                      grammar, column for column, with the same constraint shapes. A schedule
--                      that addressed threads differently from the composer would be two
--                      grammars for one act.
--   host concurrency — `Plan §14` detail 5's *per-host* ceiling is a property of a host, not of
--                      a schedule. It belongs with `ops.device` / compose and is not a column
--                      here. Per-schedule `jitter_seconds` is here because jitter is per job.
--   budget columns   — the cap is `ops.project.budget_monthly` (0005). A second copy of a money
--                      limit is how two numbers disagree.
--   any DELETE path  — erasure is destructive and is ADR-036's. See §5.
--
-- ## The honest half — what none of this enforces
--
-- **`ops.project.budget_monthly` has never refused anything.** It is declared and unenforced
-- (ADR-015 Q6), `apps/runner/src/lib/project.ts:261` returns `budgetMonthlyUsd: null`
-- unconditionally, Part V's workspace cap has never fired, and zero runs have ever executed.
-- `Plan §14`'s headline — *"a fire that would exceed the project cap does not run, it raises a
-- question"* — has a **place to be recorded** below (`state = 'skipped'`, `refusal_code`,
-- `question_message_id`) and **no mechanism that produces it.** Stated here rather than implied
-- by the presence of the columns, which is exactly how a declared value gets read as an
-- observed one.
--
-- Likewise: `source = 'library'` rows cannot be written today by anything.
-- `AgentFrontmatter.schedule` is a bare 5-field cron string carrying no timezone, no intent and
-- no policy, so it cannot satisfy the mandatory columns below. That is the intended outcome, not
-- an oversight — see §1's note on the six columns with no DEFAULT.

-- ---------------------------------------------------------------------------
-- 1. ops.schedule — one table, two authorities
-- ---------------------------------------------------------------------------
--
-- `Plan §14`: *"the coordinator reads `schedule:` on library sync and materializes `ops.schedule`
-- rows marked `source: library` (read-only in the UI, edited by PR). Ad-hoc schedules you create
-- in the app are `source: ops`. One table, two authorities, no ambiguity."*
--
-- Not two tables. The authority is a property of a row, and two tables means every reader, every
-- calendar query and every fire path has to union them — and the first one that forgets shows a
-- week grid with a schedule silently missing from it.
--
-- **Six columns are NOT NULL with no DEFAULT, and that is the load-bearing decision in this
-- file.** `missed_run_policy`, `overlap_policy`, `tz`, `follow_me`, `jitter_seconds` and
-- `auto_disable_after` are all questions with no safe answer: `skip` silently loses a briefing
-- and `catch_up_all` silently spends four figures on a laptop that slept a week, and those two
-- failures point in opposite directions. A DEFAULT would let a writer that never considered the
-- question look exactly like one that did.
--
-- **Graded from the other side, because that is the half M15 got wrong.** A NOT NULL the only
-- writer cannot satisfy is 0005's defect — four constraints the ledger writer never named, which
-- would have failed to record a run *after* the model was paid for. So:
--
--   * the `ops` writer CAN satisfy all of them: they are exactly the fields the save dialog
--     `Plan §14` describes has to collect anyway;
--   * the `library` writer CANNOT, because frontmatter's `schedule:` carries a cron and nothing
--     else — so **zero `source = 'library'` rows are writable today**, which is a visible empty
--     state rather than four invented policy values presented as an author's choices;
--   * the required set is named in code, not left to be rediscovered:
--     `SCHEDULE_REQUIRED_COLUMNS` in `packages/contracts/src/scheduling.ts`, asserted against
--     this file by `schedule-schema-pinning.test.ts` in both directions.

CREATE TABLE IF NOT EXISTS ops.schedule (
  id                    uuid PRIMARY KEY,

  -- The axis, first, and not nullable for one minute of this table's life (Plan §10).
  project_id            uuid NOT NULL,

  -- `library` = materialized from an agent's frontmatter, read-only in the UI, edited by PR.
  -- `ops`     = created in the app.
  -- BOARD rule 2 in one column: a schedule that exists only in Postgres and that frontmatter
  -- does not know about is a rule-2 violation, and this is what makes that statement checkable.
  source                text NOT NULL
                        CONSTRAINT schedule_source_known
                        CHECK (source IN ('library', 'ops')),

  -- Which agent's frontmatter a library row came from, project-relative (`{department}/{slug}`),
  -- so the PR that owns the row can be found from the row.
  library_ref           text,

  -- Plan §14's six trigger types. `cron` is one of six, not the shape of the table.
  trigger_kind          text NOT NULL
                        CONSTRAINT schedule_trigger_kind_known
                        CHECK (trigger_kind IN
                          ('cron', 'interval', 'event', 'condition', 'chain', 'manual')),

  -- Per-kind parameters: the cron expression, the interval, the connector + filter, the
  -- predicate, the upstream schedule. **An object, never prose** — 0008's PDPL rule 2, for the
  -- same reason: composed into a string first, key-based redaction stops reaching it, and an
  -- `event` spec holds a Gmail filter, which is somebody's correspondence.
  trigger_spec          jsonb NOT NULL
                        CONSTRAINT schedule_trigger_spec_is_object
                        CHECK (jsonb_typeof(trigger_spec) = 'object'),

  -- ---- The target. This is `thread-model.md` §3's grammar, not a second one. ----
  --
  -- Plan §14: *"schedules target threads, not only agents"*, so scheduling composes with §12's
  -- addressing for free — but only if it is literally the same grammar. Same three columns as
  -- `ops.thread`, same constraint shapes, one narrowing, stated below from both sides.
  kind                  text NOT NULL
                        CONSTRAINT schedule_kind_known
                        CHECK (kind IN ('agent', 'department', 'project')),

  -- **Narrower than `ops.thread.delivery`, deliberately: no `fan-out`, no `session`.**
  --
  -- `@@` dispatch is refused today until a cap has proven a refusal (`thread-model.md` §6.1),
  -- and that refusal is *interactive* — a human reads it while typing, and the composer has to
  -- name the count before it fires. A stored `@@` schedule fires unattended at 03:00 with nobody
  -- to read anything, so it is a row whose only reachable outcome is a nightly failure — and it
  -- is the most likely route by which `@@` gets quietly re-enabled, because a schedule that
  -- fails every night reads as a bug someone should fix. `session` is refused because a schedule
  -- cannot host a CLI.
  --
  -- Said from the permissive side, which is the side that gets forgotten: this CHECK means a
  -- perfectly legal address in `thread-model.md`'s grammar is **unstorable here**. That is a
  -- refusal with a stated reason, and `assertScheduleAddressable()` gives it a code and a
  -- sentence before the database is ever reached. The day the cap refuses something for real,
  -- widening this CHECK is one line and it is a reviewed line.
  --
  -- The literal `'default'` on this line is the live case for `writer-schema-agreement.test.ts`'s
  -- hardening: that test decides whether a column is mandatory by looking for the word DEFAULT
  -- in the column's definition text, so before it stripped string literals a NOT NULL column
  -- with this enum read as optional and stopped being checked, silently, in the permissive
  -- direction. `ops.thread.delivery` is the other case. Keeping this inline keeps the hardening
  -- load-bearing on real text.
  delivery              text NOT NULL
                        CONSTRAINT schedule_delivery_known
                        CHECK (delivery IN ('direct', 'dispatch', 'default')),

  -- Project-relative, exactly as `ops.thread.addressed_to` is and for the same reason:
  -- `project_id` is already this row's own column and two copies of one fact eventually
  -- disagree.
  addressed_to          text NOT NULL,

  -- ---- Time, with declared intent (Plan §14 detail 6) ----
  --
  -- An IANA zone name. NOT NULL with no DEFAULT: a server-local default is the bug this detail
  -- exists to prevent.
  tz                    text NOT NULL
                        CONSTRAINT schedule_tz_present
                        CHECK (length(tz) > 0),

  -- *"Should the 07:00 briefing track the timezone you are standing in, or stay on home time?
  -- Both are correct answers; only one is correct per job, and the system cannot guess."*
  -- So there is no DEFAULT, because a DEFAULT is the system guessing.
  follow_me             boolean NOT NULL,

  -- Plan §14 detail 5. Fourteen schedules at 09:00 is a rate-limit spike and a cost spike.
  -- Zero is a legitimate answer and is not the default one, because it is the answer that
  -- produces the spike.
  jitter_seconds        integer NOT NULL
                        CONSTRAINT schedule_jitter_sane
                        CHECK (jitter_seconds >= 0 AND jitter_seconds <= 3600),

  -- ---- The two mandatory policies (Plan §14 details 3 and 4) ----
  missed_run_policy     text NOT NULL
                        CONSTRAINT schedule_missed_run_policy_known
                        CHECK (missed_run_policy IN
                          ('skip', 'catch_up_once', 'catch_up_all', 'ask')),

  overlap_policy        text NOT NULL
                        CONSTRAINT schedule_overlap_policy_known
                        CHECK (overlap_policy IN
                          ('skip', 'queue', 'kill_previous', 'allow_parallel')),

  -- ---- The escalation ladder (Plan §14 detail 7) ----
  --
  -- *"retry with backoff, notify, auto-disable after N consecutive failures, loudly."* The
  -- counter genuinely starts at zero and a zero here is observed rather than declared, so it is
  -- the one DEFAULT in this group. N is not: three and thirty are both defensible and the
  -- difference is whether a broken job burns a week of tokens.
  enabled               boolean NOT NULL,
  auto_disable_after    integer NOT NULL
                        CONSTRAINT schedule_auto_disable_after_positive
                        CHECK (auto_disable_after > 0),
  consecutive_failures  integer NOT NULL DEFAULT 0
                        CONSTRAINT schedule_consecutive_failures_sane
                        CHECK (consecutive_failures >= 0),

  -- "Loudly" is the whole point of detail 7 — *"a job that has failed thirty nights running
  -- while nobody looked is how a system like this rots."* A disabled schedule with no reason is
  -- indistinguishable from one somebody turned off on purpose, so the reason is not optional.
  disabled_reason       text,

  -- ---- Expiry and review (Plan §14 detail 8) ----
  --
  -- **`until_at` is nullable and `review_at` is not, and the asymmetry is a decision.** The plan
  -- says *"every schedule carries `until:` and a review date"*. A review date can be derived by
  -- any writer at write time. An expiry cannot be invented for an agent whose frontmatter never
  -- declared one — and a NOT NULL the only writer cannot satisfy is 0005's defect. So the
  -- honesty moves to the quarterly sweep, which flags `until_at IS NULL` as well as a stale
  -- `review_at`, instead of to a constraint that would block the library path entirely.
  until_at              timestamptz,
  review_at             timestamptz NOT NULL,

  -- `human:{identity-slug}` · `agent:{department}/{slug}` · `system:{part}`.
  -- **`schedule:` is absent on purpose** — `ops.thread.created_by` allows it because a schedule
  -- creates threads; nothing in Plan §14 lets a schedule create a schedule, and a self-replicating
  -- timer is not a feature anyone asked for.
  created_by            text NOT NULL,

  created_at            timestamptz NOT NULL DEFAULT now(),

  -- A library row names its source file; an ops row must not, or "edited by PR" points nowhere.
  CONSTRAINT schedule_library_ref_matches_source
    CHECK ((source = 'library') = (library_ref IS NOT NULL)),

  -- Exactly the pairs that survive the narrowing above. Same shape as
  -- `thread_delivery_matches_kind`, so the two tables cannot drift into disagreeing about what
  -- `dispatch` means.
  CONSTRAINT schedule_delivery_matches_kind
    CHECK (
      (delivery = 'direct'   AND kind = 'agent')      OR
      (delivery = 'dispatch' AND kind = 'department') OR
      (delivery = 'default'  AND kind = 'project')
    ),

  -- Shape per kind, character for character with `thread_addressed_to_shape` minus the two
  -- refused kinds. The separator is written `[/]` rather than bare, and that is not style:
  -- `scripts/__tests__/identity-model.test.mjs` strips block comments across the **joined** text
  -- of every migration, `0005` line 448 contains a star-slash pair inside a comment, and a bare
  -- separator here would end the regex with the pair that closes a block comment nobody opened —
  -- silently deleting the rest of the file from that checker's view, in the permissive direction.
  CONSTRAINT schedule_addressed_to_shape
    CHECK (
      (kind = 'agent'      AND addressed_to ~ '^[a-z0-9]+(-[a-z0-9]+)*[/][a-z0-9]+(-[a-z0-9]+)*$') OR
      (kind = 'department' AND addressed_to ~ '^[a-z0-9]+(-[a-z0-9]+)*$')                        OR
      (kind = 'project'    AND addressed_to = 'chief-of-staff')
    ),

  CONSTRAINT schedule_library_ref_shape
    CHECK (library_ref IS NULL
           OR library_ref ~ '^[a-z0-9]+(-[a-z0-9]+)*[/][a-z0-9]+(-[a-z0-9]+)*$'),

  CONSTRAINT schedule_created_by_shape
    CHECK (created_by ~ '^(human|agent|system):.+'),

  CONSTRAINT schedule_disabled_names_a_reason
    CHECK (enabled OR disabled_reason IS NOT NULL),

  -- The composite target `ops.schedule_fire` pins both facts against, so a fire cannot be
  -- attributed to a schedule in another project by a WHERE clause somebody has to remember.
  -- This is the `in_reply_to` lesson from 0008, applied before the review rather than after it.
  UNIQUE (id, project_id)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'schedule_project_fk') THEN
    ALTER TABLE ops.schedule
      ADD CONSTRAINT schedule_project_fk
      FOREIGN KEY (project_id) REFERENCES ops.project(id) ON DELETE RESTRICT;
  END IF;
END $$;

COMMENT ON COLUMN ops.schedule.source IS
  'library = materialized from agent frontmatter on library sync, read-only in the UI, edited by '
  'PR. ops = created ad-hoc in the app. One table, two authorities (ADR-024). No library row is '
  'writable today: frontmatter''s schedule: is a bare cron and cannot satisfy this table''s '
  'mandatory policy columns.';

COMMENT ON COLUMN ops.schedule.delivery IS
  'Narrower than ops.thread.delivery: fan-out and session are refused. @@ dispatch is refused '
  'until a cap proves a refusal (thread-model.md 6.1) and that refusal is interactive; a stored '
  '@@ schedule fires unattended with nobody to read it.';

-- ---------------------------------------------------------------------------
-- 2. ops.schedule_fire — the row exists before the run does
-- ---------------------------------------------------------------------------
--
-- Plan §14 detail 1: *"`ops.schedule_fire` gets a row at the occurrence time, then transitions
-- `pending -> running -> done|failed|missed|skipped`. Fire-then-record makes 'never fired'
-- invisible, which is precisely the failure you most need to see."*
--
-- Detail 2: *"Idempotency key = `(schedule_id, occurrence_time)`. A coordinator restart
-- double-fires otherwise. This is the single most common scheduler bug in existence."*
--
-- Both are constraints below, not comments. `occurrence_time` is the **scheduled** instant, not
-- the actual one — jitter, catch-up and retry all move the actual instant, and if the key moved
-- with them it would not be a key.

CREATE TABLE IF NOT EXISTS ops.schedule_fire (
  id                    uuid PRIMARY KEY,

  schedule_id           uuid NOT NULL,

  -- Denormalised from the schedule and **pinned by a composite FK**, not by a comment. 0008's
  -- `in_reply_to` was the one reference in that migration not project-pinned, under a comment
  -- promising the opposite; it was the single FAIL item in M16's review.
  project_id            uuid NOT NULL,

  -- The instant the schedule was *due*. UTC. Jitter, catch-up and retry change when the run
  -- actually starts and never change this, which is what makes the key below stable.
  occurrence_time       timestamptz NOT NULL,

  -- No DEFAULT. A fire row is born `pending`, and a writer that never named the state should not
  -- be able to produce one that looks deliberate.
  state                 text NOT NULL,

  -- Whether this fire is a catch-up for an occurrence the host slept through (detail 3). A fact
  -- about how the row was derived; the writer always knows it and a DEFAULT would let a
  -- catch-up storm read as normal traffic on a graph.
  catch_up              boolean NOT NULL,

  -- **The retry ladder does not create a second fire row.** Detail 7's retry-with-backoff
  -- increments this; a second row would carry the same (schedule_id, occurrence_time) and defeat
  -- the key detail 2 exists to protect. Starts at zero because zero attempts have been made,
  -- which is observed rather than declared.
  attempts              integer NOT NULL DEFAULT 0
                        CONSTRAINT schedule_fire_attempts_sane
                        CHECK (attempts >= 0),

  -- When the row was written. The database's clock, deliberately: this is the value that makes
  -- "recorded before it ran" checkable rather than asserted.
  recorded_at           timestamptz NOT NULL DEFAULT now(),

  started_at            timestamptz,
  ended_at              timestamptz,

  -- The thread this fire created, once it created one. NULL while `pending` — Plan §12's *"a
  -- schedule creates threads"* is a statement about who calls `createThread`, and it has not
  -- been called yet at the moment this row is written. That ordering is the entire point.
  thread_id             uuid,

  -- Why a fire did not run. Carries the budget refusal (`budget_would_exceed_cap`), the overlap
  -- refusal and the missed-run skip. **Nothing writes it today**: see the header.
  refusal_code          text,

  -- *"A fire that would exceed the project cap does not run — it raises a question."* The
  -- question is an `ops.message` of kind `question` (ADR-023); there is no `ops.question` table
  -- and this migration does not add one.
  question_message_id   uuid,

  CONSTRAINT schedule_fire_state_known
    CHECK (state IN ('pending', 'running', 'done', 'failed', 'missed', 'skipped')),

  -- **Detail 1, as a mechanism.** If a writer ever inserts the row after starting the run, the
  -- row it writes will carry a `started_at` earlier than `recorded_at` and the database refuses
  -- it. A comment saying "record first" is a comment; this is the enforcer BRIEF asks for.
  CONSTRAINT schedule_fire_recorded_before_run
    CHECK (started_at IS NULL OR recorded_at <= started_at),

  CONSTRAINT schedule_fire_ends_after_it_starts
    CHECK (ended_at IS NULL OR (started_at IS NOT NULL AND started_at <= ended_at)),

  CONSTRAINT schedule_fire_pending_has_not_started
    CHECK (state <> 'pending' OR started_at IS NULL),

  CONSTRAINT schedule_fire_finished_has_an_end
    CHECK (state NOT IN ('done', 'failed') OR ended_at IS NOT NULL),

  -- A skip with no reason is the failure detail 1 is about, one level down: it is visible and
  -- says nothing. The budget refusal is the case that matters.
  CONSTRAINT schedule_fire_skip_names_a_reason
    CHECK (state <> 'skipped' OR refusal_code IS NOT NULL),

  -- **Detail 2.** A coordinator restart that re-derives occurrences hits this instead of
  -- starting a second paid run.
  CONSTRAINT schedule_fire_idempotent UNIQUE (schedule_id, occurrence_time)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'schedule_fire_schedule_fk') THEN
    ALTER TABLE ops.schedule_fire
      ADD CONSTRAINT schedule_fire_schedule_fk
      FOREIGN KEY (schedule_id, project_id)
      REFERENCES ops.schedule (id, project_id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'schedule_fire_project_fk') THEN
    ALTER TABLE ops.schedule_fire
      ADD CONSTRAINT schedule_fire_project_fk
      FOREIGN KEY (project_id) REFERENCES ops.project(id) ON DELETE RESTRICT;
  END IF;

  -- Project-pinned, like the two above. A fire cannot point at a thread in another project.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'schedule_fire_thread_fk') THEN
    ALTER TABLE ops.schedule_fire
      ADD CONSTRAINT schedule_fire_thread_fk
      FOREIGN KEY (thread_id, project_id)
      REFERENCES ops.thread (id, project_id) ON DELETE RESTRICT;
  END IF;

  -- Ditto for the question a refused fire raises. `ops.message` carries UNIQUE (id, project_id)
  -- for exactly this.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'schedule_fire_question_fk') THEN
    ALTER TABLE ops.schedule_fire
      ADD CONSTRAINT schedule_fire_question_fk
      FOREIGN KEY (question_message_id, project_id)
      REFERENCES ops.message (id, project_id) ON DELETE RESTRICT;
  END IF;
END $$;

-- The calendar's query (a week grid for one project) and the clock's query (what is due, and
-- what never ran). Both are project-first because every read in this repo is.
CREATE INDEX IF NOT EXISTS schedule_fire_by_project_time
  ON ops.schedule_fire (project_id, occurrence_time DESC);

CREATE INDEX IF NOT EXISTS schedule_fire_unfinished
  ON ops.schedule_fire (state, occurrence_time)
  WHERE state IN ('pending', 'running');

CREATE INDEX IF NOT EXISTS schedule_due_by_project
  ON ops.schedule (project_id, enabled, trigger_kind);

-- ---------------------------------------------------------------------------
-- 3. Row-level security — declared here, inert on this stack, and said so
-- ---------------------------------------------------------------------------
--
-- Same position as 0005 and 0008 (`thread-model.md` §8b): compose runs as the owner, so FORCE
-- RLS is the only reason these fire at all, and the enforcement that actually holds today is the
-- reader's own `WHERE project_id = $1`. The foreign keys above are the half that fires for every
-- role, including a superuser, which is why the project pinning is done with keys and not here.

ALTER TABLE ops.schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.schedule FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS schedule_project_scope ON ops.schedule;
CREATE POLICY schedule_project_scope ON ops.schedule
  USING (ops.project_visible(project_id))
  WITH CHECK (ops.project_visible(project_id));

ALTER TABLE ops.schedule_fire ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.schedule_fire FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS schedule_fire_project_scope ON ops.schedule_fire;
CREATE POLICY schedule_fire_project_scope ON ops.schedule_fire
  USING (ops.project_visible(project_id))
  WITH CHECK (ops.project_visible(project_id));

-- ---------------------------------------------------------------------------
-- 4. PDPL (Part VII.4) — where the free text is, and where it is not
-- ---------------------------------------------------------------------------
--
-- Neither table holds a message body. The two values that carry a person's words indirectly:
--
--   trigger_spec    An `event` trigger's filter is somebody's correspondence — a Gmail query, a
--                   Jira JQL, a path under an indexed root. Stored as an **object**, never
--                   composed into prose, because flattening defeats key-based redaction: as an
--                   object four keys redact, flattened into a sentence four of five leak. Found
--                   four times in one night during M15/M16.
--   disabled_reason Written by the escalation ladder, from a failure. **It must not carry the
--                   failing run's output.** There is no key rule that reaches a body inside an
--                   error string — BRIEF's flattening finding, third costume — so this is a
--                   requirement on the writer, which does not exist yet, and it is stated in
--                   `contracts/scheduling.md` §7 where the writer's author will read it.
--
-- Neither column may become a span attribute. `Plan §14`'s fire metrics are counts and states
-- and belong to `observability-engineer`; a `trigger_spec` in a trace is a Gmail filter in OTLP.

-- ---------------------------------------------------------------------------
-- 5. Retention and erasure — what is true, stated rather than implied
-- ---------------------------------------------------------------------------
--
-- `ops.prune` is **not** extended to either table, matching 0008's position. A fire ledger is
-- the record of what a machine did unattended while nobody was watching, which is the last thing
-- to delete by age. Retention is unbounded; erasure has no path here, as it has none anywhere in
-- this repo (ADR-036 carries tiers 1 and 2 and names the third that no DELETE verb reaches).
--
-- `ON DELETE RESTRICT` throughout, so a project with fire history cannot be deleted out from
-- under it (ADR-015 Q4). That is a refusal, not a cascade — a cascade here would make a project
-- deletion silently destroy the evidence of every unattended run it ever made.
