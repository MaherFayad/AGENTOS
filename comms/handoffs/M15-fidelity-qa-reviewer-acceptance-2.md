---
agent: fidelity-qa-reviewer
milestone: M15
spec: Part VI · Plan §9 · §10 · §11 · §23.12
created: 2026-08-17T21:05
status: accepted
---

# M15 — re-gate acceptance verdict: **PASS** (source-and-token)

**Reviewer:** `fidelity-qa-reviewer` · **Date:** 2026-08-17 · **Tree:** `eaca677`, clean
**Verdict: PASS** at the source-and-token standard. Four follow-ups, none blocking.

The verdict's own framing, quoted rather than paraphrased, because the PASS is narrower than
the word:

> **Source-and-token PASS.** The 1440px side-by-side against the reference frame has still
> never been run, on any milestone, by anyone. **Proportion, density and optical weight are
> unverified.**
>
> **M15 can be completed. M15 cannot be validated.** `runnerConfigured` is `false`, read off a
> live runner. Of 179 runner tests the 3 skipped are exactly the three that would catch a
> writer/schema mismatch.

Supersedes **`comms/handoffs/M15-fidelity-qa-reviewer-acceptance.md`** (FAIL, `8e77a23`). That
file is not edited and not deleted; it is the record of what was true two commits ago.

## Filing — what in this file is verbatim, `commandcenter-orchestrator`, 2026-08-17T21:05

**The reviewer could not write files again.** `Write` was disabled for their session, as it was
for the first attempt. They again did not route around it with a shell heredoc, which is the
correct call and is now precedent twice over.

**So this file has two kinds of text in it and they are marked, because a transcription that
hides its own seams is the same defect as a declared value read as an observed one:**

- **Verbatim, the reviewer's:** the framing block above; every number, path, line number and
  probe result in *Gates*, *The three blocking items, re-checked*, *Follow-ups* and *Backlog
  verified facts*. All of it is transcribed from their fact capture, preserved at
  **`comms/handoffs/M15-fidelity-qa-reviewer-acceptance-2-facts.txt`**, which is kept in the
  repo rather than in scratchpad — the first attempt's working notes were lost that way.
- **Mine, and labelled as mine:** the connective prose, the section headings, and the
  *Deliberately not done* section, which the handoff template requires and the reviewer could
  not write.

**What is not here.** The reviewer's full verdict prose — the paragraphs between the facts —
lives in their session and was never written to a file. The facts survive; the sentences do
not. Nothing below is a paraphrase presented as a quotation: where I could not recover their
wording I recorded the fact and left the prose out. If the full text is later pasted in, it
replaces the connective prose in this file and nothing else.

## Deliberately not done

*Written by `commandcenter-orchestrator` because the handoff template requires it and the
reviewer could not. Every item is drawn from the verdict's own facts, not added to it.*

- **The Part VI acceptance test itself — still never run.** Part VI's sentence is a 1440px
  side-by-side of MAP against the reference frame. There is no headless browser in this repo
  and no reference frame; both decisions are with the user. **Proportion, density and optical
  weight are unverified**, and this PASS is not evidence about them. Two milestones' worth of
  PASSes now rest on an interim standard, which is a growing debt and not a settled one.
- **Validation, as opposed to completion.** `runnerConfigured: false` was read off a live
  runner (pid 15600, killed after) — not inferred from config. Zero runs have executed. A run
  in project A has never been proven absent from project B, the cascade has never been proven
  to pick the agent the human meant, and **a budget cap has never refused anything.** The full
  list is `contracts/project-scoping.md` §6.
- **The three runner tests that would catch a writer/schema mismatch did not run.** Of 179,
  the 3 skips are `an unscoped read raises rather than returning rows`, `every SQL statement
  the runner can emit is accepted by a real Postgres`, and `the write path and the prune plan
  cleanly against a real Postgres` — all three on `DATABASE_URL is not set`. `176 / 179` does
  not mean the ledger works.
- **The four follow-ups are routed, not fixed.** Each has an owner and a BOARD line, filed in
  the same act as this handoff per the protocol rule the last verdict earned. See *Follow-ups*.
- **`§99.9` still passes the coverage gate.** The Test-column half was fixed (item 3a); the
  section-column half was falsified again in this re-gate and left open. It is the general
  defect recorded below, and it is mine.
- **The backlog answers' prose.** Four `review-request` messages were answered on their own
  merits during this session. Their facts are below; their `## Answer` blocks were never
  written, for the same tool reason. That is owed and is on the BOARD.

## Gates — all run by the reviewer at `eaca677` on a clean tree

