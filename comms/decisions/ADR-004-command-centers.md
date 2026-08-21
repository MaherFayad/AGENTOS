# ADR-004 — Our six Command Centers

**Date:** 2026-08-15 · **Author:** `dashboards-engineer` · **Status:** superseded
**Superseded in part by:** [ADR-042](ADR-042-six-departments-for-a-product-house.md) — four of
the six centers are deleted (`pipeline`, `content-studio`, `finance`, `client-delivery`), each
having been scoped to a department that no longer exists. `mission-control` (retargeted to `ai`)
and `product-funnels` stand, and the panel *schema* and the seven-widget rule are untouched — so
everything below still reads true except the roster of six.
**Affects:** `comms/contracts/panel-schema.md`, `panels/*.json`, M6, BOARD open question M6

## Context

§2.4 names their six centers (Meta Ads · Paid Acquisition / HubSpot · Sales Pipeline /
Mission Control · Client Delivery / Instagram+TikTok · Content / Outbound / Finance) and
then says: **"Ours: map 1:1 to your stack."** The carousel is six cards; the detail view's
rail labels are a ring of previous/next names (§2.5.6), so the set has to be fixed before a
single `panels/*.json` is written — a seventh center or a rename is a rail-order change in
six files.

Two constraints pull against each other:

- ADR-001 fixed **seven** departments. A carousel of six cards can't be one-per-department
  without either dropping a department or inventing a seventh center nobody asked for.
- Standing rule 9: **numbers must be real.** Naming a center after a SaaS we don't run
  (HubSpot, Meta Ads) would force either fake data or an empty dashboard with a vendor's
  name on it. Both are worse than not shipping the card.

## Options

| Option | For | Against |
|---|---|---|
| A — Copy their six verbatim | Best side-by-side fidelity; zero naming work | We have no Meta Ads spend and no HubSpot. Six dashboards for someone else's company; every widget fakes or empties |
| B — Seven centers, one per department | Clean 1:1 with ADR-001 | §2.4 says six, and the carousel's front/flank geometry is tuned for a six-card ring; a seventh card is a spec deviation for a cosmetic tidiness win |
| C — Six centers over seven departments, `sales` + `deals` sharing one | Keeps §2.4's six; every center is named after a system we actually run; sales+deals are two halves of one revenue funnel anyway | One center covers two departments, so the department→center lookup is one-to-many |
| D — Six centers named after our infra (Langfuse / Postgres / Docker / …) | Maximally honest | A dashboard is an *output* view, not an infra view. §2.4's centers are named for the work, not the tool |

## Decision

**We ship option C: six Command Centers, covering all seven departments, with `sales` and
`deals` sharing `pipeline`.** Each is a `panels/<id>.json` file; the carousel is a
projection of that directory sorted by `order`, so a seventh center is a new file, never a
code change.

| order | `id` | Title (§2.5.1) | `railTitle` | `provider` | Departments (ADR-001) | Real on day one? |
|---|---|---|---|---|---|---|
| 1 | `mission-control` | Mission Control · Agent Ops | `MISSION CONTROL` | `langfuse` | `operations` | **Yes** — every widget |
| 2 | `pipeline` | Pipeline · Sales & Deals | `PIPELINE` | `postgres` | `sales`, `deals` | No — empty states |
| 3 | `client-delivery` | Client Delivery · Engagements | `CLIENT DELIVERY` | `postgres` | `customer` | Partly — activity feed |
| 4 | `content-studio` | Content · Studio & Distribution | `CONTENT` | `postgres` | `marketing` | Partly — activity feed |
| 5 | `product-funnels` | Amplitude · Product Funnels | `PRODUCT` | `amplitude` | `intelligence` | No — empty states |
| 6 | `finance` | Finance · Spend & Runway | `FINANCE` | `langfuse` | `back-office` | Partly — agent spend |

Mapping rationale, center by center:

- **Mission Control** is ours and theirs both (§2.5.7's easter-egg footer lives on their
  Mission Control, so it lives on ours). It is the only center whose every widget is real
  the day the runner starts: runs, cost, latency, error rate, spend by agent, runs by
  department, and the activity feed — because **agent runs ARE the activity feed** (§2.5
  data note). It is `order: 1` for that reason: the first card the carousel presents is the
  one that isn't a promise.
- **Pipeline** replaces their HubSpot card. We don't run HubSpot; our deals live wherever
  our sales agents write them, which is Postgres (Part V: "postgres also holds agent output
  rows"). Covers `sales` **and** `deals` because a stage bar-list and a stalled-deal table
  are one screen in the video and one screen for us.
- **Client Delivery** keeps their name because our `customer` department is exactly that
  work, and the progress-bar table (§2.5.5.6) is literally an engagements table.
- **Content** replaces their Instagram+TikTok card with the department, not the platform —
  the platforms become rows in the source bar list, which is where a platform belongs.
- **Amplitude · Product Funnels** is the one vendor name we keep, because we actually have
  an Amplitude project and §2.4's "Ours:" line names it. It maps to `intelligence`.
- **Finance** covers `back-office`. Our one honest finance number today is model spend from
  Langfuse (Part V's hard monthly cap makes it a number that matters), so the provider is
  `langfuse` and the rest of the panel declares its Postgres queries and renders empty.

Their **Outbound** card has no analogue: outbound is a cluster under `sales`, not a
department (ADR-001), so it is a widget on Pipeline, not a seventh card.

**Panels declare `sql` queries by registered name from day one.** They resolve to
`unavailable` in phase 1 and the widget renders its `emptyState` sentence, which names the
agent that will fill it ("No deals in Postgres yet — the pipeline-sync agent writes this
table on its first run"). We are not shipping `static` stand-in numbers to make a card look
alive: a fabricated number that reads as data is an automatic QA failure, and an empty
state that says *which agent owes you this number* is more useful than a lorem figure.

**Provider glyphs are abstract monochrome marks, not vendor logos.** They are drawn from
`currentColor` in `apps/web/src/dashboards/lib/icons.tsx`. Chrome stays monochrome (§1.3),
and we don't ship a trademark we have no licence to (Part VII.2's spirit).

## Consequences

- The carousel ring order and the §2.5.6 rail neighbours derive from `order`: each panel's
  previous/next is `(order − 1)` and `(order + 1)` modulo six. Nothing hardcodes a
  neighbour name.
- Adding a seventh center = one JSON file + `node scripts/validate-panels.mjs`. Removing
  one = deleting a file. Neither touches `apps/web`.
- Five of six centers ship visibly incomplete, on purpose. Anyone reading the DASHBOARDS
  tab in M6 sees five honest empty states and one live dashboard; that is the true state of
  the system and the empty states double as a to-do list for `agent-library-curator`.
- If we later adopt an actual CRM, `pipeline`'s `provider` and its query names change
  inside one JSON file; the widget code is untouched.
- `department` on a panel is an **array**, because `pipeline` covers two. Consumers that
  want department → panel must handle one-to-many.

## Contract edits

`comms/contracts/panel-schema.md`, section "Ours, not theirs" — replaced the placeholder
line "Ours map to our stack — pending ADR from `dashboards-engineer` (BOARD open question
M6)" with the six-center table above and a link to this ADR. Also added, in the same pass:
`schemaVersion`, `department[]`, `emptyState`, `pending`, `note` on static queries, the
`$range` binding token, and the query-result state machine — all listed in that contract's
changelog.
