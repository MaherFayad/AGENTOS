---
agent: drawer-engineer
milestone: M15
spec: §2.3 · §2.6.5 (Plan §23.6 · Plan §10 · ADR-014)
created: 2026-08-17T18:02
status: ready-for-review
---

# M15 — Provenance in both drawer headers

## The one sentence

Both drawer headers now answer *"is this the global agent, this project's own, or a fork
that has drifted?"* — using `design-system-guardian`'s `ProvenanceBadge` unchanged, from a
value parsed out of the cascade's own `source_ref`, and saying **unknown** whenever it does
not actually know, which today is most of the time and is stated rather than papered over.

## What exists now

| Path | What it is |
|---|---|
| `apps/web/src/drawer/data/provenance.ts` | **new.** The whole projection: `parseSourceRef`, `provenanceOfSourceRef`, `provenanceOfAgent`, `DrawerProvenance`. The web app's only reader of `{layer}:{path}@{digest}`. |
| `apps/web/src/drawer/data/provenance.test.ts` | **new.** 17 tests. |
| `apps/web/src/drawer/sections/Header.tsx` | takes a required `provenance` prop; renders the badge or the honest unknown marker in the eyebrow row. |
| `apps/web/src/drawer/sections/Header.test.tsx` | **new.** 7 tests, run against both the map eyebrow and the chart eyebrow. |
| `apps/web/src/drawer/run/console-model.ts` | `ConsoleState` retains `agent` and `sourceRef` off the `start` frame. |
| `apps/web/src/drawer/run/console-model.test.ts` | +1 test: the two fields are kept, and a reset clears them. |
| `apps/web/src/drawer/JobDrawer.tsx` | derives `provenance` per render and passes it to both anatomies. |
| `apps/web/src/drawer/drawer.module.css` | `.eyebrowGroup`, `.provenanceUnknown`. |
| `apps/web/src/i18n/strings.en.ts` / `.ar.ts` | `drawer.provenance.unknown`, `a11y.provenance.unknown`. Arabic filed as `todo()`. |
| `comms/specs/drawer.md` | REQ-DRW-25 repointed at the M15 route; REQ-DRW-30 / REQ-DRW-31 added. |

**Nothing under `components/primitives/**` was touched.** The badge is mounted exactly as
its owner shipped it — five states, three channels, no hue, no label prop, no default.

## How to use it

```tsx
import { provenanceOfAgent } from '@/drawer/data/provenance';

const provenance = provenanceOfAgent(slug, run.state);   // pure, per render
<DrawerHeader … provenance={provenance} />
```

`provenanceOfAgent` returns `{kind:'known', state, source}` or `{kind:'unknown'}`. There is
no third outcome and no default — `provenance` is a **required** prop on `DrawerHeader` for
the same reason `state` is required on the primitive: a header that omits provenance and a
header that says `global` are two different claims, and a default lets a call site spend the
second while meaning the first.

`MAP` and `CHART` are welcome to import `provenanceOfSourceRef` when their turn comes
(`size="sm"`); duplicating the layer→state mapping is the thing to avoid.

## The projection, and where it actually comes from

ADR-014 §2 splits identity from provenance: `agent_ref` is *who*, `source_ref =
{layer}:{path}@{digest}` is *which file won, at what content*, and it is **recorded on every
run, never on the agent**. So the drawer parses that string and stores nothing — no `layer`
field on `DrawerModel`, no cached badge state, nothing that could keep asserting a layer
after the cascade changed its mind.

**Layer → badge state, and this mapping is ADR-014's, not mine:**

| `source_ref` layer | badge | authority |
|---|---|---|
| `global` | `global` ⌂ | §1 L0 |
| `project` | `project` ▣ | §4.1 — *"an L1 or L2 file… Badge: `▣ project`"* |
| `override` | `project` ▣ | same sentence; L2 is `agents/_overrides/**` |

L1 and L2 are one answer to the reader's question — *this project's own* — and the badge has
no sixth silhouette for the difference. Which file it actually was is kept on
`source.path` rather than spent on a mark nobody could tell apart at 12px.

### The endpoint that has to carry it — named, not invented

> **`GET /api/agents/:slug` does not report provenance, and I did not add a field to say it
> does.**

`AgentDetail` is `{slug, path, frontmatter, body, runnable}` (`packages/contracts/src/api.ts`,
owner `runner-engineer`). The route behind it, `loadAgent`, does not call
`resolveThroughCascade` at all — it reads `<repo>/agents/{department}/{slug}/SKILL.md`
directly. There is nothing to project, so the header opens on `unknown`.

**Requested, one field, existing grammar:**

```ts
export interface AgentDetail {
  …
  /** `{layer}:{path}@sha256:…` — which file won the cascade for this agent, in this project. */
  sourceRef: string;
}
```

