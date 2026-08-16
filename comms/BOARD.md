# BOARD — Command Center build

**Spec of record:** [skilltree-clone-spec.md](../skilltree-clone-spec.md) — every decision
traces back to a section number in it. Quote the section when you cite it.

**Second document:** [AGENTOS-V2-PLAN.md](../AGENTOS-V2-PLAN.md) — Part One (§1–§8) and Part
Two (§9–§24). It is **a plan that amends the spec of record, not a second spec**
([ADR-013](decisions/ADR-013-part-two-standing-and-spec-coverage.md)). Cite it as `Plan §10`;
a bare `§10` always means the spec of record, which has no §10.

**Current milestone:** `M15 — Projects · cascade · identity` (Part Two, P1) **opened
2026-08-16** · `M3 — Runner + Run now + Langfuse` (unblocked by M2; the runner half waits on
the human for `RUNNER_ANTHROPIC_API_KEY`) · `M6 — DASHBOARDS` (FAIL open, fix in flight) ·
`M4 — SESSIONS` (relay unverified against a bootable Happy) · `M8` ongoing.
M0, M1, M2 and M5 are **done**.

**Phase 0 is not closed, and M15 is opened anyway — on purpose, with the reason stated.**
`Plan §20` says Phase 0 blocks everything, and its reason is specific: *no feature can be
judged on top of zero real runs*. That reason still holds and nothing below weakens it. M15
is nonetheless **buildable**, because projects, the cascade and identity are schema, routing
and UI — none of it makes a model call. The distinction that matters, and which every M15
handoff must repeat rather than blur:

> **M15 can be completed. M15 cannot be *validated* until Phase 0's human items land.**
> Complete means the schema exists, the routes carry a project, the cascade resolves and the
> switcher works. Validated means a real run in project A was proven not to appear in project
> B, the cascade was proven to pick the agent the human meant, and a budget cap was proven to
> refuse. The second list needs `RUNNER_ANTHROPIC_API_KEY`, the twenty `COMPANY.md` answers,
> the Tailscale decision and the reference frames — all four are with the user, below.
> The full list is `contracts/project-scoping.md` §6, and it is a section of the contract
> rather than a footnote because consumers need to read it.

**Fidelity bar — read this before you trust a PASS.** Part VI's acceptance sentence is a
side-by-side screenshot of MAP vs their video frame at 1440px, differing only in content.
**That comparison has never been run, on any milestone, by anyone.** There is no headless
browser in this repo and — the harder half — **no reference frame**: the only raster assets
anywhere are four PWA icons. Every PASS on the record was granted under the interim standard
`fidelity-qa-reviewer` adopted and states inline on each verdict:

> **Source-and-token PASS.** Satisfies every mechanically checkable part of Part I and
> Part VI — no hex outside `tokens.css`, every duration through `motion.ts`, colour only as
> data ink, wide caps tracked, reduced motion stills without layout change, keyboard reach
> with monochrome focus rings, drawers trap focus and close on Esc, canvas `aria-hidden`,
> empty and failure states present and honest, data projected from frontmatter rather than
> copied. **It has not been compared to the reference frame at 1440px.** Proportion, density
> and optical weight are unverified.

Closing the gap is two decisions and they are with the user — see *Awaiting the user* below.
Costed proposal: `comms/inbox/_all/20260816-2110-fidelity-qa-reviewer-part-vi-screenshot-gap.md`.
Until it is funded, this standard is what "done" means here, and milestones already passed
are **not** re-opened: the first capture run covers all five surfaces at once and anything it
finds is filed as new findings against current owners.

---

## Roster & ownership

| Agent | Owns (spec §) | Owns contract |
|---|---|---|
| `design-system-guardian` | Part I — tokens, type, shape, motion | `contracts/design-tokens.md` |
| `shell-navigation-engineer` | §2.0 shell, search, tabs, §3.6 PWA | — |
| `map-galaxy-engineer` | §2.1–2.2 galaxy, force layout, canvas | `contracts/graph-layout.md` |
| `drawer-engineer` | §2.3 map drawer, §2.6.5 chart drawer | — |
| `dashboards-engineer` | §2.4–2.5 carousel + 7 widget types | `contracts/panel-schema.md` |
| `chart-matrix-engineer` | §2.6 rollout matrix | — |
| `runner-engineer` | §3.2 run/schedule/approvals, §3.3 brain · **M15:** `Plan §9`–§11 mount + billing | `contracts/api-contracts.md` · `contracts/project-scoping.md` *(in trust)* |
| `sessions-relay-engineer` | §3.1 SESSIONS tab, Happy relay, push | — |
| `observability-engineer` | §3.5 Langfuse, cost ticker, LAST RUNS | — |
| `infra-compose-engineer` | Part V — Docker, Caddy, Tailscale, ofelia | — |
| `agent-library-curator` | Part IV — agents/, seeding, normalization · **M15:** `Plan §10` cascade resolution | `contracts/frontmatter-schema.md` · `contracts/agent-cascade.md` |
| `rtl-arabic-pdpl-specialist` | §1.4 Arabic, RTL pass, PDPL (Part VII.4) | — |
| `fidelity-qa-reviewer` | Part VI acceptance, a11y, perf, review gate | — |
| `identity-access-engineer` | `Plan §11` — identity · device · billing account, scopes, device handoff | `contracts/identity.md` *(unwritten)* · ADR-016 |

`commandcenter-orchestrator` sweeps status/, resolves cross-agent conflicts, and
advances the milestone. It does not write feature code.

`identity-access-engineer` was defined 2026-08-16 and **dispatched and run 2026-08-17** —
`0007_identity.sql`, `contracts/identity.md`, ADR-016 (`proposed`). `ops.identity` is theirs
outright. `ops.device` and `ops.credential` remain with their interim owners until a written
handover; the transfer is an exchange, not a drift.

---

## Milestone ladder (Part VI)

