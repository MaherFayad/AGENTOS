# ADR-040 — The five-field cron rule survives the parser it cited

**Date:** 2026-08-19 · **Author:** `scheduler-engineer` · **Status:** proposed
**Affects:** `scripts/validate-frontmatter.mjs` · `packages/contracts/src/frontmatter.ts` ·
`comms/contracts/frontmatter-schema.md` · `comms/contracts/scheduling.md` §3.2 · ADR-024 ·
`agent-library-curator` (co-owner) · `runner-engineer` (`apps/runner/src/lib/cron.ts`)

## Context

`scripts/validate-frontmatter.mjs:781` rejects a six-field `schedule:` with this reason:

> `schedule "<x>" is not a valid 5-field cron (ofelia would silently take a 6-field one to mean something else)`

`packages/contracts/src/frontmatter.ts:118` says the same thing in a doc comment: *"ofelia's Go
cron would accept it and the same string would then mean two different things depending on who
parsed it."*

**Ofelia left the stack at `e4e0bff`** — the service, its config mount, `infra/ofelia/config.ini`,
the image pin and `scripts/sync-ofelia.mjs` are all gone, under ADR-024, which moved the clock to
the coordinator. There is no Go cron parser in this repo and nothing reads a Docker label.

So the rule is standing on a citation to a deleted component. That is not a cosmetic problem.
**A constraint whose stated reason has evaporated is exactly the constraint the next person
loosens** — correctly, on the evidence in front of them, because the file tells them the only
thing it was protecting is gone. The rule has to either be re-justified or dropped, and leaving
it un-audited is the one option that guarantees somebody decides it later with less information.

`infra-compose-engineer` declined to touch it on ownership grounds, which was right. The file is
`agent-library-curator`'s and mine jointly: they own `contracts/frontmatter-schema.md`, and
`schedule:` is the one frontmatter field that belongs to the scheduling plane.

## Options

| Option | For | Against |
|---|---|---|
| **A — drop the rule, accept six-field** | Six-field (seconds-precision) cron is a real dialect; several schedulers speak it. Nothing in the stack refuses it any more *for ofelia's reason* | **Nothing in this repo can compute an occurrence for it.** `parseCron` throws `invalid_cron` on any expression that is not exactly five fields, and it is the only parser here. A six-field `schedule:` would validate, commit, render a clock badge on the MAP, and be unplannable forever |
| **B — keep the rule with the dead citation** | Zero diff | The next reader sees a rule protecting a component that does not exist and loosens it. This is the failure this ADR exists to prevent |
| **C — keep the rule, replace the reason with one that is still true, and make the new reason a gate** | The rule is *more* justified now than it was: ofelia was one consumer that disagreed; `parseCron` is the *only* consumer and it refuses outright. And the reason becomes checkable rather than assertable | Costs a gate and an ADR. Surfaces a second defect (below) that then has to be routed rather than ignored |

## Decision

**We keep the five-field-only rule and replace its justification.** The reason is no longer
ofelia. It is this:

> `parseCron` in `apps/runner/src/lib/cron.ts` is the only code in this repo that turns a cron
> expression into an occurrence. Both consumers share it — `nextRunAt`, which feeds the MAP's
> clock badge, and `scheduleClock.ts`, which the coordinator plans with (`scheduling.md` §12).
> It takes **exactly five fields** and throws `invalid_cron` on anything else. So a six-field
> `schedule:` in frontmatter is a clock badge for a job that can never be planned — frontmatter
> claiming a capability the coordinator does not have, which is BOARD rule 2 read from the
> direction that hurts.

Ofelia's version of the argument was *"two parsers will disagree."* The version that replaces it
is stronger and narrower: **there is one parser, and it refuses.**

**And the reason is enforced rather than written.** `apps/runner/src/lib/__tests__/cron-dialect.test.ts`
takes every `schedule:` string in the real `agents/**/SKILL.md` library and asserts the
coordinator's own parser accepts it. Not a comparison of two declarations — a comparison of a
committed value against the behaviour of the thing that has to consume it. It is red the day
somebody commits a six-field expression, and red for the *observed* reason rather than a
remembered one.

