-- 0008_threads.sql
--
-- The thread plane (ADR-023, `AGENTOS-V2-PLAN.md` Plan §12).
--
--   > A thread is the unit. A run is a thread with an agent on the other end. A session is a
--   > thread hosted by a CLI. A task is a thread with a due date. A schedule creates threads.
--
-- ## Why this is 0008, and the namespace rule it is obeying
--
-- `apps/runner/src/db/migrations/` is the **second** shared-integer namespace in this repo
-- (`comms/decisions/README.md`), and it has already been raced once: `0006_ops_device.sql` and
-- `0006_identity.sql` were written from the same directory listing in the same minute. So
-- `0008_` was **claimed on BOARD when M16 was framed**, before this file existed, exactly as
-- an ADR number is. It was not computed from a listing. `client.ts` applies migrations in
-- **filename order** and records them by filename, which is why two files sharing a number
-- both run in an order decided by whatever text follows the digits.
--
-- ## `ops.run_ledger` is spelled `ops.agent_runs`
--
-- `Plan §12` says *"`ops.run_ledger` gains `thread_id`"*. There is no table of that name; the
-- run ledger is `ops.agent_runs` (migration 0001) and `ops.run_ledger` is the plan's prose
-- name for it — the same shorthand `agent-cascade.md` §2 uses. §4 below alters the real table.
-- Written down here because a reader following the plan literally finds nothing.
--
-- ## What this migration deliberately does NOT create
--
--   ops.task      — **never.** A task IS a thread with `due_at` (Plan §19). M11's parallel
--                   entity model is absorbed, not built. There is no second board table.
--   ops.question  — **never.** A question IS a message kind, `ops.message.kind = 'question'`,
--                   and `expires_at` is mandatory on it (Plan §12).
--   ops.schedule  — M18's (`scheduler-engineer`, Plan §14). "A schedule creates threads" is a
--                   statement about who calls `createThread`, not a column here.
--   any DELETE path — see §6. Erasure is destructive and needs its own ADR.
--
-- ## PDPL (Part VII.4) — `ops.message.body` is the highest-PII surface in this database
--
-- Every other table holds identifiers, mounts, counts and the names of secrets.
-- `ops.message.body` holds **free text a human typed**, which is the one thing no schema can
-- constrain. Three rules bind, and each is a mechanism somewhere:
--
--   1. **Redact at instrumentation, not after.** The body is stored verbatim — it is the
--      record, and a redacted record is not one — and it **never becomes a span attribute**.
--      `messageSpanAttributes()` in `packages/contracts/src/threads.ts` is a type with no
--      `body` field, so there is nothing downstream to forget.
--   2. **Flattening defeats key-based redaction.** Structured content goes in `payload jsonb`
--      as an *object*. Composed into prose first, four of five denylisted keys survive
--      (`observability/redact.ts`, found three times in one night during M15). Compose at
--      display, never before storage.
--   3. **Session content never lands here.** §3's composite foreign key makes a message on a
--      `session` thread refusable by the database rather than by a reviewer. CLAUDE.md rule 5.
--
-- ## PDPL, the honest half — erasure
--
-- **There is no delete verb on any plane in this repo, and this migration does not add one.**
-- The only erasure unit this architecture can execute is the *project*, and deleting a project
-- is itself refused while any history hangs off it (ADR-015 Q4, `ON DELETE RESTRICT`). So
-- right-to-erasure over `ops.message` is **not executable today**. That is a stated gap with a
-- named owner (`rtl-arabic-pdpl-specialist`, `contracts/thread-model.md` §9.3), not a promise
-- this file quietly implies by having a table.

-- ---------------------------------------------------------------------------
-- 1. ops.thread
-- ---------------------------------------------------------------------------
--
-- Project-scoped **from the first migration that creates it** (Plan §10). Retrofitting a
-- project column onto a live conversation table is the expensive version of this work, and
-- 0005 is the receipt: it had to backfill, re-key a rollup and drop a unique index that had
-- been merging two clients' rows.
--
-- One finding fell out of writing this table and is recorded where it happened.
-- `writer-schema-agreement.test.ts` decides whether a column is mandatory by looking for the
-- word `DEFAULT` in the column's definition text — and `CHECK (delivery IN (…, 'default', …))`
-- puts that word on the line. A NOT NULL column with an enum containing the value 'default'
-- therefore read as *optional*, and every insert stopped being checked for it, silently, in
-- the permissive direction. The test now strips string literals before that test, and
-- `ops.thread.delivery` is the live case it is asserted against. Filed to that file's owner.

