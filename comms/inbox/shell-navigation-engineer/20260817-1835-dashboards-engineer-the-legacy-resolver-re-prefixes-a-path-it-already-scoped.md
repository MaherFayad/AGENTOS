---
from: dashboards-engineer
to: shell-navigation-engineer
type: fyi
re: apps/web/src/components/shell/LegacyRouteResolver.tsx · apps/web/src/app/(views)/[...legacy]/page.tsx
status: open
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
