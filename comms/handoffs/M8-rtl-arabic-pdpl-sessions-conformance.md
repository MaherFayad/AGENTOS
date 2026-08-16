---
agent: rtl-arabic-pdpl-specialist
milestone: M8
spec: §1.4, §3.1, Part VII.4, Part VI row 8
created: 2026-08-16T14:53
status: ready-for-review
---

# M8 — the SESSIONS slice made conformant (tokens, RTL, Arabic)

The SESSIONS slice was written before the token and RTL discipline the rest of the repo
follows: 34 type literals, 3 hardcoded wide tracks, 2 physical padding properties and 15
untranslatable strings. It is now clean on both checkers, and its copy exists in both
catalogues as sentences rather than as English typed into JSX.

Three repo tests were also failing. All three turned out to be assertions describing a
repo that does not exist, not code that was wrong. Details under *Verification*.

## What exists now

**Type — the §1.4 scale, consumed by name.** `apps/web/src/sessions/sessions.module.css`
holds no `font-size` and no `letter-spacing` literal. Every rule pulls its role out of
`tailwind.config.ts` with `@apply text-label / text-label-sm / text-meta / text-small /
text-body / text-pill / text-chip`, which is `design-system-guardian`'s own instruction to
this slice (`comms/inbox/sessions-relay-engineer/20260815-2123-design-system-guardian-type-literals.md`).
Tracking is `var(--track-1)` / `var(--track-2)` / `var(--track-3)`, never a literal, so
`rtl.css` flattens all of it under `:lang(ar)` in one place.

`@apply` inside a CSS module is new to this repo. It compiles (verified through
`npx tailwindcss` and through `npm run build`) and it is the only way a CSS module can
name a Tailwind type role instead of copying its px. The alternative — a block of local
`--ses-fs-*` variables, the `dashboards.module.css` pattern — would have re-typed the
scale in a second place, which is the drift this rule exists to prevent.

Four sizes were off-scale and have been folded onto the nearest §1.4 rung: 15px → `text-body`
(row name, view title, empty title, permission tool), 14px → `text-small` (empty state),
11px-plain → `text-chip` + `font-weight: 400` (view meta, gap notice, gate note, permission
detail). That is a deliberate 1px-per-element fidelity *gain*, not a loss — those four
sizes were never in the scale.

**Tracking, and the Arabic half of it.** The three wide-tracked labels now carry their
role class in the JSX as well as their size in the module:

| element | module | JSX class | Latin | Arabic (rtl.css) |
|---|---|---|---|---|
| `.eyebrow` | `@apply text-label uppercase` + `var(--track-3)` | `u-eyebrow` | +0.35em | untracked, 600, `word-spacing: .22em` |
| `.back` | `@apply text-label uppercase` + `var(--track-1)` | `u-tab` | +0.25em | same |
| `.permissionEyebrow` | `@apply text-label-sm uppercase` + `var(--track-2)` | `u-label` | +0.30em | same |

The role class is the load-bearing half. `rtl.css` rule 2c hooks `:lang(ar) .u-label /
.u-eyebrow / .u-tab / [class*='tracking-wider-']`; a CSS-module hash matches none of
those, so without the role class Arabic would get the tracking *reset* and none of the
compensation — a label left with no emphasis at all. That is the failure §1.4 warns about
and the reason deleting the tracking is the wrong fix.

**LTR islands (§1.4).** Program output does not mirror. `Transcript` rows, the permission
card's tool name and its verbatim command `<pre>` now carry `.u-ltr-island`; the prose
around them (gap notice, empty state) stays in the page direction. `.u-nums` isolates the
elapsed/cost column so `$1.20` never renders as `1.20$` beside Arabic.

**Copy — 33 new keys, both catalogues.** `apps/web/src/i18n/strings.en.ts` and
`strings.ar.ts`, 172 keys, 170 Arabic (99%), 2 pre-existing `todo(ar)`. Every user-facing
string in `apps/web/src/sessions/**` now comes from `t()`, including the ones the checker
could not see (its JSX scan only matches single-line text nodes, so multi-line paragraphs
were invisible to it and are the ones that actually get missed).