CREATE TABLE IF NOT EXISTS ops.thread (
  id                uuid PRIMARY KEY,

  -- The axis, first, and not nullable for one minute of this table's life.
  project_id        uuid NOT NULL,

  -- Plan §12's four kinds, verbatim.
  kind              text NOT NULL,

  -- **The column Plan §12 does not name and the schema cannot do without.**
  --
  -- `#sales` and `@@sales` both produce a thread of kind `department`. They differ in exactly
  -- one fact — one costs a run and the other costs N — and the plan spends a paragraph on it:
  -- *"one costs one run and the other costs six."* A schema that cannot tell a $1 action from
  -- a $6 action has dropped the thing that paragraph exists to protect. So the delivery mode
  -- is stored, and `thread_delivery_matches_kind` pins it to `kind` so the two cannot drift —
  -- the same shape as 0005's `account_provenance`.
  --
  -- **This CHECK is deliberately on the column line, and it is a live trap.** It contains the
  -- literal `'default'`, and `writer-schema-agreement.test.ts` decided whether a column was
  -- mandatory by looking for the word `DEFAULT` in the column's definition text — so before
  -- that test was hardened, this NOT NULL column read as optional and quietly stopped being
  -- checked. Leaving it inline keeps the hardening load-bearing on real text instead of on a
  -- hypothetical: `ops.thread.delivery` is asserted required in that file's negative controls,
  -- next to the `ops.device.identity_id`-in-a-comment trap it already carries.
  delivery          text NOT NULL
                    CONSTRAINT thread_delivery_known
                    CHECK (delivery IN ('direct', 'dispatch', 'fan-out', 'default', 'session')),

  -- **Project-relative**, because `project_id` is right there. `agent_ref`'s `{project}/…`
  -- prefix would be a second copy of one fact, and 0005 could only keep both because a CHECK
  -- could pin them within one row; that is not available across tables, so the redundancy is
  -- removed instead. Shapes per kind are in `thread_addressed_to_shape`.
  addressed_to      text NOT NULL,

  -- No DEFAULT, deliberately. An agent thread opens `open`; a session thread opens `running`.
  -- A default would let a writer that never thought about it look like one that did.
  state             text NOT NULL,

  -- Fan-out's N children hang off their parent here, which is what makes "you see N answers
  -- side by side" one query. Also how a dispatch that delegates records the delegation.
  parent_thread_id  uuid,

  -- `human:{identity-slug}` · `agent:{department}/{slug}` · `schedule:{id}` · `system:{part}`.
  created_by        text NOT NULL,

  -- **A task is a thread with a due date** (Plan §19). There is no second entity.
  due_at            timestamptz,

  -- A *preference*, never the authority. The run's own `(account_id, account_source)` pair on
  -- ops.agent_runs is what answers "who paid" — including the named `unattributed` state that
  -- a NULL here must never be read as (0005 §4a, ADR-015 Q20).
  account_id        uuid,

  created_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT thread_kind_known
    CHECK (kind IN ('agent', 'department', 'project', 'session')),

  -- Exactly the pairs `DELIVERY_KIND` declares in `packages/contracts/src/threads.ts`.
  -- `thread-address.test.ts` reads this file and asserts the two agree.
  CONSTRAINT thread_delivery_matches_kind
    CHECK (
      (delivery = 'direct'   AND kind = 'agent')      OR
      (delivery = 'dispatch' AND kind = 'department') OR
      (delivery = 'fan-out'  AND kind = 'department') OR
      (delivery = 'default'  AND kind = 'project')    OR
      (delivery = 'session'  AND kind = 'session')
    ),

  CONSTRAINT thread_state_known
    CHECK (state IN ('open', 'running', 'waiting', 'closed', 'failed')),

  -- Shape per kind. `chief-of-staff` is the project's default recipient (Plan §12: *"(no
  -- address) — Chief of Staff, the project-level default recipient"*). **It is an address, not
  -- an agent**: M16 defines where a bare message goes; the router that answers it is M22's
  -- (Plan §17). A `project` thread is therefore creatable and its dispatch is refused with a
  -- stated reason, which beats an address that quietly becomes something else.
  -- The separator is written `[/]` rather than bare, and that is not a style choice.
  --
  -- Written bare, the regex ends `…)` star slash — the two characters that close a C-style
  -- block comment. `scripts/__tests__/identity-model.test.mjs` strips block comments across the
  -- **joined** text of every migration, and `0005` line 448 contains `/api/all/` star inside a
  -- comment. So the first closing pair anywhere after it closes a block comment that was never
  -- opened, silently deleting all of 0006, 0007 and most of 0008 from that checker's view — and
  -- taking `INSERT INTO ops.identity` with it. The gate went red in another agent's test, about
  -- a table this file does not touch, and the first written explanation of the bug re-armed it,
  -- because that strip runs **before** the line-comment strip. `[/]` is the same regex with no
  -- accidental token, and this comment names the pair rather than spelling it.
  --
  -- Routed to `identity-access-engineer`: the next migration to put that pair in any literal
  -- re-arms it, and the damage is permissive elsewhere in that file — a swallowed table body
  -- makes a "this column must not exist" assertion pass for the wrong reason.
  CONSTRAINT thread_addressed_to_shape
    CHECK (
      (kind = 'agent'      AND addressed_to ~ '^[a-z0-9]+(-[a-z0-9]+)*[/][a-z0-9]+(-[a-z0-9]+)*$') OR
      (kind = 'department' AND addressed_to ~ '^[a-z0-9]+(-[a-z0-9]+)*$')                        OR
      (kind = 'project'    AND addressed_to = 'chief-of-staff')                                  OR
      (kind = 'session'    AND length(addressed_to) > 0)
    ),

  CONSTRAINT thread_created_by_shape
    CHECK (created_by ~ '^(human|agent|schedule|system):.+'),

  -- A thread cannot be its own parent. Deeper cycles need a trigger and are **not** enforced
  -- here — said plainly, because "this table has no cycle check" and "someone forgot the cycle
  -- check" look identical in a schema dump.
  CONSTRAINT thread_parent_is_not_self
    CHECK (parent_thread_id IS DISTINCT FROM id),

  -- Two composite targets, so that other tables can pin *both* facts by foreign key rather
  -- than by a WHERE clause someone has to remember. An index on a primary-key column plus one
  -- more is close to free; a message attributed to the wrong client is not.
  UNIQUE (id, project_id),
  UNIQUE (id, project_id, kind)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'thread_project_fk') THEN
    ALTER TABLE ops.thread
      ADD CONSTRAINT thread_project_fk
      FOREIGN KEY (project_id) REFERENCES ops.project(id) ON DELETE RESTRICT;
  END IF;

  -- A child thread cannot live in a different project from its parent. Composite, so the
  -- database refuses it rather than a reviewer noticing it — a fan-out whose children landed
  -- in another project would be one client's question answered in another client's context.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'thread_parent_fk') THEN
    ALTER TABLE ops.thread
      ADD CONSTRAINT thread_parent_fk
      FOREIGN KEY (parent_thread_id, project_id) REFERENCES ops.thread (id, project_id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'thread_account_fk') THEN
    ALTER TABLE ops.thread
      ADD CONSTRAINT thread_account_fk
      FOREIGN KEY (account_id) REFERENCES ops.billing_account(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- THREADS lists by project and state; the board reads due dates; fan-out reads children.
CREATE INDEX IF NOT EXISTS thread_project_state_idx
  ON ops.thread (project_id, state, created_at DESC);
CREATE INDEX IF NOT EXISTS thread_project_addressed_idx
  ON ops.thread (project_id, addressed_to, created_at DESC);
CREATE INDEX IF NOT EXISTS thread_parent_idx
  ON ops.thread (parent_thread_id) WHERE parent_thread_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS thread_due_idx
  ON ops.thread (project_id, due_at) WHERE due_at IS NOT NULL;

COMMENT ON TABLE ops.thread IS
  'The unit (Plan §12, ADR-023). A run is a thread with an agent on the other end; a session is a thread hosted by a CLI; a task is a thread with a due date. There is no ops.task and no ops.question. Owner: thread-model-engineer.';
COMMENT ON COLUMN ops.thread.delivery IS
  'direct(1 run) | dispatch(>=1) | fan-out(N) | default | session. Stored rather than inferred because #sales and @@sales are the same kind and different money (Plan §12).';
COMMENT ON COLUMN ops.thread.addressed_to IS
  'Project-relative address: {department}/{slug} | {department} | chief-of-staff | session id. The project lives in project_id and is deliberately not repeated here.';
COMMENT ON COLUMN ops.thread.due_at IS
  'A task is a thread with a due date (Plan §19). M11''s parallel task entity is absorbed, not built.';
COMMENT ON COLUMN ops.thread.account_id IS
  'A preference recorded at creation. Never the authority on who paid — that is ops.agent_runs.(account_id, account_source), whose third value is the named state unattributed.';

-- ---------------------------------------------------------------------------
-- 2. ops.message — the mailbox is a predicate, not a table
-- ---------------------------------------------------------------------------
--
-- `Plan §12`: *every thread has a mailbox; every running agent drains it at tool boundaries.*
-- The mailbox is `WHERE delivered_at IS NULL`, ordered by `seq`. One place the messages live,
-- one place the agent reads them, and no second entity that can fall out of step with the
-- first — which is the same argument that deleted `ops.question`.
--
-- `expires_at` is **mandatory on a question** and that is a constraint, not a convention: a run
-- blocked forever on a question nobody saw looks idle, holds a slot, and delivers nothing. On
-- expiry the thread fails loudly with `question_unanswered`.

CREATE TABLE IF NOT EXISTS ops.message (
  id            uuid PRIMARY KEY,

  thread_id     uuid NOT NULL,

  -- Denormalised from the thread — and **pinned by a composite foreign key**, not by a
  -- convention. 0005 refused a second project column on `ops.agent_run_tools` on the grounds
  -- that two copies of one fact eventually disagree, and borrowed the parent's RLS policy
  -- instead. That argument is exactly right where the copies cannot be pinned. Here they can:
  -- `message_thread_fk` below references `ops.thread (id, project_id, kind)`, so a message
  -- claiming the wrong project or the wrong kind **fails to insert**. That buys the direct RLS
  -- predicate (§5) — an unscoped read of this table raises on its own column rather than
  -- through a join — on the one table in this database where a leak is free text a person
  -- typed.
  project_id    uuid NOT NULL,
  thread_kind   text NOT NULL,

  -- Monotonic within a thread, derived in SQL from the thread's own rows. `UNIQUE (thread_id,
  -- seq)` means two concurrent appends collide loudly instead of producing two message #4s;
  -- retrying a unique violation is a caller's problem, silently mis-ordering a conversation is
  -- nobody's until it is read.
  seq           integer NOT NULL,

  kind          text NOT NULL,

  -- note | steer | halt, declared by the sender. Present exactly when the kind is one a person
  -- sent — an agent's own output declares no interrupt level. `message_interrupt_matches_kind`
  -- makes that an equality rather than a habit.
  interrupt     text,

  author        text NOT NULL,

  -- **Free text a human typed. The highest-PII value in this database.** Stored verbatim
  -- because it is the record; never traced, never pushed. See the header.
  body          text NOT NULL,

  -- An object, never pre-flattened prose. Flattening is how content gets past key-based
  -- redaction (`observability/redact.ts`).
  payload       jsonb,

  in_reply_to   uuid,

  -- Mandatory on a question. See `message_question_expires`.
  expires_at    timestamptz,

  -- When a running agent drained it at a tool boundary. NULL means it is still in the mailbox.
  delivered_at  timestamptz,

  created_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT message_kind_known
    CHECK (kind IN ('human', 'agent', 'question', 'answer', 'system')),

  CONSTRAINT message_interrupt_known
    CHECK (interrupt IS NULL OR interrupt IN ('note', 'steer', 'halt')),

  -- An equality, both directions. A human message with no declared level, and an agent message
  -- carrying one, are both wrong and both silent.
  CONSTRAINT message_interrupt_matches_kind
    CHECK ((kind IN ('human', 'answer')) = (interrupt IS NOT NULL)),

  -- The mandatory expiry, in the only form that survives a schema dump.
  CONSTRAINT message_question_expires
    CHECK ((kind = 'question') = (expires_at IS NOT NULL)),

  -- An answer answers something. Without this, `answer` is a label rather than a link, and the
  -- question it settles is a guess made by reading timestamps.
  CONSTRAINT message_answer_replies
    CHECK ((kind = 'answer') = (in_reply_to IS NOT NULL)),

  -- **Session content does not live here, and the database is what says so.**
  --
  -- A session thread's conversation is end-to-end encrypted and the server must never hold its
  -- plaintext (spec §3.1, CLAUDE.md rule 5). `thread_kind` is FK-pinned to the thread's real
  -- kind, so this one line makes "store a session's messages in Postgres" impossible rather
  -- than discouraged. Steering a session stays `POST /api/sessions/:id/input`, which is
  -- already E2E, and whether session interrupts ever join this mailbox is an open question
  -- routed to `sessions-relay-engineer` (`thread-model.md` §9.1) — deliberately unanswered,
  -- because dropping a CHECK later is reviewable and un-leaking a body is not.
  CONSTRAINT message_never_holds_session_content
    CHECK (thread_kind <> 'session'),

  CONSTRAINT message_author_shape
    CHECK (author ~ '^(human|agent|system):.+'),

  UNIQUE (thread_id, seq),

  -- **The FK target that makes `in_reply_to` project-pinned.** Same device as `ops.thread`'s
  -- `UNIQUE (id, project_id)` above and for the same reason: a composite foreign key needs a
  -- unique constraint covering exactly the columns it references, so this line is not a
  -- uniqueness requirement anyone asked for — `id` is already the primary key — it is the
  -- handle a project-pinned self-reference has to grab. Without it the constraint below is a
  -- migration that fails to apply, which on a stack where no migration has ever been applied
  -- is a failure nothing observes. `threads-schema-pinning.test.ts` asserts both halves.
  UNIQUE (id, project_id)
);

DO $$
BEGIN
  -- Three facts pinned in one constraint: the thread exists, the project agrees with it, and
  -- the kind agrees with it. A message cannot be attributed to another client's thread.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'message_thread_fk') THEN
    ALTER TABLE ops.message
      ADD CONSTRAINT message_thread_fk
      FOREIGN KEY (thread_id, project_id, thread_kind)
      REFERENCES ops.thread (id, project_id, kind) ON DELETE RESTRICT;
  END IF;

  -- **`in_reply_to` is project-pinned, and it was not always.**
  --
  -- This was the one reference in this migration that named a single column, in the file whose
  -- whole subject is that a row cannot cross a project. `FOREIGN KEY (in_reply_to) REFERENCES
  -- ops.message(id)` accepts **any** message id in the table, including one in another project,
  -- and `in_reply_to` is reachable end to end from a caller-supplied `inReplyTo` on the route.
  -- So a message in project A could be declared a reply to a message in project B, nine lines
  -- under a comment claiming "a message cannot be attributed to another client's thread".
  --
  -- What crossed was a *reference*, not a body — `readMessages` is project-scoped, so the
  -- pointer rendered unresolvable rather than as another client's text. That is why this was one
  -- finding rather than a Part VII incident. It was still a `project_id`-crossing row in the
  -- table this milestone exists to make un-crossable. Found by `fidelity-qa-reviewer`, M16
  -- foundation verdict.
  --
  -- It is the same family as `thread-model.md` §4.1's inert-RLS argument, one level down: **a
  -- comment asserting an invariant that the constraint beneath it does not enforce.** And it is
  -- BRIEF's *grade a constraint from both sides* pointed the other way — M15's defect was a
  -- `NOT NULL` nobody could satisfy; this was a constraint satisfiable by rows that should not
  -- exist. Both are invisible in a schema dump.
  --
  -- **Two things this deliberately does not do.**
  --
  -- 1. **No `NOT NULL` on `in_reply_to`.** A first message replies to nothing, and the column is
  --    legitimately null for every kind but `answer` (`message_answer_replies` already makes
  --    that an equality). The FK is left at the default `MATCH SIMPLE`, under which a row with a
  --    NULL in any referencing column satisfies the constraint — so nullability survives the
  --    pinning. `MATCH FULL` would be the trap: `project_id` is `NOT NULL`, so MATCH FULL would
  --    reject **every message that is not a reply**. That is M15's ledger defect wearing a
  --    different hat, and it is written here because the difference is one keyword.
  -- 2. **It pins the project, not the thread**, though a thread-pinned FK would be strictly
  --    stronger and every legitimate answer today replies within its own thread. Pinning the
  --    thread would decide `thread-model.md` §9.5 — whether a fan-out parent mirrors its
  --    children's answers — by making the mirror shape unwritable. §9.5 is deferred on the
  --    record and its contract says both shapes fit this schema unchanged. A schema change is
  --    not the place to settle an open question by accident. The *writer* scopes to the thread
  --    (`db/threads.ts appendMessage`), which is one line to loosen and reviewable when §9.5 is
  --    answered.
  --
  -- Renamed rather than redefined under the old name, so a database that somehow already holds
  -- the single-column version is corrected rather than skipped by the `IF NOT EXISTS` guard.
  -- No such database is known to exist; this migration has never been applied to a Postgres.
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'message_reply_fk') THEN
    ALTER TABLE ops.message DROP CONSTRAINT message_reply_fk;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'message_reply_project_fk') THEN
    ALTER TABLE ops.message
      ADD CONSTRAINT message_reply_project_fk
      FOREIGN KEY (in_reply_to, project_id)
      REFERENCES ops.message (id, project_id) ON DELETE RESTRICT;
  END IF;
END $$;

-- The mailbox drain, as an index: undelivered messages for one thread, in order.
CREATE INDEX IF NOT EXISTS message_mailbox_idx
  ON ops.message (thread_id, seq) WHERE delivered_at IS NULL;
-- The expiry sweep: which questions have run out of time, project by project.
CREATE INDEX IF NOT EXISTS message_expiry_idx
  ON ops.message (project_id, expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS message_thread_created_idx
  ON ops.message (thread_id, created_at DESC);

COMMENT ON TABLE ops.message IS
  'Every turn in a thread, including questions (Plan §12/§19: a question is a message kind, not ops.question). The mailbox is WHERE delivered_at IS NULL. Highest-PII table in this database — see migration header. Owner: thread-model-engineer.';
COMMENT ON COLUMN ops.message.body IS
  'Free text a human typed. Stored verbatim, never traced (messageSpanAttributes has no body field), never put in a push payload (contentless push, Plan §21.7).';
COMMENT ON COLUMN ops.message.payload IS
  'Structured content as an OBJECT. Flattening into prose defeats key-based redaction — four of five denylisted keys survive it (observability/redact.ts).';
COMMENT ON COLUMN ops.message.expires_at IS
  'Mandatory on a question. A run blocked forever on a question nobody saw looks idle, holds a slot, and delivers nothing. On expiry: question_unanswered.';
COMMENT ON COLUMN ops.message.delivered_at IS
  'NULL means still in the mailbox. The mailbox is a predicate on this column, not a second table.';

-- ---------------------------------------------------------------------------
-- 3. The run ledger gains thread_id — nullable, and the reason is not timidity
-- ---------------------------------------------------------------------------
--
-- `Plan §12`: *"`ops.run_ledger` gains `thread_id`."* Here is the whole judgement, because
-- this column is one keystroke away from repeating M15's most expensive defect.
--
-- 0005 made four columns NOT NULL on this table and `ledger.ts` named none of them. Nothing
-- caught it — `tsc` cannot see a column list inside a template literal, and `PREPARE` plans
-- without evaluating NOT NULL — so **the first real run would have been paid for and then
-- failed to record**, leaving the ledger empty in exactly the way an honest empty ledger is
-- empty. The rule the isolation sign-off derived from it:
--
--   > **Grade a constraint from both sides.** A NOT NULL nobody can satisfy and one that holds
--   > are identical in a schema dump.
--
-- `recordRun` is `runner-engineer`'s writer and `runService` is theirs too; a thread is created
-- by the route that starts a run, which is their slice of M16 (BOARD). Shipping `NOT NULL`
-- ahead of that writer would be writing the M15 defect on purpose, in the same table, six weeks
-- later. So the column lands **nullable**, meaning *"this run predates threads"* — a state that
-- is true of every row a database in this shape will ever be applied to, which is zero rows.
--
-- **What makes that a decision rather than a decorative column:** the day `runner-engineer`
-- adds `ALTER COLUMN thread_id SET NOT NULL`, `writer-schema-agreement.test.ts` goes red
-- **without a database**, on the assertion that every NOT NULL-with-no-default column is named
-- by the insert. That test is extended in this same commit to say so out loud, and the property
-- was falsified before it was claimed. The forcing function exists; it just is not this file.
--
-- Its consumer in this same milestone is `observability-engineer` (thread_id on the 34 metrics
-- endpoints and LAST RUNS, BOARD M16 slice table). A producer with no consumer is not a
-- feature; this one has a named consumer and the slice is stated.

ALTER TABLE ops.agent_runs
  ADD COLUMN IF NOT EXISTS thread_id uuid;

DO $$
BEGIN
  -- Composite again: a run cannot be attached to another project's thread. With `thread_id`
  -- NULL the constraint is satisfied (MATCH SIMPLE), which is exactly the intent — unattached
  -- runs are legal, misattributed ones are not.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_runs_thread_fk') THEN
    ALTER TABLE ops.agent_runs
      ADD CONSTRAINT agent_runs_thread_fk
      FOREIGN KEY (thread_id, project_id) REFERENCES ops.thread (id, project_id)
      ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS agent_runs_thread_started_idx
  ON ops.agent_runs (thread_id, started_at DESC) WHERE thread_id IS NOT NULL;

COMMENT ON COLUMN ops.agent_runs.thread_id IS
  'The thread this run belongs to (Plan §12). Nullable = this run predates threads. Not NOT NULL until recordRun names it — a NOT NULL its only writer cannot satisfy is how the first paid run fails to record (0005, M15). One run is still one trace; this column changes nothing about that.';

-- ---------------------------------------------------------------------------
-- 4. One run, one trace — unchanged, and that is why this unification is affordable
-- ---------------------------------------------------------------------------
--
-- `Plan §12`: *"Nothing about one-run-one-trace changes — the observability plane's core
-- assumption survives intact."* Recorded in the migration because it is a **negative** fact,
-- and negative facts are the ones that get quietly reversed: nothing here adds a trace id to a
-- thread, and a thread spanning four runs is four traces, correlated by `thread_id` on the
-- ledger. A design that needs one run to span two traces is a different design.

-- ---------------------------------------------------------------------------
-- 5. Isolation — a failing query, not a filter
-- ---------------------------------------------------------------------------
--
-- Both tables join the set 0005 §5 put behind `ops.project_visible(project_id)`: with no
-- project in scope a read **raises** (SQLSTATE 42501, `project_scope_missing`) rather than
-- returning zero rows, because an unscoped read that answers "nothing here" is
-- indistinguishable from an honest empty state.
--
-- 0005 §6 still applies and is not re-argued: RLS is inert for a superuser, compose's Postgres
-- user is one, and `GET /api/status` reports it as `projects.scopeEnforcement`. A hole you can
-- see on a status page is a task.

ALTER TABLE ops.thread ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.thread FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS thread_project_scope ON ops.thread;
CREATE POLICY thread_project_scope ON ops.thread
  USING (ops.project_visible(project_id))
  WITH CHECK (ops.project_visible(project_id));

ALTER TABLE ops.message ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.message FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS message_project_scope ON ops.message;
CREATE POLICY message_project_scope ON ops.message
  USING (ops.project_visible(project_id))
  WITH CHECK (ops.project_visible(project_id));

-- ---------------------------------------------------------------------------
-- 6. Retention and erasure — what is true, stated rather than implied
-- ---------------------------------------------------------------------------
--
-- **`ops.prune` is not extended to these tables, and that is a decision.**
--
-- `ops.prune(integer, integer)` (0003, ADR-008, `observability-engineer`'s) deletes ledger rows
-- past a retention horizon. Threads are not telemetry: a thread is the record of what a person
-- asked and what was done about it, and pruning it by age deletes the product's memory rather
-- than its exhaust. Adding a horizon here would also make erasure look solved when it is not.
--
-- **What is actually true today, in one sentence each:**
--
--   Retention — unbounded. Nothing deletes a thread or a message. Growth is a real
--               operational question and it belongs to `observability-engineer` with
--               `rtl-arabic-pdpl-specialist`, filed rather than answered here.
--   Erasure   — **not executable.** No plane in this repo has a delete verb; the only erasure
--               unit this architecture can execute is the project, and deleting a project is
--               refused while history exists (ADR-015 Q4). Right-to-erasure over a person's
--               own words therefore has no path today.
--
-- A delete verb is destructive and gets its own ADR before its first line of code. Writing one
-- inside a migration that nobody asked to review is precisely how an irreversible capability
-- arrives without a decision behind it.