| # | Milestone | Lead | Supporting | State | Evidence |
|---|---|---|---|---|---|
| 0 | Foundations — tailnet, repo skeleton, frontmatter schema, Tailwind tokens | `infra-compose-engineer` | `design-system-guardian`, `agent-library-curator` | **done** — *tailnet half unverified* | PASS 2026-08-15; re-gate 2026-08-16 `…/20260816-2053-infra-compose-engineer-review-full-stack-up.md` — **PASS on the compose half, PARTIAL on the tailnet half.** No Tailscale on this host, no auth key, nothing tested from a phone. Needs the human. |
| 1 | Shell + MAP galaxy | `map-galaxy-engineer` | `shell-navigation-engineer`, `design-system-guardian` | **done** | PASS `…/20260816-2114-map-galaxy-engineer-m1-brain-completeness-fixed.md` ("PASS. M1 clears… You may flip the BOARD") + shell PASS `…/20260816-1555-shell-navigation-engineer-shell-review.md` + `…/20260816-2120-design-system-guardian-rereview-countup-and-ink3.md` |
| 2 | Department view + drawer (read-only) | `drawer-engineer` | `map-galaxy-engineer` | **done** | PASS `…/20260816-2121-drawer-engineer-m2-refail-fixes.md` ("PASS. M2 clears") |
| 3 | Runner + Run now + Langfuse | `runner-engineer` | `observability-engineer`, `drawer-engineer` | **active** — blocked on the human | M2 cleared, so the ladder no longer blocks it. §3.5 observability PASS `…/20260816-1236-observability-engineer-m3-review.md`. Runner verdict **held, not failed** — `GET /api/status` reported three different brain numbers in one session; the reviewer will not gate a moving tree. Zero runs have executed: `RUNNER_ANTHROPIC_API_KEY` is unset. |
| 4 | SESSIONS tab + PWA + push | `sessions-relay-engineer` | `shell-navigation-engineer` | **active** | PASS exists but is dated 2026-08-15 and **predates ADR-005's revision**. Not flipped: `HAPPY_IMAGE` points at a package that does not exist so `--profile full` cannot boot, the permission-request wire format is built to our contract and unverified against upstream, and `tweetnacl` + `web-push` land only now (ADR-010). |
| 5 | CHART matrix | `chart-matrix-engineer` | `drawer-engineer` | **done** | PASS `…/20260816-2047-fidelity-qa-reviewer-m5-pass.md` ("PASS. No findings. §2.6 is the cleanest of the four surfaces"). Its ladder dependency on M2 is now satisfied. |
| 6 | DASHBOARDS carousel + widgets | `dashboards-engineer` | `observability-engineer` | **active** — FAIL open, just dispatched | FAIL `…/20260816-2047-fidelity-qa-reviewer-m6-fail.md`. One finding cleared (`KpiNumeral`); ten `--ink-3` sites open. **`dashboards-engineer` was dispatched 2026-08-16 ~22:0x against the corrected §9** — an earlier revision of this row said the fix was already in flight; it was not, and nobody had been sent. Widgets stay honestly empty until M3 supplies live metrics. |
| 7 | Schedule + audit + interview | `runner-engineer` | `agent-library-curator`, `infra-compose-engineer` | blocked on M3 | — |
| 8 | Polish — light theme, RTL, motion, mobile | `rtl-arabic-pdpl-specialist` | all | ongoing | SESSIONS slice PASS `…/20260816-1453-rtl-arabic-pdpl-specialist-m8-sessions-review.md`. 74 catalogue violations remain outside `sessions/**`. |

Only the lead — or `commandcenter-orchestrator` — flips a milestone state, and only after
`fidelity-qa-reviewer` files a `review-request` answer that says PASS. **Every PASS in the
Evidence column is a source-and-token PASS.** See the fidelity bar above for what that
does and does not cover.

**Evidence must be datable.** A verdict quotation is not enough on its own: a quoted PASS
inherits the staleness of whatever check it rested on. From now on, any Evidence entry whose
verdict cites a mechanical checker must carry that checker's provenance line —
`scanned at <time> · <sha> · <n> uncommitted` — alongside the quote. The reason is
`design-system-guardian`'s, and it is the sharper half of the argument: **a stale FAIL gets
investigated; a stale PASS gets cited.** A count with no identity is not evidence, it is a
sentence. See `comms/contracts/design-tokens.md` §8b.

*Applied honestly, not retroactively:* rows 0–5 above were gated before `provenance.mjs`
existed, so their token results cannot be dated and I am not inventing a sha for them. They
keep their verdicts and are marked here, once, as undatable — the same treatment the fidelity
bar gets. The requirement binds from M6 forward.

---

## Part Two ladder — the platform (`Plan §20`)

Everything in this section comes from `AGENTOS-V2-PLAN.md`, which is a **plan, not the spec
of record** (ADR-012). Sections are cited as `Plan §n`. Nothing here is gated differently:
a milestone still closes only on a `fidelity-qa-reviewer` PASS.

| # | Milestone | Plan § | Lead (exists today) | State |
|---|---|---|---|---|
| 15 | Projects · cascade · identity | §9 · §10 · §11 · §23.12 | `runner-engineer` | **active** — opened 2026-08-16 |
| 16 | Threads · addressing · mailbox | §12 | *unassigned* — `thread-model-engineer` when spawnable | not started |
| 17 | Presence · work products · diff review | §13 | `drawer-engineer` | not started |
| 18 | Time & triggers · the scheduler | §14 | *unassigned* — `scheduler-engineer` when spawnable | not started |
| 19 | Mobile (Expo) · real push · offline | §16 · §23.9 | *unassigned* — `client-platform-engineer` when spawnable | not started |
| 20 | Memory 5-tier · KB index | §15 | *unassigned* — `memory-index-engineer` when spawnable | not started |
| 21 | Tauri desktop · host daemon · sessions | §16 | *unassigned* — `client-platform-engineer` when spawnable | not started |
| 22 | Chief of Staff · swarm behaviours | §17 | *unassigned* — `chief-of-staff-architect` when spawnable | not started |
| 23 | Foundry, project-aware (was M13) | Part One §Phase 3 | *unassigned* — `agent-foundry-architect` when spawnable | not started |
| 9 | Connectors become real (MCP runtime) | Part One §Phase 1 | `runner-engineer` | not started — **floats**, lands in any gap after Phase 0 |

