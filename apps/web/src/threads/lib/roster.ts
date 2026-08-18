/* =============================================================================
 * threads/lib/roster.ts — how many agents a department actually has
 *
 * `Plan §23.8` wants the composer to say `@@sales · 4 runs`. The `4` is the one
 * figure in the preview that is *supposed* to be real: it is the resolved member
 * count of the addressed department, and `addressCost()` refuses a default for it
 * because "a caller that guesses this number has invented the one figure in the
 * preview that was supposed to be real" (`packages/contracts/src/threads.ts`).
 *
 * So this module answers exactly one question — *how many members does this
 * department have, and do we actually know?* — and it answers `unknown` far more
 * often than it answers a number.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHERE THE NUMBER COMES FROM
 *
 * `useShell().search.items`, which is the shell's public projection of
 * `GET /api/p/:project/graph` — itself a projection of `agents/**​/SKILL.md`
 * (standing rule 2: frontmatter is the single source of truth and views are
 * projections). The composer therefore counts the same agents the MAP draws,
 * rather than keeping a roster of its own.
 *
 * It is **not** the runner's resolution step. thread-model §3.3 puts resolution on
 * the server, against the cascade's roster, and the server re-resolves on POST.
 * This is a *preview*; where the two disagree the server's refusal is what the
 * person sees, verbatim.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY A DEPARTMENT MUST BE PRESENT AS A DEPARTMENT BEFORE IT GETS A COUNT
 *
 * The obvious implementation — "count the agent items whose `department` matches"
 * — produces `0` for a department that does not exist, for a department whose
 * agents failed to load, and for a department that genuinely has no members. Three
 * different facts collapsed into one number, and `addressCost(fanOut, 0)` would
 * then return `{ runs: 0, runsAreExact: true }`: an *exactly zero* claim assembled
 * out of an absence. That is this repo's house defect (a declared value read as an
 * observed one) landing on the one number `Plan §23.8` requires to be real, and it
 * is the same defect the contract already removed once by deleting `memberCount`'s
 * default.
 *
 * So a department is counted **only** when the index carries a `department` item
 * with that id. No department item ⇒ the department is not in `members` ⇒ the
 * preview says `unresolved`, which `AddressBadge` renders as its own state with no
 * numeral in it. The absence of a figure is the signal.
 *
 * NODE-LOADABLE LEAF: `import type` only, no React, no runtime imports.
 * ========================================================================== */

import type { SearchItem } from '@/lib/search';

/**
 * What the composer knows about this project's departments.
 *
 * A `Map` and not a lookup function, so the caller can also ask *"is this
 * department in the project at all?"* without a second pass. Absent key ⇒ we did
 * not count, for whichever of the reasons above; never ⇒ zero.
 */
export type DepartmentRoster = ReadonlyMap<string, number>;

/** Nobody has counted anything. The honest state before the index loads. */
export const UNCOUNTED_ROSTER: DepartmentRoster = new Map();

/**
 * Count each department's agents from the shell's search index.
 *
 * @param items `useShell().search.items` — agents, departments and panels merged.
 *   Panels are ignored; they have no `department` and are not addressable.
 * @param indexed `false` when the index has not loaded or reported a failure, in
 *   which case **nothing** is counted. An index that failed to load looks exactly
 *   like a project with no agents, and only one of those is a number.
 */
export function rosterFrom(
  items: readonly SearchItem[],
  indexed: boolean,
): DepartmentRoster {
  if (!indexed) return UNCOUNTED_ROSTER;

  const members = new Map<string, number>();
  // Pass one: which departments exist. A department with no agents is a measured
  // zero and keeps its entry; a department nobody declared never gets one.
  for (const item of items) {
    if (item.kind === 'department') members.set(item.id, 0);
  }
  // Pass two: the members. An agent filed under a department the index did not
  // declare is skipped rather than inventing the department — the graph is the
  // authority on both halves and disagreeing with it here would be a third copy.
  for (const item of items) {
    if (item.kind !== 'agent') continue;
    const department = item.department;
    if (department === undefined) continue;
    const current = members.get(department);
    if (current === undefined) continue;
    members.set(department, current + 1);
  }
  return members;
}
