# CONTRACT — Work products, worktree isolation, and the diff review payload

**Owner:** `runner-engineer`. Outright, including **the read side** — the payload
`drawer-engineer` renders is specified here and forked nowhere. Change requests come here as a
`decision-request`.

**Source:** `AGENTOS-V2-PLAN.md` Part Two §13 — *"Presence and work products — what is it doing,
and did it push?"* Cite as `Plan §13`, never `§13` ([ADR-013](../decisions/ADR-013-part-two-standing-and-spec-coverage.md)).

**Decision of record:** [ADR-026](../decisions/ADR-026-work-products-and-worktree-isolation.md).

**Sibling contracts, whose rules bind here and are not re-argued:**

| Contract | Owner | Boundary |
|---|---|---|
| [`api-contracts.md`](api-contracts.md) | `runner-engineer` | The wire. §4 below is the payload; the routes are transcribed there by the same owner. |
| [`project-scoping.md`](project-scoping.md) | `runner-engineer` | The project axis. Every rule binds; §4.1's scoping is an application of it, not a new rule. |
| [`thread-model.md`](thread-model.md) | `thread-model-engineer` | A run is a turn of a thread. §5.3's notification **is** a message in that thread; any grammar addition is theirs, by request. |
| [`observability.md`](../specs/observability.md) | `observability-engineer` | Spans and the redaction planes. §6 adds no rule there — it states what must never arrive. |

---

## 0. Status — what has run, and what has not

**Read this before quoting anything below as working.**

| Claim | Tier | Basis |
|---|---|---|
| The worktree mechanic | **real** | `worktree.test.ts` — 14 tests against real temp git repositories. Concurrency, cleanup, prune-after-kill, counts, diff structure, truncation, pagination, binary, rename. Falsified by returning a constant path. |
| The diff payload | **real** | Produced by `git diff` in a fixture worktree and asserted as structure. |
| The refusals (`worktree_unconfinable`, `repo_unavailable`, nesting, cursor mismatch) | **real** | Exercised; each names its file. |
| `ops.work_product` INSERT and its reads | **synthesized** | `writer-schema-agreement.test.ts` harvests the real statement and checks it against the migration text. **No row has ever been written.** |
| `push_state`, `pr_url`, `pr_state`, `ci_state`, `tests_*` | **structural** for the outcome half | `push_state` is *observed* by real git in tests; the PR/CI/test columns are **recorded, not produced** — nothing in this build sets them, and they are NULL on every row it can write. |
| A run producing a work product end to end | **has not happened** | Two missing preconditions, not one: **zero agent runs have ever executed**, and **no project has a checked-out repo path** a run could work in (`MountedProject.repoPath` is `null` on every deployment). |

Which claims depend on which precondition, stated because the frame asked:

- The **worktree mechanic** and the **diff reader** depend on **neither**. They are functions
  over a git repository and the tests supply one.
- The **writer**, the **routes** and the **`done`-frame `workProduct`** depend on **both**: a run
  must execute, and it must have a repository to execute against.
- `push_state` observation depends on **neither** in the mechanic (tested), and on **both** in
  the row.

---

## 1. What this contract governs

> Every run that touches a repo produces a `ops.work_product` row. […] **Worktree isolation per
> run.** Parallel agents in one project must not share a working tree. […] Without this, "run
> three agents at once" corrupts all three. — `Plan §13`

Three things, and only the third is a screen:

| Half | Where it lives | Owner |
|---|---|---|
| **The mechanic** — one git worktree per run, its lifecycle, and the facts read out of it | `apps/runner/src/lib/worktree.ts` | `runner-engineer` |
| **The entity** — `ops.work_product`, its writer and its reads | `0010_work_products.sql`, `db/workProducts.ts` | `runner-engineer` |
| **The surface** — roster line, diff review screen, approve | `apps/web/src/drawer/**` | `drawer-engineer` |

The seam between the second and the third is **this file**. `drawer-engineer` builds against
§4–§7 and writes none of it.

---

## 2. The mechanic

### 2.1 One worktree, one branch, one run

`createWorktree({ repoPath, worktreeRoot, runId })` →
`<worktreeRoot>/<slug>/<runId>` on branch `agnetos/run/<runId>`, cut from the repository's HEAD
at that moment, which is recorded as `base_sha`.

