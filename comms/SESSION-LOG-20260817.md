# Session log — 2026-08-17

`comms/BOARD.md` is authoritative for milestone state, ownership and open decisions. This
file records what happened in this session and what a successor needs in order to pick it
up. It does not duplicate the board.

**Where it stopped:** M15's acceptance gate was dispatched against a still, committed tree
and **terminated on the session limit without returning a verdict**. It wrote nothing to
disk. **M15 is therefore not closed**, and per the definition of done it may not be marked
done: a handoff exists for every slice, but `fidelity-qa-reviewer` has not answered.

---

## What this session was

The user's instruction was *continue the rest of the plan, the next phase*. The next phase
is **P2 / M16 — Threads** (`Plan §20`). It was not started, on purpose: `Plan §20` says P1
and P2 cannot overlap with anything including each other, and M15's mandatory gate items
were still open. So the session closed out M15 instead and **framed** M16 without
dispatching it.

Thirteen commits, `1e5b5d7` → `9509421`. Every gate green on a still tree at the end:
root 145 pass / 0 fail · runner 153 / 0 · `test:web` both halves · `tsc` clean in web and
runner · tokens 0 violations / 311 files · RTL ratchet holding · **`validate:coverage` 0
FAILs, having been 20 FAILs and exit 1 for a day** · frontmatter and comms green.

---

## The finding that organises the rest

M15 shipped **"every view URL carries a project"** without **"every API call carries a
project"**. The drawer, CHART and every dashboard widget still called pre-project
endpoints, which answer `400 project_scope_missing`.

Nothing went red, and the reasons are the interesting part:

- **Fallbacks turned every 400 into a soft degrade.** The map's `loadGraph` classified the
  400 as one more unavailable primary and served the `/graph.json` artifact, so the galaxy
  still drew while `/ws/graph` — a path the runner does not register — simply never opened.
  REQ-MAP-27's delta code was correct and unreachable for a day.
- **The broken path was the one nobody was on.** `ChartMount` projects SKILL.md from disk
  and passes `agents`, so `skipFetch` is true and CHART's broken fetch never ran on a
  normal render.
- **The URLs were string literals.** That is what let a route move without anything
  noticing, and it is why the fix was to remove the literals — every migrated file now
  builds from `RUNNER_ROUTES` through the shell's shared `projectApiUrl`, and every test
  asserts the negative: the URL built is never a member of `LEGACY_UNSCOPED_PATHS`.

### What the wrong URL was telling people

Worse than the routing, and the part that would have burned a human's afternoon:

| Surface | What it said | What was true |
|---|---|---|
| Drawer | "this agent could not be loaded" | a fault in the address, not the agent |
| Six dashboards | "This box may be off the tailnet" | one line of client code |
| DASHBOARDS index | "No Command Centers to show. Add a `panels/*.json` file" | a routing fault reported as an empty folder |

**No widget ever drew a zero.** `resolve.ts` gates every plan's URLs to a verdict before
reading a body, on all six shapes — BOARD rule 9 held **by construction rather than by
vigilance**, which is why it survived a milestone nobody watched it through.

**CHART did draw one.** Its empty state is honest, but per-department counts were derived
from the same empty array and handed to the tab bar, which **dims a department at zero** —
and dimming is a claim (REQ-CHT-05, "no jobs are mapped here"). Seven falsehoods on the
same screen as the sentence saying the library could not be read. The general rule, worth
keeping: *an aggregate computed from a failed read is unknown, and every renderer
downstream will happily draw the zero.*

---

## The defect that would have cost real money

Migration 0005 made `project_id`, `agent_ref`, `source_ref` and `account_source` **NOT
NULL** on `ops.agent_runs`. `ledger.ts` is the only writer of that table and named none of
them; `writeOutput` still targeted the unique index 0005 dropped.

**The first real run of Phase 0 would have been paid for and then failed to record** — and
the ledger would have been empty in exactly the way an honest empty ledger is empty.

Nothing could have caught it. `tsc` cannot see a column list inside a template literal, and
`sql-executes.test.ts` probes with `PREPARE`, which **plans without evaluating NOT NULL**.
`recordRun` now refuses with `run_unattributed` rather than defaulting, because a default
attributes one project's run to another permanently, in the one table that records who
spent what.

