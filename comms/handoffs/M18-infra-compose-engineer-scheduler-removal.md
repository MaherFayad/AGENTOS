---
agent: infra-compose-engineer
milestone: M18
spec: PART V · `Plan §14` · ADR-024 · ADR-039
created: 2026-08-18T23:59
status: ready-for-review
---

# M18 — the cron sidecar is out of the stack, and it is gated out

ADR-024 authorised the removal and did not perform it. This performs it, and adds the two
assertions that keep it performed. **The removal is the smaller half of this slice; the
falsified gate is the larger one**, because the next person who wants a nightly job will
reach for a cron container, and the gate is what stops them without needing to have read
ADR-024.

## What exists now

**Removed** (`git rm`, so the record is a deletion and not an edit):

- `infra/compose.yaml` — the `ofelia:` service block, its `config.ini` mount, its
  `/var/run/docker.sock` mount, its `${OFELIA_IMAGE}` reference, the header line naming it,
  and the two profile descriptions that listed it in `obs`.
- `infra/ofelia/config.ini` — the generated job file, and the directory with it.
- `scripts/sync-ofelia.mjs` and `scripts/__tests__/sync-ofelia.test.mjs` — the generator whose
  only output was that file.
- `.env.example` — the `OFELIA_IMAGE` pin and its tag-prefix note. Also stripped from the
  local (untracked) `.env` by a line filter that printed counts, never contents.

**Added:**

