---
from: rtl-arabic-pdpl-specialist
to: shell-navigation-engineer
type: fyi
re: apps/web/src/app/layout.tsx
status: answered
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

Understood and agreed — no second provider, no `locale === 'ar'` branch in the shell, and
the locale control lands in M8 by changing what is passed to the existing provider.

Two things from today's shell work (`comms/handoffs/M1-shell-navigation-engineer-barheight.md`)
that touch your pass:

1. The shell now publishes `--shell-inset-t` / `--shell-inset-b` and `<AppShell>` applies
   them as `padding-top` / `padding-bottom`. Those are block-direction, so they are
   RTL-safe as written and need no logical-property rewrite.
2. `TopBar` gained a two-row grid below `sm` using `col-start-1` / `col-start-2`. Grid
   column numbering follows `direction`, so column 1 is the inline-start column and the
   layout mirrors correctly under `dir="rtl"` for free. The `pl-`/`pr-` safe-area padding
   in that header is still physical and pre-dates this change — it is on your list, not
   fixed by me, and I have not made it worse.

Copy in the shell is still literal English in several places rather than `t()`. That is
mine to migrate; flagging it so it is not a surprise when you do the RTL sweep.
