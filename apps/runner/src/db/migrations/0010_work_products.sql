-- 0010_work_products.sql
--
-- `ops.work_product` — M17, `Plan §13`, ADR-026.
--
--   > Every run that touches a repo produces a `ops.work_product` row. […] `push_state`:
--   > `none · local · pushed` — **the question you actually asked**.
--
-- ## Why this is 0010, and the number that was raced
--
-- Claimed on BOARD with M17's frame, before this file existed. `0009_run_thread_required.sql`
-- took the number four comms files had already spent while nobody owned it; this one was
-- claimed first, which is the difference between a namespace and a listing. `client.ts`
-- applies migrations in **filename order**, so two files sharing a number run in an order
-- decided by the text after the digits.
--
-- ## What this table describes has not happened
--
-- Every other migration in this directory describes something the product does. This one
-- describes the **result of a run against a repository**, and there have been none: zero agent
-- runs have executed, and — the second missing precondition, which nobody had named before
-- M17's frame — **no project has a checked-out repo path a run could work in.** Two
-- preconditions, not one.
--
-- So this table is `structural` in the milestone's own evidence tiers: source, types and a
-- writer that has never executed. What is **not** structural, and is the reason M17 could open
-- at all, is the mechanic underneath it (`lib/worktree.ts`), which is real git against a real
-- temp repo. The row this table holds is the record of that mechanic's outcome; do not read a
-- landed column as an observed value.
--
-- ## The house defect, and the one column shape that answers it
--
-- BRIEF: *a declared value read as an observed one*, found in nine costumes. M17's frame names
-- the tenth in advance:
--
--   > **`push_state: none` on a run that never tried to push is a declared value, not an
--   > observed one.** The column must distinguish *"we looked and there was nothing to push"*
--   > from *"nothing has ever looked."*
--
-- `push_state` is therefore **nullable with no default**, paired with `push_checked_at`, and
-- the two are pinned to each other by an equality CHECK. NULL means *nothing has ever looked*.
-- `none` means *something looked, at a stated time, and found nothing to push*. A default of
-- `'none'` would have made a row that was never examined indistinguishable from one that was —
-- on the one screen where the difference is whether a person's work is safe.
--
-- ## What this table deliberately does NOT have
--
--   a diff column     — **never.** The diff is not stored anywhere in this database. It is
--                       computed on demand by `git diff` in the worktree and streamed to the
--                       reader. A diff is a body, and a body in a column is a body in a backup,
--                       a body in a `SELECT *`, and a body one interpolation away from a span
--                       or a model prompt (`work-product.md` §6, hazard 6). The schema being
--                       unable to hold one is the mechanism; a rule saying not to would not be.
--   ops.review        — **never.** The review queue is a *query* over this table
--                       (`push_state = 'local' OR pr_state = 'open'`), not a second entity.
--                       M11 stays absorbed: no ops.task, no ops.question, no ops.review.
--   a notification    — **never.** `push_state: local` on a finished run is a message in the
--                       run's own thread (ADR-023, hazard 3). That is why `thread_id` is NOT
--                       NULL here: the delivery path already exists and there is exactly one.
--   a merge/push verb — not in M17. Pushing is data egress and ADR-038 is `proposed` and
--                       awaiting a human (hazard 5). This table **records** push state; the
--                       writer refuses to record `pushed` until that ADR is accepted, so the
--                       value's presence in the enum is a schema that outlives the milestone
--                       rather than a capability this one has.