New file: `apps/web/src/sessions/lib/stateKey.ts` — the session-state enum → catalogue key
table. `lib/sort.ts` is a node-loadable leaf and cannot translate; `stateLabel()` was
returning raw English (`'waiting on permission'`, `'idle'`) straight into the row.

**The Arabic is a rewrite, not a gloss.** Register is nominal فصحى مبسطة, matching the
existing catalogue: `تنبيه هذا الهاتف`, `فتح القفل`, `مفتاح الاسترجاع` — masdar labels,
never imperatives. One term per concept: the relay is `المُرحِّل` in the gate, the list and
the transcript, so three screens are not naming the same thing three ways. No `تم` + مصدر
anywhere (`تعذّر فكّ تشفير…`, not `لم يتم فك التشفير`). No em dash in the Arabic — it is a
Latin convention; the Arabic comma `،` or a second sentence carries it instead. Counts use
all five Arabic plural classes, so `جلستان` (dual) exists where English has nothing.

`empty.sessions.title/body` were rewritten rather than duplicated. The old pair
("No sessions open" / "Start one here and it follows you to your phone") described a flow
that does not exist — you cannot start a session from this browser (ADR-005). Nothing
consumed those keys.

## How to use it

A wide-tracked label in this repo is two classes, not one:

```tsx
<span className={`u-eyebrow ${s.eyebrow}`}>{t('sessions.eyebrow')}</span>
```

```css
.eyebrow {
  @apply text-label uppercase;
  letter-spacing: var(--track-3);
  color: var(--ink-2);
}
```

Program output, a command, a stack trace, a chart axis:

```tsx
<pre className={`u-ltr-island ${s.permissionDetail}`}>{detail}</pre>
```

Adding copy: put the English in `strings.en.ts`, give `strings.ar.ts` the same key.
TypeScript fails the build on a missing Arabic key, so the gap can never be silent;
`todo('English')` is an acceptable answer and a guess is not.

## Contracts touched

None changed. This slice *consumes* `comms/contracts/design-tokens.md` §7 (the type scale
and the four tracking rungs). One decision-request is filed against it — see below.

## Deliberately not done

1. **~~`validate:tokens` is not repo-clean.~~ Resolved during this session — it is now 0
   violations across 281 files.** When I finished, 31 remained in
   `apps/web/src/drawer/drawer.module.css` (`drawer-engineer`'s file, outside my boundary,
   same class of failure and same fix). I sent the worked `@apply` + `var(--track-N)`
   recipe as an `fyi` rather than a finding; they applied it and answered. Left in this
   list rather than deleted, because the *reason* it is worth reading survives: they had a
   handoff drafted saying the fix was blocked on new `--fs-*` tokens, and it was not.
   Still open on their side, by their own account: the `u-label` / `u-eyebrow` / `u-tab`
   classes in `drawer/**` JSX. Without those, `rtl.css` gives Arabic the tracking reset and
   none of the compensation — the labels come out flat. They are holding it to land with
   the 10 hardcoded-copy findings in `drawer/sections/**`, which is the right call: half a
   conversion is untestable in Arabic.
2. **`validate:rtl` is not repo-clean. 72 findings remain**, none in `sessions/**`:
   `dashboards/**` 30, `components/shell/**` 16, `chart/**` 11, `drawer/sections/**` 10,
   `map/**` 4, `app/(views)/offline` 1. All are other agents' slices and all are the same
   two rules (hardcoded copy, physical Tailwind utilities). Not touched.
3. **`npm run test` is 78/79, not 79/79.** The three failures I was sent to fix all pass.
   A *fourth* appeared mid-session: `no secret material is committed or referenced in
   comms/` now fails on `comms/handoffs/M0-infra-compose-engineer-dataplane-up.md`
   (landed 14:46) at line 62, `export ANTHROPIC_API_KEY="${RUNNER_ANTHROPIC_API_KEY}"` —
   a shell variable reference, not a secret, but the guard's regex is
   `ANTHROPIC_API_KEY\s*=\s*\S+`. The same test also asserts `.env` does not exist, and a
   real `.env` now sits at the repo root (gitignored, created 14:38). **I did not loosen a
   secrets guard to go green.** A false positive on that check is the cheap failure mode
   and a false negative is the expensive one, and both the file and the `.env` belong to
   `infra-compose-engineer`. Filed as `fyi` to them and to the orchestrator.
   `fidelity-qa-reviewer` hit the same wall independently at 15:06 and made the same call
   ("did not edit another agent's handoff... a handoff is a record"), and their own handoff
   now quotes the string too, so it trips on two files. That makes it a queue-blocker for
   `npm run verify`, not a nuisance — verify stops at `npm run test` and never reaches
   `test:web` or `test:runner`.
