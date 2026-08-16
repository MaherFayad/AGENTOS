---
agent: design-system-guardian
milestone: M1
spec: PART I, §1.1, §1.2, §1.3, §1.4, §1.6, §2.3.9, Part VI, Part VII.3
created: 2026-08-16T21:20
status: ready-for-review
---

# The count-up that painted a negative number, and the ruling on empty-state prose

Two items from `M1-fidelity-qa-reviewer-review-queue-burndown.md`: the M6 `KpiNumeral`
defect (mine to fix) and the M2+M6 `--ink-3` finding (mine to rule on, not to patch).

## 1. `KpiNumeral` — a fabricated number, not a flaky test

**Correcting the record first, because the wrong diagnosis is still sitting in my inbox.**
This was routed to me at 15:55 by `shell-navigation-engineer` as *"flaky under parallel
load"*. It is not flaky and it is not load-related. It is a missing lower clamp and it
reproduces in isolation, deterministically, on a quiet machine.
`fidelity-qa-reviewer` corrected the record at 20:47 and their diagnosis was exactly right,
down to the mechanism. The earlier framing would have sent me hunting a race condition in a
component that does not have one. `comms/inbox/design-system-guardian/20260816-1310-orchestrator-kpinumeral-test-is-load-flaky.md`
already carries the orchestrator's own 14:35 correction; it is now closed as superseded.

### The mechanism

`KpiNumeral.tsx:85` was `Math.min(1, (now - start) / DURATION.countUp)`. `start` came from
`performance.now()`; `now` came from the rAF callback. **Two clocks, different time origins.**
jsdom skews them by ~845ms. `t` went to about −40, `easeOut(t) = 1 − (1−t)³` cubed it to
about −73500, and the tile painted `22 × −73513 = −1617290`.

The clamp bounded the top and nothing bounded the bottom. `easeOut` is only meaningful on
[0,1]; the code fed it a domain it was never defined for.

### The fix — both halves, because they fix different things

`apps/web/src/components/primitives/KpiNumeral.tsx`

1. **`start` is seeded from the first rAF timestamp**, not `performance.now()`. One clock, so
   `now - start` cannot be negative at all. This removes the cause.
2. **`clamp01(t)` replaces `Math.min(1, t)`.** This bounds the symptom regardless of where the
   timestamps come from, and it is the invariant that keeps the next edit honest.

The reviewer offered these as alternatives ("either one, I have no preference"). I took both:
(1) is the correct fix and (2) is the guard rail. A count-up that overshoots its own endpoints
is the bug *class*, and clamping without pinning the invariant leaves it free to come back.

Seeding from the rAF clock also fixes the second signature the orchestrator reported — the
count climbing to exactly `21` and stopping. With the clocks disagreeing, `t` never reached 1,
so `from.current = b` never ran and the final frame never landed.

### Why this was worth more than a red test

`KpiTile` is the only consumer. A KPI tile that paints `-1617290` for a frame has **fabricated
a number** on the most credible surface in the product — BOARD rule 9 / Part VII.3 — while the
file's own docstring promised *"the end state is always the truth."* The docstring now states
the invariant explicitly and tells the next reader not to weaken the test to a happy path.

### The regression test

`apps/web/src/components/primitives/KpiNumeral.test.tsx` — three new tests, 6 → 9.

The reviewer asked for an assertion that `shown` never leaves `[min(a,b), max(a,b)]`. That is
what these assert, and they assert it **against a deliberately skewed clock** rather than
hoping the machine reproduces the skew:

- `driveFrames()` stubs `requestAnimationFrame` into a queue and hands back a `step(stamp)`,
  so a test chooses the rAF timestamp instead of racing the wall clock.
- **"never paints outside [from, to], even when the rAF clock trails performance.now"** —
  pins `performance.now()` to `1061.6` and feeds rAF timestamps from `216.84`, the exact
  ~845ms skew the reviewer measured. Captures every interpolated value through the `format`
  callback (not `textContent`, which rounds and would hide a 22.4 overshoot) and asserts the
  set of out-of-range values is empty.
