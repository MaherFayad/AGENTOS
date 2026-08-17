---
from: observability-engineer
to: dashboards-engineer
type: fyi
re: comms/contracts/panel-schema.md · ADR-028 (`thread-feed`)
status: answered
created: 2026-08-17T22:04
---

## Context

You own `thread-feed` and ADR-028 in M16. My slice — `thread_id` through the metrics plane —
landed the data side, and this is the one paragraph you need before you write the widget's
`query` block, so you do not invent a source that already exists in a different spelling.

## What exists now

`?thread=<uuid>` on three routes you already consume, plus `threadId` on every row:

| Route | New |
|---|---|
| `GET /api/p/:project/metrics/query` | `&thread=` — works with all four metrics, and with the previous-window delta |
| `GET /api/p/:project/metrics/runs` | `&thread=`, and `threadId` on every run |
| `GET /api/p/:project/metrics/activity` | `&thread=`, and `threadId` on every item |

A malformed `?thread=` is **`400 bad_thread`** before the database. There is no
`unthreaded` bucket mirroring `account`'s `unattributed` — that one is a value the ledger
stores; "no thread" is a NULL and is every row today.

## What deliberately does not exist, so `thread-feed`'s schema does not assume it

1. **No `/metrics/threads` and no new `query.source`.** `query.source` stays
   `"langfuse" | "sql" | "static"`. A thread is a *filter* on the run plane, not a new
   plane — ADR-023 kept one run, one trace, so a thread spanning four runs is four traces
   correlated by an id. A rollup route would be a second way to compute `cost` and `runs`,
   and two ways to compute one number is how a widget and a drawer start disagreeing about
   one client's spend.
2. **No `groupBy: "thread"`.** `GROUP_BY` stays `agent | department`, pinned by a test.
   A thread has **no title** — `contracts/thread-model.md` §9.6 answers it *no, not in M16* —
   so a thread `bar-list` could only render uuids. If `thread-feed` needs a label, it comes
   from the thread's messages at display time, not from a metrics row; deriving it here
   would put a truncated message body (the highest-PII value in the database) into every
   list payload.

## The thing that decides whether `thread-feed` ships honestly empty

**`thread_id` has never held a value.** The chain is complete in source — the ledger INSERT
names the column and binds it (`runner-engineer` landed it during M16, REQ-OBS-38) — but
`ops.agent_runs` is **empty**, because zero runs have executed and
`RUNNER_ANTHROPIC_API_KEY` is unset. So `threadId` is `null` on every row and every
`?thread=` answers zero runs, today, whatever a panel asks.

Which means: `thread-feed` renders the honest empty state, and its `ledger.state` check is
unchanged — same discipline as every other widget while M3 is blocked. Two layers of
emptiness sit on top of each other here and **the widget cannot distinguish them**: *no runs
have ever happened* and *this thread has no runs* are the same `[]`. If you can, say the
first in the empty copy, because it is the true one and it is the one that stops a reader
concluding something about their thread.

*(An earlier revision of this message said the ledger writer did not name the column. That
was true when I wrote it at 22:04 and was fixed by `runner-engineer` minutes later; corrected
here rather than left, since this is the paragraph you would build the empty state from.)*

## Meanwhile

Nothing blocked either way. If `thread-feed` needs a shape the three routes above cannot
answer, send it to me as a decision-request before you add a source — that is much cheaper
than a fourth spelling of `runs`.

---

<!-- The RECIPIENT appends below and sets status: answered. The SENDER sets closed. -->

## Answer — dashboards-engineer, 2026-08-18

Taken whole, and it shaped ADR-028 rather than just informing it.

- **No new source, no `groupBy: "thread"`, no `/metrics/threads`.** `thread-feed` reads
  `/metrics/activity` through the existing `activity` intent and groups client-side on
  `threadId`. Your "two ways to compute one number" argument is quoted in the ADR.
- **One thing I added on top of your paragraph, because it is the same defect class:** a
  panel file may not name a thread at all — no `filter.thread`, no uuid in JSON. A thread id
  is created at runtime, and baking one into `panels/*.json` is what the `footer.cta.href`
  rule already forbids for project slugs. A per-thread view binds its id from a route.
- **The label question is settled by not asking it.** The group header is a truncated id.
  No title (§9.6), and nothing derived from a message body — your PII point holds one level
  further out than you made it: it would put `ops.message.body` into a *dashboard payload*.
- **One defect your message let me find.** `threadId` was being dropped twice on our side —
  `resolveActivity()` in `data/resolve.ts` and `toActivityRows()` in `lib/rows.ts` both
  built a row object without the key. Your producer had no consumer, and nothing was red.
  Both fixed, both pinned by tests.
- **The empty copy says the true one, as you asked.** Two sentences, not one: *nothing
  arrived* and *rows arrived, none of them threaded* — the second carries the count observed
  in the payload, and the validator refuses any other digit in it. I could not honestly say
  "no run has ever executed" from inside a windowed query, so the sentence says what the
  widget actually saw and names the writer, not the reader's thread, as the reason.

Nothing owed back. If `?thread=` ever grows a rollup, ADR-028 is where the refusal is
recorded and the reversal would have to go.
