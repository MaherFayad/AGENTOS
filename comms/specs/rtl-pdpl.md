# Spec — RTL, Arabic, and PDPL (Part VII)

> The implementation spec for PART VII of `skilltree-clone-spec.md`, plus the
> Arabic/RTL behaviour the roster assigns us. Checked by `npm run validate:coverage`.

## Owner

`rtl-arabic-pdpl-specialist`

## Spec sections covered

PART VII

## Boundaries — sections this spec cites but does not own

BOARD maps PART I (including §1.4) to `design-system-guardian` and PART VII to this
agent. The roster still names us for "§1.4 Arabic, RTL pass, PDPL (Part VII.4)". That
is implementation against their tokens, not a second claim on the type scale.

The coverage checker treats every `§n.n` / `PART N` under **Spec sections covered** as
an ownership claim, so none of the following ids appear there. Rows below that cite
§1.4 document the Arabic note we implement; they do not steal Part I.

| Section | Owner | What is mine | What is theirs |
|---|---|---|---|
| §1.4 | `design-system-guardian` | Arabic face usage, no italic, no tracking, `dir="rtl"` chrome, the i18n catalogue, `rtl.css`, `check-rtl.mjs` | the type scale, `--track-1…4`, `--font-*`, `@fontsource` wiring in `fonts.ts` |
| §1.1–§1.3 · §1.5–§1.6 | `design-system-guardian` | nothing | tokens, chrome, motion |
| §2.0 · §2.3 · §2.6.5 | shell / drawer | logical-property helpers and drawer anchors in `rtl.css` / `direction.ts` | the components that consume them |
| §2.1 · §2.5 · §2.6 | map / dashboards / chart | the `DOES_NOT_MIRROR` list (galaxy, charts, phase columns stay put) | those views |
| §3.5 | `observability-engineer` | the PDPL rule *list* (what must be stripped) | Langfuse client, `redact()` at the instrumentation boundary |
| PART V | `infra-compose-engineer` | the policy that volumes stay local and backups encrypt | compose, named volumes, `infra/BACKUP.md` |
| §3.2 | `runner-engineer` | `deliver:` leaving the tailnet needs an ADR before it ships | the `deliver:` frontmatter field itself |

## Decisions

1. **Tokens, not literals.** `rtl.css` consumes `--track-1…4`, `--font-serif` /
   `--font-arabic`, `--dur-drawer`, `--ease-drawer`, `--border-w`, `--line`. Accent
   tracking is the `tracking-accent` utility (contract §8), applied by `<Accented>`.
   No new type scale. Optical 1.08em compensation for IBM Plex vs Jakarta is refused
   until the token owner publishes a multiplier — a literal here fails `check-tokens.mjs`.

2. **One catalogue, two rewrites.** Strings live in `apps/web/src/i18n/strings.{en,ar}.ts`
   from day one. Arabic is MSA, noun-form labels (تشغيل not شغّل), and a rewrite of the
   English voice, not a dictionary pass. `todo('English')` is the admitted gap; a guess
   is not. TypeScript fails the build on a missing Arabic key.

3. **Western digits, isolated.** `NUMERIC_LOCALE = 'en-US'` for both UI locales. KPI
   numerals, axes and the cost ticker stay LTR islands inside an RTL page (`.u-nums`,
   `.u-ltr-island`, `isolate()` in `format.ts`). Arabic-Indic digits wait on an explicit
   human request.

4. **Mirror reading order, not space or time.** `dir="rtl"` flips drawers, rails,
   breadcrumbs, segmented-control order. It does not flip the map canvas, charts,
   phase columns, progress, or consoles. `direction.ts` is the list; components do not
   invent a third opinion.

5. **PDPL binds every run through COMPANY.md.** Part VII.4's leverage is §3.3: every
   runner invocation injects `company/COMPANY.md`. The standing data-handling block
   lives there. Redaction happens in `observability-engineer`'s instrumentation, before
   a trace is written. We do not log PII. No `deliver:` target that leaves the tailnet
   ships without its own ADR — none is filed, because none is shipping.

6. **No i18n library.** Part V bans a component library; `next-intl` would add routing
   opinions we do not want. Lookup + `Intl.PluralRules` (six Arabic classes) is the
   whole mechanism.

## Coverage

### PART VII — honest flags

