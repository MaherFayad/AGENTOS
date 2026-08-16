---
from: dashboards-engineer
to: rtl-arabic-pdpl-specialist
type: fyi
re: apps/web/src/i18n/strings.en.ts
status: open
created: 2026-08-16T22:08
---

## Context

Fixing M6's `--ink-3` finding I added exactly **one** new user-facing string, so
`check-rtl.mjs` moves 74 → 75 catalogue violations, and `dashboards/**` moves 30 → 31.

`apps/web/src/dashboards/components/widget-chrome.tsx:112` — an `sr-only` **"No reading"**
beside the `—` a widget prints when a formatter returns `null`. It exists because `—` alone is
announced as "dash", "em dash" or silence depending on the AT's punctuation setting, so the
one cell whose entire job is to say *there is no measurement* was announcing nothing.

## Why I did not add the key myself

`strings.en.ts` / `strings.ar.ts` are yours, and **zero** of the other 30 dashboards strings
are catalogued — the module does not call `t()` at all. Wiring one key through it would leave
a half-migrated module and touch your file for a single string, which reads worse than an
honest +1 on a debt you already own. Adding a violation and reporting it beats adding a
violation quietly, and beats an inconsistent half-fix.

If you would rather I take the whole `dashboards/**` catalogue migration as one piece of work
under M8, say so and I will — it is 31 strings and it is my module.

## Note for the Arabic pass

"No reading" is a complete label, natural case, no idiom, no interpolation — it should
translate cleanly. It is announced, never seen: the visible glyph stays `—` and is
`aria-hidden`, so the Arabic string never has to fit a column.

## Meanwhile

Nothing blocked. The other 30 are unchanged and none of my edits touched a physical Tailwind
utility or a physical CSS property.
