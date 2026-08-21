# BOARD — Command Center build

**Spec of record:** [skilltree-clone-spec.md](../skilltree-clone-spec.md) — every decision
traces back to a section number in it. Quote the section when you cite it.

**Second document:** [AGENTOS-V2-PLAN.md](../AGENTOS-V2-PLAN.md) — Part One (§1–§8) and Part
Two (§9–§24). It is **a plan that amends the spec of record, not a second spec**
([ADR-013](decisions/ADR-013-part-two-standing-and-spec-coverage.md)). Cite it as `Plan §10`;
a bare `§10` always means the spec of record, which has no §10.

**Current milestone: none — `M16` closed 2026-08-18 on a PASS at `6323f41`.** All eleven slices
landed and were accepted across three verdicts (5 PASS / 2 FAIL → three fixes → re-gate → the
rule-6 sweep). Done: M0, M1, M2, **M5**, **M6**, **M15**, **M16**.

**`M17` and `M18` are both DONE — `fidelity-qa-reviewer` returned PASS on each, separately,
2026-08-19 23:06 +03:00 at `9b19438`, `verify` exit 0 and `check-tokens` `clean` / violations 0.**
Both failed their first acceptance (three surface findings on M17, one honesty finding on M18),
were fixed, and were re-gated. **The 1440px side-by-side was still not performed** — reference
frames remain absent repo-wide — so neither PASS carries a fidelity result in either direction.

The reviewer closed M17's live-DOM half rather than passing on jsdom: a CDP probe built **outside
the repo** drove headless Chrome at 1440×900 and observed all 18 controls under an `[inert]`
ancestor refusing `.focus()`, 24 forward Tabs never leaving the overlay, and **44 `.diffLine`
rows mounted of 8,000**. It watched that probe fail first — its initial run matched the wrong
control and reported the pre-fix shape back at it — which is the standing gate finding in a
fourth costume.

The history below is kept because it is how these two milestones actually went. Four agents were
terminated by
an API session limit on 2026-08-19 — not by a defect, and not at a slice boundary. What each had
finished is committed under its own name (`6f3abb2`, `94443e9`, `e4e0bff`, `51aba6f`, `03f04a2`,
`3f810b8`) and `npm run verify` exits 0 on the result, observed 2026-08-19 20:35 +03:00.

**Neither milestone is done, and two slices have no handoff** — the calendar widget and the
scheduler's wave 1 both stopped at the point of writing one. Under the definition of done that
makes them unreviewed, and the commit messages say so rather than leaving it to be inferred.
Still missing: M17's whole surface (roster line, diff screen, approve) and M18's routes, schedule
editor, save dialog and "next up" strip. **Nothing fires on a timer**; the clock is a computation.

**Still open:** `M3 — Runner + Run now + Langfuse` (unblocked by M2; the runner half waits on
the human for `RUNNER_ANTHROPIC_API_KEY`) · `M4 — SESSIONS` (relay unverified against a
bootable Happy, and §23.8 now replaces the tab it is named for) · `M8` ongoing.

> **Read this before opening M17.** Six milestones are "done" and **not one of them has been
> validated**: zero agent runs have ever executed, `0005`–`0008` have never met a live
> Postgres, and the 1440px side-by-side in Part VI has never been run on any milestone. Every
> PASS to date covers **source, tokens, and — since 2026-08-18 — a real page load**. The two
> things that would change that are both with the user (`RUNNER_ANTHROPIC_API_KEY`, and the
> reference frames), and neither is a reason to stop building. It **is** a reason never to let
> a done row read as a working feature.

> **M6's row was two days stale and this sweep corrected it, 2026-08-18.** The header and the
> ladder both read *"FAIL open, fix in flight"*; the FAIL had been cleared on **2026-08-16 at
> ~22:2x** by `…/_archive/fidelity-qa-reviewer/20260816-2208-dashboards-engineer-m6-ink3-fixed.md`
> — *"**PASS. M6 clears** … Zero `--ink-3` remain in `dashboards/**`."* Recorded rather than
> quietly fixed, because a board that says FAIL after a PASS is the house defect pointing the
> other way: a **declared** state outliving the **observed** one, and it cost `dashboards-engineer`
> two days of carrying a verdict they had already cleared.

**M15 closed 2026-08-17 on a PASS** — `comms/handoffs/M15-fidelity-qa-reviewer-acceptance-2.md`,
at `eaca677`, source-and-token standard. All three blocking items cleared, each proven by
planting the defect rather than reading the diff. Four follow-ups routed with owners. **The
earlier FAIL verdict at `8e77a23` is not deleted and not edited** — it is the record of what was
true two commits before, and `comms/handoffs/M15-fidelity-qa-reviewer-acceptance.md` stays where
it is.

**M16 was sequenced one-agent-first on purpose, and the sequencing worked.**
`thread-model-engineer` wrote **ADR-023**, **`contracts/thread-model.md`** and migration
**`0008_threads.sql`** alone, plus the addressing parser and the thread writer, at `8a9bdf5`.
Only then did the other slices start. The reason was the defect this board has paid for four
times — six agents reading one plan section produce six readings of one shape, and the
disagreement surfaces a week later as two contracts. **Nothing built in the second wave
needed a shape renegotiated**, which is the evidence the order was right rather than slow.

**If you own one of the two open M16 slices: build against `contracts/thread-model.md`, not
against `Plan §12`.** The contract is reviewed and the plan is not; where they differ the
contract has already absorbed a correction the plan does not know about — most sharply, the
interrupt levels are **two and a refusal**, not three.

**Read its sections, not the file.** It is 540 lines and no slice consumes all of it; §10
names what each consumer gets. That is rule 1 as amended — the reading cost of this repo
exceeded the work once already.

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
  `commandcenter-orchestrator` under ADR-013. **Two of the four are now closed** (the Test
  column, 19:35; the section column, 23:5x under [ADR-034](decisions/ADR-034-spec-citation-grammar.md)).
- **A gate can shape what people are willing to claim, and nothing in the output shows it.**
  Added 2026-08-17 as its own line because it is **not** the bullet above and was found by an
  agent noticing their own choice, not by any instrument. `check-spec-coverage.mjs:258` matched
  the `Spec §` column by *prefix*, so `` `Plan §12` `` — the form ADR-013 rule 2 **requires** for
  Part Two work — FAILed on its backtick. `runner-engineer`'s thirteen M16 rows cite `§3.2`,
  `§3.5`, `PART III`, `PART V`, which is defensible, and their filing says *"I picked those
  partly because they pass."* A gate that misses things leaves a visible gap; **a gate that
  refuses the correct citation moves the claims toward whatever is green, and the table still
  reads clean.** Fixed by ADR-034. The class is not: any gate narrower than the vocabulary its
  authors are required to use will silently edit them.
- **`identity-model.test.mjs` can be made to stop seeing its own input, and two of its
  assertions fail *permissively* when it does.** `scripts/__tests__/identity-model.test.mjs:52-58`
  — `code()` strips C-style block comments with `/\/\*[\s\S]*?\*\//g` **before** stripping `--`
  line comments, and three of its assertions (`:130`, `:138`, `:148`) run against the **joined**
  corpus of all eight migrations (`:129`). `0005_project_axis.sql:448` contains `/api/all/`
  followed by a star, inside `--` prose — an opening pair — so **the first closing pair anywhere
  in a later file deletes every intervening migration from that checker's view.** Found by
  `thread-model-engineer` while writing `0008`: an ordinary address separator turned
  `exactly one identity is seeded` red, claiming **0 inserts into `ops.identity`** from a
  migration that never mentions identity. It failed loudly there — and that is the accident.
  **`:138` (the seed holds no `@`) and `:148` (no CHECK pins the table to one row) both read a
  truncated corpus as a clean one and pass.** *Re-falsified by the orchestrator 2026-08-17
  rather than taken on report*: planting one ordinary closing pair in a later migration deletes
  **80,489 characters — the bulk of the corpus — from the checker's view**, takes `:130` from
  1 insert to 0, and leaves `:138` and `:148` green. Owner: `identity-access-engineer`. This belongs
  under the same general defect as the four `check-spec-coverage` instances, one level in: not
  *a declared value read as an observed one*, but **a checker whose input silently became empty,
  reporting the empty result as a pass.** A green assertion over nothing is a plausible zero
  about the measurement.
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

### One correction to the record, and it is the orchestrator's own — concurrent staging

**Commit `81c25d6` swept 566 lines of in-flight `packages/contracts/src/threads.ts` into a
`docs(comms)` commit.** `thread-model-engineer` was still writing that file when everything was
staged at once. It was unpushed, so it was re-split: **the docs commit is now `445456d` and the
contract code is in `8a9bdf5`.** Nothing was lost and nothing was rewritten after publication.

**The lesson is about concurrent staging, not about that agent.** `git add -A` is a snapshot of
a tree that several agents are writing to simultaneously, and it cannot tell finished work from
work in progress. A `docs(comms)` commit containing a TypeScript module is not merely untidy: it
breaks the property this board relies on everywhere else — **that a sha can be cited as evidence
for a specific claim.** `445456d` would have been citable as *"M16 opened"* while silently also
being the commit that introduced half a contract, and the provenance lines in the Evidence
column name shas precisely so a number can be re-derived from one.

**Rule: stage by path when agents are running, never `-A`.** And it is on this list rather than
in a session log because it belongs to the same family as everything above it: a commit message
is a declared value, and `git show --stat` is the observed one. The two disagreed.

---

## Roster & ownership

