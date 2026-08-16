---
agent: design-system-guardian
milestone: M6
spec: PART I · §1.1 · §1.2 · §1.4 — contract design-tokens.md §8b, §9.3, §9.4a, §9.6a, §9.7b, §9.7c
created: 2026-08-16T23:59
status: ready-for-review
---

# M6 — the provenance clock, and closing §9's ledger

**This handoff exists because the previous one did not.** The code below landed in `4e0bbe6`
and was committed without its author's verification: the session was killed at the exact
moment it said *"now the full verification run"*. An agent killed mid-task leaves code without
paperwork, because the code is the early part of the work and the verification is the late
part. **Nothing here is re-done. Everything here is verified, decided, or filed.**

## What exists now

| Path | What it is |
|---|---|
| `scripts/lib/provenance.mjs:85-96` | `stamp()` — local wall clock + explicit offset via `getTimezoneOffset()`. Was `toISOString()`. |
| `scripts/__tests__/provenance.test.mjs` | 10 tests. Pins three **properties**, in three fixed-offset zones, as child processes with `TZ` forced. |
| `apps/web/src/components/primitives/RailLabel.tsx:48` | `tone = 'muted'` (was `'faint'`). `faint` survives as an opt-in. |
| `apps/web/src/test/primitive-color-defaults.test.ts` | Adopted into the contract at §9.6a. Written by `map-galaxy-engineer`. |
| `apps/web/src/dashboards/components/KpiTile.tsx:60` | Caveat at `text-ivory-2` — **ratified**, not tolerated. |
| `comms/contracts/design-tokens.md` | §8b, §9.3, §9.4a, §9.6a, §9.7b, §9.7c amended. Mine to edit. |

## The five decisions

**1. `KpiTile`'s caveat is `--ivory-2`. `dashboards-engineer` was right; I was wrong twice.**
The value being qualified is `KpiNumeral tone="default"` → `text-ivory`
(`KpiNumeral.tsx:54`, opened and read, not remembered). One rung below `--ivory` is `--ivory-2`;
`--ink-2` is two, which is what §9.4a forbids by name. It is also the shape I landed in the
drawer *after* issuing the instruction — `.runMeta` `--ivory` / `.runMetaAbsent` `--ivory-2` —
so **the departure is what is consistent with where I ended up and the instruction was the
outlier.** `fidelity-qa-reviewer` reached the same verdict independently. The two `--ink-2`
instructions are withdrawn in the contract, not only in a reply, so a reader who finds the old
message later finds the withdrawal before acting on it. `dashboards-contrast.test.ts:246` pins
it *and pins the premise* — if `KpiNumeral`'s default tone ever changes, the test goes red and
§9.4b applies (raise the value, never lower the caveat).

**2. `primitive-color-defaults.test.ts` enters the contract (§9.6a).** It is the second
instrument in a contract whose §8b says there is exactly one, so the boundary is drawn
explicitly: `check-tokens.mjs` remains the only judge of token *literals*; this file rules on
nothing it rules on and answers one question no text search can — *does a primitive's default
resolve to a sub-AA text token, and if so does every call site say out loud which tone it
wanted?* Three properties are binding on any future version (derive the targets by parsing,
never judge whether a string is required reading, keep the subset assertion).

**Why this is adopted while the per-module allowlist mandate stays declined.** I refused twice
to mandate `drawer-contrast.test.ts`'s pattern across modules I do not own, on the grounds that
it wants an ADR with those owners present. That reasoning is unchanged and this is not it in
disguise. The axis that decides it: **this file imposes no obligation on anyone** — it derives
its own targets, lives in one place, and an owner who never opens it still gets the guard. A
mandated per-module pattern bills eleven owners a file, a list and a review argument, which is
a decision about their work. *Adopt instruments that cost their beneficiaries nothing;
negotiate the ones that bill them.*

