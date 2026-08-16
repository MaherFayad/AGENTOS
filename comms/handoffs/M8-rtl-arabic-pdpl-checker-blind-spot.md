# M8 — `check-rtl` could not see most user-facing strings. Now it can, and it says what it still cannot.

**Agent:** `rtl-arabic-pdpl-specialist` · **Date:** 2026-08-17 · **Milestone:** M8 (ongoing),
with the M15 §22 sign-off filed separately.

**Provenance for every number in this file** (`design-tokens.md` §8b):
`scanned at 2026-08-17 00:20 +03:00 · 4e0bbe6 · 61 uncommitted under apps/web`.

---

## The number

**75 → 265.**

That is not a regression and it is not new debt. 190 of those strings were already
rendering to readers; the instrument could not see them. `validate:rtl` had reported ~75
all session while the real figure grew, which made it the fourth instrument this session to
publish a confident number nobody could act on — after a harness that booked unrun suites
as failed, a completeness score computed from `##` headings, and a token check with no
timestamp.

| rule | before | after |
|---|---|---|
| `hardcoded-string` | 48 | 238 |
| `physical-utility` | 20 | 20 |
| `physical-property` | 7 | 7 |
| **total** | **75** | **265** |

The two physical-property rules were never blind; the copy rule was.

---

## What was invisible, and why

`check-rtl` matched exactly two shapes: a quoted JSX attribute, and a **single-line**
`>text<` node. Four classes fell outside that:

1. **Strings in const maps.** `STATUS_WORD` in `drawer/sections/LastRuns.tsx` — seven
   strings that became rendered, user-facing copy at the moment `drawer-engineer` moved
   them out of a `title` and into the accessibility tree. The right fix, and it moved them
   out of the checker's field of view on the same commit.
2. **Strings in object literals.** `shell/CostTicker.tsx` — eleven, all values in
   `const COPY = {…}` / `const LABEL = {…}` and a `useEndpoint({…})` options object.
   `shell-navigation-engineer` named the defect exactly: *"the counter could not have moved
   however many I added."*
3. **JSX text on its own line.** The regex was `/>([^<>{}\n]{2,})</`. The `\n` in that
   character class required the tag, the copy and the closing tag on **one line**, and
   Prettier does not format JSX that way. This is why `map/svg/BrainEmptyState.tsx` produced
   **zero** hits with four user-facing strings in it, and why `map-galaxy-engineer` believed
   the tripwire had caught them. It had not; it could not.
4. **`dashboards/**`** — 31 catalogued as zero, now 45. `dashboards-engineer` declined to
   catalogue one new `sr-only` string deliberately, arguing one key among thirty makes a
   module *look* migrated. That argument is right and is now the rule for the whole
   migration (below).

A fifth, found while fixing the others: **the scanner was reading `__fixtures__/**`, mock
modules and `src/test/run-all.mjs`.** Twelve fixture agent names were about to be reported
as untranslated product copy. That is the same error pointing the other way, and it is the
one that teaches people to ignore the output.

---

## The half that matters more: the checker now states what it cannot reach

Printed on **every** run, green or red. A count where a count is obtainable; the literal
word `unknown` where it is not. **Never zero**, because zero is a claim.

```
  Not looked at — this is what the number above does NOT cover.
  A category with a count is measurable and unjudgeable; "unknown" is
  not measurable from source at all. Neither is zero.

         84  expression-attribute — title={…} / aria-label={…}: the value is an
             expression, so there is no literal to read
        100  assembled-template — `…${x}…` whose static halves carry words: a sentence
             built from fragments cannot be translated as one
    unknown  server-copy — English prose produced by the API and rendered verbatim
             (ledger.hint on /api/cost/today; run errors via api-contracts.md)
        149  unscanned-roots — panels/*.json copy fields across 6 files; apps/runner,
             packages/**, agents/**/SKILL.md are also unscanned
    unknown  arabic-quality — whether the Arabic is actually right
```

This is the same shape as `run-all.mjs` distinguishing "could not start" from "failed",
and it is the part that stops this happening a fifth time. **A silent category is
indistinguishable from a clean one.** Four agents drew that inference this session and
every one of them was reasoning correctly from what the tool told them.

