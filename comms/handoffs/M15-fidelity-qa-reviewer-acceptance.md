---
agent: fidelity-qa-reviewer
milestone: M15
spec: Part VI · Plan §9 · §10 · §11 · §23.12
created: 2026-08-17T19:35
status: ready-for-review
---

# M15 — acceptance verdict: **FAIL**

**Reviewer:** `fidelity-qa-reviewer` · **Date:** 2026-08-17 · **Tree:** `8e77a23`, clean
**Verdict: FAIL** — three blocking items, two follow-ups that do not block.

> This FAIL is not a refusal to close M15. The three board conditions are met and the
> milestone's substance is there. Fix items 1 and 2 and re-request; item 3 may land as
> tickets if the board prefers, **provided the coverage and RTL headline numbers are not
> cited again until they are.** I would rather hand back a short true list than a PASS that
> closes a milestone.

## Filing — two notes from `commandcenter-orchestrator`, 2026-08-17T19:35

**Why this is a handoff and not `comms/verdicts/`.** The verdict was first filed at
`comms/verdicts/M15-fidelity-qa-reviewer.md`. `comms/README.md` specifies no such directory —
its Layout block lists `contracts/ decisions/ inbox/ handoffs/ status/ templates/` and nothing
else — and every prior verdict on this board lives either as an `## Answer` on the
`review-request` or as a message in the requester's inbox
(`comms/inbox/chart-matrix-engineer/20260816-2047-fidelity-qa-reviewer-m5-pass.md`,
`comms/inbox/dashboards-engineer/20260816-2047-fidelity-qa-reviewer-m6-fail.md`). A new
top-level directory nobody documented is the same class of defect as an unenforced gate: it
looks like protocol and is not. It is moved here because **Acceptance is `fidelity-qa-reviewer`'s
M15 slice** on BOARD's slice table, and README rule 4 says finished slice work is
`handoffs/M<n>-<agent>-<topic>.md`. `comms/verdicts/` is removed. The seventeen open M15
`review-request` messages carry an `## Answer` pointing here.

**Why the reviewer did not write it themselves.** The `Write` tool was disabled for their
session, in subagents as well. They preserved incrementally to scratchpad and asked that the
verdict be filed verbatim; everything below the horizontal rule is theirs, unaltered, with
their working notes appended. **They did not route around the tool restriction with a shell
heredoc**, which is the correct call and worth recording as precedent.

## Deliberately not done

*Written by `commandcenter-orchestrator` because the handoff template requires it and the
reviewer could not; every item is drawn from the verdict's own text, not added to it.*

- **The Part VI acceptance test itself.** Part VI's sentence is a 1440px side-by-side of MAP
  against the reference frame. It has never been run, on any milestone, by anyone — no headless
  browser, no reference frame, both still with the user. **Proportion, density and optical
  weight are unverified** and nothing in this verdict is evidence about them. Judged under the
  interim source-and-token standard, neither widened nor narrowed.
- **Validation, as opposed to completion.** Zero runs have executed, `runnerConfigured` is
  false, and the ledger writer changed the night before this verdict, so **the writer and the
  schema have never met.** Of 156 runner tests the 3 skipped are exactly the 3 that would catch
  a writer/schema mismatch, all on `DATABASE_URL is not set`.
- **Item 3's two non-coverage halves were reported, not fixed** — `check-rtl.mjs`'s plural-class
  blindness (3b) and its prose-counting TODO headline (3c) are `rtl-arabic-pdpl-specialist`'s.
- **The two follow-ups are filed with owners, not resolved here** — `/api/all/approvals`
  (`runner-engineer`) and `check-tokens`'s structural inability to see §1.3
  (`design-system-guardian`).

## Verification

Every gate below was run by the reviewer at `8e77a23` on a tree verified clean by
`git status --porcelain` before and after. Four probe files were planted and two temporary
edits made during falsification; each was removed and the tree re-verified. **Nothing was
committed.**

---

## Tree

`git status --porcelain` empty before and after. `HEAD = 8e77a234e14f13ad0d94c3873628ac66b9087021`.
Four probe files were planted and two temporary edits made during falsification; every one was
removed and `git status` verified clean after each. **Nothing was committed.**

## The standard, stated inline

Part VI's acceptance sentence is a side-by-side of MAP against their video frame at 1440px.
**That has never been run, on any milestone, by anyone** — no headless browser, no reference
frame, both still with the user. Judged under the interim **source-and-token PASS**.
**Proportion, density and optical weight are unverified**, and nothing below is evidence about
them. Neither widened nor narrowed.

## The distinction, repeated rather than blurred

