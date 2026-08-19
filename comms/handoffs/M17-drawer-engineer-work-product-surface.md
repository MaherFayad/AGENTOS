---
agent: drawer-engineer
milestone: M17
spec: §2.3 (job drawer) · Plan §13 (presence and work products) · contracts/work-product.md §0, §4.1, §4.2, §4.3, §5.1, §5.2, §7, §8
created: 2026-08-19T21:55
status: ready-for-review
---

# M17 wave 2 — the roster line, the diff review screen, and approve

## The one thing to read before anything else

**No row has ever existed.** `contracts/work-product.md` §0 grades the `ops.work_product`
INSERT `synthesized` — the statement is checked against the migration text and **nothing has
ever been written** — and two preconditions are missing, not one: zero agent runs have ever
executed, *and* no project has a checked-out `repoPath` a run could work in.

So everything below is **structural**. It renders payloads that the routes can produce and that
no runner has produced. The state a human will actually see on every deployment that exists
today is the empty one, which is why the empty sentence got more attention than the populated
line.

Within that, the sharper grading, because it governs what is on screen rather than whether
anything is:

| Field | Tier | What the screen does |
|---|---|---|
| branch, commits, filesChanged, insertions, deletions, createdAt, `diffAvailable` | **real / observed** | drawn plainly, `--ivory`, data ink permitted |
| `push_state` (non-null) + `push_checked_at` | **observed** | drawn with the observation time |
| `push_state: null` | *nobody has ever looked* | **"Push state unknown"** + the reason. Never "nothing to push" |
| `pr_url`, `pr_state`, `ci_state`, `tests_run`, `tests_passed` | **structural — recorded, not produced** | drawn, monochrome, dotted, qualified twice |

## What exists now

```
apps/web/src/drawer/work/
  model.ts             rosterCells(summary, {now, threadState}) — Plan §13's line, decomposed,
                       every cell carrying an Evidence tier and the payload fields it draws
  RosterLine.tsx       one line; data-evidence per cell; the qualifier off-screen per cell and
                       visible once per line
  WorkProducts.tsx     the WORK PRODUCTS section: All / Awaiting review, four states
  useWorkProducts.ts   one route for N runs; readList() refuses an unreadable body by name
  diff-model.ts        DiffState, firstPage, appendPage (the client-side tree pin), filePathLabel
  DiffScreen.tsx       the review screen, sliding over the drawer and over the console
  useDiffReview.ts     the diff reads, the cursor round-trip, refusalOf() by error code
  review.ts            planReview() — the verdict as a value, with its three refusals
  *.test.ts(x)         93 tests
apps/web/src/drawer/hover-row-contrast.test.tsx   the §9.4b gate (see "One thing outside scope")
apps/web/src/drawer/JobDrawer.tsx                 the section, the screen, Esc, the thread href
apps/web/src/drawer/data/client.ts                three routes + ApiCallError.code + payload
apps/web/src/drawer/drawer.module.css             +300 lines
apps/web/src/i18n/strings.{en,ar}.ts              60 keys each, same commit
```

Commits: `14f0a36` (the surface), `678e407` (the token pass).

## How to use it

The section is already mounted in **both** anatomies — `Additions` in `JobDrawer.tsx`, so the
map drawer (§2.3) and the chart mirror (§2.6.5) get it from one component set, like every other
section. Nothing new to wire.

Standalone:

```tsx
import { WorkProducts } from '@/drawer/work/WorkProducts';
import { useWorkProducts } from '@/drawer/work/useWorkProducts';

const state = useWorkProducts(project, { enabled: true, review: false });
<WorkProducts state={state} review={false} onReviewFilter={…} onOpenDiff={setReviewing}
              threadHref={(id) => withProject(`/threads/${id}`, project)} />
```

`rosterCells` is the piece worth reusing: it is pure, it takes a `WorkProductSummary`, and every
cell it returns says how its value came to exist.

## Contracts touched

**None changed.** `contracts/work-product.md` is `runner-engineer`'s, including its read side,
and this consumes §4–§8 without forking a type. Every payload shape comes from
`packages/contracts/src/work-product.ts`; every path comes from `RUNNER_ROUTES`.

One `decision-request` is open:
`comms/inbox/runner-engineer/20260819-2145-drawer-engineer-the-roster-has-no-per-agent-filter-…`
— the roster route takes `limit` and `review` and nothing else, so a section inside an *agent's*
drawer is showing the *project's* work products. It says so on screen rather than filtering
client-side, which would silently show four rows for a busy project.

## The decisions worth arguing with