- **"lands exactly on the target rather than one short of it"** — the `'21'` signature.
- **"counts down without dipping below the target"** — the same invariant on a descending
  count (10 → 4), which no test covered and which the clamp also protects.

**Proof the test catches the bug, not just the fix.** I reverted the component to its exact
original form and re-ran:

```
× starts at zero and lands on the value          expected '-413' to be '22'
× never paints outside [from, to]…               expected [ -1200.3687950565873, …(24) ] to deeply equal []
× lands exactly on the target…                   expected '-5334' to be '22'
× counts down without dipping below the target   expected [ -4961.535383082888, …(25) ] to deeply equal []
Tests  4 failed | 5 passed (9)
```

Then restored. A regression test that has never been seen to fail is a decoration.

`DURATION.countUp` is imported from `motion.ts` in both component and test. No duration
number is typed anywhere else; `check-tokens.mjs` confirms.

## 2. The ruling — `--ink-3` is never required reading

`comms/contracts/design-tokens.md` **§9**, new, ~70 lines. Broadcast at
`comms/inbox/_all/20260816-2109-design-system-guardian-ink3-is-never-required-reading.md`.

> **Any text the reader must read in order to understand the screen is `--ink-2` or
> brighter. `--ink-3` is never required reading.**

**It is a general rule, not an answer to this bug.** The reviewer found the defect in three
files written by three agents who had never spoken. That is not three mistakes; it is a
missing rule, and a fix for the three instances would not have prevented the fourth. §9 gives
every text token a role, a measured floor and a list of what it may and may not carry, plus a
decision procedure — *delete the text; if the reader now misunderstands the screen or believes
a number that is not true, it is required reading* — so the next case is answerable without
re-measuring or asking me.

### The measurements

WCAG 2.1 against all eight surface tokens in both themes (alpha surfaces composited over
`--bg`). Worst case is `--card-2` in every row. This product ships no text at 18.66px+, so
the large-text 3:1 exemption never applies — there is no size at which `--ink-3` carries
meaning legibly.

| Token | Dark | Light | AA at 11–16px |
|---|---|---|---|
| `--ivory` | 14.25 – 17.16 | 15.18 – 18.07 | AAA everywhere |
| `--ivory-2` | 7.98 – 9.60 | 7.14 – 8.51 | AAA everywhere |
| `--ink-2` | 4.53 – 5.46 | 4.25 – 5.05 | passes, except light `--bg-2` 4.28 / `--card-2` 4.25 |
| `--ink-3` | 3.18 – 3.83 | 2.77 – 3.29 | **fails on every surface, both themes** |

### Why `--ink-2` and not `--ivory-2`, and why no new token

I considered `--ivory-2` for its AAA margin and rejected it on design grounds: an empty state
at secondary-text weight becomes the **loudest** element in a KPI row, so an absent value
out-shouts the tiles that have real ones. Rule 9 asks the empty state to be honest, not loud.
`--ink-2` sits at the weight of the label beside it and one rung below any real value — present
data first, honest absence second, decoration third.

**No new token, deliberately.** A semantic alias (`--muted`, `--prose`) was the obvious move
and I talked myself out of it. It would buy a self-documenting name and nothing else: no
checker can distinguish "a sentence the reader needs" from "a decorative glyph", so the alias
could not be *enforced*, and an unenforceable second name for an existing value just gives
future authors two things to choose between by eye — which is the failure mode that produced
this bug. The rule prevents recurrence; a name would not. `text-ivory-2` / `text-ink-2` /
`text-ink-3` already exist and already work.

### Reconciliation — what the two owners actually landed

**`drawer-engineer` — ratified, no changes asked for on the main finding.** They had already
moved `.empty`, `.sectionNote` and `.consoleTrimmed` to `--ink-2` before my ruling published,
with the measurements written into the CSS comment, and added
`apps/web/src/drawer/drawer-contrast.test.ts` — an allowlist where every surviving `--ink-3`
costs you a written reason. That is the right shape for a rule a static checker cannot reach,
and it is better than anything I asked for.

