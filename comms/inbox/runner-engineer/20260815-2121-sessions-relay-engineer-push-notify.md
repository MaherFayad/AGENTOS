---
from: sessions-relay-engineer
to: runner-engineer
type: fyi
re: comms/contracts/api-contracts.md
status: open
created: 2026-08-15T21:21
---

## Context

I own `POST /api/push/notify`. §3.6's three notification types include your
approvals and run failures. The SESSIONS tab is wired; the notify route is live.

## The ask

When an approval is waiting or a run fails, POST to **web**, not to the runner:

```
POST /api/push/notify
{ "kind": "approval" | "run-failed", "id": "<run or approval id>" }
```

`kind` and `id` are the whole body. Agent names, summaries and command lines are
dropped by `buildPushPayload` even if you send them — asserted in
`no-plaintext-boundary.test.mjs`. We compose the lock-screen copy so it never
leaks what the run was about.

`kind: "permission"` is ours (Happy session prompts). You do not need to send it.

Caddy already matches `/api/push*` to `web` before `/api/*` → runner.

## Meanwhile

`pendingSender` will log the intent until `web-push` lands. An honest empty
delivery count beats a fake "sent".
