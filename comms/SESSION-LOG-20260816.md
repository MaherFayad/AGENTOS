# Session log — 2026-08-16 · Phase 0 closed, M15 opened

**This file is a session log, not a source of truth.** `comms/BOARD.md` is authoritative for
milestone state, ownership and the open questions. Where this file and BOARD disagree, BOARD
wins. It exists so the next session can resume without re-deriving what happened.

Baseline commit: `56e93cf` (Maher Fayad, 19:28 +0300 — 881 insertions to
`AGENTOS-V2-PLAN.md`, nothing else). Every provenance line filed this session cites that sha.

---

## Where the build actually is

**Phase 0 — agent-side work is complete.** Every milestone that had a gate has passed it.

| Step | State |
|---|---|
| 0.1 review queue | **Done.** M1 · M2 · M5 · M6 all PASS. M3 unblocked. |
| 0.2 stack up | **Partial.** Six services healthy on loopback. No tailnet — Tailscale is not installed on this host. Acceptance (phone PWA over Tailscale) is **unmet**. |
| 0.3 first run | **Staged.** Runbook written and executable. Blocked on `RUNNER_ANTHROPIC_API_KEY` alone — the Langfuse half is cleared. |
| 0.4 interview | **Blocked on the user.** `COMPANY.md` is 0/20. Its write path was broken until this session. |
| 0.5 promote to live | **Staged.** `scripts/stage-0.5.mjs` dry-ran all twelve agents. Blocked on 0.3. |
| 0.6 `.next` distDir | **Done and verified** — build runs against `.next-build` while a dev server holds `.next`. |

**P1 / M15 — Projects · cascade · identity is open.** Lead is `runner-engineer`, chosen because
M15 is schema, routing and UI and makes no model call — the largest slice available while the
key is outstanding.

---

## The five decisions awaiting the user

All five are recorded in `BOARD.md` under **Awaiting the user**, in its own checkbox format.
That is the authoritative copy; this is a pointer.

1. **`RUNNER_ANTHROPIC_API_KEY`** — dedicated Anthropic workspace, hard monthly cap on *that*
   workspace, key into `.env` line 80. Unblocks 0.3, 0.5, the LIVE counter, and every cost
   surface. Nothing else in the plan is gated by more.
2. **The twenty `COMPANY.md` interview answers.** The questions are in
   `agents/intelligence/company-interview/SKILL.md`. They land through that agent's `answers`
   textarea in `first-run` mode.
3. **Tailscale**, plus the design question inside it: `TAILSCALE_IP` is documented as the
   *host's* address, which needs a host install and contradicts Part V's "no host-installed
   tools"; the compose service runs userspace with its own address.
   `network_mode: service:tailscale` on caddy is the alternative. Whichever wins needs an ADR.
4. **Headless browser + reference frames** — one coupled decision, six checkboxes on BOARD.
   A headless browser is a *dev* dependency (no runtime deps added, no bundle bytes), so no
   standing rule bars it. The second half is the harder one: there is **no reference frame** in
   this repo — four PWA icons are the only raster assets. A "no" on the frames should make the
   browser a "no" too, or the result is a folder of PNGs and a false sense of rigour.
5. **ADR-011** (`proposed`) — light-theme `--ink-2` `#6E6E76` → `#6A6A72`, clearing 4.5:1 on
   every light surface (worst case 4.503:1), dark untouched so the Part VI frame is unaffected.
   Needs an ADR rather than a bug fix because the current value is verbatim §1.2 spec.

---

## In flight when the session ended

Five agents were still working. **Their outputs land on disk regardless** — handoffs in
`comms/handoffs/`, `comms/status/<agent>.md`, and routed inbox messages. Read those rather
than trusting this list, which was written before they finished.

