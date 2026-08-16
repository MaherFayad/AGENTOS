---
agent: commandcenter-orchestrator
milestone: M15
spec: AGENTOS-V2-PLAN.md Plan §9 · §10 · §11 · §19 · §20 · §22 · §23.12 (a plan, not the spec of record — ADR-013)
created: 2026-08-16T22:42
status: ready-for-review
---

# M15 — the milestone is opened, not built

No feature code. This handoff is the opening of Part Two's first milestone, a ruling on how
Part Two relates to the spec of record, and five agent definitions written for a roster that
cannot yet run them.

## What exists now

**Five agent definitions** (`Plan §22`), schema-identical to the existing thirteen —
`name` / `description` / `tools` frontmatter, ownership line, `Load first:`, non-negotiables,
coordination, handoff instruction:

- `.claude/agents/platform-projects-engineer.md` — `Plan §9`–§10
- `.claude/agents/thread-model-engineer.md` — `Plan §12`
- `.claude/agents/scheduler-engineer.md` — `Plan §14`
- `.claude/agents/client-platform-engineer.md` — `Plan §16`, §23.9
- `.claude/agents/chief-of-staff-architect.md` — `Plan §17`

`control-plane-engineer` is dissolved before it ever existed (`Plan §22`); no definition
written and none should be.

**One ADR** — `comms/decisions/ADR-013-part-two-standing-and-spec-coverage.md`, accepted.

**One contract skeleton** — `comms/contracts/project-scoping.md`. Marked **not
authoritative**: §2 is twelve invariants Part Two already fixes, §5 is the open questions
each owner must answer before code, §6 is what cannot be validated and why.

**`comms/BOARD.md`**, amended in six places: the header's Phase-0 honesty note; a Part Two
ladder with the M15 ownership table; the Part One amendments table; a Part Two roster section
for the defined-but-not-rostered five; the ADR allocation table; a Part Two plan-coverage
table marked not-machine-checked, and one paragraph in the spec-coverage section saying
exactly what the gate does not cover.

**Seven messages** — one broadcast, six targeted, one of which is a `decision-request` to
`agent-library-curator` accepting their contract boundary.

## How to use it

Read `comms/BOARD.md` §*Part Two ladder* for the M15 ownership table, then the contract
listed against your name. **Cite Part Two as `Plan §10`, never `§10`.**

## The three rulings

**1. Part Two is a plan that amends the spec of record.** `npm run validate:coverage` stays
pointed at `skilltree-clone-spec.md` and keeps its exact current meaning.

The mechanical fact that decided it: `check-spec-coverage.mjs` reads sections from one file
via `/^##\s+(\d+\.\d+)\s+(.+)$/`, and BOARD ownership via `/§(\d+\.\d+)|\bPART\s+([IVX]+)\b/g`.
Both require a **dot-decimal** id. Part Two's `## 9.` and `§10` match neither. **Adding Part
Two rows to the coverage table would parse to zero entries and fail nothing, ever** — the
table would look enforced and be decorative. That is the `BOARD.md:7` disease and refusing it
is the whole ruling. Part Two coverage goes in a separate table that says, in the table, that
it is not checked. The gate grows one milestone at a time, when shipped behaviour is written
back into the spec under a real section number.

**2. ADR allocation is claimed in BOARD before the file is written.** The plan's printed
numbers collide with accepted ADRs. "Next free number" is not concurrency-safe either:
`agent-library-curator` and I both filed an ADR-012 within twenty minutes, from the same
directory listing, then both renamed in opposite directions. **012 is deliberately vacant.**

**3. `agent-cascade.md` owns resolution; `project-scoping.md` owns the mount.** The curator's
§0 asked me to accept or re-route and said my routing wins. Accepted verbatim — it is better
than my draft, which folded resolution into `frontmatter-schema.md`. That schema describes
one file; the cascade describes which of three files wins. I deleted seven cascade questions
from my own draft rather than keeping them "for reference": a question asked in two contracts
is one contract with two readings.

