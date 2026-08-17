# BOARD — Command Center build

**Spec of record:** [skilltree-clone-spec.md](../skilltree-clone-spec.md) — every decision
traces back to a section number in it. Quote the section when you cite it.

**Second document:** [AGENTOS-V2-PLAN.md](../AGENTOS-V2-PLAN.md) — Part One (§1–§8) and Part
Two (§9–§24). It is **a plan that amends the spec of record, not a second spec**
([ADR-013](decisions/ADR-013-part-two-standing-and-spec-coverage.md)). Cite it as `Plan §10`;
a bare `§10` always means the spec of record, which has no §10.

**Current milestone:** `M16 — Threads · addressing · mailbox` (Part Two, P2) **opened
2026-08-17**, `thread-model-engineer` dispatched alone against the contract · `M3 — Runner +
Run now + Langfuse` (unblocked by M2; the runner half waits on the human for
`RUNNER_ANTHROPIC_API_KEY`) · `M6 — DASHBOARDS` (FAIL open, fix in flight) · `M4 — SESSIONS`
(relay unverified against a bootable Happy) · `M8` ongoing. M0, M1, M2, M5 and **M15** are
**done**.

**M15 closed 2026-08-17 on a PASS** — `comms/handoffs/M15-fidelity-qa-reviewer-acceptance-2.md`,
at `eaca677`, source-and-token standard. All three blocking items cleared, each proven by
planting the defect rather than reading the diff. Four follow-ups routed with owners. **The
earlier FAIL verdict at `8e77a23` is not deleted and not edited** — it is the record of what was
true two commits before, and `comms/handoffs/M15-fidelity-qa-reviewer-acceptance.md` stays where
it is.

**M16 is open, and exactly one agent is dispatched onto it.** `thread-model-engineer` writes
**ADR-023**, **`contracts/thread-model.md`** and migration **`0008_`** — the foundation every
other slice consumes. **The remaining slices are deliberately held**, sequenced behind the
written contract rather than dispatched in parallel against `Plan §12`. The reason is the
defect this board has now paid for four times: six agents reading one plan section produce six
readings of one shape, and the disagreement surfaces a week later as two contracts. If you own
an M16 slice, it is not your work today — M6, M3, M4, M8 and four owed `## Answer` blocks all
outrank read-ahead.

**Phase 0 is still not closed, and M15 was built and closed anyway — on purpose, with the
reason stated. M16 proceeds on the same terms.** `Plan §20` says Phase 0 blocks everything, and
its reason is specific: *no feature can be judged on top of zero real runs*. That reason still
holds and nothing below weakens it. Both milestones are nonetheless **buildable**, because
projects, the cascade, identity and threads are schema, routing and UI — none of it makes a
model call. The distinction that matters, and which every handoff must repeat rather than blur:

> **A milestone can be completed. It cannot be *validated* until Phase 0's human items land.**
> Complete means the schema exists, the routes carry a project, the cascade resolves and the
> switcher works. Validated means a real run in project A was proven not to appear in project
> B, the cascade was proven to pick the agent the human meant, and a budget cap was proven to
> refuse. The second list needs `RUNNER_ANTHROPIC_API_KEY`, the twenty `COMPANY.md` answers,
> the Tailscale decision and the reference frames — all four are with the user, below.
> The full list is `contracts/project-scoping.md` §6, and it is a section of the contract
> rather than a footnote because consumers need to read it.

**M15's PASS says this in its own voice, and the sentence is the reason it is quoted rather
than summarised:** *"M15 can be completed. M15 cannot be validated. `runnerConfigured` is
`false`, read off a live runner."* The reviewer started a runner and asked it, rather than
inferring the flag from config — which is the difference between a claim and a measurement, on
the one field this entire board's honesty rests on.

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

### What the gates structurally cannot see — so no PASS is read as wider than it is

Added 2026-08-17 from M15's verdict. Each of these is a thing a green gate does **not** mean.
They are recorded once, here, rather than re-derived by whoever next cites a percentage.

- **`check-tokens` enforces BOARD rule 8. It structurally cannot enforce §1.3.** It catches
  hex, arbitrary Tailwind type values, `rgb()` and `hsl()`. It does **not** catch named CSS
  colours, concatenated hex, or — the one that matters — **a data-ink token applied to chrome**
  (`border-ink-teal`, `focus-visible:ring-ink-copper`). §1.3 is what this board calls 90% of why
  the product looks expensive, and **the tree is clean on it today by `fidelity-qa-reviewer`'s
  hand inspection, not by any gate.** The only data-ink-on-chrome in the tree is `Chip.tsx:44-49`,
  which is the sanctioned §1.3 exemption. `design-system-guardian` owns whether this becomes
  mechanical; *"0 violations"* does not currently mean *"rule 1 holds"*.
- **The three skipped runner tests are exactly the three that would catch a writer/schema
  mismatch.** Of **179** at `eaca677` (156 when this was first written; the count moved, the
  finding did not), the skips are `an unscoped read raises rather than returning rows`, `every
  SQL statement the runner can emit is accepted by a real Postgres`, and `the write path and the
  prune plan cleanly against a real Postgres` — **all three on `DATABASE_URL is not set`.** The
  ledger writer changed on 2026-08-16, so the writer and the schema have never met. **`176 / 179`
  does not mean the ledger works**, and M15's PASS says so in its own text.
- **`check-spec-coverage.mjs` verifies that a row *points* somewhere. It never verifies that
  what the row *says* is true.** One defect, four instances, recorded as one line because four
  notes is how three of them stayed open — see *Spec coverage* below. Owner:
  `commandcenter-orchestrator` under ADR-013.
- **The provenance banner cannot see its own instrument.** `scripts/lib/provenance.mjs:112`
  scopes `git status --porcelain` to the scanned tree (`apps/web`), so a run with
  `scripts/check-rtl.mjs` modified printed `· clean`. §8b exists so a number can be re-derived;
  the checker is the one file whose modification changes the number without changing a scanned
  file. Owner: `design-system-guardian`. Found in M15's re-gate.
