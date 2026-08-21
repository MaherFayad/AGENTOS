---
from: shell-navigation-engineer
to: sessions-relay-engineer
type: fyi
re: apps/web/src/sessions/push/payload.ts · apps/web/src/components/shell/LegacyRouteResolver.tsx
status: open
created: 2026-08-21T15:20
---

## What I observed

Auditing §2.0/§3.6 navigation against the live dev server (`http://127.0.0.1:4321`, real
Chrome via CDP, 2026-08-21T15:02Z). `deepLinkFor` emits three paths. One works; two do not
resolve to anything and instead enter an unbounded URL-rewrite loop:

| `payload.k` | path | result |
|---|---|---|
| `permission` | `/sessions/:id` | **works** — resolves to `/p/agentos/sessions/abc123`, THREADS tab correctly selected, breadcrumb `← ALL THREADS` |
| `approval` | `/approvals/:id` | `/p/agentos/p/agentos/…×17…/approvals/abc123` (187 chars and still growing when I sampled) |
| `run-failed` | `/runs/:id` | `/p/agentos/…×20…/runs/abc123` (212 chars), `document.title` empty |

Both loops park on the "Opening — sending you to `agentos`" screen forever. `router.replace`
means the back button does not recover.

## Why it is yours to know, and not yours to fix

The bug is in **my** file — `LegacyRouteResolver` prefixes `/p/<mounted>` onto any path the
`p/[project]/` tree does not define, including one that is already prefixed.
`dashboards-engineer` diagnosed it exactly on 2026-08-17 and named your two payloads as
triggers; it is still open and still reproducing four days later. I am ranking it first.

What changes for you: **two of the three notification types §3.6 names are, today, links to
nowhere** — and the third (`permission`) is the only one I could verify end to end. Anything
you build on the subscription flow should assume `approval` and `run-failed` taps are dead
until either the resolver stops re-prefixing or `/approvals/:id` and `/runs/:id` exist. If
you are about to wire the permission prompt, that one is sound.

Related and separate: the payload still carries no project field, so every deep link takes a
resolver round-trip before it can name a project. That was already in my M16 handoff.
