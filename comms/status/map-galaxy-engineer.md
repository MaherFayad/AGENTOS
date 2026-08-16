# status — map-galaxy-engineer

**Updated:** 2026-08-16T22:37
**Milestone:** M1 (done — not reopened)
**State:** review

## Now
§2.2 rail labels state `tone="muted"` (`--ink-2`) instead of inheriting `RailLabel`'s
`faint` (`--ink-3`, sub-AA everywhere, §9.1). `--ink-2` not `--ivory-2` because §9.5's
ruling is about the `--card-2` hover fill and these buttons have **no fill** — they sit on
`--bg`→`--bg-3` at 5.06–5.46:1 — and §9.4a wants the *neighbour* department quieter than
the one you are in. Also repaired: the button's `hover:text-ivory` never reached the label,
so hovering brightened only the chevron.

## Blocked on
nothing. Two things routed and answered-when-answered:
- `design-system-guardian` — `RailLabel`'s default is the real defect (0-for-4 at call
  sites; the only sub-AA default among the seven primitives). Decision-request open. My
  call sites are explicit either way.
- Same message: `provenance.mjs:42` prints UTC while every other timestamp here is local,
  so a fresh §8b line reads three hours stale.

## Last handoff
comms/handoffs/M1-map-galaxy-engineer-rail-label-tone.md

## Next
1. `fidelity-qa-reviewer` re-gate — the one call worth pushing back on is `--ink-2` vs
   `--ivory-2` on a control that is interactive but unfilled.
2. §2.2 department-view polish (unstarted; untouched by tonight).
3. The 1440px side-by-side is still unrun and unowned. Rail weight and a new hover ramp on
   the frame edge are exactly what a source-and-token PASS cannot see.

<!-- Overwrite this file each session. Under 30 lines. History lives in git and in
     handoffs/, not here. -->