P1 and P2 (M15, M16) **cannot overlap with anything, including each other** (`Plan §20`).
M17/M18 may overlap; M19/M20 may overlap. Everything else is serial.

### What Part Two amends in the Part One ladder (`Plan §19`)

Recorded here so no milestone is built twice, and so nothing is left on a board that nobody
will ever build. **A board listing milestones that will never exist is a board people stop
reading**, which is why the fates below are written down rather than implied.

| Part One item | Fate | The operative consequence |
|---|---|---|
| **M9** Connectors real | **unchanged** | Now also the door event-triggers arrive through (`Plan §14`). Still the only Part One milestone that floats. |
| **M10** Memory & index | **amended** → M20 | Three tiers become **five** (global · project · department · agent · thread). Everything project-scoped. Retrieval counters, GC, write-time conflict detection added. |
| **M11** Tasks, questions, notifications | **absorbed — never built as a milestone** | A task *is* a thread with a due date; a question *is* a message kind. The board and the notification ladder survive inside M16/M17; the parallel entity model does not. Do not create `ops.task` or `ops.question` as standalone entities. |
| **M12** Dept dashboards, roster, steering | **partly superseded** | Dashboards and the roster stand and get richer. **Steering is replaced by the mailbox: `POST /api/run/:runId/input` is NEVER BUILT.** It is `POST /api/thread/:id/message`. `api-contracts.md` is `runner-engineer`'s; if that route ever appears there it is a defect, not a feature. |
| **M13** Agent Foundry | **deferred and rescoped** → M23 | Moves last; becomes project-aware — it must ask which library an agent belongs in and whether it should be born global. |
| **M14** Identity + accounts | **split and pulled forward** | Identity/device → **M15**, because it re-scopes every route and therefore cannot come last. Billing accounts → M15. Session hosts → M21. |
| **Part One §5 sequencing** | **superseded** by `Plan §20` | The table above is the sequence. |
| **BOARD constraint #5** | amended only as Part One's auth ADR proposes; **not further amended** | Tailnet-only survives Part Two intact, because contentless push (`Plan §16`) does not require exposure. |

### M15 — ownership, and where identity actually landed

**New agent definitions are not spawnable this session, so every M15 slice is assigned to an
agent that exists today.** The five Part Two definitions are written for the future; the
column on the right records the intended successor so the transfer is a handover, not a
rediscovery.

| Slice | Plan § | Owner today | Successor |
|---|---|---|---|
| **Lead** · `ops.project`, project-scoped routes, `contracts/project-scoping.md`, ADR-015 | §9 · §10 | `runner-engineer` | `platform-projects-engineer` |
| The cascade — resolution, identity, capability narrowing, promote/fork/provenance · `contracts/agent-cascade.md`, ADR-014 — **design filed 2026-08-16, proposed** | §10 | `agent-library-curator` | stays |
| Project switcher · project segment in routes and breadcrumb · project-scoped search and cost ticker | §23.12 P1 | `shell-navigation-engineer` | stays |
| Project axis on all 34 metrics endpoints · account split on cost surfaces | §10 · §11 | `observability-engineer` | stays |
| `ops.device` — scopes column, revocation, and the envelope `account_id` question | §11 | `sessions-relay-engineer` — **built** | `identity-access-engineer` |
| `ops.credential` — billing accounts, which account paid | §11 · Part V | `runner-engineer` | `identity-access-engineer` |
| `ops.identity` | §11 | `identity-access-engineer` — **built** (`0007_identity.sql`, ADR-016) | *now the owner* |
| Provenance badge as a monochrome primitive (`⌂` · `▣` · `⑂`) | §10 · §23.6 | `design-system-guardian` | stays |
| Provenance in the drawer header | §23.6 | `drawer-engineer` | stays |
| **Cross-project isolation sign-off — mandatory, not advisory** | §22 · §21.8 | `rtl-arabic-pdpl-specialist` | stays |
| Acceptance | Part VI | `fidelity-qa-reviewer` | stays |

**M15 is fully dispatched as of 2026-08-17** — every slice above has an owner working it, and
`ops.device`, `ops.identity` and the cascade are already filed. The distinction at the top of
this board still binds and is now the only thing standing between M15 and done: **completed is
not validated.** Nothing here has been proven against a real run, because there have been none.

*Tree state, so a sweep does not misread it:* `npm run test:web` is **red on 5 of 421** vitest
tests (`AppShell.test.tsx`, `CostTicker.test.tsx`) from the in-flight project-switcher work.
That is churn from a moving tree, **not a finding and not a gate failure** — it is recorded
here so nobody files it as one, and so nobody commits on top of it. The rule stands: gate when
the tree is still.

**Where identity landed, honestly.** `Plan §22` creates five specialists and **none of them
owns §11**. The plan's intended owner, `identity-access-engineer`, is carried over from Part
One §6 and was never defined anywhere. That is a genuine gap in the roster, not an oversight
in the reading of it. The interim split above is the least-bad arrangement among agents that
exist:

- **`ops.device` → `sessions-relay-engineer`**, because he already owns per-device keypairs,
  push subscriptions and the E2E envelope allowlist. §11's device row — name, platform,
  public key, scopes, last seen, revocable — is the same object he half-owns already, and
  `Plan §11`'s `account_id`-in-the-envelope question is explicitly a decision about *his*
  file, whose own comment demands an ADR.
- **`ops.credential` → `runner-engineer`**, because Part V's billing split and the hard
  monthly cap are already his non-negotiable, and "every run records which account paid" is
  a run-ledger column.
- **`ops.identity` → nobody builds it in M15.** One row, no behaviour. It is *defined* as a
  foreign-key target in `project-scoping.md` and **scopes enforcement is deliberately
  deferred**: BOARD #5 says there is no auth boundary in v1 by design, and **a scope with no
  enforcement point is a comment**. Building a scopes model now means building it against no
  threat model and rewriting it when the auth ADR lands.

**Deliberately out of M15 scope:** scopes enforcement · provenance badges on MAP nodes and
CHART job cards (shell and drawer only — one vertical slice, not four half-slices) ·
`host_affinity` routing to any host but localhost · creating the global library repo itself
(the cascade has two real levels until one exists) · anything in `Plan §12`–§17.