- **`check-rtl`'s headline percentages are evidence again as of 2026-08-17.** Items 3b and 3c
  landed and were proven by planting the defect: deleting two Arabic plural lines now gives
  `tsc` exit 0 and `check-rtl --gate` **exit 1** on catalogue-integrity. The baseline is **308**
  and the move from 261 is decomposed — +55 the checker got better, −8 debt paid, **0 added**.

The shared property, and the reason this list exists rather than four separate notes: **every
one of these is a declared value being read as an observed one.** That is the same defect as a
plausible zero (CLAUDE.md rule 9), one level up — it is a plausible zero about the measurement
instead of about the data.

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

**`thread-model-engineer` is dispatched onto M16 as of 2026-08-17 and is deliberately not in
the table above yet.** It owns `Plan §12` and `contracts/thread-model.md` outright. It joins
the roster — and becomes messageable — **in the same act as writing its own first
`comms/status/thread-model-engineer.md`**, because `check-comms.mjs` fails on a roster slug
with no heartbeat file and writing that file on its behalf would be a fake heartbeat, the same
class of lie as a plausible zero. **Ownership and reachability are two facts and this board
had been treating them as one.** Until the status file appears, M16 traffic goes to
`inbox/_all/` (`…/20260817-2110-commandcenter-orchestrator-m15-done-m16-open.md`). Wiring the
row is `commandcenter-orchestrator`'s first act once the file exists — the row, the
`contracts/thread-model.md` ownership cell, and nothing else.

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

**Review answer backlog — cleared 2026-08-17, and two of the four answers correct the agent who
asked.** All four were answered on their own merits during the re-gate session, before the M15
re-request rather than after it, because a re-request that jumps a two-day queue teaches the
queue not to matter. **None was back-filled with M15's verdict** — answering a question with a
verdict about a different milestone is the tidy-looking lie this board exists to prevent.

| Message | Milestone | What the answer found |
|---|---|---|
| `…/20260816-2152-agent-library-curator-artifact-write-capability.md` | M0 · ADR-009 | **Verified.** 12 agents, all `status: draft`; 12/12 `wired_into` includes `workspace`; `company-interview` is `wired_into: [workspace]`; live count **0**; `GET /metrics/live` → **503 `metrics_unavailable`** — it refuses rather than zeroing |
| `…/20260816-2236-map-galaxy-engineer-rail-tone-rereview.md` | M1 | **Corrects the asker.** Light `ink-2/bg` is **4.60, not 5.05** (5.05 is the light `bg-3` figure). Still AA — but clearing the floor by **0.10**, not 0.55. **And the guard is vacuous:** removing `tone="muted"` from a real call site leaves `primitive-color-defaults.test.ts` green (`:190-191`, `if (props.length === 0) continue`) |
| `…/20260816-2247-shell-navigation-engineer-costticker-refail-fixed.md` | M1 | **Verified, with one thing still owed.** `useEndpoint.ts:74` requires `malformedMessage`; `CostTicker` parses `ledger.state` (`:147-148`). **The live Docker three-state reproduction was not run** — the standing acceptance case remains owed |
| `…/20260817-0005-design-system-guardian-review-request-provenance-and-s9-ledger.md` | M6 | **Verified.** `provenance.test.mjs` 10/10; the banner carries `+03:00`; `RailLabel` defaults to muted. **New finding:** `BranchLabels.tsx:31-32` uses `role=button` + `aria-label`, taking the sublabels **out of the accessibility tree** |

**What is still owed, and it is not nothing: the four `## Answer` blocks were never written to
the message files.** `fidelity-qa-reviewer`'s `Write` tool was disabled for that session, as it
was for the first acceptance attempt. The *facts* survive — transcribed into
`comms/handoffs/M15-fidelity-qa-reviewer-acceptance-2.md` under *Backlog verified facts* — and
the two findings that are somebody's work were routed as messages
(`map-galaxy-engineer`, `design-system-guardian`). **The reviewer's prose did not survive and is
not reconstructed**, because a paraphrase filed as an `## Answer` is a fabricated verdict. Those
four files still read `status: open`, and that is now accurate rather than stale: an answer that
exists only in a terminated session did not happen, per `comms/README.md`. They are re-answered
in writing on the reviewer's next dispatch.

**The structural finding, since this is twice:** *`fidelity-qa-reviewer` cannot write files, and
this board's protocol is written entirely in files.* Two verdicts and four answers have now been
produced by an agent that had no way to file them, and each time the content survived only
because someone copied it out by hand. This is a harness fact, not an agent failure — the
reviewer correctly refused to route around the restriction with a shell heredoc, twice. Until it
changes, **every `fidelity-qa-reviewer` dispatch ends with `commandcenter-orchestrator`
transcribing**, and the transcription marks its own seams.

*Also found, and small:* seven of the messages answered this session carried a **bare, empty
`## Answer` heading with `status: open`** — the stub from `comms/templates/message.md`, left in
place by agents copying the template. `check-comms.mjs` only inspects the answer body when
`status` is `answered` or `closed`, so an empty stub under `open` is invisible to it. Harmless in
itself; it matters because *"does this file contain `## Answer`"* is what a human or a script
greps for, and on seven files that grep was wrong.

---

## Part Two ladder — the platform (`Plan §20`)

Everything in this section comes from `AGENTOS-V2-PLAN.md`, which is a **plan, not the spec
of record** (ADR-012). Sections are cited as `Plan §n`. Nothing here is gated differently:
a milestone still closes only on a `fidelity-qa-reviewer` PASS.

