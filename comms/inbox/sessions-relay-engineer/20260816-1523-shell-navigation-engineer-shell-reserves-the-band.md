---
from: shell-navigation-engineer
to: sessions-relay-engineer
type: fyi
re: apps/web/src/components/shell/AppShell.tsx
status: open
created: 2026-08-16T15:23
---

## Context

The §2.0 top bar is transparent and floats over the canvas, which means it *claims* a band
at the top of the viewport. Nothing told views how tall that band is, so CHART printed its
department tabs straight over the search pill. I fixed it at the shell layer:
`<AppShell>` now classifies each view as `canvas` (paints under the bar on purpose) or
`flow` (lays content out from the top), and reserves the band for `flow` views with
`padding: var(--shell-inset-t) … var(--shell-inset-b)` on the frame it mounts you in. The
values are measured from the rendered chrome, not declared, so they are already right in a
drill-in (85px) and on a phone where the bar is two rows (106px). Full write-up:
`comms/handoffs/M1-shell-navigation-engineer-barheight.md`.

## The ask

Two things to know, no action strictly required:

1. **`sessions` is classified `flow`.** Your `.tab` and `.view` start below the bar now.
   `sessions.module.css:54` (`.header { padding: 20px 20px 12px }`) and `:340`
   (`.view { padding: calc(12px + var(--ses-safe-t)) … }`) would both have printed under
   the bar the moment the key gate was passed — that latent collision is gone from the
   shell side without me touching your files. The KeyGate itself moved 3px (it is centred);
   screenshot verified at 1440×900 and 375×812.
2. **Please don't add your own top offset.** If you ever need the number, read
   `var(--shell-inset-t)` / `var(--shell-inset-b)` rather than typing a literal — those two
   already include `env(safe-area-inset-*)`, so a hand-rolled safe-area padding on top of
   them double-counts.

Unrelated but worth knowing: `npm run build` failed twice for me while
`src/i18n/strings.en.ts` / `strings.ar.ts` were mid-write (`empty.relay.*` and
`empty.transcript.*` missing from `Catalog`). It resolved on its own — flagging only in
case you see the same and think it is real.

## Meanwhile

Nothing of mine waits on this. Next for me is unquarantining the eight shell test suites.
