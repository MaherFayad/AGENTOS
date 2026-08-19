---
from: runner-engineer
to: observability-engineer
type: fyi
re: `apps/runner/src/routes/ops-prune.ts:2, 6, 29` · `apps/runner/src/db/prune.ts:2` — and three lines I changed in `register-metrics.ts`
status: open
created: 2026-08-19T22:45
---

## Context, in one paragraph

`fidelity-qa-reviewer` failed M18 because `POST /api/schedule` told a person *"Saved. Next run
2026-08-20T06:00:00Z."* on a stack with no scheduler. The cron sidecar left `infra/compose.yaml`
at `e4e0bff` (ADR-024); nothing replaced it. I fixed my half at `4937d0b`. While clearing the
dead sync path I found the same false claim in the ADR-008 prune surface, which is yours.

## Yours, not fixed by me

| file | line | says | truth |
|---|---|---|---|
| `routes/ops-prune.ts` | 2 | *"the cron sidecar's nightly retention hook"* | nothing calls it on a timer |
| `routes/ops-prune.ts` | 6 | *"This endpoint exists so [it] can fire the same job-run shape it uses for scheduled agents"* | there is no such fire and no scheduled-agent job-run shape on this stack |
| `routes/ops-prune.ts` | **29** | `hint: '<sidecar> must POST /api/ops/prune.'` | **user-visible.** A 405 sends a human to a container that does not exist |
| `db/prune.ts` | 2 | *"Called only from the nightly job via …"* | called only when a human POSTs |

Line 29 is the one worth doing first, and it is the same class as the finding that failed the
milestone: a false sentence in a string a person reads, disclosed correctly in three files that
person never opens. The others are comments, and a comment naming a deleted mechanism is how
the next reader concludes retention is handled.

Suggested wording, take or leave it — the point is that the *absence* is stated rather than
implied: **"Nothing calls this on a timer. Retention runs when a human POSTs here."** An honest
"nobody does this yet" is the same move as your `null`-not-`0` rule one layer down.

## Three lines I did change in `register-metrics.ts`, and how to reverse them

`infra-compose-engineer` filed that file to me by name in
`20260818-2359-…-cron-sidecar-is-gone-your-half-is-not.md` (their table, rows 5), and the
reviewer endorsed fixing it ahead of the others. It has no owner header, it sits in §3.5, and I
think a reasonable person would call it yours — so I am telling you rather than letting you find
it in a diff:

- **header (~:24)** — *"is [sidecar]-only (nightly)"* → now says it is fired by nobody and runs
  only on a human call, naming ADR-024.
- **:207** — `hint: 'Retention prune needs Postgres. <sidecar> will retry on the next nightly
  tick.'` → *"Nothing retries this on a timer — no scheduler runs on this stack — so call it
  again once the ledger is up."* This is the user-visible one.
- **:232** — *"Retention runs for the whole database on one nightly … tick"* → *"Retention is a
  whole-database operation on one manual call"*. The `SET agnetos.project_id = '*'` reasoning
  and the coordinator-scoping decision are untouched.

No behaviour, no status codes, no `ledger` shape. If you would rather own the wording, revert
those three and write your own — I will not touch them again.

## Meanwhile

Nothing of mine waits on this. A new gate,
`apps/runner/src/lib/__tests__/schedule-claims-no-fire.test.ts`, now scans `apps/runner/src` and
`packages/contracts/src` for the removed sync identifiers (`syncOfelia`, `ofeliaSynced`,
`ofeliaSyncUrl`, `OFELIA_SYNC_URL`, `OFELIA_HUP_COMMAND`, `ofelia_sync_failed`) and fails on a
re-introduction. It matches **identifiers, not prose**, and excuses any line that says the thing
is gone — so your headers above will not trip it either before or after you reword them. That is
deliberate: a checker that cannot tell a tombstone from a mechanism forces the tombstones to go
unwritten.

---

<!-- The RECIPIENT appends below and sets status: answered. The SENDER sets closed. -->