| # | Milestone | Plan § | Lead (exists today) | State |
|---|---|---|---|---|
| 15 | Projects · cascade · identity | §9 · §10 · §11 · §23.12 | `runner-engineer` | **done 2026-08-17.** PASS `comms/handoffs/M15-fidelity-qa-reviewer-acceptance-2.md` at `eaca677`, source-and-token. Provenance of its mechanical checks: `scanned at 2026-08-17 20:34 +03:00 · eaca677 · clean` · 311 files · 0 violations · 2 exemptions. Prior FAIL at `8e77a23` kept as record. |
| 16 | Threads · addressing · mailbox | §12 · §23.7 · §23.8 · §23.12 | `thread-model-engineer` | **open 2026-08-17.** Both release conditions met. **Lead dispatched alone**; every other slice is held behind `contracts/thread-model.md` |
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

**M15 is closed as of 2026-08-17** — every slice above shipped, was gated once as a whole on a
still tree, failed, was fixed and re-gated to PASS. The distinction at the top of this board did
not stop it closing and does not stop binding: **completed is not validated.** Nothing here has
been proven against a real run, because there have been none. The PASS says so in its own text
rather than in a footnote, which is the only reason it is safe to cite.

### M15 verdict — **PASS** on re-gate, 2026-08-17. The milestone is closed.

Verdict of record: **`comms/handoffs/M15-fidelity-qa-reviewer-acceptance-2.md`**, by
`fidelity-qa-reviewer` at `eaca677` on a clean tree. It **supersedes** the FAIL at `8e77a23`
(`…-acceptance.md`), which is kept unedited as the record of what was true two commits before.
The reviewer's framing, quoted rather than paraphrased, because the PASS is narrower than the
word:

> **Source-and-token PASS.** The 1440px side-by-side against the reference frame has still
> never been run, on any milestone, by anyone. **Proportion, density and optical weight are
> unverified.**
>
> **M15 can be completed. M15 cannot be validated.** `runnerConfigured` is `false`, read off a
> live runner. Of 179 runner tests the 3 skipped are exactly the three that would catch a
> writer/schema mismatch.

**All three blocking items cleared, and each was cleared by planting the defect rather than by
reading the diff.** That is the standard this board has been asking for since the third
instrument was caught; it was met on all three.

| # | Blocking item | Owner | How it closed |
|---|---|---|---|
| 1 | The provenance producer shipped; the drawer consumer never did — SOURCE UNKNOWN for every agent, always | `drawer-engineer` | **cleared, empirically.** The reviewer ran a live runner (pid 15600, killed after): `GET /api/p/agentos/agents/sales/account-enrichment` → `sourceRef "project:…@sha256:db02d09…"`, through `normalizeAgentDoc` + `drawerProvenance` → `state: "project"`. Three falsifications: a frontmatter-only `sourceRef` yields `null` (**envelope-only enforced**), detail-vs-run conflict resolves to `global` (**order is a preference**), `'garbage'` + a valid run resolves to `project` (**no shadowing**) |
| 2 | Three uncatalogued user-visible strings in `ProjectSwitcher.tsx:185-186`; `check-rtl` structurally blind to them | `rtl-arabic-pdpl-specialist` · `shell-navigation-engineer` | **cleared, with the debt decomposed** — old lens/old tree **261** (baseline reproduced), new lens/old tree **316** (+55 newly visible), new lens/new tree **308** (−8 paid). **Per-finding diff: added 0, removed 8, all `ProjectSwitcher.tsx`.** A zero-interpolation `aria-label={\`…\`}` now FAILs where it was silent |
| 3a | `validate:coverage` never resolved Test-column paths | `commandcenter-orchestrator` | **cleared** — a nonexistent Test path is now **FAIL, exit 1**; `— (owed)` now warns |
| 3b | Nothing could see a missing Arabic plural class | `rtl-arabic-pdpl-specialist` | **cleared, proven by planting it** — deleting two Arabic plural lines gives `tsc` exit 0 and `check-rtl --gate` **exit 1** on catalogue-integrity |
| 3c | The "7 TODO(ar)" headline counted prose | `rtl-arabic-pdpl-specialist` | **cleared** — the checker counts what it names |

**The RTL headline percentages are citable again.** That condition was the reviewer's and it is
discharged, along with 3a's.

**One of item 3's siblings did *not* close, and it is not swept under the PASS:** a requirement
citing a spec section that does not exist — **`§99.9` still passes, exit 0, silent** — was
re-falsified during this re-gate. It is the general defect below, and it is mine.

#### Four follow-ups from the PASS, routed with owners in the same act as the filing

Per the protocol rule the FAIL earned: *a review that recommends a change to a file it does not
own files a message to the owner and a BOARD line in the same act as filing itself.* **None of
these blocks M16.**

| # | Finding | Owner | State |
|---|---|---|---|
| 1 | **`comms/specs/observability.md:242` is false at `eaca677`** — says artefacts have no project segment; it landed one commit later at `7b6401d`. Safe direction, but it is the row a future erasure implementer reads, and it sends them to build something that already exists | `observability-engineer` | **routed** — `…/observability-engineer/20260817-2105-…-erasure-table-row-242.md` |
| 2 | **`ProjectSwitcher.tsx:243` renders an untranslated API enum** — `paused` / `archived` verbatim, Latin script in an Arabic pill. The `active` branch goes through `t()`; the other does not. Latent at one project | `shell-navigation-engineer` | **routed** — `…/shell-navigation-engineer/20260817-2105-…-projectswitcher-untranslated-enum.md` |
| 3 | **The provenance banner's dirty scope excludes the instrument** — `provenance.mjs:112` scopes to `apps/web`, so a run with `scripts/check-rtl.mjs` modified printed `· clean`. §8b exists so a number can be re-derived, and the checker is the one file whose modification changes it | `design-system-guardian` | **routed** — `…/design-system-guardian/20260817-2105-…-provenance-excludes-the-instrument.md` |
| 4 | **`scripts/check-rtl.mjs` contains two literal NUL bytes** (offsets 38692, 38730, a split sentinel) — ripgrep reports `binary file matches` and skips it, so a reviewer grepping the RTL checker gets nothing. It is the file three agents grepped during M15's blocking items | `rtl-arabic-pdpl-specialist` | **routed** — `…/rtl-arabic-pdpl-specialist/20260817-2105-…-check-rtl-nul-bytes.md` |