| Agent | Owns (spec §) | Owns contract |
|---|---|---|
| `design-system-guardian` | Part I — tokens, type, shape, motion | `contracts/design-tokens.md` |
| `shell-navigation-engineer` | §2.0 shell, search, tabs, §3.6 PWA | — |
| `map-galaxy-engineer` | §2.1–2.2 galaxy, force layout, canvas | `contracts/graph-layout.md` |
| `drawer-engineer` | §2.3 map drawer, §2.6.5 chart drawer · **M17:** `Plan §13` surface — roster line, diff review screen, approve | — (the read side of `contracts/work-product.md` has **one** author and it is `runner-engineer`) |
| `dashboards-engineer` | §2.4–2.5 carousel + 7 widget types | `contracts/panel-schema.md` |
| `chart-matrix-engineer` | §2.6 rollout matrix | — |
| `runner-engineer` | §3.2 run/schedule/approvals, §3.3 brain · **M15:** `Plan §9`–§11 mount + billing · **M17:** `Plan §13` work products + worktree isolation | `contracts/api-contracts.md` · `contracts/project-scoping.md` *(in trust)* · `contracts/work-product.md` *(unwritten — M17 wave 1)* · ADR-026 |
| `sessions-relay-engineer` | §3.1 SESSIONS tab, Happy relay, push | — |
| `observability-engineer` | §3.5 Langfuse, cost ticker, LAST RUNS | — |
| `infra-compose-engineer` | Part V — Docker, Caddy, Tailscale, ofelia | — |
| `agent-library-curator` | Part IV — agents/, seeding, normalization · **M15:** `Plan §10` cascade resolution | `contracts/frontmatter-schema.md` · `contracts/agent-cascade.md` |
| `rtl-arabic-pdpl-specialist` | §1.4 Arabic, RTL pass, PDPL (Part VII.4) | — |
| `fidelity-qa-reviewer` | Part VI acceptance, a11y, perf, review gate | — |
| `identity-access-engineer` | `Plan §11` — identity · device · billing account, scopes, device handoff | `contracts/identity.md` *(unwritten)* · ADR-016 |
| `thread-model-engineer` | `Plan §12` — threads, addressing grammar, mailbox, interrupt levels | `contracts/thread-model.md` · ADR-023 |
| `scheduler-engineer` | `Plan §14` — the coordinator clock, six trigger types, the fire ledger | `contracts/scheduling.md` · ADR-024 |

`commandcenter-orchestrator` sweeps status/, resolves cross-agent conflicts, and
advances the milestone. It does not write feature code.

`identity-access-engineer` was defined 2026-08-16 and **dispatched and run 2026-08-17** —
`0007_identity.sql`, `contracts/identity.md`, ADR-016 (`proposed`). `ops.identity` is theirs
outright. `ops.device` and `ops.credential` remain with their interim owners until a written
handover; the transfer is an exchange, not a drift.

**`thread-model-engineer` joined the roster 2026-08-17T21:50, in the act the rule specified.**
It wrote its own `comms/status/thread-model-engineer.md` at 21:45 (state `review`); the row
above was wired immediately after, by `commandcenter-orchestrator`, and nothing else was
touched. The condition was never waived and no placeholder heartbeat was ever written.

**The mechanism was real, not ceremonial, and it cost something measurable while it held.**
`check-comms.mjs:206` FAILs on a `from:` slug that is not on the roster
(`from "…" is not on the BOARD roster`), and the roster is parsed out of the table above
(`:154-161`). So an unrostered agent could not send a single inbox message — the agent verified
this with a probe message and reverted it rather than leaving a red gate behind. **Its
`review-request` to `fidelity-qa-reviewer` for ADR-023 and `contracts/thread-model.md` was
blocked by exactly that**, and is the first thing it files now the row exists. Six routed
findings were parked in `thread-model.md` §10 and as an `## Answer` on the `_all` announcement,
because that was the only channel it had.

**The lesson, and it is a protocol finding rather than a complaint:** the rule correctly refused
a fake heartbeat, and it also gagged a working agent for the length of its first slice. The
right shape is not to weaken it — a placeholder status file is still the same class of lie as a
plausible zero — but to **wire the row the moment the status file lands**, which is a sweep the
orchestrator must actively perform rather than wait to be told about. Until it is wired, an
agent's findings accumulate in files nobody is notified about. That is a queue with no reader.

---

## Milestone ladder (Part VI)

| # | Milestone | Lead | Supporting | State | Evidence |
|---|---|---|---|---|---|
| 0 | Foundations — tailnet, repo skeleton, frontmatter schema, Tailwind tokens | `infra-compose-engineer` | `design-system-guardian`, `agent-library-curator` | **done** — *tailnet half unverified* | PASS 2026-08-15; re-gate 2026-08-16 `…/20260816-2053-infra-compose-engineer-review-full-stack-up.md` — **PASS on the compose half, PARTIAL on the tailnet half.** No Tailscale on this host, no auth key, nothing tested from a phone. Needs the human. |
| 1 | Shell + MAP galaxy | `map-galaxy-engineer` | `shell-navigation-engineer`, `design-system-guardian` | **done** | PASS `…/20260816-2114-map-galaxy-engineer-m1-brain-completeness-fixed.md` ("PASS. M1 clears… You may flip the BOARD") + shell PASS `…/20260816-1555-shell-navigation-engineer-shell-review.md` + `…/20260816-2120-design-system-guardian-rereview-countup-and-ink3.md` |
| 2 | Department view + drawer (read-only) | `drawer-engineer` | `map-galaxy-engineer` | **done** | PASS `…/20260816-2121-drawer-engineer-m2-refail-fixes.md` ("PASS. M2 clears") |
| 3 | Runner + Run now + Langfuse | `runner-engineer` | `observability-engineer`, `drawer-engineer` | **active** — blocked on the human | M2 cleared, so the ladder no longer blocks it. §3.5 observability PASS `…/20260816-1236-observability-engineer-m3-review.md`. Runner verdict was **held, not failed** — `GET /api/status` reported three different brain numbers in one session and the reviewer would not gate a moving tree. **That hold released on 2026-08-16T22:15** (`…/_archive/fidelity-qa-reviewer/20260816-2215-runner-engineer-tree-is-still.md` — *"PASS. The tree held still while I checked it, which I verified rather than assumed"*), and `runner-engineer` has taken six further PASSes since. **What still holds M3 open is one thing and only one thing: zero runs have ever executed, because `RUNNER_ANTHROPIC_API_KEY` is unset.** Corrected 2026-08-18 — the old wording implied a reviewer hold that no longer exists, which is a blocker attributed to the wrong owner. |
| 4 | SESSIONS tab + PWA + push | `sessions-relay-engineer` | `shell-navigation-engineer` | **active** | PASS exists but is dated 2026-08-15 and **predates ADR-005's revision**. Not flipped: `HAPPY_IMAGE` points at a package that does not exist so `--profile full` cannot boot, the permission-request wire format is built to our contract and unverified against upstream, and `tweetnacl` + `web-push` landed under ADR-010. **Added 2026-08-18 — the milestone's own name has moved underneath it:** §23.8 replaces SESSIONS with THREADS in the tab slot, and M16 has already landed that slot with `/sessions` paths live underneath rather than redirected. M4 is therefore gated on the *relay*, not on the tab — do not read this row as a hold on THREADS. |
| 5 | CHART matrix | `chart-matrix-engineer` | `drawer-engineer` | **done** | PASS `…/20260816-2047-fidelity-qa-reviewer-m5-pass.md` ("PASS. No findings. §2.6 is the cleanest of the four surfaces"). Its ladder dependency on M2 is now satisfied. |
| 6 | DASHBOARDS carousel + widgets | `dashboards-engineer` | `observability-engineer` | **done 2026-08-16** — *numbers unvalidatable until M3* | PASS `…/_archive/fidelity-qa-reviewer/20260816-2208-dashboards-engineer-m6-ink3-fixed.md` — *"**PASS. M6 clears** (still blocked on M3 by the ladder). Zero `--ink-3` remain in `dashboards/**` — verified by grep … 56 files, 406 tests green, `check-tokens` 289/0."* Prior FAIL `…/20260816-2047-fidelity-qa-reviewer-m6-fail.md` kept as record; both its findings (`KpiNumeral`, ten `--ink-3` sites) cleared. **This row said `active — FAIL open` for two days after the PASS; corrected 2026-08-18.** Undatable under the §8b rule — the verdict predates `provenance.mjs` on this row's checker quote, and I am not inventing a sha. Widgets stay honestly empty until M3 supplies live metrics: *complete, not validated*, the same distinction M15 and M16 carry. **One carried finding, not a re-open:** `Carousel.tsx:127`'s `ArrowRight` is still unconditional under `dir="rtl"` — ruled, with the reason and the three coupled call sites, in `i18n/direction.ts` `MIRRORS['dashboards.carousel']`. |
| 7 | Schedule + audit + interview | `runner-engineer` | `agent-library-curator`, `infra-compose-engineer` | blocked on M3 | — |
| 8 | Polish — light theme, RTL, motion, mobile | `rtl-arabic-pdpl-specialist` | all | ongoing | SESSIONS slice PASS `…/20260816-1453-rtl-arabic-pdpl-specialist-m8-sessions-review.md`. **The "74 catalogue violations" this row carried until 2026-08-18 was a count under a lens that no longer exists** and is replaced by the recorded figure: `scripts/rtl-baseline.json` **`total: 308`**, which `check-rtl --gate` holds against. The move 261 → 308 is **+55 pre-existing debt made visible, −8 paid off, 0 new debt**, measured against a clean worktree at `8e77a23` rather than against the working tree — the method that distinguishes a widened lens from a laundered regression. Read the number from the file, not from this row. |

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
| 16 | Threads · addressing · mailbox | §12 · §23.7 · §23.8 · §23.12 | `thread-model-engineer` | **open 2026-08-17. Foundation slice landed at `8a9bdf5`, awaiting review** — ADR-023 (`proposed`), `contracts/thread-model.md`, `0008_threads.sql`, grammar + writer. Ten slices still held; the `review-request` was itself blocked by the roster gate until 21:50 |
| 17 | Presence · work products · diff review | §13 | **`runner-engineer`** (lead, foundation) · `drawer-engineer` (surface) | **DONE — PASS 2026-08-19 23:06 +03:00.** Foundation passed first time; the surface failed on three (a review modal whose trap was bound to `open` not `reviewing`; a focus trap that read `inert` on the element and not its ancestors; 8,000 diff rows mounted at once) and was re-gated green. Fixing the first surfaced a fourth nobody had reported — `useFocusTrap` re-armed on every callback identity change, stealing focus off the `Review` pill. **Proved against real Chrome, not jsdom**, which implements neither `inert` nor Tab. No `.css` moved in any of the four fix commits. Earlier: **open — foundation landed 2026-08-19, surface not started.** `worktree.ts` + `0010_work_products.sql` + the writer + `contracts/work-product.md` (`6f3abb2`, `03f04a2`). The lead was cut off by a session limit while writing the contract; the file was finished on disk and committed from there. **`drawer-engineer` has not been dispatched** — no roster line, no diff screen, no approve. See the M17 section. Ownership **corrected**: the row said `drawer-engineer` outright and the §13 coverage row said *unclaimed, in trust*. Split at a named seam — the entity, the worktree mechanic and `0010_` are the runner's; the roster line, diff screen and approve are the drawer's; the read side of the contract has **one** author. ADR-**026** owner filled. `0009_` ruled to the thread-id `SET NOT NULL` so the migration namespace stops racing |
| 18 | Time & triggers · the scheduler | §14 | **`scheduler-engineer`** | **DONE — PASS 2026-08-19 23:06 +03:00.** Four slices passed; the removal slice failed rule 9 on the one user-visible surface M18 touches — `POST /api/schedule` answered **"Saved. Next run …"** while the sidecar was deleted and no clock runs, which is worse than an error because it succeeds silently. Fixed at the source: `firedBy` is a **union with a `never` binding**, so the false sentence is *unspellable* — adding `'coordinator'` fails `tsc` at the sentence rather than compiling in silence. Still true, and not a defect: **nothing fires on a timer.** Earlier: **open — waves 1 and 2 both landed and both written up 2026-08-19; still no scheduling surface and nothing fires on a timer.** In: the clock (`3f810b8`), the ofelia removal (`e4e0bff`), the `calendar` widget (`51aba6f`), the six routes + the first writer either table has ever had (`924f2ff`), ADR-040 (`56ff87e`) and the browser client (`f83b462`). **A schedule can be asked for, previewed and refused — it cannot be stored:** `0011` has never met a Postgres, so five of the six routes answer `thread_store_unavailable` (503) and only `…/schedules/preview` completes. **Wave 2 corrected this row's own assumption:** the schedule editor and save dialog are not a new surface — spec §2.3's `⏰ Schedule` control already exists in `JobDrawer.tsx` and is **`drawer-engineer`'s**, who accepted and has *not* built it; the "next up" strip is a `data-table` over `GET …/schedules` and spends **no** widget type, so ADR-028's last extension stays reserved. Both handoffs `ready-for-review`; review-request filed. **The migration number is `0011_`, not the `0010_` the dispatch assigned** — see the M18 block; `0010_` is M17's on this board and a collision is the race, not a tidy-up |
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