Two of their four allowlist entries do not survive §9, and they explicitly asked me to rule on
one of them. Correction routed at
`comms/inbox/drawer-engineer/20260816-2112-design-system-guardian-ink3-ruling-two-corrections.md`:

- **`.ladderLabel` — ratified at `--ink-3`.** Spec §2.3.9 (line 156) names the token in words:
  *"active row ivory, others `--ink-3`"*. The spec wins, and it is also §9.3's legitimate
  "redundant with its own position" case — a fixed triad in a fixed order where the dimming is
  the meaning.
- **`.ladderText` → `--ink-2`.** §2.3.9 prescribes the token for the row *label* and then says
  only *"12px explanation each"* — **it names no token for the explanation.** So there is no
  spec to defer to, and §9.2 makes a sentence required reading. The inactive rungs are the ones
  the reader consults the ladder to learn about; rendering them at 3.57:1 makes the comparison
  the component exists for the least legible thing in it. Active stays `--ivory-2`, so the rung
  hierarchy is untouched.
- **`.runMetaAbsent` ("unpriced") → `--ink-2`.** This is the same sentence as the finding that
  started the ruling: a provenance caveat saying the money column is a floor, not a total.
  Delete-the-text test — remove it and the reader cannot tell "cost nothing" from "never
  measured". Their design reason (must read dimmer than the dollar amounts) is satisfied at
  `--ink-2`, since the amounts are `--ivory` at 15.98:1. The correction costs them nothing.
- **`.control::placeholder` — ratified at `--ink-3`.** §9.3 names it; every INPUTS field has a
  real `<label>`.

**`dashboards-engineer` — nothing landed yet**, which is why I published before reconciling
rather than after. Ruling routed at
`comms/inbox/dashboards-engineer/20260816-2113-design-system-guardian-ink3-ruling.md`, and
**the scope is wider than the review said**: the reviewer named `.emptyLine` and
`KpiTile.tsx:39`, but the same class appears at ten more sites they did not enumerate —
`ActivityFeed:16`, `AreaChart:43,77`, `BarList:21,40`, `CostTable:13,22`, `DataTable:33`,
`ProgressTable:15,35`, `dashboards.module.css:234,317,363,369`. Fixing the two named lines
would have left twelve. I left them one genuine judgement call (`—` for a null reading) with a
stated preference and asked them to record the answer either way.

## 3. My own checker was failing on a peer's correct work

`node scripts/check-tokens.mjs` went **red on `drawer-contrast.test.ts`** — three
`no-theme-branch` hits on `theme === 'dark'` and two `body.light` slices. All three are the
test doing its job: you cannot assert a token's contrast in both themes without naming both
themes. `check-tokens.mjs` is my file and this was my false positive, blocking
`npm run verify` for everyone.

Fixed at the rule, not with an exemption. `no-theme-branch` now skips `*.test.*` / `*.spec.*`
files. This generalizes an intent already hardcoded in the file (`theme.ts` / `theme.test.ts`
were already paired exemptions) and loses nothing: a real theme branch must exist in a
component before a test can assert it, and the component file is still checked. Deliberately
narrow — tests remain subject to every other rule, including `no-hex`.

Telling `drawer-engineer` to add `token-exempt-file:` instead would have been wrong twice: it
is not a violation, and a whole-file exemption would also have silenced the hex rule on a file
that legitimately parses hex values out of `tokens.css`.

## What exists now

- `apps/web/src/components/primitives/KpiNumeral.tsx` — clamp + rAF-clock seed + the invariant
  stated in the docstring.
- `apps/web/src/components/primitives/KpiNumeral.test.tsx` — 9 tests, 3 new.
- `comms/contracts/design-tokens.md` — new **§9** (9.1 measurements, 9.2 the rule, 9.3 role
  table, 9.4 the rejected alternative, 9.5 the known gap, 9.6 why it is review-enforced), and
  a pointer from §8's utility index.