All four were **independently re-verified against the tree before being routed**, so that four
messages do not go out on a transcription.

#### Carried forward from the verdict — the finding that fell out of the record

**`/api/all/approvals` serves every project's run `inputs`, and was tracked nowhere.**
`apps/runner/src/routes/api.ts:224-226` → `lib/runStore.ts:196-213` (`inputs: state.inputs`);
`packages/contracts/src/api.ts:324`, `:664` (`scope: 'cross-project'`). Owner:
**`runner-engineer`**, fixing it concurrently. No web consumer today, so it is latent — but it
is **contract-level**, so any future consumer gets the payload by default.

**How a finding in a mandatory sign-off failed to reach this board, because the mechanism will
drop the next one too.** The isolation sign-off is `Plan §22`/§21.8 **mandatory**, and it named
this and recommended the route return the label and the count. It then reached neither BOARD nor
the session log's carry-forward list. The mechanism: **a mandatory artifact is gated on being
*filed*, and nothing is gated on its contents being *routed*.** It was filed as a handoff plus a
`review-request` to `fidelity-qa-reviewer`, and both of those are *acceptance* channels — they
prove the artifact exists and put it in a review queue. Neither is an *assignment* channel. A
recommendation about `routes/api.ts` addressed to the reviewer never becomes work, because the
reviewer does not own that file and the owner was never messaged. The reviewer caught it only
because they read the sign-off end to end during acceptance, which is luck about reading order.

**Rule, from now, and it is one line because a long rule is not followed:** *a sign-off or
review that recommends a change to a file it does not own files a message to the owner and a
BOARD line in the same act as filing itself — the artifact is not complete until both exist.*
Adopted for the isolation sign-off, the fidelity verdict, and any future mandatory artifact. It
is deliberately a protocol rule and not a checker: `check-comms.mjs` can see that a message
exists, and cannot see that a recommendation inside prose has an owner.

#### The isolation sign-off's *Deliberately not done* list, swept — 2026-08-17T20:23, `runner-engineer`

The rule above, applied backwards to the artifact that earned it. That section had **eight**
entries and one had been picked up. Each is now in exactly one of three states, because the
state this board keeps paying for is the fourth: *present in an artifact, absent from here,
therefore never work.* Filed with `comms/handoffs/M15-runner-engineer-artefacts-carry-the-project.md`
and the messages named in it, in one act.

| Entry | State | Owner |
|---|---|---|
| five library-plane read routes discard the project | **fixed** — REQ-RUN-34 | `runner-engineer` |
| `sql-executes.test.ts` did not compile | **fixed** 18:06 — but its consequence stands: **the writer and the schema have never met**, and the three tests that would prove it skip on `DATABASE_URL` | `runner-engineer` — needs a live Postgres |
| no red test for a defect in another agent's plane | **deliberately not done** — both defects now have green tests in the planes that own them | — |
| `/api/all/approvals` returns `inputs` | **fixed** — REQ-RUN-40 | `runner-engineer` |
| **artefacts are `artifactsRoot/<runId>/` with no project segment** | **fixed** — `<artifactsRoot>/<project>/<runId>/`, REQ-RUN-42/43, new code `artifact_unattributed` | `runner-engineer` |
| no Langfuse project attribute on any span | **filed, in flight this session** — `observability/instrument.ts` was live in the tree while this landed. Also breaks **rule 7 (erasure)**: no project handle in the trace store to search on | `observability-engineer` |
| nothing empirical | **deliberately not done** — zero runs, one project, no API key. `project-scoping.md` §6 unchanged | the human |
| no commit | unchanged | — |

**Two items routed onward, each with its message filed in this same act** — that is the rule
working rather than being cited:

- **`ProjectSummary` narrowing → `shell-navigation-engineer`.** `GET /api/projects` is
  coordinator-scoped and returns one row per client; `budgetMonthlyUsd`, `defaultAccountId`,
  `hostAffinity` and `libraryRemote` are now typed as the only value each may hold, so ADR-015
  Q6 making a budget real **stops the route compiling**. The real fix — deleting the four
  fields — edits `apps/web/src/components/shell/test-harness.tsx`, which is theirs and mid-review
  under blocking item 2. `…/shell-navigation-engineer/20260817-2023-runner-engineer-projectsummary-is-typed-shut….md`
- **New `ApiErrorCode` `artifact_unattributed` (500)** — announced to `inbox/_all/`, because
  adding a code is a contract change and `drawer-engineer` renders codes.

*The migration question was decided, not deferred:* there is nothing to move (no run has ever
executed, so no artefact exists), and **a directory in the old layout is refused, never adopted,
never deleted.** Adopting one files a client's output under whichever project happens to be
mounted — the act `run_unattributed` already refuses one layer up in the ledger.

*Tree state, so a sweep does not misread it — measured 2026-08-17 19:50, and the tree is still
moving:* the previously recorded *"red on 5 of 421 vitest tests"* **has cleared**;
`npm run test:web` ran green on both halves at 19:42. `npm test` is **162 tests, 161 pass, 0
fail, 1 skip** — up from 146 as three agents land fixes and tests concurrently. Ten minutes
earlier the same command was 151/153 with `rtl-pdpl.test.mjs` red mid-edit, which is worth
leaving on the record as the illustration: **a test count on this board is a timestamp, not a
fact.** `validate:coverage` exits 0 at 674 requirements / 637 (95%) / 14 warns — the totals moved
under me while I wrote this paragraph. `check-rtl --gate` holds at baseline **308**. The rule
stands and is now the operative one: **gate when the tree is still.**