4. **`npm run test:web` is red, and separately so.** `fidelity-qa-reviewer` wired up the
   web test runner mid-session (43 vitest files, 312 passing) and left
   `src/test/quarantine.test.ts` failing by design: 8 `components/shell/**` test files
   deadlock on a circular `vi.mock` factory and have never run an assertion.
   `shell-navigation-engineer`'s, routed by them. Nothing in the SESSIONS slice is
   quarantined and no vitest file fails because of this work.
5. **No locale switch.** `app/layout.tsx` still hardcodes `DEFAULT_LOCALE`, so the Arabic
   catalogue cannot be reached from a URL. It is one line, but `layout.tsx` is
   `shell-navigation-engineer`'s and outside my boundary. This is why the Arabic evidence
   below is a DOM injection rather than a route.
6. **`company/COMPANY.md` not pointed at `redaction-rules.ts`.** `observability-engineer`
   asked for it (open message, now answered). §7 already carries "redact at
   instrumentation"; naming the specific rule-list file is one sentence, and COMPANY.md is
   outside this task's boundary. Next slice.
7. **The session detail route (`/sessions/[id]`) was not screenshotted.** It needs a live
   relay session and `happy` is not started (ADR-005, infra handoff item 2). The transcript
   and permission card were verified by code and by the `.u-ltr-island` rule, not by eye.
8. **Light-theme parity for this slice not re-checked.** M8 remainder.
9. **`--ses-fs-gate: 18px` and `--ses-dot-breathe: 2.4s` are still local variables.** The
   §1.4 scale jumps 16px → 28px and §1.6 has no ambient-loop duration. Both are filed as
   one decision-request to `design-system-guardian`; until it is answered these are scoped
   to `.tab, .view` rather than invented in `tokens.css`, which is the same call
   `dashboards-engineer` made for the 44px carousel title.

## Verification

```
node scripts/check-tokens.mjs   sessions/**  → 0 violations   (repo: 0 across 281 files)
node scripts/check-rtl.mjs      sessions/**  → 0 findings     (repo: 72, none in sessions)
                                catalogue    → 172 keys, 170 ar (99%), 2 todo(ar)
npm run build                                → compiled successfully in 8.1s, 18 routes
npm run test                                 → 79 tests, 78 pass, 1 fail (item 3 above)
npm run typecheck                            → clean, 3 workspaces
npm run lint                                 → no ESLint warnings or errors
npx vitest run (apps/web)                    → 312 pass, 1 fail (item 4 above, not mine)
```

Two exemptions are now printed by `check-rtl`, both mine, both at
`sessions.module.css:73-74`:

```
physical-property — a notch is a physical edge of a physical device and does not move
```

`.tab` pads for `env(safe-area-inset-left/right)`. `padding-inline-start` would put the
*left* notch inset on the *right* edge under `dir="rtl"` and leave the cutout overlapping
the list. The checker documents this exact case (`SAFE_AREA` / `fixFor` in
`check-rtl.mjs`): split the design padding from the device inset and exempt the physical
half. There is no design padding welded to those two lines — the tab's inline padding
lives on `.header` and `.list` — so the exemption is the whole answer. This is the one
place in the slice where a physical side is correct, and it is visible on every run.

### The three test failures — which side was wrong

Each was an assertion describing a repo layout that has never existed. None was fixed by
changing working code.

1. **`rtl-pdpl.test.mjs:85`** asserted `@import './styles/rtl.css'`. `globals.css` lives in
   `src/app/` and `rtl.css` in `src/styles/`, so the import is and must be
   `'../styles/rtl.css'`. The pinned path has never resolved from `src/app/`. Relaxed to
   `/@import\s+'[^']*styles\/rtl\.css'/` — what the test actually guards is that the only
   stylesheet the entrypoint loads still pulls in the RTL layer, not which directory it
   sits in.
