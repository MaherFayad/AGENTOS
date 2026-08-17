---
agent: commandcenter-orchestrator
milestone: M15
spec: PART VI · ADR-013
created: 2026-08-17T19:35
status: ready-for-review
---

# M15 blocking item 3a — `validate:coverage` now resolves the Test column

## What exists now

- `scripts/check-spec-coverage.mjs` — `pathsIn(cell)` replaces the inline path loop. **Both**
  the `Implemented in` and `Test` columns go through it, because *"resolve the paths"* must
  have exactly one reading; the previous code resolved `r.impl` only and compared `r.test`
  against `PENDING` and nothing else.
- `scripts/__tests__/spec-coverage.test.mjs` — 7 tests. Picked up by `npm test` automatically
  (`node --test scripts/__tests__/*.test.mjs`). The gate had **no test at all** before this.

## What the gate could not see, in one number

**529 Test-column path claims, across 497 of 671 requirements, naming 102 distinct files, were
resolved zero times.** They all resolve on this tree. The column was unenforced but not lying —
and that is luck, reported as luck. The reviewer's falsification reproduced exactly: pointing
`REQ-DRW-01`'s Test cell at `JobDrawer.NOPE.test.tsx` gave exit 0, no FAIL, no warn; it now
gives exit 1 and `FAIL drawer.md: REQ-DRW-01 cites test "…" which does not exist`.

## The judgement — which forms are path-shaped, and why

This is the whole fix, so it is stated rather than left in the diff. The Test column carries
forms the Implemented column does not, and a gate that FAILs on prose is a gate people route
around. The rule is about **shape**, not about which column the cell came from. A `·`/`,`
-separated element is either:

| | Rule | Rationale |
|---|---|---|
| **claim** — one bare token, nothing else in the element | resolved if it has a `/` **or** a file extension | This is the rule `looksLikePath` has always applied to the Implemented column, unchanged. It is why `` `package.json` `` at the repo root (REQ-INF-57 · 61 · 65) keeps being checked — dropping the extension arm would have been a silent *regression* in the one column that worked. |
| **prose** — anything with a space in it | only its `/`-bearing tokens are resolved | `manual — see Test plan` (58 rows), `negative fixture run` (13), `manual — phone checklist`, `review — fidelity-qa-reviewer` stay prose without hand-listing a single phrase. |

Two exclusions inside prose, both load-bearing:

- **A token starting with `/` is never a path.** Repo paths here are relative to ROOT, so a
  leading slash means a URL route. Without this, REQ-CHT-42's `manual — open `/p/:project/chart``
  is a FAIL, and the honest cell gets punished.
- **A bare filename inside a sentence is not a path.** REQ-OBS-28 reads
  ``— *(banner is the evidence; `provenance.mjs` itself is pinned by `scripts/__tests__/provenance.test.mjs`)*``.
  `provenance.mjs` cannot be resolved without a directory — it lives at `scripts/lib/` — and
  **only a resolvable claim can be a lie.** The test path beside it resolves and is checked.

The consequence I did *not* expect and like: tokenising means a command resolves the script it
names. `` `node scripts/seed-agents.mjs` `` now checks `scripts/seed-agents.mjs`, which is the
half of that cell that can go stale.

**One bug in my own first draft, recorded because it is the failure mode of this class of fix:**
stripping `_` as markdown punctuation turned `` `scripts/__tests__` `` (REQ-INF-69) into
`scripts/__tests` and manufactured a FAIL out of a correct cell. `_` is a legitimate path
character and is not in `STRIP_TAIL`. A gate whose first output is a false FAIL is worse than
the gap it replaced.

## The bare-`—` guard — decided, not left

The board asked whether `PENDING`'s anchoring should stay strict. **It should not, and it is
now start-anchored:** `/^(—|-|TBD|pending|n\/a)(\s|$)/i`. Both-ends anchoring was *correct*
about the bare `—` and one keystroke from defeat — `— (owed)` matched nothing, so it was graded
as a real verification claim and emitted **neither a FAIL nor a warn**. A near-miss passing
silently is the same disease as an unenforced column.

