# AgnetOS — Command Center

A self-hosted SkillTree clone with remote control: MAP / DASHBOARDS / CHART / SESSIONS,
runnable agents, real observability, all on our own Docker over Tailscale.

**Spec of record:** [skilltree-clone-spec.md](skilltree-clone-spec.md). Every decision
cites a section number from it. When the spec and a preference disagree, the spec wins
until an ADR says otherwise.

## Before doing anything in this repo

1. Read [comms/BRIEF.md](comms/BRIEF.md) — capped at 150 lines: current milestone, the
   rules that don't bend, and the findings that each cost a session. **This is the whole
   mandatory read.** [comms/BOARD.md](comms/BOARD.md) is the full record — consult the
   section you need; do not ingest 1,300 lines to change one file.
2. Read [comms/README.md](comms/README.md) — the agent communication protocol.
3. Read the **sections** of the contracts in [comms/contracts/](comms/contracts/) that
   your work consumes. A contract you consume is not optional — most cross-agent bugs are
   a consumer who guessed — but the contracts total 4,400 lines and nobody needs all of it.

## Working with the specialist agents

Thirteen specialists + one orchestrator live in [.claude/agents/](.claude/agents/). Route
work by ownership (BOARD.md), not by convenience. `commandcenter-orchestrator` sweeps
status, arbitrates contract disputes, and advances milestones.

Shared procedures live in [.claude/skills/](.claude/skills/):
`cc-comms` (protocol) · `cc-design-tokens` (fidelity rules) · `cc-frontmatter` (agent
schema) · `cc-panels` (dashboards) · `cc-fidelity-check` (the acceptance gate) ·
`cc-milestone` (running a milestone).

## The rules that don't bend

1. **Chrome is monochrome; color is data ink.** (§1.3 — this is 90% of why it looks
   expensive.)
2. **Frontmatter is the single source of truth.** MAP, CHART and DASHBOARDS are
   projections of `agents/**/SKILL.md`. No view keeps its own copy. (Part IV)
3. **Dashboards are data, not code** — `panels/*.json`, seven widget types. (§2.5)
4. **The runner's tool allowlist is exactly `wired_into`.** Never a superset. (§3.2)
5. **Session E2E encryption stays intact** — decryption is client-side, always. (§3.1)
6. **No public ports; no auth in v1 by design** — tailnet only. Don't build anything that
   is only safe because auth exists. (§3.6)
7. **Traces and Postgres volumes stay local**, PII redacted at instrumentation. (Part VII.4)
8. **No hex outside `tokens.css`. No component library.** (Part I, Part V)
9. **Numbers must be real.** `status: live` and the LIVE counter come from actual runs —
   an honest empty state beats a plausible fake one. (Part VII.3)

## Definition of done

A handoff exists in `comms/handoffs/` (including its *Deliberately not done* section) and
`fidelity-qa-reviewer` has answered PASS. Not before.
