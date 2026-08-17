# decisions/ — ADR numbering, and the plan concordance

**Read this before you allocate a number.** If you are here because you ran
`ls comms/decisions/` and took the next free integer, that is the method that has now failed
twice. It is not safe and this file exists to stop the third time.

## The rule

**Allocation is claimed in `comms/BOARD.md` by `commandcenter-orchestrator`, before the file
is written.** Write the row first, then the file. BOARD is the only allocation authority;
this file is **translation only** and allocates nothing.

Why the obvious method fails, twice over:

1. **Two agents observing the same directory allocate the same number.** On 2026-08-16
   `agent-library-curator` and `commandcenter-orchestrator` both computed *next free = 012*
   from the same listing at the same moment, both filed an ADR-012, then both renamed in
   opposite directions. **012 is deliberately vacant** as the visible record of why.
2. **The directory is not the only claimant.** `AGENTOS-V2-PLAN.md` allocates ADR numbers in
   two of its own sections, and they collide with six files here. A listing cannot see that.

`decisions/` is the **only** shared-integer namespace in this repo — every other filename
under `comms/` embeds its author's slug (`M<n>-<agent>-<topic>`, `<ts>-<sender>-<topic>`, one
status file per agent), so no other namespace can be raced. If a second shared-integer
namespace is ever introduced, it inherits this rule on day one.

## The concordance — `AGENTOS-V2-PLAN.md`'s numbers are not this repo's numbers

**Ruling: ADR-013, amendment 2026-08-17.** Filed ADRs keep their numbers; the plan's numbers
are re-allocated. The deciding principle: *you cannot renumber a decision that has already
been acted on — allocate against the side with no dependents.* The plan's numbers have zero
files, zero code and zero tests behind them; the filed ones are cited in BOARD, four
contracts, and answered messages that ADR-000 makes append-only.

**When the plan cites an ADR number, translate it here first.** A citation followed literally
lands on an unrelated decision.

### `Plan §3` (lines 84–143) — the six collisions

| Plan says | Plan means | Read it as | Status |
|---|---|---|---|
| ADR-009 | Two planes: Library (git) + Operations (Postgres) | **ADR-017** | reserved, unwritten |
| ADR-010 | MCP runtime and credential custody | **ADR-018** | reserved, unwritten |
| ADR-011 | Memory tiering and write authority *(§18 amends to five tiers)* | **ADR-019** | reserved, unwritten |
| ADR-012 | Task-board semantics | **ADR-020** | reserved, unwritten |
| ADR-013 | Auth exists in v2 — **see the caveat below** | **ADR-021** | reserved, unwritten |
| ADR-014 | Foundry token-budget policy | **ADR-022** | reserved, unwritten |

### `Plan §18` (lines 965–975) — a second allocation, on a different offset

| Plan says | Plan means | Read it as | Status |
|---|---|---|---|
| ADR-016 | Project scoping + the cascade and its resolution order | **ADR-014 + ADR-015** — already filed/claimed. *Not* re-allocated: the content landed here first, split across two owners | 014 proposed · 015 claimed |
| ADR-017 | Identity vs device vs billing account | **ADR-016** — already claimed | claimed, unwritten |
| ADR-018 | Thread unification, addressing grammar, mailbox | **ADR-023** | reserved |
| ADR-019 | Scheduler ownership, six trigger types | **ADR-024** | reserved |
| ADR-020 | Client strategy — Expo, Tauri, contentless push | **ADR-025** | reserved |
| ADR-011 *(amended)* | Memory at five tiers | folds into **ADR-019** | reserved |
| ADR-021 | Work products and worktree isolation | **ADR-026** | reserved |
| ADR-022 | Chief of Staff — routing, delegation, trust ladder | **ADR-027** | reserved |
| ADR-023 | Three new widget types (`board`, `calendar`, `thread-feed`) | **ADR-028** | **accepted 2026-08-18** — the cap is the decision; only `thread-feed` is built |
| ADR-024 | Drag without a dependency | **ADR-029** | reserved |
| ADR-025 *(optional)* | Renaming CHART to ROLLOUT | **ADR-030** | reserved |

**The plan file is deliberately not edited.** It is the user's, committed at `56e93cf`.
Rewriting twenty-odd citations inside someone else's plan of record is the quiet
cross-boundary edit this repo forbids. Amending it is **recommended to the user** and is on
BOARD as an open item. Until then, this table is the bridge.

## One citation that means two things

`Plan` line 110 heads a section **"ADR-013 — Auth exists in v2 (amends BOARD constraints #5
and #6)"**. `Plan §11` line 649 says **"Transport stays as ADR-013 proposed: tailnet-only for
v2."** Both are in the plan and they describe different things. Two readers took them two ways
in one evening.

| | v2 | BOARD #5 amended? |
|---|---|---|
| **Identity / auth** — accounts, devices, scopes, per-account billing | **exists**, *inside* the tailnet | Yes — *"no auth in v1 by design"* is superseded by Part Two |
| **Transport** — public ports, exposure | **unchanged.** Tailnet-only | **No.** *"No public ports"* survives. Authelia in front of Caddy is a *later* ADR (Part One §8; Plan line 995: *"not further amended here"*) |

**v2 gains accounts. v2 does not gain a public surface.** Quote both halves or neither.

## Filed decisions

Authoritative status lives in BOARD's register. `ADR-012` is vacant on purpose — do not
reclaim it to tidy the sequence; it is load-bearing as a record.
