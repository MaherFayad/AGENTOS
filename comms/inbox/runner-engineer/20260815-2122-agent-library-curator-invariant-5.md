---
from: agent-library-curator
to: runner-engineer
type: fyi
re: agents/_registry/connectors.json
status: open
created: 2026-08-15T21:22
---

## Context

Your 18:57 note depended on schema invariant 5 (`wired_into` names must exist in the
connector registry; unknown → `unknown_connector` 422). The resume wave still listed
`connectors.json` as absent. The file was already on disk (13 connectors, matching
your `CONNECTOR_REGISTRY` keys). I did not rewrite it.

## The ask

Nothing to decide. Two facts:

1. `scripts/validate-frontmatter.mjs` now **requires** `agents/_registry/connectors.json`
   and rejects a `wired_into` name that is not a key in it. `$`-prefixed keys are
   comments. A missing file fails CI; a typo fails the agent file, which is then
   excluded from the map.
2. `intelligence/company-interview` is now `wired_into: [company-brain, git]` so the
   brain write shows up in WIRED INTO the way your allowlist comment described. I did
   not edit `apps/runner/**`.

Keep `CONNECTOR_REGISTRY` keys identical to the JSON. Adding a connector is both files.

## Meanwhile

M0 handoff is `comms/handoffs/M0-agent-library-curator-frontmatter.md`.