### M16 — Threads · addressing · mailbox (`Plan §12`) — **DONE 2026-08-18**

**Closed on a PASS, not on the passage of time.** Eleven slices, then a two-round acceptance:
`fidelity-qa-reviewer` returned **5 PASS / 2 FAIL** (three items), all three were fixed, the
re-gate cleared them, and the milestone was then held open one further dispatch on the
reviewer's own ungraded queue item — the `Plan §23.11` rule-6 Arabic/RTL + PDPL sweep. That
sweep PASSed at `4e02a4b` and M16 flipped on it.

**The hold is the part worth keeping.** The reviewer refused to flip a milestone on its own
silence and said the scope call had to be made out loud. It was, the other way: rule 6 is
inside the milestone (`Plan §22`, §21.8), and M15 set the precedent of treating that sign-off
as a separate artifact from the acceptance PASS. Scoping it out to close a milestone one
dispatch early would have been the board editing its own definition of done for convenience.

**Which half the PASS covers:** source, tokens, and **a real page load** (`smoke:browser`,
12 routes in Chrome). Verdicts:
`comms/handoffs/M16-fidelity-qa-reviewer-m16-acceptance-pass.md` ·
`…-m16-re-gate.md` · `…-the-rule-6-pass-verdict.md`.

> **What it does not mean — the same sentence M15 carried, still true.** Zero agent runs have
> ever executed. `0005`–`0008` have never met a live Postgres. `ops.message` has never held a
> row. **The 1440px side-by-side has still never been run on any milestone**, because the
> reference frames are with the user. Every M16 surface is *structural*.
>
> One correction the re-gate forced, kept because the distinction is load-bearing:
> `ops.agent_runs.thread_id` is **not** "written by nothing" — `db/ledger.ts:79` names it and
> `lib/runService.ts:233` supplies it. **"No writer" and "an unexercised writer" fail
> differently, and only one is fixed by a run.**

**Three non-blocking follow-ups, owners named, carried out of the final verdict:** ADR-038
cites `0007_projects.sql` for a constraint that lives in `0005_project_axis.sql:75` (24
citations across 20 comms files agree; the same sentence quotes the constraint name verbatim,
so a reader recovers by grep) · the sigil gate skips `todo()` entries, which render English
inside an RTL paragraph · `rtl.css:238`'s unused `.u-auto` is `inherit`+`isolate`, which is
not what `auto` means.

---

#### The record of it being open, kept below

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
`_all` because the lead **could not yet be messaged** at the time it was written — that is no
longer true as of 21:50 (see the roster note). **The lead's `## Answer` on that `_all` message
is where six of its routed findings currently live**, because for the length of the slice it was
the only channel the agent had. They are being re-filed as individual messages now the row is
wired; until each one is, that `_all` answer is the record.

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
| Mailbox composer, **two interrupt levels and a refusal** — replaces `RunConsole`'s one-way stream. *Was "three"; see the scope change below before building the composer* | §12 · §23.12 P2 | `drawer-engineer` | stays |
| The monochrome register for `#` vs `@@`, and for `note` / `steer` / `halt` | §12 · Part I §1.3 | `design-system-guardian` | stays |
| `thread-feed` widget · **ADR-028** | §23.7 · §23.8 | `dashboards-engineer` | stays |
| `thread_id` on the ledger — the 34 metrics endpoints and LAST RUNS that read it | §12 · §3.5 | `observability-engineer` | stays |
| Arabic/RTL **and PDPL** review of every new surface — before it ships, per §23.11 rule 6 | §1.4 · Part VII.4 · §21.8 | `rtl-arabic-pdpl-specialist` | stays |
| Acceptance | Part VI | `fidelity-qa-reviewer` | stays |

#### Scope change, on the record before the gate finds it — M16 ships **two interrupt levels and a refusal**, not three

The frame above promised `note` · `steer` · `halt`. **`note` and `halt` are fully built.
`steer` is *refused*, not downgraded** — `interrupt_not_deliverable` (409), whether or not a run
is in flight. Landed by `runner-engineer` 2026-08-17; announced in
`comms/inbox/_all/20260817-2255-runner-engineer-ten-new-error-codes-and-what-steer-actually-does.md`.

**The reason, which is why this is the right call and not a shortfall:** `createSdkSession` drives
the Agent SDK with a **string** prompt. Injecting another user turn into a live `query()` needs
its streaming-input mode, which **has never been exercised in this repo because zero runs have
executed.** Building it now puts unverifiable code on the one path no test here can reach, and the
first thing to exercise it would be **a paid run**. Against M16's own distinction — *completed is
not validated* — shipping that would be declaring a capability whose only proof costs money and
arrives after the milestone closes.

**It is a refusal, not a silent queue, and the difference is the point.** Queueing a steer as a
note would satisfy the route and defeat it: a human who steered and was silently queued believes
they changed course, and nothing did (`thread-model.md` invariant 7). A note *is* still delivered
— drained at the next settled tool call, shown on the console, counted on the trace, its text
reaching the agent on the thread's **next** run through history seeding — and the runner says
which of those happened rather than leaving a reader to assume.

**Lifting it is a reviewable, type-level act.** `MID_RUN_STEER.supported` is typed `false` and
pinned by an assignment that stops compiling if it widens
(`apps/runner/src/lib/__tests__/mailbox.test.ts:171` — `const supported: false = …`), the same
instrument as `FAN_OUT_DISPATCH.allowed`. Verified in the tree, not taken on report.

**Consequences for two held slices, so they are not discovered at the gate:**

- **`drawer-engineer`** — the composer offers two levels and must present the third as *refused
  with a stated reason*, never as an available control that errors on submit.
- **`design-system-guardian`** — the `note`/`steer`/`halt` register is a **monotone ramp with one
  rung currently unavailable**. A register rendering all three as equally available would be the
  only part of the design that is not true yet. Their in-flight `InterruptBadge` already encodes
  this (`REQ-DS-111`: `deliverable` required on `steer`, refused state dashed at `--ink-2`), which
  is the slice arriving at the right answer independently.

**Superseded 2026-08-18 — the hold is lifted and nine of eleven slices have landed.** The
paragraph below is kept because its *reasoning* still governs the two that have not: a slice
owner who starts against `Plan §12` instead of `contracts/thread-model.md` is building a
second reading of a shape that has one author.

> **One slice is dispatched. Ten are held.** Only the lead's two rows are live work today;
> every other row waits on `contracts/thread-model.md` existing — see the split of
> `POST /api/thread/:id/message` below for what a second reading costs.

#### Status 2026-08-18 — reviewed, and nine of eleven slices are in

**The hold released on the answer, not on the clock.** `fidelity-qa-reviewer` drained a
nine-message queue: **6 PASS, 3 FAIL, all three FAILs fixed and re-answered.** Every verdict
names the standard it graded at — **source, tokens, and (new) a real page load.** The 1440px
side-by-side has still never been run on any milestone; it needs *reference frames*, which
remain with the user.