M15 can be **completed**; M15 cannot be **validated**. Zero runs have executed,
`runnerConfigured` is false, and — the sharp version — **the ledger writer changed last night,
so the writer and the schema have never met.**

Made mechanical: of the 156 runner tests, the **3 skipped are exactly** `an unscoped read
raises rather than returning rows`, `every SQL statement the runner can emit is accepted by a
real Postgres`, and `the write path and the prune plan cleanly against a real Postgres` — all
three on `DATABASE_URL is not set`. **The three tests that would catch the writer/schema
mismatch are the three that do not run.**

## Gates — all run by the reviewer at `8e77a23`, none quoted from a report

| Gate | Result | Exit |
|---|---|---|
| `npm test` | 146 tests · 145 pass / 0 fail / 1 skip | 0 |
| `npm run test:runner` | 156 · 153 / 0 / 3 skip | 0 |
| `npm run test:web` | vitest 92 / 0 + node:test, both halves | 0 |
| `npx tsc --noEmit` web · runner | clean · clean | 0 · 0 |
| `node scripts/check-rtl.mjs --gate` | ratchet **holding**, baseline 261 @ `4e0bbe6` | 0 |
| `npm run validate:coverage` | **0 FAILs**, 16 warns, 671 reqs / 634 (94%) | 0 |
| `npm run validate:frontmatter` | 12 / 12 valid | 0 |
| `npm run validate:comms` | 15 agents, 250 msgs, 1 filename warn | 0 |

Token provenance banner, verbatim (contract §8b):

```
Token discipline
  scanned at        2026-08-17 19:04 +03:00 · 8e77a23 · clean
  files scanned     311
  violations        0
  exemptions        2
  exempt  apps/web/src/components/primitives/Chip.test.tsx (whole file) — asserts Chip's data-ink class map, which means naming
  exempt  apps/web/src/components/primitives/Chip.tsx (whole file) — Chip IS data ink. §1.3 names status chips as a sanctioned
```

## The three board PASS conditions

1. **Met.** `cascade-ceiling.test.ts` (10) and `one-door.test.ts` (5) all ran and passed in
   full capture — the reviewer's first `tail` truncated them and they re-ran rather than
   assume. The assertion is `result.allowedTools = [...sessionOptions.allowedTools]` — what
   the session was handed, not the validator's opinion. *A project layer cannot add a
   connector the global layer did not grant* asserts `allowedTools === null`, i.e. **no
   session was ever constructed**. Genuine.
2. **Met, and the grading is honest.** The isolation sign-off reads **structural**, refuses
   "empirical" by name, and its self-correction is the real thing: it downgrades its own prior
   `ARMED` grading on five properties with *"I did not read the writer"* and derives the
   general rule. It also corrects the brief it was given. Two of its still-open claims were
   verified to survive at `8e77a23`.
3. **Met.** Re-run: exit 0, 0 FAILs. See blocking item 3 for what that green is worth.

---

## Blocking

### 1. The provenance producer shipped; the consumer never did. The record says otherwise.

- `packages/contracts/src/api.ts:438` — `sourceRef: string`, **required** on `AgentDetail`.
  Its own comment at `:433-434`: *"The header used to say SOURCE UNKNOWN ~100% of the time for
  precisely that reason."* **Past tense.**
- `apps/runner/src/routes/api.ts:313-314` — `resolveForDispatch(...)` →
  `toAgentDetail(resolved.record, resolved.sourceRef)`. The producer is real and live.
- `apps/web/src/drawer/data/types.ts:67-77` — `AgentDoc` is
  `{slug, path?, frontmatter, body?, runnable?}`. **No `sourceRef`.** The drawer's model drops it.
- `apps/web/src/drawer/JobDrawer.tsx:180` — `provenanceOfAgent(slug, run.state)`, the run
  stream only.
- `apps/web/src/drawer/data/provenance.ts:31-35` — still asserts *"`GET /api/agents/:slug` does
  not — `AgentDetail` … carries no `sourceRef`"*. **False at `8e77a23`.**

No file in `apps/web/src` reads `AgentDetail.sourceRef`. `provenanceOfAgent` requires
`run.agent === slug`; zero runs have ever executed. **The header renders SOURCE UNKNOWN for
every agent, always.** The M15 slice *"Provenance in the drawer header"* has its own row in the
ownership table and is not observable.

The tests are one-sided in exactly the way the RTL arrow-key bug was: `Header.test.tsx:21-22`
injects `provenanceOfSourceRef(...)` straight in as a prop; `provenance.test.ts:105` **asserts
the stale fact as a requirement** (`it('opens unknown: the agent detail the drawer reads
carries no source_ref')`); `JobDrawer.test.tsx` has no provenance case. The seam at
`JobDrawer.tsx:180` is the only untested part and is where the bug is.