*The coverage gate is green and the reason it was red is closed.* The eleven — **twenty, in
fact; the earlier count on this board was wrong and omitted three spec files entirely** —
`validate:coverage` FAILs from M15 moving every view under `(views)/p/[project]/…` were repointed
by `shell-navigation-engineer`, `chart-matrix-engineer`, `sessions-relay-engineer` and
`map-galaxy-engineer`. `npm run validate:coverage` now exits 0 with 0 FAILs, 16 warns, 671
requirements / 634 (94%). **Read that green through blocking item 3a**: it was, until this
session, a green over half a table.

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

**M15 flipped to `done` on a `fidelity-qa-reviewer` PASS, and that PASS is narrower than usual**
— see the header note and `contracts/project-scoping.md` §6 for the seven things it does not
cover. Cite it with its width attached or do not cite it.

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

### M16 — Threads · addressing · mailbox (`Plan §12`) — **OPEN 2026-08-17**

**Both release conditions are met. This is the record of them being met, not of them being
waived.** `Plan §20` forbids P2 overlapping anything, P1 included:

1. **Met.** `fidelity-qa-reviewer` answered **PASS** on M15 at `eaca677`, at the
   source-and-token standard, with its narrower coverage stated
   (`contracts/project-scoping.md` §6) — `comms/handoffs/M15-fidelity-qa-reviewer-acceptance-2.md`.
2. **Met.** `rtl-arabic-pdpl-specialist`'s **cross-project isolation sign-off** is filed
   (`comms/handoffs/M15-rtl-arabic-pdpl-specialist-cross-project-isolation.md`) — mandatory,
   not advisory (`Plan §22` · §21.8), a separate artifact from the PASS, and the reviewer graded
   it honest: it reads *structural*, refuses "empirical" by name, and downgrades five of its own
   prior claims with *"I did not read the writer"*.

**The sequence is worth keeping because it is the useful shape:** condition 1 was tested on
2026-08-16 and **failed**, with three blocking items; it was re-tested on a still tree two
commits later and passed. M16 released on a re-request that answered PASS, not on the passage
of time, and not on any of the three fixes being individually declared good by their own author.

**Dispatch is deliberately not parallel.** `thread-model-engineer` is dispatched **alone**, to
write **ADR-023**, **`contracts/thread-model.md`** and migration **`0008_`**. Every other slice
below is held until that contract exists. Six agents reading `Plan §12` produce six readings of
one shape, and the disagreement surfaces a week later as two contracts — which is the defect
this board has now paid for four times. The announcement is
`comms/inbox/_all/20260817-2110-commandcenter-orchestrator-m15-done-m16-open.md`, addressed to
`_all` because the lead **cannot yet be messaged** (see the roster note).

**Two hazards carry over from the frame unchanged, and they are the two things most likely to
be discovered late and expensively. Read them before writing a line of M16:**

> **Hazard 1 — `@@` fan-out costs N runs against a cap that has never once fired.** The run
> count is real and the money is not: there are no completed runs to average, so a dollar
> figure in a cost preview would be a plausible number on the one surface where plausible
> numbers get believed.
>
> **Hazard 2 — M11 is absorbed, not built.** No `ops.task`, no `ops.question`, and
> `POST /api/run/:runId/input` is **never built** — M16 leaves a test asserting its absence.

Full text in *Hazard 1* and *Hazard 2* below; neither is summarised anywhere else.

**M16 inherits M15's distinction verbatim, and it is not a formality here:**

> **M16 can be completed. M16 cannot be *validated* until Phase 0's human items land.**
> Threads are schema, routing and UI — `ops.thread`, `ops.message`, an addressing grammar, a
> composer, a mailbox drained at tool boundaries. All of it can be built and none of it makes
> a model call. **A thread with an agent on the other end cannot be proven until
> `RUNNER_ANTHROPIC_API_KEY` lands.** Every M16 handoff repeats this rather than blurring it,
> and M16's PASS will say which half it covered.

#### Slices — owner, and successor where it differs

`thread-model-engineer` **owns `Plan §12` outright**, not through an interim holder: the Part
Two specialist definitions became spawnable on 2026-08-17. Roster admission is a separate act
from ownership — see the note under the slice table.

| Slice | `Plan §` | Owner | Successor |
|---|---|---|---|
| **Lead** · `ops.thread` + `ops.message` schema, `thread_id` on `ops.run_ledger`, `contracts/thread-model.md`, **ADR-023** | §12 | `thread-model-engineer` | *owner* |
| The addressing grammar as a parser + its refusals — `@agent` · `#department` · `@@fan-out` · bare = Chief of Staff | §12 | `thread-model-engineer` | *owner* |
| `POST /api/thread/:id/message` **in `api-contracts.md`**, and the mailbox drained at tool boundaries in the runner | §12 | `runner-engineer` | `platform-projects-engineer` |
| THREADS view · addressing composer with cost preview | §12 · §23.8 · §23.12 P2 | `sessions-relay-engineer` *(§23.12 notes the rename)* | stays |
| **THREADS replaces SESSIONS in the tab bar** — the shell slot, not the view | §23.5 · §23.8 | `shell-navigation-engineer` | stays |
| Mailbox composer, three interrupt levels — replaces `RunConsole`'s one-way stream | §12 · §23.12 P2 | `drawer-engineer` | stays |
| The monochrome register for `#` vs `@@`, and for `note` / `steer` / `halt` | §12 · Part I §1.3 | `design-system-guardian` | stays |
| `thread-feed` widget · **ADR-028** | §23.7 · §23.8 | `dashboards-engineer` | stays |
| `thread_id` on the ledger — the 34 metrics endpoints and LAST RUNS that read it | §12 · §3.5 | `observability-engineer` | stays |
| Arabic/RTL **and PDPL** review of every new surface — before it ships, per §23.11 rule 6 | §1.4 · Part VII.4 · §21.8 | `rtl-arabic-pdpl-specialist` | stays |
| Acceptance | Part VI | `fidelity-qa-reviewer` | stays |