| Agent | Task |
|---|---|
| `runner-engineer` | M15 lead — ADR-015, `ops.project`, project-scoped write path and routes, plus the allowlist-as-received test that is a **condition of M15's PASS** |
| `rtl-arabic-pdpl-specialist` | Fix `check-rtl`'s blind spot; decide the catalogue debt; the **mandatory** M15 cross-project isolation sign-off; the one-brain-or-N `COMPANY.md` ruling |
| `design-system-guardian` | `provenance.mjs` timezone bug; `RailLabel`'s sub-AA default; ratify or reverse `KpiTile`'s caveat token |
| `commandcenter-orchestrator` | Rule on the ADR numbering collision (below) |
| `fidelity-qa-reviewer` | Re-review queue — CostTicker and `RailLabel` fixes were filed |

---

## Open items that need a ruling, not a build

**The ADR numbering collision.** `AGENTOS-V2-PLAN.md` allocates ADR numbers in prose, and every
ADR filed this session from 009 up takes one already spoken for:

| # | Plan says (line) | Filed in `comms/decisions/` |
|---|---|---|
| 009 | Two planes — Library / Operations (84) | `artifact-write-capability` |
| 010 | MCP runtime and credential custody (125) | `sessions-runtime-deps` |
| 011 | Memory tiering and write authority (141) | `light-ink-2-aa-floor` |
| 013 | Auth exists in v2 (110) | `part-two-standing-and-spec-coverage` |
| 014 | Foundry token-budget policy (141) | `agent-cascade-resolution` |

**ADR-012 is deliberately vacant** (two agents raced for it and both renamed).

**RULED by `commandcenter-orchestrator` after this section was written.** Filed ADRs keep their
numbers; the plan's are re-allocated to 017–030, reserved in BOARD's register with the plan's own
wording beside each. The principle:

> You cannot renumber a decision that has already been acted on. Allocate against the side with
> no dependents.

The asymmetry is the whole argument: our ADR-009 changed twelve agents' frontmatter and is enforced
by `validate-frontmatter.mjs`, ADR-013 set the coverage gate, ADR-010 justifies two `package.json`
entries, and all six are cited in the Evidence column, four contracts, and **answered messages,
which ADR-000 makes append-only**. The plan's numbers have been acted on by nobody. Also found:
the plan allocates on **two offsets**, `§3` (009–014) and `§18` (016–025). `§18`'s ADR-016 is
*satisfied by* our ADR-014 + ADR-015 across two owners — a concordance entry, not a re-allocation.
See `comms/decisions/README.md` (the translation table, placed where `ls` is actually practised)
and the register in `BOARD.md` (the sole allocation authority).

**A sixth item now awaits the user:** `AGENTOS-V2-PLAN.md` still cites the old numbers in prose in
roughly twenty places. The orchestrator deliberately did **not** edit it — it is the user's file,
committed at `56e93cf`, and rewriting citations inside their plan of record is the quiet
cross-boundary edit the protocol forbids. Recommended, not done: a concordance is a bridge, and
every future reader has to be told the bridge exists.

**Auth, stated correctly** (two readers got this wrong in one evening, so it now appears in BOARD,
`decisions/README.md`, and the `identity-access-engineer` definition): **v2 gains accounts; v2 does
not gain a public surface.** Identity, devices, scopes and per-account billing exist inside the
tailnet, superseding "no auth in v1 by design". Transport is unchanged — tailnet-only, with
Authelia in front of Caddy as a *later* ADR (Plan line 995: *"not further amended here"*). Quote
both halves or neither; the deferred scopes-enforcement ruling depends on the second staying true.

**Seven vs eight departments.** `contracts/project-scoping.md` invariant 6 says seven; Plan §10
says an eighth, `engineering`. Both cite §10. An ADR-001 amendment either way. Held by
`agent-library-curator` pending map and chart pricing the tab-bar and force-group cost. **M15
must not bake `7` into anything project-shaped.**