## Contracts touched

New: `comms/contracts/project-scoping.md` (skeleton, owner `runner-engineer` **in trust** for
`platform-projects-engineer`). Changed: none. `agent-cascade.md` is the curator's and was not
edited — six stale `ADR-012` references in their files were raised with them, not fixed by me.

One routing header was changed in someone else's message:
`inbox/_all/20260816-2346-agent-library-curator-…` had `to: [four agents]` while filed in
`_all/`, which **failed `check-comms` and was taking `npm run verify` red for everyone**.
Changed to `to: all`, content untouched, an HTML comment appended explaining it, and raised
with the sender. Comms hygiene is my product; content is not mine to touch.

## Deliberately not done

- **`identity-access-engineer` was not written.** `Plan §22` creates five specialists and
  **none owns §11** — the plan's intended owner is carried over from Part One §6 and was
  never defined. Writing an uninstructed sixth specialist is a roster decision, and roster
  decisions are the user's. Raised as a question on BOARD *with a recommendation to write
  it*. Interim: `ops.device` → `sessions-relay-engineer`, `ops.credential` →
  `runner-engineer`, `ops.identity` → defined, built by nobody.
- **Scopes enforcement is out of M15 scope.** BOARD #5 says there is no auth boundary in v1
  by design, and a scope with no enforcement point is a comment. Building it now means
  building against no threat model.
- **`contracts/thread-model.md`, `scheduling.md`, `client-sync.md`, `orchestration.md` were
  not created.** Named in `Plan §22`, but their milestones are not open and their owners
  cannot run. An empty contract with no owner is worse than no file.
- **The five new agents were not added to the BOARD roster table.** `check-comms.mjs` fails
  when a rostered agent has no `comms/status/` heartbeat. The choices were a broken validator
  or a placeholder status file, and a fake heartbeat is the same class of lie as a plausible
  zero (rule 9). They sit in their own section until they can run.
- **Part Two sections were not added to the machine-checked coverage table.** See ruling 1.
- **Provenance badges on MAP nodes and CHART job cards are deferred.** `Plan §23.2` wants
  four surfaces; M15 ships shell + drawer. One vertical slice beats four at 60%.
- **The M9–M14 rows were not added to the board as buildable milestones.** They were never
  on it. Their *fates* are recorded instead, because a board listing milestones nobody will
  build is a board people stop reading.
- **Nothing was committed.** ~95 files from six agents plus whatever `dashboards-engineer` is
  landing are uncommitted, and the seven-way split has not been reviewed by the user.

## Verification

`node scripts/check-comms.mjs` — green. 14 roster agents, 160 messages, 7 contracts, 14
decisions, 0 errors. It was **red before this session's work** on the curator's misrouted
broadcast; that is now fixed. One pre-existing filename warning remains, untouched.

`node scripts/check-spec-coverage.mjs` — unchanged: 609 requirements, 572 implemented (94%),
37 declared-unbuilt, **0 errors**. Confirms ruling 1 empirically: the coverage numbers did not
move despite two new contracts and a new milestone, because the gate does not see Part Two.

Not run: `test`, `test:web`, `test:runner`, token and RTL checks. No code changed, and the
tree is not still — `dashboards-engineer` is landing M6 concurrently.

## Next agent

`runner-engineer` leads. First read: `comms/BOARD.md` *Part Two ladder*, then
`comms/contracts/project-scoping.md` §5.1, then `comms/contracts/agent-cascade.md` §0 to see
where the boundary sits. ADR-015's number is already claimed.

`fidelity-qa-reviewer`: nothing user-visible here, so no review is requested for M15's
opening. When M15's slices arrive, note that a PASS on them will be narrower than usual —
`project-scoping.md` §6 lists the seven things no reviewer can cover until the human items
close, and a verdict that does not say so inherits the `BOARD.md:7` problem.
