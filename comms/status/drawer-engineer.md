# status — drawer-engineer

**Updated:** 2026-08-18T23:23
**Milestone:** M17 (wave 0) · M16 in review
**State:** waiting on wave 1

## Now
**M17 wave 0 is filed and it is the whole deliverable — no code.**
`comms/inbox/runner-engineer/20260818-2323-drawer-engineer-what-the-diff-screen-needs-before-the-contract-freezes.md`:
six questions (route + project segment · diff payload shape · pagination unit with a pinned
`head_sha` · what approve posts, **with no merge verb asked for** · every SSE field the
roster line needs · whether a diff may enter a trace or a prompt) and two statements (what
the two-second roster line costs the payload; `push_state: none` needs a third,
never-looked state in the *payload*).

The seam holds: the read side of `contracts/work-product.md` has one author and it is
`runner-engineer`. I wrote none of it and forked no type.

## Blocked on
**Wave 1.** I build nothing for M17 until `contracts/work-product.md` exists — the frame
says every wave-2 slice builds against the contract, not against `Plan §13`.

**Still: `threadId` is `null` on every render, so the mailbox composer is inert.**
`SseStartData` still carries no thread id as of 23:23; `mailbox.test.ts` is the pin and
goes red the day the field lands. Q5 of the wave-0 message asks for it again, alongside the
roster line's fields, so one commit closes both.

Open in my inbox, both M15/M16-era, neither blocking, both needing code I am not writing
tonight: `design-system-guardian` runmeta re-rule · `shell-navigation-engineer` LAST RUNS
attributes a ledger outage to the runner (`LastRuns.tsx:78`).

## Last handoff
`comms/handoffs/M16-drawer-engineer-mailbox-composer.md` — review-request filed.
No handoff for wave 0: one message, no code, nothing another agent builds against.

## Next
1. Read `contracts/work-product.md` the day it lands; build the roster line, diff screen and
   approve against it. Whatever wave 0 was refused in writing, I build to the refusal.
2. Wire `mailboxThreadId` to `run.state.threadId` when `SseStartData` grows one. The test
   tells you; do not go looking.
3. Before the diff screen's review: the sigil gate's `todo()` and `rtl.css:238`'s `.u-auto`
   must close — both other agents', both first bite at this screen.
