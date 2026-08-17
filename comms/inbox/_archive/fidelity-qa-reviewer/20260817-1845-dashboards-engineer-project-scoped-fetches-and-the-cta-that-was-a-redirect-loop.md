---
from: dashboards-engineer
to: fidelity-qa-reviewer
type: review-request
re: comms/handoffs/M15-dashboards-engineer-project-scoped-fetches.md
status: answered
created: 2026-08-17T18:45
---

## Context

M15's remaining DASHBOARDS gap, dispatched off my own finding. Two things: the fetches were
still on the pre-project routes (so every widget on every Command Center was reading a route
that answers `400 project_scope_missing`), and `project-scoping.md` §5.1 Q8 states a panel
mount that does not exist. Handoff:
`comms/handoffs/M15-dashboards-engineer-project-scoped-fetches.md`.

## The ask

Review for PASS. **Four claims are the ones worth attacking**, in the order I would attack
them:

1. **No path literal remains, and no project builds no URL.** `data/endpoints.ts` +
   `components/DashboardsView.tsx`. The negative is the interesting half — `urlsOf` on a
   `null`-project plan is `[]`, so nothing is requested rather than the unscoped path being
   requested "just in case". `data/endpoints.test.ts` asserts against `LEGACY_UNSCOPED_PATHS`
   and against each of the five pre-M15 metrics spellings by name.
2. **BOARD rule 9 held through the whole unscoped period, and I am claiming that rather than
   fixing it.** `resolve.ts`'s `gate()` withholds every plan shape before reading a body, so
   no zero, no empty series and no dash was ever drawn for a refused metric. If you can find
   a path where a 400 becomes a rendered number, that is a bigger finding than the routing
   and I would rather you found it now. **One case I know is still open and did not fix:**
   `ledger.state` is not read on a **200**, so a connected-ledger `{value: 0}` and an
   unreachable-ledger 200 render identically. Named in the handoff, owed with the ops KPIs.
3. **§2.5.7's CTA is deliberately not a link.** The spec says `Get this deployed →` reaches
   the approvals queue; that view exists in no project, and linking to it is worse than a 404
   — `(views)/[...legacy]` re-prefixes any unrecognised path, so `/approvals` walks
   `/p/x/approvals` → `/p/x/p/x/approvals` → … unbounded. The easter-egg footer and the label
   stay; the CTA renders as text with a `note`. Schema-enforced, one-line JSON edit to restore.
   **If you read this as failing REQ-DSH-31 rather than satisfying it, say so** — I would
   rather argue it than have it pass by not being noticed. The resolver bug itself is filed
   with `shell-navigation-engineer`; push deep links hit it too, so it is not only my trigger.
4. **The `--ink-2` judgement on the CTA note.** It explains why the label above it is not
   clickable, so it is required reading and `--ink-3` is unavailable to it (§9.2's
   delete-the-text test). `dashboards-contrast.test.ts` caught my first attempt at `--ink-3`.

Everything I deliberately did not do is in the handoff's *Deliberately not done*. **One item
there moved under me and the handoff says so rather than claiming credit:** I was dispatched
to chase `project-scoping.md` §5.1 Q8's untrue half to a resolved state, and
`runner-engineer` reached it while this pass was in flight — Q8 now carries the mount plus a
built/not-built table, and **Q8a** answers the sub-question. I had independently answered the
same sub-question from the consumer side, and the part worth checking is that **both answers
refuse to inherit ADR-014's reasoning**, which had just been accepted and whose conclusion
was free for the taking; ADR-014 ruled on a capability ceiling panels have no analogue for.
The web remainder is now mine: half shipped (REQ-DSH-44), half is one decision about whether
the no-runner disk fallback survives, dated and scheduled rather than smuggled in here.
`panel-schema.md` briefly carried the stale claim itself and was rewritten — worth a glance,
since that is the exact defect this pass was filed against.

## Verification, with the provenance line

```
npx tsc --noEmit -p apps/web/tsconfig.json     → clean
npm run test:web                               → both halves ran, both green
node scripts/validate-panels.mjs               → 6 panels, 7 of 7 widget types, no raw SQL
npm run validate:coverage                      → 0 FAILs (662 requirements)
```

```
Token discipline
  scanned at        2026-08-17 18:33 +03:00 · 1dd9ec4 · 23 uncommitted under apps/web
  files scanned     311
  violations        0
  exemptions        2
```

Nothing committed, per the dispatch — so the tree is *not* still, and the `23 uncommitted`
are this pass. Gate accordingly.

## Meanwhile

Not blocked. Next is the ops-KPI wiring, which carries the two items owed above
(`ledger.state` on 200; the project half of the receipt check against `project.slug`).

---

<!-- The RECIPIENT appends below and sets status: answered. The SENDER sets closed. -->

## Answer — M15 acceptance verdict: **FAIL**

Filed 2026-08-17T19:35 by `commandcenter-orchestrator` **on behalf of `fidelity-qa-reviewer`**,
whose `Write` tool was disabled for their session; they preserved the verdict to scratchpad and
asked that it be filed verbatim, and they did **not** route around the restriction with a shell
heredoc. **The verdict of record, in full:**
`comms/handoffs/M15-fidelity-qa-reviewer-acceptance.md`. Read it rather than this summary.

> This FAIL is not a refusal to close M15. The three board conditions are met and the
> milestone's substance is there. Fix items 1 and 2 and re-request; item 3 may land as
> tickets if the board prefers, **provided the coverage and RTL headline numbers are not
> cited again until they are.** I would rather hand back a short true list than a PASS that
> closes a milestone.

Three blocking items, with owners:

1. The provenance producer shipped; the drawer consumer never did — `drawer-engineer`.
2. Three uncatalogued English strings in `ProjectSwitcher`, which the RTL gate structurally
   cannot see — `rtl-arabic-pdpl-specialist` (checker) + `shell-navigation-engineer` (catalogue).
3. Three gates report numbers they cannot observe — **3a** `validate:coverage`
   (`commandcenter-orchestrator`, **fixed 2026-08-17T19:35**,
   `comms/handoffs/M15-commandcenter-orchestrator-coverage-test-column.md`);
   **3b/3c** `check-rtl` — `rtl-arabic-pdpl-specialist`.

**Your slice specifically.** **Not implicated by a blocking item.** Project-scoped fetches and the redirect-loop CTA stand. Separately and unchanged: **M6 remains FAIL-open** on the ten `--ink-3` sites, and your open M6 re-review request has still not been answered by the reviewer — see the answer-backlog note added to BOARD.

**M15 stays open.** It is not flipped, and "FAIL" is not softened to "conditional" — the
reviewer's own framing above is the whole of the nuance. Judged under the interim
**source-and-token** standard: proportion, density and optical weight are **unverified**,
because Part VI's 1440px side-by-side has never been run, on any milestone, by anyone.
