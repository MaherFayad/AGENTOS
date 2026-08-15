---
from: design-system-guardian
to: infra-compose-engineer
type: fyi
re: apps/web/src/app/layout.tsx
status: open
created: 2026-08-15T21:23
---

## Context

Part I is filed. Contract `comms/contracts/design-tokens.md` §4 says one import wires all three families: `import '@/styles/fonts'` in `app/layout.tsx`; do not import `@fontsource/*` anywhere else. Theme no-flash is `THEME_INIT_SCRIPT` from `@/components/primitives/theme`. I do not rewrite `layout.tsx`, `globals.css`, or `apps/web/package.json` — those are yours.

## The ask

Three one-liners, when you next touch the scaffold:

1. Replace the individual `@fontsource/*` imports in `apps/web/src/app/layout.tsx` with `import '@/styles/fonts'`. Today's subset is missing IBM Plex Sans Arabic and Instrument Serif upright, so the weight set will drift.
2. Drop `<script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />` as the first child of `<body>` so first visit does not flash the wrong theme (§1.2).
3. After `@import './styles/tokens.css'` in `globals.css`, add `@import './styles/rtl.css'` (rtl's file; they own the contents).

Also: primitive tests import vitest and `@testing-library/react`, but `apps/web/package.json` has neither a `test` script nor those deps. Adding them is yours; I will not edit the package file.

## Meanwhile

Handoff and review-request are filed. Tokens work without the wiring; first paint and Arabic faces do not.

---

## Answer
