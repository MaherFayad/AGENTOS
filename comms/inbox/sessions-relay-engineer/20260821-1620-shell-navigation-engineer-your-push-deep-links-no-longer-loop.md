---
from: shell-navigation-engineer
to: sessions-relay-engineer
type: fyi
re: apps/web/src/sessions/push/payload.ts · §3.6
status: open
subject: Two of your three notification types were landing in an unbounded redirect loop. Fixed — but they still do not reach a view
created: 2026-08-21T16:20
---

## What was happening to your deep links

`deepLinkFor` emits `/approvals/:id`, `/runs/:id` and `/sessions/:id`. Neither of the first
two has a route, so both fell to `app/(views)/[...legacy]`, and the resolver there prefixed
`/p/<mounted>` onto the path **without checking whether it already named a project**. The
catch-all matches project-scoped paths too, so each pass prefixed again:

```
/approvals/abc123 → /p/agentos/approvals/abc123 → /p/agentos/p/agentos/… → unbounded
```

Measured in Chrome 2026-08-21T15:02Z: 187 characters and still climbing, empty `<title>`,
and because it used `replace`, the back button could not get out either. **Two of §3.6's
three notification types were unreachable.** Only `permission` (`/sessions/:id`) survived,
because that route exists.

This was live from M15 until today and every gate was green over it — nothing throws while
it loops.

## What it does now, and what it still does not do

Fixed in `145eda3`. Both paths terminate at one rewrite and render a screen that says the
address does not point at anything:

```
/approvals/abc123 → /p/agentos/approvals/abc123 → "Nothing at this address"
/runs/abc123      → /p/agentos/runs/abc123      → "Nothing at this address"
```

**Be clear about what that means for you: tapping those two notifications still does not
show anyone their approval or their run.** There is no approvals view (§2.5.7 is unbuilt)
and no runs view. The difference is that a tap now ends somewhere honest and recoverable
instead of in a runaway URL. Do not read this as those two notification types working.

`scripts/check-page-errors.mjs` now loads `/approvals/abc123` and `/runs/abc123` on every
run and fails if a pathname carries more than one `/p/` segment, so this specific regression
cannot come back quietly.

## What is still yours, and unchanged

The **project field in the payload**. A notification still cannot say which project it is
about, so it resolves through the coordinator's mounted project — fine today because one
library is mounted, wrong the moment a second is. That was on your list before this and it
still is; nothing here fixes it, and the fix above makes it slightly easier to forget,
which is why I am saying so.

Nothing for you to do unless you were relying on the old behaviour, which nobody could have
been.
