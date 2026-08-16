---
agent: design-system-guardian
milestone: M15
spec: PART I · §1.3 · §1.4 — `Plan §10` · `Plan §23.6` · ADR-014 · contract design-tokens.md §10
created: 2026-08-17T00:50
status: ready-for-review
---

# M15 — the provenance badge

The one M15 slice on BOARD with no owner. Built as a primitive and handed to its four consumers;
**I mounted it nowhere**, because the drawer header, `JobCard`, the MAP node and the switcher
belong to four other agents.

## What exists now

| Path | What it is |
|---|---|
| `apps/web/src/components/primitives/ProvenanceBadge.tsx` | The primitive. Five states, three channels, zero colour. |
| `apps/web/src/components/primitives/ProvenanceBadge.test.tsx` | 10 tests. Mutation-checked. |
| `apps/web/src/components/primitives/index.ts` | Ninth export — the count moved on a written decision. |
| `apps/web/src/i18n/strings.en.ts` · `strings.ar.ts` | 10 keys, `provenance.badge.*` + `a11y.provenance.*`. |
| `comms/contracts/design-tokens.md` §10 | The grammar, the departure, and the two rulings. |

```tsx
<ProvenanceBadge state="drifted" commit="a1b2c3" parent="global/sales/database-mining" />
<ProvenanceBadge state="global" size="sm" />   // mark only; accessible sentence unchanged
```

## The visual grammar, and how six states became five

**Five, not six.** The sixth candidate was `excluded`, and it is ruled out below.

Three channels, and every state differs from every other on **at least two**, so none is
load-bearing alone:

| State | Mark | Modifier | Text |
|---|---|---|---|
| `global` | house | — | `--ivory-2` |
| `project` | square with a solid core | — | `--ivory-2` |
| `fork` | fork, both arms intact | — | `--ivory-2` |
| `drifted` | fork | parent arm ends in a **hollow ring** | `--ivory` |
| `orphaned` | fork | parent arm **severed** | `--ivory` |

1. **Silhouette, not hue.** Survives greyscale, 12px, and `size="sm"` where the mark is the only
   thing on screen.
2. **Hollow, never filled.** `Chip`'s dot is filled and `Chip`'s dot is data ink — so **fill is
   now itself a signal in this product**: filled means status, hollow means provenance. That
   reading outlives this badge and should be extended rather than re-decided.
3. **Weight as severity.** Settled at `--ivory-2`, warnings at `--ivory` — §9.4b pointed at
   chrome: open the gap from above, never by pushing the quiet state into `--ink-3`.

**Hatching was never in the running** — `Plan §23.3` makes it CHART's exclusive empty-cell signal
and borrowing it would collapse a distinction the plan draws on purpose.

## The three decisions

**1. Drift is monochrome — a departure from `Plan §10`, taken in writing.** The plan says drift
shows a staleness dot *"the same honesty rule as connector health"*. The honesty rule is adopted
in full; the visual register is not. Connector health is the status of a running thing and is
data ink (§1.3). **A drifted fork is not unhealthy** — it runs, it is a complete file, and
ADR-014 §4.4 keeps even an *orphaned* one working. Colouring it would file "your parent library
moved on" in the same drawer as "approval pending". Recorded in §10.2; ADR number requested, not
taken.

**2. Exclusions are not this primitive.** ADR-014 §7.4 is right that they must reach a human —
*"a project maintainer never reads the coordinator's console"* — and they are still not a badge
state. An excluded `(department, slug)` has no resolved agent, so there is nothing to decorate,
and an agent-shaped row wearing an "excluded" badge is a **plausible presence where the truth is
absence** — BOARD rule 9 in the one direction it never permits. The register flips, and that is
the half worth keeping:

> **Provenance is chrome and is grey. Exclusion is a status and is coloured.** If you see colour,
> something is wrong. If you see grey, something is merely *from* somewhere.

Exclusion surfaces belong to `map-galaxy-engineer` (MAP) and `shell-navigation-engineer`
(switcher), built from `Chip tone="warn"` + an honest empty state naming layer and path. **No new
primitive, and none is coming** — both were told, and both were told to push back rather than
route around me.

**3. It is the ninth primitive.** `index.ts` says that is a decision-request; I am the recipient,
so it is recorded rather than assumed. The obvious host was `Chip` — and that is exactly why it
could not go there. **The reason it is a separate component is the reason it exists.**

## The measured detail: the plan's glyphs are not in our font

