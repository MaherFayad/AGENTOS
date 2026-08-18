---
from: fidelity-qa-reviewer
to: all
type: decision-request
re: PART VI acceptance — the 1440px side-by-side
status: open
created: 2026-08-16T21:10
---

# Proposal — Part VI's acceptance criterion has never been run, and cannot be

**Decision needed from: the user.** Two questions, both at the end. Nothing has been
installed and nothing will be until this is answered.

## 1. What Part VI actually requires

Spec of record, line 309, verbatim:

> Acceptance for "same look fidelity": side-by-side screenshot of your MAP vs their video
> frame at 1440px should differ only in content. The tokens above make that achievable; the
> discipline part is resisting extra color and extra chrome.

`comms/BOARD.md:7` repeats it as the standing fidelity bar. `cc-fidelity-check` §4 makes it
step four of the gate: *"Render at exactly 1440px, dark theme, and compare against the
referenced video frame for that section."*

It is one sentence and it has two halves. **Both are unmet, and they are unmet for different
reasons and have different costs.**

## 2. What is actually unmet

I have gated eight milestones' worth of work. **The screenshot comparison has been run zero
times, by anyone, on any milestone.** Every PASS on the record — mine and my predecessors' —
rests on source review, the token and motion checkers, a11y reading, contract compliance and
live endpoint probes. Those are real and they catch real things; today they caught a galaxy
rendering a 45%-complete brain that is 0% complete. They cannot catch proportion, density,
optical weight, or the frame match.

To be exact about what is and is not verified:

| Gate item | Status | How |
|---|---|---|
| No hex outside `tokens.css` | **verified** | `check-tokens.mjs`, 284 files, 0 violations |
| Every duration through `motion.ts` | **verified** | same checker, `no-duration-literal` rule |
| Colour only as data ink | **verified** | checker + manual scan of the dirs it does not cover |
| Tracking on wide caps | **verified** | scale carries it in the size token; read per call site |
| Reduced motion stills without layout change | **verified** | token layer + `--reveal-y: 0px`, read |
| Keyboard reach, focus rings monochrome | **verified** | read per control |
| Honest empty / failure states | **verified** | read + live endpoints |
| **Proportion, density, weight, radius at 1440px** | **NEVER RUN** | — |

Two blockers, not one:

**Blocker A — no way to render.** There is no headless browser in this repo. No Playwright,
no Puppeteer, no `chrome-launcher`, nothing that can rasterise a viewport. No agent here can
produce our half of the comparison.

**Blocker B — no reference frame, and this is the harder one.** There is nothing in this
repository to compare *against*. The only raster assets are four PWA icons. The spec says
"their video frame"; the video is not here, no frame has been extracted, and no path to one
is recorded anywhere in `comms/`. **Solving A alone buys nothing.** A screenshot with nothing
to diff it against is a screenshot.

Blocker A is a `npm i -D` away. Blocker B needs a human with the video, once.

## 3. What would satisfy it

**For blocker A:** `playwright` (or `puppeteer`) as a **devDependency** of `apps/web`, plus a
short script — set viewport 1440×900, dark theme, navigate the seven routes, wait for the
canvas rAF loop to settle, write PNGs to a gitignored directory. Roughly 60 lines. Playwright
is the better pick over Puppeteer here for one specific reason: it can pin
`prefers-reduced-motion` and `prefers-color-scheme` per context, which turns two of the gate's
manual steps (§3 motion, the light-theme check) into automated ones for free.

**For blocker B:** the user extracts the frames from the SkillTree video once — the §2.1
galaxy, §2.2 department, §2.3 drawer, §2.5 dashboard, §2.6 matrix. Five images. They go
somewhere versioned and the gate points at them. This is ten minutes of human time and it
cannot be delegated, because nobody here has the video.

Optional third step, only once A and B exist: `pixelmatch` as a devDependency to make the
diff numeric instead of a judgement call. **I would not do this yet.** The bar is "differs
only in content", and content differs by design — our agents are not their agents. A naive
pixel diff would be red on every frame forever and would have to be tuned into
meaninglessness. Human comparison against a real reference frame is the right instrument for
this specific criterion; automate it only if it proves repeatable.

## 4. What it costs — and the distinction that decides how heavy this is

**A headless browser is a devDependency, not a runtime dependency.** Stating that explicitly,
because it is the whole weight of this decision:

- **BOARD rule 8 / rule 2 — "No component library"** — bars a UI library that ships in the
  bundle. Playwright ships nothing. It never appears in `next build` output, never reaches
  the browser, never reaches the tailnet.
- **`AGENTOS-V2-PLAN.md` §23.11 rule 4** — *"No component library (BOARD #2), and now: no new
  runtime dependency without an ADR. The app is at one. Ship the board without making it
  two."* The word is **runtime**. `apps/web`'s runtime dependency count is unchanged by this
  proposal: `next`, `react`, `react-dom`, `@fontsource/*`, `lucide-react`, `@agnetos/contracts`
  — before and after.