- `scripts/check-tokens.mjs` — `no-theme-branch` no longer fires on test files.
- Three messages: the `_all` ruling, the `drawer-engineer` correction, the
  `dashboards-engineer` ruling.

## How to use it

Picking a text colour: read contract §9.3. Sentences → `text-ink-2` or brighter.
Decorations, placeholders, disabled controls → `text-ink-3`. When unsure, delete the text and
see whether the reader is now misinformed.

## Contracts touched

`comms/contracts/design-tokens.md` — **I own it; §9 added, no existing value changed.** No ADR
required: §9 rules on how existing tokens are *applied*. Every §1.1/§1.2 value is still the
verbatim spec transcription. The one change that *would* need an ADR is in
*Deliberately not done*.

## Deliberately not done

1. **Light `--ink-2` still fails AA on `--bg-2` (4.28:1) and `--card-2` (4.25:1)** — ~5% short.
   The clean fix is to darken `#6E6E76` by about four units, imperceptibly. I did not do it:
   that value is transcribed **verbatim from §1.2 of the spec of record**, changing it needs an
   ADR, and a bug fix is not allowed to smuggle an ADR in under cover. Recorded as a printed
   carve-out in §9.5 with the binding consequence (required prose must not sit on those two
   surfaces; in practice, no empty state inside a `Card interactive`, which swaps fill on
   hover). **Open and unowned — this is the item most likely to be forgotten.**
2. **I did not edit `drawer/**` or `dashboards/**`.** Not mine. Both owners have the ruling in
   writing; drawer has two specific corrections pending and dashboards has fourteen sites. If
   either diverges, that is a second reconciliation, not something I should pre-empt by
   patching their files.
3. **§9 is not machine-enforced, and §9.6 says so out loud rather than implying a check that
   does not exist.** `var(--ink-3)` is a legal token reference; the violation is semantic. I
   considered a heuristic (flag `text-ink-3` on any element with a text child longer than N
   characters) and rejected it — it would false-positive on every legitimate use in §9.3 and
   train people to write exemptions, which is worse than a rule enforced by reading.
   `drawer-contrast.test.ts`'s per-module allowlist is the better pattern and I have
   recommended it to `dashboards-engineer` rather than building a global version speculatively.
4. **The 14 dashboards sites and the 2 drawer corrections are not verified as landed.** I ruled
   and routed; the owners implement. Re-reconciliation is a follow-up, and I have said so in
   my status rather than claiming a close I cannot see.
5. **`text-kpi-sm` still embeds `font-weight: 600` and `letter-spacing: -0.01em` in a size
   token**, which callers then fight (`FocusRotator.tsx:38` overrides both). The reviewer has
   now raised this twice. It is real and it is mine, but unpicking a size token that ~40 call
   sites depend on is a change with a blast radius, not a drive-by during a FAIL fix. Not done,
   not forgotten, still open.
6. **`THEME_INIT_SCRIPT` is still not wired into `layout.tsx`**, so first visit flashes the
   wrong theme (§1.2). `infra-compose-engineer` routed it to `shell-navigation-engineer` at
   20:53. The export exists and is tested; the gap is one line in a file that is not mine. Not
   re-routed by me — it already has an owner and a second nudge would just add noise.
7. **No 1440px screenshot.** Same hole the reviewer recorded: there is no headless browser in
   this repo. Both items here are source-level and neither changes layout, but I am not
   implying a visual diff I could not run.

## Verification

```
node scripts/check-tokens.mjs            288 files, 0 violations, 2 exemptions (both Chip, both correct)
vitest run (apps/web)                    54 files, 392 tests, 392 pass    [was 375/376]
node --test scripts/__tests__/*.mjs      88 pass, 0 fail  (incl. "no hex colour outside the token file")
vitest run KpiNumeral.test.tsx           9 pass
  ↳ same file against the pre-fix component:  4 fail / 5 pass   ← the test earns its place
```

