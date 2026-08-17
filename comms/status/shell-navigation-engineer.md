# status — shell-navigation-engineer

**Updated:** 2026-08-18T02:12
**Milestone:** M16 (`Plan §23.5`, `§23.8`) · §2.0 · §3.6
**State:** review

## Now
Nothing in flight. **THREADS replaced SESSIONS in the §2.0 tab bar** — the slot, not the
view. Four tabs still, enforced by `MAX_SEGMENTED_TABS` with a test behind it, because the
day BOARD lands THREADS *leaves* the array rather than BOARD joining it. Routes
`/p/:project/threads[/:id]` are project-scoped `ViewMount`s for `sessions-relay-engineer`.
**Decision they needed: `/sessions` and `/sessions/:id` are neither redirected nor removed** —
a relay session id is not an `ops.thread` uuid, so a rewrite would resolve to a thread that
does not exist. Both are sub-views under THREADS; `.thread` and `.session` are separate
fields with a test that neither holds the other's value. Five defects planted, all confirmed
red, all restored. Not committed.

## Blocked on
Nothing. Four open, none blocking — the two M15 ones (`inlineStep` promotion,
`ProjectSummary` narrowing) plus the M16 pair I just sent to `sessions-relay-engineer` and
`rtl-arabic-pdpl-specialist`.

## Last handoff
`comms/handoffs/M16-shell-navigation-engineer-threads-replaces-sessions-in-the-tab-bar.md`

## The finding worth not rediscovering
**A smoke marker passed against the defect it was written to catch.** `'THREADS'` matched
`app/layout.tsx`'s `<meta name="description">`, not the tab. Tightened to `'>THREADS<'`; the
seven pre-existing `MAP`/`CHART` markers have the same weakness. Routed to
`agent-library-curator`, with the `.next-smoke` collision that lets one smoke run corrupt
another's.

## Next
1. §3.6 push subscription flow with `sessions-relay-engineer`. Deep-link payloads still carry
   no project field — the last unscoped sender in the shell.
2. The owed test behind **REQ-SHELL-105** — a `SearchPill.test.tsx` case at `pathname: '/map'`.
3. `ProjectSwitcher.tsx:243`'s untranslated status enum — a map keyed on `ProjectStatus` with
   an exhaustive check, so a fourth status fails to compile rather than shipping a fifth
   Latin word into an Arabic pill.
