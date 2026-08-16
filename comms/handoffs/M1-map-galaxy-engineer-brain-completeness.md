---
agent: map-galaxy-engineer
milestone: M1
spec: §2.1, §3.3, Part VII.3
created: 2026-08-16T21:14
status: ready-for-review
---

# M1 — the galaxy stops painting 45% over an empty brain

`fidelity-qa-reviewer` failed M1 on one finding
(`comms/inbox/map-galaxy-engineer/20260816-2047-fidelity-qa-reviewer-m1-fail-brain-completeness.md`):
`company/COMPANY.md` is 0 of 20 answered and says so at line 18, and the map rendered the
Second Brain at 45% brightness. `scripts/build-graph.mjs:110-115` counted `## ` headings
— nine of them — and divided by 20. The value was baked into `apps/web/public/graph.json`,
served by `GET /api/graph`, and scaled the §2.1 galaxy's particle count, glow alpha and
core-dot alpha.

**It now reads `0` — `0 of 20 answered`.** The map says so in words.

## What exists now

| Path | What changed |
|---|---|
| `scripts/lib/brain-completeness.mjs` | **New.** The one measurement of §3.3 completeness. Counts `<!-- UNANSWERED: Qn -->` markers. Pure, node builtins only, no `apps/**` imports — so the runner can import it the way its watcher already imports `scripts/lib/layout.mjs`. |
| `scripts/build-graph.mjs` | The heading count is gone. Calls `measureBrainFile`; decides between it and the runner's `company/.brain.json`; prints `0% complete — 0 of 20 answered · company/COMPANY.md`. |
| `scripts/lib/layout.mjs` | `opts.brainAnswered` / `opts.brainTotal` pass through to `core`. Clamped, `null` when unmeasured. The engine still never reads `company/` (ADR-003). |
| `packages/contracts/src/graph.ts` | `GraphCore.brainAnswered?` / `brainTotal?`. |
| `apps/web/src/map/data/parse.ts` | Parses the count; drops one that has no denominator or exceeds it. |
| `apps/web/src/map/data/delta.ts` | A `/ws/graph` `hello` re-derives the count from the new fraction instead of leaving a stale one beside it. |
| `apps/web/src/map/canvas/GalaxyCanvas.tsx` | `drawEmptyDisc` — the zero state's visual half. |
| `apps/web/src/map/svg/BrainEmptyState.tsx` | **New.** The zero state's words, in the SVG layer. |
| `apps/web/src/map/lib/map-type.ts` · `lib/particles.ts` | `BRAIN_EMPTY` sizes; `GALAXY_RADIUS` extracted so the empty disc and the swirl describe the same circle. |
| `apps/web/src/map/MapView.tsx` | Mounts `BrainEmptyState`, galaxy view only. |
| `apps/web/src/map/chrome/EmptyState.tsx` | The literal `§2.1` eyebrow the reviewer flagged as a spec citation leaking into the product → `Map`, and off `--ink-3`. |
| `comms/contracts/graph-layout.md` | New section: *`core` — Second Brain completeness (§3.3)*. Mine to edit. |
| `scripts/__tests__/brain-completeness.test.mjs` · `map/svg/BrainEmptyState.test.tsx` · `map/data/parse.test.ts` | The regression locks. |

### How the number is measured

`answered = 20 − (distinct `Qn` markers left in COMPANY.md)`. Nothing else counts: not
headings (authored once, never move — that is the bug), not prose length (the template's
own instructions are prose: *"Write the rule, not the number: 'day rate × estimated days,
floor 5 days'…"* is 100+ characters of placeholder), not `company/sources/*` (easier to
move than an answer, so it would inflate). §3.3 and
`agents/intelligence/company-interview/SKILL.md` both name the gap list as the honest
completeness signal, and COMPANY.md's header forbids deleting a marker to look finished —
so the markers are the contract, and a file with none warns loudly before reporting 100%.

### What zero looks like, and why it is not a blank canvas

`particleBudget(0)` is 0, so there is no swirl — correct, and previously indistinguishable
from a canvas that failed to paint. Two additions make the emptiness *stated*:

- **Canvas:** a dashed ring at the galaxy radius, `--ivory` at 12%, rotating on the same
  120s clock the swirl would use. A failed render produces nothing; it never produces a
  rotating dotted circle. The rotation is also the proof the rAF loop is alive, and it
  stops under `prefers-reduced-motion` like everything else on this layer.
- **SVG:** three lines under the core — `SECOND BRAIN` / `0 of 20 questions answered` /
  `Run the company interview — the galaxy fills as answers land`. Monochrome
  (`--ink-2`/`--ivory-2`), counter-scaled by the camera so it stays readable at any zoom,
  `pointer-events-none`, and carrying an `aria-label` so the empty brain is announced —
  the canvas is `aria-hidden`, so this is the only accessible statement of it.

Both vanish at the first answered question; from there the swirl carries the signal alone
and nothing sits permanently over the §2.1 centrepiece.

### Two producers cannot silently disagree any more

`apps/runner/src/lib/brain.ts` is the second producer and is **untouched** — it is
`runner-engineer`'s, the finding is routed to them, and a `decision-request` asking them to
adopt the shared module is at
`comms/inbox/runner-engineer/20260816-2114-map-galaxy-engineer-one-brain-counter.md`.

Until then, `build-graph.mjs` honours their `company/.brain.json` snapshot **only when it
does not claim more than the markers admit**; on disagreement it takes the markers and
warns, naming both numbers. The asymmetry is the whole design: a disagreement between two
producers can cost the galaxy brightness, it can never invent it (CLAUDE.md rule 9). And
`core.brainAnswered`/`brainTotal` mean the payload now carries the count behind the
fraction, so `0.45` can no longer sit in an artifact unnoticed — anyone holding the payload
can check `9 of 20` against the file.

## How to use it

```js
import { measureBrainFile } from './lib/brain-completeness.mjs';
const m = await measureBrainFile('company/COMPANY.md', { warn: console.warn });
// { value: 0, answered: 0, total: 20, unanswered: [1…20], source: 'company/COMPANY.md' }
```

```bash
npm run graph:build     # prints: brain 0% complete — 0 of 20 answered · company/COMPANY.md
```

Consumers read `payload.core.brainCompleteness` for the visuals and
`core.brainAnswered` / `core.brainTotal` for anything printed in words. `null` on either
means *not measured* — say so, do not print a zero.

## Contracts touched

- `comms/contracts/graph-layout.md` — **mine**, extended (the `core` section above). No ADR:
  the fields are additive and optional, and the measurement rule is a restatement of §3.3
  rather than a new decision.
- `packages/contracts/src/graph.ts` — the code half of the same contract (ADR-002).
- ADR-003 still holds: one engine, `brainCompleteness` an *input*, never a filesystem read
  inside the solver.

## Deliberately not done

1. **`apps/runner/src/lib/brain.ts` is unfixed.** It is the second producer of the same
   wrong number (`/api/status` → `brain {value:0.45, answered:9, total:20}`) and it is not
   mine. Reaching into it would have been faster and wrong. The shared module plus the
   lower-of-two rule means the *map* is honest either way, but **`GET /api/status` still
   reports 45% until `runner-engineer` answers.** That is the visible remainder of this
   finding, and it belongs on their ledger, not hidden in mine.
2. **The runner's watcher does not pass `brainAnswered`/`brainTotal`.** Two lines in
   `apps/runner/src/lib/watcher.ts:170-177`, their file. Until then a `/ws/graph`-driven
   rebuild emits `null` counts and the map degrades to a sentence without numbers — which
   is the honest degradation, not a wrong one.
3. **No "what is still unanswered" list in the UI.** `measureBrain` returns
   `unanswered: [1…20]` and the drawer could name the outstanding questions on the
   interview node — that is `drawer-engineer`'s §2.3 surface and a real feature, not a
   patch. Not proposed as part of a FAIL fix.
4. **`company/COMPANY.md` was not answered.** The user is answering it for real. The proof
   that the number moves was run on a byte-identical copy and reverted (sha256 verified
   below); nothing was committed.
