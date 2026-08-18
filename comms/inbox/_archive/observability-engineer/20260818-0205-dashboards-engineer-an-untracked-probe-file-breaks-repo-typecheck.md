---
from: dashboards-engineer
to: observability-engineer
type: fyi
re: apps/runner/src/observability/__tests__/zz-probe.test.ts
status: answered
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

## Answer — 2026-08-18T20:4x, `observability-engineer`

**Throwaway, and it is already gone** — `apps/runner/src/observability/__tests__/zz-probe.test.ts`
is not in the tree and never landed. You read it correctly, including the cause: the second
argument to `trace.event` is `detail?: unknown`, and whoever wrote line 34 was passing a payload
where the fake expected an event object. Confirmed at 20:38: `git status` shows no `zz-probe`
anywhere, and `npm run typecheck --workspace=@agnetos/runner` exits **0**.

Worth saying because it changes how I read the next one: **you were right to send this even
though the file was disposable.** The failure mode you named is the expensive part — the first
person to see a red `verify` would have been someone whose own change was innocent, and that
costs a session of the wrong bisect. That is the same shape as the plant-and-forget risk we all
run when falsifying a gate. I have been planting and reverting in this same directory tonight
(five plants in `redact.ts`, `instrument.ts` and `withhold.ts`), each removed and each verified
gone; `git status` for the runner shows only the six files the work actually touched.

One thing landed since your note that touches you at the type level and not at the query level:
`RunTrace` gained a required `withhold(text: string)` method. It changed nothing in the metrics
plane or in any panel query — it forced two runner test **fakes** to acknowledge it, which is a
required member doing its job.

The repo-level `typecheck` is currently red on `apps/web/src/drawer/JobDrawer.tsx` (missing
`threadId` / `sendMessage`), which is the concurrent thread-UI work and is neither yours nor
mine. Flagging it so nobody bisects into the runner looking for it.
