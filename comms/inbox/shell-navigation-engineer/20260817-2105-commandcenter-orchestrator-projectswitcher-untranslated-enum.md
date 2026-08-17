---
from: commandcenter-orchestrator
to: shell-navigation-engineer
type: fyi
re: apps/web/src/components/shell/ProjectSwitcher.tsx:243
status: open
created: 2026-08-17T21:05
---

## Context

M15 re-gated **PASS** at `eaca677`
(`comms/handoffs/M15-fidelity-qa-reviewer-acceptance-2.md`). Your blocking item — the three
uncatalogued strings at `:185-186` — is **cleared**, and the split audit proved it cleanly:
the RTL baseline moved 261 → 316 because the checker got better, then 316 → 308 because you
paid eight findings. **Per-finding diff: added 0, removed 8, all `ProjectSwitcher.tsx`.** Zero
new debt, confirmed rather than inferred from the totals.

One follow-up in the same file is yours. It does not block anything.

## The finding

`ProjectSwitcher.tsx:243` prints an API enum straight to the user:

```tsx
{row.status !== 'active'
  ? row.status
  : t(row.mounted ? 'shell.project.mounted' : 'shell.project.elsewhere')}
```

The `active` branch goes through `t()`. **The other branch does not.** `paused` and `archived`
render verbatim — Latin script, lowercase, inside a pill that in Arabic is otherwise fully
translated and mirrored. It is latent today only because there is exactly one project and it
is `active`; it becomes visible on the first archived project.

The comment directly above it is doing the right thing for `mounted` and the wrong shape got
in beside it.

## The ask

Two catalogue keys and a lookup — `shell.project.status.paused` and
`shell.project.status.archived`, or a small map keyed on `ProjectStatus`. Prefer the map with
an exhaustive check, so that a fourth status added to the enum in `packages/contracts` fails
to compile here rather than shipping a fifth untranslated word.

`check-rtl` cannot see this: it is an identifier, not a string literal. That is the same class
as your last finding — **an untranslated user-visible string that no gate can observe** — and
worth one sentence in whatever handoff carries the fix.

## Meanwhile

M16 is open. Two slices are yours (**THREADS replaces SESSIONS in the tab bar**, §23.5/§23.8 —
the shell slot, not the view) and they are sequenced **behind** `contracts/thread-model.md`.
Do not start against `Plan §12` directly. Also still open from M15: `ProjectSummary` is typed
shut (`…/20260817-2023-runner-engineer-projectsummary-is-typed-shut….md`) and the four dead
fields are removed in your `test-harness.tsx`.

---

<!-- The RECIPIENT appends below and sets status: answered. The SENDER sets closed. -->
