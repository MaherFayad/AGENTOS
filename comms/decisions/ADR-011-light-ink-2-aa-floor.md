# ADR-011 — Darken light-theme `--ink-2` to clear WCAG AA on every surface

**Date:** 2026-08-16 · **Author:** design-system-guardian · **Status:** proposed
**Affects:** `comms/contracts/design-tokens.md` §1.2 / §9.5 · `apps/web/src/styles/tokens.css` · every agent rendering prose · M1, M2, M6, M8

## Context

Spec §1.2 sets light-theme `--ink-2: #6E6E76`, transcribed verbatim from the live site's
stylesheet. Contract §9 (ruled 2026-08-16) makes `--ink-2` the **floor for required prose** —
empty states, provenance caveats, error sentences.

Measured against all eight surface tokens, `#6E6E76` clears AA (4.5:1) on six and fails on
two:

| Surface | Light value | `--ink-2` contrast |
|---|---|---|
| `--bg` | `#F4F4F5` | 4.60 ✓ |
| `--bg-3` / `--card` / `--screen` | `#FFFFFF` | 5.05 ✓ |
| `--screen-2` | `#F4F4F6` | 4.60 ✓ |
| `--bg-2` | `#ECECEE` | **4.28 ✗** |
| `--card-2` | `#EBEBED` | **4.25 ✗** |

Roughly 5% short. Dark theme is unaffected (4.53–5.46 across the same set).

**What forces the decision now** is that `--card-2` is not an edge case: it is the standard
hover fill for every interactive row and card in the product — `Card interactive`,
`.runRow:hover`, `.control:hover`, the drawer's ladder and console rows. So a required
sentence at the floor goes sub-AA *while hovered*, in light, at the exact moment the reader is
most likely to be reading it.

I deferred this once already, on 2026-08-16 at 21:20, on the correct grounds that a bug fix
must not smuggle in a change to a verbatim spec value. Within twenty minutes the same gap
forced a second contorted per-site ruling (`.runMeta` / `.runMetaAbsent` in
`drawer.module.css`, re-ruled in §9.4b). A constraint that bends two rulings in one session is
a constraint that should be decided, not deferred again. Filing it as an ADR is the sanctioned
mechanism; leaving it as a prose note in §9.5 is how it gets forgotten.

## Options

| Option | For | Against |
|---|---|---|
| **A — leave `#6E6E76`, forbid prose on `--bg-2`/`--card-2`** | Zero deviation from the spec of record. No visual change anywhere. | Bans the floor token from every hoverable row, which is most rows. Unenforceable: no checker can see which surface a class renders on, so it is a rule kept by memory. Already produced two awkward rulings. |
| **B — darken light `--ink-2` to `#6A6A72`** | Clears 4.5:1 on every light surface (worst case `--card-2`, 4.503:1). Four units — below the JND for a mid grey at text size. §9's floor becomes true everywhere with no per-site exceptions. One value, one file. | Deviates from a verbatim §1.2 value, so the light theme is no longer a pure transcription. Needs this ADR. |
| **C — raise the prose floor to `--ivory-2` in light only** | No token value changes. | A component would have to branch on theme to pick its token — the one thing §1.2 forbids absolutely. Rejected outright. |
| **D — darken it further, to AAA (7:1)** | Large margin. | `--ink-2` would land near `--ivory-2` and collapse a rung of the monochrome ramp. The ramp is the design. |

## Decision

**We take B.** Light-theme `--ink-2` becomes `#6A6A72`.

It is the smallest change that makes §9's floor true rather than nearly true. The alternative,
A, keeps the transcription pure at the cost of a rule that cannot be checked and has already
been broken twice by people who read the contract carefully — including by me, in the contract
itself.

**The dark value is untouched.** So is every other token in §1.1 and §1.2. This ADR authorises
exactly one four-unit change to one value in one theme, and the verbatim-transcription
principle stands for everything else.

**Not yet applied.** Status is `proposed`: `tokens.css` still carries `#6E6E76` and
`comms/contracts/design-tokens.md` §1.2 still quotes it. Nothing changes until an accept.
`tokens.test.ts` pins the current value and will fail on the edit, which is correct — that
test is the guard that makes this an ADR-gated change rather than a typo.

## Consequences

**Easy.** §9's floor holds on every surface in both themes with no carve-outs. §9.5's
"required prose must not sit on `--bg-2`/`--card-2`" is deleted rather than remembered. Prose
in hoverable rows stops being a special case. `drawer-contrast.test.ts:90-94`, which asserts
`--ink-2` ≥ 4.5:1 against `--bg` only, can be widened to every surface and still pass.

**Hard.** The light theme is no longer a byte-for-byte transcription of the source stylesheet,
so "check it against the site" stops being the whole answer for one value. Mitigated by this
file and by the comment that will sit beside the value in `tokens.css`.

**Cost of reversal.** One value in one file plus one line in `tokens.test.ts`. Nothing is built
on the specific number; consumers reference `var(--ink-2)`. This is among the cheapest
decisions in `decisions/` to undo, which is itself an argument for taking it rather than
deferring a third time.

**Fidelity risk.** The Part VI acceptance test is a side-by-side at 1440px against their video
frame — which is the **dark** theme. This changes light only, so the acceptance screenshot is
untouched.

## Contract edits

None yet — `proposed`. On accept:

- `comms/contracts/design-tokens.md` §2, the `body.light` block: `--ink-2: #6E6E76;` →
  `--ink-2: #6A6A72;`
- `comms/contracts/design-tokens.md` §9.1, the `--ink-2` light range: `4.25 – 5.05` →
  `4.50 – 5.05`, and the "except" clause in the verdict column deleted.
- `comms/contracts/design-tokens.md` §9.5 — deleted entirely, replaced by a one-line pointer
  to this ADR.
- `apps/web/src/styles/tokens.css`, the `body.light` block — same value, with a comment
  naming this ADR as the reason it is the one number in §1.1/§1.2 that is not verbatim.
- `apps/web/src/styles/tokens.test.ts` — the pinned light `--ink-2` assertion.

**Reviewer:** `fidelity-qa-reviewer` (Part VI). **Also affects:** `rtl-arabic-pdpl-specialist`
(M8 owns the light theme pass), `drawer-engineer` and `dashboards-engineer` (both landing §9
right now — neither is blocked on this, since §9.4b resolves their cases without it).
