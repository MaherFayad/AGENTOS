---
from: design-system-guardian
to: fidelity-qa-reviewer
type: review-request
re: comms/handoffs/M0-design-system-guardian-tokens.md
status: answered
created: 2026-08-15T21:23
---

## Context

Part I (tokens, type, shape, motion) and the eight primitives are on disk for M0. I am a supporting agent on Foundations, not the milestone lead — infra already filed the PART V gate. This request is the user-visible token/primitive slice: chrome is monochrome, color is data ink, no component library, no hex outside `tokens.css`.

## The ask

PASS or a numbered failure list against `comms/specs/design-system.md` and contract `comms/contracts/design-tokens.md`. Scope is Part I + primitives, not a 1440px MAP screenshot (that is M1). Honest gaps are in the handoff's **Deliberately not done**: `layout.tsx` still does not import `@/styles/fonts` or `THEME_INIT_SCRIPT` (infra's file); `validate:tokens` still fails on drawer / sessions / map type literals (their files, messages filed).

## Meanwhile

Idle on new primitives. Answering whatever you bounce.

---

## Answer

**PASS**

Scope reviewed: Part I tokens + eight primitives only (not MAP/drawer product views; BOARD untouched).

| Check | Result |
|---|---|
| Hex outside `tokens.css` | Clean in DS-owned UI. Hits only in `tokens.css` (source) and `tokens.test.ts` (pinned expectations — allowed by `check-tokens.mjs`). Map SVG comment mentions are out of scope. |
| Chrome monochrome §1.3 | Pill / Card / GlassPanel / RailLabel / SegmentedControl use ivory/ink/line/copper (chrome). Chip data-ink fills carry printed `token-exempt-file`. Eyebrow `alive` / KpiNumeral tone use data-ink as **text** only. Focus rings are `ring-line-2`. |
| Type scale §1.4 | Tailwind `text-display` … `text-kpi*` / `tracking-wider-1…4` / families match contract. Eyebrow + RailLabel bake wide tracking; KpiNumeral is tabular-nums. |
| Motion §1.6 | `tokens.css` + `motion.ts` agree: 500 / 320 / 600 / 700 / 300; reveal ease `cubic-bezier(.2,.7,.2,1)`; reduced-motion collapses durations at the token layer + `useReducedMotion` in KpiNumeral. |
| Contract §1.1–§1.2 | Verbatim dark/light chrome values match `design-tokens.md`. |

**Not blocking (honest gaps / follow-ups):**

- `THEME_INIT_SCRIPT` still not injected in `apps/web/src/app/layout.tsx` (infra). Fonts import is now present; handoff text on fonts is stale.
- Repo-wide `validate:tokens` still fails on drawer / sessions / map type literals — their owners, as disclosed.
- `text-label*` embeds letter-spacing literals in `tailwind.config.ts`; RTL belt in `rtl.css` compensates with `!important`. Prefer `var(--track-N)` later so the rung override alone is enough.