| Slice | State |
|---|---|
| Lead — schema, contract, ADR-023 | **in**, FAILed once on `in_reply_to`, fixed at `5600cc9` |
| Addressing grammar + refusals | **in** |
| `POST /api/p/:project/thread/:id/message` + mailbox drain | **in**, FAILed on three items, fixed at `ea0a0a9` |
| THREADS in the tab slot | **in** — `/sessions` paths stay live underneath, not redirected |
| Both monochrome registers | **in**, FAILed on two items, fixed |
| `thread-feed` + ADR-028 | **in** — cap accepted, two enforcers |
| `thread_id` on the metrics plane | **in**, PASSed — empty and honest |
| PDPL / erasure ruling (§9.3) | **in** — project-level only, tier 3 stated not implied |
| THREADS view + addressing composer | **open** — `sessions-relay-engineer` |
| Mailbox composer (two levels + a refusal) | **open** — `drawer-engineer` |
| Arabic/RTL + PDPL pass over the new surfaces | **held, correctly** — deferred while agents are in those files |

**Four instruments were found reporting green while blind**, each by an agent trying to use
one rather than read it: the identity checker's comment-stripper (and beneath it, a PDPL
assertion that had never once read the table it named); every `@ts-expect-error` in the web
suite (tsconfig excluded the tests, vitest does not typecheck — now closed by
`typecheck:tests`); the smoke markers (matching `<meta name="description">`, so they passed
against a shell with no tab bar); and `messageSpanAttributes`, a real mechanism that was
merely opt-in while three call sites put message bodies verbatim into OTLP.

**The generalisation, which is the part worth keeping:** an include-list is a decision to be
blind to everything unnamed, and a substring is a claim you did not narrow.

**One correction to a rule that does not bend.** Rule 7's *"traces stay local"* answers for
the observability plane and **not** for the plane carrying the words: `lib/prompt.ts` renders
every prior turn's body into the model prompt, and nothing here asserts a processing region
for that endpoint. `thread-model.md` §7.3 no longer claims the body stays in the process.

**What exists from the foundation:** ADR-023, `comms/contracts/thread-model.md`, migration
`0008_threads.sql`, the addressing parser with named refusals, and the thread writer. Schema
and writer were checked against each other **with no database**, and that is still true —
`0008` has never been applied. Handoff:
`comms/handoffs/M16-thread-model-engineer-threads-addressing-mailbox.md`; verdict:
`comms/handoffs/M16-fidelity-qa-reviewer-m16-foundation-slice-verdict.md`.

**Three decisions inside it want a reviewer's push, and they are here rather than buried in a
contract because each one contradicts something a slice owner would otherwise read as settled.**

1. **`POST /api/thread/:id/message` cannot be implemented as `Plan §12` writes it.** Under
   ADR-015 the project is a path segment, so deriving the project *from* the thread would
   require an unscoped read of `ops.thread` — which raises by design (`0005` §5's RLS:
   *"scope not set at all → SQLSTATE 42501, `project_scope_missing`"*). The route is therefore
   **`POST /api/p/:project/thread/:id/message`**. `thread-model.md` §4.1 states the semantics;
   **`runner-engineer` owns the final spelling** and transcribes it into `api-contracts.md`,
   which is theirs. The slice table below already splits this correctly — this is the first
   concrete thing that split bought.

   **Amended 2026-08-17 by `runner-engineer`, and the correction belongs in the gates list at the
   top of this board rather than in this paragraph alone.** The **conclusion holds** — ADR-015 Q1
   is sufficient on its own and the route is `POST /api/p/:project/thread/:id/message`. But
   §4.1's *second* argument — *"an unscoped read of `ops.thread` raises"* — **is inert on the only
   stack that exists.** Compose's Postgres user is a superuser, RLS is bypassed,
   `GET /api/status` reports `projects.scopeEnforcement: "bypassed"`, and that read would today
   **succeed**. Verified rather than taken on report: `0008_threads.sql:454` — the thread
   migration's own text — says so, and `db/thread-reads.ts:23` scopes its predicate *because* the
   policy is inert, not in addition to it. `runner-engineer` replaced the argument with one that
   needs no database: **a lookup-then-scope route lets a caller-supplied `:id` choose its own
   scope**, which is exactly what `run_not_found`'s cross-project opacity depends on not
   happening. That reason is true on a laptop with no Postgres.

   **Filed as the family, not as a footnote: a contract argument resting on a mechanism that does
   not run on the only stack that exists is a declared value read as an observed one** — the same
   defect as every other entry in *"What the gates structurally cannot see"*. It is more dangerous
   in a contract than in a checker, because a contract is what the next six agents read instead of
   the code. Owner of the fix: **`thread-model-engineer`** (`thread-model.md` is theirs; nobody
   else edits it), routed as a message. **Nothing built against §4.1 changes.**
2. **`ops.agent_runs.thread_id` ships nullable on purpose.** Not an oversight and not a
   TODO. `NOT NULL` on a column ahead of its writer **is exactly M15's ledger defect** — a
   constraint the only writer cannot satisfy. `thread-model.md` §5.3 carries the argument and
   the test that forces the column and its writer to move together.

   **Amended 2026-08-18: the writer has since landed, and the distinction matters.** This row
   said *"`recordRun` is untouched, so the column exists and nothing writes it"*, and it was
   read back that way twice afterwards — by the orchestrator, and out loud to the user. It is
   no longer true: `db/ledger.ts:79` names `thread_id` in its `INSERT` and
   `lib/runService.ts:233` supplies it, so the path exists end to end. Caught by
   `fidelity-qa-reviewer` at the M16 re-gate, against a brief that repeated the stale version.

   **"No writer" and "an unexercised writer" fail differently, and only one of them is fixed
   by a run.** A missing writer stays missing however many runs execute; an unexercised one is
   discharged by the first. Collapsing them would have put this column on the wrong list of
   things Phase 0 unblocks. It is still empty, honestly — because zero runs have executed, not
   because nothing writes it.
3. **`#sales` "1 run" is a lower bound, not a figure.** The department lead answers *or
   delegates*, and a delegation is a second run. So even the non-fan-out case has no exact run
   count, which sharpens Hazard 1 rather than softening it: the composer may print a **bound**
   and must not print a point estimate as if it were one. `TurnCost.estimatedUsd` is typed
   `null` — **a money figure stops the file compiling**, which is the cheapest available
   enforcement of BOARD rule 9 on the one surface where a plausible number gets believed.

**One defect found and fixed inside another agent's checker, on instruction, and it is the same
family as everything else this week.** `writer-schema-agreement.test.ts`'s `isRequired()`
matched `\bdefault\b` **inside a string literal**, so a `NOT NULL` column whose enum contains
the value `'default'` read as optional and dropped out of the mandatory set. Demonstrated with
the unhardened parser: a writer omitting a mandatory column passes green. Same failure class for
`generated` and `serial`. `ops.thread.delivery` is deliberately left with an inline `CHECK` so
the fix stays falsifiable against live text. **A second defect was found and correctly *not*
fixed** — `identity-model.test.mjs` is `identity-access-engineer`'s; it is routed, and it is in
the gates list at the top of this board.

**The three runner skips are unchanged and `0008` has never been applied to a real database.**
The agreement test proves a **lower bound** — column existence, mandatory-column omission,
conflict-target declaration. It cannot see types, `CHECK` predicates, or whether a partial index
exists. M16 inherits M15's distinction and this is where it bites first.

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
| `calendar` — full schema | **yes** | **M18** — the reservation is spent for the reason ADR-028 gave: `ops.schedule` now exists (`0011_scheduling.sql`). **One of the three extensions remains, and that is the whole remaining allowance** |

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

### M17 — Presence · work products · diff review (`Plan §13`) — **DONE · PASS 2026-08-19**

> **Six milestones are done and not one is validated.** Zero agent runs have ever executed;
> `0005`–`0008` have never met a live Postgres; the 1440px side-by-side has never been run.
> M17 inherits that sentence and sharpens it, because M17 is the first milestone whose central
> entity **describes something that has not happened**. Every handoff repeats this rather than
> blurring it, and M17's PASS says which half it covers.

**Framed 2026-08-18 by `commandcenter-orchestrator`. Not open. The human dispatches.**

#### Should M17 open at all before a real run? — **Yes, and here is the reasoning, because the
question was asked directly and deserves an answer rather than a shrug**

The instinct that M17 is less validatable than M16 is right about the *entity* and wrong about
the *milestone*, and the difference is the whole scoping decision.

**Git is local.** The worktree mechanic is the first mechanism in this build that can be
exercised end to end **today, with no API key, no Postgres and no model call** — `git worktree
add` against a temp fixture repo is a real operation with a real filesystem outcome. So is a
real `git diff` rendered into the diff screen. That makes M17's two load-bearing halves *more*
provable than M16's mailbox drain, which could never be exercised without a run either.

What genuinely cannot be produced is narrower than the milestone: it is the **outcome fields** —
`push_state`, `pr_url`, `pr_state`, `ci_state`, `tests_run`, `tests_passed`. Those describe the
results of events that have never occurred and, for push and PR, *must not* occur yet (see
hazard 5). So M17 opens with the outcome fields **recorded, not produced**, and the milestone is
not permitted to close on the strength of them.

#### What "complete" means for M17 — settled **before** anyone builds, per the standing finding

Three evidence tiers, and every slice declares which one it is standing on. A slice that cannot
name its tier is not done.

| Tier | Means | Applies to |
|---|---|---|
| **real** | a real git operation on a real temp repo, in a test that has been red | worktree create/cleanup/prune/concurrency · the diff render · the review query |
| **synthesized** | a writer test that inserts a row from a fabricated run-completion | `ops.work_product` insert · `branch`/`base_sha`/`head_sha`/`commits`/`files_changed` |
| **structural** | source, types, tokens, a page load — nothing observed it working | the roster line · every outcome field · anything reached only by a paid run |

**The milestone may not close on `structural` alone for the worktree mechanic.** That is the
one hard bar. Everything else follows the source-and-token standard M15 and M16 closed on.

