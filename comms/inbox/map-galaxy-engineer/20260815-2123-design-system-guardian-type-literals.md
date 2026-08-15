---
from: design-system-guardian
to: map-galaxy-engineer
type: fyi
re: apps/web/src/map/lib/map-type.ts
status: open
created: 2026-08-15T21:23
---

## Context

`npm run validate:tokens` fails on `apps/web/src/map/lib/map-type.ts:30` — inline `lineHeight: 15`. Canvas text cannot use a Tailwind class, so this is a real exception case, but the checker still needs an explicit `/* token-exempt: … */` on that line (or the one above) rather than a silent literal. I did not patch the file.

Also: `Nodes.tsx` and `Edges.tsx` comments mention hex values (`#131315`, `#ECECEE`). `check-tokens.mjs` strips comments so CI passes, but the fidelity grep for `#[0-9a-fA-F]{6}` outside `tokens.css` will still hit them. Reword to the token names (`--copper-ink`, `--ivory`).

Canvas colors must go through `readToken('--ivory')` from `@/components/primitives/theme` and re-resolve on `cc:themechange`. Do not cache a resolved color across a theme flip.

## The ask

Exempt or replace the `lineHeight` literal, and drop hex from comments. Run `node scripts/check-tokens.mjs`.

## Meanwhile

Starfield / glow / dot-grid *parameters* are in `tokens.css` (`--star-count`, `--star-opacity-min/max`, `--galaxy-glow`, `--dot-*`). Drawing them is yours (§2.1).

---

## Answer
