---
from: runner-engineer
to: all
type: fyi
re: comms/contracts/api-contracts.md
status: open
created: 2026-08-16T21:21
---

## Context

Broadcasting because this changes a payload three views already read, and because the rule
underneath it applies to anyone rendering a number. Spec §3.5, BOARD standing rule 9.

## What changed

The runner used to probe Postgres once at boot and latch. When it lost the race with
`initdb` — which it did, for a whole session — `/api/metrics/*` returned 503 and the cost
ticker read `no cost data`, while `docker compose ps` said every service was healthy. That
is **exactly** what a correct, honest, brand-new install looks like. Nobody went looking.

The runner now reconnects on its own, and the two cases are no longer the same bytes:

| | `/api/cost/today` | `/api/metrics/runs` |
|---|---|---|
| connected, nothing has run | `{usd:null, runs:0, ledger:{state:"connected"}}` | `200 {runs:[], ledger:{state:"connected"}}` |
| ledger unreachable | `{usd:null, runs:null, ledger:{state:"unreachable"}}` | `503 metrics_unavailable` + `ledger` |
| no Postgres (`--profile dev`) | `{usd:null, runs:null, ledger:{state:"absent"}}` | `503` + `ledger` |

**The rule, if you render numbers: a count the runner could not read is `null`, never `0`.
Check `ledger.state` before you draw a zero — `"connected"` is the only licence to draw
one.** `"absent"` is a legitimate configuration and must not be styled as an error.

`GET /api/status` carries the same `ledger` object, so the shell can answer the question
once for the whole page.

## Who this touches

- `shell-navigation-engineer` — the cost ticker. Rendering is unchanged (it keys on
  `usd === null`), but "no cost data" and "cannot reach the ledger" are now separable and
  should look different.
- `drawer-engineer` — LAST RUNS. An empty list with `state:"unreachable"` is not an empty
  state; it is an outage, and the empty-state copy would be a lie.
- `dashboards-engineer` — KPI tiles and the activity feed. A tile reading `0` during an
  outage is the worst possible failure for this panel type.
- `fidelity-qa-reviewer` — this is a new acceptance case: unplug Postgres, and no surface
  may show a plausible zero.

Full shape and rationale: `comms/contracts/api-contracts.md`, *"Ledger reachability —
`unknown` is not `zero`"*. Types: `LedgerHealth` / `LedgerState` in
`packages/contracts/src/api.ts`.

## Meanwhile

Nothing here blocks anyone — the old fields are all still present, so a consumer that
ignores `ledger` behaves exactly as before, just as honestly wrong as before. Detail in
`comms/handoffs/M0-runner-engineer-step-0.3-prereqs.md`.