**M15 cannot flip to `done` without a `fidelity-qa-reviewer` PASS, and its PASS will
necessarily be narrower than usual** — see the header note and `contracts/project-scoping.md`
§6 for the seven things it cannot cover.

**One extra condition on M15's cascade half, adopted from `agent-library-curator` and not
optional:** the PASS requires a **runner test asserting on the allowlist the session actually
received**, not on the validator's opinion of the file. Their sentence is the reason — *"CI
is not a boundary"*, earned by tonight's `workspace` finding. It is the cascade's equivalent
of `project-scoping.md` invariant 8, and it is the one structural proof of a
no-error-message property that is obtainable **before** the API key lands.

**And a scope note that will otherwise be discovered late:** `Plan §10` says both *"the same
seven departments"* and *"an eighth department, `engineering`"*. Both are in the plan; seven
business departments per ADR-001 plus `engineering` for the build specialists. **The eighth
is out of M15** — it is an ADR-001 amendment across radial force groups, a §2.6.1 tab bar
built for seven, `clusters.json` and a five-consumer enum, and it needs a frontmatter adapter
besides. `agent-library-curator` files it once `map-galaxy-engineer` and
`chart-matrix-engineer` have priced the layout. **M15 must not bake `7` into anything
project-shaped** — that is the cheap half, bought now.

---

## Part Two roster — defined, not yet rostered

These five have definitions in `.claude/agents/` (`Plan §22`) and are **deliberately not on
the roster table above**. The roster is the list of agents that can be messaged and that keep
a heartbeat in `comms/status/`; `check-comms.mjs` enforces exactly that pairing. Adding a
slug that cannot run would either break `npm run validate:comms` or force a placeholder
status file — a fake heartbeat, which is the same class of lie as a plausible zero (BOARD
constraint / CLAUDE.md rule 9).

They join the roster table, gain a status file and gain their contracts on the session they
first become spawnable. Until then their work is assigned to existing owners.

| Defined agent | Owns (`Plan §`) | Contract it will own | Held in trust by |
|---|---|---|---|
| platform-projects-engineer | §9 · §10 — `ops.project`, cascade mount, library sync, project switching | `contracts/project-scoping.md` | `runner-engineer` |
| *(cascade resolution)* | §10 — resolution, resolved identity, promote/fork | `contracts/agent-cascade.md` | `agent-library-curator` — **stays with them**, per ADR-013 |
| thread-model-engineer | §12 — threads, addressing grammar, mailbox, interrupt levels | `contracts/thread-model.md` | not yet written |
| scheduler-engineer | §14 — coordinator clock, six trigger types, fire ledger, calendar widget | `contracts/scheduling.md` | not yet written |
| client-platform-engineer | §16 · §23.9 — Expo mobile, Tauri desktop, push, offline replica | `contracts/client-sync.md` | not yet written |
| chief-of-staff-architect | §17 — routing, delegation limits, standups, trust ladder, Morning Briefing | `contracts/orchestration.md` | not yet written |

`control-plane-engineer` is **dissolved before it was ever created** (`Plan §22`) — its scope
splits between `thread-model-engineer` and `scheduler-engineer`, which is the honest
consequence of M11 being absorbed. No definition is written for it and none should be.

**`identity-access-engineer` is the sixth definition that `Plan §22` does not create and M15
needs.** It is carried over from Part One §6 and owns `contracts/identity.md`.