`resolveThroughCascade` already computes exactly this and `resolveForDispatch` already
returns it; the read path just does not go through the cascade yet. When it lands,
`provenanceOfAgent` gains one call site and nothing else in the drawer changes.
`decision-request` filed: `comms/inbox/runner-engineer/20260817-1802-drawer-engineer-agentdetail-needs-sourceref.md`.

**What *is* reachable today** is `SseStartData.sourceRef`, on the first frame of a run, and
that contract's own comment assigns the render to me: *"`drawer-engineer` renders the layer
half of this as the provenance badge (`⌂` global · `▣` project) in the drawer header."* So a
run answers the question; nothing else does.

### The guard that is the whole function

```ts
if (!slug || run.agent !== slug) return PROVENANCE_UNKNOWN;
```

One `useRunStream` serves the drawer for as long as it is mounted, and a finished run
outlives the drawer that started it. Without this, closing `sales/database-mining` and
opening `sales/account-enrichment` would show database-mining's layer under
account-enrichment's title — confidently, and wrongly. That is the exact fabrication the
badge exists to prevent, arrived at from the inside.

## Honest states — `unknown` is not `global`

Unknown renders as its own thing: **no mark**, the badge's own typography (10px caps,
`--track-1`) so the header does not reflow when a run reveals the real answer, at `--ink-2`
— the token every other honest empty state in this drawer already uses, and explicitly not
the disabled `--ink-3`. A visible `SOURCE UNKNOWN` plus a full sentence in the a11y tree
naming *why*.

It is deliberately **not a sixth badge state**. Every silhouette the primitive owns asserts a
layer; this asserts nothing, and it has to keep looking like nothing. `Header.test.tsx` pins
that with `expect(container.querySelector('svg')).toBeNull()` so the next edit cannot quietly
promote it into the primitive's vocabulary.

Four different facts all collapse to `unknown`, and that is correct — they are all *"we do
not know"*: no run has reported yet · the runner is older than the contract and sent no
`sourceRef` · the ref does not parse · the only run we have belongs to a different agent.

## Contracts touched

**None changed.** Consumed:

- `comms/contracts/design-tokens.md` §10 — the badge's grammar, `design-system-guardian`.
- `comms/contracts/agent-cascade.md` + ADR-014 — resolution and the override→`project`
  badge mapping, `agent-library-curator`. **ADR-014 went `accepted` at 18:15, mid-slice**,
  and `agent-cascade.md` stays a contract rather than merging away, so every citation in
  this work points at a live file. The one thing acceptance changed for me is the
  `forked_from` argument above; it got stronger, not weaker.
- `comms/contracts/api-contracts.md` — `SseStartData.sourceRef`, `runner-engineer`. One
  addition **requested by message, not edited**.
- `packages/contracts/src/project.ts` — `CascadeLayer`, `sourceRef()`. The test builds its
  fixtures with the contract's own function, so a grammar change breaks my tests first.

`comms/specs/drawer.md` is mine and was edited (below).

## Deliberately not done

- **Provenance badges on MAP nodes and CHART job cards.** BOARD puts both explicitly out of
  M15 — *"shell and drawer only — one vertical slice, not four half-slices."* The mapping
  they need is exported rather than duplicated; `size="sm"` is already there for them.
- **`fork` / `drifted` / `orphaned` — three of five states are unreachable and nothing
  fakes them.** ADR-014 was accepted while this slice was being built, so `forked_from` is
  now a real schema field and `AgentDetail.frontmatter` may carry one. **It is still not
  enough**, and this is the sharper form of the argument rather than a weaker one: all three
  are states of a *comparison* against the parent's current digest (cascade §4.3), and §11
  of that same contract records that nothing computes one — *"`ProvenanceBadge` exists and
  the drawer has the header slot; nothing computes a digest comparison — not built."*
  Rendering `fork` off the presence of the field would announce the badge's own sentence,
  *"and it still matches its parent"*, on the strength of a fetch nobody made.
  `provenance.test.ts` holds an assertion that **should fail and be rewritten** the day the
  resolver lands — a tripwire, not a lock.
- **Inventing `AgentDetail.sourceRef` myself.** Named and requested. Adding a field to a
  contract I do not own, to make my own surface look finished, is the failure mode this
  repo's rule 2 exists for.
- **Reading provenance from the agent's `path`.** `AgentDetail.path` is right there and a
  regex on `_overrides/` would light the badge up today. It would also be the drawer
  inventing its own resolution algorithm — the second implementation ADR-014 decision 9
  forbids by name, and it would be wrong the moment a global library exists, since an L0
  path looks like an L1 path from here.
- **A "provenance" section in the drawer body.** §23.6 says header. The path and digest are
  carried on the model for whoever needs them; they are not printed.
- **Project-scoping the drawer's own fetches — see the finding below.** Real, mine, and not
  fixed inside a provenance dispatch.
- **Arabic for the two new keys.** `todo()`, which renders English and is counted, rather
  than a coinage a native reviewer finds in a client demo. `untranslatedKeys('ar')` is 3
  against a ceiling of 5. Filed with `rtl-arabic-pdpl-specialist`.

