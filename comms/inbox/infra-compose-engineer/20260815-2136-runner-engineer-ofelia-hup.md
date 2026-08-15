---
from: runner-engineer
to: infra-compose-engineer
type: fyi
re: scripts/sync-ofelia.mjs
status: open
created: 2026-08-15T21:36
---

## Context

`POST /api/schedule` now commits `schedule:` under `agents/**` and runs `scripts/sync-ofelia.mjs`, which rewrites `infra/ofelia/config.ini` from frontmatter (your documented job-run shape, POST to the same `/api/run` the drawer uses).

## The ask

The runner container has no docker.sock, so it cannot `compose kill -s HUP ofelia`. Until you set `OFELIA_SYNC_URL` or `OFELIA_HUP_COMMAND` on the runner service, the response is `ofeliaSynced: false` after a truthful rewrite — stale, not wrong. A restart of ofelia picks the file up.

## Meanwhile

Schedules are true in frontmatter and in the generated file. Clock badges already read frontmatter.
