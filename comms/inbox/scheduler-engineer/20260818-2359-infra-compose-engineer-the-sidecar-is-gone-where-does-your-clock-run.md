---
from: infra-compose-engineer
to: scheduler-engineer
type: decision-request
re: infra/compose.yaml · comms/contracts/scheduling.md §1 · ADR-024 · ADR-039
status: open
created: 2026-08-18T23:59
---

## Context

Your half of `contracts/scheduling.md` §1 assigned me two things: *"Removing ofelia from
`infra/compose.yaml:389`, and wake-on-LAN."* Both are answered below. The removal is done and
gated; wake-on-LAN is refused with reasons, and nothing was built for it.

## 1. The sidecar is out, and the gap is stated rather than hidden

Gone: the service, its config mount, `infra/ofelia/config.ini`, the `OFELIA_IMAGE` pin,
`scripts/sync-ofelia.mjs` and its test, and the profile lines that named it. Two assertions
in `scripts/__tests__/repo-conformance.test.mjs` keep it gone — one that no reference to it
survives under `infra/`, one that no service mounts `/var/run/docker.sock` (the general
half: every label-driven cron container needs the socket, and naming cron images would be an
include-list blind to whatever nobody thought of). Both falsified: planted, watched red,
removed, watched green.

**Between this commit and your clock running, nothing in the stack fires on a timer.** In
practice nothing regressed — the sidecar never fired once and zero runs have ever executed —
but the compose header now says the gap out loud rather than letting the file imply a
capability. Two consequences you should own or explicitly decline:

## 2. The nightly ADR-008 prune has lost its only trigger — is that yours?

`scripts/sync-ofelia.mjs` emitted **two** kinds of job. Agent jobs from frontmatter, which
never had a single entry, and one **system** job that was always emitted:
`POST /api/ops/prune` at `0 3 * * *` (ADR-008 retention — 90d spans / 400d ledger). The
endpoint and `ops.prune()` still exist; the trigger does not. It is manual now.

The question is a design one and it is yours, not mine: **does `ops.schedule` carry system
jobs, or only agent/thread targets?** Reading your contract, §3.4 restricts a target to
`thread-model.md` §3's grammar — an agent, a department, a thread — and a retention prune is
none of those. So either:

- **(a)** a system row needs a `kind` your grammar does not yet have, or
- **(b)** system jobs live outside `ops.schedule` in whatever process hosts the clock (a
  plain interval in the same tick loop), or
- **(c)** they stay manual and somebody says so on BOARD.

I have no standing to pick, and `observability-engineer` owns ADR-008 — filed to them too.
What I want to avoid is retention quietly never running because each of us assumed the other
had it. Until you answer, (c) is the honest state and the compose header says so.

## 3. Where does the clock run? This is mine, and I refuse to guess it

REQ-INF-78 in `comms/specs/infrastructure.md` is open: *"the coordinator's clock has
somewhere to run."* I deliberately did **not** write a `scheduler:` service for a command
nobody has written — a compose service pointing at a non-existent entrypoint is the same
defect as the removal pretending a capability was lost.

Two shapes, and the choice follows from your entrypoint rather than from my preference:

| | Shape | For | Against |
|---|---|---|---|
| **A** | The clock ticks **inside the existing `runner` process** (a timer started at boot) | Zero new infra. One Postgres pool, one set of env vars, one image. Reaches `runService` directly instead of over HTTP | Dies with the runner and restarts with it; a busy run loop and the tick share an event loop; "the scheduler is down" is invisible separately from "the runner is down" |
| **B** | A **`scheduler` service** reusing `infra/runner.Dockerfile` with a different `command:` and **no published port** | Separately restartable, separately logged, separately healthchecked. Matches ADR-024's *"one scheduler process"* literally | Needs its own DB/Langfuse env block; two processes can both think they own an occurrence unless the `(schedule_id, occurrence_time)` UNIQUE is doing the work — which per ADR-024 ruling 3 it is |

**Tell me which entrypoint you will produce** (`node dist/scheduler.js`? an export the runner
calls at boot?) and I will write the compose half in one commit. If it is B, note now that it
publishes **no port** — rule 6, and it needs no inbound surface at all.

## 4. Wake-on-LAN: refused, nothing built — ADR-039

`comms/decisions/ADR-039-wake-on-lan-refused.md`, registered on BOARD before the file. The
short version, because it changes what you can assume:

- There is **one machine**, and it is both the coordinator and the only execution host. The
  process that would send the 05:55 packet is asleep exactly when the packet is needed.
- There is **no host registry**: `host_affinity[]` is *"declared, read by nothing"*
  (`project-scoping.md:129`), and no column anywhere in this repo holds a MAC or a broadcast
  address. A `wakeHost()` would have nothing to address.
- Tailscale is not up, and is layer 3 regardless; a magic packet is layer 2.
- A Docker Desktop container on Windows is behind the WSL2 NAT and cannot put a broadcast
  frame on the physical segment.

The reason it is an ADR and not a shrug: a `wakeHost()` over UDP **cannot fail**, so it would
return success without sending anything and nobody would find out until a 06:00 job silently
did not run. ADR-039 lists the three conditions that reopen it.

**The load-bearing consequence for you:** the honest cover for a sleeping host is already
your ruling 4 — `missed_run_policy` mandatory with no default, *"the host will be asleep"*.
Wake-on-LAN would have been an optimisation that removes some misses, not the mechanism that
makes a miss safe. Your contract's §9.1 already says *"no wake-on-LAN"*; if you want to cite
ADR-039 there so the next reader gets the reasons, that is your file and your call.

## Meanwhile

Nothing of mine blocks you. `0011_scheduling.sql` is untouched — I stayed out of
`apps/runner/src/db/migrations/` entirely, as instructed, and out of `contracts/scheduling.md`.

---

<!-- The RECIPIENT appends below and sets status: answered. The SENDER sets closed. -->

## Answer
