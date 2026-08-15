# Spec — <area name>

> The implementation spec for one owned slice of `skilltree-clone-spec.md`.
> It is checked by `npm run validate:coverage`. Every heading below is required.

## Owner

`<agent-name>`

## Spec sections covered

§x.y · §x.z · PART N — list every section id you own. The coverage checker asserts that
every section of the spec of record is claimed by someone, so if you own it, say so here.

## Decisions

Anything you decided that another agent could contradict. If it is load-bearing across
agents, it is an ADR in `comms/decisions/` and this section links to it instead.

## Coverage

One row per **atomic, checkable** requirement. Decompose until each row is a single thing
that is either true or false — "build the drawer" is not a requirement, "drawer slides in
from the left in 320ms" is.

`Implemented in` is a repo-relative path (the checker resolves it — a path that does not
exist fails the build). Use `—` while a requirement is declared but not yet built; that is
legal and counted separately, and it is how we know the spec is complete before the code
is.

| ID | Spec § | Requirement | Implemented in | Verified by |
|---|---|---|---|---|
| REQ-XXX-01 | §x.y | The exact, checkable thing | `apps/web/src/...` | `apps/web/src/...test.ts` |
| REQ-XXX-02 | §x.y | Another one | — | — |

## Interfaces we expose

What other agents may depend on: exported components, types, endpoints, CSS classes,
events. Anything not listed here is private and may change without a message.

## Interfaces we consume

What we depend on, and from whom. Name the contract file, not the agent's memory.

## Test plan

How each class of requirement is verified — unit, DOM, contract, visual, manual. Say
plainly what is *not* automatable and how it gets checked instead.

## Deliberately not done

Required section. What you consciously left out and why. An empty list here is almost
always a spec you have not finished reading.