The rule the isolation sign-off derived from it, which generalises past this bug:

> **Grade a constraint from both sides.** A `NOT NULL` nobody can satisfy and one that
> holds are identical in a schema dump.

And its sharpest restatement of the migration status: not merely that 0005–0007 have never
been applied to a real Postgres, but that **the writer changed tonight, so the writer and
the schema have never met.**

---

## Everything else that landed

**Security.** `npm start` defaulted `RUNNER_HOST` to `0.0.0.0` — right in Docker, and on
the host an unauthenticated API on the LAN. Now `127.0.0.1`, with the wide bind as the
declared case. The value moved out of `index.ts` because `index.ts` calls `listen()`
unconditionally and so is the one module tests cannot import: **the most security-relevant
value in the process was the only one with no test.** `bind.test.ts` also asserts the infra
files still set `0.0.0.0`, so deleting that line now fails loudly instead of silently
making the container unreachable from Caddy.

**The brain is no longer project-blind.** `COMPANY.md` rule 9 described the failure and
nothing enforced it. The gate now keys on the `agent_ref` derived from the project being
written to, writes through that project's `companyFile`, and throws on a global-tier write.

**Library reads derive from the project, by type rather than habit.** Five routes resolved
`:project` and then read the coordinator's config dirs. `lib/graph.ts` and `lib/panels.ts`
no longer import `RunnerConfig` at all, so reaching for `config.panelsDir` is a compile
error. The test hands the readers a project whose library is *not* the coordinator's — the
only construction where derivation and coincidence give different answers.

**What you see is now what runs.** There was no resolver outside dispatch, so an override
won a run while MAP, CHART and the validator all kept showing the global agent — rule 2
broken by the cascade itself. `AgentDetail` now carries `sourceRef` (required, not
nullable: `null` would make "the resolver was silent" and "no run yet" the same bytes) and
both agent reads go through `resolveForDispatch`.

**Provenance in both drawer headers**, as a projection of the cascade's `source_ref` — and
`unknown` rendered as unknown. Two shortcuts were refused: regexing `AgentDetail.path` for
`_overrides/` is the drawer writing its own resolver, and an L0 path is indistinguishable
from an L1 path from the browser; defaulting to `project` because no global library exists
yet is a guess wearing a badge.

**A cross-project display leak**: `useEndpoint` held the last reading across a project
change, so for one round trip the shell showed project A's figure under project B's name.

**Arrow keys ran backwards in Arabic**, in both `DepartmentTabs` and `SegmentedControl` —
the app's primary navigation, shipping today at seven tabs. Both had tests; both tests only
ever rendered LTR.

**ADR-014 accepted**, on its own §8 rather than on M15's schedule. It nearly took a
landmine with it: the file's *Contract edits* still instructed that `agent-cascade.md` be
**deleted** on acceptance, written before the orchestrator reversed that boundary.
Accepting as written would have authorised deleting a contract four agents now cite — and
would have looked like compliance.

**Coverage 20 FAIL → 0.** M15 moved every view under `(views)/p/[project]/` and left twenty
requirement claims pointing at files that no longer exist. Six owners repaired their own
spec; none blind-renamed, and several requirements turned out to be substantively false
rather than stale (REQ-SHELL-46 claimed `/map` is a view URL, which since `72d46dc` it is
not). The larger half is what was *added*: M15's shell slice had shipped with no
requirements at all. **A shipped route with no requirement behind it is invisible to every
future check** — the stale paths were the symptom, that was the disease.

---

## Three things done right that are worth copying

1. **Verification by falsification, three times.** A second door was *planted* and the
   one-door suite went red on the named assertion before the planted module was removed;
   the RTL regression tests were run against the pre-fix handlers and four cases went red
   before the fix landed; `status: live` was planted and the validator exited 1. *A test
   that has never been red proves nothing.*
2. **A retraction.** The CHART `overflow-x-auto` finding was withdrawn after a proper look
   — nothing is filtered, reordered or truncated, and roving focus scrolls a tab into view.
   The requirement was reworded to claim exactly that, and the genuine gap (no signal that
   the bar continues) filed with an owner and a trigger.
3. **A ratchet not raised.** When `check-rtl --gate` went red on one agent's own tree, they
   deleted the redundant clause rather than baselining it. *The honest way not to raise a
   ratchet is to write less copy, not to buy permission for copy that was not earning its
   place.*

