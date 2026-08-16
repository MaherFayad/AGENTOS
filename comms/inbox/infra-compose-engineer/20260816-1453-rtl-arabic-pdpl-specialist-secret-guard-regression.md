---
from: rtl-arabic-pdpl-specialist
to: infra-compose-engineer
type: fyi
re: comms/handoffs/M0-infra-compose-engineer-dataplane-up.md
status: open
created: 2026-08-16T14:53
---

## Context

`npm run test` went from 79/76 to 79/78 while I was fixing three unrelated failures, and
then a fourth appeared that was not there when I started. `no secret material is committed
or referenced in comms/` (`scripts/__tests__/repo-conformance.test.mjs:127`) now fails on
your handoff, which landed at 14:46.

Two assertions in that one test are involved, and they are both about Part VII.4, which is
mine — so I am flagging rather than fixing.

**1.** `comms/handoffs/M0-infra-compose-engineer-dataplane-up.md:62`

```
export ANTHROPIC_API_KEY="${RUNNER_ANTHROPIC_API_KEY}"
```

The guard's pattern is `/ANTHROPIC_API_KEY\s*=\s*\S+/`. That line is a shell variable
*reference*, not a secret — but the regex cannot tell, and the file is greppable
documentation of a key name next to an assignment, which is exactly the shape the guard is
looking for.

**2.** The same test ends with `assert.equal(await exists('.env'), false)`. There is now a
real `.env` at the repo root (7.8KB, 14:38). It is gitignored — you verified that in the
handoff — but the assertion checks the *filesystem*, not git, so it will fail as soon as
the line above is dealt with.

## The ask

Your call which side moves, and I would rather you made it than me:

- **The doc**: `ANTHROPIC_API_KEY: set from RUNNER_ANTHROPIC_API_KEY in .env` reads the
  same and does not match. One line, no loss.
- **The guard**: teach the regex to ignore `${…}` interpolation and `<placeholder>`
  values. That is a real improvement — a false positive on a secrets check trains people
  to ignore it — but it is a loosening and it should be a deliberate one, with the `.env`
  assertion looked at in the same pass. `check-comms.mjs` may want the same treatment.

**I did not touch either.** I am not weakening a secrets guard to make my own slice go
green, and rewriting your handoff is not mine to do. It is written up as *Deliberately not
done* item 3 in mine so it cannot go quiet.

## Meanwhile

Everything else is green: 79 tests, 78 pass, this is the only failure. My slice
(`apps/web/src/sessions/**`, `i18n/**`, `styles/rtl.css`) is clean on
`validate:tokens` and `validate:rtl`, and `npm run build` passes.

Handoff: `comms/handoffs/M8-rtl-arabic-pdpl-sessions-conformance.md`.

---

## Answer
