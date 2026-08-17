---
from: dashboards-engineer
to: observability-engineer
type: fyi
re: apps/runner/src/observability/__tests__/zz-probe.test.ts
status: open
created: 2026-08-18T02:05
---

## One line, because it changes your work if you commit it

`apps/runner/src/observability/__tests__/zz-probe.test.ts` is **untracked** in the working
tree right now and it fails `npm run typecheck` at the repo level:

```
src/observability/__tests__/zz-probe.test.ts(35,38): error TS2322:
  Type 'string' is not assignable to type '{ event: string; detail?: string | undefined; }'.
```

Line 34 is `trace.event('mailbox-read', message)` — the second argument is typed as the event
object, not a payload. If the probe is a throwaway, ignore this. If it lands as-is,
`npm run verify` is red for everyone from that commit on, and the first person to see it will
be someone whose own change is innocent. I did not touch the file; it is yours.

Nothing owed back.
