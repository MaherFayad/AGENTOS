---
agent: drawer-engineer
milestone: M15
spec: §2.3 · §2.6.5 · `Plan §23.6` · ADR-014 §2
created: 2026-08-17T19:45
status: ready-for-review
---

# M15 blocking item 1 — the provenance consumer, wired

## The one-sentence answer to the question the brief asked

**Yes: the header now shows a real layer for a real agent with no run having executed —
`▣ PROJECT`, from the live runner, observed rather than inferred.** The probe is in
*Verification* below: a running runner answered `GET /api/p/agentos/agents/sales/account-enrichment`
with a real `sourceRef`, and that response, put through the drawer's **own** `normalizeAgentDoc`
and `drawerProvenance`, yields `{kind:'known', state:'project'}`. Zero runs have executed and
`runnerConfigured` is still false; neither matters any more, which was the point of the slice.

The one thing still **not** observed is the pixel: no headless browser exists in this repo, so
"the badge is painted in the header at 1440px" remains `fidelity-qa-reviewer`'s gate. What is
proven is everything up to and including the React render — `JobDrawer.test.tsx` mounts the
real drawer in jsdom, answers the real route with a real `AgentDetail`, starts no run, and
reads the badge's own sentence out of the DOM.

## What exists now

- `apps/web/src/drawer/data/types.ts` — `AgentDoc.sourceRef: string | null`. **Required key,
  nullable value.** Required because the field being *absent from the model* is exactly how it
  got lost: a required key means `normalizeAgentDoc` cannot stop carrying it without failing to
  compile. Nullable because the contract's `sourceRef: string` describes what today's runner
  sends and `AgentDoc` describes what this app may *receive*; `''` would be a sentinel that
  reads like a value. (The verdict scoped `sourceRef: string`; this is that fix with the
  absence case said out loud instead of encoded as an empty string.)
- `apps/web/src/drawer/data/normalize.ts` — carries it through, from the **envelope only**.
  Never from `frontmatter`: a `source_ref` written into an agent's own file would be a file
  claiming its own provenance, which is the claim the cascade exists to make on its behalf.
- `apps/web/src/drawer/data/provenance.ts` — new `drawerProvenance(slug, agentSourceRef, run)`:
  the agent read first, the run stream second. The order is the claim — the detail is *the file
  that would run* (resolved just now through `resolveForDispatch`), the run is *the file that
  did run*, possibly against a tree that has since changed.
- `apps/web/src/drawer/JobDrawer.tsx:180` — calls it. Both anatomies already shared one header,
  so the chart mirror (§2.6.5) got this for free and is asserted anyway.
- **Deleted:** the comment block at `provenance.ts:23-43` asserting *"`GET /api/agents/:slug`
  … carries no `sourceRef`"*. Replaced by an account of the two sources **and** of how the
  comment went stale, because "documentation asserting the pre-change fact" is the defect
  class, not the sentence.
- **Rewritten:** `provenance.test.ts:105`, which asserted the stale fact as a requirement
  (`it('opens unknown: the agent detail the drawer reads carries no source_ref')`). Four cases
  now pin the ordering, the fallback, and unknown-only-when-neither-said.
- `apps/web/src/i18n/{strings.en,strings.ar}.ts` — **`a11y.provenance.unknown` re-worded.** It
  said *"the agent detail this drawer reads does not carry it yet"* — the same false claim as
  the deleted comment, but spoken to a screen-reader user. It now names both sources and says
  neither answered, which is a statement about this render rather than about the contract, so
  it cannot go stale the same way. Arabic stays `todo()` (still English, still counted).
  Filed with the catalogue owner; see *Contracts touched*.

## How to use it

Nothing to import. The drawer does it:

```ts
const provenance = drawerProvenance(slug, agent.kind === 'ready' ? agent.doc.sourceRef : null, run.state);
```

`MAP` and `CHART` badges (out of M15 scope) should call the **same** function rather than
parsing `source_ref` a second time — that second implementation is what ADR-014 decision 9
forbids by name.

## Contracts touched

None changed. Two consumed, both `runner-engineer`'s: `AgentDetail.sourceRef`
(`packages/contracts/src/api.ts:438`, required, produced at `apps/runner/src/routes/api.ts:313`)
and `SseStartData.sourceRef`. `comms/specs/drawer.md` updated: decision 9 rewritten with the
stale version quoted, new **REQ-DRW-36** for the wiring, REQ-DRW-30/31 verified-by now include
`JobDrawer.test.tsx`, the *Interfaces we consume* row names the agent read, and two "deliberately
not done" entries corrected — one struck through rather than deleted, so the shape stays visible.

An `fyi` is filed with `rtl-arabic-pdpl-specialist` (catalogue owner) naming the two lines I
edited in their files and why I did not leave the sentence for their next sweep. The
`decision-request` to `runner-engineer` that asked for this field is now closed with the
outcome, four hours after they answered it.

## Deliberately not done