| Gate | Result | Exit |
|---|---|---|
| `npm test` | 162 · 161 pass / 0 fail / 1 skip | 0 |
| `npm run test:runner` | 179 · 176 / 0 / **3 skip** | 0 |
| `npm run test:web` | vitest 92 / 0 + node:test, both halves | 0 |
| `npm run typecheck` (all three) | clean | 0 |
| `npx tsc --noEmit` web · runner | clean · clean | 0 · 0 |
| `node scripts/check-tokens.mjs` | 0 violations / 311 files / 2 exempt | 0 |
| `node scripts/check-rtl.mjs --gate` | holding, baseline **308** | 0 |
| `npm run validate:coverage` | 0 FAIL, 12 warns, 692 reqs / 654 (95%) | 0 |
| `npm run validate:frontmatter` | 12 / 12 valid | 0 |
| `npm run validate:comms` | 15 agents, 270 msgs, 1 warn | 0 |
| `rtl-pdpl.test.mjs` | 31 / 31 | 0 |
| `spec-coverage.test.mjs` | 7 / 7 | 0 |

Token provenance banner, verbatim (contract §8b):

```
Token discipline
  scanned at        2026-08-17 20:34 +03:00 · eaca677 · clean
  files scanned     311
  violations        0
  exemptions        2
```

**Read that `clean` through follow-up 3.** The banner's dirty scope is `apps/web`, so it cannot
see a modified `scripts/`. It is true here and it is not load-bearing.

## The three blocking items, re-checked

### Item 1 — the provenance consumer. **Cleared, and cleared empirically.**

The reviewer ran their own runner (pid 15600, killed after) rather than reading the diff:

- `GET /api/status` → `runnerConfigured: false`, `activeRuns: 0`, `ledger.state: absent`,
  `projects.count: 1`.
- `GET /api/p/agentos/agents/sales/account-enrichment` →
  `sourceRef "project:agents/sales/account-enrichment/SKILL.md@sha256:db02d09ac428…"`.
- Through `normalizeAgentDoc` + `drawerProvenance` →
  `{"kind":"known","state":"project","source":{layer:"project",path:"…",digest:"sha256:db02d09…"}}`.

Three falsifications, because a green path is not a boundary:

| | Probe | Result |
|---|---|---|
| A | frontmatter-only `sourceRef` | `doc.sourceRef === null` — **envelope-only is enforced** |
| B | detail says `global`, run stream says otherwise | state `global` — **order is a preference, not an accident** |
| C | detail `'garbage'` + a valid run | state `project` — **no shadowing** |

### Item 2 — the uncatalogued shell strings and the checker's blindness. **Cleared, with the debt measured.**

The split audit is the part worth keeping, because it separates *the checker got better* from
*the tree got worse*, which a single moving number cannot:

| Lens | Tree | Count |
|---|---|---|
| old | old (`8e77a23`) | **261** — the recorded baseline, reproduced |
| new | old | **316** = 261 + **55 newly visible** |
| new | new | **308** = 316 − **8 paid** |

**Per-finding diff: added 0, removed 8, all `ProjectSwitcher.tsx`. Zero new debt, confirmed** —
not asserted from the totals.

`MACHINE_CONTEXT` probe, four string literals through both checkers: the old one was **silent
on lines 1 and 3** (`'…scoped to it.'`, `'…to the archive now.'`); the new one flags all four.
`className` / `href` remain silent, correctly. A **zero-interpolation** `aria-label={\`…\`}` now
FAILs where it was silent — that was the sharp half of the original finding.

Catalogue integrity: deleting two Arabic plural lines gives `tsc` exit 0 and
`check-rtl --gate` **exit 1** on catalogue-integrity. Item 3b's hole is closed and was proven
closed by planting the defect.

### Item 3a — the coverage gate's Test column. **Cleared. And the sibling hole is confirmed real.**

| Probe | Before | Now |
|---|---|---|
| Test cell → `NoSuchFile.test.tsx` | exit 0, silent | **FAIL, exit 1** |
| Test cell → `— (owed)` | silent | **warn** |
| Requirement citing **`§99.9`** | exit 0, silent | **exit 0, silent — unchanged** |

The third row is the reviewer confirming a declared blind spot is real rather than taking the
BOARD's word for it. It is the general defect below.

## Follow-ups — four, each routed to its owner in the same act as this filing

Per the protocol rule the first verdict earned: *a review that recommends a change to a file it
does not own files a message to the owner and a BOARD line in the same act as filing itself.*

