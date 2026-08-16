/**
 * Test files that are excluded from the Vitest run because they **hang the runner**,
 * not because they fail.
 *
 * A hang is worse than a failure: it takes `npm run verify` from "red in 40s" to "never
 * returns", which is how a suite gets quietly dropped from CI. So each entry here is
 * excluded from collection (`vitest.config.ts`) *and* asserted as still-broken by
 * `quarantine.test.ts`, which fails until the list is empty. Nothing in this file can
 * rot silently — the suite is red for exactly as long as the list is non-empty.
 *
 * Owner of this list: `fidelity-qa-reviewer`. Owner of the fix: see `owner` below.
 * Full analysis: `comms/handoffs/M0-fidelity-qa-reviewer-test-runner.md`.
 */

export interface Quarantined {
  readonly files: readonly string[];
  readonly owner: string;
  readonly reason: string;
}

/**
 * Empty, and the only correct state for this list.
 *
 * The 8 `src/components/shell/*.test.tsx` files that were here — a circular `vi.mock`
 * factory deadlock found by `fidelity-qa-reviewer` — were fixed on 2026-08-16 by moving
 * the factories into `src/components/shell/test-mocks.tsx`, a leaf module that imports
 * nothing from `./ShellContext` or `./ui`. That file carries the full explanation, since
 * the way to re-introduce the hang is to add an import to it.
 */
export const QUARANTINE: readonly Quarantined[] = [];

/** Flat list, for `vitest.config.ts`'s `exclude`. */
export const QUARANTINED_FILES: readonly string[] = QUARANTINE.flatMap((q) => q.files);