- **`fork` / `drifted` / `orphaned`.** Unchanged and still unreachable: all three are states of
  a *comparison* against the parent's current digest, and nothing computes one. `forked_from`
  being in the schema is still not enough. The tripwire test that should fail on the day a
  resolver lands is untouched.
- **Weakening the run-stream guard.** `provenanceOfAgent` still refuses to attribute a run's
  `source_ref` to any agent but the one that ran. It is now a *fallback*, which makes it easier
  to justify removing — it is not removed.
- **`unknown` as a sixth badge.** Still no mark, still no reflow, still `--ink-2` and not the
  disabled `--ink-3`. `Header.test.tsx` and `drawer-contrast.test.ts` both still hold that.
- **Badges on MAP nodes and CHART job cards.** Still out of M15 by BOARD. `drawerProvenance` is
  exported for them.
- **A live-cascade *round trip in a browser*.** Narrowed, not closed — see the last line of the
  spec's "deliberately not done". The claim this slice can make is *"the drawer renders whatever
  `resolveForDispatch` says"*, not *"the layer on your screen is the layer on disk"*.
- **Anything in the two other blocking items.** `scripts/check-rtl.mjs`, `ProjectSwitcher.tsx`
  and the approvals route belong to the two agents working them concurrently. See *Verification*
  for one observation about the RTL gate that is theirs, not mine.

## Verification

**Red first, because a test that has never been red proves nothing.** The new seam suite was
written against the *unfixed* wiring and run before any source change:

```
FAIL src/drawer/JobDrawer.test.tsx > provenance reaches the header from the agent read, with no run
  > names the layer the cascade resolved, without a run having executed
AssertionError: expected 'FULLY AUTONOMOUSSource unknownWhich l…' to contain 'Resolved from this project's library.'
   Tests  3 failed | 8 passed (11)
```

All three failed on the same substring — `Source unknown` where a layer belonged — which is the
bug in the verdict's own words. The two negative cases (no `sourceRef`; an unreadable one)
passed before *and* after, deliberately: they pin the honest empty state, not the fix.

**Live probe — the observable the brief asked about.** Runner started on `RUNNER_PORT=8791`
(dev profile, no `DATABASE_URL`, no runs), then the real response through the real drawer code:

```
slug         sales/account-enrichment
sourceRef    project:agents/sales/account-enrichment/SKILL.md@sha256:db02d09ac4283532…
header shows {"kind":"known","state":"project","source":{"layer":"project",
              "path":"agents/sales/account-enrichment/SKILL.md","digest":"sha256:db02d09…"}}
```

The probe file was written outside the repo, run from `apps/web`, and deleted; the runner was
stopped; `git status` is clean of both. As `runner-engineer` warned, every agent in this repo
resolves to `project:` until a global library exists — one badge value, true rather than stubbed.

**Gates, all run by me after the change:**

| Gate | Result |
|---|---|
| `npm run test:web` | both halves green — vitest 69 files / 583 tests, node:test 92 |
| `npx tsc --noEmit -p apps/web/tsconfig.json` | exit 0 |
| `node scripts/check-tokens.mjs` | exit 0 — banner below |
| `npm run validate:coverage` | exit 0, **0 FAILs**, 672 reqs / 635 (94%) |
| drawer + i18n suites alone | 13 files / 107 tests, green |

Token provenance banner, verbatim:

```
Token discipline
  scanned at        2026-08-17 19:39 +03:00 · 8e77a23 · 11 uncommitted under apps/web
  files scanned     311
  violations        0
  exemptions        2
  exempt  apps/web/src/components/primitives/Chip.test.tsx (whole file) — asserts Chip's data-ink class map, which means naming
  exempt  apps/web/src/components/primitives/Chip.tsx (whole file) — Chip IS data ink. §1.3 names status chips as a sanctioned
```

**One observation that is not mine and is not a finding against this slice.** At 19:34
`node scripts/check-rtl.mjs --gate` exited **1**: `total 261 → 320`, across ten modules at
once. That is `rtl-arabic-pdpl-specialist`'s in-flight fix for blocking item 2 — widening the
checker to see zero-interpolation template literals makes ~59 pre-existing strings visible in
one step. I confirmed my own edits add nothing to it: the catalogue files are not scanned as
findings (their only appearance in the report is the "→ move it to strings.en.ts" hint line),
and no finding in `drawer/**` names a string I wrote. Flagged for the ratchet decision, which
is theirs. Mid-run I also saw 19 shell tests red for about a minute while they were editing
`ProjectSwitcher.tsx` and `test-harness.tsx`; those are green again at 19:41.

Nothing committed. `git status` shows my nine files plus four other agents' concurrent work.

## Next agent

`fidelity-qa-reviewer` — re-review of blocking item 1. Read
`apps/web/src/drawer/JobDrawer.test.tsx` (the new `describe` is the whole answer) and
`provenance.ts`'s rewritten header comment. The honest residue is one line: *nothing in this
repo observes the badge as pixels*, and that is your gate, not a test I withheld.
