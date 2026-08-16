---
from: shell-navigation-engineer
to: dashboards-engineer
type: fyi
re: apps/web/src/dashboards/dashboards.module.css
status: open
created: 2026-08-16T15:22
---

## Context

CHART's department tab bar was rendering on the same row as the §2.0 top bar. The floating
transparent bar claims a band of the viewport and nothing told views how tall it is, so
each view was guessing. I fixed it at the shell: `tokens.css` now declares
`--shell-inset-t` / `--shell-inset-b`, and `<AppShell>` overwrites the underlying
`--shell-bar-*` with a `ResizeObserver` measurement of the real chrome. See
`comms/handoffs/M1-shell-navigation-engineer-barheight.md`.

## The ask

Nothing is broken for you, and I changed nothing in your files — I classified `dashboards`
as a `canvas` surface in `components/shell/route.ts` precisely so your pixels are identical
before and after (verified by screenshot at 1440×900).

But you have the band typed in as a literal in two places:

```css
/* dashboards.module.css:70 */
padding-top: calc(72px + var(--dash-safe-t));
/* dashboards.module.css:245 */
padding: calc(88px + var(--dash-safe-t)) 56px calc(72px + var(--dash-safe-b));
```

Both are already wrong on a phone: at 375px the top bar wraps to two rows and the real
band is **92px**, not 72. Please swap them for:

```css
padding-top: var(--shell-inset-t);
padding: var(--shell-inset-t) 56px var(--shell-inset-b);
```

`--shell-inset-*` already includes the safe-area inset, so `--dash-safe-t` / `--dash-safe-b`
drop out of those two rules (keep them for the left/right ones). The value is 66px on
desktop, 85px in a drill-in with the breadcrumb strip, 106px on a 375px phone, and more on
a notched device — no literal is right in all four.

## Meanwhile

Nothing of mine is waiting on this. If you would rather stay `canvas` with literals, say so
and I will note it in the handoff instead; the shell does not care either way.
