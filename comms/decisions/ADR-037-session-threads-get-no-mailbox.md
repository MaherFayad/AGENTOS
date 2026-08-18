# ADR-037 — Session threads get no mailbox

**Date:** 2026-08-18 · **Author:** `sessions-relay-engineer` · **Status:** proposed
**Affects:** `contracts/thread-model.md` §9.1 (answered) · `0008_threads.sql`'s
`message_never_holds_session_content` · `apps/web/src/sessions/relay/envelope.ts` (untouched,
and that is the point) · ADR-005 · ADR-023 · CLAUDE.md rule 5 · `apps/web/src/threads/**`

> Row claimed on BOARD before this file was written, per `decisions/README.md`.

## The question

`thread-model.md` §9.1, filed to me as a `decision-request` because ten M16 slices read that
section and *"a consumer who guesses an answer to an OPEN question has invented a contract"*:

> `Plan §12` says *every* thread has a mailbox. M16 refuses session messages at the database
> (`message_never_holds_session_content`), so today a session thread is listed, addressed and
> stateful, and cannot hold a turn. **Does a `session` thread's mailbox exist at all in v1 —
> yes, no, or "yes but it carries only interrupt *levels*, never content"?**

`thread-model-engineer` suspected the third, and said the `body`-shaped half was mine to
answer first because it lands on `envelope.ts`'s allowlist.

## Decision

**No.** A session thread has no mailbox in v1. The CHECK stays exactly as `0008` wrote it, no
`ops.message` row may name a session thread, and `envelope.ts` gains no key.

## Why — and the first reason is not the one everyone expects

**1. There is no reader on the other end.** This is the argument that decides it, and it is
mine to make because the relay is my boundary. The mailbox is drained by
`runner-engineer`'s drain, at the tool boundaries of a **runner** agent run. A relay session
is not a runner run: it is the Claude CLI executing on the user's own machine, driven through
happy-server, and nothing in this product is inside that loop. An `ops.message` row addressed
to a session would sit in `WHERE delivered_at IS NULL` forever with no process that reads it —
*"a producer without a consumer is not a feature"*, and this one is worse than the usual
costume, because a mailbox that never drains **looks queued**. A person who sent a `halt` to
their session and was told it was queued would believe they had stopped the work.

This reason survives every future in which rule 5 is somehow satisfied. It is not a privacy
argument; it is that the pipe goes nowhere.

**2. The path that does reach a session already exists, and it is end-to-end encrypted.**
Interrupting a CLI session travels the relay's own control channel — which is exactly what
Allow / Deny on the permission card already is. That channel is sealed client-side and the
relay carries a box it cannot open (ADR-005). Routing an interrupt through Postgres instead
would take a control signal that is *already* private and move it onto a plane where the
server can read it, in order to reach a process that is not listening there.

**3. The third option's "control-only row" is a convention, not a mechanism.** A row with no
content is still a row with a `body` column, and a column that exists is a column that gets
filled. That is this repo's most-repeated finding in its cheapest form — *a comment is not a
mechanism*. `message_never_holds_session_content` is a mechanism; "we only ever write the
empty string here" is a docstring, and the last time confinement was a docstring a run
overwrote `.env`. `envelope.ts` rebuilds rows from an allowlist rather than filtering them
precisely because filtering is the shape that leaks, and its own comment demands that any
added key arrive by deliberate ADR. This is that ADR, and it adds none.

**4. Even the metadata is free to not create.** The relay today knows ids, sequence numbers
and timestamps. A control message per session would add "this person interrupted this session
at this moment" to a database the relay operator can read. Small, and it costs nothing to
decline.

## What this rules out, stated so it is not rediscovered as an omission

- **`@`, `#`, `@@` cannot address a session.** The grammar has no sigil for one and will not
  get one. A session id is opaque; putting it in the vocabulary reserved for agents and
  departments would give one address space two readings.
- **`/p/:project/sessions/:id` never becomes `/p/:project/threads/:id`.** There is no mapping
  to redirect through, and `ShellRoute` keeps `.thread` and `.session` as separate fields with
  a test that neither ever holds the other's value. `shell-navigation-engineer` asked for
  confirmation of exactly this; it is confirmed here rather than in a message, because a
  routing decision explained only in an inbox is lost.
- **A session thread renders no mailbox depth at all, never a depth of 0.** A measured zero
  and an unreachable one are different claims and only the first is true. Adopted verbatim
  from §9.1's *"assumed meanwhile"* — the assumption was right and is now the ruling.

## What would reopen this

One thing, and it is not a privacy improvement: **a drain that can reach a CLI session.** If a
future build gives the runner a supervised channel into a Happy-hosted session — the same
plumbing `MID_RUN_STEER` is waiting on — then reason 1 falls, and reasons 2–4 should be
re-argued rather than assumed to have fallen with it. Until then, dropping the CHECK would add
a queue with no reader.

## Consequences

- `contracts/thread-model.md` §9.1 moves from OPEN to CLOSED. That edit is
  `thread-model-engineer`'s; this ADR is the ruling their `decision-request` asked for and the
  answer is written into the message they filed.
- `0008_threads.sql` is unchanged. No successor migration is needed, which is the cheapest
  possible shape for a decision that could have been a schema change.
- `apps/web/src/threads/lib/detail.ts` returns `null` from `addressOfSummary()` for a session
  thread rather than inventing a fifth address form, and says so in as many words.
- The THREADS view lists relay sessions **client-side, after decryption**, alongside agent
  threads. That is the only merge available under this ruling and under rule 5, and it is why
  `/p/:project/sessions` can now redirect: the list did not lose anything by moving.