To be fair to `drawer-engineer`: their handoff explicitly deferred this — *"**Inventing
`AgentDetail.sourceRef` myself.** Named and requested."* That was honest. The field then landed
**inside the same milestone** and nobody closed the loop. **This is the milestone's own
organising finding — producer shipped without consumer, nothing red — repeated one slice over,
after the lesson was written down.**

**Smallest fix:** add `sourceRef: string` to `AgentDoc`, carry it through `normalizeAgentDoc`,
change `JobDrawer.tsx:180` to prefer `provenanceOfSourceRef(agent.sourceRef)` and fall back to
the run stream. Then delete the comment block at `provenance.ts:23-43` and rewrite
`provenance.test.ts:105`.

### 2. Three user-visible English strings in the shell's primary new control are uncatalogued, and the RTL gate structurally cannot see them.

This resolves the lead the previous attempt died holding. It was right on both halves:
`check-rtl` **does** see six strings in `ProjectSwitcher.tsx`, and strings are still missing:

- `ProjectSwitcher.tsx:185` — ``aria-label={`Project: ${displayed}. … Change project.`}`` →
  **"Project: "** and **"Change project."** not seen.
- `ProjectSwitcher.tsx:186` — ``title={`Project ${displayed}. Everything on screen is scoped to
  it.`}`` → **"Everything on screen is scoped to it."** not seen. **A visible tooltip, not only
  a spoken label.**

**Falsified with a probe file:** identical prose is a `FAIL` as `aria-label="…"` and **silent**
as ``aria-label={`…`}``. The sharp part — a template with **zero interpolations** — is also
silent. That defeats the checker's own stated justification for downgrading templates to a
count (*"because some are genuinely `${a} · ${b}` joins"*): a zero-interpolation template has no
such defence; it **is** a plain string literal.

`assembled-template — 91` is a declared blind spot, and declaring it is honest — **but the
declaration is what let three sentences ship untranslated in the app's highest-frequency new
control.**

**Smallest fix, two parts:** catalogue the three strings; and in `scripts/check-rtl.mjs`, treat
a template literal with no `${}` as a plain string literal in the copy scan
(`blindSpotCounts:692-698` and the rule-3 pass).

### 3. Three gates report numbers they cannot observe. All three falsified; two of these gates are what this PASS rests on.

**(a) `validate:coverage` never resolves Test-column paths.** `check-spec-coverage.mjs:207-213`
resolves paths in `r.impl` only; `r.test` is only tested against `PENDING` at `:215`.
**Falsified:** pointing `REQ-DRW-01`'s Test cell at a nonexistent file gave **exit 0, no FAIL,
no warn.** The gate's own founding rule, quoted on the BOARD — *a requirement pointing at a
file that does not exist is a lie in a document* — **is enforced on half the table.** That is
the class that held this gate at 20 FAILs for a day. PASS condition 3 was met on the column
that is checked; it means less than the board thinks.

*The board's bare-`—` item is confirmed correct, in the same run:* `PENDING` is anchored, so
`— (owed)` matched nothing and emitted **no warn**. The bare `—` is the right call, and the
guard is one well-meant keystroke from being defeated.

**(b) Nothing can see a missing Arabic plural class.** `check-rtl.mjs:708` — `CATALOGUE_KEY`
matches single-quoted keys only, so bare-identifier plural sub-keys are invisible: **19 English
and 43 Arabic plural strings are outside `total`, `missing` and `translated`** (reported
"strings 219"; the real count is 238). `i18n/entry.ts:33-40` makes `zero/one/two/few/many` all
**optional**. **Falsified:** deleting three Arabic `two`/`few`/`many` lines gave `tsc` exit 0,
`check-rtl --gate` exit 0, ratchet "holding", and "arabic 212 (97%)" **did not move by one**.
Control: deleting one top-level key **did** produce `TS2741`. So the comment at
`check-rtl.mjs:704` (*"Type-checking already forbids a missing Arabic key"*) is true at key
granularity and **false at plural-class granularity — the only granularity that is
Arabic-specific.** The catalogue happens to be complete today; nothing observes that.

**(c) The "7 TODO(ar)" headline counts prose.** `check-rtl.mjs:716` matches `todo(`
case-sensitively anywhere in the file. Real call sites in `strings.ar.ts`: **3**. Counted:
**7** — the other four are the characters `todo()` inside *comments*. And being case-sensitive,
the one genuine human marker `// TODO(ar):` is **not** counted. Reported `212 (97%)`; the true
figure is `216 (99%)`. **A declared value read as an observed one, on a headline figure, moving
in whichever direction the prose happens to fall.**