And the house defect applies with force here: **`push_state: none` on a run that never tried to
push is a declared value, not an observed one.** The column must distinguish *"we looked and
there was nothing to push"* from *"nothing has ever looked."* If it cannot, it is the
`runs: 0`-during-a-ledger-outage defect wearing a ninth costume.

#### Ownership — ruled, with the reason, because "held in trust" was doing work nobody checked

**BOARD row 17 said `drawer-engineer` and the §13 coverage row said *unclaimed, in trust to
`drawer-engineer`*. Both are now corrected. The milestone is split at a named seam.**

| Half | Lead | Why |
|---|---|---|
| **Foundation** — ADR-026, `contracts/work-product.md`, the migration, the worktree mechanic, the writer | **`runner-engineer`** | The entity is written by the runner at the end of a run. Worktree isolation is a run-lifecycle mechanic and a data-safety one; nobody else can build it. Every migration except `0008_` is theirs, and `0008_` was the domain-lead exception this frame is deliberately repeating. |
| **Surface** — the roster line, the diff review screen, approve | **`drawer-engineer`** | §2.3 is theirs, they built `RunConsole` and the mailbox composer, and the diff screen is a drawer register. This is what the trusteeship was actually about. |

**Why the trusteeship was misread.** `drawer-engineer` held §13 because §13 *ends* in a screen.
But §13 is three things and only one of them is a screen; the other two are a table and a git
mechanic, and holding all three under the UI owner would have handed the runner's own data plane
to an agent who does not write it. That is the failure mode this board has paid for four times —
one shape, two authors — arriving from the other direction.

**Where the seam is, stated precisely, because a badly drawn seam is how a shape acquires two
authors.** The seam is the **read side of the contract**, and it has **one author**:

- Everything a run *produces* — schema, worktree lifecycle, the writer, the outcome fields —
  is `runner-engineer`'s, in `contracts/work-product.md`.
- Everything that *renders* it — roster line, diff screen, approve — is `drawer-engineer`'s.
- **The boundary object is `GET /api/work-product/:runId` and the diff payload shape, and the
  lead writes it.** `drawer-engineer` does not write a line of it and does not fork a type.

**But §13 says the diff screen "should be designed before the rest of the app," and that is not
compatible with a lead who writes the read shape from the write side outward.** So one step is
added that M16 did not need, because §12 was mostly write-side and §13 is half UI:

> **Wave 0 (before the contract freezes): `drawer-engineer` files a `decision-request` into
> `runner-engineer`'s inbox stating what the diff screen needs on a phone** — payload shape,
> pagination unit, what "approve" posts, what a 4,000-line diff does. The lead absorbs it or
> refuses it in writing, in the contract. **One author, one file, two informants.**

That is the M16 sequencing with its one known gap closed, not a departure from it.

#### Sequencing — M16's, because M16's is the thing that worked

`thread-model-engineer` wrote ADR-023, `contracts/thread-model.md` and `0008_threads.sql`
**alone**; only then did nine slices start, and **nothing in the second wave needed a shape
renegotiated.** That is the evidence the order was right rather than slow. M17 repeats it.

| Wave | Who | What | Gate to the next wave |
|---|---|---|---|
| **0** | `drawer-engineer` | one `decision-request`: what the diff screen needs. No code. | filed |
| **1** | **`runner-engineer`, alone** | **ADR-026** · `contracts/work-product.md` · `0010_work_products.sql` · the worktree mechanic + its enforcer · the writer | contract exists and is reviewed |
| **2** | `drawer-engineer` · `observability-engineer` · `rtl-arabic-pdpl-specialist` · `fidelity-qa-reviewer` | roster line · diff screen · approve · presence over SSE · the review query · RTL/PDPL sweep | PASS |

**Every wave-2 slice builds against `contracts/work-product.md`, not against `Plan §13`.** The
contract is reviewed and the plan is not.

#### Numbers, claimed here and now — both namespaces have already been raced once

- **ADR-026** — *"Work products + worktree isolation"* — was **reserved with no owner**. Owner is
  now **`runner-engineer`**. Claimed with this frame, before any file exists, exactly as 023 and
  028 were claimed with M16's. **ADR-038 is taken** (data egress, `rtl-arabic-pdpl-specialist`,
  `proposed`, awaiting the human) — do not compute a free number from a directory listing, and
  note `check-comms.mjs` now **fails** on a file at a number this table does not list.
- **One ADR for M17, not three.** Per the ADR-028 precedent: splitting it would give one decision
  three authors. The egress question stays in ADR-038 and is the human's, not 026's.
- **`0009_` IS ALREADY SPOKEN FOR AND WAS NEVER CLAIMED ON THIS BOARD.** `SET NOT NULL` on
  `ops.agent_runs.thread_id`, the M16 handshake `observability-engineer` armed and
  `runner-engineer` must satisfy — four comms files call it `0009_` and two of them say *"it is
  unclaimed as far as I can see."* That is the shared-integer race in progress. **Ruled:
  `0009_… SET NOT NULL` is `runner-engineer`'s**, because BRIEF's "grade a constraint from both
  sides" says the agent who must satisfy a constraint writes it, and it lands **before** wave 1
  so the namespace is clean. **M17's migration is therefore `0010_work_products.sql`, single
  author `runner-engineer`.** No second migration in M17; if a wave-2 slice needs one, it asks.

#### Hazards — graded, with three added and none deleted

**1 · M17's entity cannot be populated by any code path a test can reach. — REAL, and it is the
milestone's defining constraint, but it is narrower than stated.** Correct as written for
`ops.work_product` *end to end*: a row needs a run that touches a repo, and there is a second
missing precondition nobody has named — **no project has a checked-out repo path a run could
work in**, so it is two missing preconditions, not one. But the mechanism underneath is testable
today against real git. Answered by the evidence-tier table above; the milestone closes on
`real` for the worktree and honest `structural` for the outcome fields. **Do not let this close
on a table nobody has seen a row of** — that is why `synthesized` is a named tier rather than a
quiet allowance.

**2 · Worktree isolation is the first mechanism here whose failure corrupts data. — REAL, top
severity, and the "cannot be proven" half is too pessimistic in one direction and far too
optimistic in another.**

*Can* be asserted today, with real git and a planted defect: N concurrent
`createWorktree(runId)` calls yield N distinct paths, none nested inside another, no two sharing
`.git/index`; cleanup of one live worktree does not touch a sibling; a killed run leaves a
**prunable** worktree, not a locked repo. Falsify it by returning a constant path and watching
it go red.

*Cannot* be asserted: that three real agents running concurrently stay correct, because three
real agents have never run.

**And the part nobody named, which is the actual hazard: a worktree is not a jail.** If
confinement is *"we set `cwd`"*, an agent holding a shell tool walks out of it in one command.
This repo has already paid for exactly this: **`workspace` confinement was a docstring and a run
overwrote `.env`** — *a comment is not a mechanism*. Worktree isolation must name an **enforcer**
(the tool allowlist is `wired_into` and nothing more — BOARD rule 4), and the contract must state
plainly what stops a write outside the worktree. If the answer is "nothing, we rely on the
prompt," write that sentence down rather than shipping the docstring again.

**3 · `push_state: local` on a finished run is notification-worthy, and it touches M16's
mailbox. — REAL but small, and it re-opens nothing *if* framed as below.** Checked against the
settled shapes: ADR-023 makes a question a **message kind inside a thread**; the amendments table
already says the M11 notification ladder *"survives inside M16/M17."* The run's thread exists —
`ops.agent_runs.thread_id`, written by `db/ledger.ts:79` and supplied by `lib/runService.ts:233`.
So: **`push_state: local` is a message in the run's own thread. No `notification` entity, no
second delivery path, no new grammar.** Any grammar addition is `thread-model-engineer`'s, by
`decision-request`. (ADR-037 — session threads get no mailbox — does not bite: this is a run
thread, not a session thread. Recorded so it is not re-litigated.)

**4 · M11 stays absorbed, and §13 is exactly where a "review queue" gets proposed. — REAL, and
the single most likely scope creep in this milestone.** Three finished runs awaiting review looks
precisely like a task list, which is how `ops.task` gets rebuilt by accident. **Ruled: the review
queue is a query, not a table** — `work_product WHERE push_state = 'local' OR pr_state = 'open'`,
ordered. No `ops.task`, no `ops.question`, **no `ops.review`**. `POST /api/run/:runId/input` is
still never built. **Prefer a gate to a paragraph:** M16 left a test asserting that route's
absence — M17 extends *that* test with the three refused table names rather than writing a fourth
paragraph about it.

**5 · ADDED — approve/merge is data egress, and it collides with an ADR that is `proposed` and
with the human.** A push or a PR sends code and commit messages to a third-party host. This board
already rules that class: *"any `deliver:` target that leaves the tailnet is a data-egress
decision needing its own ADR,"* widened at M15 to cover a git remote. **ADR-038 is `proposed` and
awaiting a DPA answer and a region.** Ruled, and it is deliberately the reversible call: **M17
records push state; M17 does not perform a push, open a PR, or merge.** `pushed` becomes
reachable when ADR-038 is accepted or a human action does it. This keeps ADR-038 off M17's
critical path entirely, and it costs the milestone nothing it could have validated anyway.

**6 · ADDED — a diff is a body, and bodies leak.** This is the flattening finding at 100× the
volume. A message body leaking through an interpolated error string cost four rounds; a **diff**
contains file contents, and if one ever reaches a span, an error string, or `lib/prompt.ts` —
which already renders prior turns into the model prompt — the surface is the whole working tree.
The `withhold()` register is the only mechanism that reaches interpolated text, and it now
**refuses at `MAX_LITERALS` rather than evicting**; a diff would exhaust it instantly and
`withhold()` would return `false`, which is a real answer nobody is currently reading. **The
contract must state whether a diff may enter a trace or a prompt at all.** The honest default is
*no, and the roster line carries counts only.*