**3. `RailLabel` defaults to `muted`.** Granted to `map-galaxy-engineer` and
`dashboards-engineer` on their argument: four sibling primitives default at or above the floor
and one defaulted below it, 0-for-4 at shipped call sites. The general rule, which is the part
worth keeping: **where a default can be wrong in both directions, silence must resolve to the
recoverable one.** A wrong `muted` is one rung bright and a reviewer says so; a wrong `faint`
ships required reading at 2.77:1 past three readers, which is what happened, twice, in one
evening.

**4. §9.7b's ledger is closed against the spec, and it gained a row I had not ruled on.**
`grep -n 'ink-3' skilltree-clone-spec.md` returns four hits: 23 and 41 are token definitions,
128 / 156 / 184 are elements. **Line 128 — the MAP department sub-labels — had no row at all**
until that grep. Ruled: they stay `--ink-3`, decided against the shipped code rather than from
memory. `BranchLabels.tsx:30-32` puts `role="button"` + `aria-label="<DEPT> department"` on the
group containing them, so the three words are **already outside the accessibility tree by the
component's own design** — a string a component withholds from one class of reader cannot be a
sentence every reader must read. §9.2's *"any hint that appears nowhere else"* is the clause
that makes it close and it is answered rather than dodged. The trigger that flips the row is
written down: give the sub-labels their own accessible name or make them navigable.

**5. §9.7c — check contracts against the spec, not only code against contracts.** Adopted as
standing in `fidelity-qa-reviewer`'s words, because the sentence beats any rule I could write
around it: *"I checked the code against the contract and never checked the contract against the
spec."* Every gate here runs one way. `check-spec-coverage.mjs` comes closest and still only
verifies a row *points somewhere*, never that what it *says* is true.

## How to use it

- Quoting a token result anywhere — review, handoff, message, BOARD Evidence — means quoting
  the `scanned at` line with it. A count with no identity is a sentence, not evidence.
- Machines read `provenance().iso`. **Nothing may parse the display string.**
- A new primitive with a sub-AA default needs no registration: it is caught the day it lands,
  or the deriver is broken and that is the bug to fix.

## Contracts touched

`comms/contracts/design-tokens.md` — mine. §8b (mutation count corrected), §9.3 (the lone-glyph
clarification), §9.4a (ratification + withdrawal + message citation), §9.6a (dormancy of the
third assertion; the adopt-vs-mandate boundary), §9.7b (fourth row + closure rule), §9.7c (the
standing lesson, the three-line grep, the second instance).

No other contract edited. `comms/specs/dashboards.md` REQ-DSH-33 is wrong and is
`dashboards-engineer`'s file — filed, not fixed.

## Deliberately not done

- **ADR-011 stays `proposed`.** It sits with the user as one of six open decisions on BOARD. I
  did not self-accept it and would not: I filed it precisely because a bug fix may not smuggle
  a spec value.
- **The §9.7b ADR is not written, and no number was taken.** Content is complete; allocation is
  the orchestrator's. `012` is vacant for exactly the reason I did not compute "next free".
- **Spec lines 184 and 128 are not annotated.** Editing the spec of record to describe a
  decision with no number is the same smuggle in the other direction.
- **`comms/specs/dashboards.md` REQ-DSH-33 not corrected by me.** Another owner's file. Filing
  it is the fix I am allowed to make.
- **The dormant third assertion in `primitive-color-defaults.test.ts` was left dormant.** With
  no sub-AA default anywhere, the call-site sweep iterates nothing. It is a trap, not a patrol.
  Re-adding an entry to keep it busy would re-introduce the exact defect corrected on adoption.
- **`text-kpi-sm` still embeds weight and tracking in a size token.** ~40 call sites, raised by
  review twice, still its own change and not a drive-by.
- **`provenance.mjs` is still not wired into `check-rtl`, `validate-panels`,
  `check-spec-coverage`, `check-metrics`.** Three are other agents'. Needs a broadcast, and the
  broadcast is better sent now that the helper's own clock bug is fixed and pinned.
- **Nothing was re-done.** The `provenance.mjs` and `RailLabel` edits in `4e0bbe6` were read
  and verified, not rewritten.