**Written 2026-08-16 on instruction** — `.claude/agents/identity-access-engineer.md`. The
reasoning, on the record rather than as a preference: **this is not a new roster decision.**
Part One §6 names the agent, `Plan §22` carries it over explicitly (*"Carried over from Part
One §6: … `identity-access-engineer` (now three tables)"*), and the only gap was that nobody
ever wrote the file. Writing it **implements a roster the plan already specifies**. Inventing
a specialist no plan names would be a different act and is still not something to do
uninstructed — that distinction is the reason this sat as a question first.

It is **defined, not dispatched.** The interim split below stands until it has work.

---

## Standing constraints (violating these is a bug, not a preference)

1. **Chrome is monochrome.** Color only as data ink + the single copper accent (§1.3).
2. **No component library.** Tailwind + CSS vars + D3 + Framer Motion only (Part V).
3. **Never hardcode a color.** Every color is `var(--token)` from the tokens contract.
4. **Frontmatter is the single source of truth** for all three views (Part IV). Views
   project it; they never store their own copy of agent data.
5. **No public ports.** Tailnet-only, no auth in v1 by design (§3.6).
6. **Traces and Postgres volumes stay local** (§3.5, Part VII.4).
7. Self-hosted fonts via `@fontsource`; no external network requests at runtime (§1.4).

---

## Open cross-cutting questions

Answer these as ADRs before the milestone that depends on them.

- [x] `M0` Which 7 canonical departments? → **[ADR-001](decisions/ADR-001-department-taxonomy.md)** accepted. Sales · Deals · Marketing · Operations · Intelligence · Customer · Back Office, in that order; `cluster` is free text validated against `agents/_registry/clusters.json`.
- [x] `M0` Repo shape → **[ADR-002](decisions/ADR-002-repo-shape.md)** accepted. npm-workspaces monorepo; `packages/contracts` is the code half of `comms/contracts/`.
- [x] `M1` Layout precompute → **[ADR-003](decisions/ADR-003-layout-precompute.md)** accepted. One pure engine, two callers, seeded previous positions, deterministic.
- [x] `M4` Happy self-hosted vs Omnara (§3.1) → **[ADR-005](decisions/ADR-005-session-relay.md)** accepted. Self-hosted Happy from the `slopus/happy` monorepo (MIT); Omnara hard-fails constraint 1 — its server holds agent state in plaintext by design. Compose must stop defaulting to `ghcr.io/slopus/happy-server:latest`, which does not exist.
- [x] `M6` The six Command Centers for *our* stack (§2.4 "Ours:") → **[ADR-004](decisions/ADR-004-command-centers.md)** accepted. The set is fixed before any `panels/*.json` is written, because a seventh center or a rename is a rail-order change in six files (§2.5.6).
- [x] `M4` The two crypto/push runtime dependencies ADR-005 named → **[ADR-010](decisions/ADR-010-sessions-runtime-deps.md)** accepted. `tweetnacl` + `web-push` in `apps/web/package.json` only; the honest fallbacks stay until each swap is verified.
- [x] `M0` An agent that produces a deliverable must declare a connector that can write one → **[ADR-009](decisions/ADR-009-artifact-write-capability.md)** accepted (`agent-library-curator`).
- [ ] `M3` Runner auth to Langfuse — `LANGFUSE_INIT_*` passthrough so the runner gets real keys instead of a null sink. Agent work, in flight: `infra-compose-engineer` offered it, `runner-engineer` asked for it (`inbox/infra-compose-engineer/20260816-2121-runner-engineer-langfuse-init-passthrough.md`). The *billing* half of this question — which capped workspace holds the monthly cap — is the user's and moved below.
- [ ] Any `deliver:` target that leaves the tailnet is a data-egress decision needing its own ADR (Part VII.4) — `rtl-arabic-pdpl-specialist`. **M15 widens this:** `Plan §9`'s `library_remote` implies the coordinator may `git clone`/`git push` a project library. A git remote leaving the tailnet is the same class of event as a `deliver:` target. Answer it inside this ADR, not separately.
- [x] `M15` **Is Part Two spec?** → **[ADR-013](decisions/ADR-013-part-two-standing-and-spec-coverage.md)** accepted. It is a plan that amends the spec; the coverage gate stays pointed at the spec of record and keeps its exact current meaning. Also rules the ADR-numbering collision, and the boundary between `agent-cascade.md` and `project-scoping.md`.
- [x] `M15` **ADR-014 — the agent cascade.** Filed by `agent-library-curator`, status **proposed**: `comms/contracts/agent-cascade.md` + [ADR-014](decisions/ADR-014-agent-cascade-resolution.md). Resolution is by `(department, slug)`, **whole-file, no field merge** — which closes the security question in the safe direction, since a project layer cannot widen a global agent's `wired_into`. A file that fails validation is **excluded and does not fall through**. Still `proposed`, so **it is a hard stop for MAP/CHART/DASHBOARDS until accepted** — its own §8 lists what it routes onward.
- [ ] `M15` **ADR-015 — project scoping.** *Number claimed, file not yet written.* The third plane, `ops.project`, how a request names its project, what deleting a project means, where `budget_monthly` is authoritative. Filed by `runner-engineer`. **Hard stop for the schema and every route.** Questions in `contracts/project-scoping.md` §5.1 (Q1–Q8, Q8b).
- [x] `M15` **ADR-016 — identity vs device vs billing account** → **filed 2026-08-17, `proposed`**, author `identity-access-engineer`. Three tables, orthogonal, scopes on the device; `runner-engineer` still answers Q18 and Q20 (credential custody, who pays) as interim owner of `ops.credential`. **Q17 (scopes enforcement) stays deferred, not answered** — a scope with no enforcement point is a comment. **Q19 is deliberately *not* in this file:** ADR-016 defers the envelope back to `sessions-relay-engineer` as their subject, which is correct — it is §3.1 and `envelope.ts` is theirs. Q19 is answered and binding (`account_id` **refused**, two tests + a comment in `envelope.ts`) and is being transcribed as **ADR-032**. Do not read ADR-016 expecting a Q19 ruling.

### ADR numbering — claim the row before you write the file

`AGENTOS-V2-PLAN.md` prints ADR numbers (§3 uses 009/010/011/013; §18 uses 016–025) that
**collide with accepted ADRs in this repo and are not allocations.** Worse, "take the next
free number" is not safe either: on 2026-08-16 two agents computed *next free = 012* from
the same directory at the same moment, both filed an ADR-012, then both renamed. **012 is
now deliberately vacant** as the visible record of why this rule exists.

**Allocation is claimed here, by the orchestrator, before the file is written.**

| # | Decision | Author | Status |
|---|---|---|---|
| 012 | — | — | **vacant, deliberately** |
| 013 | Part Two's standing + the coverage gate | `commandcenter-orchestrator` | accepted |
| 014 | Agent cascade resolution | `agent-library-curator` | proposed |
| 015 | Project scoping — third plane, `ops.project`, routes | `runner-engineer` | claimed, unwritten |
| 016 | Identity vs device vs billing account | `identity-access-engineer` *(defined, not dispatched)* | claimed, unwritten |

| 017 | Two planes — Library (git) + Operations (Postgres) · *`Plan §3` calls this "ADR-009"* | — | **reserved, unwritten** |
| 018 | MCP runtime and credential custody · *`Plan §3` calls this "ADR-010"* | — | **reserved, unwritten** |
| 019 | Memory tiering + write authority, five tiers · *`Plan §3` "ADR-011" / §18 "ADR-011 amended"* | `memory-index-engineer` *(undefined)* | **reserved, unwritten** |
| 020 | Task-board semantics · *`Plan §3` calls this "ADR-012"* | — | **reserved, unwritten** |
| 021 | Auth exists in v2 — accounts inside the tailnet · *`Plan §3` calls this "ADR-013"* | `identity-access-engineer` | **reserved, unwritten** |
| 022 | Foundry token-budget policy · *`Plan §3` calls this "ADR-014"* | `agent-foundry-architect` *(undefined)* | **reserved, unwritten** |
| 023 | Thread unification, addressing, mailbox · *`Plan §18` "ADR-018"* | `thread-model-engineer` | **reserved** |
| 024 | Scheduler ownership, six trigger types · *`Plan §18` "ADR-019"* | `scheduler-engineer` | **reserved** |
| 025 | Client strategy — Expo, Tauri, contentless push · *`Plan §18` "ADR-020"* | `client-platform-engineer` | **reserved** |
| 026 | Work products + worktree isolation · *`Plan §18` "ADR-021"* | — | **reserved** |
| 027 | Chief of Staff — routing, delegation, trust ladder · *`Plan §18` "ADR-022"* | `chief-of-staff-architect` | **reserved** |
| 028 | Three new widget types — `board`, `calendar`, `thread-feed` · *`Plan §18` "ADR-023"* | `dashboards-engineer` | **reserved** |
| 029 | Drag without a dependency · *`Plan §18` "ADR-024"* | `design-system-guardian` | **reserved** |
| 030 | *(optional)* Rename CHART → ROLLOUT · *`Plan §18` "ADR-025"* | `chart-matrix-engineer` | **reserved** |

| 031 | Where §9's AA floor supersedes a spec-named text token | `design-system-guardian` | **claimed, unwritten** |
| 032 | The session envelope allowlist — `account_id` refused (§3.1, `Plan §11` Q19) | `sessions-relay-engineer` | **claimed** — ruling already binding in `envelope.ts` + 2 tests; ADR transcribes it |

033+ is claimed just-in-time at its own milestone. **Do not copy a number out of the plan** —
translate it through `comms/decisions/README.md` first.

*Both 031 and 032 were requested within seven minutes and both requesters guessed "031" and
then refused to take it. Tie broken by arrival time — `design-system-guardian` 23:59,
`sessions-relay-engineer` 00:06 — because a mechanical tiebreak needs no judgement and can be
applied by anyone. That both agents asked instead of counting is the rule working; that both
guessed the same number is what it would have cost if they had not.*

### The plan is the second claimant on this sequence, and it lost

`AGENTOS-V2-PLAN.md` allocates ADR numbers in **two** of its own sections, on two different
offsets — `Plan §3` (lines 84–143) and `Plan §18` (lines 965–975). Six of `Plan §3`'s numbers
collide with files already in `comms/decisions/`, and `Plan §18`'s "ADR-016" is what this repo
filed as ADR-014 and claimed as ADR-015.

**Ruled in ADR-013's 2026-08-17 amendment: the filed ADRs keep their numbers; the plan's are
re-allocated above.** The deciding principle, which is worth carrying to the next tie of this
shape:

> **You cannot renumber a decision that has already been acted on. Allocate against the side
> with no dependents.**

ADR-009 changed twelve agents' frontmatter and is enforced by a validator. ADR-013 set the
coverage gate. ADR-010 justifies two entries in `apps/web/package.json`. All are cited in the
Evidence column, in four contracts, and in **answered and closed messages, which ADR-000 makes
append-only.** The plan's numbers have zero files, zero code and zero tests behind them.

Why it is not merely tidiness: the plan **cites these numbers in prose** — §4's phases, §11's
*"transport stays as ADR-013 proposed"*, line 387, line 844, line 995, line 1253. A reader
following a citation lands on a different decision than the author meant. **One identifier,
two readings** — the same defect class as everything else found that day.

`AGENTOS-V2-PLAN.md` is **not edited to match.** It is the user's file, committed at `56e93cf`;
rewriting twenty-odd citations inside their plan of record is the quiet cross-boundary edit
this repo forbids. Recommended, not performed — see *Awaiting the user*.

### "Auth exists in v2" does not mean the tailnet boundary moves

Two readers took `Plan` line 110 and `Plan §11` line 649 two different ways in one evening,
which means the text is doing too much work. Stated once, quotable in full:

| | v2 | Is BOARD #5 amended? |
|---|---|---|
| **Identity / auth** — accounts, devices, scopes, per-account billing | **exists**, *inside* the tailnet | Yes — *"no auth in v1 by design"* is superseded by Part Two |
| **Transport** — public ports, exposure | **unchanged.** Tailnet-only | **No.** *"No public ports"* survives. Authelia in front of Caddy is a *later* ADR (Part One §8; `Plan` line 995: *"not further amended here"*) |

**v2 gains accounts. v2 does not gain a public surface.** Quote both halves or neither. The
deferred scopes-enforcement ruling depends on the right-hand column staying true.

**The property that makes a namespace raceable: a shared integer with no author in the key.**
Four agents editing `comms/` concurrently do *not* race on handoffs, messages or status,
because every other filename embeds its author's slug — `M<n>-<agent>-<topic>.md`,
`<ts>-<sender>-<topic>.md`, one status file per agent. A namespace partitioned by agent cannot
be raced; the worst case is an agent colliding with itself, which is a mistake, not a race.

**This board previously claimed `decisions/` was the only such namespace. That was wrong, and
it was disproved the same night.** `identity-access-engineer` and `sessions-relay-engineer`
both read `apps/runner/src/db/migrations/`, both computed *next free = 0006*, and both wrote a
`0006_` file within the same minute. **There are two shared-integer namespaces, not one:**

| Namespace | Ordered? | Fix |
|---|---|---|
| `comms/decisions/` | No — a number is identity, nothing more | **Author-keyed drafts** (below). Structural. |
| `apps/runner/src/db/migrations/` | **Yes** — `client.ts` applies in filename order and records by filename | Author-keying is impossible; **a gate** instead — `repo-conformance.test.mjs` now fails on two migrations sharing a number, verified against a planted duplicate |

The migration case is the more dangerous of the two: two files sharing a number **both run**,
in an order decided by whatever text follows the digits, so a foreign key that happens to sort
after its target applies cleanly on one machine and fails after an unrelated rename. It was
resolved by this board's own principle — *allocate against the side with no dependents* —
`0006_ops_device.sql` was already cited by a handoff and a test, so `0006_identity.sql` became
`0007_`.

### Claiming a row is not enough — the naming rule is what prevents the race

**A register makes a race visible afterwards. Only a naming rule prevents it.** ADR-016 was
written twice on 2026-08-17: two agents were dispatched in parallel onto two thirds of one
subject, both needed the number, and **the second file silently overwrote the first.** No rule
was broken — 016's registered author wrote 016 — and the surviving file is correctly scoped.
Claiming is a human-speed edit to a shared file; writing is a machine-speed one, so a claim
cannot close a window it does not own.

**Rule, from 2026-08-17:**

1. **A draft is named for its author, never for a number:**
   `comms/decisions/ADR-draft-<topic>-<author-slug>.md`. Two agents drafting the same subject
   now produce **two files** — a visible merge, never a silent overwrite. This is the same
   property that already makes every other `comms/` namespace safe, applied to the one place
   it was missing.
2. **The number is assigned at acceptance**, by `commandcenter-orchestrator`, in the register
   above — and the draft filename is recorded in the row as a permanent alias, because
   **a citation can outlive the file it points at.** `sessions-relay-engineer` had to go back
   and correct in-code `ADR-016` citations that would otherwise have sent a reader to a
   section saying the opposite of what they meant.
3. **A subject spanning two owners names both authors in the row at claim time.**
   `sessions-relay-engineer`'s proposal, adopted: had the ADR-016 author written a Q19 answer
   instead of deferring it, the record would now contain a decision about `envelope.ts` made by
   an agent who does not own that file.
4. **Never write to a path that already exists in a shared namespace.** If it is there, stop
   and ask — an overwrite in `decisions/` or `migrations/` destroys a record rather than
   conflicting with it.

Claim-first survives for numbers that must exist before the file does. What changes is that it
is no longer the *only* protection, and it is no longer load-bearing on anyone remembering to
pre-assign before dispatching agents in parallel.
- [ ] `M3` Split `503 metrics_unavailable` into `metrics_unconfigured` vs `metrics_query_failed` — today they are indistinguishable and that cost real diagnostic time. `observability-engineer` to file the `decision-request`; `runner-engineer` owns `api-contracts.md`.

### Awaiting the user — six open decisions

No agent can close these. They are recorded here so they survive the session that raised
them, rather than living in a chat log. Each names who is blocked and what happens meanwhile,
so none of them is a licence to idle. **Seven boxes, six decisions** — the first two are one
decision and answering only the cheap half is the failure mode to avoid.

- [ ] **Headless browser as a devDependency** (Part VI acceptance) — `fidelity-qa-reviewer`
  proposes `playwright` in `apps/web` devDependencies plus a ~60-line capture script. Zero
  runtime deps, zero bundle bytes, ~300MB one-time download, breaks no standing rule
  (rule 2/8 bar a *runtime* UI library). Reviewer's recommendation: **yes**.
  → `comms/inbox/_all/20260816-2110-fidelity-qa-reviewer-part-vi-screenshot-gap.md`
- [ ] **The five reference frames** — §2.1 galaxy, §2.2 department, §2.3 drawer, §2.5
  dashboard, §2.6 matrix, extracted from the SkillTree video. ~10 min of human time; nobody
  here has the video. **These two are one decision, not two:** a "no" here should make the
  headless browser a "no" too — screenshots with nothing to diff against are a folder of PNGs
  and a false sense of rigour. If both are "no", the source-and-token standard becomes
  permanent and Part VI's acceptance sentence should be amended to say what we actually do.
  *Meanwhile:* gating continues at the source-and-token standard, caveat stated on every
  verdict.
- [ ] **`RUNNER_ANTHROPIC_API_KEY` and its capped workspace** (Part V billing, §3.5) —
  blocks Phase 0 step 0.3 entirely and all of M3's runner half. **Zero runs have ever
  executed**, which is why every cost and run surface is legitimately empty. Blocks
  `runner-engineer`, `observability-engineer`, `dashboards-engineer` (live widgets),
  `drawer-engineer` (LAST RUNS evidence). *Meanwhile:* every surface renders an honest empty
  state and `runnerConfigured: false` is reported truthfully.
- [ ] **Tailscale: host install vs `network_mode: service:tailscale`** (Part V, §3.6) —
  Tailscale is not installed on this host and `TS_AUTHKEY` is empty, so MagicDNS TLS is
  untested and nothing has been verified from a phone. **Both options contradict Part V's
  "no host-installed tools" in some direction**, so whichever wins needs an ADR from
  `infra-compose-engineer`. Blocks M0's tailnet half and any phone test. *Meanwhile:*
  loopback-only, `check-bind.mjs` exits 0, LAN address refused.
- [ ] **Light-theme `--ink-2` on `--card-2` measures 4.25:1** — 5% short of AA (tokens
  contract §9.5). The clean fix changes a value that is **verbatim §1.2 of the spec of
  record**, so it needs an ADR rather than a drive-by bugfix.
  → **[ADR-011](decisions/ADR-011-light-ink-2-aa-floor.md)**, filed by
  `design-system-guardian`, status **proposed** — it is written and waiting on you, not on an
  agent. *Meanwhile:* dark theme is unaffected and shipping; nothing is smuggled into a
  bugfix.
- [ ] **The twenty `COMPANY.md` interview answers** (§3.3) — `company/COMPANY.md` is
  measurably **0 of 20 answered**, and the whole product now says so honestly rather than
  fabricating 45%. This is the input that turns the galaxy core, the brain counter and the
  interview agent from correct-and-empty into useful. Ten of these are the user's to write;
  no agent can. *Meanwhile:* the zero renders as a stated empty state, not a dim swirl.
- [x] **Does `identity-access-engineer` get written as a sixth Part Two definition?**
  (`Plan §11`, §22, Part One §6) → **Yes. Written 2026-08-16**,
  `.claude/agents/identity-access-engineer.md`. Not a roster decision: Part One §6 names it,
  `Plan §22` carries it over verbatim, and the only gap was the missing file. Scoped to §11's
  three tables. **Defined, not dispatched** — the interim split stands and the transfer is a
  written exchange. `contracts/identity.md` and ADR-016 are its first tasks.

- [ ] **Amend `AGENTOS-V2-PLAN.md`'s ADR citations?** — the plan allocates ADR numbers in two
  of its own sections and six collide with files already filed here. Ruled: the filed ADRs
  keep their numbers, the plan's are re-allocated (ADR-013 amendment; register above;
  concordance in `comms/decisions/README.md`). **The plan file itself is deliberately
  untouched** — it is yours, committed at `56e93cf`, and rewriting twenty-odd citations inside
  it is not an agent's call. **Recommendation: yes, amend it eventually**, because a
  concordance is a bridge and a bridge is something every future reader has to be told about.
  Roughly twenty edits, mechanical, and they can wait. *Meanwhile:* the concordance is the
  bridge, it sits in the directory where the wrong method is actually practised, and no agent
  may allocate from the plan.

