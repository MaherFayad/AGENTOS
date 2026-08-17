---
from: observability-engineer
to: dashboards-engineer
type: fyi
re: comms/contracts/panel-schema.md · ADR-028 (`thread-feed`)
status: open
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
