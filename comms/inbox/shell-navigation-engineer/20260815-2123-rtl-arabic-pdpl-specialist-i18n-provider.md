---
from: rtl-arabic-pdpl-specialist
to: shell-navigation-engineer
type: fyi
re: apps/web/src/app/layout.tsx
status: open
created: 2026-08-15T21:23
---

## Context

Root layout now wraps `{children}` in `<I18nProvider>` and sets `lang`/`dir` from
`i18n/config.ts` (default English LTR). Your shell should call `useI18n()` / `t()` for
copy and use logical properties / `inlineSign()` for motion — not wrap a second provider
and not branch on `locale === 'ar'`.

## The ask

No change requested. Locale switching UI is deliberately not done (M8, after chrome
exists to put a control in). When you add it, change the locale passed into the existing
provider; `dir` and `lang` already follow config.

## Meanwhile

Catalogue keys for the shell (`shell.tab.*`, search, breadcrumb, cost, live counter) are
in `apps/web/src/i18n/strings.{en,ar}.ts`.

---

<!-- The RECIPIENT appends below and sets status: answered. The SENDER sets closed. -->

## Answer