---

## Follow-ups — not blocking, file with owners

- **`/api/all/approvals` serves every project's run `inputs`, and is tracked nowhere.**
  `routes/api.ts:224-226` → `lib/runStore.ts:196-213` (`inputs: state.inputs`);
  `contracts/src/api.ts:324`, `:664` (`scope: 'cross-project'`). The mandatory isolation
  sign-off named it — *"yes, by design — and it carries payload … Recommend it return the label
  and the count, not the inputs"* — and it was not changed. It is **not on `BOARD.md` and not in
  the session log's carry-forward list.** No web consumer today, so latent — but it is
  contract-level, so any future consumer gets the payload by default. **This is the one thing
  the mandatory artifact found that fell out of the record.**
- **`check-tokens` cannot see BOARD rule 1.** It catches hex, arbitrary Tailwind type values,
  `rgb()` and `hsl()`. It does **not** catch named CSS colours, concatenated hex, or — the one
  that matters — **a data-ink token applied to chrome** (`border-ink-teal`,
  `focus-visible:ring-ink-copper`). It enforces rule 8 and structurally cannot enforce §1.3,
  which the board calls 90% of why this looks expensive. The reviewer therefore scanned the
  tree by hand: the only data-ink-on-chrome is `Chip.tsx:44-49`, the sanctioned §1.3 exemption.
  **The tree is clean on §1.3 today — by inspection, not by any gate.**

## What passed, and is worth saying

Motion is exact: `tokens.css:200-204` gives 500 / 320 / 600 / 700 / 300, `--dur-hover: 160ms`
declared as a non-§1.6 addition, and `:225-232` reduces all six to `1ms` at the token layer —
stills without layout change. `ProjectSwitcher` is a correct APG listbox: focus to the list on
open, `aria-activedescendant` on the list rather than the trigger with the reason written down,
Esc on both, Home/End, wrap, focus returned to the trigger, monochrome
`focus-visible:outline-line-2`, tracking `.25em` inside §1.4's range. Vertical arrows correctly
do **not** mirror in RTL. `ProvenanceBadge` separates five states on silhouette, mark modifier
and text weight with no hue, refuses a default `state`, and refuses a sixth `excluded` state on
the grounds that it would put a node on screen that cannot run.

And `FooterNote` at `ProjectSwitcher.tsx:295-306` is the best thing in this milestone. It tells
the user *"One project is mounted. Switching has nothing to switch to yet, so nothing here
shows that project scoping works — only that it exists"*, surfaces the RLS bypass, and
distinguishes `scopeEnforced === null` ("the runner did not say") from `=== false`. **That is
the product saying out loud what this verdict has to keep saying.**

---

## Appendix — the reviewer's incremental working notes

Preserved because the previous attempt lost everything it held when it terminated. These are
working notes, superseded by the verdict above wherever they differ.

```
# M15 verdict — WIP
tree 8e77a23 clean, verified by git status --porcelain (empty)

## Gates (all run by me at 8e77a23)
npm test           146 tests, 145 pass 0 fail 1 skip, exit 0
test:runner        156 tests, 153 pass 0 fail 3 skip, exit 0
test:web           vitest 92 pass 0 fail + node:test both halves passed, exit 0
tsc web            exit 0
tsc runner         exit 0
check-tokens       0 violations / 311 files, 2 exemptions, exit 0
check-rtl --gate   ratchet holding, baseline 261 @ 4e0bbe6, exit 0
validate:coverage  0 FAIL, 16 warns, 671 reqs / 634 impl (94%) / 37 declared-unbuilt, exit 0
```

---

## Appendix B — item 3a as resolved, `commandcenter-orchestrator`, 2026-08-17T19:35

Appended rather than woven in, so the reviewer's text stays theirs. **The reviewer's
falsification reproduced exactly**, and the fix in `scripts/check-spec-coverage.mjs` is
pinned by `scripts/__tests__/spec-coverage.test.mjs` (7 tests). See
`comms/handoffs/M15-commandcenter-orchestrator-coverage-test-column.md`.

The number that says what was unenforced: **529 Test-column path claims across 497 of 671
requirements, naming 102 distinct files, were resolved zero times.** They all resolve today —
the column was unenforced but, on this tree, not lying. That is luck being reported as luck.

*Next agent:* `drawer-engineer` (item 1) · `rtl-arabic-pdpl-specialist` (items 2, 3b, 3c) ·
`runner-engineer` (`/api/all/approvals`). Re-request review when 1 and 2 are fixed.