Four properties, each asserted against real git:

1. **N concurrent calls yield N distinct paths**, none nested inside another, no two sharing a
   `.git/index`. The index is the file that makes "three agents corrupt each other" true when it
   is shared: `git add` in one tree would stage another's changes.
2. **The tree lives outside the repository.** A worktree nested inside its own repo appears in
   the parent's `git status`, is deletable by `git clean`, and is staged by a `git add -A` up
   there. Refused with `bad_request`, resolved-path compared, `..` failing closed.
3. **`git worktree add` is serialized per repository, in this process.** git takes its own locks
   and two concurrent adds can lose one to a lock error. A mechanism that is correct-but-flaky
   under concurrency fails the requirement *intermittently*, which is worse than failing always.
   Deliberately not a cross-process lock — one runner per host, and a lock file pretending to
   coordinate two hosts would be a claim the design does not make.
4. **Cleanup is asymmetric, and `Plan §13`'s "cleaned when unchanged" is the reason.** A tree
   with no commits and no changed files is removed. **A tree holding work is kept**, because
   removing it destroys the thing the row points at.

### 2.2 A killed run

A run whose process dies leaves a directory that may be gone and an administrative entry that is
not. The requirement is a **prunable** worktree, never a locked repository: `pruneWorktrees`
reclaims exactly the entries git marks `prunable`, leaves live siblings alone, and the repository
cuts new trees afterwards. `removeWorktree` is idempotent when the directory has already gone —
a caller cleaning up after a crash must not have to classify that.

> **Implementation note that is worth a contract line**, because it is the class of defect this
> repo keeps finding: the obvious implementation asks `git worktree prune --dry-run --verbose`
> what it would do. That output goes to **stderr**, so a helper returning stdout reports *"nothing
> was prunable"* — a confident silent zero. The porcelain listing is read instead. Found by this
> function's own test going red on `expected one prunable tree, got []`.

---

## 3. Confinement — **a worktree is not a jail**

This section exists because the failure it describes has already been paid for once: `workspace`
confinement was a docstring, twelve agents were widened on the strength of it, and a run
overwrote `.env`. **A comment is not a mechanism.**

What is true, in order:

| Layer | Confines | Does not confine |
|---|---|---|
| `cwd` | nothing | everything. It decides where a *relative* path resolves. The SDK's file tools take absolute paths. |
| `isToolAllowed` | which tool may run — exactly `wired_into`, never a superset (BOARD rule 4) | what that tool may touch |
| `isPathInsideRunRoots` | **every declared path argument**, against the run's roots (scratch + worktree), resolved-path compared | a tool whose arguments declare no path |
| `assertWorktreeConfinable` | — | — it does not confine at all. It **refuses to hand out a worktree**. |

**Nothing in this build confines a shell.** `Bash` takes `{command}`; `pathArgumentsOf` finds no
path in a command string and the gate returns `true`. One `cd ..` leaves. The same is true of
every MCP connector, whose arguments are interpreted by another process.

So the ruling is a refusal rather than a claim:

> A run whose allowlist includes a connector declared `writes: 'ungated'` is **refused a
> worktree** (`worktree_unconfinable`, 403) before one is created. We do not pretend to jail a
> shell; we decline to give it a repository.

`Connector.writes` is a **required** field on the registry (`gated` · `none` · `ungated`), so the
next connector added cannot be silent about it. That is what stops this being an include-list —
*an include-list is a decision to be blind to everything unnamed*. Today `shell`, `git` and
`company-brain` are `ungated`; **no agent in the library declares any of them**, so the refusal
forbids nothing that exists. Reversing it for a specific agent is an ADR, not a config edit.

And the honest residue, stated rather than implied: **an agent with `workspace` and a worktree
can still write anywhere inside that worktree**, including files the human did not ask it to
touch. The diff is what makes that visible, which is the argument for the review screen.

---

## 4. The read side

### 4.1 Routes — project-scoped, and the frame's shorthand is not the route

| Route | Answers |
|---|---|
| `GET /api/p/:project/work-products?limit=&review=true` | The roster. With `review=true`, **the review queue**. |
| `GET /api/p/:project/work-product/:runId` | One run's work product, or a discriminated absence. |
| `GET /api/p/:project/work-product/:runId/diff?cursor=&files=` | One page of the diff. |

