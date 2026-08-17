---
from: shell-navigation-engineer
to: sessions-relay-engineer
type: handoff-notice
re: apps/web/src/app/(views)/p/[project]/threads/ · apps/web/src/components/shell/route.ts
status: open
created: 2026-08-18T02:06
---

## Context

M16, `Plan §23.5`/`§23.8`: THREADS has replaced SESSIONS in the §2.0 tab bar. That was my
slice — the slot, not the view. You build what mounts in it. This is the part you need
before you write a line, because two of the three decisions are ones you could reasonably
have assumed the other way.

## What is waiting for you

**Two routes, both project-scoped (ADR-015), both `ViewMount` placeholders:**

```
apps/web/src/app/(views)/p/[project]/threads/page.tsx        → <ThreadsMount variant="list" />
apps/web/src/app/(views)/p/[project]/threads/[id]/page.tsx   → <ThreadsMount variant="one" />
```

Swap the element for your component; nothing in the shell changes. Delete
`threads/ThreadsMount.tsx` and its three `threads.mount.*` catalogue keys when you do —
they exist only so the scaffold was not untranslated English.

There is **no unscoped `/threads`**. Do not add one; an unscoped link resolves through
`LegacyRouteResolver`, which asks the coordinator rather than picking.

## The three decisions, and the two that will surprise you

**1. `/p/:project/threads/:id` takes an `ops.thread` uuid and nothing else.**

**2. `/p/:project/sessions/:id` is NOT redirected to it, and must never be.** A relay
session id is not an `ops.thread` uuid (`thread-model.md` §5.1), and your own §9.1 — *do
session threads get a mailbox* — is open, so there is no mapping to redirect through.
`/threads/<relay-session-id>` would resolve to a thread that does not exist, which is worse
than a 404, and it is where every push notification already on a home screen points
(`sessions/push/payload.ts:128`). `ShellRoute` carries **two** fields, `.thread` and
`.session`, and `route.test.ts` asserts neither ever holds the other's value. If you later
decide the two namespaces *do* map, that is an ADR, not a route change.

**3. `/p/:project/sessions` is also not redirected — for now, and this one is yours to
finish.** I would have redirected the list to `/threads`, but `/threads` is a placeholder
until you build it, and sending a screen that decrypts and lists real relay sessions to a
placeholder is a regression, not a replacement. So both session paths stay live as
**sub-views under the THREADS tab**: `parseShellRoute` maps them to `view: 'threads'`, the
tab lights, the breadcrumb says `ALL THREADS`.

**When your thread list can list session threads, `/p/:project/sessions` becomes a
redirect to `/p/:project/threads`.** That step is yours. The note is parked in
`app/(views)/p/[project]/sessions/page.tsx` where you will be standing. `/sessions/:id`
stays regardless.

## Two smaller things

- **`+ New session` still routes to `/sessions?new=1`** and still says "session". Spawning
  a CLI session is a different act from composing a thread; `Plan §23.10` renames the slot
  to `+ New` when your composer exists. Tell me when it does and I will move it — it is my
  file (`NewSessionAction.tsx`), one line.
- **No count on the tab, and there will not be one.** `SegmentedOption.badge` exists and is
  unused. §23.5 puts unread/next-up counts in the top-right pair beside `+ New`, not on a
  tab, and chrome is monochrome (§1.3) so a tinted dot was never available. If you need a
  count surfaced, that slot is mine and I will build it — ask.

## The ask

Nothing blocking. Confirm you are building against `/threads/:id = ops.thread uuid` rather
than a merged id space, since that is the one assumption that would be expensive to unwind
after the view exists.

## Meanwhile

Handoff is at `comms/handoffs/M16-shell-navigation-engineer-threads-replaces-sessions-in-the-tab-bar.md`;
review requested from `fidelity-qa-reviewer`. I am on the §3.6 push subscription flow next,
where deep-link payloads still carry no project field — the last unscoped sender in the
shell, and yours to add.

---

<!-- The RECIPIENT appends below and sets status: answered. The SENDER sets closed. -->
