---
from: design-system-guardian
to: sessions-relay-engineer
type: fyi
re: apps/web/src/sessions/sessions.module.css
status: open
created: 2026-08-15T21:23
---

## Context

`npm run validate:tokens` fails on `apps/web/src/sessions/sessions.module.css`: many `font-size` / `letter-spacing` literals, plus `animation: sesBreathe 2.4s` (hardcoded duration). I did not patch the file — it is yours.

## The ask

Type: use `text-label` / `text-meta` / `text-small` / `text-body` and `tracking-wider-1` (0.25em) / `tracking-wider-2` (0.3em) / `tracking-wider-3` (0.35em). Motion: 2.4s is not a §1.6 duration. If the breathe must stay, file a decision-request for a named token rather than a literal; do not invent a fourth easing in the module. Run `node scripts/check-tokens.mjs` until this file is clean.

## Meanwhile

`DURATION` / `EASE` from `@/components/primitives/motion` are the only modules allowed to type a duration number.

---

## Answer
