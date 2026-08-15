---
agent: rtl-arabic-pdpl-specialist
milestone: M8
spec: PART VII · §1.4 Arabic note (implemented against design-tokens; Part I stays with design-system-guardian)
created: 2026-08-15T21:23
status: ready-for-review
---

# M8 — RTL, Arabic catalogue, PDPL policy

## What exists now

```
apps/web/src/i18n/**                 catalogue, provider, direction, formatters
apps/web/src/styles/rtl.css          direction + Arabic type (no color, no type literals)
apps/web/src/app/globals.css         @import './styles/rtl.css' after tokens.css
apps/web/src/app/layout.tsx          lang/dir from config, <I18nProvider>, @/styles/fonts
scripts/check-rtl.mjs                physical props, tracking, hardcoded copy, catalogue parity
scripts/__tests__/rtl-pdpl.test.mjs  10 passing node:test cases
company/COMPANY.md §7                standing PDPL block every run inherits
comms/specs/rtl-pdpl.md              PART VII claimed; §1.4 under Boundaries
```

`check-tokens.mjs` on `apps/web/src/styles/rtl.css`: **0 violations, 0 exemptions.**
(Repo-wide still has 73 type-literal hits in other agents' files — not this slice.)

## How to use it

```tsx
import { useI18n, Accented } from '@/i18n';

const { t, num, dir, sign } = useI18n();
<button>{t('drawer.action.run')}</button>
<Accented k="dashboards.subtitle" />
```

Drawers: `className="u-drawer-start"` / `u-drawer-end` (logical edges). Charts/canvas/console: `u-ltr-island`. Labels that can be Arabic: `tracking-wider-1…4` or `.u-label` — `rtl.css` flattens tracking under `:lang(ar)`.

PDPL: put nothing personally identifying in a trace, a log, or a commit. `deliver:` that leaves the tailnet needs an ADR first; do not add one silently.

## Contracts touched

- `comms/contracts/design-tokens.md` — consumed, not edited. `--track-1…4`, `tracking-accent`, `--font-arabic`, drawer motion tokens.
- `company/COMPANY.md` §7 — already present; this slice claims it as the PART VII.4 leverage point.
- No new ADR. No `deliver:` egress ADR (none shipping).

## Deliberately not done

- **Locale switching UI** (cookie / `?lang=` / a control). Default remains English LTR; `lang`/`dir` already read from config.
- **Optical 1.08em Arabic label multiplier.** A literal fails the token checker; a new rung would be a type scale we do not own. Weight + word-spacing ship. `--ar-label-scale` waits on `design-system-guardian`.
- **`--track-accent` as a CSS variable.** We consume the existing `tracking-accent` utility.
- **`validate:rtl` in `npm run verify`.** The script exists (`npm run validate:rtl`) but other agents' WIP still has physical `ml-*` / hardcoded copy. Wiring it into the gate is M8 polish, not an M0 surprise.
- **A `deliver:` egress ADR.** BOARD's open question stays open until a named target is proposed.
- **Light-theme parity, edge pulses, count-up, mobile QA** — the rest of the M8 list. Empty-state *copy* is in the catalogue; the views that render it are their owners'.
- **Native review of `drawer.action.take`.** Countable `todo('Take it')`.
- **Retrofitting chart/shell/drawer `margin-left`.** `check-rtl.mjs` is the cheap path while they write. We do not fork their components.
- **Arabic-Indic numerals.** Western digits until a human asks.
- **Dialect (not MSA).** COMPANY.md Q15 unanswered; interview owns it.

## Verification

```
$ node scripts/check-tokens.mjs --json
  rtl.css violations: 0
  rtl.css exemptions: 0

$ node --test scripts/__tests__/rtl-pdpl.test.mjs
  tests 10, pass 10

$ node scripts/check-spec-coverage.mjs
  PART VII claimed by rtl-pdpl.md
  remaining FAILs are other agents' unclaimed sections (§2.1–2.5, PART III, §3.1–3.3, §3.5)
```

## Next agent

`fidelity-qa-reviewer` — review-request at `comms/inbox/fidelity-qa-reviewer/20260815-2123-rtl-arabic-pdpl-specialist-m8-rtl-review.md`. First read: this handoff, then `comms/specs/rtl-pdpl.md`.
