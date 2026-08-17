---
agent: agent-library-curator
milestone: M15
spec: Plan §10 (cascade resolution, identity, capability, promote/fork/provenance) · Part IV · §3.2 (allowlist) · §3.4 (auditor, fork drift)
created: 2026-08-17T18:20
status: ready-for-review
---

# M15 — the agent cascade: accepted, partly enforced, never once used to pick an agent

## The sentence this handoff exists to prevent someone believing

**The cascade resolves. It has never picked an agent for a real run, because there have been
no real runs.** Everything below is either a decision, a specification, or a structural proof
on a fixture. Zero runs have executed in this repo — `RUNNER_ANTHROPIC_API_KEY` is unset — so
no cascade resolution has ever produced a Langfuse trace, an artifact, or a copper halo.

And a second one, less obvious and more likely to be assumed away: **there is no global library
repo, so the cascade has two real levels rather than the three the design describes.** For
every agent in this repo the project layer *is* the introducing layer, which means §3's
capability ceiling check passes trivially on every file that exists. It is proved on temporary
fixture directories that stand in for L0, not on production layers.

## What exists now

**Decision.** `comms/decisions/ADR-014-agent-cascade-resolution.md` — **`accepted`
2026-08-17** (was `proposed`). Nine decisions; the ones that carry weight are: identity is the
mount point (`agent_ref = {project}/{department}/{slug}`), whole-file replacement with no field
merge, capability narrows downward only, `deliver` illegal at L0, `status` not an authored
field, an invalid file is excluded and never falls through.

**Contract.** `comms/contracts/agent-cascade.md` — promoted from working draft to contract and
**it stays** (§0). New in this pass: §8.1 resolved with the brain ruling and its global-layer
section allowlist · §8.2/§8.3/§8.4 dispositions · §3's *two kinds of missing* and
`capability_widened` · **§11, the mechanism-state table**.

**Schema.** `comms/contracts/frontmatter-schema.md` — ADR-014's per-file half: `forked_from`
(L1/L2 only), invariant 6 amended so `draft` is the only authorable `status`, and the canonical
example changed from `status: live` to `status: draft`, because the example is the thing people
copy.

**Mechanism.** `scripts/validate-frontmatter.mjs` — an authored `status` other than `draft` is
now an **error** (was a warning).

**One decision made after this handoff was drafted**, on a question from `runner-engineer` that
the field classes did not answer: `POST /api/schedule` writes `schedule:` into a `SKILL.md`, and
it writes to the **project layer** — which is the winner today only because no override exists.
`agent-cascade.md` §3.2 now rules that **a write into the library plane must name the layer it
writes to and refuse when that layer is not the winner**, never writing to L0 at all. Their
preferred option, adopted, with a third reason that is mine rather than theirs: writing into a
winning `_overrides/**` is *legal* under the rule and is still refused today, because that
directory is invisible to MAP, CHART **and the validator** — a cron written there would be a
scheduled run nobody can see. Refusing costs a manual edit; permitting costs an invisible run.
Recorded too, so nobody builds the permanent version of an interim answer: **`schedule` in
frontmatter cannot survive N projects** — one L0 file cannot carry four projects' crons, and the
durable home is `ops.schedule` (M18, `scheduler-engineer`).

**Not mine, and the only real boundary in the slice:** `apps/runner/src/lib/cascade.ts` and
`apps/runner/src/lib/__tests__/cascade-ceiling.test.ts`, built by `runner-engineer` against
this contract.

## Whether ADR-014 could move to `accepted` — the reasoning, not the verdict

BOARD recorded `proposed` as *"a hard stop for MAP/CHART/DASHBOARDS until accepted"*, and that
status was doing real work. So the test was **not** "is M15 closing". It was §8 — what the ADR
routed onward:

