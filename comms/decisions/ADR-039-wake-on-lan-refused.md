# ADR-039 — Wake-on-LAN is refused on this topology, and the three conditions that reopen it

**Date:** 2026-08-18 · **Author:** `infra-compose-engineer` · **Status:** proposed
**Affects:** `Plan §14` (the wake-on-LAN bullet) · `comms/contracts/scheduling.md` §1 (the row
assigning wake-on-LAN to me) · `comms/specs/infrastructure.md` · M18 · ADR-024

## Context

`Plan §14` lists three things that *"make it feel like running a company"*, and the third is:

> **Wake-on-LAN.** The coordinator wakes the desktop at 05:55 so the 06:00 job has a host.
> Small, cheap, and it is the moment the system stops feeling like a website.

`contracts/scheduling.md` §1 assigns it to me by name, alongside removing the cron sidecar,
because it is host and network rather than clock. ADR-024 lists it under *"Hard, and unpaid."*

It is small and cheap **on the topology `Plan §9` describes** — a coordinator that is always
on, and execution hosts that are not. This is the ADR because that topology does not exist
here, and the difference is not a matter of effort. Four facts, each observed rather than
recalled, all on 2026-08-18 between 22:40 and 23:10:

1. **There is one machine, and it is both the coordinator and the only execution host.**
   `infra/compose.yaml` defines five services, all on one Docker host. There is no host
   daemon, no second node, and no notion of a remote executor anywhere in the tree. The
   runner is up as a host process on `127.0.0.1:8787` (`Get-NetTCPConnection -LocalPort
   8787` → one listener, loopback, PID 48052; `GET /healthz` → 200). The Docker daemon was
   not running at the time of writing (`docker compose ps` → *"open //./pipe/
   dockerDesktopLinuxEngine: The system cannot find the file specified"*), which is itself
   the point: **the thing that would send the packet lives on the machine that needs waking.**
   A sleeping desktop takes the coordinator down with it, and a process that is not running
   sends nothing at 05:55.

2. **There is no execution-host registry, so a `wakeHost()` would have nothing to address.**
   `ops.project.host_affinity[]` exists and `project-scoping.md:129` grades it *"Declared,
   read by nothing"* with `ProjectSummary.hostAffinityEnforced: false`. Grepping the runner,
   the contracts package, every migration and every contract for `mac_address`, `wol`,
   `magic packet` or `host_id` returns nothing but prose. No column anywhere holds a MAC
   address or a broadcast address. Wake-on-LAN's entire input is a MAC and a segment, and
   this repo stores neither.

3. **Tailscale is not up, and would not help by itself.** It is on the user's blocked list
   (BRIEF), and `tailscale` is a `tls`-profile service that has never authenticated. More
   importantly a tailnet is layer 3 and a magic packet is layer 2: a peer can only wake a
   machine on a segment it is *physically* on, which means an always-on device on that
   segment — fact 1 again, restated in networking terms.

4. **A Docker Desktop container on Windows cannot put the frame on the wire anyway.**
   Containers run inside the WSL2 utility VM behind NAT; a UDP broadcast to
   `255.255.255.255` terminates at the virtual NIC, and `network_mode: host` is documented
   as unsupported for Linux containers on Docker Desktop for Windows. This one is
   **documented behaviour I did not measure tonight** — the daemon was down — and it is
   listed fourth because facts 1 and 2 already settle the question without it.

The temptation this ADR exists to refuse is the small one: a `wakeHost()` that opens a UDP
socket, writes six `0xFF` bytes and sixteen MAC repetitions, gets no error back because UDP
never does, and returns `{ woken: true }`. That is BRIEF's house defect — a declared value
read as an observed one — on the one surface where believing it means the 06:00 job silently
did not run and the fire ledger says `missed` with no reason anybody can act on.

## Options

| Option | For | Against |
|---|---|---|
| **A — build `wakeHost()` now against a config-file MAC** | Ships the `Plan §14` bullet. Looks done. | Nothing calls it (no clock), nothing addresses it (no registry), and nothing on this host can send it. UDP gives no delivery signal, so its success return would be unfalsifiable by construction — the one property that makes a fake worse than a gap. |
| **B — a host-side PowerShell task outside compose** | Windows Task Scheduler can wake a machine and is a supported OS feature. | Breaks the portability rule outright (Part V: *"no host-installed tools, no manually-created containers — if it isn't in compose, it doesn't exist"*), and still cannot help: the task would run on the machine that is asleep. It also moves a scheduling decision out of the coordinator two hours after ADR-024 moved it in. |
| **C — refuse, and say nothing further** | Honest. Zero code. | The next agent reads `Plan §14`, sees no ADR, and builds option A. A refusal that records no conditions gets re-litigated by whoever is least aware of the constraints. |
| **D — refuse, and state the conditions that reopen it** | Honest, zero code, and the reopening test is checkable rather than a matter of taste. | Three conditions is three more things to keep true. Cheap: each is a fact about the world, not a mechanism to maintain. |

## Decision

**We adopt D. Wake-on-LAN is refused and nothing is built** — no function, no config key, no
`.env` variable, no compose service, no column. `Plan §14`'s wake-on-LAN bullet is amended by
this ADR the way §3.2's cron sidecar is amended by ADR-024: the plan is not rewritten, and a
commit message would not have been enough.

**It reopens when all three of these are true**, and any agent may reopen it by pointing at
them:

1. **A second machine runs the coordinator** — an always-on box, VPS, NAS or Pi — and it is
   on the same layer-2 segment as the host to be woken, or a peer on that segment relays for
   it. One machine cannot wake itself.
2. **An execution-host registry exists** with, per host, an addressable identity: a MAC and a
   broadcast address at minimum. Today the nearest thing is `host_affinity[]`, which is a
   list of names read by nothing. Whoever adds hosts as first-class rows owns that shape;
   this ADR does not invent it.
3. **The sender can reach the segment.** On this stack that means not a Docker Desktop
   container on Windows. On the VPS-shaped future it means a container on a host network, or
   the coordinator process itself running outside Docker.

Until then, **the honest cover for a sleeping host already exists and is not wake-on-LAN**:
ADR-024 ruling 4 makes `missed_run_policy` mandatory with no default precisely because *"the
host will be asleep"*. `ask` pushes *"missed the 08:00 digest — run it now?"*; `catch_up_once`
runs it late; `skip` drops it deliberately. Wake-on-LAN is an optimisation that removes some
misses. It is not the mechanism that makes a missed run safe, and shipping it first would
have made the weaker mechanism look like the stronger one.

## Consequences

**Easy.** Nothing to maintain, nothing to test, no unfalsifiable success return in the tree.
The scheduler's design is unaffected: ADR-024 already types wake-on-LAN as absent, and
`scheduling.md` §9.1 (*"no catch-up, no jitter application, no wake-on-LAN. The columns
exist; the behaviour does not"*) already says so from the other side.

**Hard.** A 06:00 job on a laptop that slept at 23:00 does not run, and the user sees it as
`missed` at whatever hour they next open the app — with a push if the schedule chose `ask`.
That is the honest state of a one-machine deployment, and it is visible rather than silent,
which is the property worth protecting.

**Also refused here, because it is the obvious next reach:** keeping the machine awake
(a "no-sleep while schedules are armed" setting) is not a substitute, it is a power-policy
change to the human's personal desktop, and it is not an agent's decision to make. If anyone
wants it, it is a question for the user, not an ADR.

**To reverse.** Cheap and additive — nothing here has to be undone, because nothing was
built. When the three conditions hold, the work is a registry column, a sender, and a call
site in the clock, in that order. Anything that arrives in a different order is the fake.

## Contract edits

- **`comms/contracts/scheduling.md` §1 (`scheduler-engineer`'s — answered, not edited by
  me).** The row *"Removing ofelia from `infra/compose.yaml:389`, and wake-on-LAN →
  `infra-compose-engineer`"* is discharged by this ADR plus the removal commit: the first
  half is done, the second half is refused with conditions. They may want to cite ADR-039
  where the contract already records *"no wake-on-LAN"*; filed to them as an FYI, not edited.
- **`comms/specs/infrastructure.md` (mine).** *Deliberately not done* gains a wake-on-LAN
  bullet pointing here.
- **`AGENTOS-V2-PLAN.md` §14 — amended, not edited.** The file is not rewritten.