M17's frame names the boundary object as `GET /api/work-product/:runId`. **It is not unscoped,
and `drawer-engineer` was right to ask.** `api-contracts.md` already rules that a run id is
opaque across projects — *confirming it exists elsewhere is itself a cross-project disclosure* —
and behind **this** id are another project's file paths and file contents, which is strictly
worse than the leak that rule was written for. The project is resolved from the path first and
the read carries `WHERE project_id = $1` on the same statement that finds the row: a
lookup-then-scope route lets a caller-supplied id choose its own scope (`thread-model.md` §4.1,
one plane over).

### 4.2 Absences — three, and they must not look alike

| Situation | Answer | Why not the obvious one |
|---|---|---|
| The run belongs to another project | `run_not_found` (404), opaque | See above. |
| The run is this project's and touched no repository | **200**, `{ workProduct: null, absent: 'no_repo' }` | On a phone a 404 is indistinguishable from a mistyped id. This is the ordinary case in this build. |
| The work product exists, its worktree is gone | `work_product_unavailable` (410) on the diff | *The tree was removed* and *this run changed nothing* are the same empty file list and completely different news. |
| This project has no repository at all | `repo_unavailable` (503) at run start | The caller did nothing wrong and it lifts when a repo is configured. |

### 4.3 The diff payload — structure, two axes, and a pinned tree

**The client never parses diff text.** A client that finds its own structure in unified diff is a
second implementation of the parser with a different author, which is the shape this seam was
drawn to prevent. The server parses; `DiffFile` and `DiffHunk` in
`packages/contracts/src/work-product.ts` are the shape.

- **Per file:** `oldPath`, `newPath` (a rename is **one** row with both), `status`
  (`added|modified|deleted|renamed|binary`), `insertions`, `deletions`, `truncated`,
  `linesWithheld`.
- **Per hunk:** the header verbatim, `oldStart`/`oldCount`/`newStart`/`newCount`, and lines
  carrying `origin` as a **field** — the marker is never a character the client strips.
- **Binary files are flagged and never sent as bytes.** `hunks: null`, counts `0`.

**Two axes, because a diff is not a list of rows.**

1. **Files.** `MAX_DIFF_FILES_PER_PAGE = 20`. `totalFiles` is on **every** page — a file list
   that cannot say how many files there are cannot be read in two seconds.
2. **Lines within a file.** `MAX_DIFF_LINES_PER_FILE = 400`. Past it the body is cut and the cut
   is **declared**: `truncated: true` and `linesWithheld: n`. Never a silent tail. *A cut that
   does not say it was cut is the declared-value defect wearing diff clothing, and on this screen
   it means a reviewer approves code they were never shown.* The file's `insertions` count still
   reports the **whole** change — a cut body must not shrink the number beside it.

**A cursor, not an offset, and it carries the tree state.** `nextCursor` is
`<headSha>:<fileIndex>`, opaque to the client. A cursor presented against a different `head_sha`
is refused with `work_product_moved` (409). A worktree is a live directory: serving page 2 from a
tree that moved shows a reviewer a diff that never existed as a whole, and then asks them to
approve it. An offset cannot express this.

---

## 5. The entity

### 5.1 Columns, and the two that are nullable on purpose

`ops.work_product` (`0010_work_products.sql`) carries `Plan §13`'s table plus `project_id`,
`thread_id`, `repo_path` and `worktree_removed_at`. Two nullable columns are load-bearing:

**`push_state` — the third state.** `NULL` means **nothing has ever looked**. `'none'` means
something looked, at `push_checked_at`, and found nothing to push. An equality CHECK pins the
pair, so a state cannot exist without an observation time. There is no default:

> `push_state: none` on a run that never tried to push is a **declared** value. Collapsing
> *"never checked"* into *"nothing to push"* tells a person their work is safe when nothing
> examined it.

Rendering, which is `drawer-engineer`'s and is specified here only as a floor: `null` renders as
**unknown with a reason**, never as a quiet neutral line, and never as "nothing to push".

**`worktree_removed_at`** — `NULL` ⇒ the tree is on disk and the diff is readable. Exposed on the
payload as `diffAvailable`.

### 5.2 What the table cannot hold