---

## M16 — framed, not dispatched

**ADR-023** (thread unification, addressing grammar, mailbox — `thread-model-engineer`) and
**ADR-028** (three new widget types — `dashboards-engineer`) are **claimed on BOARD before
any file exists**, per the numbering rule that exists because allocating from a directory
listing has failed twice. Translate the plan's own ADR numbers through
`comms/decisions/README.md` before citing them; `Plan §18`'s "ADR-018" is our 023.

Ruling recorded on ADR-028: write it once, **build only `thread-feed`**. `board` needs a
drag primitive that does not exist and `calendar` reads an `ops.schedule` table that does
not exist — writing a schema for a table that does not exist produces a plausible spec.

Two hazards written into M16's section rather than discovered later:

1. **`#sales` costs one run; `@@sales` costs six** — against a hard cap that **has never
   once fired**, because zero runs have executed. The count in a cost preview is real
   (resolved member count); **the money is not** — there are no completed runs to average.
   Print the count, omit or source the money.
2. `ops.task` and `ops.question` are **absorbed, not built**. A task is a thread with a due
   date; a question is a message kind. `expires_at` stays mandatory.

`thread-model-engineer` owns `Plan §12` outright but **cannot be messaged until dispatch** —
`check-comms.mjs` fails on a roster slug with no status file, and writing that file on an
agent's behalf is a fake heartbeat. It joins the roster in the same act as writing its own
first status.

---

## Resuming

1. **Re-run the M15 acceptance gate.** It is the only thing between M15 and done. The tree
   is still and committed at `9509421`; `comms/verdicts/` is empty; eight review-requests
   are in `fidelity-qa-reviewer`'s inbox. The three PASS conditions the board set are: the
   allowlist test asserting on what the session received (`cascade-ceiling.test.ts`,
   `one-door.test.ts`), the cross-project isolation sign-off (filed, reads *structurally*
   signed off), and `validate:coverage` green (it is).

2. **The partial finding the gate died holding, which is worth chasing.** It was
   investigating which mechanical checks are structurally unable to see things — the RTL
   ratchet, the token scan, the coverage checker. Its last words were that its own filter
   had used the wrong key and the checker *does* see six strings in the place it suspected,
   **but two visible strings are still missing** and it was mid-test on why. `check-rtl`
   has had exactly this class of blind spot before (`ac4e439` — 190 strings it could not
   see), so a second one is plausible rather than speculative. Nothing was written to disk;
   this paragraph is the whole record.

3. **Do not open M16 until the gate answers.** `Plan §20`, and after this session the rule
   has earned its keep.

4. **The critical path is unchanged and is with the user:** `RUNNER_ANTHROPIC_API_KEY` and
   the twenty `COMPANY.md` answers (still 0/20). Everything empirical waits on them — the
   LIVE counter, every cost surface, promoting any agent to `status: live`, whether the
   cascade picks the agent the human meant, whether a budget cap refuses, and whether a run
   in project A stays out of project B. M16 makes the key *sharper*, not softer: fan-out is
   the first feature whose first validation run costs N× money against an enforcement point
   that has never fired once.

**Filed tonight, owned, not fixed:** `graph.json` carries no project field so a misplaced
artifact is undetectable, and `build-graph.mjs` skips `_`-folders so MAP still cannot see
`agents/_overrides/**` (latent — no override file exists) · `ledger.state` is not read on a
200, the one remaining way a dashboard could draw an unearned zero · `/metrics/*` has no
contract export, so one suffix literal survives in two consumers · the matrix is a CSS grid
so `dir="rtl"` reverses its columns and nothing pins them (not guessed at — a blanket
`dir="ltr"` is wrong, because row headers and cell text *do* mirror) · `Carousel.tsx` holds
the third copy of the arrow-key bug · `apps/web`'s own dev-server bind · no trace span
carries a project attribute, so PDPL rule 4 is only *stateable* in the trace store and
right-to-erasure has nothing to search on · push deep links still emit `/sessions/:id`, and
the fix is **not** a project slug in the payload (a plaintext partition of the user's
sessions, composed on our server, handed to FCM, rendered on a lock screen, that no server
needs to read) but the project inside `encryptedMetadata`.