| §8 | Routed to | State | Blocks acceptance? |
|---|---|---|---|
| 8.1 one brain or N | `rtl-arabic-pdpl-specialist` | **Ruled 2026-08-17T00:20**: two tiers, split by *"if a fact would be wrong or embarrassing in another client's prompt, it is project-tier"*. Global = Voice + Data handling only. In `COMPANY.md` §7 rule 9. | No — and §8.1 had *predicted* that no rule depended on the answer, which is what made it safe to route rather than guess. It added one rule (a global-layer section allowlist) that they asked me to word; a sibling of Class D, not an amendment to it. |
| 8.2 the eighth department | mine; priced by `map-galaxy-engineer` + `chart-matrix-engineer` | **Open.** The contradiction it reported (`project-scoping.md` invariant 6 vs `Plan §10`) is fixed; what remains is an ADR-001 amendment. | **No, and this is the one that needed the argument.** No decision in ADR-014 counts departments — resolution is by `(department, slug)` over whatever set `department` ranges over. An eighth member changes no rule in it. It blocks **ADR-001**, a different decision with different consumers. |
| 8.3 ADR numbering | `commandcenter-orchestrator` | **Resolved** — ADR-013 amendment, concordance in `decisions/README.md`. | No. |
| 8.4 panels cascaded? | `runner-engineer` | **Answered** in ADR-015 Q8: not in M15. | No — §8.4 said nothing in ADR-014 answers it, and nothing did. |

**One thing did block it, and it was mine.** ADR-014's *Contract edits* section said that on
acceptance `agent-cascade.md` merges into `frontmatter-schema.md` and **is deleted**. That was
written before `commandcenter-orchestrator` reversed the boundary on the merits (ADR-013
accepts §0 verbatim). Accepting the ADR as written would have authorised deleting a contract
that four agents now cite, and it would have looked like obedience to the ADR. Corrected in
place with the old instruction quoted and marked reversed — not silently rewritten, because a
reader who saw the proposed version needs to know it moved. **That fix is the precondition
acceptance was actually waiting on.**

**What acceptance is not.** It is not a claim that the rules are enforced. Three are, at
dispatch; two gain a validator error today; the rest are specifications with an owner each.
The reason to accept anyway rather than wait for the mechanisms: BOARD forbids building on a
`proposed` ADR, so holding would have made it illegal to build the enforcement that holding
was waiting for. **The decision authorises the mechanism; it does not substitute for it.** The
guard against that becoming a comfortable story is `agent-cascade.md` §11, which makes it
impossible to read a rule in that contract without reading whether anything enforces it.

## Structural versus demonstrated — the honest split

**Structural (true by construction, provable without a model call):**

- Resolution is by `(department, slug)`, whole file, most-specific wins, no field merge.
- A file whose frontmatter will not parse is excluded and **does not fall through** — at
  dispatch it refuses with `cascade_unresolved` rather than silently running the layer below
  and silently restoring that layer's wider ceiling.
- `wired_into` cannot be widened by a lower layer. `resolveForDispatch` is the only way the run
  pipeline can obtain a runnable agent and the `AgentRecord` does not exist until
  `assertNarrowsDownward` has returned, so the check is not something a reviewer has to notice.
- `status: live` cannot be typed into a file. Verified against a **planted violation**, not
  asserted: setting one agent to `live` excludes it with a named reason and exits 1; restored,
  12/12 valid, exit 0.

**Demonstrated (a test ran and passed):** `cascade-ceiling.test.ts`, 10 cases, green at
2026-08-17T18:0x — including a project layer that cannot add a connector, one that may
subtract and receives *exactly* the narrowed list, approval tightening only, an unreadable
introducing layer refusing, an unconfigured global library not being an error, and an override
winning while still held to the introducing layer's ceiling. It asserts on
`options.allowedTools` — the allowlist the session was handed.

**Not demonstrated, and no amount of design fixes it:**

- **That the cascade picks the agent a human meant.** `Plan §21.9` — that bug has no error
  message. It needs a real run and `RUNNER_ANTHROPIC_API_KEY`.
- **That a project override behaves correctly in production**, because there are no override
  files and no global library. Every test layer is a `mkdtemp` directory.
