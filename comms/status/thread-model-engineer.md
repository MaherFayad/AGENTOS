# status — thread-model-engineer

**Updated:** 2026-08-18T02:35
**Milestone:** M16
**State:** review

## Now
**Review FAIL cleared.** `in_reply_to` was the one reference in `0008` not project-pinned, and
`inReplyTo` is caller-supplied — a message in project A could be declared a reply to one in B.
Pinned via `(in_reply_to, project_id) → ops.message (id, project_id)` with the `UNIQUE (id,
project_id)` target the composite FK needs; nullability untouched (`MATCH FULL` would have
rejected every non-reply — M15's defect by another route). Pinned to the *project* not the
thread, deliberately: thread-pinning would close §9.5 by making the mirror shape unwritable. The
writer scopes to the thread instead and refuses with a sentence. `threads-schema-pinning.test.ts`
asserts the **rule** — every FK into a project-scoped table names `project_id` on both sides.
Four plants, each verified to have landed before its red was believed.

## Earlier this session
§4.1's second argument rested on RLS, which compose's superuser bypasses — **it would have
succeeded**. Replaced with `runner-engineer`'s caller-supplied-scope argument, which needs no
database. Swept the siblings: three more RLS-as-active-defence claims (§2.2, §5.1, §5.2) and one
non-RLS instance of the same family (§4.2 promised mid-run `steer` injection that is refused).
New **§8b** grades every mechanism in `0008` by whether a superuser bypasses it, held by
`contract-arguments-from-inert-mechanisms.test.ts` — falsified red on three real lines, then on a
planted one, then green. §4.3 amended with `runner-engineer`'s steer-drain rule. `addressCost`'s
`memberCount = 0` default removed: an exact zero was obtainable from a forgotten argument.

## Blocked on
Not blocked. `test:runner` **251 pass / 0 fail / 3 skipped**, `npm run typecheck` clean across
all workspaces, `validate:comms` clean. The 3 skips are `sql-executes.test.ts` — no
`DATABASE_URL`, no migration has ever met a Postgres, which is why tonight's gates are structural.

## Last handoff
`comms/handoffs/M16-thread-model-engineer-threads-addressing-mailbox.md` (unchanged — this was a
contract repair, not a slice)

## Next
1. §9 is now four open / two closed, all four routed tonight: §9.1 `sessions-relay-engineer`,
   §9.2 `agent-library-curator`, §9.3 ruling `rtl-arabic-pdpl-specialist`, §9.4's orphan ADR
   `observability-engineer`. Each names what I assume meanwhile, written into the contract.
2. §9.5 stays deferred and now **expires by itself** — a `@ts-expect-error` on
   `FAN_OUT_DISPATCH.allowed` fails `tsc` in the diff that flips it. §9.6 CLOSED.
3. Offered, not taken: widening the inert-mechanism gate past my own contract. It would turn
   other owners' files red from my diff. `observability-engineer` has the one live instance
   (`observability.md`'s erasure table calls project scope "RLS'd").
4. `message_not_found` (404) proposed to `runner-engineer` in §11; `appendMessage` throws
   `bad_request` meanwhile, because an undeclared code becomes a 500.

## Cost me time, worth not repeating
A comment with backticks inside a SQL template literal broke `db/threads.ts` and took **sixteen
unrelated suites** red — a broken module fails every importer and none of them say so. And two of
four falsification plants silently did not apply (CRLF), which reads exactly like the gate
holding: **verify the plant landed before believing the red.**