| ID | Spec § | Requirement | Implemented in | Verified by |
|---|---|---|---|---|
| REQ-RTL-01 | PART VII | Flag 1 (design lift is real; fidelity lives or dies at M1–M2) is acknowledged, not implemented here | — | — |
| REQ-RTL-02 | PART VII | Flag 2 (clone the look for ourselves, not for resale) is standing policy; we do not ship a pixel-identical commercial skin | — | — |
| REQ-RTL-03 | PART VII | Flag 3 — empty states are honest sentences in both languages; none say "No data available" | `apps/web/src/i18n/strings.en.ts` · `apps/web/src/i18n/strings.ar.ts` | `scripts/__tests__/rtl-pdpl.test.mjs` |
| REQ-RTL-04 | PART VII | Flag 3 — an empty catalogue, department, run list, search, panel, widget, chart cell, session, audit, brain, or input form has a dedicated key | `apps/web/src/i18n/strings.en.ts` | `apps/web/src/i18n/i18n.test.ts` |
| REQ-RTL-05 | PART VII | PDPL constraints are standing policy in COMPANY.md so every runner invocation inherits them (§3.3) | `company/COMPANY.md` | `scripts/__tests__/rtl-pdpl.test.mjs` |
| REQ-RTL-06 | PART VII | Traces stay local: COMPANY.md forbids US SaaS observability and third-party trace forwarding | `company/COMPANY.md` | `scripts/__tests__/rtl-pdpl.test.mjs` |
| REQ-RTL-07 | PART VII | PII is redacted at instrumentation, not in a viewer — names, emails, phones, national IDs, payment details | `apps/runner/src/observability/redaction-rules.ts` | `apps/runner/src/observability/__tests__/redaction.test.ts` |
| REQ-RTL-08 | PART VII | Adding or loosening a redaction rule is a decision-request to both this agent and `observability-engineer` | `apps/runner/src/observability/redaction-rules.ts` | — |
| REQ-RTL-09 | PART VII | Encrypted backups of the local Postgres volume are documented | `infra/BACKUP.md` | `scripts/__tests__/rtl-pdpl.test.mjs` |
| REQ-RTL-10 | PART VII | No `deliver:` target that leaves the tailnet ships without its own ADR | — | — |
| REQ-RTL-11 | PART VII | Client data does not cross clients; committed artefacts name files and slugs, never individuals | `company/COMPANY.md` | `scripts/__tests__/rtl-pdpl.test.mjs` |
| REQ-RTL-12 | PART VII | Right to erasure is executable: unredacted traces that would make deletion impossible are prohibited | `company/COMPANY.md` | `scripts/__tests__/rtl-pdpl.test.mjs` |

### §1.4 Arabic note — implemented against their tokens

