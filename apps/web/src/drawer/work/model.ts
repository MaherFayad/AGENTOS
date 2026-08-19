/**
 * The roster line, decomposed — M17, `Plan §13`, `comms/contracts/work-product.md` §7.
 *
 * `Plan §13`'s line is `● weekly-digest done · fix/auth · 3 commits · ⚠ UNPUSHED · PR #42 ·
 * CI green · 4m`. This module turns one `WorkProductSummary` into that line's cells, and it
 * exists as a pure function rather than as JSX because of the one property the whole screen
 * turns on and which JSX is a bad place to assert:
 *
 * ## Every cell carries how its value came to exist
 *
 * `contracts/work-product.md` §0 grades each capability `real` / `synthesized` /
 * `structural`, and the grades are not decoration:
 *
 *   - the worktree mechanic and the diff payload are **real** — produced by actual git;
 *   - the `ops.work_product` INSERT is **synthesized** — the statement is checked against
 *     the migration text and **no row has ever been written**;
 *   - `pr_url`, `pr_state`, `ci_state`, `tests_run`, `tests_passed` are **structural** —
 *     *recorded, not produced*. Nothing in this build sets them.
 *
 * So `CI green` on this screen would be **a declared value read as an observed one** — the
 * house defect, in the place where believing it is most expensive, because the person
 * believing it is about to approve code on the strength of it. The rule the contract gives
 * is exact: *render them; claim nothing observed them.* `Evidence` is how that is carried
 * to the renderer, and `RosterCell.sources` is what makes it checkable against the contract
 * rather than against a second copy of the contract's opinion.
 *
 * **A cell is never dropped to avoid the problem, and never softened into a neutral.**
 * `pushState: null` renders as *unknown, with the reason* (§5.1) — never as "nothing to
 * push", which would tell someone their work is safe when nothing looked. A structural
 * field that is `null` renders nothing at all, because `null` there means *nobody looked*
 * and there is no value to qualify.
 *
 * Owner: drawer-engineer · Consumes: comms/contracts/work-product.md §0, §5.1, §7
 */

import type { StringKey, Vars } from '@/i18n';
import type { ThreadState, WorkProductSummary } from '@agnetos/contracts';
import { relativeTime } from '../data/format';

/**
 * How the value in a cell came to exist. Three, and the third is not a shade of the second.
 *
 * `observed`  — something watched this happen: git read the worktree, the ledger recorded a
 *               time. Data ink is allowed here, because a colour is a claim and this is the
 *               only tier that has earned one.
 * `recorded`  — the value is on the row and **nothing in this build produced it**. Rendered,
 *               qualified, and deliberately monochrome: see `EVIDENCE_MAY_CARRY_DATA_INK`.
 * `unknown`   — nobody has ever looked. Rendered as a word and a reason, never as a blank
 *               and never as the benign-sounding value it is not.
 */
export type Evidence = 'observed' | 'recorded' | 'unknown';

/**
 * **Colour is only ever spent on an observation.**
 *
 * Rule 1 says chrome is monochrome and colour is data ink (§1.3). On this screen that rule
 * acquires a second edge: painting `CI passing` in `--ink-teal` would make the qualifier
 * beside it unreadable, because the green *is* the claim and no adjacent sentence out-argues
 * it. A structural value therefore gets no colour at all — its whole visual budget is
 * "quieter than the numbers next to it", which is the same treatment `unpriced` already gets
 * in LAST RUNS for the same reason.
 *
 * Exported because `RosterLine.test.tsx` asserts the rendered DOM against it rather than
 * against a comment.
 */
export const EVIDENCE_MAY_CARRY_DATA_INK: Readonly<Record<Evidence, boolean>> = {
  observed: true,
  recorded: false,
  unknown: false,
};

