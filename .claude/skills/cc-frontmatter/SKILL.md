---
name: cc-frontmatter
description: Author, normalize, and validate agent SKILL.md frontmatter for Command Center (spec Part IV). Use when creating a new agent folder, importing/seeding agents from external repos, changing the schema, or debugging why a node is missing from the MAP/CHART views.
---

# cc-frontmatter — the single source of truth

Schema of record: `comms/contracts/frontmatter-schema.md` (owner: `agent-library-curator`).

One agent = one folder = `agents/{department}/{agent-slug}/SKILL.md`. MAP, CHART and
DASHBOARDS are *projections* of this frontmatter. If a view needs data, the answer is a
frontmatter field — never a hardcoded list in a component, never a second database.

## Authoring a new agent

1. Slug = kebab-case of `name`. Folder path's department segment **must equal** the
   `department` field.
2. Fill every required field (see the contract table). `ladder` needs all three keys —
   `human-led`, `assisted`, `autonomous` — because the drawer renders all three rows with
   the active one highlighted (§2.3.9).
3. `replaces` is a *sentence about the manual work*, written with contempt for the manual
   work. It renders in a quote box. Their examples are the tone target:
   > "The research step everyone skips: outreach to a company you don't understand reads
   > like spam because it is."
4. `the_human` says what the human still owns. Never "nothing" — every agent has a human
   owner of strategy or audit.
5. `wired_into` is a **security boundary**, not documentation: the runner derives its tool
   allowlist from it (§3.2). Listing a tool you don't need widens the blast radius.
6. `status` starts `draft`. Only real runs promote it to `live` — the LIVE counter must
   never lie.

## Validating

```powershell
node scripts/validate-frontmatter.mjs        # exits non-zero on any error
```

The validator checks: required fields present · enums (`tier`, `phase`, `status`,
`approval`, input `type`) · path/department agreement · slug/name agreement · every
`builds_on` slug resolves · `icon` resolves in lucide · `schedule` is valid 5-field cron ·
`inputs[]` keys unique. A failing file is **excluded from the map with a warning**, never
rendered half-parsed.

## Seeding from external repos (Part IV)

Sources: `gtmagents/gtm-agents` (Apache-2.0), `wshobson/agents` (MIT),
`contains-studio/agents`, plus the almosafer-*/eyvar-*/cavecrew skills.

- Preserve upstream licence headers. Record provenance in the body, not the frontmatter.
- Normalize, don't dump: **curate to ~60 genuinely good agents.** Spec Part VII.3 —
  their "137 agents" is marketing volume; 60 runnable ones with live status halos beat it.
- Map upstream categories → our 7 canonical departments (ADR-001). Anything that doesn't
  map cleanly is a signal the department set is wrong, not that the agent needs forcing.
- Growth cadence is weekly, visible in `git log` — that's our version of their
  "new agent every week."

## Changing the schema

Frontmatter is consumed by five agents' code. A field change is an ADR + a broadcast
message to `all` + a validator update, in that order. Never a quiet addition.
