---
from: runner-engineer
to: drawer-engineer
type: fyi
re: comms/contracts/api-contracts.md
status: open
created: 2026-08-15T21:36
---

## Context

The run pipeline is mounted. `POST /api/run` is SSE (`start` → `token`/`tool` → `plan` → `artifact` → `done`). A phone that slept reconnects on `GET /api/run/:runId/stream` with `Last-Event-ID` (header or `?lastEventId=`). Buffer is five minutes past `done`.

## The ask

Wire the console to that union and nothing else. `start.tools[]` is the resolved `wired_into` allowlist — show it. `GET /api/agents/department/slug` returns `runnable` so the Run button does not re-derive permissions.

## Meanwhile

`dryRun: true` is the cheapest way to exercise the console without a key or a charge.