| ID | Spec § | Requirement | Implemented in | Verified by |
|---|---|---|---|---|
| REQ-RTL-13 | §1.4 | Body Arabic is IBM Plex Sans Arabic via `--font-arabic`; Instrument Serif never enters the Arabic fallback chain | `apps/web/src/styles/rtl.css` | `apps/web/src/styles/rtl.test.ts` |
| REQ-RTL-14 | §1.4 | `font-synthesis` is off; `:lang(ar)` italic/em/cite/`.u-accent` render upright at weight 600 | `apps/web/src/styles/rtl.css` | `apps/web/src/styles/rtl.test.ts` |
| REQ-RTL-15 | §1.4 | `--track-1…4` flatten to `normal` under `:lang(ar)` so every `tracking-wider-*` un-tracks in one place | `apps/web/src/styles/rtl.css` | `apps/web/src/styles/rtl.test.ts` |
| REQ-RTL-16 | §1.4 | Arabic labels rebuild emphasis as weight + word-spacing, never `letter-spacing`; size stays on the existing `text-label*` rung | `apps/web/src/styles/rtl.css` | `apps/web/src/styles/rtl.test.ts` |
| REQ-RTL-17 | §1.4 | Accent tracking is the `tracking-accent` utility (−0.01em), not a CSS literal | `apps/web/src/i18n/provider.tsx` | `scripts/__tests__/rtl-pdpl.test.mjs` |
| REQ-RTL-18 | §1.4 | `rtl.css` contains no `font-size:` / `letter-spacing:` type literal and no hex | `apps/web/src/styles/rtl.css` | `scripts/check-tokens.mjs` · `apps/web/src/styles/rtl.test.ts` |
| REQ-RTL-19 | §1.4 | MSA interface labels are noun-form (تشغيل, جدولة, إرسال, اختيار), not imperatives | `apps/web/src/i18n/strings.ar.ts` | `apps/web/src/i18n/i18n.test.ts` |
| REQ-RTL-20 | §1.4 | Copy is complete sentences or complete labels; no fragments concatenated at the call site; no `N item(s)` | `apps/web/src/i18n/entry.ts` · `apps/web/src/i18n/strings.en.ts` | `apps/web/src/i18n/i18n.test.ts` |
| REQ-RTL-21 | §1.4 | Arabic plurals use all six CLDR classes including the dual | `apps/web/src/i18n/entry.ts` · `apps/web/src/i18n/t.ts` | `apps/web/src/i18n/i18n.test.ts` |
| REQ-RTL-22 | §1.4 | Numerals are Western digits with `tabular-nums`; formatters isolate LTR runs in Arabic | `apps/web/src/i18n/config.ts` · `apps/web/src/i18n/format.ts` | `apps/web/src/i18n/i18n.test.ts` |
| REQ-RTL-23 | §1.4 | `dir="rtl"` on the root flips drawers (map inline-start, chart inline-end), rails, breadcrumbs, segmented order | `apps/web/src/styles/rtl.css` · `apps/web/src/i18n/direction.ts` | `apps/web/src/styles/rtl.test.ts` |
| REQ-RTL-24 | §1.4 | Layout uses logical properties (`inset-inline-*`, `margin-inline-*`, `border-inline-*`); physical `left`/`right` fail `check-rtl.mjs` unless `rtl-exempt:` | `scripts/check-rtl.mjs` | `scripts/__tests__/rtl-pdpl.test.mjs` |
| REQ-RTL-25 | §1.4 | The galaxy, charts, phase columns, progress and consoles do not mirror | `apps/web/src/i18n/direction.ts` | `apps/web/src/i18n/i18n.test.ts` |
| REQ-RTL-26 | §1.4 | Root `lang`/`dir` come from `i18n/config.ts`; `<I18nProvider>` wraps the tree | `apps/web/src/app/layout.tsx` | `scripts/__tests__/rtl-pdpl.test.mjs` |
| REQ-RTL-27 | §1.4 | `rtl.css` is imported from `globals.css` after `tokens.css` | `apps/web/src/app/globals.css` | `scripts/__tests__/rtl-pdpl.test.mjs` |
| REQ-RTL-28 | §1.4 | Hardcoded user-facing copy in `apps/web/src` fails `check-rtl.mjs`; the catalogue is the only place strings live | `scripts/check-rtl.mjs` | `scripts/__tests__/rtl-pdpl.test.mjs` |
| REQ-RTL-29 | §1.4 | Headline accent phrases are marked `[[like this]]` so a translator moves the emphasis; Latin renders serif italic, Arabic weight contrast | `apps/web/src/i18n/t.ts` · `apps/web/src/i18n/provider.tsx` | `apps/web/src/i18n/i18n.test.ts` |
| REQ-RTL-30 | §1.4 | Drawers slide with `--dir` / `inlineSign()`, never `locale === 'ar'` inside a component | `apps/web/src/styles/rtl.css` · `apps/web/src/i18n/direction.ts` | `apps/web/src/i18n/i18n.test.ts` |

### What the checker must be able to SEE — added 2026-08-17 after the M15 verdict

Each of the four below was a silence somebody read as a pass, and each is written as a
property of `check-rtl.mjs` rather than of the code it scans, because the failure was never
"an agent added a string" — it was "the counter could not move."

| ID | Spec § | Requirement | Impl | Test |
|---|---|---|---|---|
| REQ-RTL-31 | §1.4 | A template literal with no `${}` is scanned as a plain string literal, in an attribute and anywhere else; the `assembled-template` blind spot covers only genuinely interpolated ones | `scripts/check-rtl.mjs` | `scripts/__tests__/rtl-pdpl.test.mjs` |
| REQ-RTL-32 | §1.4 | Machine-context suppression is judged on the code skeleton, so a sentence cannot silence its own finding by containing `to`, `it`, `as`, `name`, `key` or `type` | `scripts/check-rtl.mjs` | `scripts/__tests__/rtl-pdpl.test.mjs` |
| REQ-RTL-33 | §1.4 | An Arabic plural entry missing `one`/`two`/`few`/`many`/`other`, or missing a class English declares, is a finding — type-checking cannot see it because `Plural`'s classes are optional | `scripts/check-rtl.mjs` · `apps/web/src/i18n/entry.ts` | `scripts/__tests__/rtl-pdpl.test.mjs` |
| REQ-RTL-34 | §1.4 | Catalogue-integrity rules bypass the ratchet: `missing-catalogue`, `missing-translation`, `missing-plural-class`, `orphan-translation` fail `--gate` at any baseline | `scripts/check-rtl.mjs` · `scripts/rtl-baseline.json` | `scripts/__tests__/rtl-pdpl.test.mjs` |
| REQ-RTL-35 | §1.4 | Every number the checker prints names what it counted: keys vs strings vs plural classes, `todo()` call sites vs `TODO(ar)` markers, and one blind-spot id per measured root | `scripts/check-rtl.mjs` | `scripts/__tests__/rtl-pdpl.test.mjs` |
| REQ-RTL-36 | §1.4 | `elementDirection` / `inlineStep` have exactly one home, `i18n/direction.ts`, exported from `@/i18n`; `chart/model/direction.ts` is a re-export | `apps/web/src/i18n/direction.ts` · `apps/web/src/i18n/index.ts` | `apps/web/src/chart/model/direction.test.ts` |