`Plan §10` writes the marks as characters — `⌂` U+2302 · `▣` U+25A3 · `⑂` U+2442. Checked at
`4e0bbe6` against the **79 CSS files `@fontsource/plus-jakarta-sans` actually ships: all three
fall outside every one of its 825 `unicode-range` declarations.** Typing them would not request
our webfont at all — the browser falls back to whatever the host OS has, and U+2442 is missing
outright on many systems, which renders the fork as tofu. BOARD constraint 7 forbids external
font requests; a glyph that silently leaves our type system is the same defect one layer down,
and it is invisible on the developer's own machine. So the marks are inline SVG on
`currentColor`. The characters are the plan's *notation*, not its implementation.

## Contracts touched

`comms/contracts/design-tokens.md` §10 — mine. Nothing else. `agent-cascade.md` and ADR-014 are
**read and rendered, never re-opened**: the three fork states, the computed-not-stored staleness
and the excluded-with-a-reason rule are all `agent-library-curator`'s and I have taken them as
given.

Catalogue keys were added to `rtl-arabic-pdpl-specialist`'s files as `todo()` gaps and **they
translated all ten within the hour**, then fixed the `i18n.test.ts` lock my todos had turned red.
That is the mechanism working exactly as its own header promises, and it is why I did not coin
Arabic for five terms of art myself.

## Deliberately not done

- **Not mounted anywhere.** Four consumers own four surfaces. A broadcast tells each where and
  with which `size`; `shell-navigation-engineer` got a separate message because theirs is a
  design conflict rather than a notice.
- **No sixth `excluded` state**, and no exclusion primitive. Ruled, with the reason, above.
- **No ADR number taken.** Two are now requested (§9.7b at 23:59, §10 at 00:45). The register
  says the orchestrator allocates and 012 is vacant because two agents once computed "next free"
  in the same minute — with six agents live tonight, that minute exists.
- **No motion.** A pulsing badge reads as *alive*, and alive is copper's one word (§1.3).
- **No `promote` / `fork` affordance.** `Plan §10`'s three moves are actions on a roster, not a
  badge; the badge reports, it does not offer.
- **The commit's inner bidi isolation is unresolved and routed.** The label is wrapped in `<bdi>`
  so the badge cannot reorder against a neighbour; whether the SHA *inside* an Arabic label needs
  its own isolation is `rtl-arabic-pdpl-specialist`'s, because the clean fix is an isolation mark
  inside their catalogue string and splitting it out would break their rule 2.
- **Whether the switcher shows provenance once or per row** is `shell-navigation-engineer`'s
  information-architecture call, asked rather than assumed.

## Verification

| Gate | Result |
|---|---|
| `ProvenanceBadge.test.tsx` | 10/10 |
| `i18n.test.ts` | 14/14 at the tree carrying the Arabic |
| `npm run typecheck` | clean |
| `node scripts/check-tokens.mjs` | 299 files, **0 violations**, 2 exemptions (both `Chip`) |
| `node scripts/check-rtl.mjs` | no hit against `ProvenanceBadge.tsx` — no string in it is hardcoded |

**The distinctness test was too weak, and I only know that because I mutated it.** The first
version asserted five distinct mark strings. A mutation making `orphaned` draw the intact parent
arm *as well as* the severed one **passed** — two different strings, assertion satisfied, while
the mark had quietly become "fork plus a stroke" and the pair was confusable at 12px. The
property actually meant is **non-containment**: no state's mark may be another's with extra
strokes on top. Re-run under the same mutation:

```
✖ fork's mark is contained in orphaned's — at size="sm" the mark is the whole signal,
  and a mark that is another mark plus a stroke is not a different silhouette.
```

Reverted; the assertion is redraw-tolerant, so the marks can be redrawn freely.

**Provenance line (§8b):**

```
Token discipline
  scanned at        2026-08-17 00:13 +03:00 · 4e0bbe6 · 58 uncommitted under apps/web
  files scanned     299
  violations        0
```

**Read that line, not the number.** 299 files where my scan two hours earlier saw 291, and 58
uncommitted paths: six agents are landing M15 work into this tree. `npm run test:web` has three
red files that are **not mine and not regressions** — `MapView` fails on a missing `usePathname`
in a `next/navigation` mock and `ViewTabs`/`SearchPill` expect pre-project routes, all of which
is shell/map project-segment work in flight. Reported so a red suite tonight is not mistaken for
a defect in anyone's finished work.

## Next agent

`fidelity-qa-reviewer` — re-review filed. The thing to press is §10.2: I departed from a document
and wrote it down, and you should decide whether the write-down is sufficient or whether the ADR
must land before consumers mount it. Then the four consumers, and
`commandcenter-orchestrator` for two ADR rows.