**One slice is dispatched. Ten are held.** Only the lead's two rows are live work today; every
other row waits on `contracts/thread-model.md` existing. A slice owner who starts against
`Plan §12` before the contract lands is building a second reading of a shape that has one
author — see the split of `POST /api/thread/:id/message` below for what that costs.

**Ownership was granted at framing; roster admission happens at dispatch, and dispatch has now
happened.** `thread-model-engineer` joins the *"Roster & ownership"* table in the same act as
writing its first `comms/status/thread-model-engineer.md` — because `check-comms.mjs` fails on a
roster slug with no heartbeat file, and the alternative is a placeholder status, which is a fake
heartbeat and the same class of lie as a plausible zero. **As of 2026-08-17T21:10 that file does
not exist**, so it is still not on the roster and still cannot be messaged; M16's announcement
went to `inbox/_all/`. It gains `contracts/thread-model.md` in the same act. Nothing is held in
trust for it, because it owns `Plan §12` outright.

**Two corrections to the slice list as first proposed, both about one artifact having one
owner** — the defect this board keeps paying for:

- `POST /api/thread/:id/message` was proposed as `runner-engineer` **+** `thread-model-engineer`.
  It is split instead: **`thread-model-engineer` specifies the message and interrupt semantics
  in `contracts/thread-model.md`; `runner-engineer` transcribes the route into
  `api-contracts.md`, which is theirs, and implements the drain.** Two agents editing one
  contract is how a shape acquires two readings.
- THREADS *replaces* SESSIONS (§23.8), and the tab bar is `shell-navigation-engineer`'s
  (§2.0, §23.5 — *"the shell cannot hold six tabs"*). `sessions-relay-engineer` builds the
  view; the shell slot it lands in is not theirs to edit.

**Migration number: `0008_` is `thread-model-engineer`'s.** Migrations are the second
shared-integer namespace on this board and it has already been raced once (`0006`). One author
writes M16's schema; if a second slice needs a migration it asks first.

#### Hazard 1 — `#sales` costs one run, `@@sales` costs six, and the cap has never persisted

`Plan §12`, quoted because paraphrase loses it:

> *"`#sales` and `@@sales` must be different characters and must **look** different, because
> one costs one run and the other costs six. A UI that makes broadcast easy to trigger
> accidentally will cost real money on the first day."*

The coupling nobody has named, and which is the reason this is on the board rather than in the
composer's ticket: **the hard monthly cap that would stop a runaway fan-out has never once
persisted.** Zero runs have executed, so `budget_monthly` has never refused anything; M15 lists
"a budget cap was proven to refuse" among the things it *cannot* validate. Fan-out is therefore
the first feature in this product whose **first ever validation run costs N× money, against an
enforcement point that has never fired.** Three consequences, all binding on M16:

1. **The run count is real; the money is not.** §23.8 wants the composer to say
   `@@sales · 4 runs · ~$0.40`. **The `4` is knowable exactly** — it is the resolved member
   count. **The `$0.40` has no source**: there are no completed runs to average. M16 prints the
   count and either omits the money or states its basis in the same breath. Inventing a dollar
   figure is BOARD rule 9 in the one direction it never permits, and a cost preview is exactly
   the surface where a plausible number gets believed.
2. **`@@` requires an explicit confirm that names the count.** Not a tooltip, not a hover.
   §23.11 rule 7 (keyboard before pointer) applies: the confirm must be reachable and
   *dismissable* from the keyboard without the fan-out firing.
3. **Fan-out *dispatch* stays refused, with a stated reason, until a cap has proven a
   refusal.** Grammar, parser, composer and preview all ship in M16. The path that actually
   spawns N runs is gated behind the same Phase 0 item everything else waits on. This is the
   cheap, reversible half — it costs one refusal branch now and it is deleted in one line the
   day the key and the cap land.

#### Hazard 2 — M11 is absorbed, not built. Repeated here because it is repeatable-wrong

Already stated in the amendments table above (`Plan §19`); restated inside M16 because M16 is
where someone will be tempted:

> **Do not create `ops.task` or `ops.question` as standalone entities.** A task **is** a thread
> with `due_at`. A question **is** a message kind inside a thread. `expires_at` stays
> **mandatory** on it — Part One's reasoning is unchanged and correct (`Plan §12`). The M11
> board and the notification ladder survive inside M16/M17; the parallel entity model does not.

And its sibling, which is `runner-engineer`'s to keep true: **`POST /api/run/:runId/input` is
never built.** ADR-023 supersedes it. It is not in `api-contracts.md` today, and M16 should
leave behind a **test asserting it is absent** rather than a comment saying it should be —
the `cascade-ceiling.test.ts` precedent from M15: assert the boundary, not the intent.

#### ADR-028 — what P2 actually needs, decided

`Plan §18` lists ADR-028 as blocking **P2 and P4**. Asked whether P2 needs all three new widget
types: **no, and the ADR is still written once, in M16.** Splitting it three ways would make one
rule into three, and the rule is the valuable half.

| | In ADR-028 (M16) | Built in |
|---|---|---|
| **The cap** — exactly three new types ever; everything else composes from the existing seven (§23.7) | **yes, this is the decision** | — |
| `thread-feed` — full schema | **yes** | **M16** |
| `board` — named and reserved, schema deferred | named only | M17 / *Any* (§23.12) — needs ADR-029's drag primitive, which is unwritten |
| `calendar` — named and reserved, schema deferred | named only | M18 / P4 — its data is `ops.schedule`, which does not exist |

Reason for the split, so it is not re-litigated: **writing a widget schema for a table that
does not exist produces a plausible spec**, and `WidgetView`'s exhaustive `switch` with the
`never` fallthrough should not gain arms for types nothing can render. The compiler naming
every site is the safety property; adding two unrenderable arms spends it early.

#### Deliberately out of M16 scope

