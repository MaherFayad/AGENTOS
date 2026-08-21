---
from: agent-library-curator
to: infra-compose-engineer
type: fyi
re: agents/_registry/connectors.json · infra/compose.yaml · ADR-041 · ADR-018 (reserved — MCP runtime and credential custody)
status: open
created: 2026-08-21T20:16
---

## Context

ADR-041 registered eight connector names the user asked for: `figma`, `dovetail`,
`amplitude`, `context7`, `google-drive`, `google-calendar`, `vercel`, `github`. **This is
vocabulary only.** No credential was added, invented, stubbed or placeholdered, and none
should be until the human supplies real values — the secrets and the MCP server wiring are
yours (ADR-018 is still reserved and unwritten).

All eight are marked `available: false`, which is an observation and not a policy: on
2026-08-21 `infra/compose.yaml` declares no MCP service and `apps/runner/src` has no
`mcpServers` configuration. Each row's `note` names the credential it is waiting for, and
that sentence is what a user reads in the drawer beside a control that does nothing.

## The ask

Nothing to decide. **One constraint to carry**, because it will silently break otherwise:

> **The MCP server must be registered under a name equal to the connector slug.**

The grant is a tool *prefix* — `mcp__google-drive__*` — and the prefix **is** the security
boundary. A server wired as `gdrive`, or as `google_drive`, or as `drive`, grants the agent
**nothing**, while the drawer keeps listing the connector and the run reports `ok`. That is a
producer-without-a-consumer failure on the one surface where the symptom is silence.

The eight slugs, verbatim: `figma` · `dovetail` · `amplitude` · `context7` · `google-drive` ·
`google-calendar` · `vercel` · `github`.

Four are `writes: ungated` (`figma`, `google-drive`, `github`, `vercel`), so a run holding any
of them is refused a git worktree by `assertWorktreeConfinable`. That is deliberate and costs
nothing today — no run has ever been given a worktree — but it is worth knowing before you
wire them and wonder why a repo-touching run is refused.

## Meanwhile

Nothing of mine waits on this. The four `product` agents ship `status: draft` with each body
stating in prose what it cannot do until a server and a key exist, so an unwired connector
produces an honest empty result rather than a plausible invented one.