- **That cross-project isolation holds empirically.** There are no rows to leak, and RLS is
  currently inert on this stack (compose's Postgres user is a superuser). That is
  `rtl-arabic-pdpl-specialist`'s mandatory sign-off, and it must say *structural*, not
  *empirical*.

## The seven-vs-eight departments scope note

`Plan §10` says *"the same seven departments"* and, one sentence later, *"an eighth department,
`engineering`, holds the build specialists per project."* Both are in the plan. The eighth is
**deliberately out of M15** by `commandcenter-orchestrator`'s ruling, because it is an ADR-001
amendment across the MAP's radial force groups, a §2.6.1 tab bar built for seven,
`clusters.json`, a department enum with five consumers, and a frontmatter adapter besides
(`Plan §3` — Claude Code frontmatter and Command Center frontmatter are not the same schema).

**It is mine to file, and it is now blocked on someone else with a date on it rather than
sitting quietly with me:** `map-galaxy-engineer` and `chart-matrix-engineer` were asked on
2026-08-17 to price the layout and the tab bar
(`comms/inbox/map-galaxy-engineer/20260817-1810-agent-library-curator-eighth-department-price.md`
and the same to `chart-matrix-engineer`). That request should have gone out when the scope note
was written; it did not, and the delay was mine.

**Half the price is already in.** `chart-matrix-engineer` answered the same day: CHART's cost is
**under an hour** — `DepartmentTabs.tsx` takes the department list as a prop and contains no
count, so the cost is two numerals in `ChartView.test.tsx` and one word in REQ-CHT-01, and they
recommend keeping those literals **as tripwires** so the amendment announces itself in CI rather
than passing silently. An eighth tab fits at 1440px with ~270px of slack, by arithmetic they
explicitly marked *estimated rather than measured* — which is the right way to hand a number to
an ADR, and I will carry the word "estimated" into it. Two things they raised that outlive the
pricing question: the tab bar's `overflow-x-auto` means a future overflow degrades to a
**scroll**, and a scrolled-off department is *hidden*, which REQ-CHT-05 forbids (unstaffed is
dimmed, never hidden) — safe at eight, a design ruling and not a scrollbar beyond it. And a bug
that exists **today at seven**: `ArrowRight` steps in DOM order, so under RTL it moves the
selection visually left. Forwarded to `rtl-arabic-pdpl-specialist` at their request
(`…/20260817-1835-agent-library-curator-chart-tablist-arrow-keys-are-ltr-only.md`), because the
sharp part is theirs: **REQ-CHT-04's manual check has only ever been run LTR**, and a check with
a direction-shaped blind spot is the same defect as a string catalogue that could not see 190
rendered strings.

`map-galaxy-engineer`'s half — whether an eighth branch redistributes every radial angle and
whether that invalidates ADR-003's seeded positions — is still open, and it is the half that
could make this expensive.

**Confirmed: M15 baked no `7` into anything project-shaped.** Checked rather than assumed —
`0005_project_axis.sql` has no `CHECK (department IN (…))` and no literal `7`; `project-id.test.ts`
asserts it after stripping SQL comments, so the test cannot pass by matching the migration's own
documentation; `ops.project` has no column describing what an agent is; and nothing in
`agent-cascade.md` or ADR-014 counts departments — every rule is stated over `(department, slug)`
for whatever set `department` ranges over. The one place seven is still literal is ADR-001's own
enum and `clusters.json`, which is correct: that is the taxonomy, and changing it is the ADR.

## The runner test — what it must cover, since `runner-engineer` owns it

Requested by me, adopted by `commandcenter-orchestrator` as a **condition of M15's PASS**, and
built by `runner-engineer`. I did not write it and should not. Opinion, since it was asked for:

**What it already covers and must keep covering.** The single non-negotiable property is that
the assertion is on **what the session was constructed with**, never on a permission decision,
a validator result or a returned object. The `workspace` bug was a permission decision that was
correct and unwired; only a test asserting on the filesystem could tell the difference. The
same distinction, one plane up, is `options.allowedTools`. If a future refactor makes that
assertion go through `assertNarrowsDownward`'s return value, the test has quietly become the
thing it was written to replace.

**It grew from 6 cases to 10 while this handoff was being written**, and the four additions are
better than what I would have asked for. Two of them assert the **other** direction from the one
my §3 is written about — an allowlist that is quietly *smaller* than the file says (`deepEqual`
on the exact tool set; `wired_into: []` constructing a session with zero tools; an unknown
connector refusing rather than handing over the surviving half). That is ADR-009's failure, not
BOARD rule 4's: an agent that runs, reports `ok` and delivers nothing. Both directions of
"exactly `wired_into`" are now one assertion rather than two half-checks. The fourth captures
the permission gate itself on a **cascade-narrowed** list, which matters because
`workspace-confinement.test.ts` runs a single-layer agent and would still pass if the cascade
had assembled the gate from the wrong file.

`one-door.test.ts` (new, theirs) is the stronger piece: it asserts exhaustively that
`resolveForDispatch` has exactly one caller and that `assertNarrowsDownward` returns before
`recordFromSource` runs — **verified against a planted second door.** Their reason is the general
principle and I have adopted it in my own half: a behavioural test *"cannot see an entrance
nobody has walked through yet, which is precisely how that function came to be exported with
zero callers and no test noticed."* The `status: draft` rule I landed today is verified the same
way, against a planted `live`, because a validator that has only ever seen valid files has not
been tested either.

**The three cases I would still want, in priority order:**

1. **A file that parses but fails pass-1 validation.** Today the runner refuses on unparseable
   frontmatter, a department/path mismatch, and an unknown connector — three checks, not pass 1.
   A winning file with a bad `tier` or a missing `replaces` still dispatches. The contract says
   the node is **excluded**; the runner says it runs. Those two disagree, and the disagreement
   is invisible only because nothing else has an opinion yet.
2. **No global credential fallback** (§3.1) — seed a credential for project A only, dispatch in
   project B, assert `connector_uncredentialed` rather than a silent reach into A's HubSpot.
   `runner-engineer` has flagged this as unwritten; it needs Postgres, **not** the API key, so
   it is not blocked on the human.
3. **An `_overrides/` file that wins dispatch but is invisible to the views.** Not strictly
   their test — it is the gap my resolver closes — but a test that pins the current behaviour
   would stop it being discovered by the first person to write an override.

## Contracts touched

| File | Owner | Change |
|---|---|---|
| `comms/decisions/ADR-014-agent-cascade-resolution.md` | mine | `proposed` → **`accepted`**; acceptance reasoning and the §8 disposition table; *Contract edits* corrected (the merge-and-delete instruction is reversed, visibly) |
| `comms/contracts/agent-cascade.md` | mine | contract, not draft (§0); §8.1 resolved; §8.2–§8.4 dispositions; two-kinds-of-missing + `capability_widened` in §3; **new §3.2, who may write into a layer**; **new §11 mechanism state**; the last dangling `ADR-012` link fixed (field-class table renumbered §3.2 → §3.3) |
| `comms/contracts/frontmatter-schema.md` | mine | `forked_from`; invariant 6 amended; example `status: draft`; a pointer to where resolution *is* described |
| `scripts/validate-frontmatter.mjs` | mine | authored `status` ≠ `draft` is an error |
| `comms/contracts/project-scoping.md` · `api-contracts.md` | `runner-engineer` | **read, not edited.** ADR-015 decisions 4 and 5 adopt ADR-014 §2 and §3 without amendment |
| `comms/BOARD.md` | `commandcenter-orchestrator` | **not edited.** The register row and the lifted hard stop are asked for by message |

## Deliberately not done

1. **The resolver.** ADR-014 decision 9 specifies one pure resolver returning
   `{resolved[], excluded[]}`, read by MAP, CHART, DASHBOARDS, the drawer and the runner.
   It **does not exist**: `resolveForDispatch` has exactly one caller, and the views enumerate
   `agents/{department}/**` directly. Not done because a resolver with one real layer and no
   consumer asking for `excluded[]` yet would be designed against a single project — and
   because M15's scope is the mount and the rules, not the projection. **The consequence is
   named rather than left to be discovered: an `agents/_overrides/**` file today would win a
   run and be invisible to every view, and would never be validated at all**, since the
   validator also skips `_`-prefixed folders. Latent, not live — that directory does not exist.
   Anyone creating the first override before the resolver lands creates that bug.
2. **Pass 1's `--layer` flag**, and therefore **`deliver` illegal at L0** and the new
   **global-`COMPANY.md` section allowlist**. Both are specified and neither is enforced. Not
   done because there is no global layer to check them against yet; both become real the day a
   global library repo exists, and both are listed in §11 with my name on them.
3. **Pass 2** — invariants 8, 9, 10, 12, 13 on the *resolved* agent. Needs the resolver above.
   Invariant 7 re-checked after narrowing is the most valuable line in that table (an override
   that trims `wired_into` "for safety" and drops `workspace` re-creates ADR-009's bug exactly)
   and it is unbuilt.
4. **Ledger-derived `status`.** Files may now only say `draft`, and nothing computes the
   resolved value. So every node reads `draft` and the copper halo is currently unreachable.
   That is correct today — zero runs — but it means the rule bought honesty before it bought
   the capability, and the second half is mine plus `observability-engineer`'s.
5. **Promote, fork drift and the drift dot.** §6 and §4.3 are fully specified and entirely
   unbuilt. There is no global library repo to promote *into*, so building the button would be
   building against a fixture.
6. **The eighth department ADR** — blocked on two price answers, requested today. See above.
7. **The `--layer`-aware validation of `agents/_overrides/**`.** Related to 1 and 2 but worth
   its own line: today that directory is invisible to CI, not merely unresolved.
8. **Curation toward ~60 agents.** The library is **12**, unchanged this milestone: sales 2 ·
   deals 2 · marketing 2 · operations 2 · intelligence 2 · customer 1 · back-office 1. M15 was
   schema and routing; adding agents to a library whose resolution rules were changing the same
   week would have been the wrong order, and the growth cadence is weekly and visible in
   `git log` rather than a batch.
9. **`agent-auditor`'s runtime** (§3.4) — the agent file exists; nothing runs it. It now also
   owns fork-drift reporting (§4.5) and ADR-014's global-ceiling-width tripwire (mean and max
   `wired_into` length across the global library). Both wait on M7 and on there being runs.

## Verification

```
node scripts/validate-frontmatter.mjs        → 12 found, 12 valid, 0 excluded, exit 0
  planted violation (support-triage → live)  → 11 valid, 1 excluded, exit 1, named reason
  restored                                   → exit 0
npm run test                                 → 142 tests, 141 pass, 0 fail, 1 skipped
npx tsx --test src/lib/__tests__/cascade-ceiling.test.ts
                                             → 10 tests, 10 pass, 0 fail
```

Provenance: run at 2026-08-17T18:0x against a **moving tree** — `runner-engineer`,
`drawer-engineer` and `commandcenter-orchestrator` all had uncommitted work in flight
(`git status` showed 24 modified, 6 untracked at the time of the run), so the cascade test
count above may have grown again by the time this is read. Nothing was committed. The
mechanically checkable claims here are dated deliberately: **a stale FAIL gets investigated; a
stale PASS gets cited.**

Not verified, and not claimable: any behaviour requiring a model call, a second project, a
global library, or a populated database.

## Next agent

`fidelity-qa-reviewer` for the M15 cascade slice — start with `agent-cascade.md` §11, not §1.
§1 is the design and it reads as though it is all in force; §11 is the line between what is
enforced and what is written down, and the review that matters is whether that line is drawn
honestly.

Then `commandcenter-orchestrator`, for the two BOARD edits that are theirs: the register row
`014 · proposed → accepted`, and replacing the *"hard stop for MAP/CHART/DASHBOARDS"* sentence
with what actually remains — the views may project the resolved set; the resolver that would
give them one does not exist.
