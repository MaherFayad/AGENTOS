# status — identity-access-engineer

**Updated:** 2026-08-18T02:00
**Milestone:** M15 (`Plan §11`) — checker fix + re-grade, not a slice
**State:** done

## Now
`identity-model.test.mjs` reported 9/9 green while blind. Measured first: one ordinary closing
pair deleted **17,336 of 35,435 visible chars (49%)**, `INSERT INTO ops.identity` 1 → 0, two
assertions still green. Root cause was a regex reading structured text, so the **instrument
changed** — `code()` is now a character scanner (line comments first, nested block comments,
opaque `'…'`, recursed `$$…$$`, and it **throws** rather than consuming to EOF).

**The stripper was hiding a worse defect.** `:138` — the PDPL "no `@` in the seed" gate — read
the *first* `VALUES (…)` in the joined corpus, i.e. `0005:211`'s **project** seed. It had never
inspected `ops.identity`. Planting `maher@example.com` in the real seed gave **9/9 green**. Now
anchored by statement name; red on that plant.

Falsified live, all plants in `0007` (mine), restored clean: email → 14/1 · lone closer →
15/0 (harmless) · **closer + violation in the previously-eaten region → 14/1** · `scopes` on
identity → 13/2 · unterminated comment → 7/8. Falsification is **6 permanent fixtures** in the
file (9 → 15 tests), not a script. `npm run test`: 199 pass, 1 skip, 0 fail.

Five blind spots written at the top of the file, incl. the unclosed one: `hasColumn` cannot see
a column added by a later `ALTER TABLE … ADD COLUMN`.

## Re-grade of the five citations
`identity.md:202`, `:270` (scopes) — **survive, never at risk**; §5 walks source files and
never calls `code()`. `identity.md:270` (no secret material) and `ADR-016:76` — **survive by
luck**, would have passed permissively over a truncated corpus; now true by construction.
`ADR-016:67` — **survives**; two of its three mechanisms never used this test.
**Sign-off `:32` — was FALSE when written.** The PDPL conclusion still holds on the mechanism
that was never the test: `CHECK (display_name !~ '@')` at `0007:110` — structural and
unexercised, no migration has met a live Postgres. Correction sent to
`rtl-arabic-pdpl-specialist`.

## Blocked on
Nothing. Open: `runner-engineer` credential split · `rtl-arabic-pdpl-specialist` sign-off
(+ my correction) · `commandcenter-orchestrator` second-shared-namespace.

## Next
1. `ops.device` transfer on `fidelity-qa-reviewer`'s PASS — `identity_id` ALTER **and** the
   exact-column list in **one commit**. `ops.billing_account` transfer still unanswered.
2. ADR-021 stays reserved until a proposed enforcement point exists.

**Checked, not mine:** `check-spec-coverage.mjs` `§99.9` is **already fixed** (ADR-034) —
re-falsified, exit 1, restored. Nothing filed; there is nothing open.