The single red test in `apps/web` is now green, and it is green because the component is
correct, not because the assertion was loosened. `KpiNumeral.test.tsx:44`'s exact
`toBe('0')` and `:45`'s exact `toBe('22')` both survive untouched — the orchestrator was right
that loosening them to `toBeLessThan(22)` would have hidden a real defect.

## Next agent

`fidelity-qa-reviewer` — re-review request at
`comms/inbox/fidelity-qa-reviewer/20260816-2120-design-system-guardian-rereview-countup-and-ink3.md`.
First thing to read: §2's reconciliation table above, then contract §9.

Then `dashboards-engineer`, who has the largest remaining share of the `--ink-3` work and has
not started it. Their M6 FAIL had two findings; the `KpiNumeral` half is cleared here, and the
other half is now a ruling they can implement rather than a question they have to ask.

---

# Addendum, 21:50 — §9 was right and its reasons were wrong

Two follow-ups from the coordinator after §9 passed re-review. Both are consequences of §9,
not complaints about it, and both are corrections to **me**.

## 4. `.runMeta` re-ruled — I was wrong twice, not once

**Error 1**, caught by `fidelity-qa-reviewer` and `drawer-engineer` independently. My 21:12
message and §9.4 both justified the ruling with *"the dollar amounts are `--ivory` at
15.98:1"* and *"`--ink-2` … one rung below any real value."* `drawer.module.css:537-541` shows
`.runMeta` is **`--ink-2`**, so moving the caveat to `--ink-2` flattened it against the figures
— the exact outcome I was arguing against.

**Error 2**, which I found re-measuring and neither review caught. I told `drawer-engineer`
*"your drawer does not do that today"* about prose on `--card-2`.
`drawer.module.css:524-526` is `.runRow:hover { background: var(--card-2); }`. The run row
**is** the `Card interactive` pattern; `--ink-2` on it is **4.25:1 in light while hovered**.

**Re-ruling** — direction accepted from `drawer-engineer` (raise the value, don't lower the
caveat), extended one rung because of the hover surface: `.runMeta` → `--ivory`,
`.runMetaAbsent` → `--ivory-2`. AAA in every state of both themes, ~2× rung gap preserved.
Routed at `comms/inbox/drawer-engineer/20260816-2145-design-system-guardian-runmeta-rerule.md`.
Their file, their landing.

**The general rules extracted**, because a rule prevents the next instance and a fix does not:

> **§9.4a** — A caveat sits one rung below the value it qualifies.
> **§9.4b** — When that collides with the AA floor, **raise the value; never lower the
> caveat.** The caveat is required reading and cannot go below AA, so the gap opens from above.

**The drafting rule, which is the real lesson.** Both errors are one mistake: I measured
*tokens* correctly and then asserted things about *call sites* I had not opened. §9.4 now says:

> Contract rules state what must be true, not what is observed to be true. Where a rule cites
> a measurement, the measurement is of a **token**, never of a call site — token values are
> stable and checkable, call sites drift.

Both corrections are **visible correction notes** in the contract, not silent edits. A contract
that quietly rewrites its own reasoning is worse than one that was wrong out loud, because §9's
whole value is that people cite it instead of re-measuring.

**§9.5 corrected too:** `--card-2` is the standard hover fill for every interactive row in the
product, so the carve-out is the common case, not the exotic one. Broadcast at
`comms/inbox/_all/20260816-2147-design-system-guardian-s9-correction-hover-surfaces.md` —
sent urgently because `dashboards-engineer` is mid-implementation against the wrong version.

## 5. ADR-011 filed — the deferral had to stop deferring

`comms/decisions/ADR-011-light-ink-2-aa-floor.md`, **proposed**: darken light `--ink-2` from
`#6E6E76` to `#6A6A72`. Clears 4.5:1 on every light surface (worst case `--card-2`, 4.503:1);
a four-unit shift nobody will see; dark untouched, so the Part VI dark-theme screenshot is
unaffected.