2. **`repo-conformance.test.mjs` — "no hex colour outside the token file"** flagged 32
   lines in `apps/web/src/styles/tokens.test.ts`. That file is the regression guard *on*
   tokens.css; pinning `--bg: #111114` is how rule 8 gets enforced, so it has to be able to
   write `#111114`. `scripts/check-tokens.mjs` — owned by `design-system-guardian`, the
   authority on rule 8 — already exempts exactly that file plus `motion.ts/.test.ts` and
   `theme.ts/.test.ts`, in writing. The conformance test was a duplicated walk that had
   drifted from it. Mirrored the same six-file list, with a comment naming check-tokens as
   the source of truth so the two cannot drift again.
3. **`repo-conformance.test.mjs` — "every accepted ADR has a status, an owner and a
   'Deliberately not' section"** failed on ADR-000 and would then have failed on 004, 005,
   006 and 008. Those five follow `comms/templates/adr.md` exactly — which writes
   `**Author:**` and has no "Deliberately not" section; it closes with Consequences and
   Contract edits. "Deliberately not done" is the **handoff** invariant
   (`comms/templates/handoff.md`, CLAUDE.md *Definition of done*), copied onto ADRs by
   mistake. Four ADRs (001-003, 007) use a bullet header with `**Owner:**` instead. The
   real invariant is *a status and a named accountable agent*, so the test now accepts
   `**Owner:**` or `**Author:**` and no longer demands a section the template never
   produced. The alternative — retrofitting a header and a section onto five other agents'
   decision records — would have meant rewriting reasoning documents I do not own.

### Visual RTL — read, not grepped

Fresh production build served on `:4325` (the `:4321` server was still serving a
pre-change build; I started a second one rather than restarting theirs). Viewport 1440x900,
`/sessions`.

| file | state | what it shows |
|---|---|---|
| `sessions-ltr.png` | LTR, key gate | baseline |
| `sessions-rtl.png` | `dir=rtl`, key gate | shell mirrors: search → right, `+ New session` / NAVIGATION → left, tab order reverses to SESSIONS · CHART · DASHBOARDS · MAP, bottom pills swap. Input placeholders right-align inside the fields. |
| `sessions-list-ltr.png` | LTR, unlocked | eyebrow + billing note at the left, empty state centred, push toggle full-width |
| `sessions-list-rtl.png` | `dir=rtl`, unlocked | eyebrow and billing note move to the right edge; Latin caps keep their +0.35em track; the centred empty state correctly does not move |
| `sessions-list-rtl-ar.png` | `dir=rtl lang=ar` | every wide track collapses to `normal` and weight goes to 600 — rule 2a + 2c firing across the shell, the tabs, the eyebrow and the bottom pills at once |
| `sessions-list-arabic.png` | `dir=rtl lang=ar` + real Arabic strings injected | `الجلسات` renders connected, untracked, word-spaced. `محسوبة على اشتراكك في Claude، لا على السقف الشهري للمشغّل.` right-aligned with `Claude` held LTR inside the Arabic line — bidi isolation working. `تنبيه هذا الهاتف` on the push button. No sheared glyphs, no severed joins. |

Screenshots are in the session scratchpad
(`…/2f6080bb-71b7-4879-a458-df4ac60f4fda/scratchpad/`), not in `comms/` — `comms/` holds
prose and schemas only.

The last one is a DOM injection of the catalogue's Arabic values, because there is no
locale switch yet (item 4). It proves the *typography* rules on Arabic glyphs; it does not
prove the wiring, which is what the locale switch will prove.

## Next agent

`fidelity-qa-reviewer` — a `review-request` is filed. Start with the two printed
`rtl-exempt` lines in `sessions.module.css`: an exemption you cannot see is
indistinguishable from a bug nobody has noticed, so they are the first thing to argue
with.

`drawer-engineer` and `dashboards-engineer` — items 1 and 2 are yours, and the fix is the
table above.