## A finding outside this slice, reported because it is mine

**The drawer's own API calls are still pre-M15 and now answer `400 project_scope_missing`.**
`data/client.ts` (`/api/agents/:slug`, `/api/metrics/runs`, `/api/schedule`,
`/api/approvals/:runId`) and `run/transport.ts` (`/api/run`, `/api/run/:runId/stream`) do not
carry a project segment. Per `runner-engineer`'s broadcast, every one of those refuses.

Two consequences worth stating plainly rather than discovering later:

1. The drawer currently cannot load an agent against a current runner.
2. **The known-provenance branch cannot be exercised end to end today** — not because of
   this slice, but because no run can start. It is proven at the unit level and by
   construction; it has never been seen lit up by a live cascade. That is the same
   *complete-is-not-validated* distinction BOARD puts at the top of M15, and it applies to
   this handoff in full.

Not fixed here on purpose: it is a separate vertical slice touching every fetch in the
drawer, it needs `projectPath(RUNNER_ROUTES.x.path, slug)` and a project in context, and
several agents are migrating their own callers concurrently. `fyi` filed to
`shell-navigation-engineer` and `runner-engineer`; it is next in my status.

## Coverage — the coordinator's addendum

`comms/specs/drawer.md`, and only that file:

- **REQ-DRW-25 repointed, not blind-renamed.** Opened
  `apps/web/src/app/(views)/p/[project]/map/[department]/[agent]/page.tsx` and
  `JobDrawerRoute.tsx` first. The requirement's *semantics* moved too, so the text moved
  with it: the route is `/p/:project/map/:department/:agent`, and closing the drawer now
  returns to the department **in the project it was opened in** (`withProject(…,
  route.project)`), which the old wording did not describe.
- **REQ-DRW-30 / REQ-DRW-31 added**, because a shipped surface with no requirement behind it
  is invisible to every future check — 30 for the badge as a projection, 31 for `unknown` not
  being `global`. Both cite §2.3 (the header is §2.3 items 1–2) and name `Plan §23.6` in the
  requirement text; `Plan §` ids are invisible to the checker by ADR-013 and citing one in
  the section column would have been decorative.
- Decisions 8–9, a Test plan entry, six *Deliberately not done* entries and two
  *Interfaces we consume* rows.

**`drawer.md`: 1 FAIL → 0 FAIL, 0 warnings.** The remaining 13 repo-wide failures are in
`chart-matrix.md`, `dashboards.md`, `map.md`, `sessions.md` and `shell-navigation.md`, left
untouched as instructed.

## Verification

**Token discipline — §8b provenance line, verbatim:**

```
Token discipline
  scanned at        2026-08-17 18:05 +03:00 · 1e5b5d7 · 16 uncommitted under apps/web
  files scanned     305
  violations        0
  exemptions        2
```

Both exemptions are `design-system-guardian`'s pre-existing `Chip` pair. Zero from this work.

**Read the `scanned at` line, not the number alone.** `1e5b5d7` with 16 uncommitted and 305
files scanned is a tree six agents are landing M15 work into simultaneously — my own first
scan an hour earlier saw 303 files and 11 uncommitted, and the vitest count moved 488 → 497
between two runs of mine that changed nothing. That churn is the reason §8b exists; the
banner is what makes the result datable rather than merely true-once.

| Check | Result |
|---|---|
| `npm run test:web` | **497 vitest passed (63 files) + 101 node:test passed.** Green both halves. |
| — this slice | `provenance.test.ts` 17 · `Header.test.tsx` 7 · `console-model.test.ts` +1 |
| `npx tsc --noEmit` (`apps/web`) | exit 0 |
| `npx tsc --noEmit` (`apps/runner`) | exit 0 |
| `node scripts/check-tokens.mjs` | exit 0, 0 violations |
| `npm run validate:coverage` | `drawer.md` 0 FAIL / 0 warn (was 1 FAIL) |
| `node scripts/check-rtl.mjs` | pre-existing repo red (M8). **Zero hits in any file this slice touched** — `Header.tsx`, `provenance.ts` and both catalogues are clean. |

**Not verified, and it is the honest half:** no run has ever executed
(`RUNNER_ANTHROPIC_API_KEY` unset, and the drawer's fetches are unscoped besides), so the
`known` branch has never been driven by a real cascade. Everything above is unit-level and
structural. Per BOARD: complete, not validated.

## Next agent

`fidelity-qa-reviewer` — `review-request` filed. Read `data/provenance.ts`'s header first;
it is where the *unknown-is-not-global* argument lives and it is the thing most worth
disagreeing with.

Then, in order of who is blocked: `runner-engineer` (one field on `AgentDetail`),
`rtl-arabic-pdpl-specialist` (two `todo()` keys), and `map-galaxy-engineer` /
`chart-matrix-engineer` when their badges come off the out-of-scope list — import
`provenanceOfSourceRef`, do not re-derive the mapping.