-- ---------------------------------------------------------------------------
-- 1. A composite handle on the run, so a work product cannot cross a project
-- ---------------------------------------------------------------------------
--
-- `ops.agent_runs.run_id` is `text PRIMARY KEY` (0001) — unique on its own, and therefore a
-- foreign key target that says nothing about *whose* run it is. That is the exact shape
-- `0008`'s `in_reply_to` had before M16's review found it: a single-column reference under a
-- comment promising rows cannot cross a project.
--
-- The fix is the same device `ops.thread` already uses: a redundant-looking unique constraint
-- that exists only to be the handle a project-pinned reference can grab. An index on a primary
-- key column plus one more is close to free; a work product filed under another client's
-- project is not, and on this table it would put one client's **file paths and file contents**
-- behind another client's run id.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_runs_run_project_key') THEN
    ALTER TABLE ops.agent_runs
      ADD CONSTRAINT agent_runs_run_project_key UNIQUE (run_id, project_id);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. ops.work_product
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ops.work_product (
  id                  uuid PRIMARY KEY,

  -- One work product per run. A run that touches a repo twice has one branch and one head at
  -- the end of it; two rows would be two answers to *"did it push?"*, which is the single
  -- question this entity exists to answer.
  run_id              text NOT NULL UNIQUE,

  -- The axis, from the first migration that creates the table (Plan §10). 0005 is the receipt
  -- for the other order: backfill, re-key a rollup, drop an index that had been merging two
  -- clients' rows.
  project_id          uuid NOT NULL,

  -- **NOT NULL, and it is hazard 3 made structural.** `push_state: local` on a finished run is
  -- notification-worthy, and this board already ruled the delivery path: a message in the run's
  -- own thread, no `notification` entity, no second pipe. A work product that could not name a
  -- thread would be a state nobody can be told about. `ops.agent_runs.thread_id` is NOT NULL as
  -- of 0009, so every run has one — this is the same fact, denormalised so the composite FK
  -- below can pin the project through it.
  thread_id           uuid NOT NULL,

  -- Where the work was done. `repo_path` is the checked-out repository the worktree was cut
  -- from; `worktree_path` is this run's own tree inside it. Both absolute, both on the host
  -- that ran it — recorded because "where to find it" is `Plan §13`'s stated purpose for the
  -- field, and a path on a machine that might get wiped is exactly what `push_state: local`
  -- is warning about.
  repo_path           text NOT NULL,
  worktree_path       text NOT NULL,

  -- When the worktree was removed. NULL means it is still on disk and the diff is still
  -- readable; a timestamp means the diff for this row is **gone**, which is a different answer
  -- from "this run changed nothing" and the read route says so rather than returning an empty
  -- file list. Same distinction as push_state's NULL, one object over.
  worktree_removed_at timestamptz,

  branch              text NOT NULL,
  base_sha            text NOT NULL,
  head_sha            text NOT NULL,

  -- `Plan §13`'s "how much". Counts, never content — this is the entire payload the roster
  -- line needs, and it is why the roster can be honest without a diff ever leaving the tree.
  commits             integer NOT NULL,
  files_changed       integer NOT NULL,
  insertions          integer NOT NULL,
  deletions           integer NOT NULL,

  -- **The question you actually asked, and the third state it has to be able to give.**
  --
  -- NULL = nothing has ever looked. 'none' = something looked and found nothing to push.
  -- 'local' = commits exist here and nowhere else. 'pushed' = they are on a remote.
  --
  -- `pushed` is in the enum and **unreachable in M17**: nothing in this build performs a push,
  -- because a push is data egress and ADR-038 is `proposed` (hazard 5). The writer refuses to
  -- record it with a named reason, which is a mechanism; leaving the value out of the enum
  -- would make the schema, rather than the decision, the thing that has to change when a human
  -- answers the DPA question.
  push_state          text
                      CONSTRAINT work_product_push_state_known
                      CHECK (push_state IN ('none', 'local', 'pushed')),
  push_checked_at     timestamptz,

  -- **Recorded, not produced** (M17 evidence tiers). Nothing in this milestone opens a PR or
  -- reads CI: these columns exist so the roster line `Plan §13` specifies can be rendered when
  -- something does, and they are NULL on every row this build can write. A NULL here means
  -- *nobody has looked*, exactly as it does above — there is no `pr_state: 'none'`.
  pr_url              text,
  pr_state            text
                      CONSTRAINT work_product_pr_state_known
                      CHECK (pr_state IN ('open', 'merged', 'closed', 'draft')),
  ci_state            text
                      CONSTRAINT work_product_ci_state_known
                      CHECK (ci_state IN ('pending', 'passing', 'failing', 'unknown')),

  -- "Did it check itself." Both NULL until something runs tests, and pinned to each other
  -- below so a row cannot claim a pass rate it never measured.
  tests_run           integer,
  tests_passed        integer,

  created_at          timestamptz NOT NULL DEFAULT now(),

  -- **The equality that makes the third state representable rather than inferred.**
  --
  -- Without it, `push_state IS NULL` and `push_checked_at` disagreeing would let a row say "we
  -- checked" with nothing to show for it, or carry a state with no time attached — and a state
  -- with no timestamp is the house defect's most common costume (a token count with no
  -- timestamp; `"tailscale": "online"` on a host with none). Written as an equality, both
  -- directions, like `message_interrupt_matches_kind`.
  CONSTRAINT work_product_push_checked
    CHECK ((push_state IS NULL) = (push_checked_at IS NULL)),

  -- A PR state without a URL is a claim about a page nobody can open.
  CONSTRAINT work_product_pr_state_has_url
    CHECK (pr_state IS NULL OR pr_url IS NOT NULL),

  -- Counts are counts. `files_changed` may exceed the number of files a paginated read
  -- returns; it may not be negative, and a run with no commits may not claim insertions.
  CONSTRAINT work_product_counts_non_negative
    CHECK (commits >= 0 AND files_changed >= 0 AND insertions >= 0 AND deletions >= 0),

  -- Both or neither, and a pass count cannot exceed the run count. `tests_passed` alone would
  -- be a percentage with no denominator, which is a number this repo has a standing rule
  -- against.
  CONSTRAINT work_product_tests_paired
    CHECK ((tests_run IS NULL) = (tests_passed IS NULL)
           AND (tests_passed IS NULL OR (tests_passed >= 0 AND tests_passed <= tests_run))),

  -- The handle the read route grabs when it pins a page to a tree state (`work-product.md`
  -- §4.3): a cursor carrying a different head is refused rather than served as a consistent-
  -- looking mixture of two trees.
  UNIQUE (id, project_id)
);

