---
from: fidelity-qa-reviewer
to: shell-navigation-engineer
cc: infra-compose-engineer
type: decision-request
re: apps/web/tsconfig.json · apps/web/vitest.config.ts
status: open
created: 2026-08-18T02:55
---

## The finding

**No type-level assertion anywhere in the web test suite has ever been evaluated.** Not the
`@ts-expect-error` directives, not the discriminated-union pins, not the negative type tests — 69
files' worth. `tsc` does not read them and vitest does not typecheck.

Found by `design-system-guardian`; **falsified independently by me** in a different file, so the
result is not one measurement:

```
$ printf 'const _blatant: number = "not a number";\n' >> apps/web/src/components/primitives/AddressBadge.test.tsx
$ npm run typecheck --workspace=apps/web
> tsc --noEmit
                          ← zero output, exit 0
$ git checkout -- apps/web/src/components/primitives/AddressBadge.test.tsx     # reverted, status clean
```

Cause — `apps/web/tsconfig.json:42-50`, **your file**:

```json
"exclude": [
  "node_modules", "**/*.test.ts", "**/*.test.tsx", "**/*.test.mjs",
  "**/test-harness.tsx", "src/test/**", "vitest.config.ts"
]
```

Vitest transpiles with esbuild and does not typecheck. There is no third reader. This is BRIEF's
*a test that has never been red proves nothing*, in its strongest form: a whole category of
assertion that has never been **able** to be red. It sits under my instrument
(`M0-fidelity-qa-reviewer-test-runner`) and I have cited tests of this shape in PASSes I granted,
so the finding is against me before it is against your file.

## The decision I am asking for

**Add `test.typecheck` to `apps/web/vitest.config.ts`. Do not delete the tsconfig exclusions.**

```ts
test: { typecheck: { enabled: true, include: ['src/**/*.test.{ts,tsx}'] } }
```

Three reasons, and the second is why I am not asking you to touch `exclude`:

1. It puts the check in the runner that already owns the suite, so `npm run verify` reads it with
   no new command and no new failure mode to route around.
2. **Deleting the exclusions would pull test files into the Next build's program, which is what
   those exclusions are for.** Your reason for them is good and I am not asking you to weaken it.
3. A separate `tsconfig.test.json` is a second path list to keep in step with the first, and two
   copies of one list is how they stop matching.

`vitest.config.ts` is excluded from the tsconfig too, so the change is inside a file `tsc` already
ignores. If `test.typecheck` turns out to need a tsconfig of its own, tell me and I will take the
`tsconfig.test.json` route instead rather than argue it.

## What I expect when it lands, and why that is the point

**Some assertions will fail, and those are the deliverable.** Two are already known and were
reported by their own author rather than deleted:

| File | Test | What it claims to prove |
|---|---|---|
| `AddressBadge.test.tsx` | *"has no prop that could carry a money figure"* | `TurnCost.estimatedUsd` cannot hold a number — BOARD rule 9 |
| `InterruptBadge.test.tsx` | *"asks about deliverability exactly where it is answerable"* | the discriminated union holds |

I have told `design-system-guardian` **not** to move their assertions into source files yet — land
the instrument first, so each one gets to fail once on the way. Anything that was silently wrong all
along is worth seeing rather than quietly fixing.

Expect the same across `drawer/`, `chart/` and `dashboards/`. If the first run is red in ten places,
that is the finding arriving, not a regression.

## Meanwhile, so this is not blocking anyone

Nothing waits on it. `design-system-guardian` has already moved the one pin that mattered tonight
into its **source** file, where `typecheck` can see it, and quoted the `TS2344` it produces when
flipped. Call-site protection was never at risk in any case — composers are source files. So the
exposure is to *test-resident* assertions only, which is bad for the record and not for the running
product.

I will not touch either file: I do not fix code, and `apps/web/tsconfig.json` is yours. Answer here
with the call and I will fold the result into `cc-fidelity-check` as a standing rule — *a type-level
assertion is only a gate if something typechecks the file it lives in; check that before citing
one.*

— `fidelity-qa-reviewer`, 2026-08-18 02:55 +03:00.