**Spec line 184** names `--ink-3` verbatim for rails that changed to `--ink-2`, with no ADR —
while §9.5's own precedent says a verbatim spec value needs one. `fidelity-qa-reviewer`
deliberately did not block M6 on it ("blocking a WCAG fix on paperwork while the product is
inaccessible is the wrong trade") but routed it.

---

## The uncommitted tree

**245 dirty paths. Nothing committed this session.** `apps/web/next-env.d.ts` is **staged as a
deletion** while everything else is unstaged — a bare `git commit` would commit only that.

Both `infra-compose-engineer` and `commandcenter-orchestrator` independently recommended
splitting rather than one blob. The suggested split, roughly by falsifiable claim:

1. **The fabricated-number fix** — `scripts/lib/brain-completeness.mjs`, `build-graph.mjs`,
   `apps/runner/src/lib/brain.ts`, `BrainEmptyState.tsx`, `GalaxyCanvas.tsx`,
   `packages/contracts/src/graph.ts`. **Must stay one commit**: the bug was two producers of one
   number, and splitting it leaves a revision where they disagree.
2. **Tokens contract §9 / contrast** — drawer + dashboards CSS, `KpiNumeral`, both contrast tests.
3. **Ledger + observability** — `ledgerConnection.ts`, runner routes, `api-contracts.md`.
4. **Infra stack-up** — compose, `web.Dockerfile`, `.env.example`, `.gitignore`, distDir.
5. **`infra/runner.Dockerfile` on its own.** That one-line `chown` is a billing control and
   `git blame` should land on a message saying so — otherwise someone optimising layers deletes
   it and the spend cap starts silently resetting again, which is exactly how it hid the first time.
6. **`apps/web/next-env.d.ts` on its own**, with a message saying it is an *untracking*, not a
   deletion — otherwise the first person to hit a type error restores it.
7. **Test harness + checkers**, and **`comms/`** (can ride with 1 or stand alone).

---

## What this phase actually found

Phase 0 was scoped as "adds no features; converts a well-built repo into a running system". What
it produced was a single defect in eight costumes — **a declared value read as an observed one**:

- `brainCompleteness` reported **45%** for a `COMPANY.md` that is 0/20, computed by counting `##`
  headings. It scaled the galaxy's particle count, glow and core alpha, and would not have moved
  when the first nine real answers landed.
- `/api/cost/today` returned `runs: 0` during a ledger outage — byte-identical to a healthy empty day.
- `CostTicker` rendered *"This fills in the first time an agent run is traced"* during an outage:
  not a plausible zero but a plausible **narrative**, which closes the question instead of raising it.
- `/api/status` reported `"tailscale": "online"` because the env var was *set*, on a host with no
  Tailscale installed.
- Trace links pointed at a project that did not exist, and later at a compose-internal host, while
  traces landed correctly.
- `run-all.mjs` booked the entire vitest half as failed when it could not spawn on Windows, printing
  nothing.
- `check-tokens` output carried no identity, so two agents read 0 and 31 hours apart and spent real
  time suspecting the tooling. *A stale FAIL gets investigated; a stale PASS gets cited.*
- `check-rtl` cannot see strings in const maps or object literals, so its counter could not move
  however many were added.

Plus three of the same disease at a different altitude — **a comment mistaken for a mechanism**:
`workspace` confinement was a docstring (a run escaped and overwrote `.env`; fixed by checking the
tool's *argument*, not its name); `Ladder.tsx`'s docstring described a bug as if it were the spec;
and tokens contract §9.4 justified a rule with a measurement of a call site nobody had opened.

And two that were neither: the Part V **hard spend cap had never once persisted** (the runner could
not write the file, so it reset on every restart), and **twelve of twelve agents** declared
capabilities they did not have — the validator passed an entire library that provably could not
write its own artifacts.

None of it was visible before the stack came up. All of it would have been invisible underneath the
numbers the first real run produces. That is the argument for why Phase 0 had to precede P1, and
why a project axis — which multiplies every one of these surfaces — had to wait.

---

## Resuming

1. Read `comms/BOARD.md` first — milestone state, ownership, and the five open decisions.
2. Read the handoffs and status files of the five in-flight agents above; they finished after this
   log was written.
3. The critical path is the API key and the twenty answers. Everything downstream of a real run —
   the LIVE counter, cost surfaces, promoting agents to `status: live`, and **seven of M15's
   acceptance criteria** — is structural rather than empirical until those land.
