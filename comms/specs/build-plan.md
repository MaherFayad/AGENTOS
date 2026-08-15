# Spec — build plan and the acceptance gate

> The implementation spec for PART VI of `skilltree-clone-spec.md`.
> Checked by `npm run validate:coverage`.

## Owner

`fidelity-qa-reviewer`

## Spec sections covered

PART VI — BUILD PLAN: the nine-row milestone ladder, and the acceptance sentence that
nothing else in the spec is allowed to weaken.

## Boundaries — sections this spec cites but does not own

The coverage checker treats every `§n.n` / `PART N` under **Spec sections covered** as an
ownership claim. Those ids do not appear above. Citing them here is not claiming them:

| Section | Owner | What is mine | What is theirs |
|---|---|---|---|
| PART I · §1.1–§1.6 | `design-system-guardian` | the token grep and the monochrome-chrome scan | the tokens, type, shape, motion values |
| §2.0 · §2.7 · §3.6 | `shell-navigation-engineer` | whether the shell stills, focuses, and stays monochrome | the shell, search, tabs, PWA |
| §2.1 · §2.2 | `map-galaxy-engineer` | the 1440px MAP screenshot test | the galaxy, force layout, canvas |
| §2.3 · §2.6.5 | `drawer-engineer` | drawer timing, focus trap, Esc | the drawer anatomy |
| §2.4 · §2.5 | `dashboards-engineer` | widget empty/failure states, carousel motion | carousel, seven widgets, `panels/*.json` |
| §2.6 | `chart-matrix-engineer` | matrix empty cells vs fabricated counts | the rollout matrix |
| §3.1 | `sessions-relay-engineer` | E2E stays client-side (a gate check, not an implementation) | the SESSIONS tab and the relay |
| §3.2 · §3.3 · PART III | `runner-engineer` | allowlist is exactly `wired_into`; numbers from real runs | run/schedule/approvals, the interview |
| §3.5 | `observability-engineer` | LIVE/cost never fabricated | Langfuse, ticker, LAST RUNS |
| PART IV · §3.4 | `agent-library-curator` | views project frontmatter, they do not copy it | the schema, the library, the auditor |
| PART V | `infra-compose-engineer` | no public bind, volumes local — checked at M0 | compose, Caddy, Tailscale, ofelia |
| PART VII | `rtl-arabic-pdpl-specialist` | RTL stills and contrast; honest flags | Arabic, RTL, PDPL |

This spec does **not** claim any §2.x product screen.

## Decisions

1. **The gate does not author the work it reviews.** A silent edit of the artefact under
   review would make the reviewer the author, and then nobody is reviewing it. Findings
   go back as a numbered list on the `review-request`. Only after **PASS** may the
   milestone lead flip BOARD state.

2. **M0 is infrastructure, not a screenshot.** PART VI row 0 has no MAP. The 1440px
   side-by-side is the bar for M1 onward. An infra review gates the PART V / M0
   deliverable set (compose, binds, mounts, secrets, CI), not a video frame.

3. **A SKIP is not a pass.** REQ-INF-25/28's running-container probe must inspect live
   containers. Declared-port lint is necessary and not sufficient. The gate records a
   SKIP as a finding rather than inventing a green run.

4. **Declared-and-unbuilt is legal.** A PART VI row whose `Implemented in` is `—` means
   the milestone has not been built, or the screenshot has not been taken. That is how
   the plan stays complete before the code is. A path that does not exist is a lie.

5. **One review at a time.** User-visible specialists still wiring placeholders are not
   reviewed in the same turn as an open infra gate.

## Coverage

