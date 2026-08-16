# status — design-system-guardian

**Updated:** 2026-08-17T00:50
**Milestone:** M15
**State:** review

## Now
Two things done. **(1)** Finished the task a session limit killed mid-sentence: verified rather
than re-did `4e0bbe6`. Provenance test pins properties — the load-bearing one is *a scan run now
does not look old, from every reader zone* — and §8b's own "six of ten red" claim was wrong
(**seven**), found by measuring. Five §9 rulings landed; §9.7b's ledger is now **closed against
the spec** and §9.7c adopts *"check contracts against the spec, not only code against
contracts"*, whose grep immediately found a second live instance.
**(2)** Built M15's unowned slice: **`ProvenanceBadge`** — five states, three channels
(silhouette · hollow-vs-filled modifier · text weight), **zero colour**, because provenance is
chrome and a drifted fork is not unhealthy. Handed to its four consumers; mounted nowhere.

## Blocked on
nothing.

## Last handoff
`comms/handoffs/M15-design-system-guardian-provenance-badge.md` ·
`comms/handoffs/M6-design-system-guardian-provenance-clock-and-the-s9-ledger.md`

## Next
1. **Two ADR numbers requested, neither taken** — §9.7b (spec-named `--ink-3` supersession) and
   §10 (provenance is chrome; drift is not a status). Orchestrator allocates; 012 is vacant for
   exactly the reason I am waiting.
2. `ADR-011` stays **proposed** — the user's, one of six on BOARD. Not self-accepted.
3. Open with `shell-navigation-engineer`: does the switcher carry provenance per row or once at
   the top? Their IA call; I write the answer into §10.7. **Do not let the switcher grow its own
   layer marks** — that is the near-collision.
4. Open with `rtl-arabic-pdpl-specialist`: the SHA interpolated into an Arabic label is wrapped
   in `<bdi>` at the label level; whether it needs isolation at the character level is theirs,
   since the clean fix lives in their catalogue string. Also offered: `i18n.test.ts`'s exact-list
   gap lock makes an honest `todo()` more expensive than a guess.
5. Open with `dashboards-engineer`: `comms/specs/dashboards.md` REQ-DSH-33 still prescribes an
   `--ink-3` empty state while the code ships `--ink-2`.
6. Still open, raised twice by review: `text-kpi-sm` embeds weight + tracking in a size token.
   ~40 call sites; its own change, not a drive-by.
7. Offered, not done: `provenance.mjs` belongs in `check-rtl`, `validate-panels`,
   `check-spec-coverage`, `check-metrics`. Three are other agents' — needs a broadcast.

<!-- Overwrite this file each session. Under 30 lines. History lives in git and in
     handoffs/, not here. -->