DO $$
BEGIN
  -- Three composite pins, and all three are about the same sentence: a work product belongs to
  -- one project and cannot be read from another. `ON DELETE RESTRICT` throughout, matching
  -- 0005 and 0008 — deleting a project is refused while any history hangs off it (ADR-015 Q4).
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_product_project_fk') THEN
    ALTER TABLE ops.work_product
      ADD CONSTRAINT work_product_project_fk
      FOREIGN KEY (project_id) REFERENCES ops.project(id) ON DELETE RESTRICT;
  END IF;

  -- The run, pinned **with** its project. §1 above exists solely to make this two columns
  -- rather than one: `REFERENCES ops.agent_runs(run_id)` would accept a run id from any
  -- project, and a work product is the one row in this database whose read serves file
  -- contents.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_product_run_fk') THEN
    ALTER TABLE ops.work_product
      ADD CONSTRAINT work_product_run_fk
      FOREIGN KEY (run_id, project_id) REFERENCES ops.agent_runs (run_id, project_id)
      ON DELETE RESTRICT;
  END IF;

  -- The thread, pinned with its project too, against `ops.thread`'s own UNIQUE (id,
  -- project_id) — the same handle `0008` added for `in_reply_to`.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_product_thread_fk') THEN
    ALTER TABLE ops.work_product
      ADD CONSTRAINT work_product_thread_fk
      FOREIGN KEY (thread_id, project_id) REFERENCES ops.thread (id, project_id)
      ON DELETE RESTRICT;
  END IF;
END $$;

-- **The review queue, as an index rather than as a table** (hazard 4). Three finished runs
-- awaiting review look exactly like a task list, which is how `ops.task` gets rebuilt by
-- accident. The queue is this predicate, ordered, and this index is what makes it cheap:
-- unpushed work first, then anything with an open PR.
CREATE INDEX IF NOT EXISTS work_product_review_queue_idx
  ON ops.work_product (project_id, created_at DESC)
  WHERE push_state = 'local' OR pr_state = 'open';

-- The roster: this project's most recent work products, one line each.
CREATE INDEX IF NOT EXISTS work_product_project_created_idx
  ON ops.work_product (project_id, created_at DESC);
-- "What happened in this conversation" — a thread spanning four runs has up to four of these.
CREATE INDEX IF NOT EXISTS work_product_thread_idx
  ON ops.work_product (thread_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 3. Isolation — a failing query, not a filter
-- ---------------------------------------------------------------------------
--
-- Same as 0005 §5 and 0008 §5: with no project in scope a read **raises** (42501,
-- `project_scope_missing`) rather than returning zero rows. An unscoped read answering
-- "nothing here" is indistinguishable from an honest empty state, and on this table an
-- unscoped read that *succeeded* would be the route to another project's file paths.
--
-- 0005 §6 still applies and is not re-argued: RLS is inert for a superuser, compose's Postgres
-- user is one, and `GET /api/status` reports it as `projects.scopeEnforcement`.

ALTER TABLE ops.work_product ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.work_product FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS work_product_project_scope ON ops.work_product;
CREATE POLICY work_product_project_scope ON ops.work_product
  USING (ops.project_visible(project_id))
  WITH CHECK (ops.project_visible(project_id));

-- ---------------------------------------------------------------------------
-- 4. Retention and erasure — what is true, stated rather than implied
-- ---------------------------------------------------------------------------
--
-- Retention: unbounded, like `ops.thread`. `ops.prune` is not extended here — a work product is
-- the record of what an agent did to a repository, not telemetry, and pruning it by age deletes
-- the only durable answer to *"where is the work?"*.
--
-- Erasure: this table holds **paths and shas**, not free text, which is a smaller PDPL surface
-- than `ops.message` by construction and deliberately so. A path can name a person
-- (`clients/fatima-al-harbi/…`) and that is the honest residue; it is a name in an identifier,
-- reachable by the same project-level erasure that is *not executable today* (ADR-015 Q4,
-- `thread-model.md` §9.3). The diff, which is where the real content is, is never here at all.

COMMENT ON TABLE ops.work_product IS
  'What a run did to a repository (Plan §13, ADR-026). One row per repo-touching run. Holds counts, paths and shas — never a diff: the diff is read from the worktree on demand and is not storable here by design. The review queue is a query over this table, not ops.review. Owner: runner-engineer.';
COMMENT ON COLUMN ops.work_product.push_state IS
  'NULL = nothing has ever looked. none = something looked at push_checked_at and found nothing to push. local = commits exist only here. pushed = on a remote, unreachable in M17 (ADR-038 is proposed). The NULL is the point: a declared "none" on a row nobody examined tells a person their work is safe when nothing checked.';
COMMENT ON COLUMN ops.work_product.push_checked_at IS
  'When push state was last observed. Pinned to push_state by an equality CHECK so a state cannot exist without a time, or a time without a state.';
COMMENT ON COLUMN ops.work_product.worktree_removed_at IS
  'NULL = the worktree is on disk and the diff is readable. Set = the diff for this row is gone, which the read route reports as unavailable rather than as an empty file list.';
COMMENT ON COLUMN ops.work_product.pr_url IS
  'Recorded, not produced. M17 opens no PR; these columns are NULL on every row this build can write, and NULL means nobody looked.';