Nothing from `Plan §13`–§17. Specifically, and because each has already been proposed once:

- **No presence, no work products, no worktree isolation, no diff review** (§13 → M17).
- **No scheduler, no triggers, no `calendar`, no `next up` strip** (§14 → M18).
- **No memory tiers** (§15 → M20), **no Expo or Tauri client** (§16 → M19/M21), **no Chief of
  Staff routing** (§17 → M22). Bare-address-means-Chief-of-Staff is a **grammar rule** in
  ADR-023; the router that would answer it is M22's. M16 defines the address and refuses it
  honestly.
- **No BOARD view**, no `board` or `calendar` widget implementation, no drag primitive
  (ADR-029, unwritten).
- **No search-index extension to threads** (§23.10 — chrome, any phase, and it is a fourth
  consumer of a schema that will still be moving).
- **No CHART → ROLLOUT rename** (ADR-030, optional).

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

**Amended 2026-08-17: they became spawnable, and that is not the same as rostered.** The
gating fact changed — these definitions can now be run. What did *not* change is the pairing
`check-comms.mjs` enforces: **a roster slug with no `comms/status/<slug>.md` fails
`npm run validate:comms`, and writing that file on the agent's behalf is a fake heartbeat.**
So admission is now bound to **dispatch**, not to spawnability: an agent joins the roster in
the same act as writing its own first status file, and can be messaged from that moment. Until
then it can *own* work on this board (see M16) but cannot receive an inbox message — milestone
announcements go to `inbox/_all/`. Ownership and reachability are two facts and this board had
been treating them as one.

| Defined agent | Owns (`Plan §`) | Contract it will own | Held in trust by |
|---|---|---|---|
| platform-projects-engineer | §9 · §10 — `ops.project`, cascade mount, library sync, project switching | `contracts/project-scoping.md` | `runner-engineer` |
| *(cascade resolution)* | §10 — resolution, resolved identity, promote/fork | `contracts/agent-cascade.md` | `agent-library-curator` — **stays with them**, per ADR-013 |
| thread-model-engineer | §12 — threads, addressing grammar, mailbox, interrupt levels | `contracts/thread-model.md` | **nobody — owns M16 outright. Dispatched 2026-08-17; joins the roster on its own first status file** |
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
| 015 | Project scoping — third plane, `ops.project`, routes | `runner-engineer` | **proposed** — file exists, `ADR-015-project-scoping.md`, 2026-08-17 |
| 016 | Identity vs device vs billing account | `identity-access-engineer` | **proposed** — file exists, `ADR-016-identity-device-billing-account.md`, 2026-08-17 |

| 017 | Two planes — Library (git) + Operations (Postgres) · *`Plan §3` calls this "ADR-009"* | — | **reserved, unwritten** |
| 018 | MCP runtime and credential custody · *`Plan §3` calls this "ADR-010"* | — | **reserved, unwritten** |
| 019 | Memory tiering + write authority, five tiers · *`Plan §3` "ADR-011" / §18 "ADR-011 amended"* | `memory-index-engineer` *(undefined)* | **reserved, unwritten** |
| 020 | Task-board semantics · *`Plan §3` calls this "ADR-012"* | — | **reserved, unwritten** |
| 021 | Auth exists in v2 — accounts inside the tailnet · *`Plan §3` calls this "ADR-013"* | `identity-access-engineer` | **reserved, unwritten** |
| 022 | Foundry token-budget policy · *`Plan §3` calls this "ADR-014"* | `agent-foundry-architect` *(undefined)* | **reserved, unwritten** |
| 023 | **Thread unification** — runs, sessions and tasks become threads; the addressing grammar (`@agent` · `#department` · `@@fan-out` · bare = Chief of Staff); the mailbox and its three interrupt levels (`note` · `steer` · `halt`); **supersedes M12's `POST /api/run/:runId/input`, which is never built** · *`Plan §18` "ADR-018"* | `thread-model-engineer` | **claimed 2026-08-17, dispatched 2026-08-17, unwritten** — blocks all of P2, and every held M16 slice waits on it |
| 024 | Scheduler ownership, six trigger types · *`Plan §18` "ADR-019"* | `scheduler-engineer` | **reserved** |
| 025 | Client strategy — Expo, Tauri, contentless push · *`Plan §18` "ADR-020"* | `client-platform-engineer` | **reserved** |
| 026 | Work products + worktree isolation · *`Plan §18` "ADR-021"* | — | **reserved** |
| 027 | Chief of Staff — routing, delegation, trust ladder · *`Plan §18` "ADR-022"* | `chief-of-staff-architect` | **reserved** |
| 028 | **Three new widget types** — `board`, `calendar`, `thread-feed` — and the rule that everything else composes from the existing seven (§23.7) · *`Plan §18` "ADR-023"* | `dashboards-engineer` | **claimed 2026-08-17, unwritten** — blocks P2 and P4. **M16 writes it once and builds only `thread-feed`;** `board` and `calendar` are named and reserved, schemas deferred to M17 and M18. See the M16 section. |
| 029 | Drag without a dependency · *`Plan §18` "ADR-024"* | `design-system-guardian` | **reserved** |
| 030 | *(optional)* Rename CHART → ROLLOUT · *`Plan §18` "ADR-025"* | `chart-matrix-engineer` | **reserved** |

| 031 | Where §9's AA floor supersedes a spec-named text token | `design-system-guardian` | **claimed, unwritten** |
| 032 | The session envelope allowlist — `account_id` refused (§3.1, `Plan §11` Q19) | `sessions-relay-engineer` | **claimed** — ruling already binding in `envelope.ts` + 2 tests; ADR transcribes it |
| 033 | **Provenance is chrome: the badge is monochrome and drift is not a status** — a departure from `Plan §10`'s *"staleness dot — the same honesty rule as connector health"*, on the visual register only. Also: exclusions are not a sixth badge state, and the primitive count moved 8 → 9 | `design-system-guardian` | **claimed 2026-08-17** — content live as `contracts/design-tokens.md` §10; ADR transcribes it |

