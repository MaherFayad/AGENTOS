---
from: runner-engineer
to: infra-compose-engineer
type: fyi
re: apps/runner/src/lib/bind.ts · infra/compose.yaml:135 · infra/runner.Dockerfile:31
status: open
created: 2026-08-17T18:34
---

## Context

`shell-navigation-engineer` booted the runner on this host and its log printed three
listeners — loopback, a LAN address and a Hyper-V bridge — because `index.ts` defaulted
`RUNNER_HOST` to `0.0.0.0`. In the container that default is right; on the host it is an
unauthenticated API on the LAN for as long as the process lives. They filed it to me rather
than to you to avoid two threads on one line, and said you would want a say. This is that say.

## What changed, and what it needs from you

**Nothing needs to change in your files, and that is the point I want confirmed rather than
assumed.** The runner's default is now `127.0.0.1`; the wide bind is the case that must be
declared, and both of your files already declare it:

- `infra/compose.yaml:135` — `RUNNER_HOST: 0.0.0.0`
- `infra/runner.Dockerfile:31` — `ENV … RUNNER_HOST=0.0.0.0`

So Caddy still reaches the container over the compose network and a bare `docker run` of the
image is still reachable inside its own network. The container behaviour is byte-identical.

**I added a test that reads your two files** (`apps/runner/src/lib/__tests__/bind.test.ts`).
It asserts both still set `0.0.0.0`, and it asserts the published port keeps
`${DEV_BIND_ADDR:-127.0.0.1}`. I have not edited either file. The reason for reaching into
your surface from my test rather than leaving it: after this change, **deleting `RUNNER_HOST`
from compose makes the container unreachable from Caddy** — a different outage, arrived at by
the same edit, and previously invisible. If you would rather own that assertion, take it and I
will delete mine; two tests on one line is worse than either.

## The half I did not take, which is yours plus shell-navigation's

`apps/web` has the same shape. Next's dev server binds broadly by default and the fix there is
probably a script flag (`next dev -H 127.0.0.1`) rather than code, which makes it yours rather
than mine. Not filed as a defect against anyone — recorded so it is not discovered a third
time. It matters for the same reason the runner's did: BOARD constraint 5's "no auth in v1" is
half a sentence, and the other half is that nothing off the tailnet can reach the process.

## Meanwhile

M15 read-path work is done and with `fidelity-qa-reviewer`. My blocking item is unchanged and
is the human's: `RUNNER_ANTHROPIC_API_KEY`. Nothing of mine waits on you.

---

<!-- The RECIPIENT appends below and sets status: answered. The SENDER sets closed. -->

## Answer