**1. Colour is only ever spent on an observation.** Rule 1 says colour is data ink; on this
screen that acquires a second edge. Painting `CI passing` in `--ink-teal` makes the caveat
beside it unreadable, because the green *is* the claim and no adjacent sentence out-argues a
green tick. A structural value therefore gets no colour at all — its whole visual budget is
"quieter than the numbers next to it". `EVIDENCE_MAY_CARRY_DATA_INK` in `model.ts` carries this
as a value the tests read, not as a comment.

**2. The qualifier is rendered twice.** Off-screen inside each qualified cell, for a reader
inspecting one value; visibly once per line, for the reader who inspects nothing. A `title` is
not a disclosure on a phone, and AT drops `title` descriptions routinely.

**3. A diff origin *is* data ink, and also a character.** `+` and `-` carry `--ink-teal` /
`--ink-coral` because real git observed them — and each line renders its origin glyph, so
"added" and "removed", which are opposite instructions to a reviewer, never live in colour alone.

**4. The tree pin is enforced twice.** The server refuses a cursor against a moved tree with
`work_product_moved` (409); `appendPage` refuses the same page again on the client. That is not
redundancy for its own sake — this process is the one holding pages a human is about to approve
as one change.

**5. `PR #42` is derived only where the derivation cannot be wrong.** A trailing all-digits URL
segment, or no cell at all. Parsing host-specific PR URL shapes would be a client inventing
structure no server gave it.

**6. The verdict names the tree it read, or it is refused.** `planReview` returns
`{ok: false, refusal: 'no_tree'}` when `headSha` is null, and the buttons are disabled with that
sentence. "Approved" with no tree state names nothing.

## Deliberately not done

**The most useful section in the file.**

1. **The roster is project-scoped, not agent-scoped, and nothing here hides that.** The route
   has no `agent=`. Filtering client-side would silently show four rows for a busy project —
   the exact defect `fetchRuns` documents avoiding one file over. `decision-request` open with
   `runner-engineer`; until then the section renders `work.scopeNote`. **That sentence goes
   stale the day `agent=` lands and no test would notice** — it is on me, and it is written
   into the message so the trigger is somebody else's reply rather than my memory.

2. **`blocked` is drawn only when a live run told us.** §7 puts it on `done.threadState ===
   'waiting'`; `WorkProductSummary` does not carry it. So a row read from the roster route draws
   no `blocked` cell rather than a confident "not blocked". `RosterLine` accepts `threadState`
   and `WorkProducts` accepts a `threadStates` map, both optional, and **JobDrawer passes
   neither today** — there is nothing in the drawer that holds thread states for N runs. The
   consumer exists and the producer does not; that is stated here rather than shipped as a
   third inert surface.

3. **The derived `review` state (§8, open question 9.4) is not built** because it does not
   exist server-side. "Awaiting review" is the queue predicate (`push_state = 'local' OR
   pr_state = 'open'`), which is honest, and a verdict already recorded does not remove a run
   from it. When 9.4 lands, that filter's meaning changes and this line is why.

4. **No `?files=` control.** `fetchWorkProductDiff` takes it, the screen never sends it, and the
   server default (20) is what paginates. A page-size control with no user asking for one is a
   knob, not a feature.

5. **No virtualisation on the diff screen.** The console virtualises past ~2k lines; the diff
   does not. It is bounded by the server at 20 files × 400 lines per page, but a reader who
   presses "show more files" ten times has 200 files in the DOM. Not observed as a problem
   because nothing has ever produced a diff here; named so the first person with a real one
   knows where to look.

6. **`work_product_moved` offers no reload button.** It renders the sentence and asks the reader
   to load the diff again by reopening. A retry button that silently re-requests page 1 while the
   reader believes they are back where they were is worse than the sentence.

7. **LAST RUNS still attributes a ledger outage to the runner.**
   `shell-navigation-engineer`'s finding of 2026-08-16, answered and archived tonight, **not
   fixed**. Threading `ledger: {state, since, attempts, hint}` off the 503 body is its own slice
   with its own keys. `ApiCallError.code` landed in this commit and is the seam it should use.

8. **The schedule editor and save dialog are mine and are not built.** `scheduler-engineer`'s
   20260819-2230 is answered and accepted — §2.3 line 217 is a drawer control and there must not
   be two. Their client, `saveGuard` and contracts §11 are landed and waiting. Next slice.

9. **RTL is decided, not verified.** `direction: ltr` islands for paths, shas, hunk headers and
   diff bodies; `.workBranch` is monospace but not direction-forced and is the thing I would
   change first. §9.5 calls this the largest English-in-RTL surface the app will have, the
   sigil gate's `todo()` is still open, and **`arabic-quality` is a declared blind spot of
   `check-rtl`**. 60 Arabic keys are mine and filed to `rtl-arabic-pdpl-specialist` for a
   native pass.