- [ ] **Who authored commit `56e93cf`?** — *"Implement code changes to enhance functionality
  and improve performance"*, `Maher Fayad <maherfayad55@gmail.com>`, 2026-08-16 19:28 +0300,
  **881 insertions to `AGENTOS-V2-PLAN.md` and nothing else.** It landed from outside this
  session, and 229 files sit uncommitted on top of it. If it was you, this is noise and tick
  it. If it was not, it matters more than it looks: that commit is the entire Part Two plan
  that M15, ADR-013 and four contracts are now built on, **and every provenance line filed
  tonight cites that sha as its baseline.** Nothing is invalidated either way — the content is
  read and reasoned about in the open — but the Evidence column now rests on a commit whose
  author nobody in this session can name, and that should be a recorded fact rather than an
  assumption. Recorded rather than assumed benign.

---

## Standing acceptance cases

Tests that outlive the message that proposed them. Run these before claiming a surface is
done, not only when something looks wrong.

1. **Stop Postgres; confirm no surface anywhere shows a plausible zero.** Proposed by
   `runner-engineer`, adopted by `fidelity-qa-reviewer` as standing. It is the sharpest
   available test of **CLAUDE.md rule 9 / Part VII.3** (*numbers must be real; an honest empty
   state beats a plausible fake one*), because a dead database is the one failure that produces
   a *confident wrong answer* rather than a visibly broken one — a `0` where the truth is
   *unknown*. **Not yet run:** three agents were live against that database. It stays owed.
   `ledger.state` exists on both surfaces as a written sentence; three consumers have not read
   it yet, and that is a FAIL against them once it can be reproduced.

