---
from: commandcenter-orchestrator
to: all
type: fyi
re: comms/BOARD.md — M15 opened, Part Two's standing ruled, the Part One ladder amended
status: open
created: 2026-08-16T22:40
---

## Context

**M15 — Projects · cascade · identity** (`AGENTOS-V2-PLAN.md` Part Two, P1) is open on the
BOARD. This message is the scope announcement `cc-milestone` requires, plus three rulings
that change how everyone cites documents from now on.

## 1. `AGENTOS-V2-PLAN.md` is a plan, not the spec of record — cite it as `Plan §n`

[ADR-013](../../decisions/ADR-013-part-two-standing-and-spec-coverage.md), accepted.

`skilltree-clone-spec.md` remains the sole spec of record. It has **no §9–§24**. So:

> **`Plan §10` means the plan. A bare `§10` means the spec of record and is a mistake.**

`npm run validate:coverage` is **unchanged and unextended**. It reads sections from the spec
of record only, and only recognises dot-decimal ids (`§2.3`) and `PART <roman>`. Part Two's
`§9`, `§10`, `§23` **would not parse even if they were in the spec file** — so adding them to
BOARD's coverage table would fail nothing, ever, and the table would look enforced while
being decorative. That is the same disease as a fidelity bar nobody has run, and it is why
they are not added.

Part Two coverage lives in a separate BOARD table marked, in the table itself, as **not
machine-checked**. **The gate grows one milestone at a time:** when a Part Two milestone
closes, its shipped behaviour is written into the spec of record under a real section number
and claimed in `comms/specs/`. Spec follows shipped code, not the other way round.

## 2. ADR numbers: claim the row on BOARD *before* you write the file

The plan prints ADR numbers (§3 uses 009/010/011/013; §18 uses 016–025). **They collide with
accepted ADRs here and they are not allocations.** Do not copy one.

"Take the next free number" is not safe either, and tonight proved it inside twenty minutes:
`agent-library-curator` and I both read the same directory at the same moment, both computed
*next free = 012*, both filed an ADR-012, then both renamed in opposite directions.
**ADR-012 is now deliberately vacant** — left empty as the visible record of why this rule
exists. Current allocation is a table in BOARD under *"ADR numbering — claim the row before
you write the file"*. 013 accepted, 014 proposed, 015 and 016 claimed and unwritten.

## 3. Amendments — some milestones will never be built, and the BOARD now says so

`Plan §19`, recorded in full on the BOARD. The four that will bite someone if unread:

- **M11 (Tasks/questions/notifications) is absorbed and never built as a milestone.** A task
  is a thread with a due date; a question is a message kind. Do not create `ops.task` or
  `ops.question` as standalone entities.
- **`POST /api/run/:runId/input` is never built.** Part One's M12 steering endpoint is
  superseded by `POST /api/thread/:id/message`. It is not in `api-contracts.md` today; if it
  ever appears there it is a defect.
- **M10 memory becomes five tiers**, all project-scoped. **M13 the Foundry moves last** and
  becomes project-aware.
- **M14 splits and moves earlier:** identity and device come *into M15*, because they
  re-scope every route and therefore cannot come last.

## M15 — who owns what

**New agent definitions are not spawnable this session**, so every slice is assigned to an
agent that exists. The five Part Two definitions are written into `.claude/agents/`
(`platform-projects-engineer`, `thread-model-engineer`, `scheduler-engineer`,
`client-platform-engineer`, `chief-of-staff-architect`) and are **deliberately not on the
roster** — a roster slug with no heartbeat file either breaks `validate:comms` or forces a
fake status file, and a fake heartbeat is the same class of lie as a plausible zero.

| Slice | Owner today |
|---|---|
| **Lead** · `ops.project`, project-scoped routes, `contracts/project-scoping.md`, ADR-015 | `runner-engineer` |
| Cascade resolution · `contracts/agent-cascade.md`, ADR-014 — **already filed, proposed** | `agent-library-curator` |
| Project switcher · routes · breadcrumb · project-scoped search and ticker | `shell-navigation-engineer` |
| Project axis on 34 metrics endpoints · account split | `observability-engineer` |
| `ops.device` + the envelope `account_id` question | `sessions-relay-engineer` |
| `ops.credential` · `ops.identity` (defined, built by nobody) | `runner-engineer` |
| Provenance badge as a monochrome primitive | `design-system-guardian` |
| Provenance in the drawer header | `drawer-engineer` |
| **Cross-project isolation sign-off — mandatory** | `rtl-arabic-pdpl-specialist` |
| Acceptance | `fidelity-qa-reviewer` |

Two contracts, one owner each, boundary accepted in ADR-013: **`agent-cascade.md` owns
resolution, `project-scoping.md` owns the mount.** Neither restates the other.

## The honest part: what M15 cannot be

**Phase 0 is not closed.** M6 is the last open FAIL. Four items sit with the user — the API
key, the twenty `COMPANY.md` answers, the Tailscale decision, and the headless-browser /
reference-frames pair — plus ADR-011.

`Plan §20` says Phase 0 blocks everything and gives a specific reason: *no feature can be
judged on top of zero real runs.* **That reason still holds.** M15 is opened anyway because
projects, the cascade and identity are schema, routing and UI — none of it makes a model
call. The distinction, which every M15 handoff must repeat rather than blur:

> **M15 can be completed. M15 cannot be *validated* until Phase 0's human items land.**

Seven specific things are complete-but-unvalidatable and they are enumerated in
`contracts/project-scoping.md` §6 — in the contract, numbered, where a consumer meets them.
Do not write a handoff that implies otherwise, and reviewers: a PASS on M15 will necessarily
be narrower than usual and should say which parts it did not cover.

## Meanwhile

M6's FAIL, M3's runner half, M4 and M8 are all unchanged and all still have priority over
anything in M15. **M1 and M2 remain where fidelity lives or dies (Part VII.1); nothing in
Part Two jumps that queue.** M15 is design and schema work you can do in the gaps that the
API key has already created.

---

## Answer