## Verification

Every number below is mine, run at `4e0bbe6` with a clean `apps/web`.

**The provenance test pins the property, not the format** — and the property that carries the
incident is (c): *a scan run now does not look old.* Mutation-verified by restoring the
`toISOString()` stamp in the real file:

```
✖ a scan run now does not look old to a reader in any zone
  scanned under TZ=UTC, read from Asia/Riyadh: "2026-08-16 20:49" reads as
  181 minutes old the moment it was produced.
```

Seven of ten go red under that mutation — **not six, as §8b claimed until I measured it.** The
contract now prints the count with its date and commit and says which half is the requirement:
the property is binding, the count is an observation of a suite that drifts. Reverted with
`git checkout`; the tree is clean.

| Gate | Result |
|---|---|
| `node --test scripts/__tests__/provenance.test.mjs` | 10/10 |
| `npm test` | 108/108 |
| `npm run test:web` | green **both halves** — 58 vitest files, and the node half |
| `node scripts/check-tokens.mjs` | 291 files, **0 violations**, 2 exemptions (both `Chip`, both pre-existing) |
| `node scripts/check-comms.mjs` | clean bar one pre-existing filename warning, not mine |
| hex outside `tokens.css` | zero, outside comments that quote a measured value |

**Provenance line (§8b), with my own fix in it:**

```
Token discipline
  scanned at        2026-08-16 23:51 +03:00 · 4e0bbe6 · clean
  files scanned     291
  violations        0
```

The `+03:00` is there because of the bug `4e0bbe6` fixes, and `4e0bbe6` is the commit that
fixes it. **The line is evidence for itself** — which is the neatest available demonstration
that §8b's requirement is about the property and not about the punctuation.

### Addendum — the tree moved under me at 00:01, which is the section demonstrating itself

A re-run ten minutes later reports a different repo, and §8b exists so that this is readable
rather than alarming:

```
Token discipline
  scanned at        2026-08-17 00:01 +03:00 · 4e0bbe6 · 7 uncommitted under apps/web
  files scanned     293          (was 291)
  violations        0
```

Two more `.tsx` under `apps/web` and seven uncommitted paths: another agent is mid-M15 and has
landed `ProjectSwitcher.tsx` and `useProjects.ts`. **Still 0 violations, so their new files are
clean** — that is a fact about their work, dated, and I am recording it rather than claiming it.

`npm test` at that same instant reports **129 tests, 3 failing** — where mine reported 108/108
at `4e0bbe6` with a clean tree. The three are `scripts/__tests__/identity-model.test.mjs`
(*"`ops.identity` exists and is created in exactly one migration"* and its PDPL sibling), an
**uncommitted, in-flight file** from the identity slice, alongside two new untracked migrations.
Not my files, not my scope, and not a regression in anything above: `provenance.test.mjs` is
10/10 inside that same run and `npm run test:web` is green on both halves at the later tree too.

This is the precise scenario §8b was written for — *"if two token results ever disagree, they
are two runs of this one script at different times, and the difference is the tree, not the
tooling."* Two `npm test` results, 108/108 and 125/129, twenty-one tests apart, and the reason
is legible in the provenance lines instead of costing someone an hour. **Do not quote the second
pair of numbers as a verdict on this handoff, and do not quote the first as a verdict on the
repo.**

Three decision-requests answered in-file and marked `answered`
(`dashboards-engineer` 22:08, `fidelity-qa-reviewer` 22:30, `map-galaxy-engineer` 22:32). Two
messages filed: ADR number request to `commandcenter-orchestrator`, REQ-DSH-33 finding to
`dashboards-engineer`.

## Next agent

`fidelity-qa-reviewer` — re-review filed. Read §9.7b's ledger first and check the closure claim
by re-running `grep -n 'ink-3' skilltree-clone-spec.md`; the ledger is only worth what that
grep says. Then `commandcenter-orchestrator` for the ADR row, and `dashboards-engineer` for
REQ-DSH-33.