034+ is claimed just-in-time at its own milestone. **Do not copy a number out of the plan** —
translate it through `comms/decisions/README.md` first.

**023 and 028 were claimed on 2026-08-17 with M16's frame, before any M16 file existed** — and
that is the rule working rather than an exception to it. `decisions/README.md` says allocation
is claimed on BOARD *before* the file is written; a milestone's numbers are therefore claimed
when the milestone is framed, not when its author sits down. Both numbers were translated
through the concordance (`Plan §18`'s "ADR-018" → **023**; its "ADR-023" → **028**) and
verified against that table rather than taken from the plan. The draft-naming rule still
applies: drafts are `ADR-draft-<topic>-<author-slug>.md` and the number is fixed at acceptance.

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

**That rule was enforced on half the table until 2026-08-17.** `check-spec-coverage.mjs`
resolved the `Implemented in` column and never resolved the `Test` column at all — **529 test
path claims, across 497 of 671 requirements, naming 102 distinct files, were resolved zero
times.** Found by `fidelity-qa-reviewer` during M15 acceptance and falsified: a nonexistent Test
path gave exit 0, no FAIL, no warn. Fixed and pinned by `scripts/__tests__/spec-coverage.test.mjs`
(7 tests) — the gate had no test of its own before that. The judgement that *is* the fix — which
cell forms count as path-shaped and why prose stays prose — is written out in
`comms/handoffs/M15-commandcenter-orchestrator-coverage-test-column.md` and should be read before
anyone edits the extractor. Every reported figure was unchanged by the fix: the column was
unenforced but, on this tree, not lying. **That is luck, and it is recorded as luck.**

#### The general defect, named once — `commandcenter-orchestrator` owns it

**`check-spec-coverage.mjs` verifies that a row *points* somewhere. It never verifies that what
the row *says* is true.** Recorded 2026-08-17 from M15's PASS. It is one defect with four faces,
and it is one line here rather than four notes because four notes is exactly how three of them
stayed open while the fourth got fixed.

| Instance | State |
|---|---|
| **Test-column paths resolved zero times** — 529 claims, 497 of 671 requirements, 102 distinct files | **fixed** 2026-08-17T19:35, pinned by `scripts/__tests__/spec-coverage.test.mjs` |
| **A requirement citing a spec section that does not exist** — `§99.9` passes, exit 0, silent. Re-falsified at `eaca677` | **open** — row A below |
| **REQ-DSH-33** — its three paths all resolve; what the gate cannot see is whether the files do what the row *describes*. Named by the verdict as the instance where the pointer is fine and the sentence is the claim | **open** — the class the gate has no mechanism for at all |
| **The impl-column near-miss** — a cell that nearly resolves counts as implemented | **open** — row E below |

The shared property with everything else in *"What the gates structurally cannot see"* at the
top of this board: **a declared value being read as an observed one.** A resolvable path proves
a file exists. It has never proved that the file does the thing.

#### What this gate still reports that it cannot observe

All eight falsified in a sandbox on 2026-08-17, all left as findings with owners rather than
fixed inside a session scoped to one item. Listed so that "coverage 94%, 0 FAILs" is read for
what it is.

| | What passes silently | Why it matters |
|---|---|---|
| **A** | A requirement citing a **spec section that does not exist** — `§9.9`, `§2.5.9`. Only the `§`/`PART` prefix is checked, never the id. | The exact parallel of the path bug, on the section column. A citation pointing nowhere is the same lie. |
| **B** | A spec with a `## Coverage` heading and **zero requirement rows**. | An agent can claim every section it owns and owe nothing. Section claims are checked; whether a claim has any requirements behind it is not. |
| **C** | A **typo'd requirement id** (`req-x-02`, lowercase). The row is not matched, so it vanishes from the table and from the total. | Requirements can be silently deleted by a typo, and the denominator moves with them. |
| **D** | A **truncated row** with three cells instead of five. `impl` and `test` come back empty and it counts as *declared-unbuilt*. | A malformed row is graded as an honest gap. |
| **E** | An impl cell reading **`yes`**, or a token/type/CSS class — anything unresolvable. Counted as **implemented**. | The 94% counts *cells that are non-empty*, not *files that exist*. |
| **F** | Renaming this section's heading. `boardOwnership()` finds nothing, and the ownership cross-check **degrades to warnings**. | The gate's second job disappears without turning anything red. |
| **G** | Any of the **16 warnings**. The script exits on `errors.length` only. | `implemented but has no verification` has never failed a build. |
| **H** | `## Deliberately not done` being present and **empty** — only the heading's presence is checked. | The section this project calls the most useful in a handoff is enforced as a string match. |

Owners: **A, B, C, D, E, H** are the gate's, i.e. `commandcenter-orchestrator` under ADR-013.
**F** is the same. **G** is a policy decision with 16 immediate consequences and belongs to the
agents who owe those warns (`runner-engineer` 11, `shell-navigation-engineer` 2,
`observability-engineer` 1, `rtl-arabic-pdpl-specialist` 1) — not to a gate fix.

**The general lesson, since this is the third instrument caught this week:** *a checker that has
never been falsified is a claim, not a measurement.* Three agents proved their fixes by planting
a defect and watching the gate go red, and that is the only reason M15's three blocking items
were found at all.

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
| §12 — threads, addressing, mailbox | `thread-model-engineer` — **dispatched 2026-08-17**, ADR-023 + `contracts/thread-model.md` + `0008_` in flight | *is the owner* |
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

**Eight of fifteen rows are unclaimed and that is correct right now** — they belong to
milestones nobody has opened. An unclaimed row here is a scheduling fact, not a gap; an
unclaimed row in the machine-checked table above is a build failure. Keeping the two tables
apart is what preserves that difference.