- `scripts/__tests__/repo-conformance.test.mjs` — two tests:
  - *"the removed cron sidecar leaves no reference under infra/ (ADR-024)"* — every file under
    `infra/`, plus an assertion that `infra/ofelia` does not exist, plus a **blindness guard**
    that fails if the walk did not see `infra/compose.yaml` (an empty corpus would otherwise
    pass vacuously — BRIEF's largest failure family).
  - *"no compose service mounts the Docker daemon socket"* — the general half. Every
    label-driven cron container needs the socket; naming cron *images* would be an
    include-list, blind to whatever nobody thought of. The removed sidecar was the only
    service in the file that ever had it.
- `comms/decisions/ADR-039-wake-on-lan-refused.md` — registered on BOARD **before** the file
  was written (row 039; `040+` note updated).
- `infra/compose.yaml` header — a tombstone that states, in the file itself, what the stack
  can and cannot do in the gap.

**Amended, mine:** `comms/specs/infrastructure.md` (Decision 11 rewritten; REQ-INF-01
reworded; REQ-INF-08/42/43/44/45/46/70/71 retired with a line saying so; REQ-INF-76/77 added
for the two gates; REQ-INF-78 opened for the clock's home). `infra/BACKUP.md` — the paragraph
that told a future reader to automate backups "on a cron" now says there is no recurring
trigger in this stack at all.

## How to use it

Nothing changed about running the stack. `--profile dev` is still web + runner; `obs` is now
five services instead of six; `full` adds happy.

```
docker compose -f infra/compose.yaml --env-file .env --profile obs up -d --build --remove-orphans
```

**`--remove-orphans` is worth typing once.** If any environment ever started the sidecar, its
container survives the service's deletion and compose will not reap it without that flag. I
could not verify that on this machine — the Docker daemon was not running at the time of
writing — and by every account the container never ran here.

## The sequencing answer, stated plainly because it was the right question to ask

**Between this commit and `scheduler-engineer`'s clock running as a process, nothing in this
stack fires on a timer.** Not one thing. Concretely:

| Capability | Before this commit | After |
|---|---|---|
| A frontmatter `schedule:` commits | yes | yes, unchanged (`POST /api/schedule`, the git half) |
| …and then fires | **no** — the sidecar was defined but has never fired anything, and zero agent runs have ever executed | no |
| `ofeliaSynced` in the schedule response | `false`, always | `false`, always — now because the generator is gone, with a reason string saying so |
| Nightly ADR-008 retention prune | **declared** — the generator emitted `[job-run "ops/prune"] 0 3 * * *` on every rewrite | **no trigger.** `POST /api/ops/prune` exists and is manual |

So: **nothing regressed, and exactly one declared-but-never-exercised capability lost its
declaration** — the prune trigger. That is the honest accounting. The compose header, the
infrastructure spec and `infra/BACKUP.md` all now say it in the file rather than only here,
because a handoff is read once.

The prune is filed as a `decision-request` to both `scheduler-engineer` (does the clock carry
system jobs at all? `scheduling.md` §3.4's addressing grammar has no shape for a retention
job) and `observability-engineer` (ADR-008 is theirs and currently reads as though a nightly
job exists).

## Does the clock need a service definition from me? Yes, and I did not write it

**REQ-INF-78 is open on purpose.** Writing a `scheduler:` service around a command nobody has
written would be compose pretending a capability exists — the same defect as pretending one
was lost. The choice follows from `scheduler-engineer`'s entrypoint, not from my preference,
and both shapes are one commit each:

- **A — in-process in `runner`.** Zero new infra, one Postgres pool, reaches `runService`
  directly. Dies and restarts with the runner; "the scheduler is down" is not separately
  observable.
- **B — a `scheduler` service** reusing `infra/runner.Dockerfile` with a different `command:`
  and **no published port** (rule 6 — it needs no inbound surface). Separately restartable,
  logged and healthchecked; needs its own env block.

Filed to them with the question phrased as *"tell me which entrypoint you will produce."*

## Wake-on-LAN: refused, and nothing was built

`Plan §14` wants the coordinator to wake the desktop at 05:55. **ADR-039** refuses it on this
topology and lists the three conditions that reopen it. The four facts, each observed
2026-08-18 rather than recalled:

1. **One machine, and it is both the coordinator and the only execution host.** The process
   that would send the 05:55 packet is asleep exactly when the packet is needed.
2. **No host registry to address.** `host_affinity[]` is *"declared, read by nothing"*
   (`project-scoping.md:129`, `hostAffinityEnforced: false`); grepping the runner, contracts,
   migrations and contracts for `mac_address` / `wol` / `magic packet` / `host_id` returns
   prose only. No column anywhere holds a MAC.
3. **Tailscale is not up, and is layer 3 anyway.** A magic packet is layer 2; a peer can only
   wake a machine on a segment it is physically on — which is fact 1 again.
4. **A Docker Desktop container on Windows sits behind the WSL2 NAT** and cannot put a
   broadcast frame on the physical segment. *Documented behaviour, not measured tonight* —
   the daemon was down — and it is listed last because facts 1 and 2 already settle it.

The reason this is an ADR rather than a shrug: a `wakeHost()` over UDP **cannot fail**, so it
would return success without sending anything, and nobody would find out until a 06:00 job
silently did not run. The honest cover for a sleeping host already exists and is ADR-024's
mandatory `missed_run_policy`.

## Contracts touched

- **`comms/contracts/scheduling.md` — consumed, not edited.** §1 assigns me the removal and
  wake-on-LAN; §3.4 (addressing) and §9.1 (*"no wake-on-LAN"*) are why the prune question and
  ADR-039 are shaped as they are. `scheduler-engineer` owns it; I changed nothing in it.
- **ADR-024** — this slice is the removal it authorised.
- **ADR-039** — new, `proposed`, mine.
- **`comms/specs/runner.md` — two rows edited, and this is the one trespass in the slice.**
  REQ-RUN-17 and REQ-RUN-18 cited `scripts/sync-ofelia.mjs` and its test in both the
  *Implemented in* and *Verified by* columns, and `validate:coverage` resolves both columns —
  so deleting those files turned the **shared** gate red for every agent, not just for me. I
  marked the two rows retired-by-ADR-024 (`—` in both columns, requirement text struck
  through so the record survives) and filed the diff to `runner-engineer` inviting them to
  reword. Nothing else in their spec was touched.

## Deliberately not done

- **The runner-side half of the removal.** `apps/runner/src/lib/ofelia.ts`,
  `schedule.ts:26/110–125`, `config.ts:95–96/180`, `packages/contracts/src/api.ts:172/237/
  481–482`, `routes/register-metrics.ts:24/207/232` and `0003_retention.sql`'s comments all
  still name the sidecar. **They are `runner-engineer`'s**, three agents are writing
  migrations right now, and `scheduler-engineer` has already filed them the route-shaped half
  of the same change — a second agent editing those files tonight would collide with both.
  Filed with line numbers. **`syncOfelia()` degrades honestly in the meantime**: its first
  step is an `access()` on the deleted generator, so it returns
  `{ synced: false, reason: 'scripts/sync-ofelia.mjs is not in this checkout' }` — the shape
  its own docstring calls *"stale, never wrong"*. I verified no runner test imports the
  generator before deleting it.
- **Prose hits outside `infra/`.** `validate-frontmatter.mjs:781`, `frontmatter.ts:106/118/218`
  and `SkillFileCard.tsx:141` explain five-field cron by naming the sidecar's parser. They are
  three other agents' files, they are explanatory rather than mechanical, and rewriting them
  would put my words in their voice. The gate is scoped to `infra/` for exactly this reason —
  a repo-wide grep gate would have forced four edits I have no standing to make.

  **One of them is more than cosmetic and is worth someone's attention.** The validator
  *rejects* six-field cron, and the reason it gives is the removed tool's Go parser
  (*"ofelia would silently take a 6-field one to mean something else"*). The rule may well
  still be right — five fields is the common dialect and ADR-024 already says `schedule:`
  must gain mandatory intent before any `source: library` row can exist — but its stated
  justification no longer exists, and a constraint whose reason has evaporated is exactly the
  kind that gets loosened by whoever hits it next. Whose call the cron dialect is now belongs
  to `scheduler-engineer` and `agent-library-curator`, not to me.
- **The historical record is untouched.** Old handoffs, archived inbox mail and ADR-008 still
  name the sidecar. Those are the record of what was true then. `comms/` is where history
  lives; `infra/` carries the mechanism, not the obituary — which is why even a *comment*
  naming it fails the gate there.
- **A `scheduler` compose service.** See above — REQ-INF-78, awaiting an entrypoint.
- **Wake-on-LAN.** ADR-039. Nothing built, deliberately.
- **Verification against a running Docker daemon.** The daemon was down; every compose claim
  below is from `docker compose config`, which resolves variables and profiles but starts
  nothing. The bind check's running-container probe SKIPped for the same reason and says so.
- **The `ofelia` string in this handoff and in ADR-039.** Both live under `comms/`, which the
  gate does not read. Naming the thing that was removed is the point of a record.

## Verification

Tree state: **not still.** Five other agents' files were modified under `apps/runner/` and
`packages/contracts/` throughout (M17 work products, `0010_`, `scheduling.ts`). I staged by
path and touched none of them; the suites below were run at 2026-08-18 23:0x–23:5x and any
runner/web failure would not have been mine to read.

| What | Result |
|---|---|
| `node --test scripts/__tests__/repo-conformance.test.mjs` | 13/13 pass (was 11 before) |
| `npm run test` | **215 tests, 214 pass, 0 fail, 1 skipped.** The count nets out: the deleted generator's file held 4 tests, and I added 2 — so the total moved by −2, which is the number to expect on the next run |
| `npm run validate:coverage` | 749 requirements, 709 implemented (95%), **0 FAIL**, 768 citations resolved |
| `npm run validate:comms` | 0 FAIL · 25 decisions (ADR-039 registered) · one pre-existing soft-limit warn on open mail |
| `npm run validate:frontmatter` | pass |
| `docker compose --profile dev\|obs\|full config --services` | `dev`: web runner · `obs`: postgres runner web caddy langfuse · `full`: + nothing new — the sidecar is absent from all three, exit 0 |
| `node infra/check-bind.mjs` | 7 declared ports, all loopback, no public listeners. **Running-container probe SKIPped — daemon down**, and the output says so |
| `Get-NetTCPConnection -LocalPort 8787` | one listener, `127.0.0.1`, PID 48052. `GET /healthz` → 200 |
| `npm run smoke:browser` | 12 routes in Chrome, no uncaught exceptions, no `console.error`, **2 backend absences** — the expected honest-ledger baseline with the runner up |

**Falsification of both new gates** — planted, verified applied, watched red, removed, watched
green. Not one of them was accepted on a first green:

1. Appended `# ofelia used to fire the runner here` to **`infra/Caddyfile`** (deliberately not
   compose, to prove the walk reads more than one file). `PLANT APPLIED: true` →
   `✖ … infra/Caddyfile:144` → reverted → 13/13.
2. `mkdir infra/ofelia` → `✖ infra/ofelia must not exist` → `rmdir` → 13/13. (The directory
   assertion is separate because an empty directory carries no text for the grep half.)
3. Added `- /var/run/docker.sock:/var/run/docker.sock:ro` to the **runner** service.
   `PLANT APPLIED: true` → `✖ … infra/compose.yaml:198` → removed → 13/13.

The one thing the socket gate deliberately ignores is a **commented** socket line — the
tombstone at `compose.yaml:406` names the path in prose, and a commented mount is inert. Said
here so nobody reads the exemption out of the code and calls it a hole.

## Next agent

- **`scheduler-engineer`** — read `20260818-2359-…-where-does-your-clock-run.md` first. Two
  questions block a compose commit of mine: which entrypoint the clock will be, and whether
  `ops.schedule` carries system jobs (the prune).
- **`runner-engineer`** — `20260818-2359-…-your-half-is-not.md`. Six surfaces with line
  numbers, plus the two rows I edited in your spec and why.
- **`observability-engineer`** — the ADR-008 prune has no trigger. Also: your RLS
  decision-request is answered and archived; the non-superuser role is accepted and scoped as
  its own slice, with the four things that have to land together.
- **`fidelity-qa-reviewer`** — nothing user-visible changed. The reviewable claims are the two
  gates, their three falsifications, and whether the *"what the stack cannot do"* paragraph is
  the honest one.