I deferred this at 21:20 on correct grounds — a bug fix must not smuggle in a change to a
verbatim §1.2 value. Within twenty minutes it forced a second contorted per-site ruling. A
constraint that bends two rulings in one session wants deciding, not deferring a third time,
and an ADR is the sanctioned mechanism. Filed as `proposed`, not applied: `tokens.css` still
carries `#6E6E76` and `tokens.test.ts` still pins it, which is the guard that keeps this
ADR-gated rather than a typo.

**Number yielded.** I took 010; `commandcenter-orchestrator` filed an `accepted` ADR-010 two
minutes later. Theirs is accepted and may already be cited, mine was `proposed` and referenced
only from files I own, so I renumbered to 011.

## 6. `check-comms.mjs` — fixed at the rule, in both directions

It was failing four correctly-answered messages and taking `npm run verify` down before it
reached a single test. `/^##\s+Answer\s*$/m` was wrong **twice**:

- **Too strict** — rejected `## Answer — design-system-guardian, 2026-08-16T21:22`. Attributing
  and dating an answer is the *better* form on a long thread, so the check failed the good
  version and passed the lazy one.
- **Too loose** — `comms/templates/message.md` ends with a bare `## Answer` and nothing under
  it. Copy the template, flip `status: answered`, write nothing, and it passed. That is the
  actual protocol violation the rule exists to catch, and it could not see it.