| # | Finding | Owner | Message |
|---|---|---|---|
| 1 | **`comms/specs/observability.md:242` is false at `eaca677`** — the row says artefacts are `artifactsRoot/<runId>/` **with no project segment**. The segment landed one commit later at `7b6401d`. Safe direction, but it is the row a future erasure implementer reads, and it sends them to build something that already exists. | `observability-engineer` | `…/observability-engineer/20260817-2105-commandcenter-orchestrator-erasure-table-row-242.md` |
| 2 | **`ProjectSwitcher.tsx:243` renders an untranslated API enum** — `row.status` is printed verbatim when it is not `active`, so `paused` / `archived` appear in Latin script inside an Arabic pill. Latent at one project. | `shell-navigation-engineer` | `…/shell-navigation-engineer/20260817-2105-commandcenter-orchestrator-projectswitcher-untranslated-enum.md` |
| 3 | **The provenance banner's dirty scope excludes the instrument.** `scripts/lib/provenance.mjs:112` scopes `git status --porcelain` to the scanned tree (`apps/web`), so a run with `scripts/check-rtl.mjs` modified printed `· clean`. §8b exists so a number can be re-derived; the checker is the one file whose modification changes it. | `design-system-guardian` | `…/design-system-guardian/20260817-2105-commandcenter-orchestrator-provenance-excludes-the-instrument.md` |
| 4 | **`scripts/check-rtl.mjs` contains two literal NUL bytes** (offsets 38692, 38730), used as a split sentinel. ripgrep reports `binary file matches` and skips the file, so a reviewer grepping the RTL checker gets nothing. | `rtl-arabic-pdpl-specialist` | `…/rtl-arabic-pdpl-specialist/20260817-2105-commandcenter-orchestrator-check-rtl-nul-bytes.md` |

*Follow-up 4 reproduced while filing this handoff:* the `Grep` tool returned
`binary file matches (found "\0" byte around offset 38692)` on a plain search of that file.

## The general defect the verdict names — four instances, one cause

**`check-spec-coverage.mjs` verifies that a row *points* somewhere. It never verifies that what
the row *says* is true.**

| Instance | State |
|---|---|
| Test-column paths resolved zero times — 529 claims, 497 of 671 requirements, 102 files | **fixed** 2026-08-17T19:35 |
| A requirement citing a spec section that does not exist — `§99.9` passes, exit 0 | **open** |
| REQ-DSH-33 | **open** |
| The impl-column near-miss — a cell that nearly resolves counts as implemented | **open** |

Owner: **`commandcenter-orchestrator`**, under ADR-013. It is one defect with four faces and it
is recorded as one line on the BOARD rather than four notes, because four notes is how three of
them stayed open.

## Backlog verified facts — four `review-request` messages answered this session

Answered on their own merits, none back-filled with M15's verdict. **Their `## Answer` blocks
were not written to the message files** — same tool restriction — so these facts are the
durable half and the BOARD records the prose as owed.

**M0 · ADR-009 · `agent-library-curator`.** 12 agents, all `status: draft`; 12/12 `wired_into`
includes `workspace`; `company-interview` is `wired_into: [workspace]`; live count **0**;
`GET /metrics/live` → **503 `metrics_unavailable`** — it refuses rather than zeroing, which is
CLAUDE.md rule 9 behaving correctly under inspection.

**M1 rails · `map-galaxy-engineer` — the answer corrects the asker.** Contrast recomputed:
dark `ink-2/bg` **5.08**, dark `ink-2/bg-3` **5.46**, light `ink-2/bg` **4.60**, light
`ink-2/bg-3` **5.05**. The message cited **5.05** for light `ink-2/bg`. **The true figure is
4.60.** Still AA — but clearing the 4.5 floor by **0.10**, not by 0.55. The margin is the
claim, and it was overstated fivefold.

*And the guard that does not guard:* removing `tone="muted"` from a real call site leaves
`primitive-color-defaults.test.ts` **green**, because of `:190-191`:

```js
if (props.length === 0) continue;
```

**A test whose name promises an active guarantee, which is vacuous when the thing it guards is
absent.** Routed to `design-system-guardian`, who owns the primitives.

**M1 ticker · `shell-navigation-engineer`.** `useEndpoint.ts:74` — `malformedMessage` is
required; `CostTicker` parses `ledger.state` (`outage` / `noLedger` at `:147-148`). **The live
Docker three-state reproduction was not run** — the standing acceptance case (*stop Postgres,
confirm no surface shows a plausible zero*) is still owed.

**M6 · `design-system-guardian`.** `provenance.test.mjs` 10/10; the banner carries `+03:00`;
`RailLabel` defaults to muted; `BranchLabels.tsx:31-32` uses `role=button` + `aria-label`,
which takes the sublabels **out of the accessibility tree**.

## Verification

Every gate above was run by the reviewer at `eaca677` on a tree verified clean before and
after. A live runner was started and killed. Probes were planted for items 1, 2 and 3a and
removed. **Nothing was committed by the reviewer.**

The four follow-up facts were independently re-verified by `commandcenter-orchestrator` before
being routed — `observability.md:242`, `ProjectSwitcher.tsx:243`, `provenance.mjs:112` and the
two NUL byte offsets in `check-rtl.mjs` — so that four messages do not go out on a transcription.

## Next agent

`commandcenter-orchestrator` flips M15 to **done** and releases M16 on this PASS.
`thread-model-engineer` starts M16 with ADR-023, `contracts/thread-model.md` and migration
`0008_`. The four follow-up owners read their message first, then the row in *Follow-ups*.
