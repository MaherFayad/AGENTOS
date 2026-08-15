# BOARD — Command Center build

**Spec of record:** [skilltree-clone-spec.md](../skilltree-clone-spec.md) — every decision
traces back to a section number in it. Quote the section when you cite it.

**Current milestone:** `M0 — Foundations` (Part VI, row 0)
**Fidelity bar:** side-by-side screenshot of MAP vs their video frame at 1440px differs
only in content (Part VI, acceptance).

---

## Roster & ownership

| Agent | Owns (spec §) | Owns contract |
|---|---|---|
| `design-system-guardian` | Part I — tokens, type, shape, motion | `contracts/design-tokens.md` |
| `shell-navigation-engineer` | §2.0 shell, search, tabs, §3.6 PWA | — |
| `map-galaxy-engineer` | §2.1–2.2 galaxy, force layout, canvas | `contracts/graph-layout.md` |
| `drawer-engineer` | §2.3 map drawer, §2.6.5 chart drawer | — |
| `dashboards-engineer` | §2.4–2.5 carousel + 7 widget types | `contracts/panel-schema.md` |
| `chart-matrix-engineer` | §2.6 rollout matrix | — |
| `runner-engineer` | §3.2 run/schedule/approvals, §3.3 brain | `contracts/api-contracts.md` |
| `sessions-relay-engineer` | §3.1 SESSIONS tab, Happy relay, push | — |
| `observability-engineer` | §3.5 Langfuse, cost ticker, LAST RUNS | — |
| `infra-compose-engineer` | Part V — Docker, Caddy, Tailscale, ofelia | — |
| `agent-library-curator` | Part IV — agents/, seeding, normalization | `contracts/frontmatter-schema.md` |
| `rtl-arabic-pdpl-specialist` | §1.4 Arabic, RTL pass, PDPL (Part VII.4) | — |
| `fidelity-qa-reviewer` | Part VI acceptance, a11y, perf, review gate | — |

`commandcenter-orchestrator` sweeps status/, resolves cross-agent conflicts, and
advances the milestone. It does not write feature code.

---

## Milestone ladder (Part VI)

| # | Milestone | Lead | Supporting | State |
|---|---|---|---|---|
| 0 | Foundations — tailnet, repo skeleton, frontmatter schema, Tailwind tokens | `infra-compose-engineer` | `design-system-guardian`, `agent-library-curator` | **active** |
| 1 | Shell + MAP galaxy | `map-galaxy-engineer` | `shell-navigation-engineer`, `design-system-guardian` | blocked on M0 |
| 2 | Department view + drawer (read-only) | `drawer-engineer` | `map-galaxy-engineer` | blocked on M1 |
| 3 | Runner + Run now + Langfuse | `runner-engineer` | `observability-engineer`, `drawer-engineer` | blocked on M2 |
| 4 | SESSIONS tab + PWA + push | `sessions-relay-engineer` | `shell-navigation-engineer` | blocked on M0 |
| 5 | CHART matrix | `chart-matrix-engineer` | `drawer-engineer` | blocked on M2 |
| 6 | DASHBOARDS carousel + widgets | `dashboards-engineer` | `observability-engineer` | blocked on M3 |
| 7 | Schedule + audit + interview | `runner-engineer` | `agent-library-curator`, `infra-compose-engineer` | blocked on M3 |
| 8 | Polish — light theme, RTL, motion, mobile | `rtl-arabic-pdpl-specialist` | all | ongoing |

Only the lead flips a milestone state, and only after `fidelity-qa-reviewer` files a
`review-request` answer that says PASS.

---

## Standing constraints (violating these is a bug, not a preference)

1. **Chrome is monochrome.** Color only as data ink + the single copper accent (§1.3).
2. **No component library.** Tailwind + CSS vars + D3 + Framer Motion only (Part V).
3. **Never hardcode a color.** Every color is `var(--token)` from the tokens contract.
4. **Frontmatter is the single source of truth** for all three views (Part IV). Views
   project it; they never store their own copy of agent data.
5. **No public ports.** Tailnet-only, no auth in v1 by design (§3.6).
6. **Traces and Postgres volumes stay local** (§3.5, Part VII.4).
7. Self-hosted fonts via `@fontsource`; no external network requests at runtime (§1.4).

---

## Open cross-cutting questions

Answer these as ADRs before the milestone that depends on them.

- [x] `M0` Which 7 canonical departments? → **[ADR-001](decisions/ADR-001-department-taxonomy.md)** accepted. Sales · Deals · Marketing · Operations · Intelligence · Customer · Back Office, in that order; `cluster` is free text validated against `agents/_registry/clusters.json`.
- [x] `M0` Repo shape → **[ADR-002](decisions/ADR-002-repo-shape.md)** accepted. npm-workspaces monorepo; `packages/contracts` is the code half of `comms/contracts/`.
- [x] `M1` Layout precompute → **[ADR-003](decisions/ADR-003-layout-precompute.md)** accepted. One pure engine, two callers, seeded previous positions, deterministic.
- [ ] `M3` Runner auth to Langfuse + which API-key workspace holds the monthly cap (Part V billing) — `runner-engineer`
- [ ] `M4` Happy self-hosted vs Omnara (§3.1) → ADR-005 — `sessions-relay-engineer`
- [ ] `M6` The six Command Centers for *our* stack (§2.4 "Ours:") → ADR-004 — `dashboards-engineer`
- [ ] Any `deliver:` target that leaves the tailnet is a data-egress decision needing its own ADR (Part VII.4) — `rtl-arabic-pdpl-specialist`

---

## Spec coverage — the completeness gate

Every section of the spec of record must be **claimed by exactly one agent** in
`comms/specs/<area>.md`, written from `comms/specs/_TEMPLATE.md`. `npm run validate:coverage`
fails the build when a section is unclaimed, when a requirement cites a file that does not
exist, or when a requirement cites no spec section.

Sections are listed individually, not as ranges — the checker matches them literally, and a
range would leave the sections inside it owned by nobody.

| Spec section | Claimed by |
|---|---|
| PART I · §1.1 · §1.2 · §1.3 · §1.4 · §1.5 · §1.6 | `design-system-guardian` |
| PART II · §2.0 · §2.7 · §3.6 | `shell-navigation-engineer` |
| §2.1 · §2.2 | `map-galaxy-engineer` |
| §2.3 | `drawer-engineer` |
| §2.4 · §2.5 | `dashboards-engineer` |
| §2.6 | `chart-matrix-engineer` |
| PART III · §3.2 · §3.3 | `runner-engineer` |
| §3.1 | `sessions-relay-engineer` |
| §3.5 | `observability-engineer` |
| PART IV · §3.4 | `agent-library-curator` |
| PART V | `infra-compose-engineer` |
| PART VI | `fidelity-qa-reviewer` |
| PART VII | `rtl-arabic-pdpl-specialist` |

A requirement whose `Implemented in` column is `—` is **declared but unbuilt** — legal, counted
separately, and the honest way to show the spec is complete before the code is. A requirement
pointing at a file that does not exist is a lie in a document, which is worse than a gap,
because a gap is visible.