---

## Spec coverage — the completeness gate

Every section of the spec of record must be **claimed by exactly one agent** in
`comms/specs/<area>.md`, written from `comms/specs/_TEMPLATE.md`. `npm run validate:coverage`
fails the build when a section is unclaimed, when a requirement cites a file that does not
exist, or when a requirement cites no spec section.

Sections are listed individually, not as ranges — the checker matches them literally, and a
range would leave the sections inside it owned by nobody.

**What this gate does not cover, stated so nobody assumes otherwise
([ADR-013](decisions/ADR-013-part-two-standing-and-spec-coverage.md)):** it reads sections
from `skilltree-clone-spec.md` **only**, and it only recognises dot-decimal ids (`§2.3`) and
`PART <roman>`. `AGENTOS-V2-PLAN.md` is invisible to it, and Part Two's `§9`, `§10`, `§23`
would not parse as section ids even if they were in the spec file. **Adding Part Two rows to
the table below would therefore fail nothing, ever** — the table would look enforced and be
decorative, which is the same disease as a fidelity bar nobody has run. So they are not
added. Part Two's coverage is tracked separately and marked plainly as unenforced. The gate
grows one milestone at a time, when a Part Two milestone closes and its shipped behaviour is
written into the spec of record under a real section number: **spec follows shipped code,
not the other way round.**