| ID | Spec § | Requirement | Implemented in | Verified by |
|---|---|---|---|---|
| REQ-FID-01 | PART VI | The BOARD milestone ladder has the same nine rows as PART VI (Foundations through Polish), each with a named lead | `comms/BOARD.md` | `scripts/check-comms.mjs` |
| REQ-FID-02 | PART VI | Only the milestone lead flips BOARD state, and only after this agent answers a `review-request` with PASS | `comms/BOARD.md` | `comms/templates/message.md` |
| REQ-FID-03 | PART VI | M0 — Foundations: Tailscale mesh, repo skeleton, frontmatter schema, Tailwind tokens | — | — |
| REQ-FID-04 | PART VI | M1 — Shell + MAP galaxy: app shell, segmented tabs, search, D3 force precompute, starfield+galaxy canvas, nodes/edges/labels, pan/zoom/drag, department focus arrows | — | — |
| REQ-FID-05 | PART VI | M2 — Department view + drawer: drill-in zoom, watermark, rail, sub-clusters, full drawer anatomy read-only | — | — |
| REQ-FID-06 | PART VI | M3 — Runner + Run now: Agent SDK service, SSE console, Langfuse wiring, cost ticker, LAST RUNS | — | — |
| REQ-FID-07 | PART VI | M4 — SESSIONS tab: happy-server compose, session list, stream view, permission cards, PWA manifest + push | — | — |
| REQ-FID-08 | PART VI | M5 — CHART: matrix projection, job cards, right drawer, department tabs | — | — |
| REQ-FID-09 | PART VI | M6 — DASHBOARDS: carousel, seven widget types, `panels/*.json`, Langfuse-backed ops panels, activity feed | — | — |
| REQ-FID-10 | PART VI | M7 — Schedule + audit + interview: ofelia sync, schedule badges, approvals, agent-auditor, company-interview | — | — |
| REQ-FID-11 | PART VI | M8 — Polish: light theme, Arabic/RTL, edge pulses, count-up numbers, empty states, mobile QA | — | — |
| REQ-FID-12 | PART VI | Acceptance: a side-by-side screenshot of our MAP vs their video frame at 1440px differs only in content — not in proportion, tracking, weight, radius, color, or density | — | — |
| REQ-FID-13 | PART VI | The token audit greps for hex outside `tokens.css` and fails the build on a hit | `.github/workflows/ci.yml` · `scripts/check-tokens.mjs` | `.github/workflows/ci.yml` |
| REQ-FID-14 | PART VI | Color on chrome is a finding even when the hex grep is clean: a tinted border, a colored tab, a blue focus ring, an icon that is not status | `.claude/skills/cc-fidelity-check/SKILL.md` | `.claude/skills/cc-fidelity-check/SKILL.md` |
| REQ-FID-15 | PART VI | Wide-tracked caps are tracked 0.25em–0.45em; Instrument Serif italic is present where the spec puts it and absent from body and Arabic; KPI numerals are `tabular-nums` | `.claude/skills/cc-fidelity-check/SKILL.md` | `.claude/skills/cc-fidelity-check/SKILL.md` |
| REQ-FID-16 | PART VI | Motion timings are drawer 320ms, department zoom 700ms, panel reveal 500ms `cubic-bezier(.2,.7,.2,1)`, edge relax 600ms, count-up 300ms; `prefers-reduced-motion: reduce` stills them with no layout change | `.claude/skills/cc-fidelity-check/SKILL.md` | `.claude/skills/cc-fidelity-check/SKILL.md` |
| REQ-FID-17 | PART VI | Every control is keyboard-reachable; focus is visible and monochrome; drawers trap focus and close on Esc; search reaches any agent; canvas is `aria-hidden` | `.claude/skills/cc-fidelity-check/SKILL.md` | `.claude/skills/cc-fidelity-check/SKILL.md` |
| REQ-FID-18 | PART VI | Every view has a human-written empty and failure state; a spinner-only state fails; a fabricated placeholder number that reads as real data fails | `.claude/skills/cc-fidelity-check/SKILL.md` | `.claude/skills/cc-fidelity-check/SKILL.md` |
| REQ-FID-19 | PART VI | A review-request is answered on the same file with `## Answer` and `status: answered`; the verdict is PASS or a numbered list of file+line findings | `comms/templates/message.md` · `.claude/skills/cc-comms/SKILL.md` | `scripts/check-comms.mjs` |
| REQ-FID-20 | PART VI | Chrome remains monochrome; color is data ink plus the single copper accent | `apps/web/src/styles/tokens.css` · `.claude/skills/cc-design-tokens/SKILL.md` | `scripts/check-tokens.mjs` |

## Interfaces we expose

- **The verdict.** `## Answer` on a `review-request` addressed to `fidelity-qa-reviewer`:
  **PASS** (optional follow-up tickets that do not block) or **FAIL** (numbered list:
  path + line, spec quote, what the code does, smallest fix). BOARD does not flip without
  PASS.
- **This spec.** PART VI coverage rows. Other agents do not implement these rows; they
  satisfy them by shipping the milestone they lead and requesting review.
- **The gate procedure.** `.claude/skills/cc-fidelity-check/SKILL.md` — token audit,
  type/spacing, motion, 1440px screenshot, a11y, performance, empty/failure, RTL.

## Interfaces we consume

| What | From | Contract |
|---|---|---|
| Token values, type, shape, motion | `design-system-guardian` | `comms/contracts/design-tokens.md` |
| Compose, binds, mounts, secrets, CI | `infra-compose-engineer` | `comms/specs/infrastructure.md` |
| Who owns which § | `commandcenter-orchestrator` | `comms/BOARD.md` |
| The acceptance sentence and the ladder | spec of record | `skilltree-clone-spec.md` PART VI |
| How a review-request is filed and answered | protocol | `comms/README.md` · `comms/templates/message.md` |

## Test plan

- **Automated, every push:** hex grep (`scripts/check-tokens.mjs` and the CI token-audit
  step); comms check (a `review-request` has valid frontmatter); spec coverage (this file
  claims PART VI; every `Implemented in` path resolves or is `—`).
- **M0 / infra:** not a screenshot. Gate the deliverable list on the review-request
  against PART V and `comms/specs/infrastructure.md`. Run `node infra/check-bind.mjs`.
  A SKIP on the running-container probe is a finding. Confirm `/agents` is `:ro`, volumes
  are named `driver: local`, no published `0.0.0.0`, `.env` is gitignored.
- **M1+ / product:** render at exactly 1440px, dark theme, side-by-side against the
  referenced video frame. Content may differ. Proportion, tracking, weight, radius, color
  and density may not. Then reduced-motion. Then keyboard.
- **Not automatable, and how it gets checked instead:** color-on-chrome, under-tracking,
  and "this number is fake" are judgment. They are this agent's job on the review-request,
  with a file path, not a vibe.

## Deliberately not done

- **The 1440px MAP screenshot.** There is no mounted MAP to photograph. PART VI's
  acceptance sentence is declared (REQ-FID-12) and unbuilt. It becomes the gate at M1.
- **Review of MAP / CHART / DASHBOARDS / shell / drawer UI.** Those specialists are still
  wiring placeholders. One review at a time; the open item this session is M0 infra.
- **Measuring live motion timings.** Nothing to time until a drawer and a galaxy exist.
- **Flipping BOARD.** A FAIL does not advance M0. The lead flips state, and only after PASS.
- **Authoring a fix in `infra/`.** Findings go back as a numbered list. Editing compose
  would make this agent the author of the work under review.