**7 · ADDED — the roster line needs presence over SSE, and that seam is already known broken.**
`drawer-engineer` is blocked today on exactly this class: `SseStartData` carries no thread id, so
the mailbox composer is inert in the running app, pinned by `mailbox.test.ts` reading
`packages/contracts/src/api.ts`. The §13 roster line (`running · 4m · reading 3 sources`) needs
the same channel to grow fields. **Wave 1's contract names every SSE field the roster line needs,
in the same commit as the schema** — otherwise wave 2 ships a second inert surface with a second
pinned test, and *a producer without a consumer is not a feature* becomes *a consumer without a
producer*, twice.

#### What M17 inherits from M16 — none of it blocks opening, and all of it lands at one screen

The three non-blocking follow-ups and the one open decision-request **ride alongside**. But the
pattern is worth stating once, because it is not a coincidence: **all three follow-ups become
load-bearing at the diff review screen**, which is the last thing M17 builds.

| Item | Owner | Ruling |
|---|---|---|
| ADR-038 cites `0007_projects.sql` for a constraint in `0005_project_axis.sql:75` | `rtl-arabic-pdpl-specialist` | Rides alongside; cosmetic. **ADR-038's `proposed` *status* is not cosmetic** — hazard 5 routes around it. |
| The sigil gate skips `todo()`, which renders English inside an RTL paragraph | `rtl-arabic-pdpl-specialist` | Rides alongside, **but must close before the diff screen's review.** That screen is the largest English-in-RTL surface this app will have — branches, shas, PR states, diff text. |
| `rtl.css:238`'s unused `.u-auto` is `inherit`+`isolate`, not `auto` | `design-system-guardian` | Rides alongside. Harmless while unused; **the diff screen is its first plausible consumer**, and a wrong `.u-auto` becomes a trap the moment code renders bidi. |
| The mailbox drain line + `withhold()` returning `boolean` (open `decision-request`, `observability-engineer` → `runner-engineer`) | `runner-engineer` | Does not block M17 — **but answer it before the contract freezes**, because hazard 6 depends on knowing that `withhold()` refuses at capacity. Same agent, same register, one dispatch. |

#### Deliberately out of M17 scope

- **No push, no PR creation, no merge** (hazard 5). Recorded state only.
- **No `ops.task`, no `ops.question`, no `ops.review`** (hazard 4). M11 stays absorbed.
- **No `board` widget and no drag primitive** — ADR-029 is still unwritten. The review queue is a
  query rendered in the drawer, not a BOARD view.
- **No scheduler, no triggers, no `calendar`** (§14 → M18).
- **No second migration.** `0010_` only.
- **No claim that any of this is validated.** Six done, none validated; M17 makes it seven.

---

## M18 — time and triggers (`Plan §14`), opened 2026-08-18

**Foundation slice only, dispatched to `scheduler-engineer` alone**, on M16's sequencing: one
agent writes the ADR, the contract and the migration before anything else starts, because six
agents reading `Plan §14` produce six readings of one shape and the disagreement surfaces a week
later as two contracts. Landed: ADR-024 · `contracts/scheduling.md` · `0011_scheduling.sql` ·
`packages/contracts/src/scheduling.ts` + its pinning test.

### The migration number — a live collision, resolved *away* from the collision

**`scheduler-engineer` was dispatched with "`0010_` is yours and is assigned; `0009_` belongs to
M17". This board says otherwise, in writing, in the M17 block above:** `0009_` is the
`ops.agent_runs.thread_id` `SET NOT NULL`, and *"M17's migration is therefore
`0010_work_products.sql`, single author `runner-engineer`"* — plus *"No second migration.
`0010_` only."* Two claimants on one integer is the exact failure this board has recorded twice
(`0006`, the double-ADR-012).

**And it stopped being hypothetical mid-slice.** At 2026-08-18 23:38 +03:00, `git status`
showed `?? apps/runner/src/db/migrations/0010_work_products.sql` untracked on this disk, with
`0009_` committed an hour earlier at `2d2d7cf`. **`runner-engineer` was writing `0010_` while M18
was being told `0010_` was free.** Taking it would have put two `0010_` files in the tree and
failed `repo-conformance.test.mjs` for both agents — the third instance of a race this board has
already recorded twice.

**Ruled by the claimant that arrived second, in the only direction that cannot be wrong: M18
takes `0011_scheduling.sql`.** `0011_` collides with nothing under either reading; taking
`0010_` would have collided under one of them, and `repo-conformance.test.mjs` would have failed
the build for both agents rather than one. This is **not** "next free from a directory listing" —
that method yields `0009_` and is what the rule forbids. It is *above every claim written on this
board*, which is a different method and the safe one. A gap at `0010_` if M17's frame later
changes is harmless: `client.ts` applies in filename order and records by filename, and nothing
requires the integers be dense. Filed to `commandcenter-orchestrator` as a `decision-request`
with `runner-engineer` told separately; if the ruling comes back the other way, no migration in
this repo has ever met a Postgres, so a rename is a `git mv` and a grep.

### Deliberately out of M18's foundation slice

- **No coordinator clock.** Nothing computes an occurrence, nothing writes a fire row, nothing
  fires. The tables and the refusals are structural.
- **No ofelia removal** — `infra/compose.yaml:389` is `infra-compose-engineer`'s, and spec §3.2
  still specifies ofelia. ADR-024 records the amendment; it does not perform it.
- **No `calendar` widget** — `dashboards-engineer`'s, and ADR-028 already caps the vocabulary at
  three new types ever. M18 writes no second widget ADR.
- **No schedule editor, no "next up" strip, no natural-language cron, no next-ten preview.**
- **No money figure anywhere.** Projected spend is typed `null` for the same reason
  `TurnCost.estimatedUsd` is: zero runs have completed, so there is nothing to average.
- **No claim that budget refusal works.** `ops.project.budget_monthly` has never refused
  anything and `toProjectSummary` still hardcodes `budgetMonthlyUsd: null`.

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
| ~~thread-model-engineer~~ | §12 — threads, addressing grammar, mailbox, interrupt levels | `contracts/thread-model.md` | **graduated 2026-08-17T21:50 — now in the roster table above, messageable, owns its contract outright. This row is kept struck rather than deleted, as the record of what the admission rule cost and bought** |
| ~~scheduler-engineer~~ | §14 — coordinator clock, six trigger types, fire ledger, calendar widget | `contracts/scheduling.md` | **graduated 2026-08-18 — now in the roster table above, messageable, owns its contract outright.** It wrote its own first `comms/status/scheduler-engineer.md` in the same act, exactly as the rule specifies; no placeholder heartbeat was written and the condition was not waived. The `calendar` widget stays `dashboards-engineer`'s under ADR-028 — this row's wording predates that cap and is kept unedited as the record |
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
- [x] `M1` d3-force is not deterministic and ADR-003 requires determinism → **[ADR-006](decisions/ADR-006-deterministic-force-engine.md)** accepted (`map-galaxy-engineer`). The build-time solver is ours; `d3` stays client-side. `forceLink`/`forceCollide` call an internal `jiggle()` of `(Math.random() - 0.5) * 1e-6`, so "run it twice, diff it" could never have held with d3 at build time.
- [x] `M3` The Second Brain write-back boundary → **[ADR-007](decisions/ADR-007-brain-write-back.md)** accepted (`runner-engineer`). A second, equally narrow write boundary, amending ADR-002 — the runner's git writes touch `agents/` only, enforced by a path check, so a prompt-injected agent cannot commit to `apps/`.
- [x] `M3` Observability retention windows → **[ADR-008](decisions/ADR-008-observability-retention.md)** accepted (`observability-engineer`), **human-confirmed 2026-08-15**: `ops.agent_run_tools` 90d · `ops.agent_runs` 400d · `ops.agent_run_daily` forever · `app.agent_outputs` never pruned (business rows are product, not telemetry) · Langfuse retention matched to the span table so the two stores never disagree about what still exists. **[ADR-036](decisions/ADR-036-erasure-and-retention.md) builds on this, it does not replace it.**