Now: any `## Answer` heading with optional attribution is accepted, **and** the body beneath it
must be non-empty (horizontal rules and HTML comments don't count). The two failure messages
are distinct and each names its fix. `scripts/__tests__/check-comms.test.mjs` — 7 tests — pins
both directions, including the exact regression shape.

**One genuine violation remained after the rule fix, and it was mine**: I had marked the `_all`
broadcast `answered`, but a ruling I authored has no answerer. Set to `open` — it stays open
until `dashboards-engineer` lands. The improved checker isolating that one from the three false
positives is exactly what it is for.

A separate message in `infra-compose-engineer`'s inbox had the same defect and is
`runner-engineer`'s file, not mine to edit — routed at
`comms/inbox/runner-engineer/20260816-2150-design-system-guardian-answered-with-no-answer.md`.
It has since been resolved; `check-comms` exits 0.

## Deliberately not done (addendum)

8. **I did not edit `drawer.module.css`** to land the re-ruling, or the comment in it that
   quotes my false measurement. Still `drawer-engineer`'s file. Asked, not patched.
9. **I did not check `.ladderRow` / `.control` hover fills** and explicitly said so in the
   message rather than guessing. Guessing at their call sites is what caused both errors above;
   doing it a third time to save them a grep would be the same mistake with more confidence.
10. **ADR-011 is not applied.** Proposed only. `dashboards-engineer` and `drawer-engineer` are
    both unblocked without it (§9.4b resolves every live case), so applying it mid-flight would
    change a token under two agents who are actively editing against it.
11. **I did not promote `drawer-contrast.test.ts`'s allowlist pattern into the contract as a
    required pattern**, though the reviewer recommended it and I agree it is what makes §9
    self-enforcing rather than self-reported. Recommended to `dashboards-engineer` as a
    suggestion. Mandating a *test file shape* across modules I don't own is a bigger call than a
    token ruling — it belongs in an ADR with the affected owners' input, not in a contract edit
    made while they are mid-implementation. Open, and I think it should happen.

## Verification (addendum)

```
node scripts/check-comms.mjs              EXIT 0   (was 1, blocking verify for everyone)
node scripts/check-tokens.mjs             EXIT 0   288 files, 0 violations
node --test scripts/__tests__/*.test.mjs  98 pass, 0 fail  (check-comms.test.mjs 7/7, new)
vitest run (apps/web)                     55 files, 397 tests, 397 pass
```

---

# Addendum 2, 22:05 — "two instruments disagree by 31" was one instrument disagreeing with itself

## 7. There is exactly one token instrument

`npm run validate:tokens` **is** `node scripts/check-tokens.mjs` (root `package.json`). Same
script, same process. I searched every `.mjs`/`.ts`/`.js` under `scripts/` and `apps/web` and
all four `package.json` files: nothing else implements a token rule, and `apps/web` has no
`validate:*` script at all. The two numbers were one instrument run twice, hours apart.

**What the 31 were.** `no-type-literal` on `font-size:` / `letter-spacing:` literals in
`drawer.module.css`, mid-cleanup. Reproduced by running today's checker against each
historical revision of that one file with everything else held at the current tree:

| `drawer.module.css` | violations | rule |
|---|---|---|
| `afb94e6` | 37 | `no-type-literal` |
| `f968207` | 38 | `no-type-literal` |
| `25896d8` | 37 | `no-type-literal` |
| `0255269` (HEAD) / working tree | 0 | — |

Samples: `font-size: 14px`, `font-size: 24px`, `letter-spacing: -0.01em`. Those exact
declarations are `var(--drw-fs-title)` / `var(--drw-fs-rung)` today (`drawer.module.css:65`+).
The count decayed 38 → 37 → … → **31** → … → 0 as the `--drw-fs-*` tokens landed. **31 was a
true reading of a state that no longer exists.** Neither instrument was blind and neither was
crying wolf.

## 8. The real defect, and it is mine

Two agents ran the same command, got 0 and 31, and **could not tell that the difference was
time rather than tooling**, because the checker printed no identity for what it scanned — no
commit, no dirty flag, no timestamp. That is the fourth instance today of a checker being
wrong *about the thing it gates*, and it is the silent direction: a stale FAIL gets
investigated, a **stale PASS gets cited**. Two milestones flipped today partly on token
results nobody could date.

Fixed, not by retiring a loser (there was none) but by making the result reproducible:

```
Token discipline
  scanned at        2026-08-16 18:53 · 56e93cf · 24 uncommitted under apps/web
  files scanned     288
  violations        0
```

- `scripts/lib/provenance.mjs` — timestamp · short HEAD · uncommitted count **for the scanned
  scope only**, since only that can invalidate the result. Zero dependencies; no `.git`
  degrades to a dated line rather than throwing, because these run on fresh clones and in CI
  before install.
- Wired into `check-tokens.mjs` (`apps/web`) and `check-comms.mjs` (`comms`), human output and
  `--json` alike.
- `scripts/__tests__/provenance.test.mjs` — 5 tests incl. the no-git path and a real temp repo
  going clean → dirty.
- Contract §8b now states there is exactly one token instrument, shows the banner, records the
  incident, and requires the `scanned at` line to be quoted whenever a token result is cited.
  **A count without it is not evidence.**

## Deliberately not done (addendum 2)

12. **Provenance is not in `check-rtl.mjs`, `validate-panels.mjs`, `check-spec-coverage.mjs`
    or `check-metrics.mjs`.** The argument applies identically to all four and I think they
    should adopt it — the helper is a two-line import — but three belong to other agents and
    I am not editing four scripts I do not own on the strength of my own incident. Raised to
    `commandcenter-orchestrator` as worth a broadcast; not issued unprompted.
13. **`node scripts/check-rtl.mjs` exits 1** — user-facing strings outside the catalogue in
    `drawer/sections/*`, `map/chrome/*`, `MapView.tsx`. Not in `verify`, blocks nothing, and
    it is `rtl-arabic-pdpl-specialist`'s (M8, ongoing). Reported, not fixed.
14. **I did not re-date the token results the flipped milestones were gated on.** M1/M2/M5
    passed on results that predate the banner and so cannot be dated retrospectively. I am not
    claiming they were stale — check-tokens is 0 on today's tree, which is the stronger
    statement — only noting that "it was green then" is not recoverable evidence for any run
    before this change.

## Verification (addendum 2)

```
node scripts/check-tokens.mjs             288 files, 0 violations, 2 exemptions   EXIT 0
node scripts/check-comms.mjs              EXIT 0
node --test scripts/__tests__/*.test.mjs  103 pass, 0 fail  (provenance 5 + check-comms 7 new)
vitest run (apps/web)                     55 files, 397 tests, 397 pass
```
