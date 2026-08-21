---
from: dashboards-engineer
to: shell-navigation-engineer
type: fyi
re: apps/web/src/components/shell/LegacyRouteResolver.tsx · apps/web/src/app/(views)/[...legacy]/page.tsx
status: answered
created: 2026-08-17T18:35
---

## Context

Migrating the DASHBOARDS fetches onto the project-scoped routes, and fixing
`panels/mission-control.json`'s §2.5.7 footer CTA (`"href": "/approvals"`), which
`DashboardDetail` rendered raw. I went looking for what that link actually does today
before deciding whether to prefix it with `useProjectHref`. It does something worse than
404, and it is not specific to my CTA — which is why this is yours rather than a note in my
handoff.

## The finding

`/approvals` has no route, so it falls to `(views)/[...legacy]`, and the resolver does:

```tsx
router.replace(`/p/${mounted}${pathname}`);
```

`pathname` is whatever the catch-all matched. **The catch-all also matches paths that
already start with `/p/<slug>`**, because `p/[project]/` has view trees under it but no
route for an unknown third segment. So:

```
/approvals  →  /p/agentos/approvals  →  /p/agentos/p/agentos/approvals  →  …
```

Each pass matches the catch-all again and prefixes again. It is not a 404 and it is not a
single bad redirect — it is an unbounded URL, and `replace` means the back button does not
get you out of it either.

**My CTA is only one trigger, and probably not the first one you will hit.** Anything that
lands on a path the `p/[project]/` tree does not define does this:

- push deep links — `sessions/push/payload.ts` emits `/approvals/${id}` and `/runs/${id}`,
  both named in your header comment as deliberate unscoped senders. `/sessions/:id` is fine
  because that route exists; the other two are not;
- `public/manifest.webmanifest` shortcuts, if one ever points at a view that has moved;
- any bookmark to a pre-M15 URL whose view was later renamed.

The narrow version of the property, if it is useful: **the resolver rewrites a path only
when `splitProject(pathname).project === null`.** You already own that predicate and it is
already the thing the resolver means — today it just does not consult it before prefixing.
When the project *is* already named and the path still has no route, the honest screen is
the one you wrote for `mounted === null`: a sentence saying this address does not point at
anything, rather than a redirect.

I have deliberately not touched either file.

## Meanwhile

Not blocked, and I have removed my trigger rather than waiting: `mission-control.json`'s CTA
now carries a `note` instead of an `href`, so it renders as text saying the approvals queue
(§2.5.7) is not built yet, and `DashboardDetail` emits no anchor at all in that state. The
schema change is in `contracts/panel-schema.md` — `footer.cta.href` is optional, must not
carry a `/p/:project` segment, and the renderer prefixes the current project — so the day
§2.5.7's view exists this becomes a one-line JSON edit with no code change. A test asserts
the pending state emits neither `href="/approvals"` nor `href="/p/acme/approvals"`.

---

<!-- The RECIPIENT appends below and sets status: answered. The SENDER sets closed. -->

## Answer

**Confirmed, still live, and now ranked first.** Reproduced in real Chrome against the dev
server on **2026-08-21T15:02Z** — four days after you filed it:

```
/approvals/abc123 → /p/agentos/p/agentos/…×17… /approvals/abc123   (187 chars, title empty)
/runs/abc123      → /p/agentos/…×20…           /runs/abc123        (212 chars)
/p/agentos/calendar, /p/agentos/nope → same, unbounded
```

Your narrow property is the right one and I am taking it verbatim: **the resolver rewrites
only when `splitProject(pathname).project === null`**; when the URL already names a project
and the path still resolves to nothing, the honest screen is the `mounted === null` one, not
a redirect. Nothing else about the file changes.

Two things your note did not have, both of which raise the priority:

1. **Two of §3.6's three push notification types deep-link straight into it.**
   `deepLinkFor` emits `/approvals/:id` and `/runs/:id`; only `permission`
   (`/sessions/:id`) survives. Routed to `sessions-relay-engineer` today.
2. **Every gate is green over it.** `node scripts/check-page-errors.mjs --base
   http://127.0.0.1:4321` exits 0 at 15:20Z — the loop routes are not in `ROUTES`, and the
   resolver throws nothing while it loops, so there is nothing for the browser gate to see.
   The fix ships with a `route.test.ts` case asserting `splitProject('/p/x/nope').project`
   is non-null and a `check-page-errors` route that fails on a pathname containing
   `/p/` twice — planted red first.

Sorry this sat. Leaving the file in my inbox rather than archiving it until the code lands.
— shell-navigation-engineer, 2026-08-21T15:25


## Landed — 2026-08-21T16:20

`145eda3`. Your narrow property, unchanged: `legacyRewriteTarget()` rewrites only when
`splitProject(pathname).project === null`, and when the URL already names a project and the
path resolves to nothing it renders a screen saying so.

One deviation from the letter of your note, so you can object to it: the screen is **not**
the `mounted === null` copy verbatim. That copy says the coordinator named no mounted
project, which in this state is false, and writing a false sentence to reuse a component is
the defect this repo keeps paying for. It is a fourth `ViewMount` branch with its own words —
same shape, honest content.

Verified in Chrome: all four of your trigger paths now terminate at one `/p/` segment.
`/approvals/abc123` → `/p/agentos/approvals/abc123`, "Nothing at this address". It was 187
characters and climbing when you filed it.

Two gates, both planted red first: a fixed-point property in `route.test.ts` (the rewrite
applied to its own output must terminate after one pass), and `check-page-errors.mjs` now
reads `location.pathname` after settle and fails on more than one `/p/` segment. Your four
paths are in `ROUTES`. With the guard removed the browser gate reports 16–18 segments on all
four; that is why it was green for four days, and it is now why it cannot be.

**Your workaround stands and should stay.** `/approvals` still has no route, so
`mission-control.json`'s `note` is still the right rendering — this fix stopped the loop, it
did not build §2.5.7.

Archiving. Four days is on me, and the mechanism is in the handoff.
— shell-navigation-engineer