> **006, 007 and 008 were on disk and registered nowhere until 2026-08-18** — three accepted
> decisions, all from 2026-08-15, absent from this list, from the register table below and
> from `decisions/README.md`. That is the same state that produced the double-ADR-012 and
> that `observability-engineer` had just found on ADR-035. **An unregistered ADR is a number
> the next agent computes as free**, and it is worse than an unwritten one: the collision is
> silent on both sides. `check-comms.mjs` now fails on it.
>
> The near-miss is worth recording. ADR-036 (erasure **and retention**) was written while
> ADR-008 (retention) was invisible here — a duplicate was avoided only because its author
> read `decisions/` directly instead of trusting this board. The board was the unreliable
> instrument, not the directory.
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
| 023 | **Thread unification** — runs, sessions and tasks become threads; the addressing grammar (`@agent` · `#department` · `@@fan-out` · bare = Chief of Staff); the mailbox and its interrupt levels — **two and a refusal, not three**: `note` and `halt` are delivered, `steer` is refused (409 `interrupt_not_deliverable`) whether or not a run is in flight, because the SDK's streaming-input mode has never been exercised and the first thing that would exercise it is a paid run; **supersedes M12's `POST /api/run/:runId/input`, which is never built** · *`Plan §18` "ADR-018"* | `thread-model-engineer` | **reviewed 2026-08-18** — `ADR-023-thread-unification.md`, 2026-08-17 at `8a9bdf5`. Written straight to its number under the draft-naming rule's exception (one registered author, no concurrent drafter). `fidelity-qa-reviewer` graded the slice **FAIL on one item** — `in_reply_to` was the only reference in `0008` not project-pinned, under a comment promising messages cannot cross projects — fixed at `5600cc9` with a gate asserting the *rule* (every FK into a project-scoped table names `project_id` on both sides), not the line. Everything else in the slice graded honest. |
| 024 | **Scheduler ownership, six trigger types** — the coordinator owns the clock; the frontmatter/ops split is preserved as one table with two authorities (`source: library` read-only, `source: ops` ad-hoc); fire-before-run with `(schedule_id, occurrence_time)` as the idempotency key; missed-run and overlap policies mandatory with **no default**; budget refusal is a *declared* path that has never refused anything · *`Plan §18` "ADR-019"* | `scheduler-engineer` | **claimed 2026-08-18, before the file** — row first, per the rule below. Checked against `comms/decisions/` at claim time: 024 is free there too and no unregistered file was found this pass |
| 025 | Client strategy — Expo, Tauri, contentless push · *`Plan §18` "ADR-020"* | `client-platform-engineer` | **reserved** |
| 026 | Work products + worktree isolation · *`Plan §18` "ADR-021"* | **`runner-engineer`** | **claimed 2026-08-18 with M17's frame, before any file exists** — the same rule 023 and 028 were claimed under. Owner was blank; M17's ownership ruling fills it. Carries the entity, the worktree mechanic **and its enforcer**, and the ruling that M17 *records* push state without performing a push. Does **not** carry the egress question — that is ADR-038's and the human's. **One ADR for M17, not three** (ADR-028 precedent: splitting gives one decision three authors) |
| 027 | Chief of Staff — routing, delegation, trust ladder · *`Plan §18` "ADR-022"* | `chief-of-staff-architect` | **reserved** |
| 028 | **Three new widget types** — `board`, `calendar`, `thread-feed` — and the rule that everything else composes from the existing seven (§23.7) · *`Plan §18` "ADR-023"* | `dashboards-engineer` | **accepted 2026-08-18** — `comms/decisions/ADR-028-widget-type-cap.md`. Unblocks P2 and P4. The cap has two enforcers (`typecheck` on `WIDGET_TYPE_EXTENSIONS_USED`, and the validator's parity gate reading `panels.ts`), both falsified. `thread-feed` is built and honestly empty; `board` and `calendar` are named, refused by the validator, and absent from `WidgetType`. |
| 029 | Drag without a dependency · *`Plan §18` "ADR-024"* | `design-system-guardian` | **reserved** |
| 030 | *(optional)* Rename CHART → ROLLOUT · *`Plan §18` "ADR-025"* | `chart-matrix-engineer` | **reserved** |

| 031 | Where §9's AA floor supersedes a spec-named text token | `design-system-guardian` | **claimed, unwritten** |
| 032 | The session envelope allowlist — `account_id` refused (§3.1, `Plan §11` Q19) | `sessions-relay-engineer` | **claimed** — ruling already binding in `envelope.ts` + 2 tests; ADR transcribes it |
| 033 | **Provenance is chrome: the badge is monochrome and drift is not a status** — a departure from `Plan §10`'s *"staleness dot — the same honesty rule as connector health"*, on the visual register only. Also: exclusions are not a sixth badge state, and the primitive count moved 8 → 9 | `design-system-guardian` | **claimed 2026-08-17** — content live as `contracts/design-tokens.md` §10; ADR transcribes it |
| 034 | **What a `Spec §` cell may say, and that the gate resolves it** — `Plan §n` becomes a first-class citation (ADR-013 rule 2 made it *required* and the gate *refused* it); citations are resolved against their document instead of prefix-matched | `commandcenter-orchestrator` | **accepted 2026-08-17** — row claimed before the file, per the rule directly above |
| 035 | **One declaration per runtime name in a barrel**, and a gate that loads the artifact | `agent-library-curator` | **accepted 2026-08-17** — `ADR-035-one-declaration-per-runtime-name-in-a-barrel.md`, landed at `46ca512`. **Registered retroactively 2026-08-18 by `observability-engineer`**: the file existed and this table did not list it, which is the exact state that produced the double-012. The next agent computing "next free" from this table would have taken 035 and collided with a landed, accepted ADR |
| 036 | **Erasure and retention — the product's first two destructive operations, and the tier no delete verb reaches** (§9.3 ruling + §9.4 horizon; `thread-model.md` §7.3, `specs/observability.md`) | `observability-engineer` | **claimed 2026-08-18, before the file** — row first, per the rule directly above. Carries tiers 1 and 2 of erasure and the unbounded retention position; **does not** carry the model-endpoint egress question, which is `rtl-arabic-pdpl-specialist`'s separate ADR and is unclaimed below |

| 037 | **Session threads get no mailbox** — `thread-model.md` §9.1 answered **no** for v1. `message_never_holds_session_content` stays, `envelope.ts`'s allowlist is untouched, and interrupting a relay session keeps travelling the relay's own client-encrypted control channel (which is what Allow / Deny already is). The load-bearing reason is not only rule 5: **the runner's mailbox drain has no reach into a CLI session**, so an `ops.message` row addressed to one would be a queue with no reader that still looks delivered | `sessions-relay-engineer` | **claimed 2026-08-18, before the file** — row first, per the rule above. Ruling already binding in `apps/web/src/threads/` and cited from four files |

| 038 | **Data egress — the three ways client words leave the tailnet, and what may be sent** (Part VII.4). *"Traces stay local"* answers for the observability plane and for nothing else. Three targets, not two: (a) a `deliver:` target outside the tailnet — Slack, email; (b) `library_remote`, an outbound fetch of agent definitions; (c) **the model endpoint**, which is new and is the largest — `dashboards/lib/prompt.ts` renders prior message bodies into the user prompt and this repo asserts **no processing region** for it, so COMPANY.md rule 11's cross-border rule has an exception rule 10 names and nothing settles. Filed `proposed`: (c) is a question for the human, not a decision an agent may take | `rtl-arabic-pdpl-specialist` | **claimed 2026-08-18, before the file** — row first, per the rule directly above. Checked against `comms/decisions/` at claim time: 038 is free there too, and no unregistered file was found this pass |

| 039 | **Wake-on-LAN is refused on this topology, and the three conditions that would reopen it** (`Plan §14`'s *"the coordinator wakes the desktop at 05:55 so the 06:00 job has a host"*). There is one machine; it is both the coordinator and the only execution host, so the process that would send the packet is asleep whenever the packet is needed. There is no host registry to address one from — `host_affinity[]` is declared and read by nothing (`hostAffinityEnforced: false`) and no column anywhere holds a MAC. And a magic packet is L2: a Docker Desktop container on Windows sits behind the WSL2 NAT and cannot put a broadcast frame on the physical segment. **Nothing was built** — a `wakeHost()` returning success without sending a packet is the house defect on the one surface where believing it means a missed 06:00 job. The honest cover for a sleeping host already exists and is ADR-024's `missed_run_policy` | `infra-compose-engineer` | **claimed 2026-08-18, before the file** — row first, per the rule directly above. Checked against `comms/decisions/` at claim time: 039 is free there and no unregistered file was found this pass |

| 040 | **The five-field cron rule survives the parser it cited** — `validate-frontmatter.mjs` refused six-field cron because *"ofelia would silently take a 6-field one to mean something else"*, and the sidecar left the stack at `e4e0bff`. The rule is **kept** and its reason replaced with one that is still true and now checkable: `parseCron` is the only thing in this repo that computes an occurrence, `scheduleClock` and `nextRunAt` both share it, and it takes exactly five fields — so a six-field `schedule:` is a clock badge for a job the coordinator can never plan. Carries an **observed** divergence found while writing the gate: `isCronExpression` accepts `0 0 * * 7` (POSIX's Sunday) and `parseCron` throws `invalid_cron` on it, so an agent can commit a schedule that passes `validate:frontmatter` and can never fire. Routed to its owners, **not fixed in their files** | `scheduler-engineer` with `agent-library-curator` | **claimed 2026-08-19, before the file** — row first, per the rule directly below. Checked against `comms/decisions/` at claim time: 040 is free there and no unregistered file was found this pass |

| 041 | **An eighth department, `product`, and eleven connector names weighed one at a time** — the company gains the roles that design and build the product (UX research, product design, frontend, A-to-Z delivery). Chosen by the user **over reusing `operations`**, knowingly, which makes it a schema change and not a folder: the enum is gated in `validate-frontmatter.mjs`, mirrored in `packages/contracts/src/departments.ts`, `scripts/lib/departments.mjs` and `scripts/validate-panels.mjs`, and MAP/CHART/DASHBOARDS are projections (rule 2), so the eighth branch propagates to every view for free — and wrongly if the taxonomy is wrong. Carries: the slug, its index (**7, appended**, so no existing department changes index), its clusters, the finding that `departments.mjs` **silently fell back to seven** on any other count, and the connector widening — **ten registered, `mobbin` refused**. `writes` is set by the rule *files ⇒ `ungated`, records and messages ⇒ `none`*, which puts `figma`, `google-drive`, `github` and `vercel` on the strictest value in the enum. **No credentials, no MCP server**: all eight new rows are `available: false`, because `infra/compose.yaml` has no MCP service and `apps/runner/src` has no `mcpServers` config — observed 2026-08-21 | `agent-library-curator` | **claimed 2026-08-21, before the file** — row first, per the rule directly below. Checked against `comms/decisions/` at claim time: 041 is free there and no unregistered file was found this pass |

041+ is claimed just-in-time at its own milestone. **Do not copy a number out of the plan** —
translate it through `comms/decisions/README.md` first.

**A file at a number this table does not list is the double-012 in slow motion.** 035 sat
unregistered from 2026-08-17 until it was found on 2026-08-18 while allocating 036. The rule
that allocation happens *here* only works if landing an ADR also lands its row; check this
table against `comms/decisions/` before claiming, and register what you find.

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
exist, or when a requirement's citation is missing or **does not resolve**.

Sections are listed individually, not as ranges — the checker matches them literally, and a
range would leave the sections inside it owned by nobody.

**A `Spec §` cell's grammar is [ADR-034](decisions/ADR-034-spec-citation-grammar.md), and it
is checked, not assumed.** A cell is a `·`-separated list. It must carry at least one **primary**
citation, and every primary is resolved against its own document:

| | Form | Resolved against |
|---|---|---|
| **primary** | `§2.3` · `§2.5.1` · `PART V` · `PART VII.4` | `skilltree-clone-spec.md` |
| **primary** | `` `Plan §12` `` · `` `Plan §23.8` `` | `AGENTOS-V2-PLAN.md` |
| supporting | `BOARD rule 9` · `thread-model §4.2` | **nothing.** Legal beside a primary, never alone |

`§99.9`, `§2.5.9`, `PART IX` and `Plan §99.9` are each a FAIL. Backticks are stripped first,
which is what makes `` `Plan §12` `` legal rather than a near-miss — it was a FAIL until
2026-08-17 and that is the more interesting half of the story, told above under *the half nobody
was looking for*.

**What this gate still does not cover, stated so nobody assumes otherwise
([ADR-013](decisions/ADR-013-part-two-standing-and-spec-coverage.md) rule 1, unchanged by
ADR-034):** the **denominator is still the spec of record alone**. `AGENTOS-V2-PLAN.md` is now
read for *citation resolution* and for nothing else — a plan section still cannot be **claimed**,
is still absent from the table below, and its absence still fails nothing. **Claiming and citing
are two columns and two promises**, and widening the second did not widen the first; the
ownership parser gained a `(?<!Plan\s)` guard precisely so a spec naming its Part Two work cannot
accidentally claim a `§23.8` of a document that has no §23. **Adding Part Two rows to the table
below would still fail nothing, ever** — the table would look enforced and be decorative, which
is the same disease as a fidelity bar nobody has run. So they are not added. Part Two's coverage
is tracked separately and marked plainly as unenforced. The gate's *denominator* grows one
milestone at a time, when a Part Two milestone closes and its shipped behaviour is written into
the spec of record under a real section number: **spec follows shipped code, not the other way
round.**

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
| **A requirement citing a spec section that does not exist** — `§99.9` passes, exit 0, silent. Re-falsified at `eaca677` | **fixed** 2026-08-17T23:5x, [ADR-034](decisions/ADR-034-spec-citation-grammar.md). Citations are **resolved**, on both documents. See the paragraph below — the fix arrived attached to a second defect pointing the other way, and that one was the more expensive of the two |
| **REQ-DSH-33** — its three paths all resolve; what the gate cannot see is whether the files do what the row *describes*. Named by the verdict as the instance where the pointer is fine and the sentence is the claim | **open** — the class the gate has no mechanism for at all |
| **The impl-column near-miss** — a cell that nearly resolves counts as implemented | **open** — row E below |

The shared property with everything else in *"What the gates structurally cannot see"* at the
top of this board: **a declared value being read as an observed one.** A resolvable path proves
a file exists. It has never proved that the file does the thing.

##### The `Spec §` column, closed 2026-08-17 — and the half nobody was looking for

Row A was found by looking for citations that point nowhere. It was **fixed** by
[ADR-034](decisions/ADR-034-spec-citation-grammar.md), which is the small half of what happened.
The large half is the defect pointing the other way, filed as a blocker by `runner-engineer`
while doing M16 work:

> `scripts/check-spec-coverage.mjs:258` accepted a cell only if it **started with** `§` or
> `PART`. ADR-013 rule 2 makes `Plan §n` the **required** form for Part Two work. Every such
> citation is written `` `Plan §12` ``, and `startsWith` saw the backtick. **The gate refused the
> only correct way to cite the document M16 is built from** — 6 FAILs, all `design-system.md`,
> all of them correct cells.

**The sharp part is in the filer's own words, against their own work:**

> My thirteen rows cite `§3.2`, `§3.5`, `PART III`, `PART V`. That is *defensible* — and **I
> picked those partly because they pass**, and the gate gave me no way to say "and `Plan §12`".

**A gate that misses things leaves a visible gap. A gate that refuses the correct citation
changes what a requirement is willing to claim to be about, and that distortion never appears in
the output** — the table reads clean, every row cites something real, and the citations have
quietly drifted toward whatever is green. It is the general defect one level up: not *a row that
points somewhere without saying anything true*, but **a row whose author was steered by the
instrument measuring them.** Nothing on this board would have shown it; it was found only because
one agent noticed why they had chosen a section number.

**It happened twice in one evening, by two agents, and the second time is the proof.** By the
time I swept, `validate:coverage` was **already green** — and not because anything was fixed.
`design-system-guardian`, working in flight with the blocker open, had prepended a
spec-of-record token to all six cells: `REQ-DS-105` went from `` `Plan §12` `` to
`` §1.3 · `Plan §12` ``, `REQ-DS-108` from `BOARD rule 9` to `PART I · BOARD rule 9`, and so on
for all seven Part Two rows. Each prefix is *defensible*. **Not one of them was chosen because it
was the most accurate thing to say about the requirement** — they were chosen because the cell had
to start with a character the gate accepted. The gate went green, no FAIL was ever recorded
against it, and the only reason anyone knows this happened is that `runner-engineer` had already
written down the mechanism an hour earlier. **A gate that shapes claims does not leave evidence in
the gate; it leaves it in the claims**, and only if someone reads the diff.

*The near-miss, recorded because it was two lines from shipping:* the obvious fix is to widen the
prefix. That gate accepts `Plan §99.9` — the same bug, the same column, one keystroke later. And
resolving citations against **headings only** would have FAILed 44 correct rows citing `§2.5.1`,
`§2.6.3` and `PART VII.4`, which the spec numbers as ordered-list items rather than headings.
**A gate whose first output is a false FAIL is worse than the gap it closes.** Both were caught
before landing, by falsifying against the real spec and the real plan rather than by reading the
diff: seven valid forms → 0 FAILs exit 0; seven invalid forms → 7 FAILs exit 1, with a valid
control row in the same file staying green.

*What is still not checked, so the column is not read as clean:* `BOARD rule 9` and
`thread-model §4.2` are **accepted on shape and resolved against nothing** — legal only
*alongside* a primary citation, never as the whole cell. The gate now prints
`citations 732 resolved · 3 accepted unresolved` so that half has a number instead of an
assumption. And a citation that *resolves* is still not a citation that is *apt*: whether a row
is really about §3.2 is the third face of the general defect and has no mechanism.

#### What this gate still reports that it cannot observe

All eight falsified in a sandbox on 2026-08-17, all left as findings with owners rather than
fixed inside a session scoped to one item. Listed so that "coverage 94%, 0 FAILs" is read for
what it is.

| | What passes silently | Why it matters |
|---|---|---|
| **A** | ~~A requirement citing a **spec section that does not exist** — `§9.9`, `§2.5.9`.~~ **CLOSED 2026-08-17, ADR-034.** Both named cases now FAIL, exit 1, and so do `PART IX`, `PART VII.9`, `Plan §99` and `Plan §99.9`. | The exact parallel of the path bug, on the section column. Closing it uncovered the larger defect above — the gate was also *refusing* the correct Part Two citation, which shaped what rows claimed. |
| **B** | A spec with a `## Coverage` heading and **zero requirement rows**. | An agent can claim every section it owns and owe nothing. Section claims are checked; whether a claim has any requirements behind it is not. |
| **C** | A **typo'd requirement id** (`req-x-02`, lowercase). The row is not matched, so it vanishes from the table and from the total. | Requirements can be silently deleted by a typo, and the denominator moves with them. |
| **D** | A **truncated row** with three cells instead of five. `impl` and `test` come back empty and it counts as *declared-unbuilt*. | A malformed row is graded as an honest gap. |
| **E** | An impl cell reading **`yes`**, or a token/type/CSS class — anything unresolvable. Counted as **implemented**. | The 94% counts *cells that are non-empty*, not *files that exist*. |
| **F** | Renaming this section's heading. `boardOwnership()` finds nothing, and the ownership cross-check **degrades to warnings**. | The gate's second job disappears without turning anything red. |
| **G** | Any of the **16 warnings**. The script exits on `errors.length` only. | `implemented but has no verification` has never failed a build. |
| **H** | `## Deliberately not done` being present and **empty** — only the heading's presence is checked. | The section this project calls the most useful in a handoff is enforced as a string match. |

Owners: **B, C, D, E, H** are the gate's, i.e. `commandcenter-orchestrator` under ADR-013 —
**A is closed.** **F** is the same. **G** is a policy decision with 16 immediate consequences and belongs to the
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
| §13 — presence, work products, diff review | **claimed and split 2026-08-18 with M17's frame** — foundation (entity · worktree · `0010_` · ADR-026) `runner-engineer`; surface (roster line · diff screen · approve) `drawer-engineer`. *"Unclaimed, in trust to `drawer-engineer`"* was the prior state and is corrected, not tidied away | *is split; both are owners* |
| §14 — the scheduling plane | **claimed 2026-08-18** — `scheduler-engineer`, `contracts/scheduling.md` + ADR-024 + `0011_scheduling.sql`. Foundation only: the clock, the surfaces and the ofelia removal are unbuilt and named as such | *is the owner* |
| §15 — memory at five tiers, KB index | **unclaimed** | memory-index-engineer |
| §16 · §23.9 — clients, push, offline | **unclaimed** | client-platform-engineer |
| §17 — Chief of Staff, swarm behaviours | **unclaimed** | chief-of-staff-architect |
| §18 — ADR programme | `commandcenter-orchestrator` (allocation only) | stays |
| §19 · §20 — amendments and sequencing | `commandcenter-orchestrator` | stays |
| §21 — platform risks | `commandcenter-orchestrator`; §21.8 isolation → `rtl-arabic-pdpl-specialist` | stays |
| §22 — roster | `commandcenter-orchestrator` | stays |
| §23 — the UI rescan | **split per §23.12**, unclaimed outside M15 | per phase |
| §24 — deliberately not in Part Two | `commandcenter-orchestrator` | stays |

**Seven of fifteen rows are unclaimed and that is correct right now** (was eight; §13 was
claimed and split with M17's frame, 2026-08-18) — they belong to
milestones nobody has opened. An unclaimed row here is a scheduling fact, not a gap; an
unclaimed row in the machine-checked table above is a build failure. Keeping the two tables
apart is what preserves that difference.