5. **The 1440px side-by-side was still not run** — no headless browser in this repo, the
   reviewer's own *Deliberately not done* item 1. My change alters the centre of the frame
   in the zero state, so it is exactly the kind of thing that test would judge. It remains
   owed and unowned.
6. **Three new user-facing strings are not in the i18n catalogue** (`Second brain`,
   `n of 20 questions answered`, `Run the company interview…`, plus the `Map` eyebrow that
   replaced `§2.1`). `apps/web/src/i18n/strings.en.ts` is `rtl-arabic-pdpl-specialist`'s
   and needs the Arabic pair written by someone who writes Arabic; no map file uses `t()`
   yet. `check-rtl.mjs` counts one new catalogue miss in `map/`, on top of the four that
   were already there. `fyi` sent.
7. **The empty disc is not in §2.1.** §2.1 describes a full swirl; it says nothing about
   what an unanswered brain looks like, because their demo has a populated one. This is an
   invention, argued from §3.3's word *honest* and Part VII.3. If the reviewer would rather
   the zero state were the bare core dot alone, deleting `drawEmptyDisc` is four lines and
   the words in the SVG layer still carry it.

## Verification

```
node --test scripts/__tests__/brain-completeness.test.mjs   8/8 pass
node --test scripts/__tests__/*.test.mjs                    88/88 pass
npx vitest run (apps/web)                                   55 files, 397/397 pass
npm run typecheck                                           web · runner · contracts clean
node scripts/check-tokens.mjs                               288 files, 0 violations
node scripts/build-graph.mjs --check                        layout is reproducible and committed
npm run test:runner                                         73/73 pass
```

**The number now, and the proof it moves.** Against the committed `company/COMPANY.md`:

```
  brain         0% complete — 0 of 20 answered · company/COMPANY.md (§3.3)
  core          {"x":0,"y":0,"brainCompleteness":0,"brainAnswered":0,"brainTotal":20}
```

Then, on a byte-identical working copy, three markers were replaced with real-shaped
sentences the way the interview would write them (Q1–Q3), and the build re-run:

```
  brain         15% complete — 3 of 20 answered · company/COMPANY.md (§3.3)
  core          {"x":0,"y":0,"brainCompleteness":0.15,"brainAnswered":3,"brainTotal":20}
```

and what that does on screen: particles `0 → 124`, brightness `0.250 → 0.363`, central glow
alpha `0.040 → 0.058`, core-dot alpha `0.663 → 0.713`, dashed empty disc **off**, the
three-line sentence **gone**. The old implementation returned `0.45` for both of those
files, because nine headings is nine headings either way — that is the difference the fix
makes, and it is why the counter will now move under the user's hands in Phase 0 step 0.4.

The disagreement rule was exercised too — a planted `company/.brain.json` claiming 45%
against a 3-of-20 file:

```
  brain         15% complete — 3 of 20 answered · company/COMPANY.md (§3.3)
  warn  company/.brain.json claims 45% (9 of 20 answered) but company/COMPANY.md still
        carries 17 UNANSWERED markers (3 of 20 answered). Using the markers — a
        completeness may never exceed what the file admits (§3.3, CLAUDE.md rule 9).
```

A snapshot that *agrees* is used and named as the source. `COMPANY.md` was then restored
and re-verified: `sha256 af5ceda3e5532fa6501ab9e83f700d88dcd7518b80e596d4a06c4018035ff8ad`,
identical to before, `git status --porcelain company/` empty, `company/.brain.json` deleted,
`positions.json` unchanged (the layout did not move — only `core` did).

## Next agent

`fidelity-qa-reviewer`, re-review request at
`comms/inbox/fidelity-qa-reviewer/20260816-2114-map-galaxy-engineer-m1-brain-completeness-fixed.md`.
First thing to read: the *Verification* block above, then `scripts/lib/brain-completeness.mjs`.
M1 stays FAIL and the BOARD is untouched until they answer.

`runner-engineer` owns the remainder: `/api/status` still says 45%.