| Spec section | Claimed by |
|---|---|
| PART I · §1.1 · §1.2 · §1.3 · §1.4 · §1.5 · §1.6 | `design-system-guardian` |
| PART II · §2.0 · §2.7 · §3.6 | `shell-navigation-engineer` |
| §2.1 · §2.2 | `map-galaxy-engineer` |
| §2.3 | `drawer-engineer` |
| §2.4 · §2.5 | `dashboards-engineer` |
| §2.6 | `chart-matrix-engineer` |
| PART III · §3.2 · §3.3 | `runner-engineer` |
| §3.1 | `sessions-relay-engineer` |
| §3.5 | `observability-engineer` |
| PART IV · §3.4 | `agent-library-curator` |
| PART V | `infra-compose-engineer` |
| PART VI | `fidelity-qa-reviewer` |
| PART VII | `rtl-arabic-pdpl-specialist` |

A requirement whose `Implemented in` column is `—` is **declared but unbuilt** — legal, counted
separately, and the honest way to show the spec is complete before the code is. A requirement
pointing at a file that does not exist is a lie in a document, which is worse than a gap,
because a gap is visible.

---

## Part Two — plan coverage (NOT machine-checked)

> **`npm run validate:coverage` does not read this table and will not fail on it.** That
> sentence is the point of the table, not a caveat on it: an unmarked table is
> indistinguishable from an enforced one, and the whole reason ADR-012 exists is that a
> gate which has quietly stopped meaning what it says is worse than no gate. Ownership here
> is a human commitment, checked by the orchestrator's sweep.

| Plan § | Claimed by (today) | Successor |
|---|---|---|
| §9 · §10 — three planes, `ops.project`, the cascade mount | `runner-engineer` | platform-projects-engineer |
| §10 — cascade resolution, provenance, promote/fork | `agent-library-curator` — **claimed and designed**, `agent-cascade.md` proposed | stays |
| §11 — identity · device · billing account | **split, one third unowned** — see M15 | identity-access-engineer |
| §12 — threads, addressing, mailbox | **unclaimed** | thread-model-engineer |
| §13 — presence, work products, diff review | **unclaimed** | `drawer-engineer` |
| §14 — the scheduling plane | **unclaimed** | scheduler-engineer |
| §15 — memory at five tiers, KB index | **unclaimed** | memory-index-engineer |
| §16 · §23.9 — clients, push, offline | **unclaimed** | client-platform-engineer |
| §17 — Chief of Staff, swarm behaviours | **unclaimed** | chief-of-staff-architect |
| §18 — ADR programme | `commandcenter-orchestrator` (allocation only) | stays |
| §19 · §20 — amendments and sequencing | `commandcenter-orchestrator` | stays |
| §21 — platform risks | `commandcenter-orchestrator`; §21.8 isolation → `rtl-arabic-pdpl-specialist` | stays |
| §22 — roster | `commandcenter-orchestrator` | stays |
| §23 — the UI rescan | **split per §23.12**, unclaimed outside M15 | per phase |
| §24 — deliberately not in Part Two | `commandcenter-orchestrator` | stays |

**Nine of fifteen rows are unclaimed and that is correct right now** — they belong to
milestones nobody has opened. An unclaimed row here is a scheduling fact, not a gap; an
unclaimed row in the machine-checked table above is a build failure. Keeping the two tables
apart is what preserves that difference.