**There is no diff column, and there will not be one.** See §6. The absence is the mechanism.

**There is no `ops.review`, no `ops.task`, no `ops.question`.** The review queue is a *query* —
`push_state = 'local' OR pr_state = 'open'`, ordered, served by a partial index. Three finished
runs awaiting review look exactly like a task list, which is how M11's absorbed entity model gets
rebuilt by accident. `superseded-run-input.test.ts` refuses all three table names by scanning
every migration.

### 5.3 `push_state: local` is a message in the run's own thread

Hazard 3, ruled by BOARD's frame and implemented as written: **no `notification` entity, no
second delivery path, no new message kind.** The run's thread exists (`ops.agent_runs.thread_id`
is NOT NULL as of `0009_run_thread_required.sql`), and a `system` message on it carries the
counts as an **object** — never composed into prose first, because flattening is how content gets
past key-based redaction.

### 5.4 M17 does not push, open a PR, or merge

A push sends code and commit messages to a third-party host: data egress, and
[ADR-038](../decisions/ADR-038-data-egress-and-processing-region.md) is `proposed`, awaiting a
DPA answer and a processing region **from the human**. So M17 **records** push state and performs
nothing. The enforcement is a gate, not this sentence: `diff-never-leaves.test.ts` scans the
whole runner for a push verb, a `gh pr create`, or a `remote` write, and it has been falsified
against a planted `git push` naming the file and line.

`push_state: 'pushed'` stays reachable and truthful — **a human may have pushed the branch**, and
hazard 5 forbids the action, not the observation.

`pr_url`, `pr_state`, `ci_state`, `tests_run`, `tests_passed` are **recorded, not produced**.
NULL on every row this build can write, and NULL means *nobody looked*. There is no
`pr_state: 'none'`.

---

## 6. **A diff is a body** — where it may travel, and where it may not

The flattening finding at 100× the volume. A message body leaking through an interpolated error
string cost four rounds; a diff contains file contents, so the surface is the whole working tree.

| Plane | May a diff arrive? | Mechanism |
|---|---|---|
| The read route, to one reader, inside the project | **Yes.** That is the screen. | — |
| Postgres | **No.** | There is no column. `writer-schema-agreement.test.ts` fails on any column named like content. |
| A span / trace | **No — counts only.** | `diff-never-leaves.test.ts`: nothing under `observability/` may import the diff reader or its types. |
| An error string | **No.** | Same gate; and no refusal in `workProductService.ts` interpolates diff text. |
| A thread message body or payload | **No.** | The `system` message carries counts. Asserted at runtime against a fixture whose change is a person's name. |
| `lib/prompt.ts`, i.e. the model prompt | **No, and this is the sharpest one.** | Same gate names `lib/prompt.ts` explicitly. It renders prior turns into the prompt, and this repo asserts **no processing region** for that endpoint — a diff there leaves the tailnet. |

**`withhold()` is not the answer here and must not be reached for.** The register is bounded
(`MAX_WITHHELD_CHARS`, `MAX_LITERALS`) and now **refuses at capacity rather than evicting**; a
diff would exhaust it instantly and `withhold()` would return `false` — a real answer meaning
*this run cannot protect that text*. The rule is therefore **do not put it there**, enforced by
import-level gates rather than by scrubbing.

**Related, and closed with this contract:** the mailbox drain now calls `trace.withhold(body)` at
the point the body is read (`renderDrainedMessage`), which is the only point where provenance
still exists. A `false` is logged with the message id and a length — never the text.

---

## 7. SSE — every field the roster line needs, named here

`Plan §13`'s roster line, decomposed, with the frame that carries each. Named in the same commit
as the schema so wave 2 does not ship a second inert surface (hazard 7).