- **BOARD rule 5 / §3.6 — no public ports** — unaffected. Playwright drives a local browser
  against `127.0.0.1`; nothing listens, nothing egresses.
- **Part VII.4 — traces and volumes stay local** — unaffected. Screenshots are local files
  and belong in `.gitignore`.

So **no ADR is required by the letter of any standing rule.** I am filing this as a
`decision-request` anyway, for two honest reasons: (a) it is a ~300MB browser download on the
user's machine and that is their call, not mine; (b) it changes what a PASS from me *means*,
which the whole team should see rather than discover.

Real costs:

| Cost | Size |
|---|---|
| Install (`npm i -D playwright` + `npx playwright install chromium`) | ~300MB on disk, one-time |
| `package.json` runtime deps added | **zero** |
| Bundle size added | **zero** |
| Human time, one-off | ~10 min to extract five reference frames |
| Agent time, one-off | ~1h to write and wire the capture script |
| Per-gate time thereafter | ~1 min to capture, then human eyes on five pairs |

Offline note: `npx playwright install` downloads a browser build. If this machine must stay
fully offline, that is a blocker and the answer to question 1 below is "no" — say so and I
will stop proposing it.

## 5. The honest interim standard — what a PASS from me means today

This is the part that matters even if the answer to everything below is "no", because eight
milestones have already passed under a standard nobody wrote down. Writing it down:

> **Source-and-token PASS.** The work satisfies every mechanically checkable part of Part I
> and Part VI: no hex outside `tokens.css`, every duration through `motion.ts`, colour only
> as data ink, wide caps tracked within +0.25em–0.45em, reduced motion stills without layout
> change, every control keyboard-reachable with a monochrome focus ring, drawers trap focus
> and close on Esc, canvas `aria-hidden`, empty and failure states present and honest, data
> projected from frontmatter rather than copied. **It has not been compared to the reference
> frame at 1440px.** Proportion, density and optical weight are unverified.

I propose three changes to how this is handled, all of which cost nothing and can happen
regardless of the tooling decision:

1. **Every PASS states the caveat in its own text.** I did this on all seven verdicts filed
   today. It should be the standing format, not my habit — a reader six months from now
   should not have to know which reviewer was careful.
2. **`comms/BOARD.md:7` stops asserting the fidelity bar as if it were being met.** It
   currently reads as a live gate. It is an aspiration with no instrument. One clause —
   *"(source-and-token review only; the screenshot comparison is unimplemented — see
   `comms/inbox/_all/20260816-2110-…`)"* — makes the document honest. `commandcenter-orchestrator`
   owns BOARD; I am requesting, not editing.
3. **Milestones already passed are not re-opened.** Re-gating eight milestones against frames
   that do not exist would be theatre. Instead: when A and B land, the first capture run
   covers all five surfaces at once, and anything it finds is filed as new findings against
   current owners. That is one honest pass over the whole product rather than eight
   retrospective ones.

This is the same principle the repo already applies to itself: `comms/BOARD.md:107` says a
requirement whose `Implemented in` column is `—` is *"declared but unbuilt — legal, counted
separately, and the honest way to show the spec is complete before the code is."* An
acceptance criterion with no instrument is the same category, and it should be visible the
same way. Right now it is invisible, which is the actual defect here — not that we lack a
browser, but that eight PASSes did not say what they did not cover.

## 6. The decision

**Question 1 — do we add a headless browser as a devDependency?**
My recommendation: **yes.** It adds zero runtime dependencies, zero bundle bytes, breaks no
standing rule, and it is the only way the acceptance sentence in the spec of record ever
becomes checkable. If the machine must stay offline, or 300MB is unwelcome, "no" is a
perfectly defensible answer — and then item 5 above becomes permanent rather than interim,
and Part VI's acceptance sentence should be amended to say what we actually do, because a
criterion nobody can run is worse than a lower criterion everybody can.

**Question 2 — will you extract the five reference frames?**
This one only you can answer, and **question 1 is worthless without it.** §2.1 galaxy, §2.2
department, §2.3 drawer, §2.5 dashboard, §2.6 matrix, from the SkillTree video, at whatever
resolution the video gives. If the answer is no, then answer 1 should also be no — capturing
our own screenshots with nothing to compare them against would produce a folder of PNGs and a
false sense of rigour.

If both are yes, the work splits: `infra-compose-engineer` or `shell-navigation-engineer`
owns the devDependency and the capture script (it touches `apps/web/package.json`, which is
neither of mine); the reference frames and the comparison are mine; and it wants a milestone
of its own rather than being smuggled into M8 polish.

## Meanwhile

Not idle and not blocked. I continue gating at the source-and-token standard, stating the
caveat on every verdict. Re-reviews of the four findings routed today are queued and waiting
on their owners to file.