/** The cells `Plan §13`'s line is made of, in the order they are drawn. */
export type RosterField =
  | 'branch'
  | 'commits'
  | 'files'
  | 'lines'
  | 'pushState'
  | 'prNumber'
  | 'prState'
  | 'ciState'
  | 'tests'
  | 'diffAvailable'
  | 'blocked'
  | 'age';

export interface RosterCell {
  field: RosterField;
  /**
   * The `WorkProductSummary` fields this cell draws, spelled as the payload spells them.
   *
   * This is the hook that lets a test check the evidence grading **against the contract
   * file** instead of against a second list kept here. A pin comparing two declarations is
   * satisfiable by a lie — the thread-id pin held a contract against a constant and stayed
   * green when the constant flipped — so the assertion runs contract text against the cells
   * this function actually emits for a populated summary.
   */
  sources: readonly (keyof WorkProductSummary)[];
  evidence: Evidence;
  /** Catalogue key for the cell's text. `null` when the text is data, not copy. */
  key: StringKey | null;
  vars?: Vars;
  /** Data rendered verbatim — a branch name, a relative time. Never translated. */
  text?: string;
  /**
   * The sentence a reader needs in order not to misread the value: *recorded, not observed*
   * for a structural one, *nobody has looked* for an unknown, *checked at …* for an
   * observation with a time.
   *
   * A **separate element**, never appended to the value. Two catalogue keys concatenated at
   * a call site is banned outright (`i18n/entry.ts`) and it would be wrong here anyway: the
   * qualifier has to survive being read on its own, by a screen reader, after the value.
   */
  whyKey: StringKey | null;
  whyVars?: Vars;
  /** An address this cell links to. Only ever a value the payload carried. */
  href?: string;
}

const PUSH_KEY = {
  none: 'work.push.none',
  local: 'work.push.local',
  pushed: 'work.push.pushed',
} as const satisfies Record<'none' | 'local' | 'pushed', StringKey>;

const PR_KEY = {
  open: 'work.pr.open',
  merged: 'work.pr.merged',
  closed: 'work.pr.closed',
  draft: 'work.pr.draft',
} as const satisfies Record<string, StringKey>;

const CI_KEY = {
  pending: 'work.ci.pending',
  passing: 'work.ci.passing',
  failing: 'work.ci.failing',
  unknown: 'work.ci.unknown',
} as const satisfies Record<string, StringKey>;

/**
 * `https://github.com/o/r/pull/42` → `#42`, and `null` for anything else.
 *
 * Narrow on purpose. `Plan §13` draws `PR #42`, and the payload carries a URL and a state —
 * no number. Reading a trailing all-digits segment is the only derivation that cannot be
 * wrong about what it read, and when it does not match, the cell simply is not drawn rather
 * than guessing. The alternative — parsing host-specific URL shapes — is a client
 * reimplementing something no server told it, which is the seam this contract was drawn to
 * prevent.
 */