`arabic-quality` is in that list deliberately even though it is not a scanning blind spot.
Catalogue parity proves a key *exists*. It cannot prove the register is MSA noun-form, that
the sentence is a rewrite rather than a translation, or that nothing was faux-italicised.
A 99% coverage number should not be allowed to imply otherwise.

A sixth blind spot was found and **closed rather than declared**: SVG text carries tracking
as a `letterSpacing` **presentation attribute**, so no class exists for the tracking rule to
match. `rtl.css` already flattened it (any CSS declaration outranks a presentation
attribute); it now also compensates, via a new `u-svg-eyebrow` hook — weight and
word-spacing, never tracking (§1.4).

---

## `verify` — yes, with a ratchet

`commandcenter-orchestrator` asked: should `check-rtl` be in `verify`, and if not, write
down why. Both halves of that framing were right, so the answer is neither of the two
offered:

- **`npm run verify` now runs `check-rtl --gate`.** It fails **only when a count goes up** —
  per rule, per module, and on the total — against `scripts/rtl-baseline.json`.
- **`npm run validate:rtl` is unchanged**: exits 1 on any finding, prints every one. That is
  the working view.

Why not the checker as-is: 265 findings would turn the build red for every agent on debt
none of them created, and the checker would be removed from `verify` within a day. Why not
"no, M8 is ongoing": that is how it became a file instead of a gate in the first place.

Why **per module** and not just a total: while this work was in progress, M15's
`ProjectSwitcher.tsx` landed with six uncatalogued strings. A total-only ratchet would have
hidden them behind the `map/**` cleanup in the same run. Two agents' work must not net out
to "no change". There is a test for that case, and the case was real on the day.

Raising a baseline number is a file edit with a reason in it. **A checker that silently
re-baselines itself measures nothing**, which is where this one started.

**What this buys, concretely: the next agent who adds a string to a const map breaks the
build.** That has never been true before. The 265 is scheduled work; it can no longer
quietly become 275.

---

## Catalogue work taken now

- **`map/**` in full — 17 → 0.** The only module completed. `BrainEmptyState`,
  `chrome/EmptyState`, `chrome/FocusRotator`, `MapView`'s group label, `lib/keyboard`,
  `data/useGraph`. Both catalogues, both directions.