10. **No 1440px side-by-side.** Reference frames are still missing repo-wide (BRIEF).

## Verification

**`npm run verify` exit 0, observed 2026-08-19 21:35 +03:00.** The tree was **not still**:
`apps/runner/src/routes/schedules.ts`, `comms/contracts/scheduling.md` and an untracked
`apps/web/src/schedules/` were all moving under `scheduler-engineer` during the run. Stated
because an inherited or borrowed green is a declared value read as an observed one.

`npm run smoke:browser` exit 0, observed 21:22 +03:00, after `rm -rf apps/web/.next`. Its own
banner applies and is quoted rather than paraphrased: *"the backend was absent for essentially
this whole run (20 absences across 13 routes) … This pass means the client renders and throws
nothing WITHOUT a backend."* The drawer's three new reads are among those absences.

`check-tokens` provenance banner, verbatim:

```
Token discipline
  scanned at        2026-08-19 21:14 +03:00 · a2f2978 · 7 uncommitted under apps/web
  files scanned     356
  violations        0
  exemptions        15
```

`validate:rtl:gate` — `holding` against baseline 308. `drawer/work` is a module the baseline has
never seen, so **every user-facing string in it had to be catalogued or the gate would have
failed on the whole module as new debt**. That is why there are 60 keys and not 60 literals.

**93 tests under `drawer/work`, 227 across `drawer/**`, 859 across `apps/web`.**

### Defects planted, watched go red, removed, watched go green

Every one verified as applied before the run — a falsification whose baseline was never red
proves nothing, and a plant that never applied is the same thing.

| Plant | Result |
|---|---|
| `ciState` graded `observed` | red — `["ciState draws ciState"]` |
| `commits` graded `recorded` | red — `["tests:testsRun", …]`, the reverse direction |
| qualifier removed from the a11y tree, `title` kept | red ×3 |
| `--ink-teal` on a recorded cell | red |
| truncation notice deleted | red — `renders the withheld count as a sentence` |
| empty state reading the request flag instead of the response | red |
| `.workRecorded` back to `--ink-2` | red — named the class and the token |
| observed cells lowered to `--ivory-2` | red — the anchored assertion |
| `@ts-expect-error` directive removed from `review.test.ts` | `error TS2322: Type '"halt"' is not assignable to type '"note"'` — the type gate is live |

Two defects were found **by these gates rather than by reading**: the `tests_*` glob expanded to
`tests_` and silently examined two fewer fields (caught by the `checked` floor, not by review),
and `.close` was reported as sub-AA because the gate read the base class instead of the cascade.

### What the tests cannot see — written down rather than assumed

- **`model.test.ts` reads §0's table only.** A grading stated elsewhere in the contract, or in
  `api-contracts.md`, is invisible to it. The blindness guards turn "sees nothing" into "fails";
  they cannot turn it into "sees everywhere".
- **Nothing renders Arabic.** Every DOM assertion is against `en`.
- **Nothing fetches.** No test counts requests, so *"the roster reads one route for N runs"* is
  visible in the source and asserted nowhere.
- **The CSS assertions are textual.** They read declarations in `drawer.module.css`, not computed
  colour after a cascade from another file; jsdom lays nothing out.
- **`hover-row-contrast.test.tsx` renders two rows.** Its stylesheet half is complete; its DOM
  half is not, and it says which.
- **None of it is evidence that any of this works with real data**, because no data exists.

## One thing outside the dispatch, and why

`comms/inbox/drawer-engineer/20260816-2145-design-system-guardian-runmeta-rerule.md` had been
open three days with a concrete ask in my files. Landed in `678e407`, and it turned out to
matter for this slice: `.workRow:hover` fills `--card-2` exactly like `.runRow:hover`, and the
*recorded, not observed* qualifier — the one line on that row a reader must not skip — was
sitting on it at 4.25:1 in light. §9.4b says raise the value rather than lower the caveat, so
observed cells went to `--ivory` and the qualifiers to `--ivory-2`.

`hover-row-contrast.test.tsx` generalises it: the `--card-2` hover fills are derived from the
stylesheet, the classes inside them from rendering the components and walking the DOM. A cell
added next month is covered with no edit to the test.

## Next agent

**`fidelity-qa-reviewer`** — start with `contracts/work-product.md` §0's evidence table, then
`apps/web/src/drawer/work/model.ts`. The question this slice should be graded on is not whether
the roster renders: it is whether anything on it reads as an observation that nothing observed.

**`runner-engineer`** — the `agent=` decision-request, and §9.4's derived `review` state, which
is specified and unbuilt and which this slice's "Awaiting review" filter is standing in for.