Loosening alone would have mis-graded REQ-OBS-28, whose cell *opens* with `—` and then names
real evidence. So "declared but unbuilt" is now **two** conditions: opens with a pending marker
**and** names no resolvable path. That also fixes a second, quieter thing — an impl cell reading
`— (owed)` used to fall through the pending branch and be counted as **implemented**, inflating
the 94%.

## Contracts touched

None. `comms/BOARD.md`'s "Spec coverage" section gains a paragraph recording what this gate can
and cannot observe; ADR-013 is unchanged and still describes the gate correctly.

## Verification

```
node scripts/check-spec-coverage.mjs      exit 0 · 671 reqs · 634 (94%) · 37 unbuilt · 16 warns
node --test scripts/__tests__/spec-coverage.test.mjs   7 pass / 0 fail
npm test                                  153 tests · 151 pass · 1 fail · 1 skip
```

Every figure is **identical to the reviewer's pre-fix run**. That is the honest headline: the
fix changed what the gate *can* catch and changed no number, because the table was clean.

The one `npm test` failure is `rtl-pdpl.test.mjs` — *"catalogue too small: undefined"* — from
`rtl-arabic-pdpl-specialist` editing `scripts/check-rtl.mjs`, `strings.en.ts` and `strings.ar.ts`
**concurrently, in flight on blocking items 2/3b/3c**. It is churn from a moving tree, not a
finding, and it is theirs. Confirmed not mine: my change touches `check-spec-coverage.mjs` only.

Four probes, each planted, observed, removed, and the tree re-verified clean (`comms/specs/`
does not appear in `git status --porcelain` afterwards):

| Probe | Before | After |
|---|---|---|
| REQ-DRW-01 Test → `JobDrawer.NOPE.test.tsx` | exit 0, silent | **exit 1, FAIL** |
| REQ-DRW-03 Test → `— (owed)` | exit 0, silent | exit 0, **warn** |
| REQ-DRW-01 Test → prose with a URL route and a bare filename | exit 0 | exit 0 — **prose stays prose** |
| REQ-INF-57 Impl → `nosuchroot.json` | exit 1, FAIL | exit 1, FAIL — **no regression** |

## Deliberately not done

- **The other eight things this gate reports that it cannot observe.** Found while answering the
  reviewer's question, all falsified in a sandbox, all left as findings with owners rather than
  fixed in a session scoped to 3a. They are recorded on BOARD under *Spec coverage* and messaged
  to their owners. Three matter most: a requirement may cite a **spec section that does not
  exist** (`§9.9`, `§2.5.9` — the exact parallel of the path bug, on the section column); a spec
  may pass with a `## Coverage` heading and **zero rows**; and the BOARD ownership cross-check
  **degrades to warnings** if the "Spec coverage" heading is ever renamed.
- **Fixing the 16 warns.** They are `runner-engineer`'s (11), `shell-navigation-engineer`'s (2),
  `observability-engineer`'s and `rtl-arabic-pdpl-specialist`'s. Unchanged in count by this fix.
- **Making warnings fail the build.** The gate exits on `errors.length` only. Changing that is a
  policy decision with 16 immediate consequences and belongs to whoever owes them, not to a
  gate fix.
- **Anything in Part Two.** ADR-013 keeps the gate pointed at the spec of record; `Plan §9`-style
  ids still would not parse and are still deliberately absent from the machine-checked table.

## Next agent

`fidelity-qa-reviewer` — re-run `npm run validate:coverage` and `node --test
scripts/__tests__/spec-coverage.test.mjs` at a still tree, and read the *judgement* table above
first: the question that decides whether this fix is right is not "does it go red", it is
"which forms did it decide are path-shaped".