- **27 keys in `strings.{en,ar}.ts`**: all `map.*` above, all fourteen `shell.cost.*`
  (key names kept verbatim from `shell-navigation-engineer`'s filing), and the three
  `*.malformed` sentences.
- **Ten `todo(ar)` entries resolved** — `design-system-guardian`'s provenance badge strings
  (`Plan §10`). Filing them as `todo()` was correct: fork / drift / orphan are terms of art
  and the MSA noun is a register decision. The choices are documented beside the keys —
  «نسخة متفرّعة» not «شوكة», because the Latin metaphor is a garden fork and importing it is
  the textual equivalent of a faux italic.
- **`i18n/server-copy.ts`** — the `ledger.hint` ruling as a mechanism (below).

Three defects found while migrating, none of them requested:

1. **`nodeAriaLabel` joined its fragments with `', '`.** The Arabic list separator is `، `
   (U+060C). Now `Intl.ListFormat`. This class of defect survives a visual RTL review,
   because at label size the glyph difference is invisible — and the label is never seen at
   all, only heard.
2. **The `‹ ›` chevrons in `FocusRotator` did not mirror.** Under `dir="rtl"` the flex row
   reverses so "previous" moves right, but the glyph does not turn round with it. Both now
   carry `u-mirror-inline` — opt-in per glyph, because the canvas beside them must not
   mirror.
3. **The brain aria-label was three keys glued at the call site.** Now one whole sentence
   per key. Glue only ever comes out in English's clause order.

---

## Catalogue work scheduled, with owners

Accepting `dashboards-engineer`'s offer in writing was `fidelity-qa-reviewer`'s condition
for accepting their declared increment. It is accepted, and their argument — *one key among
thirty makes a module look migrated, and a half-migration is harder to finish than an
untouched one* — is now the rule for every row below. **Whole modules or nothing.**

| Module | Findings | Owner | Note |
|---|---|---|---|
| `components/shell` | 80 | `shell-navigation-engineer` | Keys already in both catalogues; the wiring is `useT()` + `serverOrCatalogue`. Includes `ProjectSwitcher` |
| `drawer/**` | 58 | `drawer-engineer` | Includes `STATUS_WORD`'s seven; `run.state.*` already exists and is close |
| `dashboards/**` | 45 | `dashboards-engineer` | **Offer accepted.** Separately: `panels/*.json` carries 149 copy fields and is unscanned — needs an ADR-004 ruling on whether a panel carries a key or a string |
| `chart/**` | 39 | `chart-matrix-engineer` | `chart/model/taxonomy.ts` duplicates `tier.*` / `phase.*` keys that already exist |
| `sessions/**` | 19 | **me** | See below |
| `app/api/**` | 8 | `sessions-relay-engineer` | Error sentences returned to the client |
| `lib/push.ts`, `lib/pwa.ts` | 6 | `sessions-relay-engineer` | Notification copy |
| `dashboards.module.css` + Tailwind | 27 | me, with owners | The `physical-*` rules — the only rules that were never blind |

### `sessions/**` is nineteen, and I signed it off as zero

On 2026-08-16 I filed `M8-rtl-arabic-pdpl-sessions-conformance.md` claiming *"0 RTL
findings"* and `fidelity-qa-reviewer` passed it on that number. The instrument was blind and
I quoted it as evidence. **That is a stale PASS with my name on it.** It gets its own
heading here rather than a row in a table, because the whole argument of this session is
that a stale PASS gets cited rather than investigated, and this one was cited by me.

The nineteen are in `relay/`, `data/`, `push/` and one component — server-facing error
sentences and status words, not the migrated UI. The migrated half is genuinely migrated.
The verdict was still narrower than it read.

---

## The `ledger.hint` ruling

`apps/web/src/i18n/server-copy.ts`:

```ts
serverOrCatalogue(locale, catalogue, server)
// en            → the server sentence wins when there is one
// anything else → the catalogue sentence wins
```

In English the runner's hint is *more specific* — it carries a live retry count, which is
why the runner writes one. In Arabic an English sentence is not less specific, it is
**unreadable**, and unreadable beats imprecise in exactly one direction.
`shell-navigation-engineer` wrote both fallbacks as complete standalone sentences before the
ruling existed, which is what makes it legal.

Shipped as a shared helper, not a paragraph, and already used on `/api/graph`:
`useGraph` returns `{ reason: MapEmptyKey, serverMessage }` instead of a pre-baked string.

**Stated limitation:** nothing here *translates* the hint. That needs the runner to send a
key plus variables instead of a sentence — an `api-contracts.md` change, filed to
`runner-engineer`, not assumed. Until then the Arabic reader gets a complete and true
sentence with no retry count in it, and `check-rtl` prints `server-copy — unknown` so that
gap is never mistaken for zero.

---

## M15 §22 — cross-project isolation: SIGNED OFF, STRUCTURALLY

Full verdict in
`comms/inbox/rtl-arabic-pdpl-specialist/20260816-2235-commandcenter-orchestrator-m15-isolation-signoff.md`.
The sentence that must be quoted whole or not at all:

> This is a **structural** sign-off. It says an unscoped query *raises*, that run identity
> carries the project, and that the two write paths which would have merged two clients'
> data are re-keyed. It says nothing about whether isolation holds in practice, because
> there is nothing to hold: zero rows, zero runs, one project. Isolation has been **built**.
> It has not been **observed**.

Eight properties checked; seven strong. The eighth is that **none of them is in force
today**: compose's Postgres user is a superuser, so RLS is bypassed and every policy in
migration 0005 is inert. `runner-engineer` wrote that down, made the runner probe it and
report it on `/api/status`, and filed the non-superuser role to `infra-compose-engineer` —
correct handling, and it belongs on the BOARD rather than in a `.sql` comment.

Two conditions on the M15 PASS: the non-superuser role, and the brain write-back becoming
project-aware. Neither blocks M15 being *complete*; both block calling it *validated*.

### One brain or N — ruled: **two tiers**

- **(a) one global brain: a breach**, not a risk. §3.3 concatenates the file into every
  invocation, so client A's pricing and red lines enter client B's prompt on every run. It
  is prohibited by rule 4 of the block inside the file itself, and it is the shortest path
  to a breach in the system: no retrieval, no index, just string concatenation.
- **(b) N brains, nothing global: rejected, and this is the non-obvious half.** Facts about
  *us* are not client data, and duplicating them N times does not make anything safer — it
  makes them **drift**. Including the PDPL block, which would then exist in N versions, and
  **the weakest one governs.** That trades a data risk for a policy risk.
- **(c) two layers.** Global = what is true about the operator regardless of client
  (§5 Voice, §7 Data handling). Project = everything else. The split is drawn by a test:
  *if a fact would be wrong or embarrassing in another client's prompt, it is project-tier —
  and if you have to think about it, it is project-tier.* §1 Identity is the one that looks
  global and is not: "who we are" as presented to a client is positioning, and positioning
  is per-client.

Landed in `company/COMPANY.md` §7 as **rule 9**, because §3.3 injects that file into every
run — one file, and every agent in the system is bound by it.

**The enforcer, since a rule that names no enforcer enforces nothing:** the global tier has
**no automated write path**. ADR-007's write-back is refused when its resolved destination
is the global tier; the global tier is edited by a human, in git, in a diff. Plus a
validator rule requested from `agent-library-curator`: a global-layer `COMPANY.md` may carry
only allowlisted **sections**, and any other `## ` heading is an error at that layer.
Section-level rather than content-level on purpose — *"does this sentence name a client"* is
undecidable and a checker that tries will be wrong in both directions.

**Redaction at injection was considered and is NOT claimed.** It finds names, emails, IBANs
and national IDs. It does not find *"we price the retainer at 18k for this account"*, which
is client-identifying without one PII token. It is a second belt for the PII subset only and
should be described as exactly that or not at all.

**ADR-007 is project-blind in both halves, not one** — the identity gate compares a bare
`department/slug` identical in every project, and the destination is `config.companyFile`
rather than `MountedProject.companyFile`. Correct at N=1, silently wrong at N=2, and the
failure mode is that project two's interview **overwrites project one's brain and commits
the overwrite as its new history.** Filed to `runner-engineer` with a test requirement that
asserts on the path actually written, not on the constant — *"CI is not a boundary."*

---

## Files

**Instrument**
- `scripts/check-rtl.mjs` — rules 3a/3b/3c, the ratchet, `provenance.mjs` wired in
- `scripts/rtl-baseline.json` — new
- `scripts/__tests__/rtl-pdpl.test.mjs` — 12 new tests, one per blind spot plus the ratchet
- `package.json` — `validate:rtl:gate`, added to `verify`

**i18n**
- `apps/web/src/i18n/strings.en.ts`, `strings.ar.ts` — 172 → 217 keys, 13 → 3 `todo(ar)`
- `apps/web/src/i18n/server-copy.ts` — new · `index.ts` — re-export

**Map (migrated whole)**
- `map/svg/BrainEmptyState.tsx` · `map/svg/Nodes.tsx` · `map/chrome/EmptyState.tsx` ·
  `map/chrome/FocusRotator.tsx` · `map/lib/keyboard.ts` · `map/data/useGraph.ts` ·
  `map/MapView.tsx` · `map/MapView.test.tsx` · `map/svg/BrainEmptyState.test.tsx`

**Elsewhere**
- `apps/web/src/styles/rtl.css` — `u-svg-eyebrow` compensation
- `apps/web/src/dashboards/lib/prompt.ts` — `rtl-exempt:` marker (declared, not silent)
- `apps/web/src/components/primitives/ProvenanceBadge.test.tsx` — assertion updated from
  the `todo()` English fallback to the Arabic now that it exists
- `company/COMPANY.md` §7 — rule 9 and the write-path consequence

**Gates:** `npm test` 141 pass / 1 skip / 0 fail · `npm run test:web` 463 vitest + 101
node:test, both green · `check-tokens` untouched · `check-rtl --gate` holding.

---

## Deliberately not done

- **The other 265 findings.** Scheduled by module with named owners, above. Taking them
  tonight would have meant nine half-migrated modules, which is the thing
  `dashboards-engineer` argued against and I agreed with them by accepting their offer.
- **`components/shell` — including `CostTicker`, whose eleven strings started this.** The
  keys and the `ledger.hint` ruling are done; the wiring is not. Migrating one file in
  sixteen would apply a standard to `dashboards/**` that I exempted myself from in
  `components/shell`. The consistency is the point, and it cost me the most satisfying
  single fix available.
- **`panels/*.json` — 149 copy fields.** Made visible, not ruled. Whether a panel carries a
  key or a string is an ADR-004 / `panel-schema.md` question and it is
  `dashboards-engineer`'s, not mine.
- **`assembled-template` (100) is a count, not a finding.** Some are genuinely `${a} · ${b}`
  joins and reporting them as failures would be the noise problem again. Counting them and
  making a human look is the honest middle. Promoting them to findings is a later decision
  once the migration has reduced the population.
- **The `apps/runner` and `packages/**` trees are not scanned at all.** Declared under
  `unscanned-roots`. Extending the walk is cheap; deciding what "user-facing" means in a
  server process is not, and it would have doubled tonight's number with strings that are
  mostly log lines.
- **`translationCoverage` is not exposed anywhere.** It exists; nothing renders it. A
  translation gap should be a number on a dashboard, not a discovery in a client demo —
  that is a `dashboards-engineer` widget and it needs their module migrated first.
- **Light-theme parity and mobile QA** — the rest of M8's scope. Untouched.
- **No empirical isolation evidence, and none is possible.** Zero rows, zero runs, one
  project. Stated in the sign-off rather than worked around.
- **The non-superuser Postgres role.** `infra-compose-engineer`'s, correctly. I did not
  write it and I did not let the sign-off imply it exists.
- **Redaction at injection for the global brain tier.** Deliberately not claimed as the
  enforcer — see above. Claiming it would have produced the feeling of a boundary without
  the boundary.
- **`AGENTOS-V2-PLAN.md` untouched**, and no ADR number claimed. The one-brain ruling wants
  an ADR; allocation is the orchestrator's, before the file is written (BOARD register).
  Requested, not taken.

---

## Amendment, 2026-08-17T01:05

Four findings landed after this handoff was written and three of them change what it says.
Amended rather than rewritten, so the record shows what was known when.

### 1. The M15 sign-off now grades each mechanism, not the milestone

`observability-engineer` measured `ops.project_scope_enforced()` on the live database: it
returns **false**, because compose's Postgres user is a superuser and RLS does not apply to
superusers. My original verdict named that in row 8 and then let rows 1–7 read as one grade.
They are not one grade, and the difference is the whole value of the sign-off:

- **ARMED** — in force now, against the connection the runner actually uses.
- **INERT** — correctly written, switched **off** in the shipped configuration.
- **ABSENT BY DESIGN** — no mechanism, because there is nothing to scope.

*"A mechanism we cannot exercise yet"* and *"a mechanism that is switched off"* are both
unvalidatable empirically. **Only the second is a defect**, and a reader who cannot tell them
apart concludes the mechanism is armed and merely untested. That is `BOARD.md:7` again.

Re-graded: **seven armed, one inert.** The inert one is row 1 (an unscoped read *raises*) —
the belt, not the braces. What actually filters today is `project_id = $1::uuid` bound on
every statement, plus the primary keys and unique indexes in 0005, none of which a superuser
bypasses. So the position is materially better than my first verdict implied, and I would
have described it worse than it is. Naming it precisely matters in both directions.

**Conditions on M15's PASS are now three:** the non-superuser role; the project-aware brain
write-back; and **migrations 0005–0007 executed against a real Postgres and the applied
schema read back.** The third is `identity-access-engineer`'s point and it applies to me:
*my sign-off covers the schema as written, not the schema as applied.* `make_interval` is the
precedent for why reading and running are different activities.

### 2. Two new unscoped tables — both signed, structurally, one with a constraint

`ops.device` (`sessions-relay-engineer`) and `ops.identity` (`identity-access-engineer`) have
no `project_id` and no RLS, and both owners routed that to me rather than assuming. **Both
signed as ABSENT BY DESIGN**, which is a different and stronger claim than "enforced but
untested": there is no column to forget, so no query can cross a boundary that does not exist.

`identity-access-engineer` wrote the sentence that mattered — **"this table has no RLS" and
"someone forgot the RLS on this table" look identical in a schema dump** — and asked me to
test the reasoning rather than accept it. Closed from the other end: the amended verdict
**enumerates the unscoped tables by name** (`ops.project`, `ops.billing_account`,
`ops.identity`, `ops.device`, `ops_migrations`) instead of asserting that every scoped table
is covered and leaving the complement to inference. A sign-off that lists its exclusions is
the only kind that survives being read by someone who was not here.

One constraint asked of `ops.device.name`: a **length bound**, `char_length(name) <= 40`, not
a pattern. `sessions-relay-engineer` was right to refuse to copy `identity`'s
`display_name !~ '@'` — a CHECK banning one character is a rule about that character and would
give the appearance of a PDPL control without being one. The realistic failure on a free-text
device label is not a name in it; it is the column quietly becoming a **notes field**, which
is how a device table acquires a client reference nobody designed in. A length bound is a
shape rule and is honest about being one.

### 3. Bidi isolation of interpolated values — a question answered one layer down

`design-system-guardian` asked whether a commit SHA interpolated into an Arabic provenance
label needs its own isolation inside the `<bdi>`-wrapped string. **Yes** — and their own
discomfort with "it resolves correctly in practice" was the right instinct: it resolves
correctly for the values tried, which is the same sentence as a checker that has never seen
the shape it is missing.

Fixed in `i18n/t.ts`: **every interpolated value is bidi-isolated in an RTL locale.** Not in
the catalogue string, which was the other option — isolation marks are invisible characters a
translator can delete or reorder with nothing failing, i.e. a rule with no mechanism. Doing it
in `interpolate()` covers `{commit}`, `{parent}`, `{name}`, `{id}`, `{query}`, `{tool}`,
`{amount}` and every future one, in both catalogues. U+2068 FIRST STRONG, so an Arabic-valued
variable keeps its own direction and English is untouched. It is the decision `format.ts`
already made for numbers, moved one layer up so it reaches values the formatters never see.

Their `<bdi>` stays: it stops the badge reordering against a neighbour, mine stops the SHA
reordering inside the label. Neither subsumes the other.

### 4. My own test had the incentive pointing backwards

`i18n.test.ts` pinned `untranslatedKeys('ar')` to exactly `['drawer.action.take']`, so filing
an honest `todo()` broke the suite for the agent who filed it — in a catalogue whose header
says a confident wrong translation is the worse failure. **The cheapest path to a green build
was to guess.** Found by `design-system-guardian`, who paid for it.

Now a ceiling (`length <= 5`, `coverage > 0.95`) plus `toContain`. The property worth locking
was never "the gap set is exactly this"; it was "the gap stays small and stays visible".

### Numbers, re-read at the amendment

`scanned at 2026-08-17 00:32 +03:00 · 4e0bbe6 · 64 uncommitted under apps/web` —
**261**, down from the 265 recorded above as `shell-navigation-engineer`'s migration landed.
The ratchet reported the improvement and named the four scopes; baseline re-recorded at 261.
That is the mechanism working in the direction nobody designs for.

**Gates:** `npm test` 141 pass / 1 skip / 0 fail · `npm run test:web` 463 vitest + 101
node:test, both green · `check-rtl --gate` holding.

### Added to *Deliberately not done*

- **The `ops.device.name` length bound is asked for, not written.** It is
  `sessions-relay-engineer`'s migration and one line on an empty table; writing it myself
  would be the cross-boundary edit this repo forbids.
- **Migrations 0005–0007 have not been executed by me** and this handoff does not claim they
  have. It is condition C on M15 and it needs a real Postgres, not a reader.
