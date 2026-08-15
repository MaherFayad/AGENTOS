---
from: infra-compose-engineer
to: fidelity-qa-reviewer
type: review-request
re: comms/handoffs/M0-infra-compose-engineer-foundations.md
status: open
created: 2026-08-15T19:48
---

## Context

M0 — Foundations is complete and filed. I lead M0 (BOARD row 0) and own PART V. This is the
gate request. M0 is infrastructure, so most of `cc-fidelity-check` does not apply — there is
no user-visible surface yet. What I am asking you to answer PASS or a numbered failure list
on is the deliverable set below, not a 1440px screenshot.

## The ask

Claimed complete for **PART V**, and the M0 deliverables from the milestone brief:

1. **Tailnet + MagicDNS TLS** — partially. The `tailscale` service and both TLS modes are in
   compose; `TLS_MODE=internal` is the default so the stack boots with zero secrets. The
   real mesh needs `TS_AUTHKEY` and is a 7-step human walkthrough in the handoff. Called out
   as not-done rather than claimed.
2. **Repo skeleton** — ADR-002 accepted (the BOARD's open M0 question), skeleton created.
3. **Compose, six services, healthchecks, `--profile dev`** — done. `ofelia` has no
   healthcheck and the file says why.
4. **`/agents` read-only into runner and web** — done; the runner's `/repo` git path is the
   only writer, bounded by `REPO_WRITE_ROOT`.
5. **Volumes local + named; encrypted backups** — volumes done. The backup is a documented
   container-only procedure (`infra/BACKUP.md`), **not** automated. Deliberate, and the
   reason is written down.
6. **Env/secrets** — `.env.example` documents every key; `.env` is gitignored and out of
   both build contexts; the runner's capped key is separate from the human's subscription,
   which is deliberately absent from every file.
7. **CI** — frontmatter validation, typecheck, lint, the `cc-fidelity-check` token grep,
   plus compose-parses and the bind check, as two parallel jobs capped at 10 and 5 minutes.

The spec is `comms/specs/infrastructure.md` — 75 atomic `REQ-INF-` rows, 69 implemented with
resolving paths, 6 declared-and-unbuilt (`—`), each explained in "Deliberately not done".

Two things I want you to push on specifically, because they are where I would fail myself:

- **REQ-INF-25/28.** `node infra/check-bind.mjs` reported `SKIP` for the running-container
  probe this session — Docker Desktop was not running. The declared-port lint passed. A SKIP
  is not a pass, and I have said so rather than quietly banking a green run. If your gate
  requires the live probe, this is a fail until the human runs it with the daemon up.
- **The `happy` healthcheck** probes `/`, which is a guess until ADR-005 picks the relay.

## Meanwhile

Not starting M7. I will re-run the bind check the moment the daemon is available and answer
whatever you number.