## The divergence this turned up, which is a live defect and is not fixed here

Writing the gate meant running both validators over the same corpus. They disagree, in both
directions, observed 2026-08-19T20:52 +03:00 on this host under vitest:

| expression | `isCronExpression` (frontmatter) | `parseCron` (the clock) |
|---|---|---|
| `0 0 * * 7` | **accepts** | **throws** `day of week 7 is out of range.` |
| `0 0 * * 1,7` | **accepts** | **throws** `day of week 7 is out of range.` |
| `0 0 * * mon` | rejects | accepts |
| `0 0 * * 0` · `0 6 * * 1` · `0 0 * * 1-5` · `*/15 * * * *` | accept | accept |

`CRON_BOUNDS[4]` in `frontmatter.ts` is `[0, 7]` with `7 == Sunday` — the POSIX/Vixie
convention, and the correct one. `FIELDS[4]` in the runner's `cron.ts` is `{ min: 0, max: 6 }`.

**So an agent can be committed today with `schedule: "0 0 * * 7"`, pass `validate:frontmatter`,
render a clock badge, and be un-plannable by the coordinator forever** — which is the exact
failure mode this ADR just re-justified the five-field rule to prevent, arriving through the gap
*between* the two validators instead of through a removed sidecar.

**It is not fixed in this ADR and no line of either file was changed to fix it**, because
`cron.ts` is `runner-engineer`'s and `frontmatter.ts` is `agent-library-curator`'s. The fix I
would propose is one line in `cron.ts` — day-of-week `max: 7` with `7` folded to `0` at match
time — because widening a parser to accept an expression POSIX has always called legal breaks no
existing schedule (the library holds three, using `1`, `2` and `*`), whereas narrowing
frontmatter is a schema change. Filed to both owners with this diagnosis.

Until one of them acts, the divergence is **pinned as observed** in the same test file, with a
failure message that says the defect is fixed and the pin should be replaced by the full
agreement gate. A pin that goes red when someone repairs the thing it describes is the honest
shape here: the alternative is a gate that is red on arrival in a file I do not own, which
nobody can land.

## Consequences

- **Becomes easy:** deciding the next cron dialect question. The rule now names a mechanism
  (`parseCron` refuses) rather than an absent component, so the next reader can check it in ten
  seconds instead of inferring it.
- **Becomes hard:** accepting six-field cron. It now requires changing `parseCron` — and
  therefore `nextRunAt`, `scheduleClock`, the preview and the badge — rather than relaxing a
  regex. That is the correct cost: seconds-precision scheduling is a real feature request and it
  should arrive as one.
- **If we reverse this:** dropping the rule requires `parseCron` to accept six fields *first*.
  The gate over the library is what makes reversing in the wrong order impossible to land.
- **What this ADR does not decide:** whether `schedule:` grows from a bare cron string into an
  object carrying `tz`, `follow_me`, `missed_run_policy` and `overlap_policy`. That is
  `scheduling.md` §11.1, it is `agent-library-curator`'s, and it is a frontmatter schema change
  needing its own ADR. It stays refused — see `SCHEDULE_LIBRARY_MATERIALIZATION.possibleToday`,
  typed `false`, and the tripwire strengthened alongside this ADR.

## Contract edits

- `scripts/validate-frontmatter.mjs:114` and `:781` — the doc comment and the error message stop
  citing ofelia and cite `parseCron` and this ADR. **The rule itself is unchanged**; no
  expression that validated yesterday fails today, and none that failed passes.
- `comms/contracts/scheduling.md` §3.2 — one paragraph recording that `cron` means the five-field
  dialect `parseCron` accepts, and naming the observed day-of-week divergence as open.
- **Requested, not made:** `packages/contracts/src/frontmatter.ts:117-121` (the doc comment) and
  `comms/contracts/frontmatter-schema.md:35, :62` (two lines still describing `schedule:` as
  driving ofelia) are `agent-library-curator`'s. Verbatim replacements are in the message filed to
  them; two of the three copies of a dead citation are theirs to retire and I did not edit them.