## Interfaces we expose

- `apps/web/src/i18n` — `useI18n()`, `useT()`, `<I18nProvider>`, `<Accented>`, `t()`, formatters, `inlineSign()`, `DRAWER_ANCHOR`, `MIRRORS` / `DOES_NOT_MIRROR`.
- CSS roles in `styles/rtl.css`: `.u-label` `.u-eyebrow` `.u-tab` `.u-accent` `.u-nums` `.u-ltr-island` `.u-rtl` `.u-drawer-start` `.u-drawer-end` `.u-mirror` `.u-rail` `.u-start` `.u-end` plus `--dir` and `--to-inline-end` / `--to-inline-start`.
- `scripts/check-rtl.mjs` (`npm run validate:rtl`) — physical properties, wide tracking on translatable text, hardcoded copy, catalogue parity.
- `company/COMPANY.md` §7 — PDPL standing policy injected into every run.

## Interfaces we consume

- `comms/contracts/design-tokens.md` — `--track-1…4`, `--font-sans/serif/arabic`, type utilities `text-label*` `tracking-accent` `tracking-wider-1…4`, `--dur-drawer` `--ease-drawer` `--border-w` `--line`. Owner: `design-system-guardian`.
- `apps/web/src/styles/fonts.ts` — the three `@fontsource` families, including IBM Plex Sans Arabic. Owner: `design-system-guardian`.
- `apps/runner/src/observability/redact.ts` + `redaction-rules.ts` — instrumentation redaction. Owner: `observability-engineer`; rule *contents* jointly owned.
- `infra/BACKUP.md` + named local volumes. Owner: `infra-compose-engineer`.
- `comms/contracts/frontmatter-schema.md` — `deliver:` is a data-egress decision if the target leaves the tailnet.

## Test plan

- **Unit (node:test):** `scripts/__tests__/rtl-pdpl.test.mjs` — type literals in `rtl.css`, catalogue parity, empty-state honesty, COMPANY.md PDPL block, `scanText` physical-property rule.
- **Unit (vitest):** `apps/web/src/styles/rtl.test.ts` and `apps/web/src/i18n/i18n.test.ts` — flattening, no italic, logical drawers, dual plural, isolates, accent phrases.
- **CI grep:** `npm run validate:tokens` must report zero findings on `apps/web/src/styles/rtl.css`. `npm run validate:rtl` is available; it is not yet in `verify` because other agents' in-progress components still carry physical utilities — wiring it into the gate is M8.
- **Not automatable:** native-speaker pass on MSA register and rail-label rotation sense; 1440px RTL screenshot against the Latin frame (Part VI, M8). `fidelity-qa-reviewer` owns that gate.

## Deliberately not done

- **Locale switching UI.** Default is English LTR. A language control, cookie, and `?lang=` are M8 polish, after chrome exists to put them in. `lang`/`dir` already read from config so the switch is one assignment.
- **Optical 1.08em Arabic label scale.** IBM Plex renders smaller than Jakarta at the same px. Compensating with a literal fails the token checker; a new rung would be a type scale we do not own. Weight + word-spacing ship; a `--ar-label-scale` multiplier waits on `design-system-guardian`.
- **`--track-accent` as a CSS variable.** Contract §8 already publishes the `tracking-accent` *utility*. We consume that. Publishing a custom property is their file.
- **Wiring `validate:rtl` into `npm run verify`.** The checker is real and fails on physical `ml-*` / hardcoded copy in other agents' WIP. Turning it into a repo gate during M0 would punish parallel work. M8, when we lead polish.
- **A `deliver:` egress ADR.** None is shipping. BOARD's open question stays open until a named target (Slack, email) is proposed. We will not file a placeholder ADR that blesses a destination.
- **Light-theme parity, edge pulses, count-up, mobile QA.** The rest of the M8 polish list. Empty-state *copy* is in the catalogue; the components that render it belong to the view owners.
- **Native review of `drawer.action.take`.** The English idiom has no honest MSA noun yet; it is `todo('Take it')` and countable.
- **Retrofitting every existing component to logical properties.** `check-rtl.mjs` is the cheap path while they are written. A repo-wide rewrite of `margin-left` in chart/shell/drawer is those owners' files; we do not fork their components.
- **Arabic-Indic numerals.** Western digits with `tabular-nums` until a human asks otherwise.
- **Dialect (not MSA) per channel.** COMPANY.md Q15 is unanswered; the interview owns it. The UI register stays MSA until that answer exists.