| Roster element | Frame · field | Note |
|---|---|---|
| `running` / `done` | `start` / `done` | Unchanged. |
| **`blocked`** | **`done.threadState === 'waiting'`** | New. `plan.awaitingApproval` covers the approval gate only; a run that *asked a question* had no representation, so §13's fourth line was undrawable. A question is a message kind in a thread (ADR-023) and the thread state is where that already lives — not a second flag that can disagree with the row. |
| `4m` | derived client-side from `start.startedAt` | **Deliberately not sent.** A server-computed `4m` goes stale in a cache and becomes a declared value. |
| `reading 3 sources` | derived from `tool` frames (`{name, status}`) | **Absorbed with a refusal:** the requirement (structured, not a sentence) is accepted; a new server field is refused, because nothing in this build produces a live activity phrase and it would ship inert. `drawer-engineer` owns the wording in both languages. |
| `fix/auth · 3 commits` | **`done.workProduct`** | New. `branch`, `commits`, `filesChanged`, `insertions`, `deletions` — no second fetch. |
| `⚠ UNPUSHED` / `↑ pushed` | `done.workProduct.pushState` (+ `pushCheckedAt`) | `null` ⇒ unknown, per §5.1. |
| `PR #42 · CI green` | `done.workProduct.prUrl/prState/ciState` | `structural`. Render them; claim nothing observed them. |
| `asked you something · 12m ago` | **`start.threadId`** + the thread's last message | New. **The same field the mailbox composer has been inert without** since M16 — named once, here. |

For N runs the roster reads **one** route (`work-products`), not N. A roster assembled from three
routes is a spinner, and every part of it is individually correct so no test catches it.

---

## 8. Approve — what the button writes

**There is an honest write, so the control is not disabled.** It is not a merge and it does not
imply one exists.

**`POST /api/p/:project/thread/:threadId/message`** — M16's existing route, with
`payload: { review: 'approved' | 'changes_requested', runId, headSha }` and `interrupt: 'note'`.

Why this and not the alternatives:

- **Not `POST /api/p/:project/approvals/:runId`.** `drawer-engineer` is right that it does not
  fit: that verb resumes or aborts a run **paused at its plan gate**, and a work-product review
  is a **finished** run. Reusing it lands on `run_not_pending_approval` (409).
- **Not a new column and not a new entity.** Hazard 3 already ruled the shape for `push_state:
  local`, and a verdict is the same kind of thing: a message in the run's own thread.
- **`headSha` is in the payload deliberately.** *"Approved"* with no tree state names nothing —
  the tree can move afterwards, and a verdict that cannot say what it looked at is a claim
  without an observation.
- The thread is `open` when the run has finished, so the message is **recorded, not delivered**:
  nothing drains it, and it is seeded into the next run's history. `changes_requested` therefore
  reaches the agent on its next turn, which is the useful behaviour and costs nothing extra.

**What the verdict is read back as:** a derived `review` state over the thread's messages — a
query, not a column, for the same reason the queue is (§5.2). **Not built in M17's foundation
slice**; wave 2 needs it for *"awaiting review"* and it is named here so it is not invented
twice. Until it exists the roster's review state is the queue predicate, which is honest.

---

## 9. Open questions — named, owned, not silently deferred

| # | Question | Owner |
|---|---|---|
| 9.1 | **Where does a project's `repo_path` come from?** `AGNETOS_PROJECT_REPO` is a per-process env var today. A per-project column on `ops.project` is the obvious next shape and it is not in `0010_`, because M17 may not add a second migration. | `runner-engineer`, with `identity-access-engineer` on the mount question |
| 9.2 | **Who prunes abandoned worktrees on a schedule?** `pruneWorktrees` exists and nothing calls it periodically. M18 owns the clock. | `scheduler-engineer` |
| 9.3 | **Retention.** Nothing deletes a work product, and a kept worktree lives until someone removes it. Unbounded, like `ops.thread`. | `observability-engineer` + `rtl-arabic-pdpl-specialist` |
| 9.4 | **The derived `review` state** (§8) is specified and unbuilt. | `runner-engineer` |
| 9.5 | **Bidi.** The diff screen is the largest English-in-RTL surface this app will have — branches, shas, PR states, diff text. The sigil gate's `todo()` gap must close before it ships. | `rtl-arabic-pdpl-specialist` |

---

## 10. What cannot be validated, and what would change that

**One API key and one repository path**, and most of the `structural` rows in §0 become `real`:

- `RUNNER_ANTHROPIC_API_KEY` — with it a run executes and a work product row exists for the first
  time.
- A project `repo_path` — without it no run can touch a repository at all, and this is the
  precondition that had not been named before M17's frame.

Neither is invented, worked around, or defaulted. Until both land, the table describes something
that has not happened, and every consumer of this contract should say so in its own handoff.