export function prNumberOf(prUrl: string | null): string | null {
  if (!prUrl) return null;
  const match = /\/(\d+)\/?(?:[?#].*)?$/.exec(prUrl);
  return match ? `#${match[1]}` : null;
}

export interface RosterOptions {
  now?: number;
  /**
   * The state this run left its thread in, when something told us — `done.threadState`
   * (§7). `blocked` has no other representation, and it is **not** on
   * `WorkProductSummary`: the roster route does not carry it, so a roster row read from
   * that route draws no `blocked` cell rather than a confident "not blocked".
   */
  threadState?: ThreadState | null;
}

/**
 * One `WorkProductSummary` → the cells of its line.
 *
 * Order is `Plan §13`'s order. Absent optional values produce **no cell**, which is the
 * drawer's standing collapse rule (§2.3): no empty header, no "N/A", no dash standing in
 * for a fact. The single exception is `pushState`, whose absence is itself the news.
 */
export function rosterCells(summary: WorkProductSummary, options: RosterOptions = {}): RosterCell[] {
  const cells: RosterCell[] = [];

  cells.push({
    field: 'branch',
    sources: ['branch'],
    evidence: 'observed',
    key: null,
    text: summary.branch,
    whyKey: null,
  });

  cells.push({
    field: 'commits',
    sources: ['commits'],
    evidence: 'observed',
    key: 'work.commits',
    vars: { count: summary.commits },
    whyKey: null,
  });

  cells.push({
    field: 'files',
    sources: ['filesChanged'],
    evidence: 'observed',
    key: 'work.files',
    vars: { count: summary.filesChanged },
    whyKey: null,
  });

  cells.push({
    field: 'lines',
    sources: ['insertions', 'deletions'],
    evidence: 'observed',
    key: 'work.lines',
    vars: { insertions: summary.insertions, deletions: summary.deletions },
    whyKey: null,
  });

  // `null` is a fourth state, not a missing third one. Collapsing it into `none` tells a
  // person their work is safe when nothing examined it (`work-product.md` §5.1).
  if (summary.pushState === null) {
    cells.push({
      field: 'pushState',
      sources: ['pushState', 'pushCheckedAt'],
      evidence: 'unknown',
      key: 'work.push.unknown',
      whyKey: 'work.push.unknownWhy',
    });
  } else {
    const checked = relativeTime(summary.pushCheckedAt, options.now);
    cells.push({
      field: 'pushState',
      sources: ['pushState', 'pushCheckedAt'],
      evidence: 'observed',
      key: PUSH_KEY[summary.pushState],
      whyKey: checked ? 'work.push.observedAt' : null,
      ...(checked ? { whyVars: { time: checked } } : {}),
    });
  }

  const prNumber = prNumberOf(summary.prUrl);
  if (prNumber) {
    cells.push({
      field: 'prNumber',
      sources: ['prUrl'],
      evidence: 'recorded',
      key: 'work.pr',
      vars: { number: prNumber },
      whyKey: 'work.recordedWhy',
      ...(summary.prUrl ? { href: summary.prUrl } : {}),
    });
  }

  if (summary.prState !== null) {
    cells.push({
      field: 'prState',
      sources: ['prState'],
      evidence: 'recorded',
      key: PR_KEY[summary.prState],
      whyKey: 'work.recordedWhy',
    });
  }

  if (summary.ciState !== null) {
    cells.push({
      field: 'ciState',
      sources: ['ciState'],
      evidence: 'recorded',
      key: CI_KEY[summary.ciState],
      whyKey: 'work.recordedWhy',
    });
  }

  if (summary.testsRun !== null && summary.testsPassed !== null) {
    cells.push({
      field: 'tests',
      sources: ['testsRun', 'testsPassed'],
      evidence: 'recorded',
      key: 'work.tests',
      vars: { count: summary.testsRun, passed: summary.testsPassed },
      whyKey: 'work.recordedWhy',
    });
  }

  // The tree is gone. `worktree_removed_at` is a real timestamp written by a real removal,
  // so this one is observed — and it must not look like "this run changed nothing", which
  // is the same empty file list and completely different news (§4.2).
  if (!summary.diffAvailable) {
    cells.push({
      field: 'diffAvailable',
      sources: ['diffAvailable'],
      evidence: 'observed',
      key: 'work.diffGone',
      whyKey: null,
    });
  }

  if (options.threadState === 'waiting') {
    cells.push({
      field: 'blocked',
      sources: ['threadId'],
      evidence: 'observed',
      key: 'work.blocked',
      whyKey: null,
    });
  }

  // Elapsed time is derived here and deliberately not sent (§7): a server-computed `4m`
  // goes stale in a cache and becomes a declared value.
  const age = relativeTime(summary.createdAt, options.now);
  if (age) {
    cells.push({
      field: 'age',
      sources: ['createdAt'],
      evidence: 'observed',
      key: null,
      text: age,
      whyKey: null,
    });
  }

  return cells;
}
